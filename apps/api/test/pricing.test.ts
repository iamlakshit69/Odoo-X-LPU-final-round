// Owner: Dev A – Phase 5: T5 Pricing Engine tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDbConnected } from './helper.js';
import { db } from '../src/core/db/index.js';
import { priceRules } from '../src/db/schema/pricing.js';
import { eq } from 'drizzle-orm';
import { PricingEngineService } from '../src/modules/pricing/service.js';
import { Members } from '../src/modules/members/index.js';

// Fixed timestamps for deterministic time-of-day tests (club timezone = UTC)
//   Peak hour:   18:00 → within [17:00, 21:00)
//   Off-peak:    10:00 → outside [17:00, 21:00)
//   Morning:     09:00 → within [00:00, 17:00)
const PEAK_TIME    = new Date('2026-01-05T18:00:00.000Z'); // Monday 18:00
const OFFPEAK_TIME = new Date('2026-01-05T10:00:00.000Z'); // Monday 10:00
const MORNING_TIME = new Date('2026-01-05T09:00:00.000Z'); // Monday 09:00

const BASE_COURT = 150000; // ₹1,500 — matches tennis court type
const BASE_SHOP  = 100000; // ₹1,000 — arbitrary product base
const BASE_BAR   =  50000; // ₹500   — arbitrary bar item base

type Tier = 'gold' | 'silver' | 'junior' | 'walkin';

type RuleInput = {
  name: string;
  appliesTo: string;
  tier?: Tier | null;
  effect: 'fixed_price' | 'percent_off' | 'amount_off';
  value: number;
  priority?: number;
  timeFrom?: string | null;
  timeTo?: string | null;
  scopeRef?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
};

async function insertRule(r: RuleInput) {
  const [row] = await db.insert(priceRules).values({
    name: r.name,
    appliesTo: r.appliesTo,
    tier: r.tier ?? null,
    effect: r.effect,
    value: r.value,
    priority: r.priority ?? 10,
    timeFrom: r.timeFrom ?? null,
    timeTo: r.timeTo ?? null,
    scopeRef: r.scopeRef ?? null,
    validFrom: r.validFrom ?? null,
    validTo: r.validTo ?? null,
    active: true,
  }).returning();
  return row;
}

function mockPlan(planCode: Tier, status: 'active' | 'expired' | 'suspended' = 'active') {
  vi.spyOn(Members, 'getActivePlan').mockResolvedValue({
    planCode,
    status,
    dailyBookingLimit: 2,
  });
}

