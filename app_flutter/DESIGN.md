# تصميم تطبيق شموس للمصاعد (Flutter)

مرجع موثّق لإعادة تنفيذ نظام الويب (شموس للمصاعد) كتطبيق Flutter أصلي (Android + iOS) مع التطابق الوظيفي الكامل: نفس الـ Backend، نفس نقاط الـ API، نفس الصلاحيات، نفس قواعد العمل، دون إضافة/حذف وظيفة.

---

## 1. البنية المعمارية

النظام الأصلي **Client-side بالكامل**: كل منطق العمل موجود في `app.js` بالمتصفح. الخادم `server.cjs` (منفذ `PORT||4173`) هو **مخزن JSON خام فقط** لكل مفتاح `misad*`، ولا يوجد REST API للعمليات التجارية.

```
التطبيق (Flutter/Dart)
   │
   ├── /api/auth/login            → المصادقة
   ├── /api/storage?key=..        → قراءة مفتاح واحد
   ├── /api/storage?keys=..       → قراءة عدة مفاتيح دفعة
   ├── /api/storage/batch (POST)  → كتابة مفاتيح (updates)
   ├── /api/ai/execute | /api/ai/admin → الذكاء الاصطناعي
   ├── /api/voice/*               → الصوت المسجل
   ├── /api/visits/*              → اعتماد الزيارات والتقييم
   ├── /api/notifications         → الإشعارات
   ├── /api/invites               → روابط التسجيل
   ├── /api/users/*               → الربط/الفك/بحث المستخدمين
   └── /api/device/authorize      → تفويض الجهاز
```

**قاعدة ذهبية:** أي عملية تجارية (إنشاء عقد، تحصيل، إنشاء زيارة دورية، حساب دفعات...) تُنفَّذ **محلياً في Dart** بنفس قواعد `app.js` ثم تُكتب النتيجة إلى مفتاح `misad*` عبر `/api/storage/batch`. **ممنوع** تعديل أي شيء في الخادم.

---

## 2. مفاتيح التخزين (23 مفتاحاً)

```dart
const storageKeys = <String>[
  'misadUsers','misadContracts','misadVisits','misadTickets','misadCompanyStaff',
  'misadStaffLocations','misadClientCompanies','misadOwnerCompanies','misadDefaultItems',
  'misadVisitReports','misadQuotes','misadCompanyDocs','misadElevatorAssets',
  'misadPartsInventory','misadSuppliers','misadActivityLog','misadVisitMessages',
  'misadMeetings','misadSystemBanners','misadKnowledgePages','misadAdminInvites',
  'misadFinancialEntries','misadReceipts',
];
```

مفاتيح إضافية تُقرأ/تُكتب عند الحاجة (ليست في dashboardKeys):
`misadClaims`، `misadInvoices`، `misadContractPdfDownloads`، `misadQuotePdfDownloads`، `misadFormDrafts`، `misadSession`، `misadDeviceId`، `misadLiveLocation:<userId>`.

كل قيمة تُخزَّن كـ **JSON array** (إلا `misadSession`/`misadDeviceId`/`misadLiveLocation:` كسلاسل نصية).

### قراءة/كتابة دفعة
- **قراءة:** `GET /api/storage?keys=k1,k2` → `{values: {k1: "...", ...}, summaries: {...}}`. القيم قد تكون سلسلة JSON أو كائناً.
- **كتابة:** `POST /api/storage/batch` body: `{updates: [{key, value, remove}]}`. القيمة سلسلة JSON.
- عند الأوفلاين: حفظ محلي (SharedPreferences / sqflite) ثم مزامنة عند العودة للاتصال.

---

## 3. نماذج البيانات (الشكل الحرفي من app.js)

> كل نموذج يُعرَّف بكل الحقول الظاهرة في كود الحفظ. التواريخ نصية عربية عبر `toLocaleString("ar-SA")` غالباً، إضافة لحقول `*AtMs` رقمية.

