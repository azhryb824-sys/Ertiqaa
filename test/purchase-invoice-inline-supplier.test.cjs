const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

test('purchase invoice can select an existing supplier or register a new supplier inline', () => {
  assert.match(app, /name="supplierMode" data-supplier-mode/);
  assert.match(app, /value="new">مورد غير مسجل/);
  assert.match(app, /data-new-supplier-fields/);
  assert.match(app, /supplierDataFromForm\(d,"newSupplier"\)/);
  assert.match(app, /source:"purchase-invoice"/);
});

test('supplier fields are shared with the supplier page and professionally validated', () => {
  for (const field of ['ContactPerson', 'AlternatePhone', 'CommercialRegistration', 'UnifiedNumber', 'PaymentTerms', 'BankName', 'Iban']) {
    assert.ok(app.includes(field), `missing supplier field ${field}`);
  }
  assert.match(app, /function supplierFieldsHTML/);
  assert.match(app, /function validateSupplierData/);
  assert.match(app, /المورد مسجل مسبقاً/);
  assert.match(app, /\^SA\\d\{22\}\$/);
});

test('new supplier identity is preserved across invoices, finance entries and PDFs', () => {
  assert.match(app, /supplierName:supplier\.name/);
  assert.match(app, /supplierCommercialRegistration/);
  assert.match(app, /supplierName:supplier\.name,status:"مستحق"/);
  assert.match(pdf, /pi\.supplierName/);
  assert.match(pdf, /supplier\.commercialRegistration/);
  assert.match(pdf, /supplier\.contactPerson/);
});

test('cache busting exposes the current workflow', () => {
  assert.match(dashboard, /app\.js\?v=20260817-[a-z0-9-]+/);
  assert.match(dashboard, /pdfmake-gen\.js\?v=20260817-[a-z0-9-]+/);
});
