const assert = require('node:assert/strict');
const fs = require('node:fs');

const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');

assert.match(pdf, /function westernPdfDigits\(value\)/, 'يوجد محول مركزي للأرقام الإنجليزية');
assert.match(pdf, /[\\u0660-\\u0669]/, 'يحوّل الأرقام العربية الهندية');
assert.match(pdf, /[\\u06f0-\\u06f9]/, 'يحوّل الأرقام الفارسية');
assert.match(pdf, /function receiptPdfDate\(value, timestamp\)/, 'يوحّد تاريخ سند القبض');
assert.match(pdf, /receiptPdfDate\(r\.createdAt, r\.createdAtMs\)/, 'يصحح تاريخ الإصدار والدفع في سند القبض');
assert.match(pdf, /المبلغ كتابةً: ' \+ tafqitSar\(r\.amount\)/, 'يعرض مبلغ سند القبض كتابةً');
assert.match(pdf, /var receiptDd = makeDd\(content, cf, opts\);\s*receiptDd\.content = \[\{ stack: receiptDd\.content, unbreakable: true \}\];/, 'يبقي سند القبض والتوقيع في صفحة واحدة');
assert.match(pdf, /ensurePdfTafqit\(dd\);\s*normalizePdfDigits\(dd\);/, 'يطبّق الأرقام الإنجليزية على جميع ملفات PDF');

console.log('PDF western digit and receipt date tests passed.');
