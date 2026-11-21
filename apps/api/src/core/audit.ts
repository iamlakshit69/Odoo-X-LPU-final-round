import { db } from './db/index.js';
import { auditLog } from '../db/schema/core.js';
import { FastifyRequest } from 'fastify';

export interface AuditLogInput {
  actor: string;
  action: string;
  resource: string;
  recordId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export class AuditService {
  /**
   * Logs an action to the append-only audit_log table.
   */
  async log(entry: AuditLogInput): Promise<void> {
    try {
      await db.insert(auditLog).values({
        actorUserId: entry.actor && entry.actor.length === 36 ? entry.actor : null,
        action: entry.action,
        resource: entry.resource,
        recordId: String(entry.recordId),
        before: entry.before || null,
        after: entry.after || null,
        meta: entry.meta || null,
        requestId: entry.requestId || null,
        at: new Date(),
      });
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }
}

export const Audit = new AuditService();

/**
 * Higher-order wrapper to audit a mutation action on a resource.
 */
export async function withAudit<T>(
  req: FastifyRequest,
  options: {
    action: string;
    resource: string;
    recordId?: string | ((result: T) => string);
    before?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  const result = await fn();

  const recordId =
    typeof options.recordId === 'function'
      ? options.recordId(result)
      : options.recordId || (result as any)?.id || '';

  const actor = (req as any).user?.id || 'anonymous';
  const requestId = req.id;

  await Audit.log({
    actor,
    action: options.action,
    resource: options.resource,
    recordId: String(recordId),
    before: options.before,
    after: typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : undefined,
    meta: {
      ...options.meta,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    requestId,
  });

  return result;
}
