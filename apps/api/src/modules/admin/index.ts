import { FastifyInstance } from 'fastify';
import { db } from '../../core/db/index.js';
import {
  roles,
  permissions,
  rolePermissions,
  users,
  settings,
  auditLog,
} from '../../db/schema/core.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { guard, invalidateRolePermissionsCache } from '../../core/rbac.js';
import { withAudit } from '../../core/audit.js';
import { Settings } from '../../core/settings.js';
import { hashPassword } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import {
  updateRolePermissionsRequestSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  updateSettingRequestSchema,
} from '@club/contract';

export async function register(app: FastifyInstance) {
  // 1. GET /api/admin/roles
  app.get('/admin/roles', { preHandler: [guard('rbac:manage')] }, async () => {
    const allRoles = await db.select().from(roles);
    const result = [];

    for (const r of allRoles) {
      const perms = await db
        .select({
          id: permissions.id,
          code: permissions.code,
          description: permissions.description,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, r.id));

      result.push({
        ...r,
        permissions: perms,
      });
    }

    return result;
  });

  // 2. PUT /api/admin/roles/:id/permissions
  app.put<{ Params: { id: string } }>(
    '/admin/roles/:id/permissions',
    { preHandler: [guard('rbac:manage')] },
    async (req, reply) => {
      const { id: roleId } = req.params;
      const body = updateRolePermissionsRequestSchema.parse(req.body);

      const updated = await withAudit(
        req,
        {
          action: 'role.update_permissions',
          resource: 'role',
          recordId: roleId,
        },
        async () => {
          // Delete existing permissions for role
          await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

          // Insert new permissions
          for (const permId of body.permissionIds) {
            await db.insert(rolePermissions).values({
              roleId,
              permissionId: permId,
            });
          }

          invalidateRolePermissionsCache(roleId);

          const roleRows = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
          if (roleRows.length === 0) {
            throw new AppError('NOT_FOUND', 'Role not found', 404);
          }

          const perms = await db
            .select({
              id: permissions.id,
              code: permissions.code,
              description: permissions.description,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, roleId));

          return {
            ...roleRows[0],
            permissions: perms,
          };
        }
      );

      return reply.status(200).send(updated);
    }
  );

  // 3. GET /api/admin/users
  app.get<{ Querystring: { limit?: number; cursor?: string; roleId?: string; active?: boolean } }>(
    '/admin/users',
    { preHandler: [guard('user:manage')] },
    async (req) => {
      const limit = Number(req.query.limit) || 50;

      const userRows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          roleId: users.roleId,
          roleCode: roles.code,
          roleName: roles.name,
          memberId: users.memberId,
          employeeId: users.employeeId,
          active: users.active,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .orderBy(desc(users.createdAt))
        .limit(limit);

      return {
        items: userRows,
        nextCursor: null,
      };
    }
  );

  // 4. POST /api/admin/users
  app.post(
    '/admin/users',
    { preHandler: [guard('user:manage')] },
    async (req, reply) => {
      const body = createUserRequestSchema.parse(req.body);

      const created = await withAudit(
        req,
        {
          action: 'user.create',
          resource: 'user',
        },
        async () => {
          const passwordHash = await hashPassword(body.password);
          const inserted = await db
            .insert(users)
            .values({
              email: body.email.toLowerCase().trim(),
              passwordHash,
              name: body.name,
              roleId: body.roleId,
              memberId: body.memberId || null,
              employeeId: body.employeeId || null,
              active: true,
            })
            .returning();

          const roleRows = await db.select().from(roles).where(eq(roles.id, body.roleId)).limit(1);

          return {
            ...inserted[0],
            roleCode: roleRows[0]?.code || '',
            roleName: roleRows[0]?.name || '',
          };
        }
      );

      return reply.status(201).send(created);
    }
  );

  // 5. PATCH /api/admin/users/:id
  app.patch<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: [guard('user:manage')] },
    async (req, reply) => {
      const { id: userId } = req.params;
      const body = updateUserRequestSchema.parse(req.body);

      const updated = await withAudit(
        req,
        {
          action: 'user.update',
          resource: 'user',
          recordId: userId,
        },
        async () => {
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (body.name !== undefined) updateData.name = body.name;
          if (body.roleId !== undefined) updateData.roleId = body.roleId;
          if (body.active !== undefined) updateData.active = body.active;
          if (body.password !== undefined) {
            updateData.passwordHash = await hashPassword(body.password);
          }

          const res = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning();

          if (res.length === 0) {
            throw new AppError('NOT_FOUND', 'User not found', 404);
          }

          const roleRows = await db.select().from(roles).where(eq(roles.id, res[0].roleId)).limit(1);

          return {
            ...res[0],
            roleCode: roleRows[0]?.code || '',
            roleName: roleRows[0]?.name || '',
          };
        }
      );

      return reply.status(200).send(updated);
    }
  );

  // 6. GET /api/admin/settings/:key
  app.get<{ Params: { key: string } }>(
    '/admin/settings/:key',
    { preHandler: [guard('settings:manage')] },
    async (req, reply) => {
      const { key } = req.params;
      const value = await Settings.get(key);

      if (value === undefined) {
        throw new AppError('NOT_FOUND', `Setting not found: ${key}`, 404);
      }

      const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      return reply.status(200).send({
        key,
        value,
        description: rows[0]?.description || null,
        updatedBy: rows[0]?.updatedBy || null,
        updatedAt: rows[0]?.updatedAt || new Date().toISOString(),
      });
    }
  );

  // 7. PUT /api/admin/settings/:key
  app.put<{ Params: { key: string } }>(
    '/admin/settings/:key',
    { preHandler: [guard('settings:manage')] },
    async (req, reply) => {
      const { key } = req.params;
      const body = updateSettingRequestSchema.parse(req.body);

      await withAudit(
        req,
        {
          action: 'settings.update',
          resource: 'settings',
          recordId: key,
        },
        async () => {
          const actorUserId = (req as any).user?.id;
          await Settings.set(key, body.value, actorUserId);
        }
      );

      const updatedVal = await Settings.get(key);
      const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

      return reply.status(200).send({
        key,
        value: updatedVal,
        description: rows[0]?.description || body.description || null,
        updatedBy: rows[0]?.updatedBy || null,
        updatedAt: rows[0]?.updatedAt || new Date().toISOString(),
      });
    }
  );

  // 8. GET /api/admin/audit
  app.get<{ Querystring: { limit?: number; cursor?: string; resource?: string; actor?: string; from?: string; to?: string } }>(
    '/admin/audit',
    { preHandler: [guard('audit:read')] },
    async (req) => {
      const limit = Number(req.query.limit) || 50;
      const conditions = [];

      if (req.query.resource) {
        conditions.push(eq(auditLog.resource, req.query.resource));
      }
      if (req.query.actor) {
        conditions.push(eq(auditLog.actorUserId, req.query.actor));
      }
      if (req.query.from) {
        conditions.push(gte(auditLog.at, new Date(req.query.from)));
      }
      if (req.query.to) {
        conditions.push(lte(auditLog.at, new Date(req.query.to)));
      }

      const query = db
        .select()
        .from(auditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.at))
        .limit(limit);

      const items = await query;
      return {
        items,
        nextCursor: null,
      };
    }
  );
}
