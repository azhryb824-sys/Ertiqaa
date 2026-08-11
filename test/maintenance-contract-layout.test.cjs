const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pdfSource = fs.readFileSync(path.join(root, 'pdfmake-gen.js'), 'utf8');

assert.match(
  app,
  /tabBar\.innerHTML=\["البيانات الأساسية","مواصفات المصعد","الصيانة"\]/,
  'نموذج العقد يعرّف التبويبات الثلاثة المطلوبة فقط',
);
assert.match(app, /contractForm=threeTabContractForm/, 'النموذج المبسط هو النموذج الفعلي');
assert.match(app, /specPanels=panels\.slice\(1,-1\)/, 'مجموعات المواصفات تُدمج داخل تبويب واحد');
assert.match(app, /maintTab=2/, 'تبويب الصيانة يستخدم الفهرس الثالث بعد الدمج');
for (const section of ['basic', 'specifications', 'maintenance']) {
  assert.match(
    app,
    new RegExp(`data-maintenance-contract-section=\\"${section}\\"`),
    `قالب الطباعة الاحتياطي يحتوي قسم ${section}`,
  );
}
assert.match(app, /maintenance-contract-parties/, 'بيانات طرفي العقد في جدول الطباعة الاحتياطي');

const contract = {
  id: 'MNT-TEST-1',
  type: 'صيانة',
  status: 'بانتظار موافقة العميل',
  startDate: '2026-08-01',
  endDate: '2027-08-01',
  contractYears: 1,
  value: 12000,
  paymentMethod: 'تحويل بنكي',
  clientId: '1012345678',
  clientName: 'أحمد محمد',
  clientCompanyName: 'شركة العميل',
  clientCompanyUnifiedNumber: '7000000001',
  clientPhone: '0500000000',
  company: { name: 'مؤسسة الاختبار للمصاعد' },
  buildings: [{
    name: 'برج الاختبار',
    district: 'الملقا',
    buildingNumber: '1234',
    guardMobile: '0511111111',
    mapUrl: 'https://example.test/map',
  }],
  elevatorInfo: {
    count: '1',
    elevatorType: 'ركاب',
    usage: 'سكني',
    capacity: '450 كجم',
    persons: '6',
    stops: '5',
    age: '4 سنوات',
    motorType: 'Gearless',
    controller: 'VEGA',
  },
  maintenanceChecklist: [{
    section: 'غرفة المصعد',
    title: 'فحص زيت المحرك',
    status: 'مطلوب',
    checked: true,
    note: 'فحص دوري',
  }],
  details: 'صيانة دورية شاملة وفق البنود المحددة.',
  items: [{ title: 'الاستجابة للأعطال', description: 'وفق مواعيد العمل.' }],
  customItems: [{ title: 'تنظيف إضافي', description: 'عند كل زيارة.' }],
};

let capturedDefinition = null;
class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }

  set src(_value) {
    if (typeof this.onerror === 'function') this.onerror(new Error('image disabled in test'));
  }
}

const anchor = { click() {}, remove() {} };
const bridge = {
  activeOwnerCompany: () => ({
    name: 'مؤسسة الاختبار للمصاعد',
    unifiedNumber: '7000000000',
    commercialNumber: '1010000000',
    phone: '0555555555',
    address: 'الرياض',
  }),
  fixedPdfFooter: () => '',
  contractLabel: () => 'شركة العميل',
  visibleContracts: () => [contract],
  docPayload: () => ({ title: 'عقد صيانة اختباري' }),
  companyStamp: () => '',
  companySignature: () => '',
  companyLetterhead: () => 'data:image/png;base64,AA==',
  canUseCompanyLetterhead: () => true,
  toast: () => {},
};
const windowObject = { __appBridge: bridge };
const context = {
  window: windowObject,
  document: {
    addEventListener() {},
    createElement(tag) {
      if (tag === 'a') return anchor;
      return {};
    },
    body: { appendChild() {} },
  },
  Image: FakeImage,
  pdfMake: {
    fonts: { Cairo: {} },
    createPdf(definition) {
      capturedDefinition = definition;
      return { getBlob: async () => ({ size: 1 }) };
    },
  },
  URL: {
    createObjectURL: () => 'blob:test',
    revokeObjectURL() {},
  },
  setTimeout(callback) { callback(); },
  clearTimeout() {},
  console: { log() {}, warn() {}, error() {} },
  localStorage: { getItem: () => null },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(pdfSource, context, { filename: 'pdfmake-gen.js' });

function allText(node, out = []) {
  if (node == null) return out;
  if (Array.isArray(node)) {
    node.forEach((value) => allText(value, out));
    return out;
  }
  if (typeof node !== 'object') return out;
  if (typeof node.text === 'string') out.push(node.text);
  if (Array.isArray(node.text)) allText(node.text, out);
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'text') allText(value, out);
  }
  return out;
}

