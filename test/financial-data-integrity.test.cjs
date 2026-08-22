const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8');
const flutterState = fs.readFileSync(path.join(root, 'app_flutter/lib/state/app_state.dart'), 'utf8');
const flutterInvoices = fs.readFileSync(path.join(root, 'app_flutter/lib/screens/finance/customer_invoices_screen.dart'), 'utf8');
const flutterConstants = fs.readFileSync(path.join(root, 'app_flutter/lib/core/constants.dart'), 'utf8');
const flutterQuoteForm = fs.readFileSync(path.join(root, 'app_flutter/lib/screens/quotes/quote_form_screen.dart'), 'utf8');
const legacyPdf = fs.readFileSync(path.join(root, 'src/pdf/html-pdf-generator.js'), 'utf8');
const enhancedPdf = fs.readFileSync(path.join(root, 'src/pdf/html-pdf-generator-enhanced.js'), 'utf8');
const pdfMake = fs.readFileSync(path.join(root, 'pdfmake-gen.js'), 'utf8');
const storageMigration = fs.readFileSync(path.join(root, 'src/storage/non-destructive-migration.cjs'), 'utf8');

assert.match(server, /const storageReady = \(async \(\) => \{[\s\S]*?await initializePersistentStorage\(\)/, 'تهيئة قاعدة البيانات تبدأ مرة واحدة وتُحفظ كوعـد جاهزية مع إعادة محاولة آمنة');
assert.match(server, /await storageReady;/, 'الطلبات تنتظر جاهزية قاعدة البيانات قبل قراءة أو كتابة البيانات');
assert.match(server, /migrateStorageFile\(\{storagePath, backupDirectory: backupDir\}\)/, 'ترحيل التخزين المركزي يعمل عند بدء التشغيل');
assert.doesNotMatch(server, /copyFileSync\(templatePath, storagePath\)|تم استبدال storage\.json بالكامل من القالب/, 'النشر لا يستبدل القاعدة الحية بقالب المشروع');
assert.match(server, /FORCE_SEED_STORAGE=1 was ignored/, 'أمر الاستبدال القديم معطل صراحةً');
assert.match(storageMigration, /validatePreservedRecords\(before, next\)/, 'الترقية تتحقق من بقاء المفاتيح والسجلات');
assert.match(storageMigration, /createVerifiedBackup\(storagePath/, 'تُنشأ نسخة احتياطية موثقة قبل كتابة الترقية');

const activationCollectionCalls = app.match(/recordContractCollection\s*\(/g) || [];
assert.equal(activationCollectionCalls.length, 1, 'لا توجد استدعاءات تحصيل تلقائي؛ المتبقي تعريف مهجور فقط');
assert.doesNotMatch(
  flutterState,
  /recordContractCollection\s*\(/,
  'تفعيل العقد في Flutter لا ينشئ تحصيلاً',
);

assert.match(app, /source:\s*"manual-journal"/, 'الحركة المالية العامة موسومة للترحيل المزدوج');
assert.match(app, /refType:\s*"reversal"/, 'إبطال القيود يحفظ الأصل وينشئ قيداً عكسياً');
assert.match(app, /function optionalTaxFromForm\(/, 'الضريبة موحدة واختيارية في النماذج المالية');
assert.match(app, /taxEnabled:taxInfo\.taxEnabled/, 'حالة اختيار الضريبة تحفظ صراحةً');
assert.match(app, /account:"2300"/, 'ضريبة المبيعات الاختيارية ترحّل إلى حساب مستقل');
assert.match(app, /account:"1330"/, 'ضريبة المشتريات الاختيارية ترحّل إلى أصل قابل للاسترداد');
assert.match(flutterInvoices, /_taxEnabled|_taxRateCtrl/, 'تطبيق Flutter يدعم الضريبة الاختيارية لفواتير العملاء');
assert.match(flutterQuoteForm, /_taxEnabled|_taxRateCtrl/, 'تطبيق Flutter يدعم الضريبة الاختيارية لعروض الأسعار');
assert.doesNotMatch(legacyPdf, /totals\.tax|>الضريبة:</, 'مولد PDF القديم لا يضيف ضريبة');
assert.doesNotMatch(enhancedPdf, /totals\.tax|>الضريبة:</, 'مولد PDF المحسن لا يضيف ضريبة');
assert.match(pdfMake.slice(pdfMake.indexOf('function quotePdfDefinition'), pdfMake.indexOf('// ==================== TICKET')), /taxAmount|الضريبة الاختيارية/, 'PDF عرض السعر يعرض الضريبة فقط عند اختيارها');
for (const key of ['misadClaims', 'misadPayrolls', 'misadCustodies', 'misadPurchaseInvoices', 'misadContractExpenses', 'misadContractPayments']) {
  assert.match(app, new RegExp(`dashboardKeys=\\[[^\\n]+${key}`), `الويب يحمّل ${key} ضمن المزامنة الأولية`);
  assert.match(flutterConstants, new RegExp(`['\"]${key}['\"]`), `Flutter يحمّل ${key} ضمن المزامنة الأولية`);
}
assert.match(app, /paymentJournalKey\(pi\.id,p,i\)/, 'إبطال دفعات المورد يستخدم نفس مفتاح القيد عند الإنشاء');
assert.match(app, /purchaseInvoiceId:pi\.id/, 'الحركة المالية لفاتورة الشراء تحمل مرجعاً ثابتاً');
assert.match(app, /status:"محذوف",deletedAt:/, 'حذف العقد يحفظ السجل وروابطه المالية بدلاً من الإزالة الصلبة');
assert.match(server, /Authentication required/, 'واجهة التخزين تتطلب جلسة موثقة');
assert.match(server, /Finance write permission required/, 'الكتابة المالية محصورة بالأدوار المخولة');

console.log('financial data integrity tests passed');
