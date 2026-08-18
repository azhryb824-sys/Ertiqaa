const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = require(path.join(root, 'src/finance/accounting-core.js'));

test('journal validation rejects malformed and unbalanced postings', () => {
  assert.equal(core.journalValidation({ lines: [
    { account: '1100', side: 'debit', amount: 100 },
    { account: '4100', side: 'credit', amount: 90 },
  ] }).ok, false);
  assert.equal(core.journalValidation({ lines: [
    { account: '1100', side: 'debit', amount: 100 },
    { account: '4100', side: 'credit', amount: 100 },
  ] }).ok, true);
});

test('invoice validation prevents overpayment and paid-total drift', () => {
  const invalid = core.invoiceValidation({ total: 100, paid: 80, payments: [{ amount: 60 }] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes('paid-mismatch'));
  assert.equal(core.invoiceValidation({ total: 100, paid: 110, payments: [] }).ok, false);
});

test('custody validation preserves value equals deducted plus remaining', () => {
  assert.equal(core.custodyValidation({ value: 1000, deducted: 300, remaining: 700 }).ok, true);
  assert.equal(core.custodyValidation({ value: 1000, deducted: 300, remaining: 800 }).ok, false);
});

test('closed accounting periods reject backdated mutations', () => {
  const periods = [{ companyOwnerId: 'C1', from: '2026-01-01', to: '2026-01-31', status: 'closed' }];
  assert.equal(core.periodClosed('2026-01-15', periods, 'C1'), true);
  assert.equal(core.periodClosed('2026-02-01', periods, 'C1'), false);
  assert.equal(core.periodClosed('2026-01-15', periods, 'C2'), false);
});

test('reversals are auditable and failure never reports a successful void', () => {
  assert.match(app, /function voidSourceOrFail/);
  assert.match(app, /reversalOf:target\.id/);
  assert.match(app, /voidReason=reason/);
  assert.match(app, /voided\.push\(target\)/);
  assert.match(app, /accounting reversal failed/);
  assert.doesNotMatch(app, /targets\.forEach[\s\S]{0,1600}return targets\}/);
});

test('all key financial edits are blocked inside closed periods', () => {
  for (const form of ['finance-payment-edit', 'finance-receipt-edit', 'purchase-invoice-edit', 'contract-expense', 'staff-entry-edit', 'staff-voucher-edit', 'edit-staff-purchase', 'nested-payment-edit', 'finance-correction']) {
    assert.ok(app.includes(`"${form}"`) || app.includes(`'${form}'`), `missing mutation guard for ${form}`);
  }
  assert.match(app, /guardAccountingMutation\(records,"تعديل السجل"\)/);
  assert.match(app, /accountingPeriodClosed\(newDate\)/);
});

test('deletes and payment edits require a completed reversal before changing source data', () => {
  assert.match(app, /if\(!voidSourceOrFail\("contract-payment"/);
  assert.match(app, /if\(!voidSourceOrFail\("receipt"/);
  assert.match(app, /if\(!voidSourceOrFail\("staff-voucher"/);
  assert.match(app, /if\(!voidSourceOrFail\(refType,oldRef/);
  assert.match(app, /تعذر إنشاء قيد عكس/);
});

test('integrity scan covers invoices, custodies, payrolls, orphan journals and balance sheet', () => {
  for (const field of ['invalidCustomerInvoices', 'invalidSupplierInvoices', 'invalidCustodies', 'invalidPayrolls', 'orphanJournals', 'balanceSheetBalanced']) {
    assert.ok(app.includes(field), `missing integrity field ${field}`);
  }
});

test('period close and reopen actions are stored in the immutable audit trail', () => {
  assert.match(app, /data-accounting-period-close/);
  assert.match(app, /data-accounting-period-open/);
  assert.match(app, /action:"period-close"/);
  assert.match(app, /action:"period-open"/);
  assert.match(app, /misadAccountingPeriods/);
});
