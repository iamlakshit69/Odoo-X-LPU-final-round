import type {
  MenuItem,
  BarTable,
  TillSession,
  Tab,
  TabItem,
  KdsItem,
  ZReport,
} from '../bar.js';

export const fixtureMenuItems: MenuItem[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    name: 'Club Sandwich with Fries',
    category: 'food',
    station: 'kitchen',
    pricePaise: 35000, // ₹350.00
    taxCategory: 'restaurant_5',
    active: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    name: 'Fresh Lime Soda',
    category: 'drink',
    station: 'bar',
    pricePaise: 12000, // ₹120.00
    taxCategory: 'restaurant_5',
    active: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    name: 'Cold Pressed Orange Juice',
    category: 'drink',
    station: 'bar',
    pricePaise: 18000, // ₹180.00
    taxCategory: 'restaurant_5',
    active: true,
  },
];

export const fixtureBarTables: BarTable[] = [
  {
    id: '21000000-0000-0000-0000-000000000001',
    label: 'T1',
    seats: 4,
    x: 100,
    y: 100,
    activeTabId: '22000000-0000-0000-0000-000000000001',
    occupiedMinutes: 45,
    isOccupiedTooLong: false,
  },
  {
    id: '21000000-0000-0000-0000-000000000002',
    label: 'T2',
    seats: 2,
    x: 200,
    y: 100,
    activeTabId: null,
    occupiedMinutes: 0,
    isOccupiedTooLong: false,
  },
];

export const fixtureTillSession: TillSession = {
  id: '23000000-0000-0000-0000-000000000001',
  openedBy: '00000000-0000-0000-0000-000000000002',
  openedAt: '2026-11-21T07:00:00Z',
  openingFloatPaise: 500000, // ₹5,000.00
  closedAt: null,
  countedCashPaise: null,
  expectedCashPaise: null,
  variancePaise: null,
};

export const fixtureClosedTillSession: TillSession = {
  id: '23000000-0000-0000-0000-000000000002',
  openedBy: '00000000-0000-0000-0000-000000000002',
  openedAt: '2026-11-20T07:00:00Z',
  openingFloatPaise: 500000,
  closedAt: '2026-11-20T23:00:00Z',
  countedCashPaise: 2450000, // ₹24,500.00
  expectedCashPaise: 2460000, // ₹24,600.00
  variancePaise: -10000, // Shortage ₹100.00
};

export const fixtureTabItems: TabItem[] = [
  {
    id: '24000000-0000-0000-0000-000000000001',
    tabId: '22000000-0000-0000-0000-000000000001',
    menuItemId: '20000000-0000-0000-0000-000000000001',
    menuItemName: 'Club Sandwich with Fries',
    station: 'kitchen',
    qty: 2,
    unitPricePaise: 31500, // 10% Gold discount
    status: 'preparing',
    voidReason: null,
    addedBy: '00000000-0000-0000-0000-000000000002',
    createdAt: '2026-11-21T12:15:00Z',
  },
  {
    id: '24000000-0000-0000-0000-000000000002',
    tabId: '22000000-0000-0000-0000-000000000001',
    menuItemId: '20000000-0000-0000-0000-000000000002',
    menuItemName: 'Fresh Lime Soda',
    station: 'bar',
    qty: 2,
    unitPricePaise: 10800, // 10% Gold discount
    status: 'ready',
    voidReason: null,
    addedBy: '00000000-0000-0000-0000-000000000002',
    createdAt: '2026-11-21T12:15:00Z',
  },
];

export const fixtureTab: Tab = {
  id: '22000000-0000-0000-0000-000000000001',
  tableId: '21000000-0000-0000-0000-000000000001',
  tableLabel: 'T1',
  memberId: '20000000-0000-0000-0000-000000000001',
  guestLabel: null,
  status: 'open',
  openedBy: '00000000-0000-0000-0000-000000000002',
  tillSessionId: '23000000-0000-0000-0000-000000000001',
  invoiceId: null,
  items: fixtureTabItems,
  subtotalPaise: 84600, // (2*31500) + (2*10800)
  createdAt: '2026-11-21T12:10:00Z',
  updatedAt: '2026-11-21T12:15:00Z',
};

export const fixtureKdsItems: KdsItem[] = [
  {
    ...fixtureTabItems[0],
    tableLabel: 'T1',
    guestLabel: null,
    orderTime: '2026-11-21T12:15:00Z',
  },
];

export const fixtureZReport: ZReport = {
  date: '2026-11-20',
  tillSessionId: '23000000-0000-0000-0000-000000000002',
  salesByTender: [
    { method: 'cash', amountPaise: 1960000 },
    { method: 'card', amountPaise: 3500000 },
    { method: 'upi', amountPaise: 4200000 },
  ],
  salesByCategory: [
    { category: 'food', amountPaise: 5800000 },
    { category: 'drink', amountPaise: 3860000 },
  ],
  salesByWaiter: [
    {
      userId: '00000000-0000-0000-0000-000000000002',
      name: 'Rohan Bartender',
      amountPaise: 9660000,
    },
  ],
  totalSalesPaise: 9660000,
  voidsCount: 2,
  voidsPaise: 45000,
  discountsPaise: 96000,
  taxPaise: 460000,
};
