// Owner: Dev A – Phase 5: Pricing seed
// Seeds all price rules from Section 7.4 of the architecture document.
// DECISION: rule values and priorities logged here are the canonical source for Phase 5.
import { db } from '../../core/db/index.js';
import { priceRules } from '../schema/pricing.js';

export async function seedPricing() {
  const rules = [
    // === Court rules ===
    {
      name: 'Gold Member – Free Court',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'gold',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'fixed_price',
      value: 0,          // ₹0
      priority: 100,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Silver Member – Peak Court Discount (17:00–21:00)',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'silver',
      channel: null,
      dayMask: null,
      timeFrom: '17:00',
      timeTo: '21:00',
      effect: 'percent_off',
      value: 4000,       // 40 % off in basis points
      priority: 50,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Silver Member – Off-Peak Court Discount',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'silver',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 6000,       // 60 % off in basis points
      priority: 40,      // lower priority; peak rule wins during peak hours by higher specificity
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Junior Member – Court Discount (before 17:00)',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'junior',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: '17:00',
      effect: 'percent_off',
      value: 7000,       // 70 % off in basis points
      priority: 50,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Walk-in Peak Court Rate',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'walkin',
      channel: null,
      dayMask: null,
      timeFrom: '17:00',
      timeTo: '21:00',
      effect: 'fixed_price',
      value: 150000,     // ₹1,500 in paise
      priority: 50,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Walk-in Standard Court Rate',
      appliesTo: 'court',
      scopeRef: null,
      tier: 'walkin',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'fixed_price',
      value: 100000,     // ₹1,000 in paise
      priority: 40,
      validFrom: null,
      validTo: null,
      active: true,
    },

    // === Shop rules ===
    {
      name: 'Gold Member – Shop Discount (15%)',
      appliesTo: 'shop',
      scopeRef: null,
      tier: 'gold',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 1500,       // 15 % off in basis points
      priority: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Silver Member – Shop Discount (10%)',
      appliesTo: 'shop',
      scopeRef: null,
      tier: 'silver',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 1000,       // 10 % off in basis points
      priority: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Junior Member – Shop Discount (5%)',
      appliesTo: 'shop',
      scopeRef: null,
      tier: 'junior',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 500,        // 5 % off in basis points
      priority: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },

    // === Bar rules ===
    {
      name: 'Gold Member – Bar Discount (10%)',
      appliesTo: 'bar',
      scopeRef: null,
      tier: 'gold',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 1000,       // 10 % off in basis points
      priority: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      name: 'Silver Member – Bar Discount (5%)',
      appliesTo: 'bar',
      scopeRef: null,
      tier: 'silver',
      channel: null,
      dayMask: null,
      timeFrom: null,
      timeTo: null,
      effect: 'percent_off',
      value: 500,        // 5 % off in basis points
      priority: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },
    // Bar Junior = 0% = no rule needed; junior walk-in pays base price
  ];

  await db.insert(priceRules).values(rules).onConflictDoNothing();
  console.log(`[seed] pricing: ${rules.length} price rules inserted`);
}
