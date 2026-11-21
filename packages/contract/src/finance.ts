// Owner: Dev B. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  bpsSchema,
  dateOnSchema,
  timestampAtSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Section 6 Shared Service Interfaces for Dev A & Dev B
export type LineSource = 'membership' | 'court' | 'shop' | 'bar' | 'corporate' | 'social';
export const lineSourceSchema = z.enum([
  'membership',
  'court',
  'shop',
  'bar',
  'corporate',
  'social',
]);

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'online' | 'comp' | 'refund';
export const paymentMethodSchema = z.enum(['cash', 'card', 'upi', 'online', 'comp', 'refund']);

// Generic database transaction handle for cross-module transactions
export type DbTx = unknown;

export interface InvoiceService {
  create(
    input: {
      customer: { memberId?: string; businessClientId?: string; guestName?: string };
      lines: Array<{
        source: LineSource;
        description: string;
        qty: number;
        unitPricePaise: number;
        discountPaise?: number;
        taxCategory: string;
        refType: string;
        refId: string;
      }>;
      dueOn?: Date;
    },
    tx: DbTx
  ): Promise<{ invoiceId: string; number: string; totalPaise: number }>;

  addLines(
    invoiceId: string,
    lines: Array<{
      source: LineSource;
      description: string;
      qty: number;
      unitPricePaise: number;
      discountPaise?: number;
      taxCategory: string;
      refType: string;
      refId: string;
    }>,
    tx: DbTx
  ): Promise<void>;
}

export interface PaymentService {
  record(
    input: {
      invoiceId: string;
      method: 'cash' | 'card' | 'upi' | 'online' | 'comp';
      amountPaise: number;
      reference?: string;
      tillSessionId?: string;
    },
    tx: DbTx
  ): Promise<{ paymentId: string; outstandingPaise: number }>;

  refund(
    input: {
      invoiceId: string;
      amountPaise: number;
      reason: string;
    },
    tx: DbTx
  ): Promise<{ paymentId: string }>;
}

