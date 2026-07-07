# نظام توليد PDF الاحترافي باللغة العربية
## Professional Arabic PDF Generation System

نظام متقدم لتوليد ملفات PDF احترافية باللغة العربية مع دعم كامل لـ RTL وتصميمات جذابة.

---

## المميزات

### ✅ دعم اللغة العربية الكامل
- دعم اتجاه RTL (من اليمين لليسار)
- خطوط عربية احترافية (Cairo, Amiri)
- معالجة النص العربي بشكل صحيح

### 🎨 تصميمات احترافية وجذابة
- قوالب HTML/CSS مرنة وقابلة للتخصيص
- تصميمات عصرية وأنيقة
- ألوان متناسقة وجذابة
- جداول احترافية

### 📄 أنواع المستندات المدعومة
- **عقود الصيانة** - عقود احترافية مع جميع التفاصيل
- **عروض الأسعار** - عروض سعر مفصلة مع الجداول
- **التقارير** - تقارير شاملة مع الإحصائيات والرسوم البيانية

### 🔧 ميزات إضافية
- تذييلات وترويسات احترافية
- أقسام التوقيع
- علامات مائية
- تصميم متجاوب
- سهولة التخصيص

---

## التثبيت

### المتطلبات
- Node.js 14 أو أحدث
- npm أو yarn

### خطوات التثبيت

```bash
# تثبيت الحزم المطلوبة
npm install

# أو باستخدام yarn
yarn install
```

---

## الاستخدام

### توليد عقد صيانة

```javascript
const ArabicPDFGenerator = require('./src/pdf/html-pdf-generator');

const generator = new ArabicPDFGenerator();

const contractData = {
  company: {
    name: 'شركة شموس للمصاعد',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966 11 234 5678',
    email: 'info@shumoos-elevators.com'
  },
  contractNumber: 'CTR-2024-001',
  date: '2024-01-15',
  clientName: 'محمد أحمد العلي',
  clientAddress: 'جدة، حي النخيل',
  clientPhone: '+966 50 123 4567',
  location: 'برج الأفق، جدة',
  elevatorType: 'مصعد ركاب',
  capacity: '13 شخص',
  elevatorCount: '2',
  terms: [
    'تلتزم الشركة بصيانة دورية للمصعد كل شهر',
    'استبدال القطع التالفة فوراً',
    'التواجد على مدار الساعة للطوارئ'
  ],
  pricing: {
    contractValue: '25,000',
    paymentMethod: 'دفعة واحدة',
    duration: 'سنة واحدة'
  },
  companyName: 'شركة شموس للمصاعد'
};

await generator.generateContract(contractData, 'output/contract.pdf');
```

### توليد عرض سعر

```javascript
const quoteData = {
  company: {
    name: 'شركة شموس للمصاعد',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966 11 234 5678',
    email: 'info@shumoos-elevators.com'
  },
  quoteNumber: 'QT-2024-001',
  date: '2024-01-15',
  clientName: 'شركة الأفق للتطوير العقاري',
  validUntil: '2024-02-15',
  items: [
    {
      name: 'صيانة دورية',
      description: 'صيانة شهرية شاملة لمصعد ركاب',
      quantity: '12',
      price: '1,500',
      total: '18,000'
    },
    {
      name: 'قطع غيار',
      description: 'توفير قطع غيار أساسية',
      quantity: '1',
      price: '3,000',
      total: '3,000'
    }
  ],
  totals: {
    subtotal: '23,000',
    tax: '1,150',
    total: '24,150'
  },
  companyName: 'شركة شموس للمصاعد'
};

await generator.generateQuote(quoteData, 'output/quote.pdf');
```

### توليد تقرير

```javascript
const reportData = {
  company: {
    name: 'شركة شموس للمصاعد',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966 11 234 5678',
    email: 'info@shumoos-elevators.com'
  },
  title: 'تقرير الأداء الشهري',
  subtitle: 'يناير 2024',
  summary: [
    'تم تنفيذ 45 زيارة صيانة خلال الشهر',
    'نسبة رضا العملاء وصلت إلى 95%',
    'انخفضت حالات الطوارئ بنسبة 20%'
  ],
  statistics: {
    'إجمالي الزيارات': '45',
    'الزيارات المكتملة': '42',
    'حالات الطوارئ': '5',
    'نسبة الرضا': '95%'
  },
  tables: [
    {
      title: 'أداء الفنيين',
      headers: ['الفني', 'عدد الزيارات', 'التقييم'],
      data: [
        ['أحمد محمد', '15', '4.8/5'],
        ['خالد علي', '12', '4.5/5']
      ]
    }
  ],
  recommendations: [
    'زيادة عدد الفنيين في منطقة جدة',
    'تحديث نظام الحجز'
  ]
};

await generator.generateReport(reportData, 'output/report.pdf');
```