### 3.1 Contract (عقد) — مفتاح `misadContracts`
أنواع: `صيانة` | `تركيب` | `توريد وتركيب قطع غيار` | `إعادة تأهيل مصعد` | `إضافة ملحقات مصعد` | `استبدال مكون` (النوعان الأخيران يُضافان ديناميكياً للنموذج).

حقول العقد عند الإنشاء:
```js
{
  id: nextContractId(),          // CONT0001 .. CONT9999
  companyOwnerId, companyId,     // companyId = owner company id
  type, targetType,              // targetType: "client" | "company"
  clientId, clientName, clientCompanyUnifiedNumber,
  clientCompanyName, clientPhone,
  value: Number,
  elevatorInfo: {...specs},      // من specGroups + count/brand/age/capacity/doorType/usage
  installationInfo: {...},       // لعقود التركيب (stops, entrances, battery, doorOpening, shaftSize, motor, controller, outerDoors, safetyDoor, cabin, power, speed, warranty, note, installDuration, maintenancePeriod)
  maintenancePeriod,             // "سنة"
  maintenanceChecklist: [...],   // بنود الصيانة
  buildings: [{name, district, mapUrl, guardMobile}],
  items: [...],                  // defaultItems المختارة (كائنات كاملة)
  customItems: [{section,title,description,price}],
  details,
  oldContractFile, oldContractFileName,  // للعقود "قديم"
  paymentMethod, financialNotes,
  status,                        // "بانتظار موافقة العميل" | "ساري" | "بانتظار مراجعة إيصال الدفع" | "ملغي" | "منتهيا" | "محذوف"
  startDate, contractYears, endDate,      // endDate = start + years - 1 يوم
  createdAt (ar-SA), createdAtMs, createdBy,
  company: {name},
  paymentPlan: [{label, description, percent}]  // للتركيب فقط (قبل التسليم)
}
```

حقول تُضاف لاحقاً (تعديل/تفعيل/تجديد):
`updatedAt, updatedBy, amendmentRequired:true` (عند التعديل تعود الحالة "بانتظار موافقة العميل")
`activatedAt, activatedBy` — عند التفعيل اليدوي
`deliveryDate, maintenanceStartDate, maintenanceEndDate` — عند "تم تركيب المصعد"
`renewedAt` — عند التجديد (النهاية + سنوات)
`canceledAt, canceledAtMs, canceledBy` — عند الإلغاء
`transferNotices:[{data,name,uploadedAt}]` + `transferNoticeData, transferNoticeName, transferNoticeUploadedAt`

### 3.2 Ticket (بلاغ) — `misadTickets`
```js
{ id: `TKT-<ts>`, companyOwnerId,
  title, description, priority,       // medium|low|high|urgent
  status: "مفتوح",                    // ثم "مغلق"...
  contractId, clientId, clientName,
  clientCompanyUnifiedNumber, clientCompanyName,
  building: {name, district, mapUrl, guardMobile},
  elevatorInfo, assignedTo, createdBy, createdByName,
  createdAt, createdAtMs, updates: [],
  invoiceId? }                        // فاتورة 100 ريال عند لا عقد صيانة ساري
```

### 3.3 Visit (زيارة) — `misadVisits`
```js
{ id: `VIS-K-<ts>` (كشفية) | `VIS-<ts>-<i>` (دورية),
  companyOwnerId, contractId, visitType: "كشفية"|""|"دورية",
  clientId, clientName, clientCompanyUnifiedNumber, clientCompanyName,
  building, elevatorInfo,
  assignedTo, assignedName,           // ""/"بانتظار الإسناد" إن لم يوجد فني
  scheduledAt, status,                // "مجدولة"|"بانتظار الإسناد"|"بانتظار الاعتماد"|"بانتظار التقييم"|"ملغية"
  periodic: bool, notes, createdAt,
  reportId?, rating: {stars, notes}?,
  canceledAt, canceledAtMs, canceledBy, cancelReason? }
```
**توليد الزيارات الدورية:** من startDate إلى endDate، زيارة كل شهر بنفس ساعة `T09:00`، يُسند بالتناوب عبر `availableStaff()` (الأعضاء المتاحون: دور technician/engineer وavailability=="working")؛ إن لم يوجد عضو → status "بانتظار الإسناد".

