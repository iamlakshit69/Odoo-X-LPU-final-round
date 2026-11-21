import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import { db } from './db/index.js';
import { users, roles } from '../db/schema/core.js';
import { memberships, plans } from '../db/schema/members.js';
import { eq, and, lte, gte } from 'drizzle-orm';
import { AppError } from './errors.js';
import { getPermissionsForRole } from './rbac.js';
import { toClubLocalDate } from './clubTime.js';
import { loginRequestSchema, SessionUser } from '@club/contract';

const SESSION_COOKIE_NAME = 'session';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * PreHandler hook to enforce authentication.
 * Populates req.user with SessionUser and attached permissions.
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const cookieValue = req.cookies[SESSION_COOKIE_NAME];
  if (!cookieValue) {
    throw new AppError('UNAUTHENTICATED', 'Missing session cookie', 401);
  }

  const unsigned = req.unsignCookie(cookieValue);
  if (!unsigned.valid || !unsigned.value) {
    throw new AppError('UNAUTHENTICATED', 'Invalid session signature', 401);
  }

  let sessionData: { userId: string };
  try {
    sessionData = JSON.parse(unsigned.value);
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Malformed session data', 401);
  }

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      roleId: users.roleId,
      roleCode: roles.code,
      memberId: users.memberId,
      employeeId: users.employeeId,
      active: users.active,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, sessionData.userId))
    .limit(1);

  if (userRows.length === 0) {
    throw new AppError('UNAUTHENTICATED', 'User not found', 401);
  }

  const user = userRows[0];
  if (!user.active) {
    throw new AppError('FORBIDDEN', 'User account is deactivated', 403);
  }

  const permissionsList = await getPermissionsForRole(user.roleId);

  const sessionUser: SessionUser & { permissions: string[] } = {
    ...user,
    permissions: permissionsList,
  };

  (req as any).user = sessionUser;
  (req as any).permissions = permissionsList;
}

/**
 * PreHandler hook that optionally loads user if session cookie is present.
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  const cookieValue = req.cookies[SESSION_COOKIE_NAME];
  if (!cookieValue) return;

  const unsigned = req.unsignCookie(cookieValue);
  if (!unsigned.valid || !unsigned.value) return;

  try {
    const sessionData = JSON.parse(unsigned.value);
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        roleId: users.roleId,
        roleCode: roles.code,
        memberId: users.memberId,
        employeeId: users.employeeId,
        active: users.active,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, sessionData.userId))
      .limit(1);

    if (userRows.length > 0 && userRows[0].active) {
      const user = userRows[0];
      const permissionsList = await getPermissionsForRole(user.roleId);
      (req as any).user = { ...user, permissions: permissionsList };
      (req as any).permissions = permissionsList;
    }
  } catch {
    // Ignore invalid optional sessions
  }
}

/**
 * Registers /auth/login, /auth/logout, and /me endpoints.
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  // 1. POST /api/auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = loginRequestSchema.parse(req.body);

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        roleId: users.roleId,
        roleCode: roles.code,
        memberId: users.memberId,
        employeeId: users.employeeId,
        active: users.active,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, body.email.toLowerCase().trim()))
      .limit(1);

    if (userRows.length === 0) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password', 401);
    }

    const user = userRows[0];
    const passwordValid = await verifyPassword(user.passwordHash, body.password);
    if (!passwordValid) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password', 401);
    }

    if (!user.active) {
      throw new AppError('FORBIDDEN', 'User account is deactivated', 403);
    }

    // Set signed HTTP-only session cookie
    reply.setCookie(
      SESSION_COOKIE_NAME,
      JSON.stringify({ userId: user.id }),
      {
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      }
    );

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleCode: user.roleCode,
      memberId: user.memberId,
      employeeId: user.employeeId,
      active: user.active,
    };

    return reply.status(200).send({ user: sessionUser });
  });

  // 2. POST /api/auth/logout
  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.status(200).send({ success: true });
  });

  // 3. GET /api/me
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = (req as any).user as SessionUser & { permissions: string[] };

    let activePlan: string | null = null;
    if (user.memberId) {
      try {
        const today = toClubLocalDate(new Date());
        const membershipRows = await db
          .select({
            planCode: plans.code,
          })
          .from(memberships)
          .innerJoin(plans, eq(memberships.planId, plans.id))
          .where(
            and(
              eq(memberships.memberId, user.memberId),
              eq(memberships.status, 'active'),
              lte(memberships.startsOn, today),
              gte(memberships.endsOn, today)
            )
          )
          .limit(1);

        if (membershipRows.length > 0) {
          activePlan = membershipRows[0].planCode;
        }
      } catch (err) {
        console.error('[Auth /me] Error querying active plan:', err);
      }
    }

    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        roleCode: user.roleCode,
        memberId: user.memberId,
        employeeId: user.employeeId,
        active: user.active,
      },
      role: user.roleCode,
      permissions: user.permissions || [],
      memberId: user.memberId || null,
      activePlan,
    });
  });
}
