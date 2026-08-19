const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /function ensureContractStatusField\(form\)/, 'يوجد مسار ثابت لإضافة حقل حالة العقد');
assert.match(app, /عقد قديم - موافقة العميل<select name="contractStatus">/, 'عنوان الحقل مطابق للمطلوب');
assert.match(app, /<option value="بانتظار موافقة العميل">موافقة العميل<\/option>/, 'خيار موافقة العميل موجود');
assert.match(app, /<option value="قديم">عقد قديم<\/option>/, 'خيار العقد القديم موجود');
assert.doesNotMatch(app.match(/function ensureContractStatusField\(form\)[\s\S]*?\n  function modal/)?.[0] || '', /type.*تركيب/, 'الحقل غير مقيد بعقد التركيب');

console.log('maintenance contract status field: ok');
