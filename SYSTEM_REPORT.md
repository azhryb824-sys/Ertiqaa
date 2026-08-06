# تقرير شامل عن نظام إدارة شركات ومؤسسات صيانة وتركيب المصاعد الإلكترونية

> التاريخ: 2026-08-01 — تحليل كامل للمشروع على الفرع `codex/render-pdf-letterhead`

---

## 1) نظرة عامة على النظام

نظام إدارة متكامل (SPA) لشركات صيانة وتركيب المصاعد، مبني بالكامل على JavaScript (jQuery) في المتصفح مع خادم Node.js خام (بدون Express). يشمل:

- إدارة **العقود** (صيانة / تركيب، فردية وجماعية حتى 10 وحدات)
- **المواصفات الفنية** للمصاعد في 7 مجموعات
- **المالية**: سندات قبض، مستخلصات مالية، قيود مالية
- **العمليات**: بلاغات صيانة، زيارات وتقارير، مواقع الفنيين
- **الذكاء الاصطناعي** واسع النطاق + صوت عربي (TTS/STT)
- **تصدير PDF** بمسارين: html2canvas+JsPDF (قديم) و pdfmake (حديث)

---

## 2) بنية الملفات الرئيسية

| الملف | الحجم | الدور |
|---|---|---|
| `app.js` | 431 KB / ~1174 سطراً (أسطر عملاقة) | الواجهة الكاملة: نماذج، شاشات، تخزين، جسر PDF، صوت |
| `server.cjs` | 430 KB / 8125 سطراً | خادم HTTP خام + كل نقاط API + AI + صوت + نسخ احتياطي |
| `pdfmake-gen.js` | 93 KB / 1763 سطراً | توليد PDF حديث عبر pdfmake-rtl بخط Cairo |
| `dashboard.html` | 3.5 KB | قشرة فارغة (شريط جانبي + `#content`) تُملأ من app.js |
| `index.html` | 5.3 KB | صفحة هبوط/تسويقية |
| `login.html` | 12.8 KB | دخول (مع نسخة احتياطية `localLogin`) |
| `register.html` | 5.2 KB | تسجيل بشركات/أدوار |
| `styles.css` | 77 KB | التنسيقات |
| `src/pdf/*` | — | خادم PDF اختياري (Express) منفصل عن server.cjs |
| `src/ai/*` | — | وحدات الذكاء الاصطناعي (تعلّم عميق، NLP، بحث متجه، ...) |
| `mobile/` | — | نسخة موبايل مستقلة (PWA) |
| `assets/fonts/` | — | خطوط Cairo + `cairo-vfs.js` |

---

## 3) التخزين (localStorage `misad*`)

الطبقة `sharedStorage` (app.js س 5-31) تُوجّه الطلبات للخادم عبر `/api/storage` وتحتفظ بنسخ محلية تحت مفاتيح `misad*`.

| المفتاح | المحتوى |
|---|---|
| `misadUsers` | المستخدمون |
| `misadOwnerCompanies` | الشركات المالكة |
| `misadClientCompanies` | منشآت العملاء |
| `misadContracts` | العقود |
| `misadTickets` | بلاغات الصيانة |
| `misadVisits` | الزيارات |
| `misadQuotes` | عروض الأسعار |
| `misadInvoices` | الفواتير (غير مفعّلة عملياً) |
| `misadReceipts` | سندات القبض (مضافة حديثاً) |
| `misadFinancialEntries` | القيود المالية |
| `misadMeetings` | الاجتماعات |
| `misadClaims` | المطالبات/المستخلصات |
| `misadElevatorAssets` | أصول المصاعد |
| `misadPartsInventory` | مخزون قطع الغيار |
| `misadSuppliers` | الموردون |
| `misadCompanyStaff` | الموظفون |
| `misadCompanyDocs` | وثائق الشركة (الشعار/الختم/التوقيع/الترويسة) |
| `misadDefaultItems` | الأصناف الافتراضية |
| `misadKnowledgePages` | صفحات المعرفة |
| `misadSystemBanners` | اللافتات |
| `misadSession` | الجلسة `{id, role, name, permissions, companyOwnerId, adminMode, _linkedCoId}` |
| `misadActivityLog` | سجل النشاط |
| `misadVisitReports` / `misadVisitMessages` | تقارير ورسائل الزيارات |
| `misadStaffLocations` / `misadLiveLocation:*` | مواقع الفريق |

---

## 4) الأدوار والصلاحيات

- **`owner`** — مالك شركة، يرى كل شركاته عبر `_linkedCoId`.
- **`company_admin`** — مدير شركة.
- **`admin`** — مسؤول عام.
- **`technician` / `engineer`** — فني/مهندس (لا يعدّلون العقود ولا يستخدمون الترويسة).
- **`client`** — عميل (يرى عقوده فقط، يُسجَّل عبر دعوة).

