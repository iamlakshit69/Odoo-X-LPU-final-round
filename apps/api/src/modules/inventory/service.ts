// Owner: Dev B – Inventory Service
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { stockMovements, stockLevels } from '../../db/schema/shop.js';
import { StockLevel, StockMovement, CreateStockMovementRequest } from '@club/contract';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { Notifications } from '../../core/notifications.js';

export class InventoryService {
  async getStock(query: { lowOnly?: boolean; limit?: number; cursor?: string }): Promise<{
    items: StockLevel[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;

    let queryStr = `
      SELECT
        variant_id AS "variantId",
        sku,
        option_label AS "optionLabel",
        product_id AS "productId",
        product_name AS "productName",
        category,
        on_hand AS "onHand",
        reserved,
        saleable,
        low_stock_threshold AS "lowStockThreshold",
        is_low AS "isLow"
      FROM v_stock
    `;

    if (query.lowOnly) {
      queryStr += ` WHERE is_low = true`;
    }

    queryStr += ` ORDER BY product_name ASC, sku ASC LIMIT ${limit + 1}`;

    const res = await db.execute(sql.raw(queryStr));
    const rows = (res.rows as any[]) || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((r) => ({
        variantId: r.variantId,
        sku: r.sku,
        optionLabel: r.optionLabel,
        productId: r.productId,
        productName: r.productName,
        category: r.category,
        onHand: Number(r.onHand),
        reserved: Number(r.reserved),
        saleable: Number(r.saleable),
        lowStockThreshold: Number(r.lowStockThreshold),
        isLow: Boolean(r.isLow),
      })),
      nextCursor: hasMore ? items[items.length - 1].variantId : null,
    };
  }

  async recordMovement(
    input: CreateStockMovementRequest,
    actorUserId?: string
  ): Promise<StockMovement> {
    const [movement] = await db
      .insert(stockMovements)
      .values({
        variantId: input.variantId,
        delta: input.delta,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
        byUserId: actorUserId ?? null,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'stock_adjust',
      resource: 'stock_movement',
      recordId: movement.id,
      after: movement,
    });

    // Check low stock status
    const [level] = await db
      .select()
      .from(stockLevels)
      .where(eq(stockLevels.variantId, input.variantId));

    if (level && level.onHand - level.reserved <= 3) {
      Events.publish('stock.low', { variantId: input.variantId });
      await Notifications.send({
        to: {},
        template: 'stock.low',
        data: { variantId: input.variantId, saleable: level.onHand - level.reserved },
      });
    }

    return {
      id: movement.id,
      variantId: movement.variantId,
      delta: movement.delta,
      reason: movement.reason as any,
      refType: movement.refType ?? undefined,
      refId: movement.refId ?? undefined,
      note: movement.note ?? undefined,
      byUserId: movement.byUserId ?? undefined,
      createdAt: movement.createdAt.toISOString(),
    };
  }
}

export const Inventory = new InventoryService();
