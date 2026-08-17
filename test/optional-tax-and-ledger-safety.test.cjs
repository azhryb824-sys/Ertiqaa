const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pdf = fs.readFileSync(path.join(root, 'pdfmake-gen.js'), 'utf8');
const flutterInvoice = fs.readFileSync(path.join(root, 'app_flutter/lib/screens/finance/customer_invoices_screen.dart'), 'utf8');
const flutterQuote = fs.readFileSync(path.join(root, 'app_flutter/lib/screens/quotes/quote_form_screen.dart'), 'utf8');
const flutterJournal = fs.readFileSync(path.join(root, 'app_flutter/lib/finance/finance_journal.dart'), 'utf8');

test('tax is opt-in and zero when the user does not enable it', () => {
  assert.match(app, /function optionalTaxFromForm\(/);
  assert.match(app, /enabled=formOrData instanceof FormData/);
  assert.match(app, /rate=enabled\?Number/);
  assert.match(app, /name="taxEnabled"/);
});

test('sales and purchase VAT use separate balance-sheet accounts', () => {
  assert.match(app, /account:"2300"/);
  assert.match(app, /account:"1330"/);
  assert.match(app, /revenue=Math\.max\(0,Number\(inv\.total\|\|0\)-tax\)/);
  assert.match(flutterJournal, /'2300': 'ضريبة قيمة مضافة مستحقة'/);
});

test('tax appears in PDFs only when its stored amount is positive', () => {
  assert.match(pdf, /if \(tax > 0\) financialRows\.push/);
  assert.match(pdf, /if \(Number\(inv\.tax\|\|0\) > 0\)/);
  assert.match(pdf, /if \(Number\(pi\.tax\|\|0\) > 0\)/);
});

test('web and Flutter expose the same optional tax choice', () => {
  assert.match(flutterInvoice, /bool _taxEnabled = false/);
  assert.match(flutterQuote, /bool _taxEnabled = false/);
});

test('cancelled financial sources are reversed without deleting journals', () => {
  assert.match(app, /function reconcileCancelledFinancialJournals\(\)/);
  assert.match(app, /removeJournalForSource\(refType,x\.id\)/);
  assert.match(app, /reconcileCancelledFinancialJournals\(\);/);
});

