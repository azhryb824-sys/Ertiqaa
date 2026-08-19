const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /name="oldContractEndDate" required/, 'العقد القديم يطلب تاريخ النهاية الفعلي');
assert.match(app, /function oldContractDuration\(start,end\)/, 'تُحسب مدة العقد القديم من تاريخي البداية والنهاية');
assert.match(app, /row\.contractDurationDays=duration\.days/, 'تُحفظ المدة المحتسبة ضمن بيانات العقد');
assert.match(app, /tabs\.style\.display=old\?'none':''/, 'تختفي تبويبات تفاصيل المصعد في وضع العقد القديم');
assert.match(app, /panel\.style\.display=old\?\(index===0\?'':'none'\):''/, 'تبقى لوحة البيانات الأساسية فقط ظاهرة');

console.log('old contract duration regressions: ok');
