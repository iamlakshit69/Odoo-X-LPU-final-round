// Owner: Dev B – Tax Module Service
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { taxRates } from '../../db/schema/invoices.js';
import { TaxRate } from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';

export function computeLineTax(
  taxablePaise: number,
  rateBps: number
): {
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
} {
  const tax = Math.round((taxablePaise * rateBps) / 10000);
  const cgst = Math.floor(tax / 2);
  const sgst = tax - cgst;
  return {
    taxPaise: tax,
    cgstPaise: cgst,
    sgstPaise: sgst,
    totalPaise: taxablePaise + tax,
  };
}

export class TaxService {
  computeLineTax(taxablePaise: number, rateBps: number) {
    return computeLineTax(taxablePaise, rateBps);
  }

  async getTaxRates(): Promise<TaxRate[]> {
    const rows = await db.select().from(taxRates);
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      rateBps: r.rateBps,
      description: r.description ?? undefined,
    }));
  }

  async getRateBps(category: string): Promise<number> {
    const [rate] = await db
      .select({ rateBps: taxRates.rateBps })
      .from(taxRates)
      .where(eq(taxRates.category, category))
      .limit(1);
    return rate ? rate.rateBps : 0;
  }

  async updateTaxRate(
    id: string,
    input: { rateBps: number; description?: string },
    actorUserId?: string
  ): Promise<TaxRate> {
    const [existing] = await db.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Tax rate category not found', 404);
    }

    const [updated] = await db
      .update(taxRates)
      .set({
        rateBps: input.rateBps,
        description: input.description ?? existing.description,
        updatedAt: new Date(),
      })
      .where(eq(taxRates.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'tax_rate',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      category: updated.category,
      rateBps: updated.rateBps,
      description: updated.description ?? undefined,
    };
  }
}

export const Tax = new TaxService();