---

## الاختبار

```bash
# تشغيل الاختبارات
npm test

# أو
node src/pdf/test-pdf.js
```

سيتم توليد ثلاثة ملفات PDF تجريبية في مجلد `output/`:
- `contract-test.pdf` - عقد صيانة تجريبي
- `quote-test.pdf` - عرض سعر تجريبي
- `report-test.pdf` - تقرير تجريبي

---

## التخصيص

### تعديل الألوان

يمكنك تعديل الألوان في قوالب HTML:

```css
/* اللون الأساسي */
--primary-color: #1a5490;

/* لون التدرج */
--gradient-start: #667eea;
--gradient-end: #764ba2;
```

### إضافة خطوط عربية

يمكنك إضافة خطوط عربية إضافية من Google Fonts:

```html
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');

body {
    font-family: 'Tajawal', 'Cairo', Arial, sans-serif;
}
</style>
```

### تخصيص القوالب

يمكنك تعديل قوالب HTML في `src/pdf/html-pdf-generator.js`:
- `getContractHTML()` - قالب العقد
- `getQuoteHTML()` - قالب عرض السعر
- `getReportHTML()` - قالب التقرير

---

## التكامل مع النظام

### إضافة نقطة نهاية API

```javascript
// في server.cjs
const ArabicPDFGenerator = require('./src/pdf/html-pdf-generator');

app.post('/api/pdf/contract', async (req, res) => {
  try {
    const generator = new ArabicPDFGenerator();
    const pdfPath = await generator.generateContract(req.body, `output/contract-${Date.now()}.pdf`);
    
    res.json({ success: true, path: pdfPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### التكامل مع الواجهة الأمامية

```javascript
// في app.js
async function generateContractPDF(contractId) {
  const contract = await getContractData(contractId);
  
  const response = await fetch('/api/pdf/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contract)
  });
  
  const result = await response.json();
  
  if (result.success) {
    window.open(result.path, '_blank');
  }
}
```

---

## هيكل المشروع

```
src/pdf/
├── html-pdf-generator.js    # المولد الرئيسي
├── test-pdf.js              # ملف الاختبار
└── generate-examples.js     # توليد أمثلة

output/                      # مخرجات PDF
├── contract-test.pdf
├── quote-test.pdf
└── report-test.pdf
```

---

## الأداء

- **سرعة التوليد**: 2-5 ثوانٍ لكل مستند
- **جودة المخرجات**: عالية الدقة (300 DPI)
- **حجم الملف**: 100-500 KB حسب المحتوى

---

## المتطلبات التقنية

- **Puppeteer**: محرك عرض المتصفح لتوليد PDF
- **HTML/CSS**: قوالب مرنة وقابلة للتخصيص
- **Google Fonts**: خطوط عربية احترافية

---

## استكشاف الأخطاء

### المشكلة: النص العربي يظهر بشكل غير صحيح
**الحل**: تأكد من استخدام `dir="rtl"` في وسم HTML

### المشكلة: الخطوط لا تظهر
**الحل**: تأكد من الاتصال بالإنترنت لتحميل الخطوط من Google Fonts

### المشكلة: PDF لا يتم توليده
**الحل**: تأكد من تثبيت Puppeteer بشكل صحيح

---

## التطوير المستقبلي

- [ ] إضافة المزيد من القوالب
- [ ] دعم الصور والشعارات
- [ ] إضافة رسوم بيانية تفاعلية
- [ ] دعم التوقيع الرقمي
- [ ] إضافة علامات مائية مخصصة
- [ ] تحسين الأداء

---

## الترخيص

MIT License

---

## الدعم

للدعم والاستفسارات، يرجى التواصل عبر:
- البريد الإلكتروني: info@shumoos-elevators.com
- الهاتف: +966 11 234 5678

---

**تم التطوير بواسطة فريق شموس للمصاعد** © 2024
