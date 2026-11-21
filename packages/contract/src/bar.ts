// Owner: Dev B. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  dateOnSchema,
  timestampAtSchema,
} from './common.js';

// Enums
export const menuCategorySchema = z.enum(['food', 'drink']);
export type MenuCategory = z.infer<typeof menuCategorySchema>;

export const menuStationSchema = z.enum(['kitchen', 'bar']);
export type MenuStation = z.infer<typeof menuStationSchema>;

export const tabStatusSchema = z.enum(['open', 'settled', 'void']);
export type TabStatus = z.infer<typeof tabStatusSchema>;

export const tabItemStatusSchema = z.enum(['pending', 'preparing', 'ready', 'served', 'void']);
export type TabItemStatus = z.infer<typeof tabItemStatusSchema>;

export const barPaymentMethodSchema = z.enum(['cash', 'card', 'upi']);
export type BarPaymentMethod = z.infer<typeof barPaymentMethodSchema>;

// Models
export const menuItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  category: menuCategorySchema,
  station: menuStationSchema,
  pricePaise: paiseSchema,
  taxCategory: z.string(),
  active: z.boolean(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const barTableSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  seats: z.number().int().positive(),
  x: z.number().int(),
  y: z.number().int(),
  activeTabId: uuidSchema.nullable().optional(),
  occupiedMinutes: z.number().int().optional(),
  isOccupiedTooLong: z.boolean().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type BarTable = z.infer<typeof barTableSchema>;

export const tillSessionSchema = z.object({
  id: uuidSchema,
  openedBy: uuidSchema,
  openedAt: timestampAtSchema,
  openingFloatPaise: paiseSchema,
  closedAt: timestampAtSchema.nullable().optional(),
  countedCashPaise: paiseSchema.nullable().optional(),
  expectedCashPaise: paiseSchema.nullable().optional(),
  variancePaise: paiseSchema.nullable().optional(),
});
export type TillSession = z.infer<typeof tillSessionSchema>;

export const tabItemSchema = z.object({
  id: uuidSchema,
  tabId: uuidSchema,
  menuItemId: uuidSchema,
  menuItemName: z.string().optional(),
  station: menuStationSchema.optional(),
  qty: z.number().int().positive(),
  unitPricePaise: paiseSchema,
  priceBreakdown: z.record(z.unknown()).optional(),
  status: tabItemStatusSchema,
  voidReason: z.string().nullable().optional(),
  addedBy: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type TabItem = z.infer<typeof tabItemSchema>;

export const tabSchema = z.object({
  id: uuidSchema,
  tableId: uuidSchema.nullable().optional(),
  tableLabel: z.string().optional(),
  memberId: uuidSchema.nullable().optional(),
  guestLabel: z.string().nullable().optional(),
  status: tabStatusSchema,
  openedBy: uuidSchema,
  tillSessionId: uuidSchema.nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  items: z.array(tabItemSchema).optional(),
  subtotalPaise: paiseSchema.optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Tab = z.infer<typeof tabSchema>;

export const kdsItemSchema = tabItemSchema.extend({
  tableLabel: z.string().nullable().optional(),
  guestLabel: z.string().nullable().optional(),
  orderTime: timestampAtSchema,
});
export type KdsItem = z.infer<typeof kdsItemSchema>;

export const zReportSchema = z.object({
  date: dateOnSchema,
  tillSessionId: uuidSchema.nullable().optional(),
  salesByTender: z.array(z.object({
    method: z.string(),
    amountPaise: paiseSchema,
  })),
  salesByCategory: z.array(z.object({
    category: z.string(),
    amountPaise: paiseSchema,
  })),
  salesByWaiter: z.array(z.object({
    userId: uuidSchema,
    name: z.string(),
    amountPaise: paiseSchema,
  })),
  totalSalesPaise: paiseSchema,
  voidsCount: z.number().int().min(0),
  voidsPaise: paiseSchema,
  discountsPaise: paiseSchema,
  taxPaise: paiseSchema,
});
export type ZReport = z.infer<typeof zReportSchema>;

// Endpoint Schemas

// 1. GET /admin/menu
export const getMenuQuerySchema = z.object({
  category: menuCategorySchema.optional(),
  station: menuStationSchema.optional(),
  active: z.coerce.boolean().optional(),
});
export const getMenuResponseSchema = z.array(menuItemSchema);

// 2. PUT or POST /admin/menu
export const createMenuItemRequestSchema = z.object({
  name: z.string().min(1),
  category: menuCategorySchema,
  station: menuStationSchema,
  pricePaise: paiseSchema,
  taxCategory: z.string(),
  active: z.boolean().default(true).optional(),
});
export const createMenuItemResponseSchema = menuItemSchema;

export const updateMenuItemParamsSchema = z.object({ id: uuidSchema });
export const updateMenuItemRequestSchema = createMenuItemRequestSchema.partial();
export const updateMenuItemResponseSchema = menuItemSchema;

// 3. GET /admin/tables
export const getTablesResponseSchema = z.array(barTableSchema);

// 4. PUT or POST /admin/tables
export const createTableRequestSchema = z.object({
  label: z.string().min(1),
  seats: z.number().int().positive(),
  x: z.number().int(),
  y: z.number().int(),
});
export const createTableResponseSchema = barTableSchema;

export const updateTableParamsSchema = z.object({ id: uuidSchema });
export const updateTableRequestSchema = createTableRequestSchema.partial();
export const updateTableResponseSchema = barTableSchema;

// 5. POST /till/open
export const openTillRequestSchema = z.object({
  openingFloatPaise: paiseSchema,
});
export const openTillResponseSchema = tillSessionSchema;

// 6. POST /till/close
export const closeTillRequestSchema = z.object({
  tillSessionId: uuidSchema,
  countedCashPaise: paiseSchema,
});
export const closeTillResponseSchema = tillSessionSchema;

// 7. POST /tabs
export const createTabRequestSchema = z.object({
  tableId: uuidSchema.optional(),
  memberId: uuidSchema.optional(),
  guestLabel: z.string().optional(),
  tillSessionId: uuidSchema.optional(),
});
export const createTabResponseSchema = tabSchema;

// 8. POST /tabs/:id/items
export const addTabItemParamsSchema = z.object({ id: uuidSchema });
export const addTabItemRequestSchema = z.object({
  menuItemId: uuidSchema,
  qty: z.number().int().positive().default(1),
});
export const addTabItemResponseSchema = tabItemSchema;

// 9. POST /tab-items/:id/status
export const updateTabItemStatusParamsSchema = z.object({ id: uuidSchema });
export const updateTabItemStatusRequestSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'served']),
});
export const updateTabItemStatusResponseSchema = tabItemSchema;

// 10. POST /tab-items/:id/void
export const voidTabItemParamsSchema = z.object({ id: uuidSchema });
export const voidTabItemRequestSchema = z.object({
  voidReason: z.string().min(1),
});
export const voidTabItemResponseSchema = tabItemSchema;

// 11. POST /tabs/:id/settle
export const settleTabParamsSchema = z.object({ id: uuidSchema });
export const settleTabRequestSchema = z.object({
  payments: z.array(z.object({
    method: barPaymentMethodSchema,
    amountPaise: paiseSchema,
  })).min(1),
});
export const settleTabResponseSchema = z.object({
  tabId: uuidSchema,
  invoiceId: uuidSchema,
  status: z.literal('settled'),
  totalPaise: paiseSchema,
  payments: z.array(z.object({
    paymentId: uuidSchema,
    amountPaise: paiseSchema,
  })),
});

// 12. POST /tabs/:id/transfer (P1)
export const transferTabParamsSchema = z.object({ id: uuidSchema });
export const transferTabRequestSchema = z.object({
  targetTableId: uuidSchema.optional(),
  targetMemberId: uuidSchema.optional(),
});
export const transferTabResponseSchema = tabSchema;

// 13. POST /tabs/:id/merge (P1)
export const mergeTabParamsSchema = z.object({ id: uuidSchema });
export const mergeTabRequestSchema = z.object({
  targetTabId: uuidSchema,
});
export const mergeTabResponseSchema = tabSchema;

// 14. GET /kds?station=
export const getKdsQuerySchema = z.object({
  station: menuStationSchema,
});
export const getKdsResponseSchema = z.array(kdsItemSchema);

// 15. GET /reports/z?date=
export const getZReportQuerySchema = z.object({
  date: dateOnSchema,
});
export const getZReportResponseSchema = zReportSchema;