### 3.4 VisitReport (تقرير) — `misadVisitReports`
```js
{ id: `REP-<ts>`, companyOwnerId, visitId, visitType, contractId,
  clientId, clientName, clientCompanyUnifiedNumber, clientCompanyName,
  buildingName, technicianId, technician,
  elevatorStatus,     // "يعمل بشكل طبيعي"|"يعمل مع ملاحظات"|"متوقف عن العمل"|"يحتاج زيارة إضافية"
  workDone, issues, parts, recommendations, attachments,
  description,        // join للأربعة أعلاه
  status: "بانتظار اعتماد العميل", locked: true, createdAt, createdAtMs }
```

### 3.5 Quote (عرض سعر) — `misadQuotes`
```js
{ id: `QTO-<ts>`, companyOwnerId,
  clientId, clientName, clientCompanyUnifiedNumber, clientCompanyName,
  client,        // "العميل الظاهر في العرض"
  title, type,   // "تركيب"|"صيانة"|"توريد وتركيب قطع غيار"
  value, subtotal, status: "بانتظار المراجعة والاعتماد",
  reportId?, elevatorInfo?, maintenanceChecklist?, paymentPlan?,
  items, partsItems: [{section,title,description,price,partId,supplierId,unitPrice,qty}],
  customItems, details, createdAt, createdBy }
```
الحسابات: `subtotal = value(أساسي) + defaultItems المختارة + customItems + (أفضل سعر × كمية لكل قطعة)`؛ `tax = subtotal × 0` (quoteTaxRate=0)؛ `total = subtotal`.

### 3.6 Receipt (سند قبض) — `misadReceipts` (منفصل عن Claims!)
```js
{ id: `RCT-<ts>`, companyOwnerId, contractId, clientId,
  clientName, clientCompanyName, clientCompanyUnifiedNumber,
  amount, purpose, purposeKey, paymentMethod,
  details,
  status: "معتمد", createdAt, createdAtMs, createdBy }
```
عند الإصدار مع عقد: يُنشأ أيضاً قيد مالي `FIN-` بنوع `sale`/`in` ووصف "سند قبض: ..." و`paymentMethod` (نفس طريقة الدفع المختارة) و`receiptId`. في PDF السند يُعرض سطر "استلمنا من العميل الموضحة بياناته في الجدول أدناه مبلغ" فوق المبلغ، وطريقة الدفع من بيانات السند.

### 3.7 Claim (مستخلص) — `misadClaims` (قراءة عبر `read('misadClaims')`)
```js
{ id: `RCT-<ts>` (عند إنشائه آلياً من قيد البيع) | `CLM-<ts>` (يدوي),
  companyOwnerId, contractId, value, period, status,
  receiptEntryId?, createdAt }
```
`ensureReceiptClaims`: لكل قيد مالي `type=="sale" && contractId && amount>0 && collectionForStatus=="ساري"`، إن لم يوجد مستخلص بـ `receiptEntryId===entry.id` يُنشأ مستخلص جديد.

### 3.8 FinancialEntry (قيد مالي) — `misadFinancialEntries`
```js
{ id: `FIN-<ts>`, companyOwnerId,
  type,         // sale|purchase|expense|salary|advance|deduction|allowance|custody
  direction,    // in | out  (sale→in، عدا ذلك out)
  amount, date, description,
  contractId?, supplierId?, partId?, staffId?, employeeId?,
  status,       // مسودة|معتمد|مدفوع|مستحق
  paymentMethod?, paymentLabel?, receiptId?, collectionForStatus?,
  createdBy, createdAt, createdAtMs }
```

### 3.9 OwnerCompany (منشأة المالك) — `misadOwnerCompanies`
```js
{ id: `OWN-<ts>`, ownerIds:[], ownerId,
  name, unifiedNumber, commercialNumber, taxNumber, phone, email, address,
  pdfFooter, companyLetterhead (dataURL), companyLetterheadName,
  bankAccount?, createdAt, updatedAt, deletedAt? }
```