describe('PricingEngine – T5', () => {
  let engine: PricingEngineService;
  let dbAvail: boolean;

  beforeEach(async () => {
    dbAvail = await isDbConnected();
    engine = new PricingEngineService();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!dbAvail) return;
    await db.delete(priceRules);
  });

  // ─── Pure-logic tests (no DB needed) ──────────────────────────────────────

  it('returns base price when no rules match', async () => {
    // DB offline or empty → no rules
    mockPlan('gold');
    const result = await engine.quote({
      kind: 'shop',
      scopeRef: 'general',
      basePricePaise: 10000,
      qty: 1,
      memberId: 'fake-id',
      channel: 'counter',
      at: OFFPEAK_TIME,
    });
    expect(result.unitPaise).toBe(10000);
    expect(result.breakdown).toHaveLength(0);
    expect(result.tier).toBe('gold');
  });

  it('walkin tier when no memberId', async () => {
    const result = await engine.quote({
      kind: 'bar', scopeRef: 'general', basePricePaise: 5000, qty: 2, channel: 'counter', at: OFFPEAK_TIME,
    });
    expect(result.tier).toBe('walkin');
    expect(result.totalPaise).toBe(result.unitPaise * 2);
  });

  it('totalPaise = unitPaise × qty', async () => {
    const result = await engine.quote({
      kind: 'shop', scopeRef: 'general', basePricePaise: 10000, qty: 3, channel: 'counter', at: OFFPEAK_TIME,
    });
    expect(result.totalPaise).toBe(result.unitPaise * 3);
  });

  // ─── Court – Gold ──────────────────────────────────────────────────────────

  it('gold peak → fixed_price 0 paise', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Gold Free', appliesTo: 'court', tier: 'gold', effect: 'fixed_price', value: 0, priority: 100 });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: PEAK_TIME });
    expect(r.unitPaise).toBe(0);
    expect(r.tier).toBe('gold');
    expect(r.breakdown[0].deltaPaise).toBe(-BASE_COURT);
  });

  it('gold off-peak → fixed_price 0 paise', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Gold Free', appliesTo: 'court', tier: 'gold', effect: 'fixed_price', value: 0, priority: 100 });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(0);
  });

  // ─── Court – Silver ────────────────────────────────────────────────────────

  it('silver peak (18:00) → 40% off', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Silver Peak', appliesTo: 'court', tier: 'silver', effect: 'percent_off', value: 4000, priority: 50, timeFrom: '17:00', timeTo: '21:00' });
    await insertRule({ name: 'Silver Off-Peak', appliesTo: 'court', tier: 'silver', effect: 'percent_off', value: 6000, priority: 40 });
    mockPlan('silver');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: PEAK_TIME });
    const expected = BASE_COURT - Math.round(BASE_COURT * 4000 / 10000);
    expect(r.unitPaise).toBe(expected);
    expect(r.tier).toBe('silver');
  });

  it('silver off-peak (10:00) → 60% off', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Silver Peak', appliesTo: 'court', tier: 'silver', effect: 'percent_off', value: 4000, priority: 50, timeFrom: '17:00', timeTo: '21:00' });
    await insertRule({ name: 'Silver Off-Peak', appliesTo: 'court', tier: 'silver', effect: 'percent_off', value: 6000, priority: 40 });
    mockPlan('silver');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    const expected = BASE_COURT - Math.round(BASE_COURT * 6000 / 10000);
    expect(r.unitPaise).toBe(expected);
  });

  // ─── Court – Junior ────────────────────────────────────────────────────────

  it('junior morning (09:00, before 17:00) → 70% off', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Junior Morning', appliesTo: 'court', tier: 'junior', effect: 'percent_off', value: 7000, priority: 50, timeTo: '17:00' });
    mockPlan('junior');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: MORNING_TIME });
    const expected = BASE_COURT - Math.round(BASE_COURT * 7000 / 10000);
    expect(r.unitPaise).toBe(expected);
  });

  it('junior afternoon (19:00, after 17:00) → no rule → base price', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Junior Morning', appliesTo: 'court', tier: 'junior', effect: 'percent_off', value: 7000, priority: 50, timeTo: '17:00' });
    mockPlan('junior');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: PEAK_TIME });
    expect(r.unitPaise).toBe(BASE_COURT); // no rule matches afternoon
    expect(r.breakdown).toHaveLength(0);
  });

  // ─── Court – Walk-in ───────────────────────────────────────────────────────

  it('walkin peak (18:00) → 150000 paise fixed', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Walk-in Peak', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 150000, priority: 50, timeFrom: '17:00', timeTo: '21:00' });
    await insertRule({ name: 'Walk-in Standard', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 100000, priority: 40 });
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, channel: 'counter', at: PEAK_TIME });
    expect(r.unitPaise).toBe(150000);
    expect(r.tier).toBe('walkin');
  });

  it('walkin off-peak (10:00) → 100000 paise fixed', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Walk-in Peak', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 150000, priority: 50, timeFrom: '17:00', timeTo: '21:00' });
    await insertRule({ name: 'Walk-in Standard', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 100000, priority: 40 });
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(100000);
  });

  // ─── Shop ──────────────────────────────────────────────────────────────────

  it('gold member → 15% shop discount', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Gold Shop 15%', appliesTo: 'shop', tier: 'gold', effect: 'percent_off', value: 1500, priority: 10 });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: BASE_SHOP, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_SHOP - Math.round(BASE_SHOP * 1500 / 10000));
  });

  it('silver member → 10% shop discount', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Silver Shop 10%', appliesTo: 'shop', tier: 'silver', effect: 'percent_off', value: 1000, priority: 10 });
    mockPlan('silver');
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: BASE_SHOP, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_SHOP - Math.round(BASE_SHOP * 1000 / 10000));
  });

  it('junior member → 5% shop discount', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Junior Shop 5%', appliesTo: 'shop', tier: 'junior', effect: 'percent_off', value: 500, priority: 10 });
    mockPlan('junior');
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: BASE_SHOP, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_SHOP - Math.round(BASE_SHOP * 500 / 10000));
  });

  it('walkin → no shop discount', async () => {
    if (!dbAvail) return;
    // Insert gold-only rule, walkin should not match it
    await insertRule({ name: 'Gold Shop 15%', appliesTo: 'shop', tier: 'gold', effect: 'percent_off', value: 1500, priority: 10 });
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: BASE_SHOP, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_SHOP);
    expect(r.breakdown).toHaveLength(0);
  });

  // ─── Bar ───────────────────────────────────────────────────────────────────

  it('gold member → 10% bar discount', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Gold Bar 10%', appliesTo: 'bar', tier: 'gold', effect: 'percent_off', value: 1000, priority: 10 });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'bar', scopeRef: 'general', basePricePaise: BASE_BAR, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_BAR - Math.round(BASE_BAR * 1000 / 10000));
  });

  it('silver member → 5% bar discount', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Silver Bar 5%', appliesTo: 'bar', tier: 'silver', effect: 'percent_off', value: 500, priority: 10 });
    mockPlan('silver');
    const r = await engine.quote({ kind: 'bar', scopeRef: 'general', basePricePaise: BASE_BAR, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_BAR - Math.round(BASE_BAR * 500 / 10000));
  });

  it('walkin bar → base price (no rule)', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Gold Bar 10%', appliesTo: 'bar', tier: 'gold', effect: 'percent_off', value: 1000, priority: 10 });
    const r = await engine.quote({ kind: 'bar', scopeRef: 'general', basePricePaise: BASE_BAR, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(BASE_BAR);
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('expired member → priced as walkin', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Walkin Standard', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 100000, priority: 40 });
    mockPlan('gold', 'expired'); // plan exists but status is expired
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.tier).toBe('walkin');
    expect(r.unitPaise).toBe(100000);
  });

  it('suspended member → priced as walkin', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Walkin Standard', appliesTo: 'court', tier: 'walkin', effect: 'fixed_price', value: 100000, priority: 40 });
    mockPlan('gold', 'suspended');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.tier).toBe('walkin');
  });

  it('more specific rule (scopeRef set) beats general rule with higher priority', async () => {
    if (!dbAvail) return;
    // General gold rule – wildcard scopeRef, priority 50
    await insertRule({ name: 'Gold General', appliesTo: 'court', tier: 'gold', effect: 'percent_off', value: 2000, priority: 50 });
    // Specific gold+tennis rule – scopeRef set, priority 10 — wins by specificity
    await insertRule({ name: 'Gold Tennis Specific', appliesTo: 'court', tier: 'gold', effect: 'fixed_price', value: 999, priority: 10, scopeRef: 'tennis' });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'court', scopeRef: 'tennis', basePricePaise: BASE_COURT, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(999);
  });

  it('higher priority breaks ties on same specificity', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Rule A priority 20', appliesTo: 'shop', tier: 'gold', effect: 'percent_off', value: 1000, priority: 20 });
    await insertRule({ name: 'Rule B priority 10', appliesTo: 'shop', tier: 'gold', effect: 'percent_off', value: 2000, priority: 10 });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: 10000, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    // Rule A (priority 20) wins → 10% off
    expect(r.unitPaise).toBe(10000 - Math.round(10000 * 1000 / 10000));
  });

  it('rule outside valid_to window is ignored', async () => {
    if (!dbAvail) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    await insertRule({ name: 'Expired Rule', appliesTo: 'bar', tier: 'gold', effect: 'percent_off', value: 5000, priority: 10, validTo: yesterdayStr });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'bar', scopeRef: 'general', basePricePaise: 10000, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.breakdown).toHaveLength(0);
    expect(r.unitPaise).toBe(10000);
  });

  it('rule not yet valid (validFrom in future) is ignored', async () => {
    if (!dbAvail) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    await insertRule({ name: 'Future Rule', appliesTo: 'bar', tier: 'gold', effect: 'percent_off', value: 5000, priority: 10, validFrom: tomorrowStr });
    mockPlan('gold');
    const r = await engine.quote({ kind: 'bar', scopeRef: 'general', basePricePaise: 10000, qty: 1, memberId: 'x', channel: 'counter', at: OFFPEAK_TIME });
    expect(r.breakdown).toHaveLength(0);
  });

  it('price is never negative (amount_off exceeds base)', async () => {
    if (!dbAvail) return;
    await insertRule({ name: 'Huge Discount', appliesTo: 'shop', tier: null, effect: 'amount_off', value: 999999, priority: 10 });
    const r = await engine.quote({ kind: 'shop', scopeRef: 'general', basePricePaise: 1000, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(0);
  });

  it('rule edit takes effect on next quote (no stale cache)', async () => {
    if (!dbAvail) return;
    const [rule] = await db.insert(priceRules).values({
      name: 'Mutable Rule', appliesTo: 'bar', tier: null,
      effect: 'percent_off', value: 1000, priority: 10,
      scopeRef: null, channel: null, dayMask: null,
      timeFrom: null, timeTo: null, validFrom: null, validTo: null, active: true,
    }).returning();

    let r = await engine.quote({ kind: 'bar', scopeRef: 'x', basePricePaise: 10000, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(10000 - Math.round(10000 * 1000 / 10000)); // 10% off → 9000

    // Edit rule to 20% off
    await db.update(priceRules).set({ value: 2000 }).where(eq(priceRules.id, rule.id));

    r = await engine.quote({ kind: 'bar', scopeRef: 'x', basePricePaise: 10000, qty: 1, channel: 'counter', at: OFFPEAK_TIME });
    expect(r.unitPaise).toBe(10000 - Math.round(10000 * 2000 / 10000)); // 20% off → 8000
  });
});
