// Owner: Dev B – Payments Service (Section 6 & 7.8)
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { payments, invoices } from '../../db/schema/invoices.js';
import { auditLog } from '../../db/schema/core.js';
import { PaymentService, DbTx, BalanceStatus } from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';

export class PaymentsService implements PaymentService {
  /**
   * Section 6 PaymentService.record implementation:
   * Locks the invoice row to prevent concurrent race conditions.
   * Checks overpayment and rejects with 422 OVERPAYMENT.
   */
  async record(
    input: {
      invoiceId: string;
      method: 'cash' | 'card' | 'upi' | 'online' | 'comp';
      amountPaise: number;
      reference?: string;
      tillSessionId?: string;
    },
    tx?: DbTx,
    actorUserId?: string
  ): Promise<{ paymentId: string; outstandingPaise: number; status: BalanceStatus }> {
    if (input.amountPaise <= 0) {
      throw new AppError('VALIDATION', 'Payment amount must be greater than zero', 400);
    }

    const execute = async (client: any) => {
      // 1. Lock invoice row FOR UPDATE
      const [inv] = await client
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .for('update');

      if (!inv) {
        throw new AppError('NOT_FOUND', 'Invoice not found', 404);
      }

      // 2. Calculate current payments sum
      const [sumRow] = await client
        .select({
          totalPaid: sql<number>`COALESCE(SUM(${payments.amountPaise}), 0)::int`,
        })
        .from(payments)
        .where(eq(payments.invoiceId, input.invoiceId));

      const currentPaid = Number(sumRow?.totalPaid ?? 0);

      if (currentPaid + input.amountPaise > inv.totalPaise) {
        throw new AppError(
          'OVERPAYMENT',
          `Payment of ₹${(input.amountPaise / 100).toFixed(2)} would exceed remaining invoice balance of ₹${((inv.totalPaise - currentPaid) / 100).toFixed(2)}`,
          422
        );
      }

      // 3. Insert payment ledger row
      const paymentId = randomUUID();
      const [newPmt] = await client
        .insert(payments)
        .values({
          id: paymentId,
          invoiceId: input.invoiceId,
          method: input.method,
          amountPaise: input.amountPaise,
          receivedAt: new Date(),
          receivedBy: actorUserId ?? null,
          tillSessionId: input.tillSessionId ?? null,
          reference: input.reference ?? null,
        })
        .returning();

      const newTotalPaid = currentPaid + input.amountPaise;
      const outstandingPaise = Math.max(0, inv.totalPaise - newTotalPaid);

      let status: BalanceStatus = 'partial';
      if (outstandingPaise === 0) {
        status = 'paid';
      }

      await client.insert(auditLog).values({
        actorUserId: actorUserId && actorUserId.length === 36 ? actorUserId : null,
        action: 'create',
        resource: 'payment',
        recordId: paymentId,
        after: newPmt,
        at: new Date(),
      });

      return { paymentId, outstandingPaise, status };
    };

    const res = tx ? await execute(tx) : await db.transaction(execute);
    Events.publish('dashboard.tick', { source: 'payment', paymentId: res.paymentId, invoiceId: input.invoiceId });
    return res;
  }

  /**
   * Section 6 PaymentService.refund implementation:
   * Inserts a negative payment row.
   */
  async refund(
    input: {
      invoiceId: string;
      amountPaise: number;
      reason: string;
    },
    tx?: DbTx,
    actorUserId?: string
  ): Promise<{ paymentId: string }> {
    const refundPaise = -Math.abs(input.amountPaise);

    const execute = async (client: any) => {
      const [inv] = await client
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .for('update');

      if (!inv) {
        throw new AppError('NOT_FOUND', 'Invoice not found', 404);
      }

      const paymentId = randomUUID();
      const [refundPmt] = await client
        .insert(payments)
        .values({
          id: paymentId,
          invoiceId: input.invoiceId,
          method: 'refund',
          amountPaise: refundPaise,
          receivedAt: new Date(),
          receivedBy: actorUserId ?? null,
          reference: input.reason,
        })
        .returning();

      await client.insert(auditLog).values({
        actorUserId: actorUserId && actorUserId.length === 36 ? actorUserId : null,
        action: 'refund',
        resource: 'payment',
        recordId: paymentId,
        after: refundPmt,
        at: new Date(),
      });

      return { paymentId };
    };

    const res = tx ? await execute(tx) : await db.transaction(execute);
    Events.publish('dashboard.tick', { source: 'refund', paymentId: res.paymentId, invoiceId: input.invoiceId });
    return res;
  }
}

export const Payments = new PaymentsService();
