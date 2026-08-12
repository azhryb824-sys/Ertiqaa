const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(app, /function activateContractAfterFirstPayment\(c,payment\)/,
  'يجب وجود معالج مركزي لتفعيل العقد بعد أول دفعة');
assert.match(app, /Number\(payment\?\.amount\)>0/,
  'يجب ألا يتفعّل العقد بقيمة صفرية أو سالبة');
assert.match(app, /payment\.direction!=="in"/,
  'يجب ألا يتفعّل العقد بقيد مالي صادر');
assert.match(app, /\["ساري","ملغي","محذوف","منتهيا","منتهي"\]/,
  'يجب حماية الحالات النهائية من إعادة التفعيل');
assert.match(app, /c\.status="ساري"/,
  'يجب تحويل حالة العقد إلى ساري');
assert.match(app, /c\.activationReason="first-payment"/,
  'يجب حفظ سبب التفعيل للمراجعة المالية');
assert.match(app, /c\.firstPaymentEntryId=String\(payment\.id\|\|""\)/,
  'يجب ربط التفعيل بالقيد المالي الأول');

const calls = app.match(/activateContractAfterFirstPayment\(c,(?:fin|entry)\)/g) || [];
assert.equal(calls.length, 3,
  'يجب تطبيق التفعيل في سند القبض وسداد الفاتورة وقيد دفعة العقد');
assert.doesNotMatch(app, /collected>=Number\(c\.value\|\|0\)/,
  'يجب ألا ينتظر النظام سداد كامل قيمة العقد لتفعيله');

console.log('Contract first-payment activation tests passed.');
