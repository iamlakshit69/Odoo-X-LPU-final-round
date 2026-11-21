// Owner: Dev B – Invoices Service (Section 6 & 7.8)
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { invoices, invoiceLines, payments, taxRates } from '../../db/schema/invoices.js';
import {
  InvoiceService,
  DbTx,
  LineSource,
  InvoiceSummary,
  InvoiceDetail,
  InvoiceLine,
  Payment,
  BalanceStatus,
  InvoiceStatus,
  SessionUser,
} from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';

export class InvoicesService implements InvoiceService {
  private async generateInvoiceNumber(client: any = db): Promise<string> {
    const year = new Date().getFullYear();
    try {
      const res = await client.execute(sql`SELECT nextval('invoice_number_seq') AS num`);
      const num = Number((res.rows as any[])[0]?.num ?? 1);
      return `INV-${year}-${String(num).padStart(6, '0')}`;
    } catch {
      const ts = String(Date.now() % 1000000).padStart(6, '0');
      return `INV-${year}-${ts}`;
    }
  }

  /**
   * Helper to compute line tax using Section 7.8 GST rules:
   * tax = round(taxable * rate_bps / 10000)
   * cgst = floor(tax / 2)
   * sgst = tax - cgst
   * lineTotal = taxable + tax
   */
  private calculateLineTaxes(line: {
    qty: number;
    unitPricePaise: number;
    discountPaise?: number;
    rateBps: number;
  }) {
    const taxablePaise = Math.max(0, line.qty * line.unitPricePaise - (line.discountPaise || 0));
    const taxPaise = Math.round((taxablePaise * line.rateBps) / 10000);
    const cgstPaise = Math.floor(taxPaise / 2);
    const sgstPaise = taxPaise - cgstPaise;
    const totalPaise = taxablePaise + taxPaise;
    return { taxablePaise, cgstPaise, sgstPaise, totalPaise };
  }

  /**
   * Section 6 InvoiceService.create implementation:
   * Joins caller's transaction if provided.
   */
  async create(
    input: {
      customer: { memberId?: string; businessClientId?: string; guestName?: string };
      lines: Array<{
        source: LineSource;
        description: string;
        qty: number;
        unitPricePaise: number;
        discountPaise?: number;
        taxCategory: string;
        refType: string;
        refId: string;
      }>;
      dueOn?: Date;
    },
    tx?: DbTx
  ): Promise<{ invoiceId: string; number: string; totalPaise: number }> {
    const execute = async (client: any) => {
      const invoiceId = randomUUID();
      const invoiceNumber = await this.generateInvoiceNumber(client);

      // Fetch all required tax rates
      const rates = await client.select().from(taxRates);
      const rateMap = new Map<string, number>();
      for (const r of rates) {
        rateMap.set(r.category, r.rateBps);
      }

      let subtotalPaise = 0;
      let cgstPaise = 0;
      let sgstPaise = 0;
      let totalPaise = 0;

      const computedLines = input.lines.map((l) => {
        const rateBps = rateMap.get(l.taxCategory) ?? 0;
        const taxCalc = this.calculateLineTaxes({
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          discountPaise: l.discountPaise,
          rateBps,
        });

        subtotalPaise += taxCalc.taxablePaise;
        cgstPaise += taxCalc.cgstPaise;
        sgstPaise += taxCalc.sgstPaise;
        totalPaise += taxCalc.totalPaise;

        return {
          id: randomUUID(),
          invoiceId,
          source: l.source,
          description: l.description,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          discountPaise: l.discountPaise ?? 0,
          taxablePaise: taxCalc.taxablePaise,
          taxRateBps: rateBps,
          cgstPaise: taxCalc.cgstPaise,
          sgstPaise: taxCalc.sgstPaise,
          totalPaise: taxCalc.totalPaise,
          refType: l.refType,
          refId: l.refId,
        };
      });

      const dueOnStr = input.dueOn
        ? input.dueOn.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const [newInvoice] = await client
        .insert(invoices)
        .values({
          id: invoiceId,
          number: invoiceNumber,
          memberId: input.customer.memberId ?? null,
          businessClientId: input.customer.businessClientId ?? null,
          guestName: input.customer.guestName ?? null,
          status: 'issued',
          issuedAt: new Date(),
          dueOn: dueOnStr,
          subtotalPaise,
          cgstPaise,
          sgstPaise,
          totalPaise,
        })
        .returning();

      if (computedLines.length > 0) {
        await client.insert(invoiceLines).values(computedLines);
      }

      return {
        invoiceId: newInvoice.id,
        number: newInvoice.number,
        totalPaise: newInvoice.totalPaise,
      };
    };

    const res = tx ? await execute(tx) : await db.transaction(execute);
    Events.publish('dashboard.tick', { source: 'invoice', invoiceId: res.invoiceId });
    return res;
  }

