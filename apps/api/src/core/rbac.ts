import { FastifyReply, FastifyRequest } from 'fastify';
import { db } from './db/index.js';
import { rolePermissions, permissions } from '../db/schema/core.js';
import { eq } from 'drizzle-orm';
import { SessionUser } from '@club/contract';
import { AppError } from './errors.js';

// Cache for roleId -> permissions list with short TTL (60s)
const rolePermissionsCache = new Map<string, { permissions: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const cached = rolePermissionsCache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  try {
    const rows = await db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    const perms = rows.map((r) => r.code);
    rolePermissionsCache.set(roleId, {
      permissions: perms,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return perms;
  } catch (err) {
    console.error('[RBAC] Error querying role permissions:', err);
    return [];
  }
}

export function invalidateRolePermissionsCache(roleId?: string) {
  if (roleId) {
    rolePermissionsCache.delete(roleId);
  } else {
    rolePermissionsCache.clear();
  }
}

/**
 * Checks whether user has permission. Deny by default.
 * Owner has full access.
 * Checks exact permission match or :own scoped permission with matching ownerMemberId.
 */
export function can(
  user: SessionUser,
  permission: string,
  ctx?: { ownerMemberId?: string }
): boolean {
  // 1. Owner has unrestricted access
  if (user.roleCode === 'owner') {
    return true;
  }

  const userPerms = (user as any).permissions as string[] | undefined;
  if (!userPerms || !Array.isArray(userPerms)) {
    return false;
  }

  // 2. Exact permission match
  if (userPerms.includes(permission)) {
    return true;
  }

  // 3. Own-scoped permission match
  // e.g. user has 'booking:create:own' and we are checking 'booking:create'
  // or user has 'member:read:own' and we are checking 'member:read'
  const ownPerm = permission.endsWith(':own') ? permission : `${permission}:own`;
  if (userPerms.includes(ownPerm)) {
    if (ctx?.ownerMemberId && user.memberId && ctx.ownerMemberId === user.memberId) {
      return true;
    }
  }

  // 4. Deny by default
  return false;
}

/**
 * Route preHandler hook guarding an endpoint with a permission.
 */
export function guard(
  permission: string,
  getOwnerMemberId?: (req: FastifyRequest) => string | undefined | Promise<string | undefined>
) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
    }

    const ownerMemberId = getOwnerMemberId ? await getOwnerMemberId(req) : undefined;

    if (!can(user, permission, { ownerMemberId })) {
      throw new AppError('FORBIDDEN', `Forbidden: missing permission ${permission}`, 403);
    }
  };
}
