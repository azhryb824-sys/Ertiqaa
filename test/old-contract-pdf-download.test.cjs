const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /function downloadOldContractAttachment\(contract\)/, 'يوجد مسار لتنزيل مرفق العقد القديم');
assert.match(app, /link\.href=contract\.oldContractFile/, 'يستخدم التنزيل ملف العقد المرفق');
assert.match(app, /link\.download=contract\.oldContractFileName/, 'يحافظ التنزيل على اسم الملف المرفق');
assert.match(app, /pdf\.dataset\.pdfDoc==="contract"&&pdf\.dataset\.pdfClean!=="true"/, 'زر PDF وزر مطبوعات الشركة يعيدان المرفق');
assert.match(app, /if\(downloadOldContractAttachment\(oldContract\)\)/, 'لا يُنشأ PDF بديل عند وجود المرفق');

console.log('old contract attachment download regressions: ok');