  /**
   * Section 6 InvoiceService.addLines implementation
   */
  async addLines(
    invoiceId: string,
    lines: Array<{
      source: LineSource;
      description: string;
      qty: number;
      unitPricePaise: number;
      discountPaise?: number;
      taxCategory: string;
      refType: string;
      refId: string;
    }>,
    tx?: DbTx
  ): Promise<void> {
    const execute = async (client: any) => {
      const [inv] = await client
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .for('update');

      if (!inv) {
        throw new AppError('NOT_FOUND', 'Invoice not found', 404);
      }

      const rates = await client.select().from(taxRates);
      const rateMap = new Map<string, number>();
      for (const r of rates) {
        rateMap.set(r.category, r.rateBps);
      }

      let addSubtotal = 0;
      let addCgst = 0;
      let addSgst = 0;
      let addTotal = 0;

      const computedLines = lines.map((l) => {
        const rateBps = rateMap.get(l.taxCategory) ?? 0;
        const taxCalc = this.calculateLineTaxes({
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          discountPaise: l.discountPaise,
          rateBps,
        });

        addSubtotal += taxCalc.taxablePaise;
        addCgst += taxCalc.cgstPaise;
        addSgst += taxCalc.sgstPaise;
        addTotal += taxCalc.totalPaise;

        return {
          id: randomUUID(),
          invoiceId,
          source: l.source,
          description: l.description,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          discountPaise: l.discountPaise ?? 0,
          taxablePaise: taxCalc.taxablePaise,
          taxRateBps: rateBps,
          cgstPaise: taxCalc.cgstPaise,
          sgstPaise: taxCalc.sgstPaise,
          totalPaise: taxCalc.totalPaise,
          refType: l.refType,
          refId: l.refId,
        };
      });

      if (computedLines.length > 0) {
        await client.insert(invoiceLines).values(computedLines);
      }

      await client
        .update(invoices)
        .set({
          subtotalPaise: inv.subtotalPaise + addSubtotal,
          cgstPaise: inv.cgstPaise + addCgst,
          sgstPaise: inv.sgstPaise + addSgst,
          totalPaise: inv.totalPaise + addTotal,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));
    };

    if (tx) {
      return execute(tx);
    }
    return db.transaction(execute);
  }

