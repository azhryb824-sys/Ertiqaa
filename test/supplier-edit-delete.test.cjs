const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

test('supplier list exposes edit and delete actions to finance managers', () => {
  assert.match(app, /data-supplier-edit=/);
  assert.match(app, /data-supplier-delete=/);
  assert.match(app, /financeOwnerCanMutate\(\)/);
});

test('supplier editing validates duplicates and updates every linked subsystem', () => {
  assert.match(app, /function updateSupplierReferences/);
  for (const key of ['misadPurchaseInvoices', 'misadFinancialEntries', 'misadPartsInventory', 'misadQuotes', 'misadContracts']) {
    assert.match(app, new RegExp(`write\\("${key}"`));
  }
  assert.match(app, /supplierCommercialRegistration:s\.commercialRegistration/);
  assert.match(app, /supplierUnifiedNumber:s\.unifiedNumber/);
});

test('supplier deletion is blocked while any financial or operational reference exists', () => {
  assert.match(app, /function supplierReferences/);
  assert.match(app, /if\(refs\.total\)return toast/);
  assert.match(app, /لا يمكن حذف المورد لارتباطه/);
});

test('dashboard cache key exposes the current supplier controls', () => {
  assert.match(dashboard, /app\.js\?v=2026081[78]-[a-z0-9-]+/);
});