### 3.10 ClientCompany (منشأة عميل) — `misadClientCompanies`
```js
{ id: `CMP-<ts>`, ownerId: session.id, name, unifiedNumber, taxNumber, createdAt }
```

### 3.11 Staff — `misadCompanyStaff`
```js
{ id: `STF-<ts>`, companyOwnerId, identity, name,
  role: technician|engineer|company_admin, availability: "working",
  status: "مرتبط", createdAt,
  jobTitle?, department?, employmentType?, employmentStatus?,
  hireDate?, baseSalary?, bankAccount?, leaveBalance?, hrNotes? }
```
**قاعدة:** إضافة `company_admin` للفريق تتم عبر `/api/users/link` (ليس كسجل staff). إضافة staff تتطلب أن يوجد المستخدم في النظام (بحث بـ `/api/users/lookup` أو محلياً).

### 3.12 Part (قطعة مخزون) — `misadPartsInventory`
```js
{ id: `PRT-<ts>`, companyOwnerId, name, sku, category,
  qty, minQty, unitCost, supplier,
  suppliers: [{supplierId, supplierName, price, leadTime, warranty}],
  createdAt }
```

### 3.13 Supplier — `misadSuppliers`
```js
{ id: `SUP-<ts>`, companyOwnerId, name, phone, email, city,
  category, rating, notes, createdAt }
```

### 3.14 DefaultItem — `misadDefaultItems`
```js
{ id: Date.now() (رقم), companyOwnerId, type: contract|quote,
  section, title, description, price }
```

### 3.15 Doc (مستند شركة) — `misadCompanyDocs`
```js
{ id: `DOC-<ts>`, companyOwnerId, partyName, type: signature|stamp|commercial|other,
  name, expiresAt, fileName, fileData (dataURL),
  status: "بانتظار المراجعة والاعتماد", createdAt, createdBy,
  approvedAt?, approvedBy? | rejectedAt?, rejectedBy? }
```
**استخدام:** التوقيع/الختم في المستندات PDF يُجلب من أول مستند معتمد حديثاً بنوع signature/stamp قبل تاريخ انتهائه.

### 3.16 ElevatorAsset (أصل) — `misadElevatorAssets` + أصول منشأة من العقود
```js
{ id: `AST-<ts>`, companyOwnerId, source:"يدوي", client, building, district,
  brand, count, age, capacity, usage, status, createdAt }
```
الأصول تُعرض من: يدوي (assets) + من العقود المرئية (بناءً على buildings/elevatorInfo) — `assetRows()`.

### 3.17 Meeting — `misadMeetings`
```js
{ id: `MTG-<ts>`, companyOwnerId, title, scheduledAt, notes,
  invitees: [ids], room: `shumoos-<id>`, url: `https://meet.jit.si/<room>`,
  createdBy, createdByName, createdAt, createdAtMs }