قواعد رئيسية:
- `canManageContract(c)` = دور إداري + `sameCompany(c)` (نفس `companyOwnerId`).
- `canEditContract(c)` = `canManageContract` + الحالة ليست `ملغي/محذوف/منتهي`.
- `canUseCompanyLetterhead` = الأدوار الثلاثة الإدارية فقط.

حسابات افتراضية مدمجة في server.cjs (L4740-4746): admin `2572280689`، company_admin `2233556688`، owner `1010389102`.

---

## 5) نموذج العقد

**التبويبات**: البيانات الأساسية ← 7 تبويبات مواصفات فنية ← الصيانة (للصيانة فقط).

**الحقول الأساسية** (تبويب 0):
- `type`: صيانة / تركيب
- `targetType`: client / company
- بيانات العميل + `contractStartDate` + `contractYears`/`endDate`
- **قسم "البيانات المالية للعقد"**: `value` (قيمة العقد)، `paymentMethod` (نقدا/تحويل بنكي/شيك)، `transferNotice` (إشعار التحويل — يظهر فقط مع "تحويل بنكي")، `paymentPlan` (الدفعات — للتركيب فقط)، `financialNotes` (ملاحظات)
- `contractStatus`، `details`، `buildings`
- وضع التركيب: `installDuration`، `installMaintenancePeriod`، `paymentPlan`
- وضع الصيانة: `maintenanceChecklist` + `itemPicker` + `customItems`

**مجموعات المواصفات (7)**: مواصفات المصعد، المحرك والكنترول، الكابينة، الأبواب، أنظمة الأمان، الكهرباء، الضمان.
- حقل **ماركة المصعد** `motorManufacturer` في مجموعة "مواصفات المصعد"، افتراضياً **"محلي"**، بخيارات: Italy Gears / Sicor / Montanari / Fuji / Ziehl-Abegg / محلي.
- القيم الافتراضية في `specDefaults` (app.js س 246).

**الإنشاء الجماعي**: `createContractBatch` — 1-10 وحدات مصاعد بعقود منفصلة مع خيار مشاركة المواصفات/الصيانة.

---

## 6) المالية وسندات القبض

- نموذج سند القبض `data-form="receipt"` بحقول: `clientId`، `clientName`، `amount`، `paymentMethod` (نقداً/تحويل بنكي/شيك/شبكة)، `purpose`، `purposeDetail`، `details`.
- في PDF السند: **طريقة الدفع من بيانات السند `paymentMethod`** (وإن لم توجد تُجلب من `misadFinancialEntries` المرتبطة بـ `receiptId` أو `contractId` مع استبعاد "سند قبض")، سطر "استلمنا من العميل الموضحة بياناته في الجدول أدناه مبلغ" فوق المبلغ، **تاريخ الدفع** = `contract.startDate` لعقود الصيانة وإلا `createdAt`، مع **صورة الختم والتوقيع** عبر `A.companyStamp()` / `A.companySignature()`.
- `recordContractCollection` / `contractFinanceInfo` / `ensureReceiptClaims` لربط التحصيل بالمستخلصات.

---

## 7) تصدير PDF

**مساران متوازيان:**
1. **pdfmake** (الحديث، مفضَّل): `pdfmake-gen.js` — دوال:
   - `contractPdfDefinition` (809)، `quotePdfDefinition` (962)، `reportPdfDefinition` (1132)، `ticketPdfDefinition` (1198)، `claimPdfDefinition` (1238)، `receiptPdfDefinition` (1290)، `contractFinancePdfDefinition` (1422)
   - الموزّع `window.generatePdf(type, id, opts)` (1609) مع تراجع آمن إلى الطريقة القديمة
2. **html2canvas+JsPDF** (القديم): `downloadPdf` (app.js س 358) مع تقطيع يدوي للصفحات وبديل `printDoc`.

الخط: **Cairo** مسجَّل خارجياً في `assets/fonts/cairo-vfs.js`. الاتصال بالتطبيق عبر `window.__appBridge` (app.js س 1130-1158) و `A.downloadPdf` كاحتياط.

---

## 8) الخادم (server.cjs)

- خادم HTTP خام من L4719، منفذ `process.env.PORT || 4173` (يعمل حالياً على **4176**).
- يخدم الملفات الثابتة من الجذر (بدون express.static) مع حماية `filePath.startsWith(root)`.
- **التخزين**: `storage.json` في `~/.elevator-data`، مع failover وlegacy، حماية stale-write، نسخ `prewrite-*.json`، نسخ احتياطية دورية.
- **نقاط API رئيسية**: auth/register، استيراد عقود Excel (AI و عادي)، صوت `/api/voice/*`، واتساب/إشعارات، محادثة `/api/ai/admin` + `/api/ai/execute`، معرفة المصاعد، تعلّم عميق/NLP/بحث متجه، دعوات/أجهزة/كوكيز موقّعة، زيارات (أكواد اعتماد وتقييم)، `/api/storage` قراءة/كتابة، نسخ احتياطي.
- **المصادقة**: كوكيز موقّعة `misad_entry` / `misad_invite` / `misad_device` + قفل الدخول `sendLocked()`.
- **مزوّد AI**: Groq أساسي (`llama-3.3-70b-versatile`) + fallback + توليد محلي.

