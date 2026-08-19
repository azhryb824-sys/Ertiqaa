const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /Local storage cache is full; the server copy will still be saved/, 'امتلاء التخزين المحلي لا يمنع إرسال العقد إلى الخادم');
assert.match(app, /if\(v instanceof File\)continue/, 'لا تُحفظ كائنات الملفات التالفة داخل المسودة');
assert.match(app, /function restoreDraftIntoForm\(form,data\)/, 'يوجد مسار موحد لاستعادة المسودة');
assert.match(app, /data\.buildings\.map\(item=>buildingRow\(item\)\)/, 'تُستعاد جميع مباني العقد');
assert.match(app, /data\.maintenanceChecklist/, 'تُستعاد بنود الصيانة');
assert.match(app, /data\.customItems/, 'تُستعاد البنود المخصصة');
assert.match(app, /restoreDraftIntoForm\(form,d\.data\)/, 'زر الاستكمال يستخدم الاستعادة الكاملة');
assert.match(app, /name=\"oldContractEndDate\" required/, 'العقد القديم يطلب تاريخ النهاية الفعلي');
assert.match(app, /function oldContractDuration\(start,end\)/, 'تُحسب مدة العقد القديم من تاريخي البداية والنهاية');
assert.match(app, /row\.contractDurationDays=duration\.days/, 'تُحفظ المدة المحتسبة ضمن بيانات العقد');
assert.match(app, /tabs\.style\.display=old\?'none':''/, 'تختفي تبويبات تفاصيل المصعد في وضع العقد القديم');

console.log('contract draft and old attachment regressions: ok');