```

### 3.18 Notification / Invite / User (على الخادم)
- Notification: `{userId|roles, type, title, body, url, whatsapp?}`.
- Invite: `{label, targetRole, kind:"device", createdBy, createdByName, createdByRole, companyOwnerId, minutes:10, maxUses:1}` → `{url}`.
- AdminInvite (محلي): `{id: ADMIN-INV-<ts>, userId, userName, companyOwnerId, companyName, invitedBy, invitedByName, status: pending|accepted|rejected|cancelled, createdAt}`.
- User: `{id, password, role, name, permissions, mustChangePassword, companyOwnerId, deletedAt?, phone?, whatsappEnabled?}`.

### 3.19 Banner / KnowledgePage — `misadSystemBanners` / `misadKnowledgePages`
```js
Banner: { id:`BNR-<ts>`, title, label, description, url, order, status: active|paused, fileName, imageData, createdAt, createdBy }
Knowledge: { id:`KNO-<ts>`, title, category, summary, body, order, status: published|draft, fileName, imageData, createdAt, createdBy }
```

---

## 4. نقط API المستخدمة (تطابق تام)

| Endpoint | الاستخدام |
|---|---|
| `POST /api/auth/login` `{userId,password}` | دخول → `{id,role,name,permissions,mustChangePassword,companyOwnerId}` |
| `GET /api/storage?keys=` / `?key=` | قراءة (مع `summaries`) |
| `POST /api/storage/batch` `{updates:[{key,value,remove}]}` | كتابة (keepalive) |
| `POST /api/ai/execute` `{question,userId,role,name,permissions,companyOwnerId,_pendingAction?,_pendingData?}` | أمر صوتي/نصي ذكي → `{message,answer,executed,openForm,formType,data,missingFields}` |
| `POST /api/ai/admin` + `X-AI-Task-Type: chat` | إدارة ذكية |
| `GET /api/ai/agent/status` | حالة الوكيل |
| `GET /api/ai/predict-failures` | تنبؤ الأعطال |
| `POST /api/ai/analyze-report` | تحليل تقرير → قد يرجع `quote` |
| `GET /api/ai/dashboard/summary` | ملخص لوحة التحكم |
| `POST /api/ai/response-feedback` | تقييم رد |
| `GET /api/visits/approve-by-client` (POST) / `approve-by-code` / `rate` | اعتماد/تقييم الزيارات |
| `GET /api/notifications?userId&role` · `POST` · `mark-read` · `mark-all-read` | الإشعارات |
| `GET /api/invite/current` · `POST /api/invites` · `GET /api/invites` | الروابط |
| `POST /api/device/authorize` `{userId,role,deviceId}` | تفويض الجهاز |
| `GET /api/users/lookup?id=` · `POST /api/users/link` · `POST /api/users/unlink` | إدارة المستخدمين |
| `POST /api/user/phone` `{userId,phone,whatsappEnabled}` | واتساب |
| `POST /api/admin/delete-user` · `restore-user` · `delete-company` · `restore-company` | مشرف النظام |
| `POST /api/contracts/ai-import-excel` (multipart) | استيراد Excel |
| `POST /api/push/register` | إشعارات الجهاز |
| `GET /api/auth/storage-token?role&userId` | مشرف: قراءة كل التخزين |
| `GET /api/whatsapp/status` | حالة واتساب |
| `POST /api/voice/synthesize` · `GET /api/voice/samples` · `POST /api/voice/samples/upload` · `/delete` · `/clear` · `GET /api/voice/settings` | الصوت المسجل |

---

## 5. قواعد العمل المحورية (تُنفَّذ حرفياً في Dart)

### 5.1 النطاق (Scope) — `sameCompany`
- `ownerId()`: حسب الدور (admin → `_linkedCoId`/companyOwnerId؛ غيره companyOwnerId أو الـ id).
- `recOwner(r) = r.companyOwnerId || r.createdBy || r.linkedBy || "platform"`.
- `sameCompany(r)`: owner == ownerId()، أو ينتمي لنفس `ownerCompanies` (عبر ownerIds/ownerId).
- `visibleContracts/Visits/Tickets`: client → يطابق عميله (هويته أو رقم موحد منشآته)؛ technician → زيارات/بلاغات مسندة له فقط؛ غيره → sameCompany.
- الزيارات "الملغية": تظهر للمديرين دائماً؛ للفني فقط خلال ساعة من الإلغاء (`canceledAtMs`).

### 5.2 حالات العقد
`بانتظار موافقة العميل` → (تفعيل) → `ساري` → (انتهاء) → `منتهيا`/`ملغي`/`محذوف`.
- عند التفعيل: `recordContractCollection` — إن `status=="ساري"` و`value>0` ولا يوجد قيد `type=="sale"` بنفس العقد و`collectionForStatus=="ساري"` → يُنشأ قيد `FIN-` مبلغ العقد بالكامل، ثم `ensureReceiptClaims` ينشئ مستخلصاً (`RCT-`) له.
- عقود الصيانة: عند التفعيل (يدوي/اعتماد AI) → `generateVisits` زيارات شهرية.
- `expireStaleContracts`: أي عقد بدايته قبل سنة وليس سارياً/ملغياً/محذوفاً/منتهياً → "منتهيا".
- التجديد: `endDate += contractYears`، الحالة "ساري".
- الإلغاء: تعليق كل زيارات العقد كـ"ملغية".

### 5.3 المالية — `contractFinanceInfo`
```dart
total = value;
paid  = sum(قيود direction=="in" لنفس contractId);
remaining = max(0, total - paid);
// للتركيب فقط:
overdue = Σ لكل دفعة في paymentPlan (أو defaultPaymentPlan):
    expected = total * pct; received = Σ قيود نفس contractId و paymentLabel==label و in;
    overdue += max(0, expected - received);
