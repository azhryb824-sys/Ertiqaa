const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');

assert.match(app, /data-form="contract-renew"/, 'يعرض نموذج اختيار تاريخ بداية التجديد');
assert.match(app, /renewContractAsNew\(c,data\.get\("startDate"\)\)/, 'ينشئ العقد من التاريخ المختار');
assert.match(app, /renewalReplaces:c\.id/, 'يربط العقد الجديد بالعقد المستبدل');
assert.match(app, /c\.renewalLocked=true;c\.renewedContractId=next\.id;c\.replacedByContractId=next\.id;c\.status="تم التجديد"/, 'يغلق العقد القديم ويمنع تجديده مجدداً');
assert.match(app, /paidAmount:0,remainingAmount:Number\(c\.value\|\|0\),financialStatus:"غير محصل"/, 'تبدأ مالية العقد الجديد مستقلة دون نقل تحصيلات القديم');
assert.match(app, /!c\.renewalLocked&&!c\.renewedContractId&&!contractHasRenewal\(c\)/, 'لا يعود زر التجديد للعقد القديم');

console.log('Contract renewal replacement tests passed.');