---

## 9) الذكاء الاصطناعي والصوت

- سير عمل AI: `aiFindClient` ← `aiNeed` ← `aiPreview` ← `aiMerge` ← إنشاء/تحديث كيانات.
- إجراءات AI في الخادم: إنشاء عقد/عرض/بلاغ/زيارة، توزيع زيارات، مورد، موظف، إشعار، تحليل تقرير، تحسين عرض.
- صوت: `/api/voice/synthesize` (TTS عبر jameel-ai)، `speakArabic`/`listenArabic`، تحسين تعبئة الحقول `enhanceVoiceInputs`.
- **ملاحظة**: `voice-ai-enhancement.js` (نسخة محسّنة) **غير محمّلة في التطبيق الأساسي** — تُستخدم فقط في صفحات الاختبار.

---

## 10) المخاطر والمشاكل المكتشفة

### أمنية
1. **كلمات مرور افتراضية مكتوبة في الكود** (server.cjs L4743-4745) — خطر عند النشر.
2. **`GROQ_API_KEY` حقيقي مكشوف في `.env`** — يجب عدم رفعه للـ git وإدارته عبر متغيرات بيئة.
3. **`POST /api/storage` يكتب أي مفتاح بدون مصادقة** (L7903-7923) — ثغرة فعلية.
4. `GET /api/backup/download` قابل للتنزيل دون تحقق صارم من الدور.
5. وضع "admin عبر الشركات" (`_linkedCoId`/`adminMode`) يُدار عميلاً وليس خادماً.

### بنيوية/تقنية
6. **تضارب نسخ**: `_temp_served.js` (388 KB) نسخة قديمة من app.js تختلف منذ س 241 — خطر استخدامها عند النشر.
7. **مساران PDF** قد يعطيان مخرجات مختلفة (تقطيع صفحات/ترويسة).
8. **أسطر عملاقة** (حتى 10,637 حرفاً) تعطّل الصيانة والتشغيل الآلي للفهارس.
9. **`app.bundle.js`** وهمي (292 بايت).
10. ملفات قمامة في الجذر: `_temp_*.js`، `.edge-pdf-flow/`، `.edge-heading-check/`، ملفات `.aac` كثيرة.

### الوظيفية
11. **`misadInvoices`** موجودة لكن لا يوجد نموذج فاتورة فعلي — الاعتماد على سندات القبض.
12. `voice-ai-enhancement.js` غير مفعّل في التطبيق.
13. `entrySecret` يُتولد عشوائياً عند كل إقلاع إن لم يُضبط `SECRET_ENTRY_TOKEN` — تنقطع جلسات الدخول عند كل إعادة تشغيل.
14. `axios` يُستخدم (L6696) لكن ليس تبعية ظاهرية مباشرة في package.json.

---

## 11) أحدث التغييرات (سجل git)

الفرع `codex/render-pdf-letterhead` — أعمال PDF الأخيرة:
- ترويسة صفحات PDF + دفعة 1 سم (28pt) للهوامش العلوية
- منع انعزال العناوين (orphaned headings) أسفل الصفحات
- إصلاح ترقيم البنود العربية في عقود التركيب (مصعد تلقائي)
- لوحة ألوان جديدة (كحلي `#1e3a5f` + ذهبي `#c9a84c` + رمادي)
- PDF المالية للعقد: إظهار ختم/توقيع الشركة فقط، يلائم صفحة واحدة (أحدث 5 دفعات)

والتعديلات الحالية غير المرتبطة:
- قسم "البيانات المالية للعقد" في النموذج + حفظ `paymentMethod`/`financialNotes`
- جلب طريقة الدفع من الإدارة المالية في سند القبض
- حقل "ماركة المصعد" في تبويب مواصفات المصعد (افتراضياً "محلي")

---

## 12) توصيات

1. حذف الملفات المؤقتة من الجذر (`_temp_*.js`، `.edge-*`، ملفات `.aac`).
2. نقل `GROQ_API_KEY` والكلمات الافتراضية إلى بيئة آمنة.
3. حماية `POST /api/storage` و`/api/backup/download` بمصادقة فعلية.
4. دمج مساري PDF في مسار واحد (pdfmake) وإزالة html2canvas أو جعله احتياطاً نهائياً.
5. تنظيف `_temp_served.js` أو حذفه نهائياً.
6. تفعيل `voice-ai-enhancement.js` في dashboard.html إن كانت ميزاته مطلوبة.
7. تثبيت `axios` كتبعية صريحة.
8. تشغيل `node --check` واختبار PDF بعد كل تعديل، ثم إعادة تشغيل الخادم على 4176.

---

*تم إعداد هذا التقرير عبر فحص `app.js` و`server.cjs` و`pdfmake-gen.js` وملفات الواجهة وسجل git.*
