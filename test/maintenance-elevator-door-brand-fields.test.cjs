const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');
const buildPatch = fs.readFileSync('apply-contract-form-update.cjs', 'utf8');

assert.match(app, /maintenanceSpecKeys=new Set\(\["elevatorType","usage","capacity","persons","stops","age","doorType","motorManufacturer"\]\)/, 'نوع الأبواب وماركة المصعد متاحان لعقد الصيانة');
assert.match(app, /\["doorType","نوع الأبواب","select"/, 'حقل نوع الأبواب موجود في مواصفات المصعد');
assert.match(app, /\["motorManufacturer","ماركة المصعد","select"/, 'حقل ماركة المصعد موجود في مواصفات المصعد');
assert.match(app, /maintenanceSpecKeys\.forEach\(key=>/, 'تُحفظ حقول الصيانة المسموح بها في بيانات العقد');
assert.doesNotMatch(buildPatch, /source = source\.replace\([\s\S]*maintenanceSpecKeys=new Set\(\["elevatorType","usage","capacity","persons","stops","age","doorType","motorManufacturer"\]/, 'لا تعيد مرحلة البناء توسيع حقول عقد الصيانة');

console.log('maintenance elevator door and brand fields: ok');
