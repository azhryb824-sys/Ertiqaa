const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(app, /data-finance-tab="sales-invoices">فواتير المبيعات/,
  'يجب ظهور تبويب فواتير المبيعات');
assert.match(app, /data-finance-section="sales-invoices"/,
  'يجب ربط تبويب المبيعات بقائمة فواتير العملاء الحالية');
assert.match(app, /data-finance-tab="purchase-invoices">فواتير المشتريات/,
  'يجب ظهور تبويب فواتير المشتريات');
assert.match(app, /data-finance-section="purchase-invoices"/,
  'يجب عرض فواتير الموردين في تبويب المشتريات');
assert.match(app, /data-page-link="purchase-invoice-create">إنشاء فاتورة مشتريات/,
  'يجب توفير زر مستقل لإنشاء فاتورة مشتريات');
assert.match(app, /function purchaseInvoiceCreatePage\(\)/,
  'يجب توفير صفحة مستقلة لإنشاء فاتورة المشتريات');
assert.match(app, /page==="purchase-invoice-create"/,
  'يجب ربط صفحة إنشاء فاتورة المشتريات بموجّه الصفحات');
assert.match(app, /contractId\?contracts\.find.*:null/,
  'يجب دعم فاتورة مشتريات عامة أو مرتبطة بعقد');
assert.match(app, /data-finance-tab="staff-purchases">مصروفات الموظفين/,
  'يجب تسمية التبويب بمصروفات الموظفين');
assert.match(app, /if\(!file\|\|!String\(file\.type\|\|""\)\.startsWith\("image\/"\)\)return toast\("صورة الفاتورة إلزامية/,
  'يجب رفض مصروف الموظف الجديد دون صورة صحيحة');
assert.match(app, /image\.required=true/,
  'يجب إظهار حقل صورة الفاتورة كحقل إلزامي');
assert.match(app, /if\(!inv\.image&&!file\)return toast\("صورة الفاتورة إلزامية"\)/,
  'يجب إلزام الفواتير القديمة بصورة عند تعديلها');
assert.doesNotMatch(app, /data-finance-tab="customer-invoices"/,
  'يجب إزالة اسم تبويب فواتير العملاء القديم');

console.log('Finance invoice tabs and staff expense image tests passed.');
