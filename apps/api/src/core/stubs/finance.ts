// Owner: Dev B – Replaced Dev A stubs with imports of real database services
import { Invoices, InvoicesService } from '../../modules/invoices/service.js';
import { Payments, PaymentsService } from '../../modules/payments/service.js';
import { InvoiceService, PaymentService } from '@club/contract';

export const invoiceServiceStub: InvoiceService = Invoices;
export const paymentServiceStub: PaymentService = Payments;

export { Invoices, Payments };

export function resetFinanceStubs() {
  // Real database services are persistent; reset occurs via db:reset
}
