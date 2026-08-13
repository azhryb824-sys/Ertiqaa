const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(app, /function rescheduleActiveContractVisitsAfterTechnicianAdded\(member\)/,
  'يجب وجود معالج مركزي لإعادة جدولة الزيارات بعد إضافة فني');
assert.match(app, /c\.type==="صيانة"&&c\.status==="ساري"/,
  'يجب أن تقتصر إعادة الجدولة على عقود الصيانة السارية');
assert.match(app, /protectedStatuses=new Set\(\["مكتملة","ملغية","بانتظار الاعتماد"\]\)/,
  'يجب حماية الزيارات المنتهية والملغاة وقيد الاعتماد');
assert.match(app, /!v\.reportId/,
  'يجب عدم تغيير زيارة مرتبطة بتقرير');
assert.match(app, /rescheduleReason="technician-added"/,
  'يجب تسجيل سبب إعادة الجدولة للمراجعة');
assert.match(app, /role==="technician"\?rescheduleActiveContractVisitsAfterTechnicianAdded\(member\):0/,
  'يجب تشغيل إعادة الجدولة عند إضافة الموظف كفني فقط');

assert.match(app, /data-pdf-doc="visits-monthly"/,
  'يجب إتاحة تنزيل جدول الزيارات الشهرية PDF');
for (const heading of ['الطرف الثاني', 'اسم المبنى', 'الحي', 'الفني', 'الموعد', 'حالة الزيارة']) {
  assert.ok(app.includes(`<th>${heading}</th>`), `يجب أن يحتوي PDF على عمود ${heading}`);
}
assert.match(app, /building\.district\|\|"غير محدد"/,
  'يجب عرض اسم الحي في صفوف الجدول');

assert.match(app, /function correctVisitStatus\(v\)/,
  'يجب وجود معالج موحد لاشتقاق حالة كل زيارة');
assert.match(app, /if\(cancelled\)return "ملغية"/,
  'يجب إعطاء الإلغاء الأولوية على بقية الحالات');
assert.match(app, /if\(v\?\.rating\|\|v\?\.completedAt\|\|raw==="مكتملة"\)return "مكتملة"/,
  'يجب تمييز الزيارات المكتملة');
assert.match(app, /return "بانتظار التقييم"/,
  'يجب تمييز الزيارة المعتمدة التي تنتظر تقييم العميل');
assert.match(app, /return "بانتظار الاعتماد"/,
  'يجب تمييز الزيارة ذات التقرير الذي ينتظر اعتماد العميل');
assert.match(app, /return "بانتظار الإسناد"/,
  'يجب تمييز الزيارة غير المسندة لفني');
assert.match(app, /if\(scheduled<now\)return "متأخرة"/,
  'يجب تحويل الزيارة التي مضى موعدها إلى متأخرة');
assert.match(app, /return "بانتظار تحديد الموعد"/,
  'يجب وضع حالة مناسبة للزيارة التي ليس لها موعد صحيح');
assert.match(app, /normalizeVisitStatuses\(\);const allV=visibleVisits\(\)/,
  'يجب تصحيح الحالات قبل عرض صفحة الزيارات');

console.log('Visit scheduling and monthly PDF tests passed.');
