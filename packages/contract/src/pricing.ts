// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  dateOnSchema,
  timestampAtSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Section 5.4 Enums & Models
export const pricingKindSchema = z.enum(['court', 'shop', 'bar', 'membership', 'social']);
export type PricingKind = z.infer<typeof pricingKindSchema>;

export const pricingTierSchema = z.enum(['gold', 'silver', 'junior', 'walkin']);
export type PricingTier = z.infer<typeof pricingTierSchema>;

export const pricingChannelSchema = z.enum(['counter', 'phone', 'online', 'public']);
export type PricingChannel = z.infer<typeof pricingChannelSchema>;

export const priceEffectSchema = z.enum(['fixed_price', 'percent_off', 'amount_off']);
export type PriceEffect = z.infer<typeof priceEffectSchema>;

export const priceRuleSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  appliesTo: pricingKindSchema,
  scopeRef: z.string().nullable().optional(), // court_type code | product category | menu category | plan code
  tier: pricingTierSchema.nullable().optional(),
  channel: pricingChannelSchema.nullable().optional(),
  dayMask: z.number().int().nullable().optional(), // bit per weekday (0 = Sun .. 6 = Sat)
  timeFrom: z.string().nullable().optional(),     // 'HH:mm'
  timeTo: z.string().nullable().optional(),       // 'HH:mm'
  effect: priceEffectSchema,
  value: z.number().int(),                        // paise (for fixed_price, amount_off) or basis points (for percent_off)
  priority: z.number().int().default(0),
  validFrom: dateOnSchema.nullable().optional(),
  validTo: dateOnSchema.nullable().optional(),
  active: z.boolean().default(true),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type PriceRule = z.infer<typeof priceRuleSchema>;

export const quoteBreakdownItemSchema = z.object({
  ruleId: z.string(),
  label: z.string(),
  deltaPaise: paiseSchema,
});
export type QuoteBreakdownItem = z.infer<typeof quoteBreakdownItemSchema>;

export const quoteRequestSchema = z.object({
  kind: pricingKindSchema,
  scopeRef: z.string(),
  basePricePaise: paiseSchema,
  qty: z.number().int().positive().default(1),
  memberId: uuidSchema.optional(),
  channel: pricingChannelSchema.default('counter'),
  at: z.union([timestampAtSchema, z.date()]),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteResponseSchema = z.object({
  unitPaise: paiseSchema,
  totalPaise: paiseSchema,
  tier: pricingTierSchema,
  breakdown: z.array(quoteBreakdownItemSchema),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

// Section 6 PricingEngine Interface (Dev A exports)
export interface PricingEngine {
  quote(input: {
    kind: 'court' | 'shop' | 'bar' | 'membership' | 'social';
    scopeRef: string;
    basePricePaise: number;
    qty: number;
    memberId?: string;
    channel: 'counter' | 'phone' | 'online' | 'public';
    at: Date;
  }): Promise<{
    unitPaise: number;
    totalPaise: number;
    tier: 'gold' | 'silver' | 'junior' | 'walkin';
    breakdown: Array<{ ruleId: string; label: string; deltaPaise: number }>;
  }>;
}

// Endpoint Schemas (prefix /api)

// 1. POST /api/pricing/quote
// (Used by frontend UI for price preview)
export const postPricingQuoteRequestSchema = quoteRequestSchema;
export const postPricingQuoteResponseSchema = quoteResponseSchema;

// 2. GET /api/admin/price-rules
export const getPriceRulesQuerySchema = paginationQuerySchema.extend({
  appliesTo: pricingKindSchema.optional(),
  tier: pricingTierSchema.optional(),
  active: z.coerce.boolean().optional(),
});
export const getPriceRulesResponseSchema = paginatedResponseSchema(priceRuleSchema);

// 3. POST /api/admin/price-rules
export const createPriceRuleRequestSchema = z.object({
  name: z.string().min(1),
  appliesTo: pricingKindSchema,
  scopeRef: z.string().nullable().optional(),
  tier: pricingTierSchema.nullable().optional(),
  channel: pricingChannelSchema.nullable().optional(),
  dayMask: z.number().int().nullable().optional(),
  timeFrom: z.string().nullable().optional(),
  timeTo: z.string().nullable().optional(),
  effect: priceEffectSchema,
  value: z.number().int(),
  priority: z.number().int().default(0),
  validFrom: dateOnSchema.nullable().optional(),
  validTo: dateOnSchema.nullable().optional(),
  active: z.boolean().default(true),
});
export const createPriceRuleResponseSchema = priceRuleSchema;

// 4. PATCH /api/admin/price-rules/:id
export const updatePriceRuleParamsSchema = z.object({ id: uuidSchema });
export const updatePriceRuleRequestSchema = createPriceRuleRequestSchema.partial();
export const updatePriceRuleResponseSchema = priceRuleSchema;

// 5. DELETE /api/admin/price-rules/:id
export const deletePriceRuleParamsSchema = z.object({ id: uuidSchema });
export const deletePriceRuleResponseSchema = z.object({ success: z.boolean() });
