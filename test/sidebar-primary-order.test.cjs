const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /const primarySidebarOrder=\["contracts","finance","team","reports-center"\]/,
  'ترتيب الأزرار الرئيسية هو العقود ثم المالية ثم فريق العمل ثم التقارير');
assert.match(app, /remaining\.splice\(overviewIndex\+1,0,\.\.\.promoted\)/,
  'توضع الأزرار الرئيسية مباشرة تحت نظرة عامة');

console.log('Sidebar primary order tests passed.');
