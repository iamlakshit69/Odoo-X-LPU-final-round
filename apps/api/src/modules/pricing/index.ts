// Owner: Dev A – Phase 5: Pricing module routes
import { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import {
  postPricingQuoteRequestSchema,
  postPricingQuoteResponseSchema,
  getPriceRulesQuerySchema,
  getPriceRulesResponseSchema,
  createPriceRuleRequestSchema,
  createPriceRuleResponseSchema,
  updatePriceRuleParamsSchema,
  updatePriceRuleRequestSchema,
  updatePriceRuleResponseSchema,
  deletePriceRuleParamsSchema,
  deletePriceRuleResponseSchema,
  PricingEngine,
} from '@club/contract';
import { z } from 'zod';
import { db } from '../../core/db/index.js';
import { priceRules } from '../../db/schema/pricing.js';
import { guard } from '../../core/rbac.js';
import { Audit } from '../../core/audit.js';
import { AppError } from '../../core/errors.js';
import { PricingEngineInstance, PricingEngineService } from './service.js';

export { PricingEngineInstance as Pricing, PricingEngineService };
export type { PricingEngine };

export async function register(app: FastifyInstance) {
  // POST /api/pricing/quote
  app.post('/pricing/quote', {
    preHandler: [guard('pricing:quote')],
    schema: {
      body: postPricingQuoteRequestSchema,
      response: { 200: postPricingQuoteResponseSchema },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof postPricingQuoteRequestSchema>;
    const result = await PricingEngineInstance.quote({
      kind: body.kind,
      scopeRef: body.scopeRef,
      basePricePaise: body.basePricePaise,
      qty: body.qty ?? 1,
      memberId: body.memberId,
      channel: body.channel ?? 'counter',
      at: body.at instanceof Date ? body.at : new Date(body.at as string),
    });
    return reply.send(result);
  });

  // GET /api/admin/price-rules
  app.get('/admin/price-rules', {
    preHandler: [guard('pricing:manage')],
    schema: {
      querystring: getPriceRulesQuerySchema,
    },
  }, async (request, reply) => {
    const q = request.query as z.infer<typeof getPriceRulesQuerySchema>;
    const limit = q.limit ?? 50;

    const conditions: ReturnType<typeof eq>[] = [];
    if (q.appliesTo) conditions.push(eq(priceRules.appliesTo, q.appliesTo));
    if (q.tier !== undefined) conditions.push(eq(priceRules.tier, q.tier));
    if (q.active !== undefined) conditions.push(eq(priceRules.active, q.active));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(priceRules).where(whereClause).orderBy(desc(priceRules.priority)).limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return reply.send({ items, nextCursor });
  });

  // POST /api/admin/price-rules
  app.post('/admin/price-rules', {
    preHandler: [guard('pricing:manage')],
    schema: {
      body: createPriceRuleRequestSchema,
      response: { 201: createPriceRuleResponseSchema },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof createPriceRuleRequestSchema>;
    const [rule] = await db.insert(priceRules).values({
      name: body.name,
      appliesTo: body.appliesTo,
      scopeRef: body.scopeRef ?? null,
      tier: body.tier ?? null,
      channel: body.channel ?? null,
      dayMask: body.dayMask ?? null,
      timeFrom: body.timeFrom ?? null,
      timeTo: body.timeTo ?? null,
      effect: body.effect,
      value: body.value,
      priority: body.priority ?? 0,
      validFrom: body.validFrom ?? null,
      validTo: body.validTo ?? null,
      active: body.active ?? true,
    }).returning();

    await Audit.log({
      actor: (request as any).user?.id ?? (request as any).session?.userId ?? 'system',
      action: 'price_rule.create',
      resource: 'price_rule',
      recordId: rule.id,
      after: rule,
    });

    return reply.status(201).send(rule);
  });

  // PATCH /api/admin/price-rules/:id
  app.patch('/admin/price-rules/:id', {
    preHandler: [guard('pricing:manage')],
    schema: {
      params: updatePriceRuleParamsSchema,
      body: updatePriceRuleRequestSchema,
      response: { 200: updatePriceRuleResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof updatePriceRuleParamsSchema>;
    const body = request.body as z.infer<typeof updatePriceRuleRequestSchema>;

    const [existing] = await db.select().from(priceRules).where(eq(priceRules.id, id));
    if (!existing) throw new AppError('NOT_FOUND', 'Price rule not found', 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.appliesTo !== undefined) updates.appliesTo = body.appliesTo;
    if ('scopeRef' in body) updates.scopeRef = body.scopeRef ?? null;
    if ('tier' in body) updates.tier = body.tier ?? null;
    if ('channel' in body) updates.channel = body.channel ?? null;
    if ('dayMask' in body) updates.dayMask = body.dayMask ?? null;
    if ('timeFrom' in body) updates.timeFrom = body.timeFrom ?? null;
    if ('timeTo' in body) updates.timeTo = body.timeTo ?? null;
    if (body.effect !== undefined) updates.effect = body.effect;
    if (body.value !== undefined) updates.value = body.value;
    if (body.priority !== undefined) updates.priority = body.priority;
    if ('validFrom' in body) updates.validFrom = body.validFrom ?? null;
    if ('validTo' in body) updates.validTo = body.validTo ?? null;
    if (body.active !== undefined) updates.active = body.active;

    const [rule] = await db.update(priceRules).set(updates as any).where(eq(priceRules.id, id)).returning();

    await Audit.log({
      actor: (request as any).user?.id ?? (request as any).session?.userId ?? 'system',
      action: 'price_rule.update',
      resource: 'price_rule',
      recordId: rule.id,
      before: existing,
      after: rule,
    });

    return reply.send(rule);
  });

  // DELETE /api/admin/price-rules/:id  (soft-delete: active = false)
  app.delete('/admin/price-rules/:id', {
    preHandler: [guard('pricing:manage')],
    schema: {
      params: deletePriceRuleParamsSchema,
      response: { 200: deletePriceRuleResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof deletePriceRuleParamsSchema>;
    const [existing] = await db.select().from(priceRules).where(eq(priceRules.id, id));
    if (!existing) throw new AppError('NOT_FOUND', 'Price rule not found', 404);

    await db.update(priceRules).set({ active: false, updatedAt: new Date() }).where(eq(priceRules.id, id));

    await Audit.log({
      actor: (request as any).user?.id ?? (request as any).session?.userId ?? 'system',
      action: 'price_rule.delete',
      resource: 'price_rule',
      recordId: id,
      before: existing,
    });

    return reply.send({ success: true });
  });
}
