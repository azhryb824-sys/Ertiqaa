const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(app, /function ensureReceiptSeparation\(\)/,
  'يجب ترحيل سندات القبض القديمة خارج مخزن المستخلصات');
assert.match(app, /write\('misadReceipts',receipts\);write\('misadClaims',claims\.filter/,
  'يجب حفظ السندات في مخزنها وإزالة السجلات المصنفة خطأ فقط من المستخلصات');
assert.doesNotMatch(app, /const claims=read\('misadClaims'\);if\(!claims\.some\(x=>x\.receiptEntryId/,
  'لا يجوز إنشاء سند قبض جديد داخل مخزن المستخلصات');
assert.match(app, /const receiptRows=read\('misadReceipts'\)\|\|\[\];if\(!receiptRows\.some\(x=>x\.receiptEntryId===entry\.id\)/,
  'دفعة العقد يجب أن تنشئ سند القبض في مخزن السندات');
assert.match(app, /function enhanceReceiptButtons\(\).*read\('misadReceipts'\).*data-pdf-doc="receipt"/,
  'زر سند القبض يجب أن يقرأ السند الصحيح ويستخدم قالب PDF الصحيح');
assert.doesNotMatch(app, /receiptClaims=read\('misadClaims'\)/,
  'سجل دفعات العقد لا يجوز أن يبحث عن السندات ضمن المستخلصات');
assert.match(app, /accountingFor\("receipt",rc\.id\)\|\|rc\.receiptEntryId&&accountingFor\("contract-payment",rc\.receiptEntryId\)/,
  'ترحيل السندات القديمة يجب ألا يكرر القيد المحاسبي للدفعة');

console.log('Finance receipt/claim separation tests passed.');
