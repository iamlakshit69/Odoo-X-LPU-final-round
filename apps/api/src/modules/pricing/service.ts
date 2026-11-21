// Owner: Dev A – Phase 5: PricingEngine implementation
import { and, eq, or, isNull, lte, gte } from 'drizzle-orm';
import { PricingEngine } from '@club/contract';
import { db } from '../../core/db/index.js';
import { priceRules } from '../../db/schema/pricing.js';
import { toClubLocalWeekday, toClubLocalTime, clubLocalToday } from '../../core/clubTime.js';
import { Members } from '../members/index.js';

type Tier = 'gold' | 'silver' | 'junior' | 'walkin';

interface PriceRuleRow {
  id: string;
  name: string;
  appliesTo: string;
  scopeRef: string | null;
  tier: string | null;
  channel: string | null;
  dayMask: number | null;
  timeFrom: string | null;
  timeTo: string | null;
  effect: string;
  value: number;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
}

function compareTime(hhmm1: string, hhmm2: string): number {
  // Returns negative if hhmm1 < hhmm2, 0 if equal, positive if greater
  return hhmm1.localeCompare(hhmm2);
}

function specificity(rule: PriceRuleRow): number {
  let s = 0;
  if (rule.scopeRef !== null) s++;
  if (rule.tier !== null) s++;
  if (rule.channel !== null) s++;
  if (rule.dayMask !== null) s++;
  if (rule.timeFrom !== null || rule.timeTo !== null) s++;
  return s;
}

export class PricingEngineService implements PricingEngine {
  async quote(input: {
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
    tier: Tier;
    breakdown: Array<{ ruleId: string; label: string; deltaPaise: number }>;
  }> {
    // 1. Resolve tier
    let tier: Tier = 'walkin';
    if (input.memberId) {
      try {
        const plan = await Members.getActivePlan(input.memberId);
        if (plan.status === 'active' && plan.planCode !== 'walkin') {
          tier = plan.planCode as Tier;
        }
      } catch {
        // getActivePlan error → walkin
      }
    }

    // 2. Club-local time info
    const weekday = toClubLocalWeekday(input.at);       // 0=Sun..6=Sat
    const dayBit = 1 << weekday;
    const localTime = toClubLocalTime(input.at);        // 'HH:mm'
    const today = clubLocalToday();                     // 'YYYY-MM-DD'

    // 3. Load all candidates from DB: active=true, kind matches, date bounds
    let candidates: PriceRuleRow[];
    try {
      candidates = await db
        .select()
        .from(priceRules)
        .where(
          and(
            eq(priceRules.active, true),
            eq(priceRules.appliesTo, input.kind),
            or(isNull(priceRules.validFrom), lte(priceRules.validFrom, today)),
            or(isNull(priceRules.validTo), gte(priceRules.validTo, today)),
          ),
        ) as PriceRuleRow[];
    } catch {
      // DB offline → no rules, return base price
      candidates = [];
    }

    // 4. Filter candidates
    const matched = candidates.filter((rule) => {
      // scopeRef: null = wildcard
      if (rule.scopeRef !== null && rule.scopeRef !== input.scopeRef) return false;
      // tier: null = wildcard
      if (rule.tier !== null && rule.tier !== tier) return false;
      // channel: null = wildcard
      if (rule.channel !== null && rule.channel !== input.channel) return false;
      // dayMask: null = wildcard; check bit
      if (rule.dayMask !== null && (rule.dayMask & dayBit) === 0) return false;
      // time band: null/null = all day; half-open [timeFrom, timeTo)
      const hasFrom = rule.timeFrom !== null;
      const hasTo = rule.timeTo !== null;
      if (hasFrom || hasTo) {
        const from = rule.timeFrom ?? '00:00';
        const to = rule.timeTo ?? '23:59';
        if (compareTime(localTime, from) < 0 || compareTime(localTime, to) >= 0) return false;
      }
      return true;
    });

    // 5. Sort: descending specificity, then descending priority
    matched.sort((a, b) => {
      const ds = specificity(b) - specificity(a);
      if (ds !== 0) return ds;
      return b.priority - a.priority;
    });

    // 6. Apply winner's effect
    const breakdown: Array<{ ruleId: string; label: string; deltaPaise: number }> = [];
    let unitPaise = input.basePricePaise;

    if (matched.length > 0) {
      const winner = matched[0];
      let newUnit = unitPaise;

      if (winner.effect === 'fixed_price') {
        newUnit = winner.value;
      } else if (winner.effect === 'percent_off') {
        newUnit = unitPaise - Math.round(unitPaise * winner.value / 10000);
      } else if (winner.effect === 'amount_off') {
        newUnit = unitPaise - winner.value;
      }

      // Clamp to 0
      newUnit = Math.max(0, newUnit);
      breakdown.push({
        ruleId: winner.id,
        label: winner.name,
        deltaPaise: newUnit - unitPaise,
      });
      unitPaise = newUnit;
    }

    return {
      unitPaise,
      totalPaise: unitPaise * input.qty,
      tier,
      breakdown,
    };
  }
}

export const PricingEngineInstance = new PricingEngineService();
