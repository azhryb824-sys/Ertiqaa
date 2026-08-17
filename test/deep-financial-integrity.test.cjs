const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

assert.match(app, /selected\?String\(selected\.ledgerAccountId\|\|"1200"\):"1200"/,
  'الحركة البنكية غير المحددة لا تُنسب تلقائياً إلى أول بنك');
assert.doesNotMatch(app, /const b=selected\|\|banks\[0\]/,
  'لا يوجد اختيار صامت لأول حساب بنكي');
assert.match(app, /function accountingRecordDate\(row\)/,
  'تواريخ القيود القديمة تُحوّل إلى تاريخ محاسبي صالح');
assert.match(app, /function contractReceivableOutstanding\(contractId,companyOwnerId\)/,
  'يحسب النظام الذمم المثبتة للعقد قبل ترحيل التحصيل');
assert.match(app, /contractCollectionCreditLines\(rc\.amount,rc\.contractId/,
  'سند القبض يسدد الذمم قبل إنشاء إيراد جديد');
assert.match(app, /contractCollectionCreditLines\(entry\.amount,entry\.contractId/,
  'دفعة العقد تسدد الذمم قبل إنشاء إيراد جديد');
assert.match(app, /function reconcileLegacyContractCollections\(\)/,
  'توجد تسوية غير إتلافية للتحصيلات السابقة المكررة مع الإيراد');
assert.match(app, /FIN-RECON-BACKUP-/,
  'تُحفظ نسخة احتياطية قبل أي تسوية تاريخية');
assert.match(app, /refType:"finance-reconciliation"/,
  'التصحيح التاريخي يتم بقيد تسوية مستقل لا بتعديل القيد الأصلي');
assert.match(app, /function financeIntegritySnapshot\(\)/,
  'تعرض الإدارة فحص التوازن والتكرار والقيود البنكية العامة');
assert.match(dashboard, /accounting-core\.js\?v=20260817-finance-integrity-1/);
assert.match(dashboard, /app\.js\?v=20260817-finance-integrity-1/);

console.log('Deep financial integrity tests passed.');