  async getInvoice(id: string): Promise<InvoiceDetail> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) {
      throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    }

    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    const pmts = await db.select().from(payments).where(eq(payments.invoiceId, id));

    const paidPaise = pmts.reduce((sum, p) => sum + p.amountPaise, 0);
    const chargedPaise = inv.totalPaise;
    const outstandingPaise = Math.max(0, chargedPaise - paidPaise);

    let balanceStatus: BalanceStatus = 'unpaid';
    if (paidPaise > chargedPaise) balanceStatus = 'overpaid';
    else if (paidPaise >= chargedPaise) balanceStatus = 'paid';
    else if (paidPaise > 0) balanceStatus = 'partial';

    return {
      id: inv.id,
      number: inv.number,
      memberId: inv.memberId ?? undefined,
      businessClientId: inv.businessClientId ?? undefined,
      guestName: inv.guestName ?? undefined,
      status: inv.status as InvoiceStatus,
      issuedAt: inv.issuedAt.toISOString(),
      dueOn: inv.dueOn ? String(inv.dueOn) : undefined,
      subtotalPaise: inv.subtotalPaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      totalPaise: inv.totalPaise,
      chargedPaise,
      paidPaise,
      outstandingPaise,
      balanceStatus,
      lines: lines.map((l) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        source: l.source as LineSource,
        description: l.description,
        qty: l.qty,
        unitPricePaise: l.unitPricePaise,
        discountPaise: l.discountPaise,
        taxablePaise: l.taxablePaise,
        taxRateBps: l.taxRateBps,
        cgstPaise: l.cgstPaise,
        sgstPaise: l.sgstPaise,
        totalPaise: l.totalPaise,
        refType: l.refType ?? undefined,
        refId: l.refId ?? undefined,
      })),
      payments: pmts.map((p) => ({
        id: p.id,
        invoiceId: p.invoiceId,
        method: p.method as any,
        amountPaise: p.amountPaise,
        receivedAt: p.receivedAt.toISOString(),
        receivedBy: p.receivedBy ?? undefined,
        tillSessionId: p.tillSessionId ?? undefined,
        reference: p.reference ?? undefined,
      })),
      pdfUrl: `/api/invoices/${inv.id}/pdf`,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    };
  }

  async listInvoices(query: {
    status?: string;
    memberId?: string;
    businessClientId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: InvoiceSummary[]; nextCursor?: string | null }> {
    const limit = query.limit ?? 50;

    let conditions: any[] = [];
    if (query.status) conditions.push(eq(invoices.status, query.status));
    if (query.memberId) conditions.push(eq(invoices.memberId, query.memberId));
    if (query.businessClientId) conditions.push(eq(invoices.businessClientId, query.businessClientId));

    const rows = await db
      .select()
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issuedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Fetch payments to compute balances
    const invoiceIds = items.map((i) => i.id);
    const paidSums = new Map<string, number>();

    if (invoiceIds.length > 0) {
      const pmts = await db
        .select({
          invoiceId: payments.invoiceId,
          totalPaid: sql<number>`COALESCE(SUM(${payments.amountPaise}), 0)::int`,
        })
        .from(payments)
        .groupBy(payments.invoiceId);

      for (const p of pmts) {
        paidSums.set(p.invoiceId, Number(p.totalPaid));
      }
    }

    const summaries: InvoiceSummary[] = items.map((inv) => {
      const paidPaise = paidSums.get(inv.id) ?? 0;
      const chargedPaise = inv.totalPaise;
      const outstandingPaise = Math.max(0, chargedPaise - paidPaise);

      let balanceStatus: BalanceStatus = 'unpaid';
      if (paidPaise > chargedPaise) balanceStatus = 'overpaid';
      else if (paidPaise >= chargedPaise) balanceStatus = 'paid';
      else if (paidPaise > 0) balanceStatus = 'partial';

      return {
        id: inv.id,
        number: inv.number,
        memberId: inv.memberId ?? undefined,
        businessClientId: inv.businessClientId ?? undefined,
        guestName: inv.guestName ?? undefined,
        status: inv.status as InvoiceStatus,
        issuedAt: inv.issuedAt.toISOString(),
        dueOn: inv.dueOn ? String(inv.dueOn) : undefined,
        subtotalPaise: inv.subtotalPaise,
        cgstPaise: inv.cgstPaise,
        sgstPaise: inv.sgstPaise,
        totalPaise: inv.totalPaise,
        chargedPaise,
        paidPaise,
        outstandingPaise,
        balanceStatus,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
      };
    });

    return {
      items: summaries,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async renderInvoicePdfHtml(id: string): Promise<string> {
    const inv = await this.getInvoice(id);
    const linesHtml = inv.lines
      .map(
        (l) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${l.description} (${l.source})</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${l.qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(l.unitPricePaise / 100).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(l.discountPaise / 100).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${(l.taxRateBps / 100).toFixed(2)}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${((l.cgstPaise + l.sgstPaise) / 100).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(l.totalPaise / 100).toFixed(2)}</td>
      </tr>`
      )
      .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Tax Invoice ${inv.number}</title>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 40px; color: #333;">
      <div style="border-bottom: 2px solid #333; padding-bottom: 20px;">
        <h2>CHAMPIONS CLUB</h2>
        <p>Sports, Leisure & Wellness Club</p>
        <h3>TAX INVOICE: ${inv.number}</h3>
        <p>Date: ${inv.issuedAt.slice(0, 10)} | Status: ${inv.status.toUpperCase()}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f4f4f4;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: right;">Qty</th>
            <th style="padding: 8px; text-align: right;">Unit Price</th>
            <th style="padding: 8px; text-align: right;">Discount</th>
            <th style="padding: 8px; text-align: right;">GST Rate</th>
            <th style="padding: 8px; text-align: right;">CGST + SGST</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>
      <div style="margin-top: 30px; text-align: right;">
        <p><strong>Subtotal (Taxable):</strong> ₹${(inv.subtotalPaise / 100).toFixed(2)}</p>
        <p><strong>CGST:</strong> ₹${(inv.cgstPaise / 100).toFixed(2)}</p>
        <p><strong>SGST:</strong> ₹${(inv.sgstPaise / 100).toFixed(2)}</p>
        <h3>Grand Total: ₹${(inv.totalPaise / 100).toFixed(2)}</h3>
        <p>Paid: ₹${(inv.paidPaise / 100).toFixed(2)} | Outstanding: ₹${(inv.outstandingPaise / 100).toFixed(2)} (${inv.balanceStatus.toUpperCase()})</p>
      </div>
    </body>
    </html>`;
  }
}

export const Invoices = new InvoicesService();
