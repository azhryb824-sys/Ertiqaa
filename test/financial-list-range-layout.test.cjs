const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

test('every downloadable finance list exposes an explicit date range', () => {
  assert.match(app, /function financialListRangeHTML/);
  assert.match(app, /data-list-range-from/);
  assert.match(app, /data-list-range-to/);
  assert.match(app, /data-fin-list-apply/);
  assert.match(app, /financialListRangeHTML\(kind\)/);
  assert.match(app, /financialListRangeHTML\("bundle"\)/);
  assert.match(app, /تاريخ البداية يجب أن يسبق تاريخ النهاية/);
});

test('range remains attached to the active finance list and reaches list data', () => {
  assert.match(app, /financeTab=section\.dataset\.financeSection/);
  assert.match(app, /nextFrom=range\?\.querySelector/);
  assert.match(app, /function financialRangeRows/);
  assert.match(app, /financialRangeRows\(\(read\("misadPurchaseInvoices"\)/);
});

test('all separate and bundled financial PDFs use safe landscape table widths', () => {
  assert.match(pdf, /function financialListColumnWidths/);
  assert.match(pdf, /available=620/);
  assert.match(pdf, /pageOrientation='landscape'/);
  assert.match(pdf, /fontSize=cols\.length>=8\?6\.2/);
  assert.match(pdf, /dontBreakRows:true/);
  assert.match(pdf, /financialListTableLayout/);
  assert.match(pdf, /financialLandscapeChrome/);
});

test('period is always printed and refreshed assets bypass stale layout', () => {
  assert.match(pdf, /الفترة: من/);
  assert.match(dashboard, /app\.js\?v=20260817-[a-z0-9-]+/);
  assert.match(dashboard, /pdfmake-gen\.js\?v=20260817-[a-z0-9-]+/);
});
