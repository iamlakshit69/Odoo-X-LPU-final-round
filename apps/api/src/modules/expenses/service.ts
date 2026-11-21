// Owner: Dev B – Expenses Service (Section 7.8)
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { expenses } from '../../db/schema/invoices.js';
import { Expense, CreateExpenseRequest } from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';

export class ExpensesService {
  async listExpenses(query: { status?: string; category?: string; limit?: number; cursor?: string }): Promise<{
    items: Expense[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;
    const conds: any[] = [];
    if (query.status) conds.push(eq(expenses.status, query.status));
    if (query.category) conds.push(eq(expenses.category, query.category));

    const rows = await db
      .select()
      .from(expenses)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(expenses.incurredOn))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const list = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: list.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amountPaise: e.amountPaise,
        incurredOn: String(e.incurredOn),
        paid: e.paid,
        receiptUrl: e.receiptUrl ?? undefined,
        status: e.status as any,
        submittedBy: e.submittedBy ?? undefined,
        approvedBy: e.approvedBy ?? undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      nextCursor: hasMore ? list[list.length - 1].id : null,
    };
  }

  async createExpense(input: CreateExpenseRequest, actorUserId?: string): Promise<Expense> {
    const [e] = await db
      .insert(expenses)
      .values({
        category: input.category,
        description: input.description,
        amountPaise: input.amountPaise,
        incurredOn: input.incurredOn,
        paid: input.paid ?? false,
        receiptUrl: input.receiptUrl ?? null,
        status: 'submitted',
        submittedBy: actorUserId ?? null,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'expense',
      recordId: e.id,
      after: e,
    });

    Events.publish('dashboard.tick', { source: 'expense', expenseId: e.id });

    return {
      id: e.id,
      category: e.category,
      description: e.description,
      amountPaise: e.amountPaise,
      incurredOn: String(e.incurredOn),
      paid: e.paid,
      receiptUrl: e.receiptUrl ?? undefined,
      status: e.status as any,
      submittedBy: e.submittedBy ?? undefined,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  async getExpense(id: string): Promise<Expense> {
    const [e] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!e) throw new AppError('NOT_FOUND', 'Expense not found', 404);

    return {
      id: e.id,
      category: e.category,
      description: e.description,
      amountPaise: e.amountPaise,
      incurredOn: String(e.incurredOn),
      paid: e.paid,
      receiptUrl: e.receiptUrl ?? undefined,
      status: e.status as any,
      submittedBy: e.submittedBy ?? undefined,
      approvedBy: e.approvedBy ?? undefined,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  async updateExpense(id: string, input: Partial<CreateExpenseRequest>, actorUserId?: string): Promise<Expense> {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Expense not found', 404);

    const [updated] = await db
      .update(expenses)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'expense',
      recordId: id,
      before: existing,
      after: updated,
    });

    return this.getExpense(id);
  }

  async decideExpense(id: string, approve: boolean, actorUserId?: string): Promise<Expense> {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Expense not found', 404);

    const status = approve ? 'approved' : 'rejected';
    const [updated] = await db
      .update(expenses)
      .set({
        status,
        approvedBy: actorUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: approve ? 'approve' : 'reject',
      resource: 'expense',
      recordId: id,
      before: { status: existing.status },
      after: { status: updated.status, approvedBy: updated.approvedBy },
    });

    Events.publish('dashboard.tick', { source: 'expense', expenseId: id, status });

    return this.getExpense(id);
  }
}

export const Expenses = new ExpensesService();
