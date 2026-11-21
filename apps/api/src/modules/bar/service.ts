// Owner: Dev B – Bar Module Service (Section 7.7)
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  menuItems,
  barTables,
  tillSessions,
  tabs,
  tabItems,
  tabEvents,
} from '../../db/schema/bar.js';
import { payments, invoices } from '../../db/schema/invoices.js';
import {
  MenuItem,
  BarTable,
  TillSession,
  Tab,
  TabItem,
  KdsItem,
  ZReport,
  CreateMenuItemRequest,
  CreateBarTableRequest,
  OpenTillRequest,
  CloseTillRequest,
  CreateTabRequest,
  AddTabItemRequest,
  SettleTabRequest,
  SessionUser,
  MenuStation,
  MenuCategory,
  TabItemStatus,
  BarPaymentMethod,
} from '@club/contract';
import { Pricing } from '../pricing/index.js';
import { Invoices } from '../invoices/service.js';
import { Payments } from '../payments/service.js';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';

export class BarService {
  // 1. Menu Management
  async getMenu(query?: { category?: string; station?: string; active?: boolean }): Promise<MenuItem[]> {
    const conds: any[] = [];
    if (query?.category) conds.push(eq(menuItems.category, query.category));
    if (query?.station) conds.push(eq(menuItems.station, query.station));
    if (query?.active !== undefined) conds.push(eq(menuItems.active, query.active));

    const rows = await db
      .select()
      .from(menuItems)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(menuItems.category, menuItems.name);

    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category as MenuCategory,
      station: m.station as MenuStation,
      pricePaise: m.pricePaise,
      taxCategory: m.taxCategory,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  async createMenuItem(input: CreateMenuItemRequest, actorUserId?: string): Promise<MenuItem> {
    const [m] = await db
      .insert(menuItems)
      .values({
        name: input.name,
        category: input.category,
        station: input.station,
        pricePaise: input.pricePaise,
        taxCategory: input.taxCategory,
        active: input.active ?? true,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'menu_item',
      recordId: m.id,
      after: m,
    });

    return {
      id: m.id,
      name: m.name,
      category: m.category as MenuCategory,
      station: m.station as MenuStation,
      pricePaise: m.pricePaise,
      taxCategory: m.taxCategory,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  async updateMenuItem(id: string, input: Partial<CreateMenuItemRequest>, actorUserId?: string): Promise<MenuItem> {
    const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Menu item not found', 404);

    const [updated] = await db
      .update(menuItems)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'menu_item',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      name: updated.name,
      category: updated.category as MenuCategory,
      station: updated.station as MenuStation,
      pricePaise: updated.pricePaise,
      taxCategory: updated.taxCategory,
      active: updated.active,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // 2. Tables Management (Floor Plan)
  async getTables(): Promise<BarTable[]> {
    const tableRows = await db.select().from(barTables).orderBy(barTables.label);
    const openTabs = await db.select().from(tabs).where(eq(tabs.status, 'open'));

    const tabByTable = new Map<string, typeof tabs.$inferSelect>();
    for (const t of openTabs) {
      if (t.tableId) tabByTable.set(t.tableId, t);
    }

    const now = Date.now();
    return tableRows.map((t) => {
      const activeTab = tabByTable.get(t.id);
      let occupiedMinutes = 0;
      let isOccupiedTooLong = false;

      if (activeTab) {
        occupiedMinutes = Math.floor((now - activeTab.createdAt.getTime()) / (60 * 1000));
        if (occupiedMinutes >= 90) {
          isOccupiedTooLong = true;
        }
      }

      return {
        id: t.id,
        label: t.label,
        seats: t.seats,
        x: t.x,
        y: t.y,
        activeTabId: activeTab?.id ?? null,
        occupiedMinutes: activeTab ? occupiedMinutes : 0,
        isOccupiedTooLong,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });
  }

  async createTable(input: CreateBarTableRequest, actorUserId?: string): Promise<BarTable> {
    const [t] = await db
      .insert(barTables)
      .values({
        label: input.label,
        seats: input.seats,
        x: input.x,
        y: input.y,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'bar_table',
      recordId: t.id,
      after: t,
    });

    return {
      id: t.id,
      label: t.label,
      seats: t.seats,
      x: t.x,
      y: t.y,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  // 3. Till Sessions (Open/Close with expected cash and variance)
  async openTill(input: OpenTillRequest, actorUserId: string): Promise<TillSession> {
    const [sess] = await db
      .insert(tillSessions)
      .values({
        openedBy: actorUserId,
        openedAt: new Date(),
        openingFloatPaise: input.openingFloatPaise,
      })
      .returning();

    await Audit.log({
      actor: actorUserId,
      action: 'open_till',
      resource: 'till_session',
      recordId: sess.id,
      after: sess,
    });

    return {
      id: sess.id,
      openedBy: sess.openedBy,
      openedAt: sess.openedAt.toISOString(),
      openingFloatPaise: sess.openingFloatPaise,
    };
  }

  async closeTill(input: CloseTillRequest, actorUserId?: string): Promise<TillSession> {
    const [sess] = await db
      .select()
      .from(tillSessions)
      .where(eq(tillSessions.id, input.tillSessionId))
      .limit(1);

    if (!sess) throw new AppError('NOT_FOUND', 'Till session not found', 404);
    if (sess.closedAt) throw new AppError('INVALID_STATE', 'Till session is already closed', 409);

    // Sum cash payments collected during this till session
    const [cashPmt] = await db
      .select({
        totalCash: sql<number>`COALESCE(SUM(${payments.amountPaise}), 0)::int`,
      })
      .from(payments)
      .where(and(eq(payments.tillSessionId, input.tillSessionId), eq(payments.method, 'cash')));

    const totalCashCollected = Number(cashPmt?.totalCash ?? 0);
    const expectedCashPaise = sess.openingFloatPaise + totalCashCollected;
    const variancePaise = input.countedCashPaise - expectedCashPaise;
    const closedAt = new Date();

    const [closed] = await db
      .update(tillSessions)
      .set({
        closedAt,
        countedCashPaise: input.countedCashPaise,
        expectedCashPaise,
        variancePaise,
        updatedAt: new Date(),
      })
      .where(eq(tillSessions.id, input.tillSessionId))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'close_till',
      resource: 'till_session',
      recordId: closed.id,
      after: closed,
    });

    return {
      id: closed.id,
      openedBy: closed.openedBy,
      openedAt: closed.openedAt.toISOString(),
      openingFloatPaise: closed.openingFloatPaise,
      closedAt: closed.closedAt!.toISOString(),
      countedCashPaise: closed.countedCashPaise,
      expectedCashPaise: closed.expectedCashPaise,
      variancePaise: closed.variancePaise,
    };
  }

  // 4. Tabs Management
  async createTab(input: CreateTabRequest, actorUser: SessionUser): Promise<Tab> {
    const [tab] = await db
      .insert(tabs)
      .values({
        tableId: input.tableId ?? null,
        memberId: input.memberId ?? null,
        guestLabel: input.guestLabel ?? null,
        status: 'open',
        openedBy: actorUser.id,
        tillSessionId: input.tillSessionId ?? null,
      })
      .returning();

    await db.insert(tabEvents).values({
      tabId: tab.id,
      type: 'tab_opened',
      payload: { tableId: tab.tableId, memberId: tab.memberId, guestLabel: tab.guestLabel },
      byUserId: actorUser.id,
    });

    await Audit.log({
      actor: actorUser.id,
      action: 'create',
      resource: 'tab',
      recordId: tab.id,
      after: tab,
    });

    return this.getTab(tab.id);
  }

  async getTab(id: string): Promise<Tab> {
    const [tab] = await db.select().from(tabs).where(eq(tabs.id, id)).limit(1);
    if (!tab) throw new AppError('NOT_FOUND', 'Tab not found', 404);

    let tableLabel: string | undefined;
    if (tab.tableId) {
      const [table] = await db.select().from(barTables).where(eq(barTables.id, tab.tableId)).limit(1);
      tableLabel = table?.label;
    }

    const items = await db.select().from(tabItems).where(eq(tabItems.tabId, id)).orderBy(tabItems.createdAt);

    const nonVoidItems = items.filter((i) => i.status !== 'void');
    const subtotalPaise = nonVoidItems.reduce((sum, i) => sum + i.qty * i.unitPricePaise, 0);

    return {
      id: tab.id,
      tableId: tab.tableId ?? undefined,
      tableLabel,
      memberId: tab.memberId ?? undefined,
      guestLabel: tab.guestLabel ?? undefined,
      status: tab.status as any,
      openedBy: tab.openedBy,
      tillSessionId: tab.tillSessionId ?? undefined,
      invoiceId: tab.invoiceId ?? undefined,
      items: items.map((i) => ({
        id: i.id,
        tabId: i.tabId,
        menuItemId: i.menuItemId,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        priceBreakdown: (i.priceBreakdown as any) ?? undefined,
        status: i.status as TabItemStatus,
        voidReason: i.voidReason ?? undefined,
        addedBy: i.addedBy ?? undefined,
        createdAt: i.createdAt.toISOString(),
      })),
      subtotalPaise,
      createdAt: tab.createdAt.toISOString(),
      updatedAt: tab.updatedAt.toISOString(),
    };
  }

  async addItemToTab(tabId: string, input: AddTabItemRequest, actorUser?: SessionUser): Promise<TabItem> {
    const [tab] = await db.select().from(tabs).where(eq(tabs.id, tabId)).limit(1);
    if (!tab) throw new AppError('NOT_FOUND', 'Tab not found', 404);
    if (tab.status !== 'open') throw new AppError('INVALID_STATE', 'Cannot add items to a settled or void tab', 409);

    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, input.menuItemId)).limit(1);
    if (!item) throw new AppError('NOT_FOUND', 'Menu item not found', 404);

    // Calculate price with PricingEngine
    const quote = await Pricing.quote({
      kind: 'bar',
      scopeRef: item.category,
      basePricePaise: item.pricePaise,
      qty: input.qty ?? 1,
      memberId: tab.memberId ?? undefined,
      channel: 'counter',
      at: new Date(),
    });

    const [tabItem] = await db
      .insert(tabItems)
      .values({
        tabId,
        menuItemId: item.id,
        qty: input.qty ?? 1,
        unitPricePaise: quote.unitPaise,
        priceBreakdown: { breakdown: quote.breakdown, tier: quote.tier },
        status: 'pending',
        addedBy: actorUser?.id ?? null,
      })
      .returning();

    await db.insert(tabEvents).values({
      tabId,
      type: 'item_added',
      payload: { itemId: tabItem.id, menuItemId: item.id, qty: tabItem.qty, unitPricePaise: quote.unitPaise },
      byUserId: actorUser?.id ?? null,
    });

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'add_item',
      resource: 'tab_item',
      recordId: tabItem.id,
      after: tabItem,
    });

    // Publish realtime event to kitchen/bar screen
    Events.publish('order.item', {
      station: item.station,
      tabId,
      itemId: tabItem.id,
      name: item.name,
      qty: tabItem.qty,
    });

    return {
      id: tabItem.id,
      tabId: tabItem.tabId,
      menuItemId: tabItem.menuItemId,
      menuItemName: item.name,
      station: item.station as MenuStation,
      qty: tabItem.qty,
      unitPricePaise: tabItem.unitPricePaise,
      priceBreakdown: (tabItem.priceBreakdown as any) ?? undefined,
      status: tabItem.status as TabItemStatus,
      voidReason: tabItem.voidReason ?? undefined,
      addedBy: tabItem.addedBy ?? undefined,
      createdAt: tabItem.createdAt.toISOString(),
    };
  }

  async updateTabItemStatus(id: string, status: 'pending' | 'preparing' | 'ready' | 'served', actorUser?: SessionUser): Promise<TabItem> {
    const [existing] = await db.select().from(tabItems).where(eq(tabItems.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Tab item not found', 404);
    if (existing.status === 'void') throw new AppError('INVALID_STATE', 'Cannot change status of a void item', 409);

    const [updated] = await db
      .update(tabItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(tabItems.id, id))
      .returning();

    await db.insert(tabEvents).values({
      tabId: updated.tabId,
      type: 'status_changed',
      payload: { itemId: id, from: existing.status, to: status },
      byUserId: actorUser?.id ?? null,
    });

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'status_update',
      resource: 'tab_item',
      recordId: id,
      before: { status: existing.status },
      after: { status },
    });

    return {
      id: updated.id,
      tabId: updated.tabId,
      menuItemId: updated.menuItemId,
      qty: updated.qty,
      unitPricePaise: updated.unitPricePaise,
      priceBreakdown: (updated.priceBreakdown as any) ?? undefined,
      status: updated.status as TabItemStatus,
      voidReason: updated.voidReason ?? undefined,
      addedBy: updated.addedBy ?? undefined,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async voidTabItem(id: string, voidReason: string, actorUser?: SessionUser): Promise<TabItem> {
    const [existing] = await db.select().from(tabItems).where(eq(tabItems.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Tab item not found', 404);
    if (existing.status === 'void') throw new AppError('INVALID_STATE', 'Item is already voided', 409);

    const [voided] = await db
      .update(tabItems)
      .set({ status: 'void', voidReason, updatedAt: new Date() })
      .where(eq(tabItems.id, id))
      .returning();

    await db.insert(tabEvents).values({
      tabId: voided.tabId,
      type: 'void',
      payload: { itemId: id, voidReason },
      byUserId: actorUser?.id ?? null,
    });

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'void',
      resource: 'tab_item',
      recordId: id,
      after: { status: 'void', voidReason },
    });

    return {
      id: voided.id,
      tabId: voided.tabId,
      menuItemId: voided.menuItemId,
      qty: voided.qty,
      unitPricePaise: voided.unitPricePaise,
      priceBreakdown: (voided.priceBreakdown as any) ?? undefined,
      status: 'void',
      voidReason: voided.voidReason ?? undefined,
      addedBy: voided.addedBy ?? undefined,
      createdAt: voided.createdAt.toISOString(),
    };
  }

  // 5. Settle Tab with Split Payments (Section 7.7)
  async settleTab(tabId: string, input: SettleTabRequest, actorUser?: SessionUser): Promise<{
    tabId: string;
    invoiceId: string;
    status: 'settled';
    totalPaise: number;
    payments: Array<{ paymentId: string; amountPaise: number }>;
  }> {
    const result = await db.transaction(async (tx) => {
      const [tab] = await tx.select().from(tabs).where(eq(tabs.id, tabId)).for('update');
      if (!tab) throw new AppError('NOT_FOUND', 'Tab not found', 404);
      if (tab.status !== 'open') throw new AppError('INVALID_STATE', 'Tab is already settled or void', 409);

      const items = await tx.select().from(tabItems).where(eq(tabItems.tabId, tabId));
      const activeItems = items.filter((i) => i.status !== 'void');

      if (activeItems.length === 0) {
        throw new AppError('VALIDATION', 'Cannot settle a tab with no active items', 400);
      }

      // Fetch menu items for descriptions and tax categories
      const menuMap = new Map<string, typeof menuItems.$inferSelect>();
      const mRows = await tx.select().from(menuItems);
      for (const m of mRows) menuMap.set(m.id, m);

      const invoiceLinesToCreate = activeItems.map((i) => {
        const m = menuMap.get(i.menuItemId);
        const basePrice = m?.pricePaise ?? i.unitPricePaise;
        const discountPaise = Math.max(0, basePrice - i.unitPricePaise) * i.qty;

        return {
          source: 'bar' as const,
          description: m?.name ?? 'Bar Item',
          qty: i.qty,
          unitPricePaise: basePrice,
          discountPaise,
          taxCategory: m?.taxCategory ?? 'restaurant_5',
          refType: 'tab',
          refId: tabId,
        };
      });

      // Create invoice tagged 'bar'
      const inv = await Invoices.create(
        {
          customer: {
            memberId: tab.memberId ?? undefined,
            guestName: tab.guestLabel ?? undefined,
          },
          lines: invoiceLinesToCreate,
        },
        tx
      );

      // Record split payments
      const createdPayments: Array<{ paymentId: string; amountPaise: number }> = [];
      for (const p of input.payments) {
        const pmtRes = await Payments.record(
          {
            invoiceId: inv.invoiceId,
            method: p.method,
            amountPaise: p.amountPaise,
            tillSessionId: tab.tillSessionId ?? undefined,
            reference: `Tab Settlement (${p.method.toUpperCase()})`,
          },
          tx,
          actorUser?.id
        );
        createdPayments.push({ paymentId: pmtRes.paymentId, amountPaise: p.amountPaise });
      }

      // Mark tab settled
      await tx
        .update(tabs)
        .set({
          status: 'settled',
          invoiceId: inv.invoiceId,
          updatedAt: new Date(),
        })
        .where(eq(tabs.id, tabId));

      await tx.insert(tabEvents).values({
        tabId,
        type: 'settled',
        payload: { invoiceId: inv.invoiceId, totalPaise: inv.totalPaise, payments: createdPayments },
        byUserId: actorUser?.id ?? null,
      });

      return {
        tabId,
        invoiceId: inv.invoiceId,
        status: 'settled' as const,
        totalPaise: inv.totalPaise,
        payments: createdPayments,
      };
    });

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'settle',
      resource: 'tab',
      recordId: tabId,
      after: { status: 'settled', invoiceId: result.invoiceId, totalPaise: result.totalPaise },
    });

    return result;
  }

  // 6. Kitchen Display System (KDS)
  async getKds(station: MenuStation): Promise<KdsItem[]> {
    const res = await db.execute(sql`
      SELECT
        ti.id,
        ti.tab_id AS "tabId",
        ti.menu_item_id AS "menuItemId",
        mi.name AS "menuItemName",
        mi.station,
        ti.qty,
        ti.unit_price_paise AS "unitPricePaise",
        ti.price_breakdown AS "priceBreakdown",
        ti.status,
        ti.void_reason AS "voidReason",
        ti.added_by AS "addedBy",
        ti.created_at AS "createdAt",
        bt.label AS "tableLabel",
        t.guest_label AS "guestLabel",
        ti.created_at AS "orderTime"
      FROM tab_items ti
      JOIN menu_items mi ON ti.menu_item_id = mi.id
      JOIN tabs t ON ti.tab_id = t.id
      LEFT JOIN bar_tables bt ON t.table_id = bt.id
      WHERE mi.station = ${station}
        AND ti.status IN ('pending', 'preparing', 'ready')
        AND t.status = 'open'
      ORDER BY ti.created_at DESC
    `);

    const rows = (res.rows as any[]) || [];
    return rows.map((r) => ({
      id: r.id,
      tabId: r.tabId,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItemName,
      station: r.station as MenuStation,
      qty: Number(r.qty),
      unitPricePaise: Number(r.unitPricePaise),
      priceBreakdown: r.priceBreakdown ?? undefined,
      status: r.status as TabItemStatus,
      voidReason: r.voidReason ?? undefined,
      addedBy: r.addedBy ?? undefined,
      createdAt: new Date(r.createdAt).toISOString(),
      tableLabel: r.tableLabel ?? undefined,
      guestLabel: r.guestLabel ?? undefined,
      orderTime: new Date(r.orderTime).toISOString(),
    }));
  }

  // 7. Daily Z-Report (Section 7.7)
  async getZReport(dateStr: string): Promise<ZReport> {
    const fromDate = new Date(`${dateStr}T00:00:00+05:30`);
    const toDate = new Date(`${dateStr}T23:59:59.999+05:30`);

    // Sales by tender from payments linked to bar invoices
    const tenderRes = await db.execute(sql`
      SELECT
        p.method,
        COALESCE(SUM(p.amount_paise), 0)::int AS amount
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN invoice_lines il ON i.id = il.invoice_id
      WHERE il.source = 'bar'
        AND p.received_at >= ${fromDate}
        AND p.received_at <= ${toDate}
      GROUP BY p.method
    `);

    const salesByTender = ((tenderRes.rows as any[]) || []).map((r) => ({
      method: String(r.method),
      amountPaise: Number(r.amount),
    }));

    // Sales by category from bar invoice lines
    const catRes = await db.execute(sql`
      SELECT
        mi.category,
        COALESCE(SUM(il.total_paise), 0)::int AS amount
      FROM invoice_lines il
      JOIN menu_items mi ON il.description = mi.name
      JOIN invoices i ON il.invoice_id = i.id
      WHERE il.source = 'bar'
        AND i.issued_at >= ${fromDate}
        AND i.issued_at <= ${toDate}
      GROUP BY mi.category
    `);

    const salesByCategory = ((catRes.rows as any[]) || []).map((r) => ({
      category: String(r.category),
      amountPaise: Number(r.amount),
    }));

    // Sales by waiter
    const waiterRes = await db.execute(sql`
      SELECT
        t.opened_by AS "userId",
        u.name AS "userName",
        COALESCE(SUM(i.total_paise), 0)::int AS amount
      FROM tabs t
      JOIN invoices i ON t.invoice_id = i.id
      LEFT JOIN users u ON t.opened_by = u.id
      WHERE t.status = 'settled'
        AND i.issued_at >= ${fromDate}
        AND i.issued_at <= ${toDate}
      GROUP BY t.opened_by, u.name
    `);

    const salesByWaiter = ((waiterRes.rows as any[]) || []).map((r) => ({
      userId: r.userId,
      name: r.userName ?? 'Waiter',
      amountPaise: Number(r.amount),
    }));

    // Aggregates
    const aggRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(il.total_paise), 0)::int AS total_sales,
        COALESCE(SUM(il.discount_paise), 0)::int AS total_discounts,
        COALESCE(SUM(il.cgst_paise + il.sgst_paise), 0)::int AS total_tax
      FROM invoice_lines il
      JOIN invoices i ON il.invoice_id = i.id
      WHERE il.source = 'bar'
        AND i.issued_at >= ${fromDate}
        AND i.issued_at <= ${toDate}
    `);

    const agg = ((aggRes.rows as any[]) || [])[0] ?? {};

    // Voids count and amount
    const voidRes = await db.execute(sql`
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(qty * unit_price_paise), 0)::int AS amount
      FROM tab_items
      WHERE status = 'void'
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
    `);
    const voidRow = ((voidRes.rows as any[]) || [])[0] ?? {};

    return {
      date: dateStr,
      salesByTender,
      salesByCategory,
      salesByWaiter,
      totalSalesPaise: Number(agg.total_sales ?? 0),
      voidsCount: Number(voidRow.count ?? 0),
      voidsPaise: Number(voidRow.amount ?? 0),
      discountsPaise: Number(agg.total_discounts ?? 0),
      taxPaise: Number(agg.total_tax ?? 0),
    };
  }

  // 8. P1: Transfer & Merge Tabs
  async transferTab(id: string, input: { targetTableId?: string; targetMemberId?: string }, actorUser?: SessionUser): Promise<Tab> {
    const [tab] = await db.select().from(tabs).where(eq(tabs.id, id)).limit(1);
    if (!tab) throw new AppError('NOT_FOUND', 'Tab not found', 404);

    const [updated] = await db
      .update(tabs)
      .set({
        tableId: input.targetTableId ?? tab.tableId,
        memberId: input.targetMemberId ?? tab.memberId,
        updatedAt: new Date(),
      })
      .where(eq(tabs.id, id))
      .returning();

    await db.insert(tabEvents).values({
      tabId: id,
      type: 'transferred',
      payload: input,
      byUserId: actorUser?.id ?? null,
    });

    return this.getTab(id);
  }

  async mergeTab(id: string, targetTabId: string, actorUser?: SessionUser): Promise<Tab> {
    const [srcTab] = await db.select().from(tabs).where(eq(tabs.id, id)).limit(1);
    const [tgtTab] = await db.select().from(tabs).where(eq(tabs.id, targetTabId)).limit(1);

    if (!srcTab || !tgtTab) throw new AppError('NOT_FOUND', 'Tab not found', 404);

    // Reassign items from srcTab to targetTabId
    await db.update(tabItems).set({ tabId: targetTabId }).where(eq(tabItems.tabId, id));
    await db.update(tabs).set({ status: 'void' }).where(eq(tabs.id, id));

    await db.insert(tabEvents).values({
      tabId: id,
      type: 'merged',
      payload: { targetTabId },
      byUserId: actorUser?.id ?? null,
    });

    return this.getTab(targetTabId);
  }
}

export const Bar = new BarService();