```
`defaultPaymentPlan()`: الدفعة الأولى 50% (عند توقيع العقد لتوريد وتركيب السكة والأبواب والبيت الحديدي)، الثانية 35% (الكابينة)، الثالثة 15% (المكينة ولوحة التحكم والتشغيل والاختبار).
- يجب أن مجموع نسب خطة الدفعات = 100% (تحقق قبل الحفظ للتركيب غير المُسلَّم).

### 5.4 الزيارات — SLA والاعتماد
- `slaInfo(t)`: الساعات منذ الإنشاء؛ الحد: urgent=4h، high=12h، غيرها 24h؛ متأخر = h>limit و status!=="مغلق".
- تقرير الزيارة يُنشأ فقط بواسطة الفني المسند (`canWriteReport`)؛ بعد الإنشاء: `visit.status="بانتظار الاعتماد"`، `visit.reportId`، التقرير `locked:true`.
- اعتماد العميل: `/api/visits/approve-by-client` أو `approve-by-code` (رمز 10 أرقام).
- التقييم: `/api/visits/rate` `{visitId,stars,notes,userId}`.

### 5.5 الموافقات
- عروض الأسعار: إنشاء بحالة "بانتظار المراجعة والاعتماد"؛ يمكن للمدير (owner/company_admin/admin) اعتماد/رفض، وللعميل (matchClient) اعتماد/رفض (يُعلَّم `approvedByClient`).
- المستندات: كل مستند جديد "بانتظار المراجعة والاعتماد"؛ الاعتماد/الرفض مع `approvedAt/approvedBy`.
- التوقيع/الختم في PDF من أحدث مستند معتمد قبل انتهائه.

### 5.6 الفاتورة التلقائية (بلاغات)
بعد إنشاء بلاغ: إن لم يوجد عقد صيانة "ساري" (startDate<=today<=endDate) يخص العميل أو العقد → يُنشأ `INV-<ts>` بقيمة **100** ريال، حالة "غير مدفوعة"، مع `bankAccount` من المنشأة، ويربط `ticket.invoiceId`.

### 5.7 صلاحيات
- owner / company_admin / admin = إدارة كاملة + ترويسة الشركة + تعديل العقود (إلا ساري/ملغي/محذوف).
- technician / engineer = عمليات فقط (بلاغاته، زياراته، تقرير الزيارة، موقعه) — لا تعديل عقود ولا ترويسة.
- client = عقوده ومنشآته فقط + اعتماد عروض/زيارات/تقييم.
- finance (الإدارة المالية): owner فقط.
- admin-system/storage-data/moderation/companies/users: admin فقط.
- `canEditContract = canManage && !["ساري","ملغي","محذوف"]`.

### 5.8 لوحة التنقل حسب الدور (من app.js `navs`)
- **owner**: overview, ai-admin, predictions, knowledge-base, analytics, drafts, operations, notifications, whatsapp, **finance**, contracts, assets, tickets, company-customers, quotes, default-items, claims, receipts, visits, meetings, tracking, reports, inventory, suppliers, team, company-docs, activity, company, entry-links, data-tools, voice-settings (+ knowledge-hub).
- **company_admin**: نفس owner بدون finance/claims/quotes/default-items/company-customers/activity/company/analytics، مع "الفنيون" بدل "فريق العمل".
- **technician**: overview, ai-admin, predictions, knowledge-base, notifications, drafts, tickets(بلاغاتي), visits(زياراتي), my-location, reports, voice-settings (+ knowledge-hub).
- **client**: overview, ai-admin, notifications, client-companies, contracts(عقودي), tickets, quotes, visits, reports, voice-settings (+ knowledge-hub).
- **admin**: كل ما عند owner + users, companies, moderation, storage-data + admin-system + admin-banners + admin-knowledge.
- وضع "adminMode=company" يُحوِّل تنقل admin إلى قائمة company_admin.
- **knowledge-hub** يُدرج ثانياً في كل الأدوار.

---

## 6. الثوابت الحرفية (للتطابق التام)

### 6.1 `specGroups` (7 تبويبات) — حقل `elevatorInfo`
1. **مواصفات المصعد**: elevatorType[ركاب,حمولة,بانوراما,طعام,سيارات]، usage[سكني,تجاري,فندقي,مستشفى,مواقف]، capacity, persons, stops, age, speed, travelHeight, shaftLength, shaftWidth, pitDepth, overhead, entrances[1,2,3]، doorDirection[سنتر,تلسكوبي]، speedSystem[VVVF,هيدروليك,سرعة واحدة,سرعتان]، doorType[أتوماتيك,نصف أتوماتيك]، **motorManufacturer[Italy Gears,Sicor,Montanari,Fuji,Ziehl-Abegg,محلي]**.
2. **المحرك والكنترول**: motorType[Gearless,Geared,Hydraulic]، motorPower, motorSpeed, controller[VEGA,Monarch,Arkel,Fuji,STEP]، ropeManufacturer[ATIKA,Gustav Wolf,PFEIFER,Brugg]، ropesCount, ropeDiameter, counterweight, railManufacturer[MF,Monteferro,Savera,Marazzi]، railSize, originCountry[إيطاليا,تركيا,ألمانيا,الصين,إسبانيا,محلي].
3. **الكابينة**: cabinSize, floorType[رخام,جرانيت,PVC,ستانلس]، wallType[ستانلس ستيل,زجاج,خشب,دهان]، ceilingType[ستانلس ستيل,سقف معلق,زجاج]، lightingType[LED,Spotlight,Indirect]، displayType[Digital,LCD,Dot Matrix]، risotType[أزرار ستانلس,Touch,Braille Buttons]، mirrors[نعم,لا]، fan، voiceAnnouncement، braille.
4. **الأبواب**: doorManufacturer[Sky,Fermator,Selcom,Wittur]، doorWidth, doorHeight, doorOpenTime, doorCloseTime, doorLockType[Electromechanical,Mechanical,Safety Lock].
5. **أنظمة الأمان**: bufferType[Hydraulic,Spring,Polyurethane]، rescueSystem, coolingSystem[مروحة,تكييف,لا يوجد]، intercom, camera, fireMode.
6. **الكهرباء**: voltage, frequency, phases, travelCableSize, powerConsumption.
7. **الضمان**: warranty[سنة,سنتان,3 سنوات,5 سنوات]، notes (textarea).

`specDefaults` قيم افتراضية (مثال: motorManufacturer:"محلي"، capacity:"450 كجم"، persons:"6"، stops:"3"، warranty:"5 سنوات"، voltage:"380V"...). كل حقل غير محدد يُعرض بافتراضيه.

### 6.2 `maintenanceSections` (بنود الصيانة الدورية)
- **غرفة المصعد** (12 بنداً): فحص زيت المحرك، قماش الفرامل، عمل الفرامل، السيور، سلكتور والطوابق، جهاز الهبوط الاضطراري، منظم السرعة، تنظيف الأرضية، سلامة التمديدات، عدم تهريب مياه، عدم تخزين، وجود التكييف.
- **بئر المصعد** (8): التوصيلات أعلى الصاعدة، الريفيزيون، حبال الجر وشداداتها، بكرات الحبال، تزييت أدلة السير، قواطع نهاية المشوار، مغناطيس الأدوار، مروحة الصاعدة.
- **داخل المصعد** (3): أزرار التحكم، الإنارة والجرس والانتركوم، تنظيف مجاري الأبواب.
- **أبواب الطوابق** (5): أبواب الأدوار، محركات الأبواب، الشوك والكوالين، مفصلات الأبواب، الكابلات والمؤشرات والمبينات.
- **حفرة البئر** (4): بكرة منظم السرعة، قواطع نهاية المشوار، التوصيلات أسفل الصاعدة، تنظيف الحفرة.
كل بند: `{id: "القسم-i", section, title, status: "مطلوب", checked, note}`.

### 6.3 أنماط المعرفات
`CONT####`، `FIN-<ts>`، `RCT-<ts>`، `CLM-<ts>`، `TKT-<ts>`، `VIS-K-<ts>`/`VIS-<ts>-i`، `REP-<ts>`، `QTO-<ts>`، `AST-<ts>`، `PRT-<ts>`، `SUP-<ts>`، `STF-<ts>`، `MTG-<ts>`، `MSG-<ts>`، `BNR-<ts>`، `KNO-<ts>`، `DOC-<ts>`، `CMP-<ts>`، `OWN-<ts>`، `INV-<ts>`، `ACT-<ts>`، `ADMIN-INV-<ts>`، `DRF-<ts>`، `CB-<ts>`.

