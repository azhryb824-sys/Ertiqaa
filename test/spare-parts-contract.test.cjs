const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const pdf = fs.readFileSync(path.join(__dirname, '..', 'pdfmake-gen.js'), 'utf8');

assert.match(app, /توريد وتركيب قطع غيار/, 'نوع عقد قطع الغيار مربوط بنموذج العقود');
assert.match(app, /parts-contract-mode/, 'يوجد قسم مستقل لاختيار قطع الغيار');
assert.match(app, /selectedContractParts/, 'تُحفظ القطع والكميات والأسعار ومرجع المورد');
assert.match(app, /f\?\.type\?\.value==="توريد وتركيب قطع غيار"\)return\[\]/, 'عقد قطع الغيار لا يحفظ قائمة صيانة مخفية');
assert.match(app, /if\(type==="توريد وتركيب قطع غيار"\)return \{\.\.\.old\}/, 'تغيير النوع لا يمسح مواصفات قديمة');
assert.match(app, /function partsContractDetails/, 'صفحة عرض مستقلة لعقد قطع الغيار');

assert.match(pdf, /var isParts = c\.type === 'توريد وتركيب قطع غيار'/, 'مولد PDF يتعرف على النوع الجديد');
for (const phrase of ['قطع الغيار والكميات', 'نطاق التنفيذ', 'التزامات الطرف الأول', 'الضمان والاستلام']) {
  assert.match(pdf, new RegExp(phrase), `PDF عقد قطع الغيار يحتوي على: ${phrase}`);
}
assert.match(pdf, /var allowed = \{[\s\S]*?count:true,elevatorType:true/, 'PDF الصيانة يستخدم قائمة سماح صريحة');
assert.doesNotMatch(pdf.match(/function maintenanceSpecTable[\s\S]*?function specTable/)[0], /allowed\[f\[0\]\][\s\S]*travelHeight:true/, 'قياسات التركيب ليست ضمن قائمة سماح الصيانة');

console.log('spare-parts contract tests passed');
