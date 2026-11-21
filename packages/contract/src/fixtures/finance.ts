import type {
  BusinessClient,
  InvoiceSummary,
  InvoiceDetail,
  FinanceSummary,
  Expense,
  TaxRate,
} from '../finance.js';

export const fixtureBusinessClients: BusinessClient[] = [
  {
    id: '31000000-0000-0000-0000-000000000001',
    name: 'Acme Sports Corp',
    gstin: '07AAAAA0000A1Z5',
    contactName: 'Vikram Malhotra',
    phone: '+919876543210',
    email: 'vikram@acmesports.in',
    creditDays: 30,
    createdAt: '2026-11-01T00:00:00Z',
  },
];

export const fixtureInvoiceSummary: InvoiceSummary = {
  id: '30000000-0000-0000-0000-000000000001',
  number: 'INV-2026-000101',
  memberId: '20000000-0000-0000-0000-000000000001',
  businessClientId: null,
  guestName: null,
  status: 'issued',
  issuedAt: '2026-11-21T08:30:00Z',
  dueOn: '2026-11-21',
  subtotalPaise: 1104915,
  cgstPaise: 66295,
  sgstPaise: 66295,
  totalPaise: 1237505,
  chargedPaise: 1237505,
  paidPaise: 1237505,
  outstandingPaise: 0,
  balanceStatus: 'paid',
  createdAt: '2026-11-21T08:30:00Z',
};

export const fixtureInvoiceDetail: InvoiceDetail = {
  ...fixtureInvoiceSummary,
  lines: [
    {
      id: '32000000-0000-0000-0000-000000000001',
      invoiceId: '30000000-0000-0000-0000-000000000001',
      source: 'shop',
      description: 'Pro Wilson Tennis Racket (Grip 3)',
      qty: 1,
      unitPricePaise: 1299900,
      discountPaise: 194985, // 15% discount
      taxablePaise: 1104915,
      taxRateBps: 1200, // 12% GST
      cgstPaise: 66295, // floor(132590 / 2)
      sgstPaise: 66295,
      totalPaise: 1237505,
      refType: 'order',
      refId: '13000000-0000-0000-0000-000000000001',
    },
  ],
  payments: [
    {
      id: '33000000-0000-0000-0000-000000000001',
      invoiceId: '30000000-0000-0000-0000-000000000001',
      method: 'online',
      amountPaise: 1237505,
      receivedAt: '2026-11-21T08:31:00Z',
      receivedBy: null,
      tillSessionId: null,
      reference: 'UPI/20261121/9837264',
    },
  ],
  pdfUrl: '/api/invoices/30000000-0000-0000-0000-000000000001/pdf',
};

export const fixtureFinanceSummary: FinanceSummary = {
  charged: 54500000,
  collected: 48200000,
  outstanding: 6300000,
  gstCollected: 5850000,
  expenses: 12400000,
  profit: 36250000,
  payrollDue: 18500000,
  bySource: [
    { source: 'membership', amountPaise: 25000000 },
    { source: 'court', amountPaise: 14500000 },
    { source: 'shop', amountPaise: 8200000 },
    { source: 'bar', amountPaise: 6800000 },
  ],
  byMethod: [
    { method: 'upi', amountPaise: 26000000 },
    { method: 'card', amountPaise: 14200000 },
    { method: 'cash', amountPaise: 8000000 },
  ],
  series: [
    {
      date: '2026-11-19',
      charged: 18000000,
      collected: 16500000,
      expenses: 4200000,
      profit: 12300000,
    },
    {
      date: '2026-11-20',
      charged: 19500000,
      collected: 18200000,
      expenses: 3900000,
      profit: 14300000,
    },
    {
      date: '2026-11-21',
      charged: 17000000,
      collected: 13500000,
      expenses: 4300000,
      profit: 9650000,
    },
  ],
};

export const fixtureExpenses: Expense[] = [
  {
    id: '34000000-0000-0000-0000-000000000001',
    category: 'Court Maintenance',
    description: 'Clay court top dressing and net repairs',
    amountPaise: 4500000, // ₹45,000.00
    incurredOn: '2026-11-18',
    paid: true,
    receiptUrl: 'https://storage.championsclub.local/receipts/rec-001.pdf',
    status: 'approved',
    submittedBy: '00000000-0000-0000-0000-000000000003',
    approvedBy: '00000000-0000-0000-0000-000000000001',
    createdAt: '2026-11-18T10:00:00Z',
  },
];

export const fixtureTaxRates: TaxRate[] = [
  {
    id: '35000000-0000-0000-0000-000000000001',
    category: 'court_hire_18',
    rateBps: 1800,
    description: '18% GST for sports facilities & court bookings',
  },
  {
    id: '35000000-0000-0000-0000-000000000002',
    category: 'sports_goods_12',
    rateBps: 1200,
    description: '12% GST for sporting equipment & apparel',
  },
  {
    id: '35000000-0000-0000-0000-000000000003',
    category: 'restaurant_5',
    rateBps: 500,
    description: '5% GST for F&B bar & cafeteria services',
  },
];
