const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

test('financial report tabs use explicit categories instead of Arabic row text alone', () => {
  assert.match(app, /dataset\.reportCategory/);
  assert.match(app, /data-report-category=/);
  assert.match(app, /prepareFinancialReportCategories/);
  assert.match(app, /category=.*suppliers.*invoices.*contracts/s);
});

test('all owner financial lists support range totals and separate or bundled PDF', () => {
  for (const kind of ['purchase-invoices', 'sales-invoices', 'expenses', 'receipts', 'claims', 'payrolls', 'custodies', 'suppliers', 'contracts']) {
    assert.ok(app.includes(`"${kind}"`), `missing financial list: ${kind}`);
  }
  assert.match(app, /function financialRangeRows/);
  assert.match(app, /data-pdf-doc="financial-list"/);
  assert.match(app, /data-pdf-doc="financial-lists-bundle"/);
  assert.match(pdf, /function financialListPdfDefinition/);
  assert.match(pdf, /function financialListsBundlePdfDefinition/);
  assert.match(pdf, /type === 'financial-list'/);
  assert.match(pdf, /type === 'financial-lists-bundle'/);
});

test('financial list PDFs require stamp/signature and refreshed browser assets', () => {
  assert.match(pdf, /'financial-list': true/);
  assert.match(pdf, /'financial-lists-bundle': true/);
  assert.match(dashboard, /app\.js\?v=20260817-[a-z0-9-]+/);
  assert.match(dashboard, /pdfmake-gen\.js\?v=20260817-[a-z0-9-]+/);
});
