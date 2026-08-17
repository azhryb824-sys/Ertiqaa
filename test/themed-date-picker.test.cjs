const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'themed-date-picker.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');

assert.match(js,/input\[type="date"\],input\[type="month"\]/,'يجب تحسين حقول التاريخ والشهر في جميع أجزاء النظام');
assert.match(js,/new MutationObserver/,'يجب تحسين حقول التاريخ المضافة داخل النوافذ والنماذج الديناميكية');
assert.match(js,/dispatchEvent\(new Event\('change'/,'يجب إبقاء تكامل مرشحات وتقارير النظام عند اختيار التاريخ');
assert.match(js,/MONTHS=\['يناير'/,'يجب أن يكون التقويم باللغة العربية');
assert.match(css,/\.themed-date-picker/,'يجب تطبيق ثيم النظام على التقويم');
assert.match(css,/var\(--gold\)/,'يجب استخدام اللون الذهبي المعتمد في النظام');
assert.match(html,/themed-date-picker\.js\?v=20260817-themed-calendar-1/,'يجب تحميل التقويم بالإصدار الحالي');
assert.match(html,/styles\.css\?v=20260817-themed-calendar-1/,'يجب تجاوز التخزين المؤقت للتصميم الجديد');

console.log('Themed Arabic date picker tests passed.');
