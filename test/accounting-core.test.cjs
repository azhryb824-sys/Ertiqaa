const assert = require('node:assert/strict');
const accounting = require('../src/finance/accounting-core.js');

const invoice = {total: 1000, paid: 400, payments: [{amount: 400}]};
assert.deepEqual(accounting.customerInvoiceInfo(invoice), {
  paid: 400,
  total: 1000,
  due: 600,
  status: 'جزئية',
});
assert.equal(accounting.customerInvoiceInfo({total: 1000, paid: 250}).paid, 250);
assert.deepEqual(accounting.customerInvoiceInfo({total: 1000, paid: 250, status: 'ملغاة'}), {
  paid: 250,
  total: 1000,
  due: 0,
  status: 'ملغاة',
}, 'الفاتورة الملغاة لا تبقى ضمن الذمم المستحقة');

const state = accounting.treasuryState([
  {type: 'opening', account: 'cash', amount: 50, createdAtMs: 1},
  {type: 'transfer', from: 'cash', to: 'BANK-1', amount: 100, createdAtMs: 2},
], [{id: 'BANK-1'}]);
assert.equal(state.cash, -50);
assert.equal(state.banks[0].balance, 100);
assert.equal(state.total, 50, 'التحويل لا ينشئ أو يهدر نقداً');
assert.equal(accounting.validateTreasuryMove(
  accounting.treasuryState([{type: 'opening', account: 'cash', amount: 50}], [{id: 'BANK-1'}]),
  {type: 'transfer', from: 'cash', to: 'BANK-1', amount: 100},
).error, 'insufficient');

assert.equal(accounting.payrollBalanced({totalGross: 5200, totalCustodyDeducted: 200, totalNet: 5000}), true);
assert.equal(accounting.payrollBalanced({totalGross: 5200, totalCustodyDeducted: 200, totalNet: 5100}), false);

const journal = [
  {companyOwnerId: 'CO-1', date: '2026-01-01', lines: [
    {account: '1100', accountName: 'الصندوق', side: 'debit', amount: 1000},
    {account: '3100', accountName: 'رأس المال', side: 'credit', amount: 1000},
  ]},
  {companyOwnerId: 'CO-1', date: '2026-02-01', lines: [
    {account: '1100', accountName: 'الصندوق', side: 'debit', amount: 600},
    {account: '4100', accountName: 'إيرادات صيانة', side: 'credit', amount: 600},
  ]},
  {companyOwnerId: 'CO-1', date: '2026-02-02', lines: [
    {account: '5100', accountName: 'رواتب', side: 'debit', amount: 200},
    {account: '1100', accountName: 'الصندوق', side: 'credit', amount: 200},
  ]},
  {companyOwnerId: 'CO-2', date: '2026-02-02', lines: [
    {account: '1100', side: 'debit', amount: 999},
    {account: '3100', side: 'credit', amount: 999},
  ]},
];
const periodBalances = accounting.journalBalances(journal, {companyOwnerId: 'CO-1', from: '2026-02-01', to: '2026-02-28'});
const income = accounting.incomeStatement(periodBalances);
assert.equal(income.totalRevenue, 600, 'الإيراد رصيد دائن ولا يستخدم القيمة المطلقة');
assert.equal(income.totalExpenses, 200, 'المصروف رصيد مدين ولا يستخدم القيمة المطلقة');
assert.equal(income.netIncome, 400);
const asOfBalances = accounting.journalBalances(journal, {companyOwnerId: 'CO-1', to: '2026-02-28'});
const balanceSheet = accounting.balanceSheet(asOfBalances);
assert.equal(balanceSheet.totalAssets, 1400);
assert.equal(balanceSheet.totalLiabilities, 0);
assert.equal(balanceSheet.recordedEquity, 1000);
assert.equal(balanceSheet.currentEarnings, 400);
assert.equal(balanceSheet.totalEquity, 1400);
assert.equal(balanceSheet.balanced, true, 'الميزانية تشمل نتيجة الفترة ضمن حقوق الملكية');

const reversed = accounting.journalBalances([
  {
    companyOwnerId: 'CO-1',
    date: '2026-03-01',
    voidedAt: '2026-03-02T00:00:00Z',
    reversalJournalId: 'REV-1',
    lines: [
      {account: '1100', side: 'debit', amount: 250},
      {account: '4400', side: 'credit', amount: 250},
    ],
  },
  {
    companyOwnerId: 'CO-1',
    date: '2026-03-02',
    refType: 'reversal',
    lines: [
      {account: '1100', side: 'credit', amount: 250},
      {account: '4400', side: 'debit', amount: 250},
    ],
  },
], {companyOwnerId: 'CO-1'});
assert.equal(reversed.find((row) => row.account === '1100').balance, 0, 'الأصل وقيد العكس يبقيان معاً في الأستاذ');
assert.equal(accounting.incomeStatement(reversed).netIncome, 0, 'قيد العكس يصفر أثر الإيراد الملغى');

const cash = accounting.cashSummary([
  {type: 'purchase', direction: 'out', amount: 500, status: 'مستحق'},
  {type: 'purchase', direction: 'out', amount: 200, status: 'مدفوع'},
  {type: 'sale', direction: 'in', amount: 300, status: 'معتمد'},
  {type: 'allowance', direction: 'out', amount: 50, status: 'معتمد'},
  {type: 'purchase', direction: 'out', amount: 700, status: 'ملغى'},
  {type: 'sale', direction: 'in', amount: 800, status: 'canceled'},
]);
assert.equal(cash.received, 300);
assert.equal(cash.paid, 200, 'الفاتورة المستحقة والبدل لا يعاملان كتدفق نقدي');
assert.equal(cash.net, 100);

console.log('accounting-core tests passed');
