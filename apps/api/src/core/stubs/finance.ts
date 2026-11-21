import { randomUUID } from 'node:crypto';
import {
  InvoiceService,
  PaymentService,
  DbTx,
  LineSource,
} from '@club/contract';

export interface StoredInvoice {
  invoiceId: string;
  number: string;
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
  totalPaise: number;
  paidPaise: number;
  status: 'draft' | 'issued' | 'paid';
  createdAt: Date;
}

export class InMemoryInvoiceServiceStub implements InvoiceService {
  private invoices = new Map<string, StoredInvoice>();
  private counter = 1000;

  async create(
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
    _tx: DbTx
  ): Promise<{ invoiceId: string; number: string; totalPaise: number }> {
    const invoiceId = randomUUID();
    const invoiceNum = `INV-${++this.counter}`;

    const totalPaise = input.lines.reduce((sum, line) => {
      const lineTotal = line.qty * line.unitPricePaise - (line.discountPaise || 0);
      return sum + Math.max(0, lineTotal);
    }, 0);

    const inv: StoredInvoice = {
      invoiceId,
      number: invoiceNum,
      customer: input.customer,
      lines: input.lines,
      totalPaise,
      paidPaise: totalPaise === 0 ? 0 : 0,
      status: totalPaise === 0 ? 'paid' : 'issued',
      createdAt: new Date(),
    };

    this.invoices.set(invoiceId, inv);
    return { invoiceId, number: invoiceNum, totalPaise };
  }

  async addLines(
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
    _tx: DbTx
  ): Promise<void> {
    const inv = this.invoices.get(invoiceId);
    if (inv) {
      inv.lines.push(...lines);
      const delta = lines.reduce((sum, line) => {
        return sum + Math.max(0, line.qty * line.unitPricePaise - (line.discountPaise || 0));
      }, 0);
      inv.totalPaise += delta;
    }
  }

  getInvoice(id: string): StoredInvoice | undefined {
    return this.invoices.get(id);
  }
}

export class InMemoryPaymentServiceStub implements PaymentService {
  private payments = new Map<string, { id: string; invoiceId: string; amountPaise: number }>();

  async record(
    input: {
      invoiceId: string;
      method: 'cash' | 'card' | 'upi' | 'online' | 'comp';
      amountPaise: number;
      reference?: string;
      tillSessionId?: string;
    },
    _tx: DbTx
  ): Promise<{ paymentId: string; outstandingPaise: number }> {
    const paymentId = randomUUID();
    this.payments.set(paymentId, {
      id: paymentId,
      invoiceId: input.invoiceId,
      amountPaise: input.amountPaise,
    });
    return { paymentId, outstandingPaise: 0 };
  }

  async refund(
    input: {
      invoiceId: string;
      amountPaise: number;
      reason: string;
    },
    _tx: DbTx
  ): Promise<{ paymentId: string }> {
    const paymentId = randomUUID();
    this.payments.set(paymentId, {
      id: paymentId,
      invoiceId: input.invoiceId,
      amountPaise: -input.amountPaise,
    });
    return { paymentId };
  }
}

// In-memory singletons to be replaced when Dev B lands real services
export const invoiceServiceStub = new InMemoryInvoiceServiceStub();
export const paymentServiceStub = new InMemoryPaymentServiceStub();
