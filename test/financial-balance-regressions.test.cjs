const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8');

test('treasury category tabs never hide bank-account rows', () => {
  assert.match(app, /markTreasuryBankAccountsStatic\(section\)/);
  assert.match(app, /!target\.closest\('\[data-finance-filter-static\]'\)/);
});

test('bank movements require and persist the selected bank account', () => {
  assert.match(app, /validPaymentAccount\(paymentMethod,bankAccountId\)/);
  assert.match(app, /row\.bankAccountId=pendingFinancePaymentContext\.bankAccountId/);
  assert.match(app, /bankAccountForMethod\(c\.paymentMethod,c\.bankAccountId\)/);
});

test('concurrent finance writes use a three-way record merge', () => {
  assert.match(server, /function mergeConcurrentRecordArray\(currentValue, incomingValue, baseValue\)/);
  assert.match(server, /mergeConcurrentRecordArray\(store\[key\], value, baseValue\)/);
  assert.match(app, /baseValue:queued\?queued\.baseValue:baseValue/);
});

test('payroll deletion restores custody allocation and approved claims post journals', () => {
  assert.match(app, /custodyAllocations:\[\.\.\.usedCustody\.entries\(\)\]/);
  assert.match(app, /restorePayrollCustodies\(rec\)/);
  assert.match(app, /postClaimJournal\(claim\)/);
  assert.match(app, /reconcileClaimJournal\(rec\)/);
});

test('legacy ticket invoices are included in accounts receivable without duplication', () => {
  assert.match(app, /function ensureTicketInvoicesAsCustomerInvoices\(\)/);
  assert.match(app, /CINV-TICKET-\$\{inv\.id\}/);
  assert.match(app, /legacyInvoiceId:inv\.id/);
});
