// Owner: Dev B. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
  timestampAtSchema,
} from './common.js';

// Enums
export const productCategorySchema = z.enum(['racket', 'ball', 'shoe', 'accessory', 'apparel']);
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const stockMovementReasonSchema = z.enum([
  'purchase',
  'sale',
  'return',
  'adjustment',
  'reservation_release',
]);
export type StockMovementReason = z.infer<typeof stockMovementReasonSchema>;

export const orderChannelSchema = z.enum(['counter', 'online']);
export type OrderChannel = z.infer<typeof orderChannelSchema>;

export const orderFulfilmentSchema = z.enum(['counter', 'pickup', 'delivery']);
export type OrderFulfilment = z.infer<typeof orderFulfilmentSchema>;

export const orderStatusSchema = z.enum([
  'placed',
  'ready',
  'out_for_delivery',
  'collected',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const stockReservationStatusSchema = z.enum(['active', 'released', 'converted']);
export type StockReservationStatus = z.infer<typeof stockReservationStatusSchema>;

// Models
export const productVariantSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  sku: z.string(),
  optionLabel: z.string(),
  pricePaise: paiseSchema.nullable(),
  lowStockThreshold: z.number().int().min(0),
  active: z.boolean(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  category: productCategorySchema,
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  basePricePaise: paiseSchema,
  taxCategory: z.string(),
  active: z.boolean(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Product = z.infer<typeof productSchema>;

export const productWithVariantsSchema = productSchema.extend({
  variants: z.array(productVariantSchema),
});
export type ProductWithVariants = z.infer<typeof productWithVariantsSchema>;

// Public Product Models (inStock boolean only, no stock counts)
export const publicProductVariantSchema = z.object({
  id: uuidSchema,
  sku: z.string(),
  optionLabel: z.string(),
  pricePaise: paiseSchema.nullable(),
  inStock: z.boolean(),
});
export type PublicProductVariant = z.infer<typeof publicProductVariantSchema>;

export const publicProductSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  category: productCategorySchema,
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  basePricePaise: paiseSchema,
  taxCategory: z.string(),
  inStock: z.boolean(),
  variants: z.array(publicProductVariantSchema).optional(),
});
export type PublicProduct = z.infer<typeof publicProductSchema>;

// Stock View Model (v_stock: saleable = on_hand - reserved)
export const stockLevelSchema = z.object({
  variantId: uuidSchema,
  sku: z.string(),
  optionLabel: z.string(),
  productId: uuidSchema,
  productName: z.string(),
  category: productCategorySchema,
  onHand: z.number().int().min(0),
  reserved: z.number().int().min(0),
  saleable: z.number().int(),
  lowStockThreshold: z.number().int().min(0),
  isLow: z.boolean(),
});
export type StockLevel = z.infer<typeof stockLevelSchema>;

// Stock Movement Model (Ledger)
export const stockMovementSchema = z.object({
  id: uuidSchema,
  variantId: uuidSchema,
  delta: z.number().int(),
  reason: stockMovementReasonSchema,
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  byUserId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema,
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

// Order Item Model
export const orderItemSchema = z.object({
  id: uuidSchema,
  orderId: uuidSchema,
  variantId: uuidSchema,
  qty: z.number().int().positive(),
  unitPricePaise: paiseSchema,
  priceBreakdown: z.record(z.unknown()).optional(),
  productName: z.string().optional(),
  optionLabel: z.string().optional(),
  sku: z.string().optional(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

// Order Model
export const orderSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema.nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  channel: orderChannelSchema,
  status: orderStatusSchema,
  fulfilment: orderFulfilmentSchema,
  deliveryAddress: z.string().nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  createdBy: uuidSchema.nullable().optional(),
  items: z.array(orderItemSchema).optional(),
  createdAt: timestampAtSchema,
  updatedAt: timestampAtSchema.optional(),
});
export type Order = z.infer<typeof orderSchema>;

// Endpoint Request & Response Schemas

// 1. GET /public/products
export const getPublicProductsQuerySchema = paginationQuerySchema.extend({
  category: productCategorySchema.optional(),
});
export const getPublicProductsResponseSchema = paginatedResponseSchema(publicProductSchema);

// 2. GET /public/products/:id
export const getPublicProductParamsSchema = z.object({ id: uuidSchema });
export const getPublicProductResponseSchema = publicProductSchema;

// 3. GET /products
export const getProductsQuerySchema = paginationQuerySchema.extend({
  category: productCategorySchema.optional(),
  active: z.coerce.boolean().optional(),
});
export const getProductsResponseSchema = paginatedResponseSchema(productWithVariantsSchema);

// 4. POST /products
export const createProductRequestSchema = z.object({
  name: z.string().min(1),
  category: productCategorySchema,
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  basePricePaise: paiseSchema,
  taxCategory: z.string(),
  active: z.boolean().default(true).optional(),
});
export const createProductResponseSchema = productSchema;

// 5. PATCH /products/:id
export const updateProductParamsSchema = z.object({ id: uuidSchema });
export const updateProductRequestSchema = createProductRequestSchema.partial();
export const updateProductResponseSchema = productSchema;

// 6. POST /variants
export const createVariantRequestSchema = z.object({
  productId: uuidSchema,
  sku: z.string().min(1),
  optionLabel: z.string().min(1),
  pricePaise: paiseSchema.nullable().optional(),
  lowStockThreshold: z.number().int().min(0).default(3).optional(),
  active: z.boolean().default(true).optional(),
});
export const createVariantResponseSchema = productVariantSchema;

// 7. PATCH /variants/:id
export const updateVariantParamsSchema = z.object({ id: uuidSchema });
export const updateVariantRequestSchema = createVariantRequestSchema.omit({ productId: true }).partial();
export const updateVariantResponseSchema = productVariantSchema;

// 8. GET /stock?lowOnly=
export const getStockQuerySchema = paginationQuerySchema.extend({
  lowOnly: z.coerce.boolean().optional(),
});
export const getStockResponseSchema = paginatedResponseSchema(stockLevelSchema);

// 9. POST /stock/movements
export const createStockMovementRequestSchema = z.object({
  variantId: uuidSchema,
  delta: z.number().int(),
  reason: stockMovementReasonSchema,
  refType: z.string().optional(),
  refId: z.string().optional(),
  note: z.string().optional(),
});
export const createStockMovementResponseSchema = stockMovementSchema;

// 10. POST /orders
export const createOrderRequestSchema = z.object({
  items: z.array(z.object({
    variantId: uuidSchema,
    qty: z.number().int().positive(),
  })).min(1),
  fulfilment: orderFulfilmentSchema,
  deliveryAddress: z.string().optional(),
  memberId: uuidSchema.optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  channel: orderChannelSchema.default('counter').optional(),
});
export const createOrderResponseSchema = orderSchema;

// 11. POST /orders/:id/status
export const updateOrderStatusParamsSchema = z.object({ id: uuidSchema });
export const updateOrderStatusRequestSchema = z.object({
  status: orderStatusSchema,
});
export const updateOrderStatusResponseSchema = orderSchema;

// 12. GET /orders
export const getOrdersQuerySchema = paginationQuerySchema.extend({
  status: orderStatusSchema.optional(),
  memberId: uuidSchema.optional(),
  channel: orderChannelSchema.optional(),
});
export const getOrdersResponseSchema = paginatedResponseSchema(orderSchema);

// 13. GET /orders/:id
export const getOrderParamsSchema = z.object({ id: uuidSchema });
export const getOrderResponseSchema = orderSchema;

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
export type CreateVariantRequest = z.infer<typeof createVariantRequestSchema>;
export type UpdateVariantRequest = z.infer<typeof updateVariantRequestSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusRequestSchema>;
export type CreateStockMovementRequest = z.infer<typeof createStockMovementRequestSchema>;