---

## 7. القرارات التنفيذية للتطبيق

1. **الحالة (State):** لا يوجد مخزن محلي في الـ web؛ التطبيق سيحمل مفاتيح dashboardKeys عبر `/api/storage?keys=` عند الدخول ويُبقيها في الذاكرة (Provider/Riverpod)، مع كاش محلي (SharedPreferences/sqflite) للمزامنة عند الأوفلاين. أي عملية كتابة → POST `/api/storage/batch` فوراً (مع تأجيل/إعادة محاولة عند فشل الشبكة).
2. **PDF:** التطبيق لا يمكنه تنفيذ HTML/الطباعة بنفس آلية web. الحل المكافئ: إنشاء PDF عبر حزمة `pdf` (Dart) بترجمة القوالب الحرفية (العقد/عرض السعر/سند قبض/مستخلص/تقرير/فاتورة) بنفس المحتوى والترويسة (companyLetterhead كخلفية) والتوقيع/الختم من المستندات المعتمدة. تُوثَّق القوالب في `lib/pdf/` لاحقاً.
3. **الذكاء الاصطناعي/الصوت:** يمرَّران عبر نقاط API نفسها كما هي؛ في حالة غياب الشبكة يظهر تنبيه.
4. **المصادقة:** `/api/auth/login` أولاً؛ عند 404 → fallback للتحقق المحلي من `misadUsers` + مستخدمي النظام الثابتين (admin 2572280689، company_admin 2233556688، owner 1010389102). ثم `/api/device/authorize` عند وجود رابط دعوة.
5. **التصميم:** RTL بالكامل، ألوان العلامة (أخضر #0d312f/#1a4a44 + ذهبي #d4a24e)، خط Cairo، تسميات النوافذ/الأزرار عربية مطابقة تماماً للنص الأصلي.

---

## 8. خطة الملفات (Flutter)

```
app_flutter/
├── pubspec.yaml
├── lib/
│   ├── main.dart
│   ├── core/            # api_client, auth_service, storage_service, session, constants, ids
│   ├── models/          # contract, ticket, visit, visit_report, quote, receipt, claim,
│   │                    #   financial_entry, owner_company, client_company, staff, part,
│   │                    #   supplier, default_item, doc, asset, meeting, user, notification, banner, knowledge
│   ├── state/           # app_provider (تقسيم حسب الوحدة)
│   ├── screens/         # login, register, dashboard (shell) + وحدة لكل صفحة
│   ├── widgets/         # رأس، بطاقات، جداول، أزرار، badge، نوافذ، نماذج
│   └── pdf/             # مولّدات مستندات PDF
├── android/  ios/       # (يُنشأ عند البناء عبر flutter create)
└── DESIGN.md
```

> ملاحظة: مجلدات `android/` و`ios/` الحالية في جذر المشروع هي Capacitor ولا تُلمس. مشروع Flutter مستقل داخل `app_flutter/`.
