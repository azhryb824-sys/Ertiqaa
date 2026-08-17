const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

test('applying a financial period keeps the current list visible', () => {
  const start = app.indexOf('function syncFinancialListRangeUi');
  const end = app.indexOf('const financeCategoryConfigs', start);
  const rangeCode = app.slice(start, end);
  assert.match(rangeCode, /syncFinancialListRangeUi\(\)/);
  assert.doesNotMatch(rangeCode, /render\("finance"\)/);
  assert.match(rangeCode, /financeTab=section\.dataset\.financeSection/);
  assert.match(rangeCode, /financialListData\(button\.dataset\.pdfId\)/);
  assert.match(rangeCode, /applyFinancialRangeToVisibleSection/);
  assert.match(app, /row\.style\.display=visible/);
  assert.match(app, /المعروض في الفترة/);
});

test('invoice payment edits cannot exceed invoice total and rollback on posting failure', () => {
  assert.match(app, /nextTotal>Number\(invoice\.total\|\|0\)\+0\.005/);
  assert.match(app, /لا يمكن أن يتجاوز مجموع الدفعات إجمالي الفاتورة/);
  assert.match(app, /تعذر إعادة ترحيل الدفعة؛ لم تُغيّر البيانات/);
  assert.match(app, /maxAmount=Math\.max\(0,Number\(invoice\.total\|\|0\)-otherPaid\)/);
});

test('payroll edits recalculate gross and net, preserve custody settlement and require balanced posting', () => {
  assert.match(app, /candidate\.totalGross=.*reduce/);
  assert.match(app, /candidate\.totalCustodyDeducted=.*reduce/);
  assert.match(app, /candidate\.totalNet=.*reduce/);
  assert.match(app, /original\.rows\?\.\[i\]\?\.custodyDeduction/);
  assert.match(app, /المسير غير متوازن ولا يمكن حفظه/);
  assert.match(app, /تعذر إعادة ترحيل المسير؛ لم تتغير بياناته/);
});

test('current assets are cache busted', () => {
  assert.match(dashboard, /app\.js\?v=20260817-auto-visit-assignment-1/);
  assert.match(dashboard, /pdfmake-gen\.js\?v=20260817-[a-z0-9-]+/);
});
