const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /function ensureContractStatusField\(form\)/, 'يوجد مسار ثابت لإضافة حقل حالة العقد');
assert.match(app, /\["contract","contract-edit"\]\.includes\(form\.dataset\.form\)/, 'الحقل يظهر في الإنشاء والتعديل');
assert.match(app, /عقد قديم - موافقة العميل<select name="contractStatus">/, 'عنوان الحقل مطابق للمطلوب');
assert.match(app, /<option value="بانتظار موافقة العميل"/, 'خيار موافقة العميل موجود');
assert.match(app, /<option value="قديم"/, 'خيار العقد القديم موجود');
assert.match(app, /isOld=!!current\?\.oldContractFile/, 'العقد المرفق يظهر كعقد قديم في صفحة التعديل');
assert.doesNotMatch(app.match(/function ensureContractStatusField\(form\)[\s\S]*?\n  function modal/)?.[0] || '', /type.*تركيب/, 'الحقل غير مقيد بعقد التركيب');

console.log('maintenance contract status field: ok');