// Invoices & Balance Enums
export const invoiceStatusSchema = z.enum(['draft', 'issued', 'void']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const balanceStatusSchema = z.enum(['unpaid', 'partial', 'paid', 'overpaid']);
export type BalanceStatus = z.infer<typeof balanceStatusSchema>;

export const expenseStatusSchema = z.enum(['submitted', 'approved', 'rejected']);
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;

// Models
export const businessClientSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  gstin: z.string().nullable().optional(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string().email(),
  creditDays: z.number().int().min(0),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type BusinessClient = z.infer<typeof businessClientSchema>;

export const invoiceLineSchema = z.object({
  id: uuidSchema,
  invoiceId: uuidSchema,
  source: lineSourceSchema,
  description: z.string(),
  qty: z.number().int().positive(),
  unitPricePaise: paiseSchema,
  discountPaise: paiseSchema,
  taxablePaise: paiseSchema,
  taxRateBps: bpsSchema,
  cgstPaise: paiseSchema,
  sgstPaise: paiseSchema,
  totalPaise: paiseSchema,
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const paymentSchema = z.object({
  id: uuidSchema,
  invoiceId: uuidSchema,
  method: paymentMethodSchema,
  amountPaise: paiseSchema,
  receivedAt: timestampAtSchema,
  receivedBy: uuidSchema.nullable().optional(),
  tillSessionId: uuidSchema.nullable().optional(),
  reference: z.string().nullable().optional(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const invoiceSchema = z.object({
  id: uuidSchema,
  number: z.string(),
  memberId: uuidSchema.nullable().optional(),
  businessClientId: uuidSchema.nullable().optional(),
  guestName: z.string().nullable().optional(),
  status: invoiceStatusSchema,
  issuedAt: timestampAtSchema,
  dueOn: dateOnSchema.nullable().optional(),
  subtotalPaise: paiseSchema,
  cgstPaise: paiseSchema,
  sgstPaise: paiseSchema,
  totalPaise: paiseSchema,
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceBalanceViewSchema = z.object({
  invoiceId: uuidSchema,
  chargedPaise: paiseSchema,
  paidPaise: paiseSchema,
  outstandingPaise: paiseSchema,
  status: balanceStatusSchema,
});
export type InvoiceBalanceView = z.infer<typeof invoiceBalanceViewSchema>;

export const invoiceSummarySchema = invoiceSchema.extend({
  chargedPaise: paiseSchema,
  paidPaise: paiseSchema,
  outstandingPaise: paiseSchema,
  balanceStatus: balanceStatusSchema,
});
export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>;

export const invoiceDetailSchema = invoiceSummarySchema.extend({
  lines: z.array(invoiceLineSchema),
  payments: z.array(paymentSchema),
  pdfUrl: z.string().optional(),
});
export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;

export const expenseSchema = z.object({
  id: uuidSchema,
  category: z.string(),
  description: z.string(),
  amountPaise: paiseSchema,
  incurredOn: dateOnSchema,
  paid: z.boolean(),
  receiptUrl: z.string().nullable().optional(),
  status: expenseStatusSchema,
  submittedBy: uuidSchema.nullable().optional(),
  approvedBy: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const taxRateSchema = z.object({
  id: uuidSchema,
  category: z.string(),
  rateBps: bpsSchema,
  description: z.string().nullable().optional(),
});
export type TaxRate = z.infer<typeof taxRateSchema>;

// Endpoint Schemas

// 1. GET /invoices
export const getInvoicesQuerySchema = paginationQuerySchema.extend({
  status: invoiceStatusSchema.optional(),
  memberId: uuidSchema.optional(),
  businessClientId: uuidSchema.optional(),
});
export const getInvoicesResponseSchema = paginatedResponseSchema(invoiceSummarySchema);

// 2. GET /invoices/:id
export const getInvoiceParamsSchema = z.object({ id: uuidSchema });
export const getInvoiceResponseSchema = invoiceDetailSchema;

// 3. GET /invoices/:id/pdf
export const getInvoicePdfParamsSchema = z.object({ id: uuidSchema });
export const getInvoicePdfResponseSchema = z.object({
  html: z.string(),
  pdfUrl: z.string().optional(),
});

// 4. POST /invoices/:id/payments
export const createPaymentParamsSchema = z.object({ id: uuidSchema });
export const createPaymentRequestSchema = z.object({
  method: z.enum(['cash', 'card', 'upi', 'online', 'comp']),
  amountPaise: paiseSchema,
  reference: z.string().optional(),
  tillSessionId: uuidSchema.optional(),
});
export const createPaymentResponseSchema = z.object({
  paymentId: uuidSchema,
  invoiceId: uuidSchema,
  amountPaise: paiseSchema,
  outstandingPaise: paiseSchema,
  status: balanceStatusSchema,
});

// 5. POST /invoices
export const createInvoiceRequestSchema = z.object({
  customer: z.object({
    memberId: uuidSchema.optional(),
    businessClientId: uuidSchema.optional(),
    guestName: z.string().optional(),
  }),
  lines: z.array(z.object({
    source: lineSourceSchema,
    description: z.string().min(1),
    qty: z.number().int().positive(),
    unitPricePaise: paiseSchema,
    discountPaise: paiseSchema.default(0).optional(),
    taxCategory: z.string(),
    refType: z.string().default('manual').optional(),
    refId: z.string().default('').optional(),
  })).min(1),
  dueOn: dateOnSchema.optional(),
});
export const createInvoiceResponseSchema = z.object({
  invoiceId: uuidSchema,
  number: z.string(),
  totalPaise: paiseSchema,
  status: invoiceStatusSchema,
});

// 6. CRUD /business-clients
export const createBusinessClientRequestSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional(),
  contactName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  creditDays: z.number().int().min(0).default(30),
});
export const createBusinessClientResponseSchema = businessClientSchema;

export const updateBusinessClientParamsSchema = z.object({ id: uuidSchema });
export const updateBusinessClientRequestSchema = createBusinessClientRequestSchema.partial();
export const updateBusinessClientResponseSchema = businessClientSchema;

export const getBusinessClientsResponseSchema = z.array(businessClientSchema);

// 7. GET /finance/summary
export const getFinanceSummaryQuerySchema = z.object({
  from: dateOnSchema,
  to: dateOnSchema,
  group: z.enum(['day', 'week', 'month']).default('day').optional(),
});
export const financeSummarySchema = z.object({
  charged: paiseSchema,
  collected: paiseSchema,
  outstanding: paiseSchema,
  gstCollected: paiseSchema,
  expenses: paiseSchema,
  profit: paiseSchema,
  payrollDue: paiseSchema,
  bySource: z.array(z.object({
    source: lineSourceSchema,
    amountPaise: paiseSchema,
  })),
  byMethod: z.array(z.object({
    method: paymentMethodSchema,
    amountPaise: paiseSchema,
  })),
  series: z.array(z.object({
    date: z.string(),
    charged: paiseSchema,
    collected: paiseSchema,
    expenses: paiseSchema,
    profit: paiseSchema,
  })),
});
export type FinanceSummary = z.infer<typeof financeSummarySchema>;

// 8. GET /finance/receivables
export const getFinanceReceivablesResponseSchema = z.object({
  bucket0_30Paise: paiseSchema,
  bucket31_60Paise: paiseSchema,
  bucket61PlusPaise: paiseSchema,
  totalOutstandingPaise: paiseSchema,
  clients: z.array(z.object({
    clientName: z.string(),
    outstandingPaise: paiseSchema,
    bucket: z.enum(['0-30', '31-60', '61+']),
  })),
});

// 9. GET /finance/export
export const getFinanceExportQuerySchema = z.object({
  from: dateOnSchema,
  to: dateOnSchema,
  format: z.literal('csv'),
});
export const getFinanceExportResponseSchema = z.object({
  csv: z.string(),
  filename: z.string(),
});

// 10. POST /finance/share (P1)
export const shareFinanceRequestSchema = z.object({
  from: dateOnSchema,
  to: dateOnSchema,
});
export const shareFinanceResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: timestampAtSchema,
});

// 11. CRUD /expenses
export const getExpensesQuerySchema = paginationQuerySchema.extend({
  status: expenseStatusSchema.optional(),
  category: z.string().optional(),
});
export const getExpensesResponseSchema = paginatedResponseSchema(expenseSchema);

export const createExpenseRequestSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amountPaise: paiseSchema,
  incurredOn: dateOnSchema,
  paid: z.boolean().default(false).optional(),
  receiptUrl: z.string().optional(),
});
export const createExpenseResponseSchema = expenseSchema;

export const updateExpenseParamsSchema = z.object({ id: uuidSchema });
export const updateExpenseRequestSchema = createExpenseRequestSchema.partial();
export const updateExpenseResponseSchema = expenseSchema;

export const approveExpenseParamsSchema = z.object({ id: uuidSchema });
export const approveExpenseRequestSchema = z.object({
  approve: z.boolean(),
  note: z.string().optional(),
});
export const approveExpenseResponseSchema = expenseSchema;

// 12. GET & PUT /admin/tax-rates
export const getTaxRatesResponseSchema = z.array(taxRateSchema);

export const updateTaxRateParamsSchema = z.object({ id: uuidSchema });
export const updateTaxRateRequestSchema = z.object({
  rateBps: bpsSchema,
  description: z.string().optional(),
});
export const updateTaxRateResponseSchema = taxRateSchema;