function findNode(node, predicate) {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const value of node) {
      const match = findNode(value, predicate);
      if (match) return match;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    const match = findNode(value, predicate);
    if (match) return match;
  }
  return null;
}

(async () => {
  await windowObject.generatePdf('contract', contract.id, {});
  assert.ok(capturedDefinition, 'تم إنشاء تعريف PDF لعقد الصيانة');

  const text = allText(capturedDefinition).join('\n');
  for (const heading of ['أولاً: البيانات الأساسية', 'ثانياً: مواصفات المصعد', 'ثالثاً: الصيانة']) {
    assert.match(text, new RegExp(heading), `PDF يحتوي القسم: ${heading}`);
  }
  assert.doesNotMatch(text, /رابعاً:|خامساً:|سادساً:|سابعاً:|ثامناً:|تاسعاً:|عاشراً:/, 'لا توجد أقسام عقد صيانة إضافية');
  assert.doesNotMatch(text, /ضريبة|القيمة المضافة/, 'عقد الصيانة لا يضيف ضريبة');

  const parties = findNode(capturedDefinition.content, (node) => (
    node.table
    && node.table.body?.[0]?.[0]?.text === 'الطرف'
    && node.table.body?.[0]?.[1]?.text === 'الاسم / المنشأة'
  ));
  assert.ok(parties, 'بيانات أطراف العقد موجودة في جدول');
  assert.equal(parties.table.headerRows, 1, 'رأس جدول الأطراف مضبوط');
  assert.equal(parties.table.dontBreakRows, true, 'صفوف جدول الأطراف لا تنقسم بين الصفحات');
  assert.equal(parties.table.body.length, 3, 'جدول الأطراف يحتوي الطرفين فقط بعد الرأس');

  const specs = findNode(capturedDefinition.content, (node) => (
    node.table
    && node.table.body?.[0]?.[0]?.text === 'البيان'
    && node.table.body?.some?.((row) => row?.[0]?.text === 'نوع المصعد')
  ));
  assert.ok(specs, 'مواصفات المصعد مجمعة في جدول واحد');
  assert.equal(specs.table.headerRows, 1, 'رأس جدول المواصفات يتكرر عند امتداد الصفحات');
  assert.equal(specs.table.dontBreakRows, true, 'صفوف المواصفات لا تنقسم');

  const maintenance = findNode(capturedDefinition.content, (node) => (
    node.table
    && node.table.body?.[0]?.[0]?.text === 'القسم'
    && node.table.body?.[0]?.[2]?.text === 'الحالة'
  ));
  assert.ok(maintenance, 'بنود الصيانة موجودة في جدول واضح');
  assert.equal(maintenance.table.headerRows, 1, 'رأس جدول الصيانة يتكرر');
  assert.equal(maintenance.table.dontBreakRows, true, 'صفوف الصيانة لا تنقسم');
  assert.deepEqual(Array.from(capturedDefinition.pageMargins), [24, 68, 24, 78], 'هوامش PDF القياسية محفوظة');
  assert.equal(typeof capturedDefinition.pageBreakBefore, 'function', 'ضابط منع عزل العناوين محفوظ');

  await windowObject.generatePdf('contract', contract.id, { letterhead: true });
  assert.deepEqual(Array.from(capturedDefinition.pageMargins), [24, 208, 24, 78], 'هوامش مطبوعات الشركة محفوظة');
  assert.equal(typeof capturedDefinition.background, 'function', 'خلفية مطبوعات الشركة محفوظة');

  console.log('maintenance contract layout tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
