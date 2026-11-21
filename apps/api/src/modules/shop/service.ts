// Owner: Dev B – Shop Module Service (Section 7.6)
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  products,
  productVariants,
  stockLevels,
  stockMovements,
  stockReservations,
  orders,
  orderItems,
} from '../../db/schema/shop.js';
import {
  Product,
  ProductWithVariants,
  ProductVariant,
  PublicProduct,
  PublicProductVariant,
  Order,
  CreateProductRequest,
  CreateVariantRequest,
  CreateOrderRequest,
  OrderStatus,
  OrderChannel,
  OrderFulfilment,
  SessionUser,
} from '@club/contract';
import { Pricing } from '../pricing/index.js';
import { Invoices } from '../invoices/service.js';
import { Payments } from '../payments/service.js';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { Notifications } from '../../core/notifications.js';

export class ShopService {
  // 1. Public Catalogue (No stock counts, boolean inStock only, no PII)
  async getPublicProducts(query: { category?: string; limit?: number; cursor?: string }): Promise<{
    items: PublicProduct[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;

    const prods = await db
      .select()
      .from(products)
      .where(and(eq(products.active, true), query.category ? eq(products.category, query.category) : undefined))
      .limit(limit + 1);

    const hasMore = prods.length > limit;
    const list = hasMore ? prods.slice(0, limit) : prods;

    if (list.length === 0) {
      return { items: [], nextCursor: null };
    }

    const prodIds = list.map((p) => p.id);
    const variants = await db
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, prodIds), eq(productVariants.active, true)));

    // Query v_stock view to determine inStock without exposing counts
    const stockRows = await db.execute(sql`
      SELECT variant_id, (saleable > 0) AS has_stock FROM v_stock
    `);
    const inStockMap = new Map<string, boolean>();
    for (const r of (stockRows.rows as any[]) || []) {
      inStockMap.set(r.variant_id, Boolean(r.has_stock));
    }

    const items: PublicProduct[] = list.map((p) => {
      const pVariants = variants.filter((v) => v.productId === p.id);
      const publicVariants: PublicProductVariant[] = pVariants.map((v) => ({
        id: v.id,
        sku: v.sku,
        optionLabel: v.optionLabel,
        pricePaise: v.pricePaise,
        inStock: inStockMap.get(v.id) ?? false,
      }));

      const hasAnyStock = publicVariants.some((v) => v.inStock);

      return {
        id: p.id,
        name: p.name,
        category: p.category as any,
        description: p.description ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        basePricePaise: p.basePricePaise,
        taxCategory: p.taxCategory,
        inStock: hasAnyStock,
        variants: publicVariants,
      };
    });

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getPublicProduct(id: string): Promise<PublicProduct> {
    const [p] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.active, true)))
      .limit(1);

    if (!p) {
      throw new AppError('NOT_FOUND', 'Product not found', 404);
    }

    const variants = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, id), eq(productVariants.active, true)));

    const stockRows = await db.execute(sql`
      SELECT variant_id, (saleable > 0) AS has_stock FROM v_stock
    `);
    const inStockMap = new Map<string, boolean>();
    for (const r of (stockRows.rows as any[]) || []) {
      inStockMap.set(r.variant_id, Boolean(r.has_stock));
    }

    const publicVariants: PublicProductVariant[] = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionLabel: v.optionLabel,
      pricePaise: v.pricePaise,
      inStock: inStockMap.get(v.id) ?? false,
    }));

    return {
      id: p.id,
      name: p.name,
      category: p.category as any,
      description: p.description ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
      basePricePaise: p.basePricePaise,
      taxCategory: p.taxCategory,
      inStock: publicVariants.some((v) => v.inStock),
      variants: publicVariants,
    };
  }

  // 2. Staff Product Management
  async getProducts(query: { category?: string; active?: boolean; limit?: number; cursor?: string }): Promise<{
    items: ProductWithVariants[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;
    const conds: any[] = [];
    if (query.category) conds.push(eq(products.category, query.category));
    if (query.active !== undefined) conds.push(eq(products.active, query.active));

    const prods = await db
      .select()
      .from(products)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(products.name)
      .limit(limit + 1);

    const hasMore = prods.length > limit;
    const list = hasMore ? prods.slice(0, limit) : prods;

    if (list.length === 0) return { items: [], nextCursor: null };

    const prodIds = list.map((p) => p.id);
    const variants = await db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, prodIds));

    const items: ProductWithVariants[] = list.map((p) => {
      const pVariants: ProductVariant[] = variants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          optionLabel: v.optionLabel,
          pricePaise: v.pricePaise,
          lowStockThreshold: v.lowStockThreshold,
          active: v.active,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        }));

      return {
        id: p.id,
        name: p.name,
        category: p.category as any,
        description: p.description ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        basePricePaise: p.basePricePaise,
        taxCategory: p.taxCategory,
        active: p.active,
        variants: pVariants,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async createProduct(input: CreateProductRequest, actorUserId?: string): Promise<Product> {
    const [p] = await db
      .insert(products)
      .values({
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        basePricePaise: input.basePricePaise,
        taxCategory: input.taxCategory,
        active: input.active ?? true,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'product',
      recordId: p.id,
      after: p,
    });

    return {
      id: p.id,
      name: p.name,
      category: p.category as any,
      description: p.description ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
      basePricePaise: p.basePricePaise,
      taxCategory: p.taxCategory,
      active: p.active,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async updateProduct(id: string, input: Partial<CreateProductRequest>, actorUserId?: string): Promise<Product> {
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Product not found', 404);

    const [updated] = await db
      .update(products)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'product',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      name: updated.name,
      category: updated.category as any,
      description: updated.description ?? undefined,
      imageUrl: updated.imageUrl ?? undefined,
      basePricePaise: updated.basePricePaise,
      taxCategory: updated.taxCategory,
      active: updated.active,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async createVariant(input: CreateVariantRequest, actorUserId?: string): Promise<ProductVariant> {
    const [v] = await db
      .insert(productVariants)
      .values({
        productId: input.productId,
        sku: input.sku,
        optionLabel: input.optionLabel,
        pricePaise: input.pricePaise ?? null,
        lowStockThreshold: input.lowStockThreshold ?? 3,
        active: input.active ?? true,
      })
      .returning();

    // Ensure stock_levels row exists
    await db
      .insert(stockLevels)
      .values({
        variantId: v.id,
        onHand: 0,
        reserved: 0,
      })
      .onConflictDoNothing();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'product_variant',
      recordId: v.id,
      after: v,
    });

    return {
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      optionLabel: v.optionLabel,
      pricePaise: v.pricePaise,
      lowStockThreshold: v.lowStockThreshold,
      active: v.active,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }

  async updateVariant(id: string, input: Partial<CreateVariantRequest>, actorUserId?: string): Promise<ProductVariant> {
    const [existing] = await db.select().from(productVariants).where(eq(productVariants.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Variant not found', 404);

    const [updated] = await db
      .update(productVariants)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'product_variant',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      optionLabel: updated.optionLabel,
      pricePaise: updated.pricePaise,
      lowStockThreshold: updated.lowStockThreshold,
      active: updated.active,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // 3. Orders & Fulfilment (Section 7.6 Order Algorithm in ONE transaction)
  async createOrder(input: CreateOrderRequest, actorUser?: SessionUser): Promise<Order> {
    const channel: OrderChannel = input.channel ?? 'counter';
    const fulfilment: OrderFulfilment = input.fulfilment ?? 'counter';
    const now = new Date();

    // 1. Fetch products, variants, and pricing quotes BEFORE opening the transaction.
    // This prevents connection pool exhaustion/deadlock under concurrent load.
    const preppedItems = await Promise.all(
      input.items.map(async (item) => {
        const [variant] = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .limit(1);

        if (!variant) throw new AppError('NOT_FOUND', `Product variant not found: ${item.variantId}`, 404);

        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, variant.productId))
          .limit(1);

        if (!product) throw new AppError('NOT_FOUND', `Product not found for variant: ${item.variantId}`, 404);

        const basePrice = variant.pricePaise ?? product.basePricePaise;

        const quote = await Pricing.quote({
          kind: 'shop',
          scopeRef: product.category,
          basePricePaise: basePrice,
          qty: item.qty,
          memberId: input.memberId,
          channel,
          at: now,
        });

        const discountPerUnit = Math.max(0, basePrice - quote.unitPaise);

        return {
          item,
          variant,
          product,
          basePrice,
          quote,
          discountPerUnit,
        };
      })
    );

    const lowStockAlerts: string[] = [];

    // Sort items by variantId to enforce consistent lock ordering across concurrent orders
    const sortedPrepped = [...preppedItems].sort((a, b) =>
      a.item.variantId.localeCompare(b.item.variantId)
    );

    let orderResult: { order: any; inv: { invoiceId: string; totalPaise: number; number: string }; items: any[] };
    try {
      orderResult = await db.transaction(async (tx) => {
        const orderId = randomUUID();

        const lineItemsToInsert: any[] = [];
        const invoiceLinesToCreate: any[] = [];

        for (const prep of sortedPrepped) {
          const { item, variant, product, basePrice, quote, discountPerUnit } = prep;

          // Lock stock_levels row FOR UPDATE in sorted order
          // The trigger trg_stock_movement_apply enforces on_hand >= 0 via the DB CHECK.
          const [stock] = await tx
            .select()
            .from(stockLevels)
            .where(eq(stockLevels.variantId, item.variantId))
            .for('update');

          const onHand = stock?.onHand ?? 0;
          const reserved = stock?.reserved ?? 0;
          const saleable = onHand - reserved;

          if (saleable < item.qty) {
            throw new AppError(
              'OUT_OF_STOCK',
              `Insufficient stock for item variant ${item.variantId}. Available: ${saleable}, Requested: ${item.qty}`,
              409
            );
          }

          lineItemsToInsert.push({
            id: randomUUID(),
            orderId,
            variantId: item.variantId,
            qty: item.qty,
            unitPricePaise: quote.unitPaise,
            priceBreakdown: { breakdown: quote.breakdown, tier: quote.tier },
          });

          invoiceLinesToCreate.push({
            source: 'shop' as const,
            description: `${product.name} - ${variant.optionLabel} (${variant.sku})`,
            qty: item.qty,
            unitPricePaise: basePrice,
            discountPaise: discountPerUnit * item.qty,
            taxCategory: product.taxCategory,
            refType: 'order',
            refId: orderId,
          });

          // Insert into stock_movements; the trigger decrements stock_levels.on_hand.
          // The DB CHECK (on_hand >= 0) is the final safety net for any race.
          if (channel === 'counter') {
            await tx.insert(stockMovements).values({
              variantId: item.variantId,
              delta: -item.qty,
              reason: 'sale',
              refType: 'order',
              refId: orderId,
              byUserId: actorUser?.id ?? null,
            });
          } else {
            await tx.insert(stockReservations).values({
              variantId: item.variantId,
              qty: item.qty,
              orderId,
              expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
              status: 'active',
            });
          }

          const remainingSaleable = saleable - item.qty;
          if (remainingSaleable <= variant.lowStockThreshold) {
            lowStockAlerts.push(variant.id);
          }
        }

      // Create invoice
      const inv = await Invoices.create(
        {
          customer: {
            memberId: input.memberId,
            guestName: input.guestName,
          },
          lines: invoiceLinesToCreate,
        },
        tx
      );

      // Insert order
      const initialStatus: OrderStatus = channel === 'counter' ? 'collected' : 'placed';

      const [newOrder] = await tx
        .insert(orders)
        .values({
          id: orderId,
          memberId: input.memberId ?? null,
          guestName: input.guestName ?? null,
          guestPhone: input.guestPhone ?? null,
          channel,
          status: initialStatus,
          fulfilment,
          deliveryAddress: input.deliveryAddress ?? null,
          invoiceId: inv.invoiceId,
          createdBy: actorUser?.id ?? null,
        })
        .returning();

      await tx.insert(orderItems).values(lineItemsToInsert);

      // Return inv so counter-sale payment and audit can be recorded AFTER this tx commits
      return {
        order: newOrder,
        inv,
        items: lineItemsToInsert,
      };
    });
    } catch (err: any) {
      // Map Postgres CHECK constraint violation (23514) on stock_levels to a friendly error.
      // This catches any race where the DB-level check fires before the app-level check.
      if (err.code === '23514' || err.constraint === 'check_on_hand_non_negative' || err.message?.includes('check_on_hand')) {
        throw new AppError('OUT_OF_STOCK', 'Insufficient stock — concurrent order depleted stock.', 409);
      }
      throw err;
    }

    // Post-commit audit log (outside tx to avoid pool deadlock under high concurrency)
    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'create',
      resource: 'order',
      recordId: orderResult.order.id,
      after: orderResult.order,
    });

    // Counter-sale auto-payment is recorded AFTER the stock/order transaction commits,
    // keeping the stock-lock window short under concurrent load (DECISION 2026-11-21).
    if (channel === 'counter' && orderResult!.inv.totalPaise > 0) {
      await Payments.record(
        {
          invoiceId: orderResult!.inv.invoiceId,
          method: 'cash',
          amountPaise: orderResult!.inv.totalPaise,
          reference: 'Counter Sale',
        },
        undefined,
        actorUser?.id
      );
    }

    // Post-commit: Realtime events & Notifications
    Events.publish('order.status', { orderId: orderResult.order.id, status: orderResult.order.status });

    for (const vId of lowStockAlerts) {
      Events.publish('stock.low', { variantId: vId });
      await Notifications.send({
        to: {},
        template: 'stock.low',
        data: { variantId: vId },
      });
    }

    return {
      id: orderResult.order.id,
      memberId: orderResult.order.memberId ?? undefined,
      guestName: orderResult.order.guestName ?? undefined,
      guestPhone: orderResult.order.guestPhone ?? undefined,
      channel: orderResult.order.channel as OrderChannel,
      status: orderResult.order.status as OrderStatus,
      fulfilment: orderResult.order.fulfilment as OrderFulfilment,
      deliveryAddress: orderResult.order.deliveryAddress ?? undefined,
      invoiceId: orderResult.order.invoiceId ?? undefined,
      createdBy: orderResult.order.createdBy ?? undefined,
      items: orderResult.items.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        variantId: i.variantId,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        priceBreakdown: i.priceBreakdown,
      })),
      createdAt: orderResult.order.createdAt.toISOString(),
      updatedAt: orderResult.order.updatedAt.toISOString(),
    };
  }

  // 4. State Machine (Section 7.6)
  async updateOrderStatus(id: string, newStatus: OrderStatus, actorUser?: SessionUser): Promise<Order> {
    const [ord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!ord) throw new AppError('NOT_FOUND', 'Order not found', 404);

    const currentStatus = ord.status as OrderStatus;
    const fulfilment = ord.fulfilment as OrderFulfilment;

    // Validate state machine transitions
    let allowed = false;
    if (newStatus === 'cancelled') {
      if (currentStatus === 'placed' || currentStatus === 'ready') allowed = true;
    } else if (fulfilment === 'counter') {
      if (currentStatus === 'placed' && newStatus === 'collected') allowed = true;
    } else if (fulfilment === 'pickup') {
      if (currentStatus === 'placed' && newStatus === 'ready') allowed = true;
      if (currentStatus === 'ready' && newStatus === 'collected') allowed = true;
    } else if (fulfilment === 'delivery') {
      if (currentStatus === 'placed' && newStatus === 'out_for_delivery') allowed = true;
      if (currentStatus === 'out_for_delivery' && newStatus === 'delivered') allowed = true;
    }

    if (!allowed && currentStatus !== newStatus) {
      throw new AppError(
        'INVALID_STATE',
        `Invalid status transition from '${currentStatus}' to '${newStatus}' for fulfilment '${fulfilment}'`,
        409
      );
    }

    const lowStockAlerts: string[] = [];

    await db.transaction(async (tx) => {
      // If cancelled, release reservations or restock
      if (newStatus === 'cancelled' && currentStatus !== 'cancelled') {
        const oItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));

        if (ord.channel === 'online') {
          // Release reservation
          await tx
            .update(stockReservations)
            .set({ status: 'released' })
            .where(eq(stockReservations.orderId, id));
        } else {
          // Restock via adjustment
          for (const item of oItems) {
            await tx.insert(stockMovements).values({
              variantId: item.variantId,
              delta: item.qty,
              reason: 'return',
              refType: 'order',
              refId: id,
              note: 'Order cancelled restock',
              byUserId: actorUser?.id ?? null,
            });
          }
        }
      }

      // On collected or delivered, write sale movement for online orders
      if (
        (newStatus === 'collected' || newStatus === 'delivered') &&
        currentStatus !== 'collected' &&
        currentStatus !== 'delivered' &&
        ord.channel !== 'counter'
      ) {
        await tx
          .update(stockReservations)
          .set({ status: 'converted' })
          .where(and(eq(stockReservations.orderId, id), eq(stockReservations.status, 'active')));

        const oItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
        for (const item of oItems) {
          await tx.insert(stockMovements).values({
            variantId: item.variantId,
            delta: -item.qty,
            reason: 'sale',
            refType: 'order',
            refId: id,
            byUserId: actorUser?.id ?? null,
          });

          // Check if stock crosses low_stock_threshold
          const [vStock] = await tx
            .select()
            .from(stockLevels)
            .where(eq(stockLevels.variantId, item.variantId));
          const [variant] = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId));
          if (vStock && variant && (vStock.onHand - vStock.reserved) <= variant.lowStockThreshold) {
            lowStockAlerts.push(item.variantId);
          }
        }
      }

      await tx
        .update(orders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(orders.id, id));
    });

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'update_status',
      resource: 'order',
      recordId: id,
      before: { status: currentStatus },
      after: { status: newStatus },
    });

    Events.publish('order.status', { orderId: id, status: newStatus });

    for (const vId of lowStockAlerts) {
      Events.publish('stock.low', { variantId: vId });
      await Notifications.send({
        to: {},
        template: 'stock.low',
        data: { variantId: vId },
      });
    }

    if (newStatus === 'ready' && ord.memberId) {
      await Notifications.send({
        to: { memberId: ord.memberId },
        template: 'order.ready',
        data: { orderId: id },
      });
    }

    return this.getOrder(id);
  }

  async getOrder(id: string): Promise<Order> {
    const [ord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!ord) throw new AppError('NOT_FOUND', 'Order not found', 404);

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    return {
      id: ord.id,
      memberId: ord.memberId ?? undefined,
      guestName: ord.guestName ?? undefined,
      guestPhone: ord.guestPhone ?? undefined,
      channel: ord.channel as OrderChannel,
      status: ord.status as OrderStatus,
      fulfilment: ord.fulfilment as OrderFulfilment,
      deliveryAddress: ord.deliveryAddress ?? undefined,
      invoiceId: ord.invoiceId ?? undefined,
      createdBy: ord.createdBy ?? undefined,
      items: items.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        variantId: i.variantId,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        priceBreakdown: (i.priceBreakdown as any) ?? undefined,
      })),
      createdAt: ord.createdAt.toISOString(),
      updatedAt: ord.updatedAt.toISOString(),
    };
  }

  async listOrders(query: { status?: string; memberId?: string; channel?: string; limit?: number; cursor?: string }): Promise<{
    items: Order[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;
    const conds: any[] = [];
    if (query.status) conds.push(eq(orders.status, query.status));
    if (query.memberId) conds.push(eq(orders.memberId, query.memberId));
    if (query.channel) conds.push(eq(orders.channel, query.channel));

    const rows = await db
      .select()
      .from(orders)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const list = hasMore ? rows.slice(0, limit) : rows;

    const items: Order[] = await Promise.all(
      list.map(async (ord) => {
        const oItems = await db.select().from(orderItems).where(eq(orderItems.orderId, ord.id));
        return {
          id: ord.id,
          memberId: ord.memberId ?? undefined,
          guestName: ord.guestName ?? undefined,
          guestPhone: ord.guestPhone ?? undefined,
          channel: ord.channel as OrderChannel,
          status: ord.status as OrderStatus,
          fulfilment: ord.fulfilment as OrderFulfilment,
          deliveryAddress: ord.deliveryAddress ?? undefined,
          invoiceId: ord.invoiceId ?? undefined,
          createdBy: ord.createdBy ?? undefined,
          items: oItems.map((i) => ({
            id: i.id,
            orderId: i.orderId,
            variantId: i.variantId,
            qty: i.qty,
            unitPricePaise: i.unitPricePaise,
            priceBreakdown: (i.priceBreakdown as any) ?? undefined,
          })),
          createdAt: ord.createdAt.toISOString(),
          updatedAt: ord.updatedAt.toISOString(),
        };
      })
    );

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}

export const Shop = new ShopService();
