// Owner: Dev B – Finance Module Service (Section 7.8)
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  businessClients,
  invoices,
  invoiceLines,
  payments,
  expenses,
} from '../../db/schema/invoices.js';
import { payslips } from '../../db/schema/hr.js';
import {
  BusinessClient,
  FinanceSummary,
  CreateBusinessClientRequest,
  LineSource,
  PaymentMethod,
} from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';

export class FinanceService {
  // 1. Business Clients Management
  async getBusinessClients(): Promise<BusinessClient[]> {
    const rows = await db.select().from(businessClients).orderBy(businessClients.name);
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      gstin: c.gstin ?? undefined,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      creditDays: c.creditDays,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async createBusinessClient(input: CreateBusinessClientRequest, actorUserId?: string): Promise<BusinessClient> {
    const [c] = await db
      .insert(businessClients)
      .values({
        name: input.name,
        gstin: input.gstin ?? null,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        creditDays: input.creditDays ?? 30,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'business_client',
      recordId: c.id,
      after: c,
    });

    return {
      id: c.id,
      name: c.name,
      gstin: c.gstin ?? undefined,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      creditDays: c.creditDays,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async getBusinessClient(id: string): Promise<BusinessClient> {
    const [c] = await db.select().from(businessClients).where(eq(businessClients.id, id)).limit(1);
    if (!c) throw new AppError('NOT_FOUND', 'Business client not found', 404);

    return {
      id: c.id,
      name: c.name,
      gstin: c.gstin ?? undefined,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      creditDays: c.creditDays,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async updateBusinessClient(id: string, input: Partial<CreateBusinessClientRequest>, actorUserId?: string): Promise<BusinessClient> {
    const [existing] = await db.select().from(businessClients).where(eq(businessClients.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Business client not found', 404);

    const [updated] = await db
      .update(businessClients)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(businessClients.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'business_client',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      name: updated.name,
      gstin: updated.gstin ?? undefined,
      contactName: updated.contactName,
      phone: updated.phone,
      email: updated.email,
      creditDays: updated.creditDays,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteBusinessClient(id: string, actorUserId?: string): Promise<{ success: boolean }> {
    await db.delete(businessClients).where(eq(businessClients.id, id));
    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'delete',
      resource: 'business_client',
      recordId: id,
    });
    return { success: true };
  }

  // 2. Owner Finance Dashboard Summary (Section 7.8)
  async getSummary(query: { from: string; to: string; group?: 'day' | 'week' | 'month' }): Promise<FinanceSummary> {
    const fromDate = new Date(`${query.from}T00:00:00+05:30`);
    const toDate = new Date(`${query.to}T23:59:59.999+05:30`);

    // Charged, Tax, Taxable revenue from issued invoices
    const invRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(total_paise), 0)::int AS charged,
        COALESCE(SUM(subtotal_paise), 0)::int AS taxable,
        COALESCE(SUM(cgst_paise + sgst_paise), 0)::int AS gst_collected
      FROM invoices
      WHERE status = 'issued'
        AND issued_at >= ${fromDate}
        AND issued_at <= ${toDate}
    `);
    const invData = ((invRes.rows as any[]) || [])[0] ?? {};
    const charged = Number(invData.charged ?? 0);
    const taxableRevenue = Number(invData.taxable ?? 0);
    const gstCollected = Number(invData.gst_collected ?? 0);

    // Collected from payments
    const pmtRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount_paise), 0)::int AS collected
      FROM payments
      WHERE received_at >= ${fromDate}
        AND received_at <= ${toDate}
    `);
    const pmtData = ((pmtRes.rows as any[]) || [])[0] ?? {};
    const collected = Number(pmtData.collected ?? 0);
    const outstanding = Math.max(0, charged - collected);

    // Approved Expenses
    const expRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount_paise), 0)::int AS expenses
      FROM expenses
      WHERE status = 'approved'
        AND incurred_on >= ${query.from}
        AND incurred_on <= ${query.to}
    `);
    const expData = ((expRes.rows as any[]) || [])[0] ?? {};
    const approvedExpenses = Number(expData.expenses ?? 0);

    // Payroll Due
    const payRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(net_paise), 0)::int AS payroll_due
      FROM payslips
      WHERE month_on >= ${query.from}
        AND month_on <= ${query.to}
    `);
    const payData = ((payRes.rows as any[]) || [])[0] ?? {};
    const payrollDue = Number(payData.payroll_due ?? 0);

    // Profit = Taxable revenue - approved expenses - payroll
    const profit = taxableRevenue - approvedExpenses - payrollDue;

    // By Source (Section 7.8)
    const sourceRes = await db.execute(sql`
      SELECT
        il.source,
        COALESCE(SUM(il.total_paise), 0)::int AS amount
      FROM invoice_lines il
      JOIN invoices i ON il.invoice_id = i.id
      WHERE i.status = 'issued'
        AND i.issued_at >= ${fromDate}
        AND i.issued_at <= ${toDate}
      GROUP BY il.source
    `);
    const bySource = ((sourceRes.rows as any[]) || []).map((r) => ({
      source: r.source as LineSource,
      amountPaise: Number(r.amount),
    }));

    // By Method
    const methodRes = await db.execute(sql`
      SELECT
        method,
        COALESCE(SUM(amount_paise), 0)::int AS amount
      FROM payments
      WHERE received_at >= ${fromDate}
        AND received_at <= ${toDate}
        AND amount_paise > 0
      GROUP BY method
    `);
    const byMethod = ((methodRes.rows as any[]) || []).map((r) => ({
      method: r.method as PaymentMethod,
      amountPaise: Number(r.amount),
    }));

    // Time Series by day (club-local Asia/Kolkata date)
    const seriesRes = await db.execute(sql`
      SELECT
        (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date,
        COALESCE(SUM(i.total_paise), 0)::int AS charged,
        COALESCE(SUM(p.paid), 0)::int AS collected
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_paise) AS paid
        FROM payments
        GROUP BY invoice_id
      ) p ON i.id = p.invoice_id
      WHERE i.status = 'issued'
        AND i.issued_at >= ${fromDate}
        AND i.issued_at <= ${toDate}
      GROUP BY (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date ASC
    `);

    const series = ((seriesRes.rows as any[]) || []).map((r) => ({
      date: String(r.date),
      charged: Number(r.charged),
      collected: Number(r.collected),
      expenses: 0,
      profit: Number(r.charged),
    }));

    return {
      charged,
      collected,
      outstanding,
      gstCollected,
      expenses: approvedExpenses,
      profit,
      payrollDue,
      bySource,
      byMethod,
      series,
    };
  }

  // 3. Receivables & Aging Buckets (0-30, 31-60, 61+)
  async getReceivables(): Promise<{
    bucket0_30Paise: number;
    bucket31_60Paise: number;
    bucket61PlusPaise: number;
    totalOutstandingPaise: number;
    clients: Array<{ clientName: string; outstandingPaise: number; bucket: '0-30' | '31-60' | '61+' }>;
  }> {
    const res = await db.execute(sql`
      SELECT
        i.id AS invoice_id,
        COALESCE(bc.name, i.guest_name, 'Member') AS client_name,
        i.total_paise - COALESCE(p.paid_sum, 0) AS outstanding,
        CURRENT_DATE - i.due_on AS days_overdue
      FROM invoices i
      LEFT JOIN business_clients bc ON i.business_client_id = bc.id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_paise) AS paid_sum
        FROM payments
        GROUP BY invoice_id
      ) p ON i.id = p.invoice_id
      WHERE i.status = 'issued'
        AND (i.total_paise - COALESCE(p.paid_sum, 0)) > 0
    `);

    const rows = (res.rows as any[]) || [];

    let bucket0_30Paise = 0;
    let bucket31_60Paise = 0;
    let bucket61PlusPaise = 0;

    const clients: Array<{ clientName: string; outstandingPaise: number; bucket: '0-30' | '31-60' | '61+' }> = [];

    for (const r of rows) {
      const outstanding = Number(r.outstanding);
      const days = Number(r.days_overdue ?? 0);

      let bucket: '0-30' | '31-60' | '61+' = '0-30';
      if (days > 60) {
        bucket = '61+';
        bucket61PlusPaise += outstanding;
      } else if (days > 30) {
        bucket = '31-60';
        bucket31_60Paise += outstanding;
      } else {
        bucket = '0-30';
        bucket0_30Paise += outstanding;
      }

      clients.push({
        clientName: String(r.client_name),
        outstandingPaise: outstanding,
        bucket,
      });
    }

    return {
      bucket0_30Paise,
      bucket31_60Paise,
      bucket61PlusPaise,
      totalOutstandingPaise: bucket0_30Paise + bucket31_60Paise + bucket61PlusPaise,
      clients,
    };
  }

  // 4. CSV Export
  async exportCsv(from?: string, to?: string): Promise<{ csv: string; filename: string }> {
    const fromStr = from ?? '2000-01-01';
    const toStr = to ?? new Date().toISOString().slice(0, 10);
    const fromDate = new Date(`${fromStr}T00:00:00+05:30`);
    const toDate = new Date(`${toStr}T23:59:59.999+05:30`);

    const invRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, 'issued'), gte(invoices.issuedAt, fromDate), lte(invoices.issuedAt, toDate)))
      .orderBy(invoices.issuedAt);

    let csv = 'Invoice Number,Issued At,Due On,Subtotal (₹),CGST (₹),SGST (₹),Total (₹),Status\n';
    for (const inv of invRows) {
      csv += `${inv.number},${inv.issuedAt.toISOString().slice(0, 10)},${inv.dueOn ?? ''},${(inv.subtotalPaise / 100).toFixed(2)},${(inv.cgstPaise / 100).toFixed(2)},${(inv.sgstPaise / 100).toFixed(2)},${(inv.totalPaise / 100).toFixed(2)},${inv.status}\n`;
    }

    return {
      csv,
      filename: `finance-export-${fromStr}-to-${toStr}.csv`,
    };
  }

  // 5. Share Snapshot Link (P1)
  async createShareLink(from: string, to: string): Promise<{ token: string; url: string; expiresAt: string }> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      token,
      url: `/public/finance/snapshot?token=${token}&from=${from}&to=${to}`,
      expiresAt,
    };
  }
}

export const Finance = new FinanceService();
