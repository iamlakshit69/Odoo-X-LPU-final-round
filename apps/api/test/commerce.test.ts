// Owner: Dev B – Commerce and Money Integration Tests (T8, T9, T10, T11, T12, T14)
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/core/db/index.js';
import { createTestApp, isDbConnected, resetTestDb } from './helper.js';
import {
  products,
  productVariants,
  stockLevels,
  orders,
} from '../src/db/schema/shop.js';
import {
  invoices,
  invoiceLines,
  payments,
} from '../src/db/schema/invoices.js';
import {
  employees,
  leaveTypes,
  leaveBalances,
  leaveRequests,
} from '../src/db/schema/hr.js';
import { tillSessions, menuItems } from '../src/db/schema/bar.js';
import { auditLog } from '../src/db/schema/core.js';
import { Shop } from '../src/modules/shop/service.js';
import { Invoices } from '../src/modules/invoices/service.js';
import { Payments } from '../src/modules/payments/service.js';
import { Bar } from '../src/modules/bar/service.js';
import { Hr } from '../src/modules/hr/service.js';
import { Finance } from '../src/modules/finance/service.js';
import { Expenses } from '../src/modules/expenses/service.js';
import { Events } from '../src/core/events.js';

describe('Dev B: Commerce, Money, Bar POS, and HR Invariant Tests', () => {
  let dbOnline = false;

  beforeAll(async () => {
    dbOnline = await isDbConnected();
  });

  // T8: 10 parallel orders for the last 3 units: stock never negative, extras get OUT_OF_STOCK
  it('T8: 10 parallel orders for last 3 units: stock never negative, extras get OUT_OF_STOCK', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    // 1. Create a test product and variant with exactly 3 units of stock
    const productId = randomUUID();
    const variantId = randomUUID();

    await db.insert(products).values({
      id: productId,
      name: 'Test Limited Stock Item',
      category: 'racket',
      basePricePaise: 500000,
      taxCategory: 'sports_goods_12',
      active: true,
    });

    await db.insert(productVariants).values({
      id: variantId,
      productId,
      sku: `SKU-RACE-${randomUUID().slice(0, 8)}`,
      optionLabel: 'Race Limited',
      pricePaise: 500000,
      lowStockThreshold: 1,
      active: true,
    });

    await db
      .insert(stockLevels)
      .values({
        variantId,
        onHand: 3,
        reserved: 0,
      })
      .onConflictDoUpdate({
        target: stockLevels.variantId,
        set: { onHand: 3, reserved: 0 },
      });

    // 2. Fire 10 parallel orders requesting 1 unit each
    const promises = Array.from({ length: 10 }).map(async (_, idx) => {
      try {
        const order = await Shop.createOrder({
          items: [{ variantId, qty: 1 }],
          fulfilment: 'counter',
          channel: 'counter',
          guestName: `Racer ${idx + 1}`,
        });
        return { success: true, orderId: order.id };
      } catch (err: any) {
        return { success: false, code: err.code || err.message };
      }
    });

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      console.log('Sample failure from T8:', failures[0]);
    }

    // Exactly 3 must succeed, 7 must fail with OUT_OF_STOCK
    expect(successes.length).toBe(3);
    expect(failures.length).toBe(7);
    for (const f of failures) {
      expect(f.code).toBe('OUT_OF_STOCK');
    }

    // Stock level must be exactly 0, never negative
    const [finalStock] = await db
      .select()
      .from(stockLevels)
      .where(eq(stockLevels.variantId, variantId));

    expect(finalStock.onHand).toBe(0);
    expect(finalStock.onHand).toBeGreaterThanOrEqual(0);
  });

  // T9: Payment above outstanding returns OVERPAYMENT; partial payments sum correctly; charged/paid/outstanding match view
  it('T9: Payment above outstanding returns OVERPAYMENT; partial payments match balance view', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    // 1. Create an invoice of ₹1,000 (100,000 paise)
    const inv = await Invoices.create({
      customer: { guestName: 'Payment Test Guest' },
      lines: [
        {
          source: 'shop',
          description: 'Payment Test Goods',
          qty: 1,
          unitPricePaise: 100000,
          discountPaise: 0,
          taxCategory: 'standard', // 18% GST -> 100,000 + 18,000 = 118,000 total
          refType: 'test',
          refId: 't9',
        },
      ],
    });

    expect(inv.totalPaise).toBe(118000);

    // 2. Make partial payment 1: ₹500 (50,000 paise)
    const pmt1 = await Payments.record({
      invoiceId: inv.invoiceId,
      method: 'cash',
      amountPaise: 50000,
    });
    expect(pmt1.outstandingPaise).toBe(68000);
    expect(pmt1.status).toBe('partial');

    // 3. Attempt overpayment: ₹700 (70,000 paise) when only 68,000 is outstanding
    await expect(
      Payments.record({
        invoiceId: inv.invoiceId,
        method: 'card',
        amountPaise: 70000,
      })
    ).rejects.toThrow();

    // 4. Pay remaining exactly: ₹680 (68,000 paise)
    const pmt2 = await Payments.record({
      invoiceId: inv.invoiceId,
      method: 'upi',
      amountPaise: 68000,
    });
    expect(pmt2.outstandingPaise).toBe(0);
    expect(pmt2.status).toBe('paid');

    // 5. Query v_invoice_balance view and assert consistency
    const viewRes = await db.execute(
      sql`SELECT * FROM v_invoice_balance WHERE invoice_id = ${inv.invoiceId}`
    );
    const viewRow = ((viewRes.rows as any[]) || [])[0];

    expect(viewRow).toBeDefined();
    expect(Number(viewRow.charged_paise)).toBe(118000);
    expect(Number(viewRow.paid_paise)).toBe(118000);
    expect(Number(viewRow.outstanding_paise)).toBe(0);
    expect(viewRow.status).toBe('paid');
  });

  // T10: GST lines sum exactly to invoice totals (CGST+SGST)
  it('T10: GST lines sum exactly to invoice totals (CGST + SGST)', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    // Create an invoice with lines across multiple tax rates (18%, 12%, 5%)
    const inv = await Invoices.create({
      customer: { guestName: 'GST Math Guest' },
      lines: [
        {
          source: 'court',
          description: 'Tennis Court Session',
          qty: 1,
          unitPricePaise: 150000, // ₹1,500
          discountPaise: 30000,   // ₹300 discount -> ₹1,200 taxable
          taxCategory: 'court_hire_18', // 18% -> ₹216 tax (CGST ₹108 + SGST ₹108)
          refType: 'booking',
          refId: 'gst-1',
        },
        {
          source: 'shop',
          description: 'Tennis Balls Can',
          qty: 3,
          unitPricePaise: 65000, // ₹650 * 3 = ₹1,950 taxable
          discountPaise: 0,
          taxCategory: 'sports_goods_12', // 12% -> 195000 * 0.12 = 23400 (CGST 11700 + SGST 11700)
          refType: 'shop',
          refId: 'gst-2',
        },
        {
          source: 'bar',
          description: 'Club Sandwich',
          qty: 2,
          unitPricePaise: 35000, // ₹350 * 2 = ₹700 taxable
          discountPaise: 0,
          taxCategory: 'restaurant_5', // 5% -> 70000 * 0.05 = 3500 (CGST 1750 + SGST 1750)
          refType: 'tab',
          refId: 'gst-3',
        },
      ],
    });

    const detail = await Invoices.getInvoice(inv.invoiceId);

    // Assert each line's CGST + SGST + Taxable = Total
    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumTotal = 0;

    for (const l of detail.lines) {
      expect(l.totalPaise).toBe(l.taxablePaise + l.cgstPaise + l.sgstPaise);
      expect(l.cgstPaise + l.sgstPaise).toBe(Math.round((l.taxablePaise * l.taxRateBps) / 10000));
      sumTaxable += l.taxablePaise;
      sumCgst += l.cgstPaise;
      sumSgst += l.sgstPaise;
      sumTotal += l.totalPaise;
    }

    // Assert invoice header matches line sums
    expect(detail.subtotalPaise).toBe(sumTaxable);
    expect(detail.cgstPaise).toBe(sumCgst);
    expect(detail.sgstPaise).toBe(sumSgst);
    expect(detail.totalPaise).toBe(sumTotal);
  });

  // T11: Till close variance equals counted minus expected
  it('T11: Till close variance equals counted minus expected', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    const testStaffId = randomUUID();

    // Open till with ₹2,000 float (200,000 paise)
    const till = await Bar.openTill({ openingFloatPaise: 200000 }, testStaffId);
    expect(till.openingFloatPaise).toBe(200000);

    // Settle a tab with ₹300 (30,000 paise) cash payment linked to this till session
    const tab = await Bar.createTab({ guestLabel: 'Till Test Guest', tillSessionId: till.id }, {
      id: testStaffId,
      name: 'Cashier',
      email: 'cashier@example.com',
      roleId: randomUUID(),
      roleCode: 'cashier',
      memberId: null,
      employeeId: null,
      active: true,
    });

    // Add item: Fresh Lime Soda
    let [limeSoda] = await db.select().from(menuItems).limit(1);
    if (!limeSoda) {
      const [inserted] = await db.insert(menuItems).values({
        name: 'Fresh Lime Soda',
        category: 'beverage',
        station: 'bar',
        pricePaise: 30000,
        taxCategory: 'restaurant_5',
        active: true,
      }).returning();
      limeSoda = inserted;
    }
    await Bar.addItemToTab(tab.id, { menuItemId: limeSoda.id, qty: 1 });

    const tabDetail = await Bar.getTab(tab.id);

    // Settle tab with cash
    await Bar.settleTab(tab.id, {
      payments: [{ method: 'cash', amountPaise: tabDetail.subtotalPaise! }],
    });

    const expectedCash = 200000 + tabDetail.subtotalPaise!;

    // Close till with ₹100 cash shortage (-10,000 paise)
    const countedCash = expectedCash - 10000;
    const closedTill = await Bar.closeTill({
      tillSessionId: till.id,
      countedCashPaise: countedCash,
    });

    expect(closedTill.expectedCashPaise).toBe(expectedCash);
    expect(closedTill.countedCashPaise).toBe(countedCash);
    expect(closedTill.variancePaise).toBe(-10000);
    expect(closedTill.variancePaise).toBe(closedTill.countedCashPaise! - closedTill.expectedCashPaise!);
  });

  // T12: Leave request over balance is rejected
  it('T12: Leave request over balance is rejected', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    // Find an employee and their leave balances
    let [emp] = await db.select().from(employees).limit(1);
    if (!emp) {
      const [inserted] = await db.insert(employees).values({
        name: 'Test HR Employee',
        phone: '+919999988888',
        email: 'test.emp@example.com',
        roleTitle: 'Coach',
        joinedOn: '2026-01-01',
        active: true,
      }).returning();
      emp = inserted;

      const [clType] = await db.select().from(leaveTypes).where(eq(leaveTypes.code, 'CL')).limit(1);
      if (clType) {
        await db.insert(leaveBalances).values({
          employeeId: emp.id,
          leaveTypeId: clType.id,
          year: new Date().getFullYear(),
          allotted: 12,
          used: 0,
        });
      }
    }
    expect(emp).toBeDefined();

    const balances = await Hr.getLeaveBalances(emp.id);
    const cl = balances.find((b) => b.leaveTypeCode === 'CL');
    expect(cl).toBeDefined();

    const availableDays = cl!.remaining;

    // 1. Requesting more than available days must fail with 400 VALIDATION
    await expect(
      Hr.createLeaveRequest({
        employeeId: emp.id,
        leaveTypeId: cl!.leaveTypeId,
        fromOn: '2026-12-01',
        toOn: '2026-12-20',
        days: availableDays + 5, // Exceeds balance
        reason: 'Too long vacation',
      })
    ).rejects.toThrow();

    // 2. Requesting exact available days succeeds
    const validReq = await Hr.createLeaveRequest({
      employeeId: emp.id,
      leaveTypeId: cl!.leaveTypeId,
      fromOn: '2026-12-01',
      toOn: '2026-12-02',
      days: 2,
      reason: 'Valid short leave',
    });
    expect(validReq.status).toBe('pending');

    // 3. Approving increments used count
    const approved = await Hr.decideLeaveRequest(validReq.id, true, 'Approved by Manager');
    expect(approved.status).toBe('approved');

    const newBalances = await Hr.getLeaveBalances(emp.id);
    const updatedCl = newBalances.find((b) => b.leaveTypeCode === 'CL')!;
    expect(updatedCl.used).toBe(cl!.used + 2);
    expect(updatedCl.remaining).toBe(cl!.remaining - 2);
  });

  // T14: Every write path creates an audit row
  it('T14: Write paths create audit log rows', async () => {
    if (!dbOnline) {
      console.log('Skipping live DB check as Postgres is offline.');
      return;
    }

    const initialAuditCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditLog);

    // Perform writes across modules
    const prod = await Shop.createProduct({
      name: 'Audit Test Racket',
      category: 'racket',
      basePricePaise: 100000,
      taxCategory: 'sports_goods_12',
    });

    const inv = await Invoices.create({
      customer: { guestName: 'Audit Test Guest' },
      lines: [
        {
          source: 'shop',
          description: 'Audit Test Line',
          qty: 1,
          unitPricePaise: 50000,
          taxCategory: 'sports_goods_12',
          refType: 'test',
          refId: prod.id,
        },
      ],
    });

    const pmt = await Payments.record({
      invoiceId: inv.invoiceId,
      method: 'cash',
      amountPaise: 56000,
    });

    const finalAuditCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditLog);

    expect(Number(finalAuditCount[0].count)).toBeGreaterThan(Number(initialAuditCount[0].count));
  });

  // Finance: Invoices, PDF, Business Clients, Receivables aging, Summary, and CSV export
  it('Finance: Invoices, PDF, Business Clients, Receivables, Summary, and CSV export', async () => {
    if (!dbOnline) return;

    // 1. Business client CRUD
    const client = await Finance.createBusinessClient({
      name: `Corp Acme ${randomUUID().slice(0, 6)}`,
      contactName: 'Alice Manager',
      phone: '+919876543210',
      email: 'corp@acme.com',
      creditDays: 30,
    });
    expect(client.id).toBeDefined();

    const clientFetched = await Finance.getBusinessClient(client.id);
    expect(clientFetched.name).toBe(client.name);

    await Finance.updateBusinessClient(client.id, { contactName: 'Alice Director' });
    const clientUpdated = await Finance.getBusinessClient(client.id);
    expect(clientUpdated.contactName).toBe('Alice Director');

    // 2. Invoice creation for business client
    const inv = await Invoices.create({
      customer: { businessClientId: client.id },
      lines: [
        {
          source: 'corporate',
          description: 'Annual Court Sponsorship',
          qty: 1,
          unitPricePaise: 20000000, // ₹2,00,000.00
          taxCategory: 'standard', // 18% -> CGST 9%, SGST 9%
          refType: 'contract',
          refId: client.id,
        },
      ],
      dueOn: new Date('2026-10-01'), // Overdue for aging bucket test
    });
    expect(inv.invoiceId).toBeDefined();
    expect(inv.totalPaise).toBe(23600000); // 200000 + 18% = 236000

    // 3. Invoice detail and PDF HTML
    const detail = await Invoices.getInvoice(inv.invoiceId);
    expect(detail.id).toBe(inv.invoiceId);
    expect(detail.lines).toHaveLength(1);
    expect(detail.balanceStatus).toBe('unpaid');
    expect(detail.outstandingPaise).toBe(23600000);

    const pdfHtml = await Invoices.renderInvoicePdfHtml(inv.invoiceId);
    expect(pdfHtml).toContain('TAX INVOICE');
    expect(pdfHtml).toContain(detail.number);
    expect(pdfHtml).toContain('Annual Court Sponsorship');

    // 4. Receivables aging
    const receivables = await Finance.getReceivables();
    expect(receivables.totalOutstandingPaise).toBeGreaterThanOrEqual(23600000);
    expect(receivables.clients.some((c) => c.clientName.includes('Corp Acme'))).toBe(true);

    // 5. Partial payment
    const payment = await Payments.record({
      invoiceId: inv.invoiceId,
      method: 'online',
      amountPaise: 10000000,
    });
    expect(payment.status).toBe('partial');
    expect(payment.outstandingPaise).toBe(13600000);

    // 6. Expenses CRUD and decision
    const exp = await Expenses.createExpense({
      category: 'maintenance',
      description: 'Court Net Replacement',
      amountPaise: 500000,
      incurredOn: '2026-11-20',
    });
    expect(exp.status).toBe('submitted');

    const approvedExp = await Expenses.decideExpense(exp.id, true);
    expect(approvedExp.status).toBe('approved');

    // 7. Finance summary
    const summary = await Finance.getSummary({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(summary.charged).toBeGreaterThan(0);
    expect(summary.collected).toBeGreaterThan(0);
    expect(summary.bySource.length).toBeGreaterThan(0);
    expect(summary.byMethod.length).toBeGreaterThan(0);

    // 8. CSV export
    const exportData = await Finance.exportCsv('2026-01-01', '2026-12-31');
    expect(exportData.filename).toContain('finance-export');
    expect(exportData.csv).toContain('Invoice Number,Issued At');
  });

  // HR: Employee lifecycle, auto leave balance, inclusive days, payroll idempotency
  it('HR: Employee creation auto-allocates leave, calculates inclusive days, and runs payroll idempotently', async () => {
    if (!dbOnline) return;

    // 1. Employee creation
    const emp = await Hr.createEmployee({
      name: 'Rohan Verma',
      phone: '+919876500112',
      email: `rohan.${randomUUID().slice(0, 6)}@championsclub.in`,
      roleTitle: 'Fitness Trainer',
      joinedOn: '2026-01-01',
      active: true,
    });
    expect(emp.id).toBeDefined();

    // 2. Auto-allocated leave balances for current year
    const balances = await Hr.getLeaveBalances(emp.id);
    expect(balances.length).toBeGreaterThanOrEqual(1);
    const cl = balances.find((b) => b.leaveTypeCode === 'CL');
    expect(cl).toBeDefined();
    expect(cl!.allotted).toBeGreaterThan(0);
    expect(cl!.used).toBe(0);
    expect(cl!.remaining).toBe(cl!.allotted);

    // 3. Work shift CRUD
    const shift = await Hr.createWorkShift({
      employeeId: emp.id,
      startsAt: '2026-12-01T09:00:00Z',
      endsAt: '2026-12-01T17:00:00Z',
      area: 'courts',
    });
    expect(shift.id).toBeDefined();
    expect(shift.area).toBe('courts');

    const updatedShift = await Hr.updateWorkShift(shift.id, { area: 'front_desk' });
    expect(updatedShift.area).toBe('front_desk');

    // 4. Salary component CRUD
    const basicComp = await Hr.createSalaryComponent({
      employeeId: emp.id,
      name: 'Basic Pay',
      kind: 'earning',
      amountPaise: 4000000, // ₹40,000.00
    });
    const pfComp = await Hr.createSalaryComponent({
      employeeId: emp.id,
      name: 'PF Deduction',
      kind: 'deduction',
      amountPaise: 400000, // ₹4,000.00
    });
    expect(basicComp.id).toBeDefined();
    expect(pfComp.id).toBeDefined();

    // 5. Inclusive calendar days leave request calculation
    // 2026-12-10 to 2026-12-12 inclusive = 3 days
    const leaveReq = await Hr.createLeaveRequest({
      employeeId: emp.id,
      leaveTypeId: cl!.leaveTypeId,
      fromOn: '2026-12-10',
      toOn: '2026-12-12',
      // days omitted: auto-computed to 3 inclusive days
    });
    expect(leaveReq.days).toBe(3);
    expect(leaveReq.status).toBe('pending');

    // Rejecting if days > remaining
    await expect(
      Hr.createLeaveRequest({
        employeeId: emp.id,
        leaveTypeId: cl!.leaveTypeId,
        fromOn: '2026-12-01',
        toOn: '2026-12-01',
        days: cl!.remaining + 10,
      })
    ).rejects.toThrow();

    // Approve leave request: increments used, sends notification
    const decidedLeave = await Hr.decideLeaveRequest(leaveReq.id, true, 'Approved by HR');
    expect(decidedLeave.status).toBe('approved');

    const updatedBalances = await Hr.getLeaveBalances(emp.id);
    const updatedCl = updatedBalances.find((b) => b.leaveTypeCode === 'CL')!;
    expect(updatedCl.used).toBe(3);
    expect(updatedCl.remaining).toBe(cl!.allotted - 3);

    // 6. Payroll run (idempotent per month)
    const payrollRun1 = await Hr.runPayroll('2026-11');
    expect(payrollRun1.monthOn).toBe('2026-11-01');
    expect(payrollRun1.payslips.length).toBeGreaterThan(0);

    const empSlip = payrollRun1.payslips.find((p) => p.employeeId === emp.id);
    expect(empSlip).toBeDefined();
    expect(empSlip!.grossPaise).toBe(4000000);
    expect(empSlip!.deductionsPaise).toBe(400000);
    expect(empSlip!.netPaise).toBe(3600000);

    // Second run for same month must be idempotent (0 new slips created, returns existing)
    const payrollRun2 = await Hr.runPayroll('2026-11');
    expect(payrollRun2.payslipsCreated).toBe(0);
    expect(payrollRun2.totalNetPaise).toBe(payrollRun1.totalNetPaise);

    // 7. Get payslips
    const slips = await Hr.listPayslips({ monthOn: '2026-11', employeeId: emp.id });
    expect(slips).toHaveLength(1);
    expect(slips[0].netPaise).toBe(3600000);
  });
});
