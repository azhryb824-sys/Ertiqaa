const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('all employee-finance groups expose edit and delete actions', () => {
  assert.match(app, /data-staff-entry-edit/);
  assert.match(app, /data-staff-entry-delete/);
  assert.match(app, /data-fin-record-edit=\"payroll:/);
  assert.match(app, /data-fin-record-delete=\"payroll:/);
  assert.match(app, /data-fin-record-edit=\"custody:/);
  assert.match(app, /data-fin-record-delete=\"custody:/);
  assert.match(app, /data-staff-voucher-edit/);
  assert.match(app, /data-staff-voucher-delete/);
  assert.match(app, /data-staff-purchase-delete/);
});

test('employee mutations reverse and repost every cash or bank journal source', () => {
  assert.match(app, /removeJournalForSource\("staff-advance",entry\.id\)/);
  assert.match(app, /removeJournalForSource\('custody-recovery',entry\.id\)/);
  assert.match(app, /removeJournalForSource\("payroll-payment",candidate\.id\)/);
  assert.match(app, /removeJournalForSource\("payroll",candidate\.id\)/);
  assert.match(app, /removeJournalForSource\("staff-voucher",id\)/);
  assert.match(app, /recalculatePayrollFromStaffEntries/);
});

test('payroll accrual always uses salary payable and paid payroll has a separate payment journal', () => {
  const payrollPoster = app.match(/function postPayrollJournal\(p\)\{[^\n]+/)[0];
  assert.match(payrollPoster, /account:"2200",side:"credit"/);
  assert.doesNotMatch(payrollPoster, /paid\?bankAccountForMethod/);
  assert.match(payrollPoster, /postPayrollPaymentJournal\(p\)/);
});

test('deleting payroll restores custody and deleting custody purges legacy unified entries', () => {
  assert.match(app, /restorePayrollCustodies/);
  assert.match(app, /custodyUsedByPayroll/);
  assert.match(app, /x\.id===`FIN-\$\{stamp\}-C`/);
  assert.match(app, /x\.custodyId===id/);
});

test('paid employee expense edits update voucher, unified entry, and journal', () => {
  assert.match(app, /form\.dataset\.form!==['"]edit-staff-purchase['"]/);
  assert.match(app, /invoice\.voucherId/);
  assert.match(app, /postStaffVoucherJournal\(voucher\)/);
  assert.match(app, /financialEntries\.find\(x=>x\.voucherId===voucher\.id\)/);
});
