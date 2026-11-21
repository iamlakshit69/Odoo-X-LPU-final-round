import type { PriceRule, QuoteResponse } from '../pricing.js';

export const fixturePriceRules: PriceRule[] = [
  // Court rules
  {
    id: '19000000-0000-0000-0000-000000000001',
    name: 'Gold Member Free Court Entitlement',
    appliesTo: 'court',
    scopeRef: null, // Any court type
    tier: 'gold',
    channel: null,
    dayMask: null,
    timeFrom: null,
    timeTo: null,
    effect: 'fixed_price',
    value: 0,
    priority: 100,
    active: true,
  },
  {
    id: '19000000-0000-0000-0000-000000000002',
    name: 'Silver Member Peak Discount (40% off)',
    appliesTo: 'court',
    scopeRef: null,
    tier: 'silver',
    channel: null,
    dayMask: null,
    timeFrom: '17:00',
    timeTo: '21:00',
    effect: 'percent_off',
    value: 4000, // 40.00%
    priority: 50,
    active: true,
  },
  {
    id: '19000000-0000-0000-0000-000000000003',
    name: 'Silver Member Regular Discount (60% off)',
    appliesTo: 'court',
    scopeRef: null,
    tier: 'silver',
    channel: null,
    dayMask: null,
    timeFrom: null,
    timeTo: null,
    effect: 'percent_off',
    value: 6000, // 60.00%
    priority: 10,
    active: true,
  },
  {
    id: '19000000-0000-0000-0000-000000000004',
    name: 'Junior Member Off-Peak Discount (70% off)',
    appliesTo: 'court',
    scopeRef: null,
    tier: 'junior',
    channel: null,
    dayMask: null,
    timeFrom: '06:00',
    timeTo: '17:00',
    effect: 'percent_off',
    value: 7000, // 70.00%
    priority: 30,
    active: true,
  },
  {
    id: '19000000-0000-0000-0000-000000000005',
    name: 'Walk-in Peak Court Surcharge Rate',
    appliesTo: 'court',
    scopeRef: 'tennis',
    tier: 'walkin',
    channel: 'counter',
    dayMask: null,
    timeFrom: '17:00',
    timeTo: '21:00',
    effect: 'fixed_price',
    value: 120000, // ₹1,200.00
    priority: 40,
    active: true,
  },
  // Shop rules
  {
    id: '19000000-0000-0000-0000-000000000010',
    name: 'Gold Member Shop Discount (15% off)',
    appliesTo: 'shop',
    scopeRef: null,
    tier: 'gold',
    channel: null,
    dayMask: null,
    timeFrom: null,
    timeTo: null,
    effect: 'percent_off',
    value: 1500, // 15%
    priority: 50,
    active: true,
  },
  // Bar rules
  {
    id: '19000000-0000-0000-0000-000000000020',
    name: 'Gold Member Bar Discount (10% off)',
    appliesTo: 'bar',
    scopeRef: null,
    tier: 'gold',
    channel: null,
    dayMask: null,
    timeFrom: null,
    timeTo: null,
    effect: 'percent_off',
    value: 1000, // 10%
    priority: 50,
    active: true,
  },
];

export const fixtureQuoteCourtGold: QuoteResponse = {
  unitPaise: 0,
  totalPaise: 0,
  tier: 'gold',
  breakdown: [
    {
      ruleId: '19000000-0000-0000-0000-000000000001',
      label: 'Gold Member Free Court Entitlement',
      deltaPaise: -100000,
    },
  ],
};

export const fixtureQuoteCourtSilverPeak: QuoteResponse = {
  unitPaise: 60000,
  totalPaise: 60000,
  tier: 'silver',
  breakdown: [
    {
      ruleId: '19000000-0000-0000-0000-000000000002',
      label: 'Silver Member Peak Discount (40% off)',
      deltaPaise: -40000,
    },
  ],
};
