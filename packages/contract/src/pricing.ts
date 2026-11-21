// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, paiseSchema, dateOnSchema, timestampAtSchema } from './common.js';

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
  scopeRef: z.string().nullable().optional(),
  tier: pricingTierSchema.nullable().optional(),
  channel: pricingChannelSchema.nullable().optional(),
  dayMask: z.number().int().nullable().optional(),
  timeFrom: z.string().nullable().optional(), // 'HH:mm'
  timeTo: z.string().nullable().optional(),   // 'HH:mm'
  effect: priceEffectSchema,
  value: z.number().int(), // paise or basis points
  priority: z.number().int().default(0),
  validFrom: dateOnSchema.nullable().optional(),
  validTo: dateOnSchema.nullable().optional(),
  active: z.boolean(),
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
