const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const {spawn} = require("child_process");
require("dotenv").config();

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
// CRITICAL DATA SAFETY:
// On Render, DATA_DIR and STORAGE_PATH must stay on the persistent disk (/var/data).
// Do not move storage.json back into the project directory. It contains users,
// passwords, contracts, quotes, documents, and all customer operational data.
const preferredDataDir = process.env.DATA_DIR || path.join(require("os").homedir(), ".elevator-data");
let dataDir = preferredDataDir;
try {
  fs.mkdirSync(dataDir, {recursive: true});
} catch {
  dataDir = path.join(root, ".elevator-data");
  fs.mkdirSync(dataDir, {recursive: true});
}
const storagePath = process.env.STORAGE_PATH || path.join(dataDir, "storage.json");
const storageFailover = path.join(require("os").homedir(), ".elevator-storage.json");
const legacyStoragePath = path.join(root, "storage.json");
const aiResponseBankPath = path.join(root, "ai-response-bank.json");
const voiceCacheDir = path.join(dataDir, ".voice-cache");
const entrySecret = process.env.SECRET_ENTRY_TOKEN || crypto.randomBytes(32).toString("hex");
const entryCookie = "misad_entry";
const inviteCookie = "misad_invite";
const deviceCookie = "misad_device";
const entryCookieValue = crypto.createHash("sha256").update(entrySecret).digest("hex");
let storeCache = null;
let storeMtime = 0;
const _lastQs = new Map(); // {userId: {q, time, answer}}

try {
  fs.mkdirSync(dataDir, {recursive: true});
  fs.mkdirSync(voiceCacheDir, {recursive: true});
} catch (err) {
  console.warn("Storage directory initialization failed:", err.message);
}

function loadAiResponseBank() {
  try {
    const bank = JSON.parse(fs.readFileSync(aiResponseBankPath, "utf8"));
    const records = Array.isArray(bank.records) ? bank.records : [];
    const byIntent = records.reduce((acc, item) => {
      const key = item.intent || "general";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      version: bank.version || 1,
      language: bank.language || "ar-SA",
      minimumPerIntent: Number(bank.minimumPerIntent || 19),
      total: records.length,
      intents: byIntent,
      samples: records.slice(0, 120)
    };
  } catch {
    return {version: 0, language: "ar-SA", minimumPerIntent: 19, total: 0, intents: {}, samples: []};
  }
}

function pickAiResponseVariants(intent = "general_answer", count = 10) {
  const bank = loadAiResponseBank();
  const records = Array.isArray(bank.samples) && bank.samples.length ? bank.samples : [];
  let fullRecords = records;
  try {
    const parsed = JSON.parse(fs.readFileSync(aiResponseBankPath, "utf8"));
    fullRecords = Array.isArray(parsed.records) ? parsed.records : records;
  } catch {}
  const wanted = String(intent || "general_answer");
  const matching = fullRecords.filter(x => x.intent === wanted);
  const fallback = fullRecords.filter(x => x.intent === "general_answer");
  const pool = matching.length >= count ? matching : [...matching, ...fallback, ...fullRecords];
  const seen = new Set();
  const variants = [];
  const offset = Math.floor(Math.random() * Math.max(pool.length, 1));
  for (let i = 0; i < pool.length && variants.length < count; i++) {
    const item = pool[(offset + i * 7) % pool.length];
    const text = String(item?.text || "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      variants.push({tone: item.tone || "", intent: item.intent || wanted, text});
    }
  }
  return variants;
}

function shumoosSystemUsageGuide() {
  return {
    identity: {
      systemNameArabic: "شموس",
      systemNameEnglish: "SHUMOOS ELEVATORS",
      productCategory: "نظام إدارة شركات ومؤسسات صيانة وتركيب المصاعد",
      visibleBrand: "شموس لإدارة أعمال المصاعد",
      owningCompanyKnowledge: "الهوية التشغيلية الظاهرة للمستخدم هي شموس. اسم خدمة النشر والمستودع هو Ertiqaa/ertiqaa. بيانات المنشأة المالكة لكل حساب تؤخذ من صفحة بيانات المنشأة ومن سجل ownerCompanies داخل النظام، ولا يتم اختلاق اسم شركة مالكة إذا لم يكن محفوظاً في البيانات.",
      purpose: "تجميع العقود، الزيارات، البلاغات، التقارير، عروض الأسعار، المستندات، الفريق، العملاء، المخزون، الموردين، المستخلصات، والذكاء الاصطناعي في لوحة تشغيل واحدة."
    },
    userJourney: [
      "الدخول يتم عبر رابط دخول/تسجيل جهاز سري يولده المالك أو الإداري أو مشرف النظام حسب الصلاحية.",
      "بعد الدخول تظهر لوحة التحكم وفيها ملخص العمليات والتنبيهات والإجراءات السريعة.",
      "يتنقل المستخدم من القائمة الجانبية بين المركز التوعوي، الإدارة الذكية، العقود، الزيارات، البلاغات، التقارير، المخزون، الموردين، المستندات، المستخدمين، وروابط التسجيل حسب دوره.",
      "أي عملية إنشاء تبدأ من زر واضح مثل عقد جديد، بلاغ جديد، زيارة جديدة، عرض سعر جديد، إضافة فني، إضافة مورد، أو من حقل الإدارة الذكية بالصوت أو النص.",
      "النظام يحفظ العمليات في التخزين المشترك، ويعرض البيانات بحسب نطاق الشركة وصلاحية المستخدم."
    ],
    rolesHowToUse: {
      admin: [
        "يدخل كـ مشرف النظام لمراقبة المنصة وإدارة روابط التسجيل للمالك والإداري والعميل.",
        "يدير البنرات وصفحات التوعية العامة.",
        "يراجع حالة الذكاء الاصطناعي وذاكرة المحادثات وسياق البيانات العام.",
        "لا يفترض أنه مالك شركة تشغيلية إلا إذا كانت بيانات المنشأة محفوظة."
      ],
      owner: [
        "يبدأ من صفحة بيانات المنشأة لإدخال اسم المنشأة والسجل والضريبة والجوال والعنوان وتذييل PDF.",
        "ينشئ روابط العملاء من روابط التسجيل.",
        "ينشئ العقود وعروض الأسعار والبلاغات والزيارات، ويضيف الفنيين والموردين وقطع الغيار.",
        "يراقب مركز التشغيل لمعرفة الزيارات المتأخرة والبلاغات المفتوحة ونواقص المخزون."
      ],
      company_admin: [
        "يدير عمليات الشركة نيابة عن المالك ضمن نطاق الشركة.",
        "ينشئ ويراجع العقود والزيارات والبلاغات والتقارير والمخزون والموردين.",
        "يتابع الاعتمادات ويرسل الروابط للعملاء حسب الصلاحية."
      ],
      technician: [
        "يدخل إلى زياراتي لعرض الزيارات المسندة.",
        "يفتح تواصل الزيارة أو يعبئ تقرير الزيارة عند السماح.",
        "يوثق الأعمال المنفذة والأعطال وقطع الغيار والتوصيات."
      ],
      client: [
        "يرى عقوده وبلاغاته وتقاريره ومنشآته فقط.",
        "يعتمد المستندات أو التقارير أو يتابع حالة الخدمة حسب ما يظهر له.",
        "لا يرى بيانات الشركات أو العملاء الآخرين."
      ]
    },
    pageGuide: {
      overview: "لوحة البداية: تعرض الملخص والإجراءات السريعة مثل عقد جديد، بلاغ جديد، زيارة جديدة، إضافة فني.",
      aiAdmin: "الإدارة الذكية: يستخدمها المستخدم لطلب تحليل أو تنفيذ أمر بالصوت أو النص مثل إنشاء عقد، تحليل المخزون، توزيع الزيارات، أو فتح نموذج مع تعبئة البيانات.",
      entryLinks: "روابط التسجيل: توليد رابط جهاز لمالك أو إداري أو عميل حسب الدور، ثم نسخه أو مشاركته.",
      contracts: "العقود: إنشاء عقد صيانة أو تركيب، ربط العميل والمنشأة والمباني والمصاعد والقيمة والبنود، ثم متابعة حالة الاعتماد.",
      assets: "أصول المصاعد: سجل المصاعد المرتبطة بالعقود أو المضافة يدوياً، مع المبنى والحي والماركة والسعة والحالة.",
      tickets: "البلاغات: تسجيل عطل أو طلب صيانة وربطه بعقد ومبنى وعميل وفني، ثم متابعة الحالة.",
      visits: "الزيارات: جدولة زيارة كشفية أو صيانة وربطها بعقد وموقع وفني، ثم تعبئة التقرير.",
      reports: "تقارير الزيارات: عرض التقارير الفنية واعتمادات العميل وإنشاء عرض سعر من التقرير عند الحاجة.",
      quotes: "عروض الأسعار: إنشاء عرض تركيب أو صيانة أو قطع غيار، حساب الإجمالي والضريبة وربط الموردين والقطع، ثم اعتماد أو رفض.",
      inventory: "المخزون وقطع الغيار: إضافة القطع والكميات وحد الطلب وتكلفة الوحدة وربط الموردين لاختيار أقل سعر.",
      suppliers: "الموردون: تسجيل الموردين وأرقامهم ومدنهم وتخصصاتهم وربطهم بأسعار قطع الغيار.",
      team: "فريق العمل: إضافة الفنيين والمهندسين بهوية ودور وحالة عمل.",
      tracking: "التتبع: متابعة مواقع الفنيين والزيارات حسب الصلاحية.",
      meetings: "الاجتماعات: إنشاء اجتماع ومشاركة رابطه مع الفريق.",
      companyDocs: "المستندات: رفع مستندات الشركة أو العميل ومراجعتها واعتمادها قبل الإرسال.",
      company: "بيانات المنشأة: حفظ اسم منشأة المالك والسجل التجاري والرقم الضريبي والجوال والعنوان.",
      clientCompanies: "منشآت العميل: يضيف العميل منشآته وأرقامها الموحدة والضريبية.",
      defaultItems: "البنود الافتراضية: إنشاء بنود جاهزة للعقود أو عروض الأسعار لتسريع الإنشاء.",
      claims: "المستخلصات: متابعة مستخلصات العقود والفترات والمبالغ المستحقة.",
      notifications: "الإشعارات: مركز تنبيهات حسب الدور والحالة.",
      activity: "سجل النشاط: آخر العمليات المهمة ومن نفذها.",
      knowledgeHub: "المركز التوعوي: صفحات سلامة ومعلومات مصاعد تظهر للمستخدمين.",
      adminKnowledge: "إدارة التوعية: للمشرف لإضافة ونشر صفحات التوعية.",
      adminBanners: "إدارة البنرات: للمشرف لإضافة بنرات تظهر في لوحة التحكم."
    },
    aiUsageTraining: [
      "إذا سأل المستخدم كيف أستخدم النظام، اشرح حسب دوره الحالي أولاً ثم اذكر الصفحات ذات الصلة.",
      "إذا قال: كيف أنشئ عقد؟ اشرح: العقود > عقد جديد > اختيار صيانة/تركيب > إدخال العميل/المنشأة > المباني والمصاعد > القيمة والبنود > حفظ > انتظار اعتماد العميل.",
      "إذا قال: كيف أسوي زيارة؟ اشرح: الزيارات > زيارة جديدة > تحديد العميل أو العقد > الموقع > الموعد > الفني أو الإسناد التلقائي > حفظ > متابعة التقرير.",
      "إذا قال: كيف أضيف عميل؟ اشرح حسب السياق: العميل كمستخدم عبر رابط عميل، أو منشأة عميل من منشآتي/العقد، أو بيانات العميل داخل العقد.",
      "إذا قال: كيف أستخدم الصوت؟ اشرح الضغط على زر المايك في الإدارة الذكية أو بجانب الحقول، التحدث بالعربية الطبيعية، ثم مراجعة البيانات قبل الحفظ.",
      "إذا قال: كيف أطلع PDF؟ وجهه إلى عرض العقد/التقرير/العرض ثم زر PDF عند توفره.",
      "إذا قال: كيف أعرف المتأخر؟ وجهه إلى مركز التشغيل أو اسأله أن يقول: حلل الزيارات المتأخرة.",
      "إذا قال: من أنت؟ اذكر أنك وكيل شموس الذكي لنظام إدارة شركات ومؤسسات صيانة وتركيب المصاعد، لا تدّع ملكية قانونية غير موجودة في البيانات.",
      "إذا قال: من الشركة المالكة؟ أجب بأن الهوية الظاهرة هي شموس، واسم النشر/المستودع Ertiqaa، أما منشأة المالك التشغيلية فتظهر من بيانات المنشأة المحفوظة داخل النظام."
    ],
    commandExamples: [
      "أنشئ عقد صيانة لمؤسسة الأفق بقيمة 12000 ريال.",
      "سوي زيارة كشفية لشركة النخبة يوم الأحد الساعة 9.",
      "افتح بلاغ عطل باب للمصعد في مبنى الرياض.",
      "حلل المخزون وقل لي القطع الناقصة.",
      "وزع الزيارات على الفنيين الأقل ضغطاً.",
      "أضف فني اسمه محمد ورقم هويته ...",
      "أنشئ عرض سعر من تقرير الزيارة.",
      "طلع لي روابط التسجيل المتاحة.",
      "اشرح للعميل حالة التقرير بلغة بسيطة."
    ]
  };
}

function shumoosProfessionalSpecialistDoctrine() {
  return {
    persona: "خبير تشغيلي محترف جداً في إدارة شركات ومؤسسات صيانة وتركيب المصاعد داخل نظام شموس.",
    specializationBoundaries: [
      "تحدث دائماً من زاوية تشغيل شركات المصاعد: السلامة، العقود، الزيارات، الأعطال، الفنيين، قطع الغيار، الموردين، الاعتمادات، والتقارير.",
      "لا تتصرف كمساعد عام عندما يكون السؤال متعلقاً بالنظام؛ اربط الإجابة بوحدات شموس وخطوات العمل الفعلية.",
      "إذا خرج السؤال عن نطاق المصاعد أو النظام، أجب باختصار ثم اربطه بما يفيد تشغيل الشركة إن أمكن.",
      "لا تخترع بيانات شركة أو عميل أو عقد أو فني. عند نقص البيانات قل بوضوح ما الناقص."
    ],
    professionalismStandards: [
      "ابدأ بالخلاصة التنفيذية عندما يكون السؤال إداريًا.",
      "قدّم توصية عملية قابلة للتنفيذ، وليس كلاماً عاماً.",
      "فرّق بين المعلومة المؤكدة، الاستنتاج، والتوصية.",
      "اذكر المخاطر التشغيلية عند وجود تأخير، عطل طارئ، نقص مخزون، أو اعتماد معلق.",
      "استخدم مصطلحات مهنية مفهومة: SLA، أولوية، أثر، إجراء تالي، اعتماد، إسناد، تكلفة، هامش، توريد، جاهزية.",
      "اجعل الرد الصوتي مختصراً وواثقاً، والرد المكتوب منظمًا عند التحليل."
    ],
    decisionFramework: [
      "للعقود: تحقق من الطرف الثاني، نوع العقد، القيمة، المدة، المباني، المصاعد، البنود، الاعتماد، وتواريخ البداية والنهاية.",
      "للزيارات: قيّم الموعد، الموقع، الفني، الحمل الحالي، الأولوية، حالة التقرير، وهل الزيارة متأخرة.",
      "للبلاغات: صنّف الخطورة، هل يوجد عالق أو توقف كامل أو باب أو اهتزاز أو صوت غير طبيعي، ثم اقترح التصعيد أو الزيارة.",
      "للمخزون: قارن الكمية بحد الطلب، التكلفة، المورد، توفر البدائل، والزيارات أو العروض التي تحتاج القطعة.",
      "للموردين: قيّم السعر، مدة التوريد، التخصص، التقييم، وارتباطه بقطع الغيار.",
      "للتقارير: افحص الأعمال المنفذة، الأعطال، القطع المطلوبة، التوصيات، اعتماد العميل، وإمكانية إنشاء عرض سعر.",
      "للصوت: استخدم صوت المالك المخصص فقط، ولا تعد بتشغيل صوت بديل."
    ],
    answerTemplates: {
      executive: "الخلاصة، السبب، الأثر، الإجراء التالي.",
      operational: "الوضع الحالي، ما يحتاج متابعة، من المسؤول، الموعد أو الأولوية.",
      customer: "شرح مبسط، حالة الطلب، الخطوة التالية، طمأنة بدون كشف بيانات داخلية.",
      technician: "المهمة، الموقع، المطلوب فحصه، التقرير المطلوب بعد التنفيذ.",
      dataQuality: "البيانات الناقصة، لماذا هي مهمة، كيف يكملها المستخدم داخل النظام."
    },
    qualityGateBeforeAnswer: [
      "هل أجبت حسب دور المستخدم وصلاحياته؟",
      "هل استخدمت بيانات النظام بدل الافتراض؟",
      "هل أعطيت خطوة عملية واضحة؟",
      "هل حافظت على تخصص المصاعد؟",
      "هل الرد متنوع الصياغة وغير مكرر؟",
      "هل يصلح للقراءة أو الصوت حسب سياق الطلب؟"
    ]
  };
}

function shumoosConversationContinuityDoctrine() {
  return {
    goal: "Every answer must check whether the user's latest message is connected to the previous assistant answer or previous user request.",
    relationshipTypes: {
      continuation: "The user continues the same topic, adds details, or asks for the next step.",
      correction: "The user corrects a previous assumption or says the answer was wrong, weak, generic, or incomplete.",
      approval: "The user agrees, says yes, says افعل ذلك, ارفع, كمل, or asks to execute a proposed step.",
      rejection: "The user rejects the previous answer, asks for a different style, or says it is not enough.",
      clarification: "The user asks what you meant, asks if something is possible, or requests a shorter explanation.",
      newTopic: "The user starts a clearly unrelated topic."
    },
    requiredProcess: [
      "Read the last user message and the previous assistant answer before replying.",
      "Classify the relationship type internally.",
      "If it is continuation, correction, approval, rejection, or clarification, explicitly use the previous context and do not restart as if it is a new conversation.",
      "If it is approval like افعل ذلك الآن, execute or describe the exact previously proposed action, not a generic action.",
      "If it is correction or rejection, acknowledge the issue briefly and improve the answer with a more precise operational response.",
      "If it is newTopic, transition cleanly and answer the new topic.",
      "For operational actions, preserve the same target entity from the previous context unless the user changes it.",
      "For voice mode, keep the continuity acknowledgement short."
    ],
    professionalPhrases: [
      "مفهوم، هذا مرتبط بالنقطة السابقة.",
      "صحيح، نكمل على نفس المسار.",
      "تمام، بناءً على كلامي السابق وردك الآن...",
      "واضح أن المطلوب تعديل الأسلوب لا تغيير الهدف.",
      "هنا نعتبر ردك موافقة على تنفيذ الخطوة السابقة.",
      "هذه متابعة للموضوع نفسه، لذلك سأكمل من آخر نقطة.",
      "لو اعتبرناها كتصحيح، فالأدق أن نقول...",
      "هذا موضوع جديد، وسأفصله عن النقطة السابقة."
    ],
    qualityGate: [
      "Do not ignore a short user reply like نعم، لا، ارفع، افعل، كمل، تمام.",
      "Resolve pronouns and references such as ذلك، هذا، السابق، الكلام، الرد، الميزة from conversation history.",
      "Avoid repeating the full previous answer; continue from the relevant point.",
      "If the reference is ambiguous, ask one short clarification question."
    ]
  };
}

function analyzeConversationLink(question, conversationHistory = []) {
  const q = String(question || "").trim();
  const recent = conversationHistory.slice(-4);
  const lastAssistant = [...recent].reverse().find(m => m.role === "assistant")?.content || "";
  const lastUser = [...recent].reverse().find(m => m.role === "user")?.content || "";
  let type = "newTopic";
  if (/^(نعم|ايه|إيه|ايوه|أيوه|تمام|اوكي|موافق|افعل|نفذ|سوي|كمل|ارفع|اعتمد|ابدأ|yes|ok)\b/i.test(q)) type = "approval";
  else if (/^(لا|مو كذا|ليس هذا|غلط|خطأ|ما زال|مازال|غير صحيح|ما عجبني|جامد|ضعيف|غير كافي|مش كافي)/i.test(q)) type = "rejection";
  else if (/(اقصد|أقصد|تصحيح|صحح|عدّل|عدل|بدل|خليها|اجعلها|أريدها|عاوز|ابغا|أبغى)/i.test(q)) type = "correction";
  else if (/(كيف|لماذا|هل|وضح|اشرح|اختصر|ما معنى|يعني)/i.test(q) && /(هذا|ذلك|السابق|ردك|كلامك|الميزة|النظام|هو|هي)/i.test(q)) type = "clarification";
  else if (/(ذلك|هذا|السابق|ردك|كلامك|نفس|أيضا|كمان|زد|أضف|تابع|استمر|بناء|وفقا|حسب)/i.test(q)) type = "continuation";
  return {
    type,
    linked: type !== "newTopic",
    currentUserMessage: q.slice(0, 500),
    previousUserMessage: String(lastUser).slice(0, 500),
    previousAssistantAnswer: String(lastAssistant).slice(0, 900),
    instruction: type === "newTopic"
      ? "Treat as a new topic unless semantic similarity to previous context is obvious."
      : "This message is linked to the previous context. Continue from the previous assistant answer and user intent; do not restart or ignore the reference."
  };
}

// --- دالة اقتراحات ذكية حسب السياق والصلاحية ---
function smartSuggests(topic, role) {
  const canManage = ["owner", "company_admin", "admin"].includes(role);
  const canEdit = canManage;
  const map = {
    contract: [
      "إذا احتجت أي مساعدة أخرى أو رغبت في تعديل العقد — إذا كانت لديك الصلاحية — فأخبرني وسأساعدك.",
      "إذا أردت الاطلاع على أي جزء آخر من العقد أو إجراء أي تعديل متاح لك، فأنا جاهز للمساعدة.",
      "إذا أردت مراجعة بند معين أو تعديل بيانات العقد وفق صلاحياتك، فقط أخبرني.",
      "إذا كان لديك استفسار آخر عن العقد أو ترغب في تنفيذ عملية أخرى، فأنا في خدمتك."
    ],
    visit: [
      "إذا احتجت إعادة جدولة الزيارة أو إسنادها لفني آخر، فقط أخبرني.",
      "إذا أردت تفاصيل أكثر عن الزيارة أو تغيير موعدها، أنا موجود."
    ],
    ticket: [
      "إذا احتجت تغيير أولوية البلاغ أو إسناده لفني، فقط أخبرني.",
      "إذا أردت متابعة البلاغ أو تحديث حالته، أنا هنا."
    ],
    staff: [
      "إذا احتجت إضافة فني آخر أو تعديل بياناته، فقط أخبرني.",
      "إذا أردت معرفة حمل عمل الفريق أو توزيع المهام، أنا موجود."
    ],
    quote: [
      "إذا احتجت تعديل عرض السعر أو إنشاء عرض جديد، فقط أخبرني.",
      "إذا أردت الاطلاع على تفاصيل العرض أو طباعته، أنا هنا."
    ],
    inventory: [
      "إذا احتجت إضافة قطعة جديدة أو تعديل الكميات، فقط أخبرني.",
      "إذا أردت تقرير كامل عن المخزون، أنا جاهز."
    ],
    general: canManage ? [
      "إذا احتجت شيئاً آخر — إنشاء عقد، بلاغ، زيارة، أو تقرير — أنا هنا.",
      "تقدر تسألني عن أي شيء: العقود، الزيارات، الفنيين، المخزون. أنا موجود.",
      "أنا في خدمتك. فقط تفضل بطلبك وسأنفذه فوراً — إذا كانت لديك الصلاحية."
    ] : [
      "إذا كان لديك استفسار آخر، فأنا هنا للمساعدة.",
      "تقدر تسألني عن أي شيء يخص حسابك."
    ]
  };
  const arr = map[topic] || map.general;
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- دالة تكرار السؤال ---
function repeatNote(userId, q, currentAnswer) {
  const now = Date.now();
  const prev = _lastQs.get(userId);
  const hash = q.replace(/[؟?~!\s]/g, '').trim();
  if (prev && prev.hash === hash && (now - prev.time) < 120000) {
    const repeats = (prev.repeats || 1) + 1;
    _lastQs.set(userId, {hash, time: now, repeats, answer: currentAnswer});
    const notes = [
      `لقد سألت عن هذا قبل قليل، والإجابة ما زالت كما هي:\n`,
      `يبدو أنك كررت السؤال، ولا توجد تغييرات منذ آخر استعلام.\n`,
      `الإجابة لم تتغير منذ آخر مرة سألت فيها.\n`,
      `ألاحظ أن هذا السؤال تكرر أكثر من مرة خلال وقت قصير.\n`
    ];
    if (repeats > 3) return notes[3] + currentAnswer + "\n\nإذا كنت تقصد شيئاً آخر، فأخبرني.";
    return notes[(repeats - 1) % notes.length] + currentAnswer;
  }
  _lastQs.set(userId, {hash, time: now, repeats: 1, answer: currentAnswer});
  return currentAnswer;
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac"
};

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const index = part.indexOf("=");
    if (index === -1) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

function hasEntryAccess(req) {
  return parseCookies(req.headers.cookie)[entryCookie] === entryCookieValue;
}

function sign(value) {
  return crypto.createHmac("sha256", entrySecret).update(value).digest("hex");
}

function hasDeviceAccess(req) {
  const token = parseCookies(req.headers.cookie)[deviceCookie] || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, deviceId, sig] = parts;
  return Boolean(userId && deviceId && sig === sign(`${userId}:${deviceId}`));
}

function readStore() {
  try {
    const stat = fs.existsSync(storagePath) ? fs.statSync(storagePath) : null;
    const mtime = stat?.mtimeMs || 0;
    if (storeCache && mtime === storeMtime) return storeCache;
    storeCache = JSON.parse((fs.readFileSync(storagePath, "utf8") || "{}").replace(/^\uFEFF/,""));
    storeMtime = mtime;
    return storeCache;
  } catch {
    storeCache = {};
    storeMtime = 0;
    return storeCache;
  }
}

function writeStore(store) {
  const data = JSON.stringify(store, null, 2);
  try { if (!fs.existsSync(path.dirname(storagePath))) fs.mkdirSync(path.dirname(storagePath), {recursive: true}); } catch {}
  const currentStat = fs.existsSync(storagePath) ? fs.statSync(storagePath) : null;
  if (currentStat && storeMtime && currentStat.mtimeMs !== storeMtime && process.env.ALLOW_STALE_STORAGE_WRITE !== "1") {
    storeCache = null;
    storeMtime = 0;
    throw new Error("Storage changed on disk before this write. Reload storage first to avoid overwriting newer data.");
  }
  try {
    if (currentStat) {
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, {recursive: true});
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      fs.copyFileSync(storagePath, path.join(backupDir, `prewrite-${ts}.json`));
    }
  } catch {}
  fs.writeFileSync(storagePath, data, "utf8");
  try { fs.writeFileSync(storageFailover, data, "utf8"); } catch {}
  storeCache = store;
  storeMtime = fs.statSync(storagePath).mtimeMs;
}

const backupDir = path.join(dataDir, "backups");
const backupMaxAgeDays = Math.max(1, Number(process.env.AI_BACKUP_RETENTION_DAYS || 30));
const backupIntervalMs = Math.max(60000, Number(process.env.AI_BACKUP_INTERVAL_MINUTES || 360) * 60000);

function backupStorage(store) {
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, {recursive: true});
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = path.join(backupDir, `storage-${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(store, null, 2), "utf8");
    // Cleanup old backups
    const files = fs.readdirSync(backupDir).filter(f => /^(storage|prewrite)-.+\.json$/.test(f)).sort();
    const cutoff = Date.now() - backupMaxAgeDays * 86400000;
    for (const f of files) {
      const fp = path.join(backupDir, f);
      if (fs.statSync(fp).mtimeMs < cutoff) {
        try { fs.unlinkSync(fp) } catch {}
      }
    }
    return {ok: true, path: backupPath, timestamp: ts, totalBackups: files.length};
  } catch (err) {
    return {ok: false, error: err.message};
  }
}

function listBackups() {
  try {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir).filter(f => f.startsWith("storage-") && f.endsWith(".json")).sort().reverse().map(f => {
      const fp = path.join(backupDir, f);
      const stat = fs.statSync(fp);
      return {name: f, size: stat.size, mtime: stat.mtimeMs};
    });
  } catch { return [] }
}

function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function cleanId(v){return String(v||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g,"")}
const blockedIds=["0000000000","1111111111","3333333333"];function isValidId(v){const c=cleanId(v);return c.length>=6&&!blockedIds.includes(c)&&/^[12]/.test(c)}
function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function internetKnowledgeSources() {
  const envSources = String(process.env.AI_INTERNET_SOURCES || "").split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
  return envSources.length ? envSources : [
    "https://www.otis.com/en/us/tools-resources/elevator-maintenance",
    "https://www.kone.com/en/news-and-insights/stories/elevator-maintenance.aspx",
    "https://www.schindler.com/en/elevators/service-maintenance.html"
  ];
}

function internetKnowledgeList(store) {
  return parseStoredJson(store, "misadInternetKnowledge");
}

function internetKnowledgeSummary(store) {
  const items = internetKnowledgeList(store).filter(x => x && x.status === "ready").slice(0, 20);
  return {
    enabled: process.env.AI_INTERNET_ENABLED === "1",
    lastUpdatedAt: items[0]?.updatedAt || "",
    count: items.length,
    policy: "External internet knowledge supports wording and general elevator best practices only. Internal Shumoos operational data remains the source of truth for contracts, customers, technicians, visits, prices, and documents.",
    items: items.map(x => ({title: x.title, url: x.url, updatedAt: x.updatedAt, summary: x.summary}))
  };
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeInternetText(text, url) {
  const clean = String(text || "").slice(0, 7000);
  const keywords = ["maintenance", "safety", "inspection", "modernization", "elevator", "lift", "service", "preventive"];
  const sentences = clean.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 60 && keywords.some(k => s.toLowerCase().includes(k))).slice(0, 8);
  return (sentences.length ? sentences : clean.split(/(?<=[.!?])\s+/).slice(0, 5)).join(" ").slice(0, 1600) || `External elevator operations reference fetched from ${url}.`;
}

async function updateInternetKnowledge(store, options = {}) {
  if (process.env.AI_INTERNET_ENABLED !== "1" && !options.force) return {enabled: false, updated: 0, message: "AI_INTERNET_ENABLED is not enabled"};
  const sources = internetKnowledgeSources().slice(0, Number(process.env.AI_INTERNET_MAX_SOURCES || 8));
  const byUrl = new Map(internetKnowledgeList(store).map(x => [x.url, x]));
  const updated = [];
  for (const url of sources) {
    try {
      const response = await fetch(url, {headers: {"User-Agent": "ShumoosAI/1.0"}, signal: AbortSignal.timeout(Math.max(3000, Math.min(20000, Number(process.env.AI_INTERNET_TIMEOUT_MS || 8000))))});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const text = htmlToPlainText(html);
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url).replace(/\s+/g, " ").trim();
      const item = {id: crypto.createHash("sha1").update(url).digest("hex").slice(0, 12), url, title, status: "ready", summary: summarizeInternetText(text, url), textSample: text.slice(0, 2500), updatedAt: new Date().toISOString(), sourceType: "trusted-url"};
      byUrl.set(url, item);
      updated.push(item);
    } catch (err) {
      byUrl.set(url, {...(byUrl.get(url) || {id: crypto.createHash("sha1").update(url).digest("hex").slice(0, 12), url}), status: "error", error: err.message || "fetch failed", updatedAt: new Date().toISOString(), sourceType: "trusted-url"});
    }
  }
  store.misadInternetKnowledge = JSON.stringify([...byUrl.values()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 100));
  writeStore(store);
  return {enabled: true, sources: sources.length, updated: updated.length, knowledge: internetKnowledgeSummary(store)};
}

function publicOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const hostName = req.headers["x-forwarded-host"] || req.headers.host || `${host}:${port}`;
  return `${proto}://${hostName}`;
}

function voiceSampleList() {
  const allowed = new Set([".aac", ".m4a", ".mp3", ".wav", ".ogg", ".flac"]);
  try {
    return fs.readdirSync(root, {withFileTypes: true})
      .filter(item => item.isFile() && allowed.has(path.extname(item.name).toLowerCase()))
      .map(item => {
        const filePath = path.join(root, item.name);
        const stat = fs.statSync(filePath);
        return {
          name: item.name,
          ext: path.extname(item.name).toLowerCase(),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          url: `/${encodeURIComponent(item.name)}`
        };
      })
      .sort((a, b) => b.size - a.size)
      .slice(0, 200);
  } catch {
    return [];
  }
}

function voiceSampleSignature(samples) {
  return crypto.createHash("sha256")
    .update(samples.map(s => `${s.name}:${s.size}:${s.updatedAt}`).join("|"))
    .digest("hex");
}

function voiceCacheKey(text, model, samples) {
  return crypto.createHash("sha256")
    .update(JSON.stringify({text, model, samples: voiceSampleSignature(samples)}))
    .digest("hex");
}

function readVoiceCache(key) {
  const audioPath = path.join(voiceCacheDir, `${key}.audio`);
  const metaPath = path.join(voiceCacheDir, `${key}.json`);
  if (!fs.existsSync(audioPath) || !fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8") || "{}");
    return {audio: fs.readFileSync(audioPath), contentType: meta.contentType || "audio/wav"};
  } catch {
    return null;
  }
}

function writeVoiceCache(key, audio, contentType) {
  try {
    fs.mkdirSync(voiceCacheDir, {recursive: true});
    fs.writeFileSync(path.join(voiceCacheDir, `${key}.audio`), audio);
    fs.writeFileSync(path.join(voiceCacheDir, `${key}.json`), JSON.stringify({contentType, createdAt: new Date().toISOString()}));
  } catch {}
}

function jameelVoiceRoot() {
  const configured = process.env.JAMEEL_VOICE_ROOT || "D:\\البرمجيات - نسخ احتياطية\\jameel-ai";
  return fs.existsSync(path.join(configured, "inference", "voice.py")) ? configured : "";
}

function jameelVoicePython(rootPath) {
  const localPython = path.join(rootPath, "venv", "Scripts", "python.exe");
  return fs.existsSync(localPython) ? localPython : (process.env.PYTHON || "python");
}

function jameelVoiceReady() {
  const endpoint = process.env.JAMEEL_VOICE_ENDPOINT || "";
  if (endpoint && /^https?:\/\//i.test(endpoint)) {
    return {ready: true, root: "", references: 0, remote: true, endpoint: endpoint.replace(/\/+$/, "")};
  }
  const rootPath = jameelVoiceRoot();
  if (!rootPath) return {ready: false, root: "", references: 0};
  const refs = path.join(rootPath, "voice_samples", "wav");
  let references = 0;
  try {
    references = fs.readdirSync(refs).filter(name => name.toLowerCase().endsWith(".wav")).length;
  } catch {}
  return {ready: references > 0, root: rootPath, references};
}

function jameelVoiceEndpoint() {
  return (process.env.JAMEEL_VOICE_ENDPOINT || "http://127.0.0.1:5050").replace(/\/+$/, "");
}

function jameelSynthesize(text) {
  const status = jameelVoiceReady();
  if (!status.ready) return Promise.reject(new Error("بصمة jameel-ai المحلية غير جاهزة."));
  const endpoint = jameelVoiceEndpoint();
  const timeoutMs = Math.max(10000, Math.min(120000, Number(process.env.JAMEEL_VOICE_TIMEOUT_MS || 90000)));
  const endpointRequest = fetch(`${endpoint}/speech`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({text, style: "sudanese"})
  }).then(async response => {
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`jameel-ai API failed (${response.status}): ${details.slice(0, 300)}`);
    }
    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "audio/wav",
      source: "jameel-ai-api"
    };
  });
  if (status.remote || process.env.JAMEEL_VOICE_ALLOW_DIRECT !== "1") return endpointRequest;
  return endpointRequest.catch(() => jameelSynthesizeDirect(text, status, timeoutMs));
}

function jameelSynthesizeDirect(text, status, timeoutMs) {
  const script = [
    "import json, sys",
    "from inference.voice import synthesize",
    "text = json.loads(sys.argv[1])",
    "path = synthesize(text, style='sudanese')",
    "print(str(path), flush=True)"
  ].join("; ");
  return new Promise((resolve, reject) => {
    const child = spawn(jameelVoicePython(status.root), ["-c", script, JSON.stringify(text)], {
      cwd: status.root,
      windowsHide: true,
      env: {...process.env, PYTHONIOENCODING: "utf-8"}
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error("انتهت مهلة توليد الصوت المحلي."));
    }, timeoutMs);
    child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
    child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
    child.on("error", err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error((stderr || stdout || `jameel-ai exited with code ${code}`).slice(0, 500)));
      const audioPath = stdout.trim().split(/\r?\n/).pop();
      if (!audioPath || !fs.existsSync(audioPath)) return reject(new Error("لم يتم العثور على ملف الصوت الناتج من jameel-ai."));
      resolve({audio: fs.readFileSync(audioPath), contentType: "audio/wav", source: "jameel-ai"});
    });
  });
}

function inviteList(store) {
  try {
    return JSON.parse(store.misadEntryInvites || "[]");
  } catch {
    return [];
  }
}

function saveInvites(store, invites) {
  store.misadEntryInvites = JSON.stringify(invites.slice(0, 200));
  writeStore(store);
}

function createInvite(input = {}) {
  const maxUses = Math.max(1, Math.min(20, Number(input.maxUses || 1)));
  const minutes = Math.max(1, Math.min(1440, Number(input.minutes || 10)));
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  return {
    id: `INV-${now}`,
    token,
    label: String(input.label || "رابط دخول عميل").slice(0, 80),
    targetRole: String(input.targetRole || "client"),
    targetUserId: String(input.targetUserId || ""),
    createdBy: String(input.createdBy || ""),
    createdByName: String(input.createdByName || ""),
    createdAt: new Date(now).toISOString(),
    expiresAtMs: now + minutes * 60000,
    maxUses,
    used: 0,
    kind: String(input.kind || "device"),
    revoked: false,
    companyOwnerId: String(input.companyOwnerId || "")
  };
}

function sendLocked(res) {
  res.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متاح</title><body style="font-family:Arial,Tahoma,sans-serif;background:#f7f3ec;color:#17231f;display:grid;min-height:100vh;place-items:center;margin:0"><main style="max-width:520px;padding:32px;text-align:center"><h1>الرابط غير متاح</h1><p>لا يمكن فتح النظام إلا من خلال رابط الدخول السري المرسل من المالك أو الإداري.</p></main></body></html>`);
}

function sendMobileAssociation(res, pathname) {
  const androidPackage = process.env.ANDROID_PACKAGE_NAME || "com.ertiqaa.app";
  const androidFingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "").split(",").map(x => x.trim()).filter(Boolean);
  const iosTeamId = process.env.IOS_TEAM_ID || "";
  const iosBundleId = process.env.IOS_BUNDLE_ID || "com.ertiqaa.app";
  if (pathname === "/.well-known/assetlinks.json") {
    sendJson(res, 200, androidFingerprints.length ? [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {namespace: "android_app", package_name: androidPackage, sha256_cert_fingerprints: androidFingerprints}
    }] : []);
    return true;
  }
  if (pathname === "/.well-known/apple-app-site-association") {
    res.writeHead(200, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
    res.end(JSON.stringify({applinks: {apps: [], details: iosTeamId ? [{appIDs: [`${iosTeamId}.${iosBundleId}`], components: [{"/": "/invite/*"}, {"/": "/dashboard.html"}, {"/": "/login.html"}]}] : []}}));
    return true;
  }
  return false;
}

function notificationList(store) {
  try { return JSON.parse(store.misadNotifications || "[]"); } catch { return []; }
}

function saveNotifications(store, notifications) {
  store.misadNotifications = JSON.stringify(notifications.slice(0, 500));
  writeStore(store);
}

function aiMemoryList(store) {
  try { return JSON.parse(store.misadAiMemory || "[]"); } catch { return []; }
}

function saveAiMemory(store, memory) {
  store.misadAiMemory = JSON.stringify(memory.slice(0, 500));
  writeStore(store);
}

function aiConversationList(store) {
  try { return JSON.parse(store.misadAiConversations || "[]"); } catch { return []; }
}

function saveAiConversations(store, conversations) {
  store.misadAiConversations = JSON.stringify(conversations.slice(0, 200));
  writeStore(store);
}

function getOrCreateConversation(store, userId, role) {
  const conversations = aiConversationList(store);
  let conversation = conversations.find(c => c.userId === userId && c.role === role && !c.endedAt);
  if (!conversation) {
    conversation = {
      id: `CONV-${Date.now()}`,
      userId,
      role,
      messages: [],
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      endedAt: null
    };
    conversations.unshift(conversation);
    saveAiConversations(store, conversations);
  }
  return conversation;
}

function addMessageToConversation(store, conversationId, role, content) {
  const conversations = aiConversationList(store);
  const conversation = conversations.find(c => c.id === conversationId);
  if (conversation) {
    conversation.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    conversation.lastActivityAt = new Date().toISOString();
    // Keep only last 20 messages to maintain context
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }
    saveAiConversations(store, conversations);
  }
  return conversation;
}

function endConversation(store, conversationId) {
  const conversations = aiConversationList(store);
  const conversation = conversations.find(c => c.id === conversationId);
  if (conversation) {
    conversation.endedAt = new Date().toISOString();
    saveAiConversations(store, conversations);
  }
}

function analyzeReportForQuote(report, store) {
  const findings = {
    needsSpareParts: false,
    needsInstallation: false,
    needsUpdate: false,
    needsReplacement: false,
    needsAdditionalWorks: false,
    requiredParts: [],
    recommendations: [],
    severity: "low"
  };
  
  const reportText = String(report.description || report.details || report.notes || "").toLowerCase();
  const reportType = String(report.type || report.visitType || "").toLowerCase();
  
  // Analyze report content for indicators
  const sparePartsKeywords = ["قطع غيار", "استبدال قطعة", "قطعة تالفة", "قطعة معطلة", "جزء تالف", "يحتاج قطعة", "قطعة جديدة", "تغيير قطعة", "spare part", "replacement part"];
  const installationKeywords = ["تركيب مصعد", "installation", "install elevator", "new elevator", "مصعد جديد"];
  const updateKeywords = ["تحديث", "upgrade", "modernization", "تحديث نظام", "تحديث تحكم"];
  const replacementKeywords = ["استبدال مصعد", "replace elevator", "مصعد قديم", "استبدال كامل"];
  const additionalWorksKeywords = ["أعمال إضافية", "additional work", "عمل إضافي", "تعديل", "إصلاح إضافي"];
  
  findings.needsSpareParts = sparePartsKeywords.some(kw => reportText.includes(kw));
  findings.needsInstallation = installationKeywords.some(kw => reportText.includes(kw));
  findings.needsUpdate = updateKeywords.some(kw => reportText.includes(kw));
  findings.needsReplacement = replacementKeywords.some(kw => reportText.includes(kw));
  findings.needsAdditionalWorks = additionalWorksKeywords.some(kw => reportText.includes(kw));
  
  // Determine severity based on keywords
  const criticalKeywords = ["خطر", "danger", "emergency", "طارئ", "خطير", "توقف كامل", "complete failure"];
  const highKeywords = ["عالي", "high priority", "مهم", "important", "أولوية عالية"];
  
  if (criticalKeywords.some(kw => reportText.includes(kw))) {
    findings.severity = "critical";
  } else if (highKeywords.some(kw => reportText.includes(kw))) {
    findings.severity = "high";
  } else if (findings.needsReplacement || findings.needsInstallation) {
    findings.severity = "high";
  } else if (findings.needsSpareParts || findings.needsUpdate) {
    findings.severity = "medium";
  }
  
  // Extract potential parts mentioned (simple extraction)
  const parts = parseStoredJson(store, "misadPartsInventory");
  const mentionedParts = parts.filter(p => reportText.includes(p.name.toLowerCase()) || reportText.includes(p.sku?.toLowerCase() || ""));
  findings.requiredParts = mentionedParts.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    suggestedQty: 1,
    unitCost: p.unitCost || 0
  }));
  
  // Generate recommendations
  if (findings.needsSpareParts) {
    findings.recommendations.push("يحتاج إلى توريد قطع غيار - يوصى بإصدار عرض سعر");
  }
  if (findings.needsInstallation) {
    findings.recommendations.push("يحتاج إلى تركيب مصعد جديد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsUpdate) {
    findings.recommendations.push("يحتاج إلى تحديث المصعد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsReplacement) {
    findings.recommendations.push("يحتاج إلى استبدال المصعد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsAdditionalWorks) {
    findings.recommendations.push("يحتاج إلى أعمال إضافية - يوصى بإصدار عرض سعر");
  }
  
  return findings;
}

function findBestSupplierForParts(parts, store) {
  const suppliers = parseStoredJson(store, "misadSuppliers");
  const partsInventory = parseStoredJson(store, "misadPartsInventory");
  
  return parts.map(part => {
    const partInventory = partsInventory.find(p => p.id === part.id);
    const supplierId = partInventory?.supplier || "";
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // Find alternative suppliers with better prices
    const alternatives = suppliers
      .filter(s => s.category === part.category || !part.category)
      .map(s => ({
        id: s.id,
        name: s.name,
        rating: s.rating || 0,
        // In a real system, this would query supplier pricing
        estimatedPrice: part.unitCost * (1 - (s.rating || 0) * 0.05) // Simple estimation
      }))
      .sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    
    return {
      ...part,
      bestSupplier: alternatives[0] || supplier,
      alternatives: alternatives.slice(1, 3)
    };
  });
}

function generateAutoQuote(report, analysis, store, userId) {
  const contracts = parseStoredJson(store, "misadContracts");
  const contract = contracts.find(c => c.id === report.contractId);
  
  const quote = {
    id: `QTO-${Date.now()}`,
    title: `عرض سعر تلقائي بناءً على تقرير ${report.id}`,
    client: contract?.clientName || contract?.clientCompanyName || "غير محدد",
    clientId: contract?.clientId || "",
    clientCompanyUnifiedNumber: contract?.clientCompanyUnifiedNumber || "",
    contractId: report.contractId,
    reportId: report.id,
    value: 0,
    status: "بانتظار المراجعة والاعتماد",
    autoGenerated: true,
    analysis: analysis,
    items: [],
    customItems: [],
    elevatorInfo: contract?.elevatorInfo || {},
    details: `عرض سعر تم إنشاؤه تلقائياً بناءً على تحليل تقرير الزيارة ${report.id}. الشدة: ${analysis.severity}. التوصيات: ${analysis.recommendations.join("، ")}`,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now()
  };
  
  // Add parts to quote items
  const partsWithSuppliers = findBestSupplierForParts(analysis.requiredParts, store);
  let totalValue = 0;
  
  partsWithSuppliers.forEach(part => {
    const price = part.bestSupplier?.estimatedPrice || part.unitCost || 0;
    totalValue += price;
    quote.items.push({
      id: Date.now() + Math.random(),
      type: "spare_part",
      title: part.name,
      description: `قطعة غيار - ${part.category || "عام"} - المورد المفضل: ${part.bestSupplier?.name || "غير محدد"}`,
      price: price,
      supplier: part.bestSupplier?.name || "",
      partId: part.id
    });
  });
  
  // Add service fees based on severity
  const serviceFees = {
    critical: 500,
    high: 300,
    medium: 200,
    low: 100
  };
  
  if (analysis.needsInstallation) {
    quote.customItems.push({
      title: "رسوم تركيب المصعد",
      description: "خدمة تركيب مصعد جديد",
      price: serviceFees[analysis.severity] * 10
    });
    totalValue += serviceFees[analysis.severity] * 10;
  }
  
  if (analysis.needsUpdate) {
    quote.customItems.push({
      title: "رسوم تحديث المصعد",
      description: "خدمة تحديث نظام المصعد",
      price: serviceFees[analysis.severity] * 5
    });
    totalValue += serviceFees[analysis.severity] * 5;
  }
  
  if (analysis.needsReplacement) {
    quote.customItems.push({
      title: "رسوم استبدال المصعد",
      description: "خدمة استبدال المصعد القديم",
      price: serviceFees[analysis.severity] * 8
    });
    totalValue += serviceFees[analysis.severity] * 8;
  }
  
  quote.value = totalValue;
  
  return quote;
}

function optimizeQuotePrices(quote, targetValue, store) {
  const suppliers = parseStoredJson(store, "misadSuppliers");
  const partsInventory = parseStoredJson(store, "misadPartsInventory");
  
  const result = {
    originalValue: quote.value || 0,
    targetValue: targetValue,
    achievable: false,
    newValue: 0,
    changes: [],
    requiresApproval: false,
    approvalDetails: null
  };
  
  let currentValue = result.originalValue;
  
  // First, try to optimize parts prices
  quote.items.forEach(item => {
    if (item.type === "spare_part" && item.partId) {
      const part = partsInventory.find(p => p.id === item.partId);
      if (part) {
        const alternatives = suppliers
          .filter(s => s.category === part.category || !part.category)
          .map(s => ({
            id: s.id,
            name: s.name,
            rating: s.rating || 0,
            estimatedPrice: part.unitCost * (1 - (s.rating || 0) * 0.05)
          }))
          .sort((a, b) => a.estimatedPrice - b.estimatedPrice);
        
        if (alternatives.length > 0) {
          const bestAlternative = alternatives[0];
          const savings = item.price - bestAlternative.estimatedPrice;
          
          if (savings > 0) {
            result.changes.push({
              type: "part_price",
              itemName: item.title,
              originalPrice: item.price,
              newPrice: bestAlternative.estimatedPrice,
              savings: savings,
              newSupplier: bestAlternative.name
            });
            item.price = bestAlternative.estimatedPrice;
            item.supplier = bestAlternative.name;
            currentValue -= savings;
          }
        }
      }
    }
  });
  
  result.newValue = currentValue;
  
  // If still above target, check if we need to reduce service fees
  if (currentValue > targetValue) {
    const difference = currentValue - targetValue;
    const totalServiceFees = quote.customItems.reduce((sum, item) => sum + (item.price || 0), 0);
    
    if (totalServiceFees > 0 && difference <= totalServiceFees) {
      result.requiresApproval = true;
      result.approvalDetails = {
        type: "service_fee_reduction",
        currentTotal: totalServiceFees,
        proposedReduction: difference,
        newTotal: totalServiceFees - difference,
        impact: "تخفيض في رسوم الخدمة"
      };
      result.changes.push(result.approvalDetails);
      result.newValue = targetValue;
      result.achievable = true;
    } else if (totalServiceFees > 0) {
      // Can reduce all service fees but still won't reach target
      result.requiresApproval = true;
      result.approvalDetails = {
        type: "service_fee_reduction",
        currentTotal: totalServiceFees,
        proposedReduction: totalServiceFees,
        newTotal: 0,
        impact: "إلغاء جميع رسوم الخدمة",
        note: "حتى بعد إلغاء جميع رسوم الخدمة، لن يتم الوصول للقيمة المستهدفة"
      };
      result.changes.push(result.approvalDetails);
      result.newValue = currentValue - totalServiceFees;
      result.achievable = result.newValue <= targetValue;
    }
  } else {
    result.achievable = true;
  }
  
  return result;
}

function createQuoteVersion(originalQuote, changes, userId) {
  const newQuote = JSON.parse(JSON.stringify(originalQuote));
  newQuote.id = `QTO-${Date.now()}`;
  newQuote.parentId = originalQuote.id;
  newQuote.version = (originalQuote.version || 1) + 1;
  newQuote.status = "بانتظار المراجعة والاعتماد";
  newQuote.modifications = changes;
  newQuote.modifiedBy = userId;
  newQuote.modifiedAt = new Date().toISOString();
  newQuote.createdAt = new Date().toISOString();
  newQuote.createdAtMs = Date.now();
  
  // Recalculate value
  newQuote.value = newQuote.items.reduce((sum, item) => sum + (item.price || 0), 0) +
                   newQuote.customItems.reduce((sum, item) => sum + (item.price || 0), 0);
  
  return newQuote;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function analyzeTechnicianWorkload(technician, visits, store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const currentLocation = locations.find(l => l.identity === technician.identity);
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technician.identity);
  const now = Date.now();
  
  const upcomingVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled >= now;
  });
  
  const lateVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled < now && !v.reportId;
  });
  
  let totalDistance = 0;
  let lastLocation = currentLocation;
  
  upcomingVisits.sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  
  upcomingVisits.forEach(visit => {
    if (lastLocation && visit.building?.lat && visit.building?.lng) {
      totalDistance += calculateDistance(
        lastLocation.lat || 0,
        lastLocation.lng || 0,
        visit.building.lat,
        visit.building.lng
      );
      lastLocation = {lat: visit.building.lat, lng: visit.building.lng};
    }
  });
  
  return {
    technicianId: technician.identity,
    technicianName: technician.name,
    availability: technician.availability || "working",
    assignedVisits: assignedVisits.length,
    upcomingVisits: upcomingVisits.length,
    lateVisits: lateVisits.length,
    currentLocation: currentLocation ? {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      live: currentLocation.live,
      updatedAt: currentLocation.updatedAt
    } : null,
    estimatedTotalDistance: totalDistance,
    workloadScore: assignedVisits.length * 10 + lateVisits.length * 20
  };
}

function redistributeVisits(store, options = {}) {
  const visits = parseStoredJson(store, "misadVisits");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const locations = parseStoredJson(store, "misadStaffLocations");
  const tickets = parseStoredJson(store, "misadTickets");
  
  const availableTechnicians = staff.filter(s => 
    ["technician", "engineer"].includes(s.role) && 
    (s.availability || "working") === "working"
  );
  
  const unassignedVisits = visits.filter(v => !v.assignedTo || v.assignedTo === "");
  const redistributableVisits = options.redistributeAll ? visits : unassignedVisits;
  
  const analysis = {
    totalVisits: visits.length,
    unassignedVisits: unassignedVisits.length,
    redistributableVisits: redistributableVisits.length,
    availableTechnicians: availableTechnicians.length,
    workloadAnalysis: [],
    recommendations: [],
    proposedAssignments: [],
    metrics: {
      averageDistance: 0,
      totalDistance: 0,
      efficiencyScore: 0
    }
  };
  
  // Analyze each technician's current workload
  availableTechnicians.forEach(tech => {
    const workload = analyzeTechnicianWorkload(tech, visits, store);
    analysis.workloadAnalysis.push(workload);
  });
  
  // Sort technicians by workload (least busy first)
  const sortedTechnicians = analysis.workloadAnalysis
    .sort((a, b) => a.workloadScore - b.workloadScore);
  
  // Assign visits to technicians based on geographic proximity and workload
  redistributableVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    let bestTechnician = null;
    let bestScore = Infinity;
    
    sortedTechnicians.forEach(tech => {
      if (!tech.currentLocation) return;
      
      const distance = calculateDistance(
        tech.currentLocation.lat,
        tech.currentLocation.lng,
        visit.building.lat,
        visit.building.lng
      );
      
      // Score calculation: distance + workload penalty
      const score = distance + (tech.workloadScore * 0.1);
      
      if (score < bestScore) {
        bestScore = score;
        bestTechnician = tech;
      }
    });
    
    if (bestTechnician) {
      analysis.proposedAssignments.push({
        visitId: visit.id,
        visitIdDisplay: visit.id,
        clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
        currentAssignedTo: visit.assignedTo || "غير مسند",
        proposedTechnician: bestTechnician.technicianName,
        proposedTechnicianId: bestTechnician.technicianId,
        distance: bestScore,
        reasoning: `أقرب فني (${bestScore.toFixed(2)} كم) مع أقل عبء عمل (${bestTechnician.workloadScore})`
      });
    }
  });
  
  // Calculate metrics
  analysis.metrics.totalDistance = analysis.proposedAssignments.reduce((sum, a) => sum + a.distance, 0);
  analysis.metrics.averageDistance = analysis.proposedAssignments.length > 0 
    ? analysis.metrics.totalDistance / analysis.proposedAssignments.length 
    : 0;
  analysis.metrics.efficiencyScore = analysis.proposedAssignments.length > 0
    ? (1 / (analysis.metrics.averageDistance + 1)) * 100
    : 0;
  
  // Generate recommendations
  if (analysis.unassignedVisits.length > 0) {
    analysis.recommendations.push(`يوجد ${analysis.unassignedVisits.length} زيارة غير مسندة - يوصى بإسنادها فوراً`);
  }
  
  const overloadedTechnicians = analysis.workloadAnalysis.filter(t => t.workloadScore > 50);
  if (overloadedTechnicians.length > 0) {
    analysis.recommendations.push(`${overloadedTechnicians.length} فنيين لديهم عبء عمل عالي - يوصى بإعادة توزيع الزيارات`);
  }
  
  const idleTechnicians = analysis.workloadAnalysis.filter(t => t.assignedVisits === 0);
  if (idleTechnicians.length > 0) {
    analysis.recommendations.push(`${idleTechnicians.length} فنيين متفرغين - يمكن إسناد زيارات إضافية لهم`);
  }
  
  return analysis;
}

function analyzeTechnicianLocation(technicianId, store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const visits = parseStoredJson(store, "misadVisits");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  
  const currentLocation = locations.find(l => l.identity === technicianId);
  const technician = staff.find(s => s.identity === technicianId);
  
  if (!currentLocation || !technician) {
    return {error: "Technician location or data not found"};
  }
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technicianId);
  const now = Date.now();
  
  const insights = {
    technicianId,
    technicianName: technician.name,
    currentLocation: {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      live: currentLocation.live,
      updatedAt: currentLocation.updatedAt,
      updatedAtIso: currentLocation.updatedAtIso
    },
    assignedVisits: assignedVisits.length,
    locationInsights: [],
    alerts: [],
    routeOptimization: []
  };
  
  // Check for route deviations and delays
  assignedVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    const scheduledTime = visit.scheduledAt ? new Date(visit.scheduledAt).getTime() : 0;
    const distanceToVisit = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      visit.building.lat,
      visit.building.lng
    );
    
    // Estimate travel time (assuming 40 km/h average speed in urban areas)
    const estimatedTravelTime = distanceToVisit / 40 * 60; // in minutes
    const estimatedArrival = now + (estimatedTravelTime * 60 * 1000);
    
    if (scheduledTime > 0) {
      const delayMinutes = (estimatedArrival - scheduledTime) / (60 * 1000);
      
      if (delayMinutes > 30) {
        insights.alerts.push({
          type: "delay_expected",
          severity: "high",
          visitId: visit.id,
          clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
          scheduledTime: visit.scheduledAt,
          estimatedArrival: new Date(estimatedArrival).toISOString(),
      expectedDelay: Math.round(delayMinutes),
          message: `تأخر متوقع ${Math.round(delayMinutes)} دقيقة للوصول إلى ${visit.clientName || visit.clientCompanyName}`
        });
      } else if (delayMinutes > 15) {
        insights.alerts.push({
          type: "delay_expected",
          severity: "medium",
          visitId: visit.id,
          clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
          scheduledTime: visit.scheduledAt,
          estimatedArrival: new Date(estimatedArrival).toISOString(),
          expectedDelay: Math.round(delayMinutes),
          message: `تأخر متوقع ${Math.round(delayMinutes)} دقيقة للوصول إلى ${visit.clientName || visit.clientCompanyName}`
        });
      }
    }
    
    insights.locationInsights.push({
      visitId: visit.id,
      clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
      distance: distanceToVisit.toFixed(2),
      estimatedTravelTime: Math.round(estimatedTravelTime),
      scheduledTime: visit.scheduledAt
    });
  });
  
  // Check for closer technicians to nearby visits
  const otherTechnicians = staff.filter(s => 
    s.identity !== technicianId && 
    ["technician", "engineer"].includes(s.role) &&
    (s.availability || "working") === "working"
  );
  
  const otherLocations = locations.filter(l => 
    otherTechnicians.some(t => t.identity === l.identity)
  );
  
  assignedVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    const currentTechDistance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      visit.building.lat,
      visit.building.lng
    );
    
    otherLocations.forEach(otherLoc => {
      const otherTechDistance = calculateDistance(
        otherLoc.lat,
        otherLoc.lng,
        visit.building.lat,
        visit.building.lng
      );
      
      // If another technician is significantly closer (at least 2 km closer)
      if (otherTechDistance < currentTechDistance - 2) {
        const otherTech = otherTechnicians.find(t => t.identity === otherLoc.identity);
        insights.routeOptimization.push({
          type: "closer_technician",
          visitId: visit.id,
          visitClient: visit.clientName || visit.clientCompanyName || "غير محدد",
          currentTechnician: technician.name,
          currentDistance: currentTechDistance.toFixed(2),
          closerTechnician: otherTech?.name || "غير محدد",
          closerDistance: otherTechDistance.toFixed(2),
          savings: (currentTechDistance - otherTechDistance).toFixed(2),
          recommendation: `فني أقرب (${otherTech?.name}) على بعد ${otherTechDistance.toFixed(2)} كم مقارنة بـ ${currentTechDistance.toFixed(2)} كم`
        });
      }
    });
  });
  
  // Check for visit merging opportunities
  if (assignedVisits.length >= 2) {
    for (let i = 0; i < assignedVisits.length - 1; i++) {
      for (let j = i + 1; j < assignedVisits.length; j++) {
        const visit1 = assignedVisits[i];
        const visit2 = assignedVisits[j];
        
        if (!visit1.building?.lat || !visit1.building?.lng || 
            !visit2.building?.lat || !visit2.building?.lng) continue;
        
        const distanceBetweenVisits = calculateDistance(
          visit1.building.lat,
          visit1.building.lng,
          visit2.building.lat,
          visit2.building.lng
        );
        
        // If visits are very close (less than 1 km apart)
        if (distanceBetweenVisits < 1) {
          insights.routeOptimization.push({
            type: "visit_merge_opportunity",
            visit1Id: visit1.id,
            visit2Id: visit2.id,
            visit1Client: visit1.clientName || visit1.clientCompanyName || "غير محدد",
            visit2Client: visit2.clientName || visit2.clientCompanyName || "غير محدد",
            distance: distanceBetweenVisits.toFixed(2),
            recommendation: `يمكن دمج زيارتين متقاربتين (${distanceBetweenVisits.toFixed(2)} كم) في زيارة واحدة`
          });
        }
      }
    }
  }
  
  return insights;
}

function detectRouteDeviations(store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const visits = parseStoredJson(store, "misadVisits");
  
  const deviations = [];
  
  locations.forEach(location => {
    if (!location.live) return;
    
    const assignedVisits = visits.filter(v => String(v.assignedTo) === location.identity);
    const now = Date.now();
    
    assignedVisits.forEach(visit => {
      if (!visit.building?.lat || !visit.building?.lng) return;
      
      const scheduledTime = visit.scheduledAt ? new Date(visit.scheduledAt).getTime() : 0;
      
      // Only check visits scheduled within the next 2 hours
      if (scheduledTime > 0 && scheduledTime > now && scheduledTime < now + (2 * 60 * 60 * 1000)) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          visit.building.lat,
          visit.building.lng
        );
        
        // If technician is far from upcoming visit (more than 10 km)
        if (distance > 10) {
          deviations.push({
            technicianId: location.identity,
            technicianName: location.name,
            visitId: visit.id,
            visitClient: visit.clientName || visit.clientCompanyName || "غير محدد",
            currentDistance: distance.toFixed(2),
            scheduledTime: visit.scheduledAt,
            deviationType: "far_from_upcoming_visit",
            message: `الفني ${location.name} بعيد (${distance.toFixed(2)} كم) عن زيارة قريبة ${visit.clientName || visit.clientCompanyName}`
          });
        }
      }
    });
  });
  
  return deviations;
}

function generateSmartNotifications(store) {
  const notifications = [];
  const contracts = parseStoredJson(store, "misadContracts");
  const visits = parseStoredJson(store, "misadVisits");
  const tickets = parseStoredJson(store, "misadTickets");
  const parts = parseStoredJson(store, "misadPartsInventory");
  const quotes = parseStoredJson(store, "misadQuotes");
  const reports = parseStoredJson(store, "misadVisitReports");
  const now = Date.now();
  
  // Check for expiring contracts (within 30 days)
  contracts.forEach(contract => {
    if (contract.endDate) {
      const endDate = new Date(contract.endDate).getTime();
      const daysUntilExpiry = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
      
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 30 && contract.status === "ساري") {
        notifications.push({
          type: "contract_expiring",
          priority: daysUntilExpiry <= 7 ? "high" : "medium",
          title: "عقد قارب على الانتهاء",
          body: `عقد ${contract.id} للعميل ${contract.clientName || contract.clientCompanyName} ينتهي خلال ${daysUntilExpiry} يوم`,
          url: "/dashboard.html#contracts",
          roles: ["owner", "company_admin", "admin"],
          data: {contractId: contract.id, daysUntilExpiry}
        });
      }
    }
  });
  
  // Check for low inventory
  parts.forEach(part => {
    const qty = Number(part.qty || 0);
    const minQty = Number(part.minQty || 0);
    
    if (qty <= minQty && minQty > 0) {
      notifications.push({
        type: "low_inventory",
        priority: qty === 0 ? "critical" : "high",
        title: "نقص في المخزون",
        body: `قطعة ${part.name} وصلت للحد الأدنى (${qty} من ${minQty})`,
        url: "/dashboard.html#inventory",
        roles: ["owner", "company_admin", "admin"],
        data: {partId: part.id, partName: part.name, qty, minQty}
      });
    }
  });
  
  // Check for pending documents awaiting approval
  const pendingQuotes = quotes.filter(q => q.status === "بانتظار المراجعة والاعتماد" || q.status === "pending");
  if (pendingQuotes.length > 0) {
    notifications.push({
      type: "pending_approval",
      priority: "high",
      title: "عروض أسعار تنتظر الاعتماد",
      body: `يوجد ${pendingQuotes.length} عرض سعر يحتاج مراجعة واعتماد`,
      url: "/dashboard.html#quotes",
      roles: ["owner", "company_admin", "admin"],
      data: {count: pendingQuotes.length}
    });
  }
  
  // Check for overdue visits without reports
  const overdueVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled < now && !reports.some(r => r.visitId === v.id);
  });
  
  if (overdueVisits.length > 0) {
    notifications.push({
      type: "overdue_visits",
      priority: "high",
      title: "زيارات متأخرة بدون تقارير",
      body: `يوجد ${overdueVisits.length} زيارة متأخرة لم يتم رفع تقريرها`,
      url: "/dashboard.html#visits",
      roles: ["owner", "company_admin", "admin", "technician", "engineer"],
      data: {count: overdueVisits.length, visitIds: overdueVisits.map(v => v.id)}
    });
  }
  
  // Check for performance issues (high ticket reopen rate)
  const reopenedTickets = tickets.filter(t => t.status === "مفتوح" && t.reopenedCount > 0);
  if (reopenedTickets.length >= 3) {
    notifications.push({
      type: "performance_alert",
      priority: "medium",
      title: "معدل إعادة فتح البلاغات مرتفع",
      body: `يوجد ${reopenedTickets.length} بلاغ تم إعادة فتحها - قد يشير لاحتياج تدريب أو مراجعة`,
      url: "/dashboard.html#tickets",
      roles: ["owner", "company_admin", "admin"],
      data: {count: reopenedTickets.length}
    });
  }
  
  // Check for idle technicians
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const idleTechnicians = staff.filter(s => {
    if (!["technician", "engineer"].includes(s.role)) return false;
    const assignedVisits = visits.filter(v => String(v.assignedTo) === s.identity);
    const upcomingVisits = assignedVisits.filter(v => {
      const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
      return scheduled >= now;
    });
    return upcomingVisits.length === 0 && (s.availability || "working") === "working";
  });
  
  if (idleTechnicians.length > 0) {
    notifications.push({
      type: "idle_technicians",
      priority: "low",
      title: "فنيين متفرغين",
      body: `يوجد ${idleTechnicians.length} فني متفرغ يمكن إسناد زيارات لهم`,
      url: "/dashboard.html#visits",
      roles: ["owner", "company_admin", "admin"],
      data: {count: idleTechnicians.length, technicians: idleTechnicians.map(t => t.name)}
    });
  }
  
  return notifications;
}

function createSmartNotification(store, notification) {
  const notifications = notificationList(store);
  
  // Check if similar notification already exists (within last hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const exists = notifications.some(n => 
    n.type === notification.type &&
    n.createdAtMs > oneHourAgo &&
    JSON.stringify(n.data) === JSON.stringify(notification.data)
  );
  
  if (exists) return null; // Don't create duplicate notifications
  
  const newNotification = {
    id: `NTF-${Date.now()}`,
    ...notification,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    readBy: [],
    smart: true
  };
  
  notifications.unshift(newNotification);
  saveNotifications(store, notifications);
  
  // Send push notification
  const tokens = pushTokenList(store).filter(t => 
    !notification.userId || t.userId === notification.userId || notification.roles?.includes(t.role)
  );
  sendNativePush(tokens, newNotification);
  
  return newNotification;
}

function checkAiPermission(user, action, resource = null) {
  const role = String(user.role || "");
  const permissions = user.permissions || [];
  
  // Define permission matrix
  const permissionMatrix = {
    // Voice chat and conversation
    "ai.chat": ["owner", "company_admin", "admin", "technician", "engineer", "client"],
    "ai.conversation.manage": ["owner", "company_admin", "admin"],
    
    // Report analysis and quote generation
    "ai.analyze.report": ["owner", "company_admin", "admin", "technician", "engineer"],
    "ai.generate.quote": ["owner", "company_admin", "admin"],
    
    // Quote modification
    "ai.modify.quote": ["owner", "company_admin", "admin"],
    "ai.optimize.quote": ["owner", "company_admin", "admin"],
    
    // Visit redistribution
    "ai.redistribute.visits": ["owner", "company_admin", "admin"],
    "ai.analyze.workload": ["owner", "company_admin", "admin"],
    
    // Location tracking
    "ai.track.location": ["owner", "company_admin", "admin"],
    "ai.analyze.location": ["owner", "company_admin", "admin", "technician", "engineer"],
    
    // Smart notifications
    "ai.generate.notifications": ["owner", "company_admin", "admin"],
    "ai.manage.notifications": ["owner", "company_admin", "admin"],
    
    // Professional profiles
    "ai.view.profiles": ["owner", "company_admin", "admin"],
    "ai.analyze.performance": ["owner", "company_admin", "admin"],
    
    // Document workflow
    "ai.review.documents": ["owner", "company_admin", "admin"],
    "ai.approve.documents": ["owner", "company_admin", "admin"],
    
    // System logs
    "ai.view.logs": ["owner", "company_admin", "admin"],
    "ai.export.logs": ["owner", "company_admin"]
  };
  
  const allowedRoles = permissionMatrix[action] || [];
  
  // Check if role is allowed
  if (!allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' is not allowed to perform action '${action}'`
    };
  }
  
  // Check custom permissions if they exist
  if (permissions.length > 0) {
    // If permissions include "*", allow everything
    if (permissions.includes("*")) {
      return {allowed: true};
    }
    
    // If specific permission is granted
    if (permissions.includes(action)) {
      return {allowed: true};
    }
    
    // If permission is explicitly denied
    if (permissions.includes(`!${action}`)) {
      return {
        allowed: false,
        reason: `Permission '${action}' is explicitly denied for this user`
      };
    }
  }
  
  // Resource-level checks (if resource is provided)
  if (resource) {
    // Check if user has access to the specific resource
    if (resource.companyOwnerId && role !== "admin") {
      if (resource.companyOwnerId !== user.id && resource.companyOwnerId !== user.companyOwnerId) {
        return {
          allowed: false,
          reason: "User does not have access to this company's resources"
        };
      }
    }
  }
  
  return {allowed: true};
}

function filterSensitiveData(data, user) {
  const role = String(user.role || "");
  const filtered = JSON.parse(JSON.stringify(data));
  
  // Define sensitive fields by role
  const sensitiveFields = {
    client: ["financialData", "contractDetails", "internalNotes", "supplierPricing"],
    technician: ["allTechnicianSalaries", "companyFinancials", "strategicPlans"],
    engineer: ["allTechnicianSalaries", "companyFinancials"],
    company_admin: ["companyFinancials"],
    admin: [], // Admins see everything
    owner: [] // Owners see everything
  };
  
  const fieldsToHide = sensitiveFields[role] || [];
  
  function filterObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => filterObject(item));
    }
    
    const result = {};
    for (const key in obj) {
      if (fieldsToHide.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        result[key] = filterObject(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }
  
  return filterObject(filtered);
}

function aiLogList(store) {
  try { return JSON.parse(store.misadAiLogs || "[]"); } catch { return []; }
}

function saveAiLogs(store, logs) {
  store.misadAiLogs = JSON.stringify(logs.slice(0, 1000));
  writeStore(store);
}

function logAiOperation(store, operation, user, details = {}) {
  const logs = aiLogList(store);
  
  const logEntry = {
    id: `AIL-${Date.now()}`,
    operation,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    details,
    ipAddress: "",
    userAgent: ""
  };
  
  logs.unshift(logEntry);
  saveAiLogs(store, logs);
  
  return logEntry;
}

function getAiLogs(store, filters = {}) {
  const logs = aiLogList(store);
  let filtered = logs;
  
  if (filters.userId) {
    filtered = filtered.filter(log => log.userId === filters.userId);
  }
  
  if (filters.operation) {
    filtered = filtered.filter(log => log.operation === filters.operation);
  }
  
  if (filters.userRole) {
    filtered = filtered.filter(log => log.userRole === filters.userRole);
  }
  
  if (filters.startDate) {
    const startDate = new Date(filters.startDate).getTime();
    filtered = filtered.filter(log => log.timestampMs >= startDate);
  }
  
  if (filters.endDate) {
    const endDate = new Date(filters.endDate).getTime();
    filtered = filtered.filter(log => log.timestampMs <= endDate);
  }
  
  return filtered.slice(0, 100);
}

function generateRecommendationReport(store, options = {}) {
  const contracts = parseStoredJson(store, "misadContracts");
  const visits = parseStoredJson(store, "misadVisits");
  const tickets = parseStoredJson(store, "misadTickets");
  const parts = parseStoredJson(store, "misadPartsInventory");
  const quotes = parseStoredJson(store, "misadQuotes");
  const reports = parseStoredJson(store, "misadVisitReports");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const now = Date.now();
  
  const report = {
    id: `REC-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    summary: "",
    findings: [],
    recommendations: [],
    metrics: {},
    priority: "medium"
  };
  
  // Analyze contract status
  const activeContracts = contracts.filter(c => c.status === "ساري");
  const expiringContracts = activeContracts.filter(c => {
    const endDate = c.endDate ? new Date(c.endDate).getTime() : 0;
    const daysUntilExpiry = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });
  
  if (expiringContracts.length > 0) {
    report.findings.push({
      category: "contracts",
      type: "expiring_soon",
      severity: "high",
      description: `${expiringContracts.length} عقود تنتهي خلال 30 يوم`,
      data: expiringContracts.map(c => ({
        id: c.id,
        client: c.clientName || c.clientCompanyName,
        endDate: c.endDate
      }))
    });
    report.recommendations.push({
      priority: "high",
      category: "contracts",
      action: "contact_clients",
      description: "تواصل مع العملاء لتجديد العقود قبل انتهائها",
      expectedImpact: "الحفاظ على الإيرادات وتجنب انقطاع الخدمة"
    });
  }
  
  // Analyze ticket performance
  const openTickets = tickets.filter(t => t.status !== "مغلق" && t.status !== "منتهي");
  const highPriorityTickets = openTickets.filter(t => t.priority === "urgent" || t.priority === "high");
  
  if (highPriorityTickets.length > 5) {
    report.findings.push({
      category: "tickets",
      type: "high_volume_high_priority",
      severity: "critical",
      description: `${highPriorityTickets.length} بلاغ أولوية عالية مفتوح`,
      data: {count: highPriorityTickets.length}
    });
    report.recommendations.push({
      priority: "critical",
      category: "tickets",
      action: "allocate_resources",
      description: "خصص موارد إضافية للتعامل مع البلاغات عالية الأولوية",
      expectedImpact: "تحسين رضا العملاء وتقليل أوقات الاستجابة"
    });
  }
  
  // Analyze inventory
  const lowStockParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 0));
  const outOfStockParts = lowStockParts.filter(p => Number(p.qty || 0) === 0);
  
  if (outOfStockParts.length > 0) {
    report.findings.push({
      category: "inventory",
      type: "out_of_stock",
      severity: "critical",
      description: `${outOfStockParts.length} قطع غيار نفذت من المخزون`,
      data: outOfStockParts.map(p => ({name: p.name, sku: p.sku}))
    });
    report.recommendations.push({
      priority: "critical",
      category: "inventory",
      action: "reorder_immediately",
      description: "أعد طلب القطع النافذة فوراً من الموردين",
      expectedImpact: "تجنب تأخير الصيانة بسبب نقص القطع"
    });
  }
  
  // Analyze technician performance
  const technicians = staff.filter(s => ["technician", "engineer"].includes(s.role));
  const technicianPerformance = technicians.map(tech => {
    const assignedVisits = visits.filter(v => String(v.assignedTo) === tech.identity);
    const completedVisits = assignedVisits.filter(v => reports.some(r => r.visitId === v.id));
    const completionRate = assignedVisits.length > 0 ? (completedVisits.length / assignedVisits.length) * 100 : 0;
    
    return {
      id: tech.identity,
      name: tech.name,
      assignedVisits: assignedVisits.length,
      completedVisits: completedVisits.length,
      completionRate: completionRate.toFixed(1)
    };
  });
  
  const lowPerformers = technicianPerformance.filter(t => parseFloat(t.completionRate) < 70);
  if (lowPerformers.length > 0) {
    report.findings.push({
      category: "performance",
      type: "low_completion_rate",
      severity: "medium",
      description: `${lowPerformers.length} فنيين لديهم معدل إتمام أقل من 70%`,
      data: lowPerformers
    });
    report.recommendations.push({
      priority: "medium",
      category: "performance",
      action: "provide_training",
      description: "قدم تدريباً إضافياً للفنيين ذوي الأداء المنخفض",
      expectedImpact: "تحسين جودة الخدمة ومعدلات الإنجاز"
    });
  }
  
  // Analyze quote conversion
  const pendingQuotes = quotes.filter(q => q.status === "بانتظار الرد" || q.status === "pending");
  const approvedQuotes = quotes.filter(q => q.status === "معتمد" || q.status === "مقبول");
  const conversionRate = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;
  
  report.metrics = {
    totalContracts: activeContracts.length,
    expiringContracts: expiringContracts.length,
    openTickets: openTickets.length,
    highPriorityTickets: highPriorityTickets.length,
    lowStockItems: lowStockParts.length,
    outOfStockItems: outOfStockParts.length,
    totalTechnicians: technicians.length,
    quoteConversionRate: conversionRate.toFixed(1)
  };
  
  // Set overall priority based on findings
  const criticalFindings = report.findings.filter(f => f.severity === "critical").length;
  const highFindings = report.findings.filter(f => f.severity === "high").length;
  
  if (criticalFindings > 0) {
    report.priority = "critical";
  } else if (highFindings > 0) {
    report.priority = "high";
  }
  
  // Generate summary
  report.summary = `تقرير التحليل الذكي: يوجد ${report.findings.length} ملاحظة و ${report.recommendations.length} توصية. الأولوية: ${report.priority === "critical" ? "حرجة" : report.priority === "high" ? "عالية" : "متوسطة"}.`;
  
  return report;
}

function buildTechnicianProfile(technicianId, store) {
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const visits = parseStoredJson(store, "misadVisits");
  const reports = parseStoredJson(store, "misadVisitReports");
  const tickets = parseStoredJson(store, "misadTickets");
  
  const technician = staff.find(s => s.identity === technicianId);
  if (!technician) return {error: "Technician not found"};
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technicianId);
  const completedVisits = assignedVisits.filter(v => reports.some(r => r.visitId === v.id));
  const visitReports = reports.filter(r => r.technicianId === technicianId);
  
  // Calculate performance metrics
  const completionRate = assignedVisits.length > 0 ? (completedVisits.length / assignedVisits.length) * 100 : 0;
  
  // Calculate average response time (from ticket assignment to visit completion)
  const relatedTickets = tickets.filter(t => t.assignedTo === technicianId);
  let totalResponseTime = 0;
  let responseTimeCount = 0;
  
  relatedTickets.forEach(ticket => {
    const relatedVisit = visits.find(v => v.ticketId === ticket.id);
    if (relatedVisit && relatedVisit.completedAt) {
      const createdTime = ticket.createdAt ? new Date(ticket.createdAt).getTime() : 0;
      const completedTime = new Date(relatedVisit.completedAt).getTime();
      if (createdTime > 0 && completedTime > createdTime) {
        totalResponseTime += (completedTime - createdTime);
        responseTimeCount++;
      }
    }
  });
  
  const avgResponseHours = responseTimeCount > 0 ? (totalResponseTime / responseTimeCount) / (60 * 60 * 1000) : 0;
  
  // Calculate customer satisfaction (from reports)
  let totalRating = 0;
  let ratingCount = 0;
  
  visitReports.forEach(report => {
    if (report.customerRating) {
      totalRating += Number(report.customerRating);
      ratingCount++;
    }
  });
  
  const avgCustomerRating = ratingCount > 0 ? totalRating / ratingCount : 0;
  
  // Identify skills from reports
  const mentionedSkills = new Set();
  visitReports.forEach(report => {
    if (report.skillsUsed && Array.isArray(report.skillsUsed)) {
      report.skillsUsed.forEach(skill => mentionedSkills.add(skill));
    }
  });
  
  // Calculate workload trends
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const recentVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled >= thirtyDaysAgo;
  });
  
  const profile = {
    technicianId,
    technicianName: technician.name,
    role: technician.role,
    updatedAt: new Date().toISOString(),
    performance: {
      totalVisits: assignedVisits.length,
      completedVisits: completedVisits.length,
      completionRate: completionRate.toFixed(1),
      avgResponseTimeHours: avgResponseHours.toFixed(1),
      customerRating: avgCustomerRating.toFixed(1),
      ratingCount: ratingCount
    },
    skills: Array.from(mentionedSkills),
    workload: {
      totalAssigned: assignedVisits.length,
      recentVisits: recentVisits.length,
      availability: technician.availability || "working"
    },
    strengths: [],
    areasForImprovement: [],
    recommendations: []
  };
  
  // Generate strengths and areas for improvement
  if (completionRate >= 90) {
    profile.strengths.push("معدل إتمام عالي للزيارات");
  } else if (completionRate < 70) {
    profile.areasForImprovement.push("يحتاج تحسين معدل إتمام الزيارات");
    profile.recommendations.push("قدم دعماً إضافياً لتحسين معدل الإنجاز");
  }
  
  if (avgCustomerRating >= 4) {
    profile.strengths.push("رضا عملاء مرتفع");
  } else if (avgCustomerRating > 0 && avgCustomerRating < 3) {
    profile.areasForImprovement.push("يحتاج تحسين رضا العملاء");
    profile.recommendations.push("قدم تدريباً على خدمة العملاء");
  }
  
  if (avgResponseHours > 0 && avgResponseHours < 24) {
    profile.strengths.push("استجابة سريعة للبلاغات");
  } else if (avgResponseHours > 48) {
    profile.areasForImprovement.push("يحتاج تحسين سرعة الاستجابة");
    profile.recommendations.push("راجع إدارة الوقت وتوزيع المهام");
  }
  
  if (profile.skills.length > 0) {
    profile.strengths.push(`مهارات متعددة: ${profile.skills.slice(0, 3).join(", ")}`);
  }
  
  return profile;
}

function updateAllTechnicianProfiles(store) {
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const technicians = staff.filter(s => ["technician", "engineer"].includes(s.role));
  
  const profiles = technicians.map(tech => buildTechnicianProfile(tech.identity, store));
  
  store.misadTechnicianProfiles = JSON.stringify(profiles);
  writeStore(store);
  
  return profiles;
}

function initiateDocumentWorkflow(store, documentId, documentType, userId, role) {
  const documents = parseStoredJson(store, "misadDocuments");
  const document = documents.find(d => d.id === documentId);
  
  if (!document) return {error: "Document not found"};
  
  const workflow = {
    id: `WF-${Date.now()}`,
    documentId,
    documentType,
    documentTitle: document.title || document.name || "غير محدد",
    initiatedBy: userId,
    initiatedAt: new Date().toISOString(),
    status: "pending_review",
    steps: [
      {
        step: 1,
        name: "مراجعة أولية",
        assignedTo: role === "owner" ? "owner" : "admin",
        status: "pending",
        completedAt: null,
        comments: []
      },
      {
        step: 2,
        name: "اعتماد نهائي",
        assignedTo: "owner",
        status: "pending",
        completedAt: null,
        comments: []
      }
    ],
    currentStep: 1,
    history: []
  };
  
  workflow.history.push({
    action: "workflow_initiated",
    userId,
    timestamp: new Date().toISOString(),
    details: "تم بدء سير عمل المراجعة والاعتماد"
  });
  
  return workflow;
}

function approveDocumentStep(store, workflowId, stepNumber, userId, role, approved, comments = "") {
  const workflows = parseStoredJson(store, "misadDocumentWorkflows");
  const workflow = workflows.find(w => w.id === workflowId);
  
  if (!workflow) return {error: "Workflow not found"};
  
  const step = workflow.steps.find(s => s.step === stepNumber);
  if (!step) return {error: "Step not found"};
  
  // Check if user is authorized for this step
  if (step.assignedTo !== role && role !== "owner") {
    return {error: "Not authorized to approve this step"};
  }
  
  step.status = approved ? "approved" : "rejected";
  step.completedAt = new Date().toISOString();
  step.approvedBy = userId;
  step.comments.push({
    userId,
    comment: comments,
    timestamp: new Date().toISOString()
  });
  
  workflow.history.push({
    action: approved ? "step_approved" : "step_rejected",
    userId,
    stepNumber,
    timestamp: new Date().toISOString(),
    details: comments || (approved ? "تم اعتماد الخطوة" : "تم رفض الخطوة")
  });
  
  // If rejected, mark workflow as rejected
  if (!approved) {
    workflow.status = "rejected";
  } else if (stepNumber < workflow.steps.length) {
    // Move to next step
    workflow.currentStep = stepNumber + 1;
    workflow.status = "pending_review";
  } else {
    // All steps approved
    workflow.status = "approved";
    workflow.completedAt = new Date().toISOString();
    
    // Update document status
    const documents = parseStoredJson(store, "misadDocuments");
    const docIndex = documents.findIndex(d => d.id === workflow.documentId);
    if (docIndex !== -1) {
      documents[docIndex].status = "معتمد";
      documents[docIndex].approvedAt = new Date().toISOString();
      documents[docIndex].approvedBy = userId;
      store.misadDocuments = JSON.stringify(documents);
    }
  }
  
  return workflow;
}

function analyzeDocumentForApproval(store, documentId, documentType) {
  const documents = parseStoredJson(store, "misadDocuments");
  const quotes = parseStoredJson(store, "misadQuotes");
  const contracts = parseStoredJson(store, "misadContracts");
  
  let document = null;
  if (documentType === "quote") {
    document = quotes.find(q => q.id === documentId);
  } else if (documentType === "contract") {
    document = contracts.find(c => c.id === documentId);
  } else {
    document = documents.find(d => d.id === documentId);
  }
  
  if (!document) return {error: "Document not found"};
  
  const analysis = {
    documentId,
    documentType,
    title: document.title || document.name || "غير محدد",
    value: document.value || 0,
    risks: [],
    recommendations: [],
    approvalCriteria: {
      valueCheck: true,
      completenessCheck: true,
      policyCompliance: true
    }
  };
  
  // Check value thresholds
  if (document.value > 50000) {
    analysis.risks.push({
      type: "high_value",
      severity: "medium",
      description: "قيمة عالية تتطلب مراجعة إضافية"
    });
    analysis.recommendations.push("تأكد من مراجعة التفاصيل المالية بعناية");
  }
  
  // Check completeness
  if (!document.clientName && !document.clientCompanyName) {
    analysis.risks.push({
      type: "missing_client",
      severity: "high",
      description: "معلومات العميل مفقودة"
    });
    analysis.approvalCriteria.completenessCheck = false;
    analysis.recommendations.push("أكمل معلومات العميل قبل الاعتماد");
  }
  
  // Check for required fields based on document type
  if (documentType === "quote") {
    if (!document.items || document.items.length === 0) {
      analysis.risks.push({
        type: "missing_items",
        severity: "high",
        description: "لا توجد بنود في عرض السعر"
      });
      analysis.approvalCriteria.completenessCheck = false;
    }
    
    if (document.autoGenerated) {
      analysis.recommendations.push("عرض سعر تم إنشاؤه تلقائياً - راجع التوصيات والأسعار");
    }
  }
  
  return analysis;
}

// --- Can-do capability mapping ---
const capabilityMap = [
  {patterns: [/عقد.*صيانة|صيانة.*عقد/i], key: "create_contract", label: "عقد الصيانة", answers: ["أيوه، أقدر أسوي عقود صيانة. قول: سوي عقد صيانة لـ (العميل) بقيمة (المبلغ)", "إيه، خدمة العقود متوفرة. تقدر تقول: اعمل عقد صيانة لـ (الاسم) بقيمة (المبلغ)", "نعم، عقد الصيانة من خدماتي. جرب: سوي عقد صيانة لشركة (الاسم)"]},
  {patterns: [/^(?:أ)?سوي\s*عقد|^(?:أ)?عِمل\s*عقد|إنشاء\s*عقد|عقد/i], key: "create_contract", label: "العقد", answers: ["أيوه، أقدر أسوي عقود صيانة وتركيب. قول: سوي عقد لـ (العميل) بقيمة (المبلغ)", "إيه، تقدر تسوي عقود. مثال: اعمل عقد صيانة لـ (العميل) بقيمة (المبلغ)", "نعم الخدمة متوفرة. جرب: سوي عقد لشركة (الاسم) بقيمة (المبلغ)"]},
  {patterns: [/عرض.{0,4}سعر|^(?:أ)?عرض\s*سعر/i], key: "create_quote", label: "عرض السعر", answers: ["أيوه، أقدر أعمل عروض أسعار. قول: اعمل عرض سعر لـ (العميل) بقيمة (المبلغ)", "إيه، عروض الأسعار متوفرة. مثال: سوي عرض سعر لـ (الاسم) بقيمة (المبلغ)", "نعم، أجهز عروض أسعار احترافية. قول: عرض سعر لشركة (الاسم)"]},
  {patterns: [/بلا[غgh]|^(?:أ)?سج[لّ]\s*بلا/i], key: "create_ticket", label: "البلاغ", answers: ["أيوه، أقدر أسجل بلاغات صيانة. قول: سوي بلاغ لـ (العميل) عنوانه (وصف)", "إيه، تسجيل البلاغات متاح. جرب: بلاغ لـ (الاسم) عنوانه (وصف المشكلة)", "نعم، أقدر أفتح بلاغ صيانة. مثال: سوي بلاغ لمبنى (الاسم)"]},
  {patterns: [/^(?:أ)?سوي\s*زيار|^(?:أ)?جدول\s*زيار|زيار[ةه]/i], key: "create_visit", label: "الزيارة", answers: ["أيوه، أقدر أجدد زيارات كشفية. قول: سوي زيارة لـ (العميل) تاريخ (اليوم)", "إيه، جدولة الزيارات متاحة. مثال: زيارة لـ (الاسم) يوم (التاريخ)", "نعم، الزيارات الكشفية من خدماتي. قول: جدول زيارة لـ (الشركة)"]},
  {patterns: [/^(?:أ)?ضيف\s*فني|^(?:أ)?ضيف\s*مهندس|إضافة\s*فني|فني|مهندس/i], key: "add_staff", label: "إضافة فني", answers: ["أيوه، أقدر أضيف فنيين ومهندسين. قول: أضف فني اسمه (الاسم)", "إيه، إضافة أعضاء الفريق متاحة. جرب: أضف مهندس اسمه (الاسم)", "نعم، تقدر تضيف فنيين. مثال: أضف فني اسمه محمد"]},
  {patterns: [/^(?:أ)?ضيف\s*مورد|إضافة\s*مورد|مورد/i], key: "create_supplier", label: "المورد", answers: ["أيوه، أقدر أضيف موردين. قول: أضف مورد اسمه (الاسم)", "إيه، إدارة الموردين متوفرة. مثال: أضف مورد اسمه (الاسم) جواله 05...", "نعم، تقدر تضيف مورد جديد. جرب: أضف مورد (الاسم)"]},
  {patterns: [/^(?:أ)?ضيف\s*قطعة|قطعة.{0,3}غيار/i], key: "create_part", label: "قطعة الغيار", answers: ["أيوه، أقدر أضيف قطع غيار للمخزون. قول: أضف قطعة (الاسم) الكمية (العدد)", "إيه، إدارة المخزون متاحة. مثال: أضف قطعة (الاسم) الكمية (العدد)", "نعم، تقدر تضيف قطع غيار. جرب: أضف قطعة غيار (الاسم)"]},
  {patterns: [/^(?:أ)?سند|^(?:أ)?نقل|^(?:أ)?وزع|إسناد|وزع/i], key: "assign_visit", label: "إسناد الزيارات", answers: ["أيوه، أقدر أسند الزيارات للفنيين. قول: اسند الزيارة لـ (اسم الفني)", "إيه، إسناد الزيارات متاح. مثال: اسند الزيارات لـ (الفني)", "نعم، أقدر وزع الزيارات على الفريق. قول: وزع الزيارات"]},
  {patterns: [/حل[للا].*مخزون/i], key: "analyze_inventory", label: "تحليل المخزون", answers: ["أيوه، أقدر أحلل المخزون وأشوف القطع الناقصة. قول: حلل المخزون", "إيه، تحليل المخزون متاح. جرب: حلل المخزون وقل لي الناقص", "نعم، أتابع المخزون. قول: تقرير المخزون"]},
  {patterns: [/حل[للا]|تحليل/i], key: "analyze_operations", label: "التحليل", answers: ["أيوه، أقدر أحلل العمليات والمخزون والفريق. قول: حلل العمليات", "إيه، التقارير التحليلية متوفرة. مثال: حلل أداء الفريق", "نعم، التحليل من خدماتي. جرب: حلل العمليات أو حلل المخزون"]},
  {patterns: [/مخزون/i], key: "analyze_inventory", label: "المخزون", answers: ["أيوه، أقدر أتابع المخزون وأشوف القطع الناقصة. قول: اعرض المخزون", "إيه، خدمة المخزون متاحة. جرب: حلل المخزون أو اعرض القطع", "نعم، أقدر أعطيك تقرير كامل عن المخزون. قول: المخزون"]},
  {patterns: [/^(?:أ)?رسل\s*إشعار|إشعار|notification/i], key: "create_notification", label: "الإشعار", answers: ["أيوه، أقدر أرسل إشعارات. قول: أرسل إشعار (النص)", "إيه، الإشعارات متوفرة. مثال: أرسل إشعار للجميع (النص)", "نعم، أرسل إشعارات للفريق. قول: إشعار (النص)"]},
  {patterns: [/^(?:أ)?مسح|^(?:أ)?حذف|إلغاء/i], key: "deny", label: "محظور", answers: ["هذا الإجراء غير متوفر حالياً في النظام.", "للأسف، هذي الخدمة مو متوفرة في النظام.", "ما أقدر أسوي هذا الإجراء حالياً، لكن أقدر أساعدك بأمور أخرى."]}
];

function getCapabilityResponse(actionText, role = "admin") {
  if (!actionText) return "تقدر تسألني مثلاً: هل ممكن أسوي عقد؟ أو تقدر توزع الزيارات؟ وسأجاوبك وضح.";
  for (const cap of capabilityMap) {
    const anyMatch = cap.patterns.some(p => p.test(actionText));
    if (anyMatch) {
      if (cap.key === "deny") return cap.answers[Math.floor(Math.random() * cap.answers.length)];
      const answer = cap.answers[Math.floor(Math.random() * cap.answers.length)];
      return answer + "\n\n" + smartSuggests(cap.key === "analyze_inventory" ? "inventory" : (cap.key === "create_contract" ? "contract" : cap.key === "create_visit" ? "visit" : cap.key === "assign_visit" ? "visit" : cap.key === "create_ticket" ? "ticket" : cap.key === "add_staff" ? "staff" : cap.key === "create_quote" ? "quote" : "general"), role);
    }
  }
  // If specific action not found, provide generic response
  const generalCaps = [
    "إنشاء عقود صيانة وتركيب",
    "عروض أسعار",
    "تسجيل بلاغات",
    "جدولة زيارات",
    "إضافة فنيين ومهندسين",
    "إدارة الموردين والمخزون",
    "إسناد الزيارات للفنيين",
    "تحليل العمليات والمخزون",
    "تقارير وإشعارات"
  ];
  const generalSuggests = smartSuggests("general", role);
  return "أيوة، فيه كثير أقدر أسويه 😊 منها:\n• " + generalCaps.join("\n• ") + "\n\n" + generalSuggests;
}

function elevatorKnowledgeBase() {
  return {
    domain: "elevator-company-operations",
    languagePolicy: "Arabic first, Saudi dialect friendly, professional tone",
    modules: [
      "maintenance_contracts", "installation_contracts", "quotes", "periodic_visits",
      "corrective_maintenance", "tickets", "technicians", "engineers", "inventory",
      "spare_parts", "suppliers", "reports", "certificates", "payments", "pdf_documents",
      "customer_approvals", "location_tracking", "visit_reassignment"
    ],
    operatingRules: [
      "تحقق من صلاحية المستخدم قبل اقتراح أي تنفيذ.",
      "لا تطلب بيانات موجودة في سياق النظام.",
      "اطلب أقل قدر لازم من البيانات الناقصة.",
      "فرّق بين التوصية والتنفيذ، ولا تنفذ إلا عبر أدوات النظام وبموافقة المستخدم.",
      "اعتمد على الحمل الحالي للفنيين وموقع الزيارة وحالة المصعد عند اقتراح الإسناد.",
      "راقب العقود المنتظرة والبلاغات المفتوحة والزيارات المتأخرة ونقص المخزون.",
      "إذا قال المستخدم 'باسم X' فإن X هو اسم العميل. استخدمه في clientName."
    ],
    intents: {
      create_contract: ["عقد", "صيانة", "تركيب", "أنشئ عقد", "سوي عقد", "اعمل عقد", "عمل عقد"],
      create_quote: ["عرض سعر", "تسعير", "قطع غيار", "سوي عرض", "اعمل عرض", "سعر"],
      assign_visit: ["اسند", "انقل زيارة", "فني", "سوي زيارة"],
      redistribute_visits: ["إعادة توزيع", "وزع الزيارات", "أقل تكلفة"],
      analyze_operations: ["حلل", "أولويات", "مخاطر", "تشغيل"],
      field_voice_cleanup: ["نظف النص", "إدخال صوتي", "قيمة الحقل"]
    }
  };
}

function shumoosAdvancedAiTraining() {
  const responseBank = loadAiResponseBank();
  return {
    level: "world-class-operations-copilot",
    responseBank,
    systemUsageGuide: shumoosSystemUsageGuide(),
    professionalSpecialistDoctrine: shumoosProfessionalSpecialistDoctrine(),
    conversationContinuityDoctrine: shumoosConversationContinuityDoctrine(),
    mission: [
      "Operate as a senior AI operations manager for elevator maintenance and installation companies.",
      "Understand the Shumoos system end-to-end before answering: roles, permissions, contracts, quotes, visits, tickets, staff, inventory, suppliers, documents, approvals, notifications, and reports.",
      "Convert vague user language into clear operational intent, ask only for the missing fields that are truly required, and prefer actionable next steps.",
      "Protect customer, employee, financial, and company data according to the current user's role and company scope."
    ],
    responseQuality: {
      tone: "Arabic first, professional Saudi-friendly wording, flexible and natural, not robotic.",
      styleRules: [
        "Start with the useful answer directly.",
        "Use short paragraphs for voice replies and structured bullets for dashboards or analysis.",
        "When the user is stressed or vague, respond calmly, infer the most likely intent, then ask one precise question if needed.",
        "For voice mode, keep the answer concise, spoken, and easy to understand without tables.",
        "For management analysis, include priority, reason, impact, and recommended action.",
        "Do not repeat generic disclaimers. Be decisive when system data is enough."
      ],
      responseVariation: {
        minimumVariantsPerIntent: 19,
        rule: "For every repeated question, intent, greeting, clarification, refusal, success message, analysis summary, and voice reply, maintain at least 19 meaning-equivalent Arabic response patterns and rotate naturally between them.",
        dimensions: [
          "formal executive Arabic",
          "clear Saudi white dialect",
          "very concise voice answer",
          "detailed management answer",
          "supportive coaching tone",
          "direct operational command tone",
          "risk-focused advisory tone",
          "data analyst tone",
          "customer-service tone",
          "technician field-support tone",
          "owner/CEO summary tone",
          "admin configuration tone",
          "client-friendly explanation",
          "question-first clarification style",
          "action-first execution style",
          "summary-then-details style",
          "problem-cause-solution style",
          "priority list style",
          "next-best-action style"
        ],
        antiRepetition: [
          "Do not answer identical questions with the same opening every time.",
          "Do not overuse the same phrases such as جاهز, أقدر, تم, أو حسب البيانات.",
          "Vary sentence length, opening phrase, order of details, and closing suggestion while preserving facts.",
          "When the user asks again, acknowledge the repeated context briefly and give a fresh formulation."
        ]
      },
      flexibility: [
        "Accept Saudi dialect, formal Arabic, spelling mistakes, partial commands, and mixed Arabic-English operational terms.",
        "Map synonyms such as عميل/منشأة/شركة/مؤسسة/customer/client, فني/مهندس/technician/engineer, بلاغ/عطل/ticket, زيارة/موعد/visit.",
        "If a command can be completed safely, complete it through system tools; otherwise open or suggest the exact form."
      ]
    },
    permissionsModel: {
      admin: "Can supervise platform operations, create owner/admin/client entry links, manage awareness content, and inspect platform-level summaries.",
      owner: "Can manage the company, contracts, quotes, visits, tickets, staff, inventory, suppliers, client companies, documents, and reports.",
      company_admin: "Can manage company operations within the owner's company scope.",
      technician: "Can see and update assigned visits, reports, tickets, and operational tasks allowed by scope.",
      client: "Can see own contracts, visits, tickets, approvals, and relevant documents only."
    },
    operatingPlaybooks: {
      contracts: [
        "For maintenance contracts, verify client identity/company, buildings, elevator count/specs, start/end dates, value, VAT if applicable, and approval status.",
        "For installation contracts, capture installation specs, delivery scope, warranty, payment milestones, and required documents.",
        "Warn about expired maintenance contracts, pending customer approvals, missing client data, and contracts without active visits."
      ],
      quotes: [
        "Build quotes from parts, labor, custom items, supplier cost, margin, VAT, and customer context.",
        "When asked to optimize pricing, compare low-stock parts, supplier availability, and margin risk.",
        "Keep status clear: draft, pending review, waiting customer approval, approved, rejected."
      ],
      visits: [
        "Prioritize urgent faults, trapped passenger reports, overdue maintenance, high-value clients, and nearby technicians.",
        "Assign technicians using workload, role, availability, location, skill fit, and SLA urgency.",
        "If details are missing, ask for date/time, client or contract, building, and preferred technician only when required."
      ],
      tickets: [
        "Classify urgency from words like عالق, توقف, باب, صوت, اهتزاز, طارئ, عاجل.",
        "Recommend immediate escalation for safety issues and create a visit when the ticket requires field work.",
        "Track open, urgent, overdue, assigned, and closed tickets."
      ],
      inventory: [
        "Watch minimum quantities, out-of-stock parts, supplier lead time, unit cost, and parts used in quotes or visits.",
        "Recommend purchase orders based on low stock, upcoming visits, frequent failures, and best supplier price.",
        "Flag pricing risk when a quote uses parts with missing cost or insufficient stock."
      ],
      documentsApprovals: [
        "For PDFs and documents, explain what is pending: company stamp/signature, customer approval, report completion, or contract status.",
        "Never claim a customer approved unless the approval timestamp or signature/stamp exists in system data."
      ],
      analytics: [
        "Summarize operations by overdue visits, open urgent tickets, pending contracts, inventory shortages, technician load, and revenue pipeline.",
        "For every management report, provide top priorities, why they matter, and the next action.",
        "Separate facts from recommendations when data is incomplete."
      ],
      voice: [
        "Voice replies must be concise, friendly, and formatted as speech.",
        "Avoid long lists in voice mode; give top three points and offer to continue.",
        "If voice synthesis fails, return the text answer clearly and mention that the custom voice service needs activation or more time."
      ]
    },
    executionPolicy: [
      "Never execute destructive actions without explicit confirmation.",
      "For create actions, use available data first and ask only for missing required fields.",
      "For update or assignment actions, identify the exact target record before changing it.",
      "If multiple records match, ask the user to choose.",
      "After execution, summarize what changed with record id, client, status, and next step."
    ],
    dataInterpretation: [
      "Treat empty strings, missing dates, missing client ids, and unknown statuses as data quality issues.",
      "Dates in the past may indicate overdue work unless the status is completed or closed.",
      "A client can match by identity, company unified number, company name, client name, or contract label.",
      "For company_admin, preserve owner company scope through companyOwnerId."
    ],
    highLevelExamples: [
      "User: حلل اليوم. Answer: mention overdue visits, urgent tickets, low stock, pending approvals, and top next actions.",
      "User: سو عقد صيانة لمؤسسة الأفق ب 12000. Action: create contract if enough data or ask only for missing building/elevator details if required.",
      "User: وزع الزيارات. Action: recommend or execute reassignment based on workload and availability.",
      "User: شغل صوتي. Action: use custom voice endpoint or ElevenLabs voice id only; do not fall back to device voices."
    ]
  };
}

function searchLocalData(query, store, user = {}) {
  const q = String(query || "").toLowerCase();
  const isCount = /^(?:كم|عدد|كم عدد|إجمالي)(?:\s|$)|^(?:total|count)\b/i.test(q);
  const isList = /^(?:أرني|أظهر|ورني|أطلع|شوف|عطيني)(?:\s|$)|^(?:show|list)\b/i.test(q);
  const isSpecific = /(?:من\s*(?:هو|هم|يكون)?|عن\s*.{2,}|بخصوص|تفاصيل|معلومات|details|info\s+about|specific|حالة)/i.test(q);
  const results = [];
  
  const scoped = scopeAiData(store, user);
  const contracts = scoped.contracts;
  const quotes = scoped.quotes;
  const tickets = scoped.tickets;
  const visits = scoped.visits;
  const parts = scoped.parts.length ? scoped.parts : scopeAiData(Object.assign({}, store, {misadPartsInventory: store.misadParts || "[]"}), user).parts;
  const staff = scoped.staff;
  const suppliers = scoped.suppliers;
  
  function matchEntity(list, q) {
    const words = q.replace(/[،,?.!]/g,"").split(/\s+/).filter(w => w.length > 1);
    return list.filter(item => {
      const searchable = String(item.clientName || item.clientCompanyName || item.name || item.title || item.description || "").toLowerCase();
      return words.some(w => searchable.includes(w));
    });
  }

  if (/عق[وً]?د|عقود?|اتفاقات?|اتفاقية|contract/i.test(q)) {
    const matched = isSpecific ? matchEntity(contracts, q) : contracts;
    const total = contracts.length;
    const pending = contracts.filter(c => /pending|waiting|review|approval|انتظار|بانتظار/i.test(String(c.status || "")));
    const active = contracts.filter(c => /ساري|active|نشط|ongoing/i.test(String(c.status || "")));
    
    if (isCount) {
      results.push(`📋 إجمالي العقود: ${total} عقود`);
      if (active.length) results.push(`✅ السارية: ${active.length}`);
      if (pending.length) results.push(`⏳ قيد الانتظار: ${pending.length}`);
    } else if (isList || matched.length > 5) {
      results.push(`📋 العقود (${total})`);
      matched.slice(-10).reverse().forEach(c => {
        results.push(`• ${c.clientName || c.clientCompanyName || "عميل"}: ${c.type === "installation" ? "تركيب" : "صيانة"}${c.status ? ` (${c.status})` : ""}${c.value ? ` - ${Number(c.value).toLocaleString()} ريال` : ""}`);
      });
    } else if (matched.length === 1) {
      const c = matched[0];
      results.push(`📄 العقد:`);
      results.push(`العميل: ${c.clientName || c.clientCompanyName || "غير محدد"}`);
      results.push(`النوع: ${c.type === "installation" ? "تركيب" : "صيانة"}`);
      results.push(`الحالة: ${c.status || "غير محدد"}`);
      results.push(`القيمة: ${c.value ? `${Number(c.value).toLocaleString()} ريال` : "غير محددة"}`);
      if (c.startDate) results.push(`تاريخ البداية: ${c.startDate}`);
      if (c.endDate) results.push(`تاريخ النهاية: ${c.endDate}`);
    } else if (matched.length > 0) {
      results.push(`📋 العقود المطابقة (${matched.length}):`);
      matched.slice(0, 5).forEach(c => {
        results.push(`• ${c.clientName || c.clientCompanyName || "عميل"}: ${c.type === "installation" ? "تركيب" : "صيانة"}${c.value ? ` - ${Number(c.value).toLocaleString()} ريال` : ""}${c.status ? ` (${c.status})` : ""}`);
      });
    } else {
      results.push(`📋 إجمالي العقود: ${total}`);
      if (pending.length) results.push(`⏳ قيد الانتظار: ${pending.length}`);
      if (active.length) results.push(`✅ السارية: ${active.length}`);
    }
  }
  
  if (/عرض.{1,4}سعر|quot|تسعير|قيمة/i.test(q)) {
    const matched = isSpecific ? matchEntity(quotes, q) : quotes;
    const total = quotes.length;
    
    if (isCount) {
      results.push(`💰 إجمالي عروض الأسعار: ${total}`);
    } else if (matched.length === 1) {
      const qq = matched[0];
      results.push(`📄 عرض السعر:`);
      results.push(`العميل: ${qq.clientName || qq.clientCompanyName || "غير محدد"}`);
      results.push(`القيمة: ${qq.value ? `${Number(qq.value).toLocaleString()} ريال` : "غير محددة"}`);
      results.push(`الحالة: ${qq.status || "غير محدد"}`);
    } else {
      results.push(`💰 عروض الأسعار (${total})`);
      matched.slice(-5).reverse().forEach(qq => {
        results.push(`• ${qq.clientName || qq.clientCompanyName || "عميل"}: ${qq.value ? `${Number(qq.value).toLocaleString()} ريال` : "بدون سعر"}${qq.status ? ` (${qq.status})` : ""}`);
      });
    }
  }
  
  if (/فني[ي]?[ن]?|technician|مهندس[ي]?[ن]?|موظف[ي]?[ن]?|staff/i.test(q)) {
    const matched = matchEntity(staff, q);
    const total = staff.length;
    
    if (isCount) {
      results.push(`👥 عدد أعضاء الفريق: ${total}`);
      const techs = staff.filter(s => s.role === "technician");
      const engs = staff.filter(s => s.role === "engineer");
      if (techs.length) results.push(`🔧 فنيين: ${techs.length}`);
      if (engs.length) results.push(`👷 مهندسين: ${engs.length}`);
    } else if (matched.length === 1) {
      const s = matched[0];
      const roleAr = s.role === "engineer" ? "مهندس" : s.role === "technician" ? "فني" : s.role || "موظف";
      results.push(`👤 ${s.name}`);
      results.push(`الدور: ${roleAr}`);
      if (s.identity) results.push(`الهوية: ${s.identity}`);
      results.push(`الحالة: ${s.availability === "working" ? "نشط" : s.availability === "idle" ? "متفرغ" : s.availability === "vacation" ? "إجازة" : s.availability || "غير محدد"}`);
    } else if (isList || matched.length > 5) {
      results.push(`👥 الفريق (${total}):`);
      staff.forEach(s => {
        const roleAr = s.role === "engineer" ? "مهندس" : s.role === "technician" ? "فني" : s.role || "موظف";
        results.push(`• ${s.name || "غير محدد"} (${roleAr})${s.availability === "working" ? " ✅" : ""}`);
      });
    } else {
      results.push(`👥 الفريق: ${total} أعضاء`);
      staff.slice(0, 5).forEach(s => {
        const roleAr = s.role === "engineer" ? "مهندس" : s.role === "technician" ? "فني" : s.role || "موظف";
        results.push(`• ${s.name || "غير محدد"} (${roleAr})${s.availability ? ` - ${s.availability === "working" ? "نشط" : s.availability === "idle" ? "متفرغ" : s.availability === "vacation" ? "إجازة" : s.availability}` : ""}`);
      });
    }
  }
  
  if (/مخز[و]?ن|قطع|غيار|part|inventory/i.test(q)) {
    const matched = matchEntity(parts, q);
    const low = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
    const outOfStock = parts.filter(p => Number(p.qty || 0) === 0);
    
    if (isCount) {
      results.push(`📦 عدد أصناف المخزون: ${parts.length}`);
      if (low.length) results.push(`⚠️ ${low.length} صنف يحتاج إعادة طلب`);
      if (outOfStock.length) results.push(`❌ ${outOfStock.length} صنف نفد بالكامل`);
    } else if (matched.length === 1) {
      const p = matched[0];
      results.push(`📦 ${p.name || p.title || "قطعة"}`);
      if (p.sku) results.push(`الكود: ${p.sku}`);
      results.push(`الكمية: ${p.qty || 0}`);
      results.push(`الحد الأدنى: ${p.minQty || 1}`);
      results.push(`التكلفة: ${p.unitCost ? `${Number(p.unitCost).toLocaleString()} ريال` : "غير محددة"}`);
      if (Number(p.qty || 0) <= Number(p.minQty || 1)) results.push(`⚠️ يحتاج إعادة طلب`);
    } else {
      results.push(`📦 المخزون: ${parts.length} صنف${low.length ? ` (${low.length} يحتاج إعادة طلب)` : ""}`);
      (matched.length > 0 ? matched : low).slice(0, 5).forEach(p => {
        results.push(`• ${p.name || p.title || "قطعة"}: ${p.qty || 0} متبقي${Number(p.qty || 0) <= Number(p.minQty || 1) ? " ⚠️" : ""}`);
      });
    }
  }
  
  if (/مورد[ي]?[ن]?|supplier/i.test(q)) {
    const matched = matchEntity(suppliers, q);
    const total = suppliers.length;
    
    if (isCount) {
      results.push(`🏢 عدد الموردين: ${total}`);
    } else if (matched.length === 1) {
      const s = matched[0];
      results.push(`🏢 ${s.name}`);
      if (s.city) results.push(`المدينة: ${s.city}`);
      if (s.phone) results.push(`الجوال: ${s.phone}`);
      if (s.category) results.push(`التخصص: ${s.category}`);
      if (s.rating) results.push(`التقييم: ${s.rating}`);
    } else {
      results.push(`🏢 الموردون (${total}):`);
      (matched.length > 0 ? matched : suppliers).slice(0, 5).forEach(s => {
        results.push(`• ${s.name || "غير محدد"}${s.city ? ` - ${s.city}` : ""}${s.phone ? ` (${s.phone})` : ""}`);
      });
    }
  }
  
  if (/زيار[ة]?[ت]?|visit/i.test(q)) {
    const now = Date.now();
    const upcoming = visits.filter(v => v.scheduledAt && new Date(v.scheduledAt).getTime() >= now);
    const late = visits.filter(v => v.scheduledAt && new Date(v.scheduledAt).getTime() < now);
    const matched = isSpecific ? matchEntity(visits, q) : [];
    const total = visits.length;
    
    if (isCount) {
      results.push(`📅 عدد الزيارات: ${total}`);
      results.push(`🔜 القادمة: ${upcoming.length}`);
      results.push(`⚠️ المتأخرة: ${late.length}`);
    } else if (matched.length === 1) {
      const v = matched[0];
      results.push(`📅 زيارة:`);
      results.push(`العميل: ${v.clientName || "غير محدد"}`);
      results.push(`الحالة: ${v.status || "غير محدد"}`);
      if (v.scheduledAt) results.push(`الميعاد: ${new Date(v.scheduledAt).toLocaleDateString("ar-SA")}`);
      if (v.assignedName) results.push(`الفني: ${v.assignedName}`);
    } else {
      results.push(`📅 الزيارات: ${total} إجمالاً (${upcoming.length} قادمة، ${late.length} متأخرة)`);
      upcoming.slice(0, 3).forEach(v => {
        results.push(`• ${v.clientName || "عميل"}: ${v.scheduledAt ? new Date(v.scheduledAt).toLocaleDateString("ar-SA") : "غير محدد"}${v.assignedName ? ` - ${v.assignedName}` : ""}`);
      });
    }
  }
  
  if (/بلاغ[ا]?[ت]?|ticket/i.test(q)) {
    const open = tickets.filter(t => t.status !== "مغلق" && t.status !== "closed");
    const urgent = tickets.filter(t => t.priority === "urgent" && t.status !== "مغلق" && t.status !== "closed");
    const matched = isSpecific ? matchEntity(tickets, q) : [];
    const total = tickets.length;
    
    if (isCount) {
      results.push(`🎫 عدد البلاغات: ${total}`);
      results.push(`📂 المفتوحة: ${open.length}`);
      if (urgent.length) results.push(`🔴 الطارئة: ${urgent.length}`);
    } else if (matched.length === 1) {
      const t = matched[0];
      results.push(`🎫 بلاغ:`);
      results.push(`العنوان: ${t.title || t.description || "بلاغ"}`);
      results.push(`الحالة: ${t.status || "غير محدد"}`);
      results.push(`الأولوية: ${t.priority === "urgent" ? "طارئ 🔴" : t.priority === "high" ? "عالية" : t.priority === "low" ? "منخفضة" : "متوسطة"}`);
    } else {
      results.push(`🎫 البلاغات: ${total} إجمالاً (${open.length} مفتوحة${urgent.length ? `، ${urgent.length} طارئة 🔴` : ""})`);
      open.slice(0, 5).forEach(t => {
        results.push(`• ${t.title || t.description || "بلاغ"}${t.priority === "urgent" ? " 🔴" : ""}${t.clientName ? ` - ${t.clientName}` : ""}`);
      });
    }
  }
  
  // General system summary for vague queries
  if (results.length === 0 && !/^(?:من أنت|ما اسمك|وش اسمك|تحية|السلام)/i.test(q)) {
    const openTickets = tickets.filter(t => t.status !== "مغلق" && t.status !== "closed");
    const lateVisits = visits.filter(v => v.scheduledAt && new Date(v.scheduledAt).getTime() < Date.now());
    const lowParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
    results.push(`📊 ملخص النظام:`);
    results.push(`• ${contracts.length} عقد`);
    results.push(`• ${visits.length} زيارة (${lateVisits.length} متأخرة)`);
    results.push(`• ${openTickets.length} بلاغ مفتوح`);
    results.push(`• ${staff.length} فني/مهندس`);
    results.push(`• ${parts.length} صنف في المخزون${lowParts.length ? ` (${lowParts.length} بحاجة لإعادة طلب)` : ""}`);
    if (results.length === 5) results.push(`\n💡 جرب تسأل عن العقود أو عروض الأسعار أو الفنيين أو المخزون`);
  }
  
  return results.length > 0 ? results.join("\n") : null;
}

function inferAiPlan(question, context, user = {}) {
  const q = String(question || "");
  const role = String(user.role || "");
  const canManage = ["owner", "company_admin", "admin"].includes(role);
  const plan = {intent: "answer", action: null, data: {}, allowed: true, needsApproval: false, missing: [], suggestions: []};

  // --- Conversational intents (greetings, interviews, etc.) ---
  if (/^(?:السلام عليكم|وعليكم السلام|مرحبا|مرحباً|أهلا|أهلاً|هاي|هلا|هلو|hello|hi|صبحك الله|مساك الله|صباح الخير|مساء الخير|مساء النور|صباح النور|تحية|ترحيب)/i.test(q) || /^(?:how are you|كيف حالك|كيفك|كيف الحال|عامل إيه|عاملين|شلونك|شخبارك|عساك بخير|الله يحييك)/i.test(q))
    plan.intent = "greet";
  if (/^(?:مع السلامة|في أمان الله|تصبح على خير|تصبحون على خير|طابت ليلتك|إلى اللقاء|وداعاً|باي|bye|goodbye|see you|الله معك|استودعك الله|ليلة سعيدة|تصبحون على نور)/i.test(q))
    plan.intent = "farewell";
  if (/^(?:شكراً|شكرا|جزاك الله خير|الله يجزاك خير|مشكور|يعطيك العافية|تسلم|تسلم يدك|ثانكس|thank you|thanks|thx|أقدر لك|مقدر|ما قصرت|قصرت|تستاهل|الله يعطيك العافية)/i.test(q))
    plan.intent = "thanks";
  if (/^(?:آسف|أسف|sorry|معذرة|المعذرة|أعتذر|اعتذر|اعذرني|سمحلي|سامحني|عذراً|آسفة)/i.test(q))
    plan.intent = "apologize";
  // Can-do questions ("هل يمكن", "ممكن", "تقدر") - check BEFORE interview
  if (/^(?:هل\s*)?(?:ممكن|يمكن|تقدر|تقدرين|تستطيع|هل\s*أقدر|أقدر|هل\s*أستطيع|هل\s*يمكنني)\s+/i.test(q)) {
    plan.intent = "can_do";
    plan.data = {action: q.replace(/^(?:هل\s*)?(?:ممكن|يمكن|تقدر|تقدرين|تستطيع|هل\s*أقدر|أقدر|هل\s*أستطيع|هل\s*يمكنني)\s*/i, '').replace(/[؟?~!\s]+$/, '').trim()};
  } else
  // Interview / system questions
  if (/^(?:من أنت|ما اسمك|وش اسمك|عرفني بنفسك|من وين أنت|وش أنت|introduce yourself|what is your name|what can you do|tell me about yourself)/i.test(q) || /^(?:مهامك|قدراتك|إمكانياتك|وش تقدر|ماذا تفعل|ماذا تستطيع|what are your capabilities)/i.test(q) || /^(?:كيف أستخدمك|كيف أتعامل|كيف اتعامل|كيف أستفيد|كيف ابدأ|how do I use you|how to use)/i.test(q) || /^(?:مميزات|features|capabilities)/i.test(q) || /^(?:لماذا|ليه|why).*(?:استخدم|استعمل|أستعمل|هذا البرنامج|هذا النظام|هذا التطبيق)/i.test(q) || /^(?:ما هي|وش هي|what are).*(?:خدمات|features|مميزات|وظائف)/i.test(q))
    plan.intent = "interview";

  // --- Analysis intents ---
  if (/حلل|تحليل|تقرير|مؤشرات|إحصائيات|إحصاءات|stats|analysis|analytics/i.test(q)) {
    if (/مخزون|قطع|غيار|مستودع/i.test(q)) plan.intent = "analyze_inventory";
    else if (/فني|technician|engineer|موظف/i.test(q)) plan.intent = "analyze_staff";
    else plan.intent = "analyze_operations";
  }
  if (/توزيع|إعادة توزيع|وزع|وزع.الكل|redistribute/i.test(q)) plan.intent = "redistribute_visits";
  if (/إسناد|اسند|انقل|assign/i.test(q) && /زيارة|visit/i.test(q)) plan.intent = "assign_visit";
  if (/إشعار|notification|أرسل.إشعار|نبه/i.test(q)) plan.intent = "create_notification";
  if (/تحسين|تسعير|optimize|أمثل/i.test(q) && /عرض سعر|quote/i.test(q)) plan.intent = "optimize_quote";
  if (/تقرير|report/i.test(q) && /تحليل|analyze/i.test(q)) plan.intent = "analyze_report";

  // --- Query vs Creation intents ---
  // Query words indicate user wants information, not creation
  const hasQueryWord = /^(?:عطيني|أرني|ارني|أظهر|اظهر|كم|وش|ايش|كيف|أبي|ابي|ابغى|ابغا|بدي|نبي|نبغا|أريد|اريد|ورني|دلني|أطلع|اطلع|شوف|تعطيني|أعطني|اعطني|خليني|أشوف|اشوف|عدد|إجمالي)/i.test(q);
  // Creation action words indicate user wants to create something
  const hasCreateWord = /إنشاء|أنشئ|أنشي|إنشي|سوي|سو|سوى|اعمل|أضف|اضف|إضافة|new|create|add|جدول|تسجيل/i.test(q);
  
  const entityMap = [
    {pattern: /عق[وً]?د|عقود?|اتفاقات?|اتفاقية|contract/i, intent: "create_maintenance_contract", type: "contracts", isInstall: /تركيب|توريد|install/i.test(q)},
    {pattern: /عرض.{1,4}سعر|عروض|quotation|quote|تسعير/i, intent: "create_quote", type: "quotes"},
    {pattern: /بلاغ[ا]?[ت]?|ticket|شكوى|شكاوي|شكاية/i, intent: "create_ticket", type: "tickets"},
    {pattern: /زيار[ة]?[ت]?|visit/i, intent: "create_visit", type: "visits"},
    {pattern: /فني[ي]?[ن]?|technician|مهندس[ي]?[ن]?|engineer|موظف[ي]?[ن]?|staff/i, intent: "add_staff", type: "staff"},
    {pattern: /مورد[ي]?[ن]?|supplier/i, intent: "create_supplier", type: "suppliers"},
    {pattern: /قطعة.{0,3}غيار|part|مخز[و]?ن|inventory/i, intent: "create_part", type: "parts"}
  ];

  let matchedEntity = null;
  for (const entity of entityMap) {
    if (entity.pattern.test(q)) {
      matchedEntity = entity;
      break;
    }
  }

  if (matchedEntity) {
    const bareCreationRequest = !hasQueryWord && !hasCreateWord && q.split(/\s+/).filter(Boolean).length <= 4;
    if (hasQueryWord) {
      // User explicitly asked for info → query
      plan.intent = "query";
      plan.data = {entity: matchedEntity.type, query: q};
    } else if (hasCreateWord || bareCreationRequest) {
      // User explicitly wants to create
      plan.intent = matchedEntity.intent;
      if (matchedEntity.isInstall) plan.intent = "create_installation_contract";
    } else {
      // Just a bare entity name or general mention → treat as query
      plan.intent = "query";
      plan.data = {entity: matchedEntity.type, query: q};
    }
  }

  // Multi-action detection (generate schedule etc.)
  if (/جدول|schedule|برنامج/i.test(q) && /زيارات|visits/i.test(q)) plan.intent = "redistribute_visits";

  // --- Conversational intents (lowest priority - only if no action matched) ---
  if (plan.intent === "answer") {
    if (/^(?:السلام عليكم|وعليكم السلام|مرحبا|مرحباً|أهلا|أهلاً|هاي|هلا|هلو|hello|hi|صباح الخير|مساء الخير|مساء النور|صباح النور|تحية|ترحيب)/i.test(q) || /^(?:كيف حالك|كيفك|كيف الحال|عامل إيه|عاملين|شلونك|شخبارك|عساك بخير|الله يحييك)/i.test(q))
      plan.intent = "greet";
    else if (/^(?:مع السلامة|في أمان الله|تصبح على خير|تصبحون على خير|طابت ليلتك|إلى اللقاء|وداعاً|باي|bye|goodbye|see you|الله معك|استودعك الله|ليلة سعيدة|تصبحون على نور)/i.test(q))
      plan.intent = "farewell";
    else if (/^(?:شكراً|شكرا|جزاك الله خير|الله يجزاك خير|مشكور|يعطيك العافية|تسلم|تسلم يدك|ثانكس|thank you|thanks|thx|أقدر لك|مقدر|ما قصرت|قصرت|تستاهل|الله يعطيك العافية)/i.test(q))
      plan.intent = "thanks";
    else if (/^(?:آسف|أسف|sorry|معذرة|المعذرة|أعتذر|اعتذر|اعذرني|سمحلي|سامحني|عذراً|آسفة)/i.test(q))
      plan.intent = "apologize";
    else if (/^(?:من أنت|ما اسمك|وش اسمك|عرفني بنفسك|من وين أنت|وش أنت|introduce yourself|what is your name|what can you do|tell me about yourself)/i.test(q) || /^(?:مهامك|قدراتك|إمكانياتك|وش تقدر|ماذا تفعل|ماذا تستطيع|what are your capabilities)/i.test(q) || /^(?:كيف أستخدمك|كيف أتعامل|كيف اتعامل|كيف أستفيد|كيف ابدأ|how do I use you|how to use|مميزات|features|capabilities|طريقة الاستخدام|كيف يعمل|كيف تشتغل)/i.test(q) || /^(?:لماذا|ليه).*(?:استخدم|استعمل|أستعمل|هذا البرنامج|هذا النظام|هذا التطبيق)/i.test(q) || /^(?:ما هي|وش هي).*(?:خدمات|features|مميزات|وظائف)/i.test(q))
      plan.intent = "interview";
  }

  // --- Can-do questions ("هل يمكن", "ممكن", "تقدر") ---
  if (/^(?:هل\s*)?(?:ممكن|يمكن|تقدر|تقدرين|تستطيع|هل\s*أقدر|أقدر|هل\s*أستطيع|هل\s*يمكنني)\s+/i.test(q)) {
    plan.intent = "can_do";
    plan.data = {action: q.replace(/^(?:هل\s*)?(?:ممكن|يمكن|تقدر|تقدرين|تستطيع|هل\s*أقدر|أقدر|هل\s*أستطيع|هل\s*يمكنني)\s*/i, '').replace(/[؟?~!\s]+$/, '').trim()};
  }

  // --- Data Extraction ---
  const extract = {};

  // Client/Company name: بعد "لـ", "لمؤسسة", "لشركة", "لكتاب", "للشركة", "للمؤسسة", "باسم"
  const clientPatterns = [
    /(?:لـ|لمؤسسة|لشركة|لكتاب|للشركة|للمؤسسة|لعميل)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ|قيمته|مدة|لمدة|عقد|صيانة|تركيب)/i,
    /(?:مؤسسة|شركة|مكتب|مجموعة)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ|قيمته)/i,
    /باسم\s*[""]?([^"",\d]{3,50}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ)/i
  ];
  for (const pattern of clientPatterns) {
    const m = q.match(pattern);
    if (m) { extract.clientName = m[1].trim(); break; }
  }

  // Title for tickets
  const titlePatterns = [
    /(?:عنوانه|عنوان|بلاغ)\s*[""]?([^"",\d]{3,60}?)[""]?\s*(?:,|\.|$|أولوية|في|بـ)/i,
    /(?:عطل|مشكلة|خلل)\s*(.{3,60}?)(?:,|\.|$|أولوية|في|بـ)/i
  ];
  for (const pattern of titlePatterns) {
    const m = q.match(pattern);
    if (m) { extract.title = m[1].trim(); break; }
  }

  // Building name for visits
  const buildingMatch = q.match(/(?:مبنى|عمارة|موقع|في)\s*[""]?([^"",\d]{3,30}?)[""]?\s*(?:,|\.|$|يوم|بتاريخ|الساعة)/i);
  if (buildingMatch) extract.building = {name: buildingMatch[1].trim(), district: "", mapUrl: ""};

  // Staff name and identity
  const staffNameMatch = q.match(/(?:اسمه|اسم)\s*[""]?([^"",\d٠-٩۰-۹]{3,25}?)[""]?\s*(?:,|\.|$|هوية|هويته|رقم|[\d٠-٩۰-۹]{6,})/i) || q.match(/(?:فني|مهندس)\s*[""]?([^"",\d٠-٩۰-۹]{3,25}?)[""]?\s*(?:,|\.|$|هوية|هويته|رقم|[\d٠-٩۰-۹]{6,})/i);
  if (staffNameMatch) extract.name = staffNameMatch[1].trim();
  const identityMatch = q.match(/(?:هوية|هويته|رقم)\s*([\d٠-٩۰-۹]{8,10})/i);
  if (identityMatch) extract.identity = arNum(identityMatch[1]);
  const roleMatch = q.match(/مهندس|engineer/i);
  if (roleMatch) extract.role = "engineer";
  // also check if the word "فني" alone means technician
  if (/فني/i.test(q) && !extract.name) extract.role = "technician";

  // Supplier name
  if (!extract.name) {
    const suppMatch = q.match(/مورد\s*[""]?([^"",\d]{3,30}?)[""]?\s*(?:,|\.|$|جوال|في|تخصص)/i);
    if (suppMatch) extract.name = suppMatch[1].trim();
  }

  // Value/Amount
  function arNum(s) { return String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
  const valueMatch = q.match(/(?:بقيمة|قيمة|بمبلغ|مبلغ|سعر|تكلفة|بـ)\s*([\d,٠-٩۰-۹]+(?:\.[\d٠-٩۰-۹]+)?)/i);
  if (valueMatch) extract.value = Number(arNum(valueMatch[1]).replace(/,/g, ""));
  const directValue = q.match(/([\d,٠-٩۰-۹]+(?:\.[\d٠-٩۰-۹]+)?)\s*(?:ريال|ر\.س|SAR)/i);
  if (directValue && !extract.value) extract.value = Number(arNum(directValue[1]).replace(/,/g, ""));

  // Contract type
  if (/تركيب|توريد.{0,5}تركيب/i.test(q)) extract.type = "تركيب";
  else if (/صيانة|صيانة.{0,5}دورية/i.test(q)) extract.type = "صيانة";

  // Duration (سنوات)
  const durationMatch = q.match(/([\d٠-٩۰-۹]+)\s*(سنة|سنوات|سنين|عام|أعوام)/i);
  if (durationMatch) extract.contractYears = Number(arNum(durationMatch[1]));

  // Priority
  if (/طارئ|طارئة|urgent|عاجل/i.test(q)) extract.priority = "urgent";
  else if (/عالية|عالي|high/i.test(q)) extract.priority = "high";
  else if (/منخفضة|منخفض|low/i.test(q)) extract.priority = "low";
  else if (/متوسطة|medium/i.test(q)) extract.priority = "medium";

  // Date/Time
  const dateMatch = q.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) extract.scheduledAt = dateMatch[1];
  const timeMatch = q.match(/(?:الساعة|ساعة)\s*(\d{1,2}):(\d{2})/i);
  if (timeMatch && extract.scheduledAt) extract.scheduledAt += `T${timeMatch[1]}:${timeMatch[2]}`;

  // Technician name for assignment
  const techMatch = q.match(/(?:لـ|للفني|للمهندس|إلى|لـ)\s*[""]?([^"",\d]{3,20}?)[""]?\s*(?:,|\.|$|في|زيارة)/i);
  if (techMatch) extract.technicianName = techMatch[1].trim();

  // Visit ID for assignment
  const visitIdMatch = q.match(/(VIS-[\w-]+|زيارة\s*(\S+))/i);
  if (visitIdMatch) extract.visitId = visitIdMatch[1];

  // Supplier fields
  const phoneMatch = q.match(/(05\d{8})/);
  if (phoneMatch) extract.phone = phoneMatch[1];
  const cityMatch = q.match(/(?:في|بـ|من)\s*(الرياض|جدة|مكة|المدينة|الدمام|الخبر|القصيم|تبوك|أبها|حائل|نجران|جيزان|الحدود الشمالية|الجبيل|ينبع|بريدة|عنيزة|سكاكا|عرعر)/i);
  if (cityMatch) extract.city = cityMatch[1];

  // Supplier category
  if (/كهرباء|تحكم|electric/i.test(q)) extract.category = "قطع كهرباء وتحكم";
  else if (/أبواب|door/i.test(q)) extract.category = "أبواب ومداخل";
  else if (/محرك|motor|مكينة/i.test(q)) extract.category = "محركات ومكائن";
  else if (/حساس|sensor/i.test(q)) extract.category = "حساسات وأنظمة أمان";
  else if (/زيت|مستهلكات/i.test(q)) extract.category = "زيوت ومستهلكات";

  // --- Validation ---
  if (plan.intent === "can_do") {
    // preserve the action field set earlier
    plan.data = Object.assign({action: plan.data?.action || ""}, extract);
  } else {
    plan.data = extract;
  }

  if (plan.intent !== "answer") {
    plan.needsApproval = true;
    plan.action = plan.intent;
    if (!canManage && plan.intent !== "query" && plan.intent !== "can_do") {
      plan.allowed = false;
      plan.suggestions.push("المستخدم لا يملك صلاحية تنفيذ العمليات الإدارية.");
    }
  }

  // Context suggestions
  const counts = context.counts || {};
  if (counts.lateVisitsWithoutReport) plan.suggestions.push(`يوجد ${counts.lateVisitsWithoutReport} زيارة متأخرة دون تقرير.`);
  if (counts.openTickets) plan.suggestions.push(`يوجد ${counts.openTickets} بلاغ مفتوح يحتاج متابعة.`);
  if (counts.lowParts) plan.suggestions.push(`يوجد ${counts.lowParts} صنف مخزون عند حد الطلب أو أقل.`);

  // If nothing detected, try to figure out from context
  if (plan.intent === "answer" && canManage) {
    if (/إدارة|تشغيل|عمليات/i.test(q)) plan.intent = "analyze_operations";
    else if (/مخزون|قطع|غيار/i.test(q)) plan.intent = "analyze_inventory";
  }

  return plan;
}

function pushTokenList(store) {
  try { return JSON.parse(store.misadPushTokens || "[]"); } catch { return []; }
}

function savePushTokens(store, tokens) {
  store.misadPushTokens = JSON.stringify(tokens.slice(0, 1000));
  writeStore(store);
}

function sendNativePush(tokens, notification) {
  const key = process.env.FCM_SERVER_KEY || "";
  if (!key || !tokens.length || typeof fetch !== "function") return;
  const body = {
    registration_ids: tokens.map(x => x.token),
    notification: {title: notification.title, body: notification.body},
    data: {url: notification.url || "/dashboard.html", notificationId: notification.id}
  };
  fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": `key=${key}`},
    body: JSON.stringify(body)
  }).catch(() => {});
}

function parseStoredJson(store, key) {
  try {
    return JSON.parse(store[key] || "[]");
  } catch {
    return [];
  }
}

function aiOwnerId(user = {}) {
  const role = String(user.role || "");
  if (role === "company_admin") return user.companyOwnerId || user.id || user.userId || "";
  if (role === "admin") return "platform";
  return user.id || user.userId || "";
}

function aiRecOwner(record = {}) {
  return record.companyOwnerId || record.createdBy || record.linkedBy || "platform";
}

function scopeAiData(store, user = {}) {
  const owner = aiOwnerId(user);
  const role = String(user.role || "");
  const clean = v => String(v || "").replace(/\D/g, "");
  const users = parseStoredJson(store, "misadUsers");
  const clientCompanies = parseStoredJson(store, "misadClientCompanies");
  const clientIds = [clean(user.id || user.userId)];
  users.filter(u => u.role === "client" && u.name && u.name === user.name).forEach(u => clientIds.push(clean(u.id)));
  const clientNums = clientCompanies.filter(c => clientIds.includes(clean(c.ownerId))).map(c => clean(c.unifiedNumber));
  const matchClient = r => clientIds.includes(clean(r.clientId)) || clientNums.includes(clean(r.clientCompanyUnifiedNumber));
  const sameCompany = r => aiRecOwner(r) === owner;
  const scoped = list => role === "client" ? list.filter(matchClient) : list.filter(sameCompany);
  return {
    contracts: scoped(parseStoredJson(store, "misadContracts")),
    visits: role === "technician" || role === "engineer" ? parseStoredJson(store, "misadVisits").filter(v => sameCompany(v) && clean(v.assignedTo) === clean(user.id || user.userId)) : scoped(parseStoredJson(store, "misadVisits")),
    tickets: role === "technician" || role === "engineer" ? parseStoredJson(store, "misadTickets").filter(t => sameCompany(t) && clean(t.assignedTo) === clean(user.id || user.userId)) : scoped(parseStoredJson(store, "misadTickets")),
    reports: scoped(parseStoredJson(store, "misadVisitReports")),
    quotes: scoped(parseStoredJson(store, "misadQuotes")),
    parts: scoped(parseStoredJson(store, "misadPartsInventory")),
    suppliers: scoped(parseStoredJson(store, "misadSuppliers")),
    claims: scoped(parseStoredJson(store, "misadClaims")),
    staff: parseStoredJson(store, "misadCompanyStaff").filter(sameCompany),
    locations: parseStoredJson(store, "misadStaffLocations").filter(l => parseStoredJson(store, "misadCompanyStaff").filter(sameCompany).some(s => clean(s.identity) === clean(l.identity))),
    ownerCompanies: parseStoredJson(store, "misadOwnerCompanies").filter(c => c.ownerId === owner || c.id === owner || c.ownerIds?.includes(owner)),
    clientCompanies: role === "client" ? clientCompanies.filter(c => clientNums.includes(clean(c.unifiedNumber))) : clientCompanies.filter(c => c.companyOwnerId === owner || c.linkedBy === owner || c.createdBy === owner || c.ownerId === owner),
    docs: parseStoredJson(store, "misadCompanyDocs").filter(sameCompany)
  };
}

function compactRows(rows, fields, limit = 20) {
  return rows.slice(0, limit).map(row => Object.fromEntries(fields.map(field => [field, row?.[field] ?? ""])));
}

function buildAiContext(store, user = {}) {
  const scoped = scopeAiData(store, user);
  const {contracts, visits, tickets, reports, quotes, parts, suppliers, claims, staff, locations, ownerCompanies, clientCompanies, docs} = scoped;
  const now = Date.now();
  const statusText = x => String(x?.status || "");
  const includesAny = (value, words) => words.some(word => value.toLowerCase().includes(word.toLowerCase()));
  const pendingWords = ["pending", "waiting", "review", "approval", "\u0627\u0646\u062a\u0638\u0627\u0631", "\u0628\u0627\u0646\u062a\u0638\u0627\u0631", "\u0645\u0648\u0627\u0641\u0642\u0629", "\u0627\u0639\u062a\u0645\u0627\u062f"];
  const closedWords = ["closed", "done", "finished", "complete", "cancel", "\u0645\u063a\u0644\u0642", "\u0645\u0646\u062a\u0647\u064a", "\u0645\u0643\u062a\u0645\u0644", "\u0645\u062d\u0630\u0648\u0641", "\u0645\u0644\u063a\u064a"];
  const lowParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 0));
  const pendingContracts = contracts.filter(c => includesAny(statusText(c), pendingWords));
  const openTickets = tickets.filter(t => !includesAny(statusText(t), closedWords));
  const pendingReports = reports.filter(r => includesAny(statusText(r), pendingWords));
  const reportVisitIds = new Set(reports.map(r => String(r.visitId || "")));
  const lateVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled && scheduled < now && !reportVisitIds.has(String(v.id || ""));
  });
  const upcomingVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled && scheduled >= now;
  }).sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  const staffWorkload = staff.map(member => {
    const identity = String(member.identity || member.id || "");
    const assignedVisits = visits.filter(v => String(v.assignedTo || "") === identity);
    const openAssignedTickets = openTickets.filter(t => String(t.assignedTo || "") === identity);
    const liveLocation = locations.find(l => String(l.identity || "") === identity);
    return {
      identity,
      name: member.name || "",
      role: member.role || "",
      availability: member.availability || member.status || "",
      assignedVisits: assignedVisits.length,
      upcomingVisits: assignedVisits.filter(v => new Date(v.scheduledAt || 0).getTime() >= now).length,
      lateVisitsWithoutReport: assignedVisits.filter(v => lateVisits.some(x => String(x.id || "") === String(v.id || ""))).length,
      openTickets: openAssignedTickets.length,
      lastLocationAt: liveLocation?.updatedAt || liveLocation?.updatedAtIso || "",
      liveLocation: Boolean(liveLocation?.live)
    };
  }).sort((a, b) => (b.lateVisitsWithoutReport - a.lateVisitsWithoutReport) || (b.openTickets - a.openTickets) || (b.upcomingVisits - a.upcomingVisits));
  return {
    generatedAt: new Date().toISOString(),
    capabilities: {
      canAnswerSystemQuestions: true,
      canAnalyzeTechnicians: true,
      canAnalyzeVisits: true,
      canRecommendAssignments: true,
      canExecuteChanges: true,
      note: "The assistant can now directly execute operational actions through the system APIs."
    },
    counts: {
      contracts: contracts.length,
      visits: visits.length,
      tickets: tickets.length,
      reports: reports.length,
      quotes: quotes.length,
      parts: parts.length,
      suppliers: suppliers.length,
      claims: claims.length,
      staff: staff.length,
      ownerCompanies: ownerCompanies.length,
      clientCompanies: clientCompanies.length,
      documents: docs.length,
      lowParts: lowParts.length,
      pendingContracts: pendingContracts.length,
      openTickets: openTickets.length,
      pendingReports: pendingReports.length,
      lateVisitsWithoutReport: lateVisits.length,
      upcomingVisits: upcomingVisits.length
    },
    systemInfo: {
      ownerCompanies: compactRows(ownerCompanies, ["id", "name", "commercialNumber", "taxNumber", "phone", "address"], 5),
      clientCompanies: compactRows(clientCompanies, ["id", "name", "unifiedNumber", "taxNumber", "ownerId"], 20),
      expiringDocuments: compactRows(docs.filter(d => d.expiresAt), ["id", "partyName", "type", "name", "expiresAt"], 20)
    },
    staffWorkload: staffWorkload.slice(0, 40),
    pendingContracts: compactRows(pendingContracts, ["id", "type", "status", "clientName", "clientCompanyName", "value", "startDate", "endDate"], 20),
    openTickets: compactRows(openTickets, ["id", "title", "priority", "status", "clientName", "clientCompanyName", "assignedTo", "createdAt"], 25),
    lowParts: compactRows(lowParts, ["id", "name", "sku", "category", "qty", "minQty", "unitCost", "supplier"], 25),
    suppliers: compactRows(suppliers, ["id", "name", "phone", "city", "category", "rating"], 25),
    recentQuotes: compactRows(quotes, ["id", "title", "client", "value", "status", "createdAt"], 20),
    lateVisits: compactRows(lateVisits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName", "contractId"], 25),
    upcomingVisits: compactRows(upcomingVisits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName", "contractId"], 25),
    recentVisits: compactRows(visits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName"], 25)
  };
}
function nextContractId(contracts) {
  let maxNum = 0;
  contracts.forEach(c => {
    const m = String(c.id || "").match(/^CONT(\d{4})$/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  });
  return `CONT${String(maxNum + 1).padStart(4, "0")}`;
}

function arabicLocaleDate() {
  return new Date().toLocaleString("ar-SA");
}

function defaultMaintenanceChecklist() {
  const sections = [
    {section: "غرفة المصعد", items:["فحص زيت المحرك والتأكد من سيره الطبيعي.","فحص قماش الفرامل.","فحص عمل الفرامل وتضبيطه وتشحيم المحاور.","فحص السيور والتأكد من سلامتها.","فحص سلكتور والطوابق.","فحص جهاز الهبوط الاضطراري.","فحص منظم السرعة وضبطه.","تنظيف أرضية الغرفة.","التأكد من سلامة التمديدات الكهربائية بالغرفة.","التأكد من عدم وجود تهريب مياه بالغرفة.","التأكد من عدم وجود أي تخزين بالغرفة.","التأكد من وجود التكييف بحالة سليمة."]},
    {section: "بئر المصعد", items:["فحص التوصيلات الكهربائية أعلى الصاعدة والتأكد من سلامتها.","فحص جهاز الريفيزيون في حالة الصعود والهبوط والتوقف.","فحص حبال الجر وشدادات الحبال.","فحص بكرات الحبال والتأكد من سلامتها.","تزييت وتشحيم أدلة سير الصاعدة والثقل.","فحص قواطع نهاية المشوار.","فحص مغناطيس الأدوار.","الكشف على مروحة الصاعدة."]},
    {section: "داخل المصعد", items:["الكشف على أزرار التحكم والتشغيل.","الكشف عن الإنارة والجرس والانتركوم.","تنظيف مجاري الأبواب."]},
    {section: "أبواب الطوابق", items:["فحص أبواب الأدوار وضبطها.","فحص محركات الأبواب.","فحص وتنظيف الشوك والكوالين.","فحص مفصلات الأبواب.","فحص الكابلات والمؤشرات والمبينات وضبط الإضاءة."]},
    {section: "حفرة البئر", items:["الكشف على بكرة منظم السرعة.","تنظيف وفحص قواطع نهاية المشوار.","فحص التوصيلات الكهربائية أسفل الصاعدة والتأكد من سلامتها.","تنظيف الحفرة."]}
  ];
  return sections.flatMap(sec => sec.items.map((title, i) => ({
    id: `${sec.section}-${i}`, section: sec.section, title, status: "مطلوب", checked: false, note: ""
  })));
}

const defaultElevatorSpecs = () => ({
  elevatorType: "ركاب", usage: "سكني", entrances: "1", doorDirection: "سنتر", doorType: "أوتوماتيك",
  speedSystem: "VVVF", motorType: "Gearless", motorManufacturer: "Italy Gears", controller: "VEGA",
  doorManufacturer: "Sky", ropeManufacturer: "ATIKA", railManufacturer: "MF", originCountry: "إيطاليا",
  floorType: "رخام", wallType: "ستانلس ستيل", ceilingType: "ستانلس ستيل", lightingType: "LED",
  displayType: "Digital", risotType: "أزرار ستانلس", bufferType: "Hydraulic", doorLockType: "Electromechanical",
  rescueSystem: "نعم", coolingSystem: "مروحة", intercom: "نعم", camera: "لا", mirrors: "نعم", fan: "نعم",
  voiceAnnouncement: "لا", braille: "لا", fireMode: "نعم", warranty: "5 سنوات",
  capacity: "450 كجم", persons: "6", stops: "3", speed: "1 م/ث", travelHeight: "حسب الموقع",
  shaftWidth: "160 سم", shaftLength: "160 سم", pitDepth: "140 سم", overhead: "360 سم",
  doorWidth: "80 سم", doorHeight: "200 سم", motorPower: "5.5 kW", motorSpeed: "1500 rpm",
  voltage: "380V", frequency: "60Hz", phases: "3", cabinSize: "110 × 140 سم", ropesCount: "4",
  ropeDiameter: "10 مم", counterweight: "حسب التصميم", railSize: "T9", travelCableSize: "24 خط",
  doorOpenTime: "3 ثوان", doorCloseTime: "3 ثوان", powerConsumption: "حسب التشغيل", notes: "",
  count: "1", brand: "Italy Gears", age: "3"
});

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + Number(years || 1));
  d.setDate(d.getDate() - 1);
  return d;
}

function dateVal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function xmlText(s = "") {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function zipEntries(buffer) {
  const entries = {};
  let i = 0;
  while (i < buffer.length - 30) {
    if (buffer.readUInt32LE(i) !== 0x04034b50) { i++; continue; }
    const method = buffer.readUInt16LE(i + 8);
    const compressedSize = buffer.readUInt32LE(i + 18);
    const fileNameLength = buffer.readUInt16LE(i + 26);
    const extraLength = buffer.readUInt16LE(i + 28);
    const name = buffer.slice(i + 30, i + 30 + fileNameLength).toString("utf8");
    const dataStart = i + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.slice(dataStart, dataEnd);
    try {
      entries[name] = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : Buffer.alloc(0);
    } catch {
      entries[name] = Buffer.alloc(0);
    }
    i = dataEnd;
  }
  return entries;
}

function parseWorkbookSheets(entries) {
  const workbook = entries["xl/workbook.xml"]?.toString("utf8") || "";
  const rels = entries["xl/_rels/workbook.xml.rels"]?.toString("utf8") || "";
  const relMap = {};
  rels.replace(/<Relationship\b([^>]+?)\/?>/g, (_, attrs) => {
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relMap[id] = target.replace(/^\/?xl\//, "");
    return "";
  });
  const sheets = [];
  workbook.replace(/<sheet\b([^>]+?)\/?>/g, (_, attrs) => {
    const name = xmlText(attrs.match(/\bname="([^"]*)"/)?.[1] || "Sheet");
    const rid = attrs.match(/\br:id="([^"]+)"/)?.[1] || attrs.match(/\brelationshipId="([^"]+)"/)?.[1];
    const target = relMap[rid] || `worksheets/sheet${sheets.length + 1}.xml`;
    sheets.push({name, path: `xl/${target}`});
    return "";
  });
  return sheets.length ? sheets : [{name: "Sheet1", path: "xl/worksheets/sheet1.xml"}];
}

function parseSharedStrings(entries) {
  const xml = entries["xl/sharedStrings.xml"]?.toString("utf8") || "";
  const out = [];
  xml.replace(/<si\b[\s\S]*?<\/si>/g, si => {
    const parts = [];
    si.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, t) => { parts.push(xmlText(t)); return ""; });
    out.push(parts.join(""));
    return "";
  });
  return out;
}

function columnIndex(ref = "") {
  const letters = String(ref).match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function excelDate(n) {
  const serial = Number(n);
  if (!Number.isFinite(serial) || serial <= 0) return "";
  return dateVal(new Date(Date.UTC(1899, 11, 30 + serial)));
}

function parseSheetRows(xml, shared) {
  const rows = [];
  xml.replace(/<row\b[\s\S]*?<\/row>/g, rowXml => {
    const row = [];
    rowXml.replace(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, (_, attrs, body) => {
      const idx = columnIndex(attrs.match(/\br="([^"]+)"/)?.[1] || "");
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      const inline = body.match(/<is\b[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inline ?? "";
      row[idx] = type === "s" ? (shared[Number(raw)] || "") : xmlText(raw);
      return "";
    });
    if (row.some(v => String(v || "").trim())) rows.push(row);
    return "";
  });
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[اأإآ]/g, "ا").replace(/[ة]/g, "ه").replace(/[^\p{L}\p{N}]+/gu, "");
}

function pickCell(row, headers, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const idx = headers.findIndex(h => h === key || h.includes(key) || key.includes(h));
    if (idx >= 0 && row[idx] !== undefined && String(row[idx]).trim() !== "") return String(row[idx]).trim();
  }
  return "";
}

function numberCell(value) {
  const n = String(value || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[^\d.-]/g, "");
  return Number(n || 0);
}

function dateCell(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^\d+(\.\d+)?$/.test(v) && Number(v) > 20000) return excelDate(v);
  const m = v.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/) || v.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (!m) return v;
  const y = m[1].length === 4 ? m[1] : m[3], mo = m[1].length === 4 ? m[2] : m[2], d = m[1].length === 4 ? m[3] : m[1];
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseExcelContracts(buffer) {
  const entries = zipEntries(buffer);
  const shared = parseSharedStrings(entries);
  const sheets = parseWorkbookSheets(entries);
  const parsed = [];
  for (const sheet of sheets) {
    const xml = entries[sheet.path]?.toString("utf8");
    if (!xml) continue;
    const rows = parseSheetRows(xml, shared);
    if (rows.length < 2) continue;
    const headerRowIndex = rows.findIndex(r => r.filter(Boolean).length >= 2);
    if (headerRowIndex < 0) continue;
    const headers = rows[headerRowIndex].map(normalizeHeader);
    for (const row of rows.slice(headerRowIndex + 1)) {
      const clientCompanyName = pickCell(row, headers, ["اسم المنشأة", "الشركة", "اسم الشركة", "العميل", "الطرف الثاني", "client company", "company", "client"]);
      const clientName = pickCell(row, headers, ["اسم العميل", "ممثل العميل", "المالك", "client name", "customer"]);
      const value = numberCell(pickCell(row, headers, ["قيمة العقد", "القيمة", "المبلغ", "اجمالي", "الإجمالي", "value", "amount", "total"]));
      const buildingName = pickCell(row, headers, ["المبنى", "اسم المبنى", "الموقع", "العقار", "building", "site", "location"]);
      const startDate = dateCell(pickCell(row, headers, ["بداية العقد", "تاريخ البداية", "تاريخ العقد", "start date", "start"]));
      const endDate = dateCell(pickCell(row, headers, ["نهاية العقد", "تاريخ النهاية", "end date", "end"]));
      if (!clientCompanyName && !clientName && !buildingName && !value) continue;
      parsed.push({
        sheet: sheet.name,
        type: /تركيب|install/i.test(pickCell(row, headers, ["نوع العقد", "النوع", "type"])) ? "تركيب" : "صيانة",
        clientName,
        clientCompanyName: clientCompanyName || clientName,
        clientId: cleanNationalId(pickCell(row, headers, ["هوية العميل", "رقم الهوية", "client id", "id"])),
        clientCompanyUnifiedNumber: cleanNationalId(pickCell(row, headers, ["الرقم الموحد", "رقم المنشأة", "unified number", "company id"])),
        value,
        startDate: startDate || dateVal(new Date()),
        endDate,
        contractYears: numberCell(pickCell(row, headers, ["مدة العقد", "المدة", "years"])) || 1,
        details: pickCell(row, headers, ["التفاصيل", "الوصف", "ملاحظات", "details", "notes"]) || "مستورد من ملف Excel عبر الذكاء الاصطناعي.",
        elevatorInfo: {
          count: pickCell(row, headers, ["عدد المصاعد", "العدد", "elevator count", "count"]) || "1",
          brand: pickCell(row, headers, ["الماركة", "brand"]),
          age: pickCell(row, headers, ["العمر", "age"]),
          capacity: pickCell(row, headers, ["السعة", "capacity"]),
          usage: pickCell(row, headers, ["الاستخدام", "usage"])
        },
        buildings: [{name: buildingName || "موقع غير محدد", district: pickCell(row, headers, ["الحي", "district"]), mapUrl: pickCell(row, headers, ["رابط الموقع", "الخريطة", "map"]), guardMobile: pickCell(row, headers, ["جوال الحارس", "حارس", "guard"])}]
      });
    }
  }
  return parsed;
}

function cleanNationalId(value) {
  return String(value || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "");
}

function normalizeArabicImportText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function importHeaderKey(value) {
  return normalizeArabicImportText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function cleanNationalId(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/\D/g, "");
}

function numberCell(value) {
  const n = String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[^\d.-]/g, "");
  return Number(n || 0);
}

function parseExcelContracts(buffer) {
  const entries = zipEntries(buffer);
  const shared = parseSharedStrings(entries);
  const sheets = parseWorkbookSheets(entries);
  const parsed = [];
  const pick = (row, headers, aliases) => {
    for (const alias of aliases) {
      const key = importHeaderKey(alias);
      const idx = headers.findIndex(h => h === key || h.includes(key) || key.includes(h));
      if (idx >= 0 && row[idx] !== undefined && String(row[idx]).trim() !== "") return String(row[idx]).trim();
    }
    return "";
  };
  for (const sheet of sheets) {
    const xml = entries[sheet.path]?.toString("utf8");
    if (!xml) continue;
    const rows = parseSheetRows(xml, shared);
    if (rows.length < 2) continue;
    const headerRowIndex = rows.findIndex(r => r.filter(Boolean).length >= 2);
    if (headerRowIndex < 0) continue;
    const headers = rows[headerRowIndex].map(importHeaderKey);
    for (const row of rows.slice(headerRowIndex + 1)) {
      const contractType = pick(row, headers, ["نوع العقد", "النوع", "نوع الخدمة", "خدمة", "type", "contract type"]);
      const clientCompanyName = pick(row, headers, ["اسم المنشأة", "اسم الشركة", "الشركة", "المؤسسة", "العميل", "الطرف الثاني", "client company", "company", "client"]);
      const clientName = pick(row, headers, ["اسم العميل", "ممثل العميل", "المالك", "صاحب العقد", "client name", "customer", "owner"]);
      const value = numberCell(pick(row, headers, ["قيمة العقد", "القيمة", "المبلغ", "اجمالي", "الإجمالي", "السعر", "value", "amount", "total", "price"]));
      const buildingName = pick(row, headers, ["المبنى", "اسم المبنى", "الموقع", "العقار", "المشروع", "building", "site", "location", "project"]);
      const startDate = dateCell(pick(row, headers, ["بداية العقد", "تاريخ البداية", "تاريخ العقد", "من تاريخ", "start date", "start", "from"]));
      const endDate = dateCell(pick(row, headers, ["نهاية العقد", "تاريخ النهاية", "إلى تاريخ", "الى تاريخ", "end date", "end", "to"]));
      if (!clientCompanyName && !clientName && !buildingName && !value) continue;
      parsed.push({
        sheet: sheet.name,
        type: /تركيب|install/i.test(contractType) ? "تركيب" : "صيانة",
        clientName,
        clientCompanyName: clientCompanyName || clientName,
        clientId: cleanNationalId(pick(row, headers, ["هوية العميل", "رقم الهوية", "هوية المالك", "client id", "customer id", "id"])),
        clientCompanyUnifiedNumber: cleanNationalId(pick(row, headers, ["الرقم الموحد", "رقم المنشأة", "رقم الشركة", "السجل", "unified number", "company id", "cr"])),
        value,
        startDate: startDate || dateVal(new Date()),
        endDate,
        contractYears: numberCell(pick(row, headers, ["مدة العقد", "المدة", "عدد السنوات", "years", "duration"])) || 1,
        details: pick(row, headers, ["التفاصيل", "الوصف", "ملاحظات", "بيان", "details", "notes", "description"]) || "مستورد من ملف Excel عبر الذكاء الاصطناعي.",
        elevatorInfo: {
          count: pick(row, headers, ["عدد المصاعد", "العدد", "elevator count", "count"]) || "1",
          brand: pick(row, headers, ["الماركة", "العلامة", "brand"]),
          age: pick(row, headers, ["العمر", "سنة الصنع", "age"]),
          capacity: pick(row, headers, ["السعة", "الحمولة", "capacity"]),
          usage: pick(row, headers, ["الاستخدام", "نوع الاستخدام", "usage"])
        },
        buildings: [{
          name: buildingName || "موقع غير محدد",
          district: pick(row, headers, ["الحي", "المنطقة", "district", "area"]),
          mapUrl: pick(row, headers, ["رابط الموقع", "الخريطة", "map", "maps"]),
          guardMobile: pick(row, headers, ["جوال الحارس", "الحارس", "جوال المسؤول", "guard", "mobile"])
        }]
      });
    }
  }
  return parsed;
}

function parseMultipartFile(req, limitBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limitBytes) { reject(new Error("حجم الملف أكبر من الحد المسموح 12MB.")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";
      const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
      if (!boundary) return reject(new Error("طلب الرفع غير صحيح."));
      const body = Buffer.concat(chunks);
      const marker = Buffer.from(`--${boundary}`);
      let offset = body.indexOf(marker);
      while (offset >= 0) {
        const next = body.indexOf(marker, offset + marker.length);
        if (next < 0) break;
        const part = body.slice(offset + marker.length + 2, next - 2);
        const sep = part.indexOf(Buffer.from("\r\n\r\n"));
        if (sep > 0) {
          const headers = part.slice(0, sep).toString("utf8");
          const data = part.slice(sep + 4);
          if (/name="file"/.test(headers)) {
            const filename = headers.match(/filename="([^"]*)"/)?.[1] || "contracts.xlsx";
            return resolve({filename, data});
          }
        }
        offset = next;
      }
      reject(new Error("لم يتم العثور على ملف Excel في الطلب."));
    });
  });
}

function buildImportedContract(item, contracts, actionOwnerId, owner, userId) {
  const startDate = item.startDate || dateVal(new Date());
  const endDate = item.endDate || dateVal(addYears(new Date(`${startDate}T00:00`), item.contractYears || 1));
  return {
    id: nextContractId(contracts),
    companyOwnerId: actionOwnerId,
    companyId: owner?.id || "",
    type: item.type || "صيانة",
    targetType: item.clientCompanyName ? "company" : "client",
    clientId: item.clientId || "",
    clientName: item.clientName || "",
    clientCompanyUnifiedNumber: item.clientCompanyUnifiedNumber || "",
    clientCompanyName: item.clientCompanyName || item.clientName || "",
    value: Number(item.value || 0),
    elevatorInfo: Object.assign({count: "", brand: "", age: "", capacity: "", doorType: "", usage: ""}, item.elevatorInfo || {}),
    installationInfo: {},
    maintenanceChecklist: defaultMaintenanceChecklist(),
    buildings: item.buildings?.length ? item.buildings : [{name: "موقع غير محدد", district: "", mapUrl: "", guardMobile: ""}],
    items: [],
    customItems: [],
    details: item.details || "مستورد من ملف Excel.",
    status: "بانتظار موافقة العميل",
    startDate,
    contractYears: Number(item.contractYears || 1),
    endDate,
    createdAt: arabicLocaleDate(),
    createdAtMs: Date.now(),
    createdBy: userId || "excel-import",
    importedFromExcel: true,
    company: {name: owner?.name || "شركة غير محددة"}
  };
}

function getMissingFields(action, data) {
  const d = data || {};
  const required = {
    create_contract: [
      {field: "type", label: "نوع العقد (صيانة أو تركيب)", check: v => /صيانة|تركيب|maintenance|installation/i.test(String(v || ""))},
      {field: "clientName", label: "اسم العميل", check: v => v && String(v).trim().length > 1},
      {field: "clientCompanyName", label: "اسم الشركة أو المؤسسة", check: v => v && String(v).trim().length > 1},
      {field: "value", label: "قيمة العدد", check: v => Number(v) > 0},
      {field: "contractYears", label: "مدة العقد بالسنوات", check: v => Number(v) > 0},
      {field: "startDate", label: "تاريخ بداية العقد (صيغة YYYY-MM-DD)", check: v => v && String(v).trim().length > 0},
      {field: "details", label: "تفاصيل العقد", check: v => v && String(v).trim().length > 1}
    ],
    create_quote: [
      {field: "type", label: "نوع عرض السعر (تركيب أو صيانة)", check: v => /تركيب|صيانة|installation|maintenance/i.test(String(v || ""))},
      {field: "clientName", label: "اسم العميل", check: v => v && String(v).trim().length > 1},
      {field: "clientCompanyName", label: "اسم الشركة أو المؤسسة", check: v => v && String(v).trim().length > 1},
      {field: "title", label: "عنوان عرض السعر", check: v => v && String(v).trim().length > 1},
      {field: "value", label: "قيمة عرض السعر", check: v => Number(v) > 0},
      {field: "details", label: "تفاصيل عرض السعر", check: v => v && String(v).trim().length > 1}
    ],
    create_ticket: [
      {field: "title", label: "عنوان البلاغ", check: v => v && String(v).trim().length > 1},
      {field: "description", label: "وصف البلاغ", check: v => v && String(v).trim().length > 1},
      {field: "priority", label: "الأولوية (منخفضة/متوسطة/عالية/طارئ)", check: v => /medium|low|high|urgent|متوسطة|منخفضة|عالية|طارئ/i.test(String(v || ""))},
      {field: "clientName", label: "اسم العميل", check: v => v && String(v).trim().length > 1},
      {field: "clientCompanyName", label: "اسم الشركة أو المؤسسة", check: v => v && String(v).trim().length > 1}
    ],
    create_visit: [
      {field: "clientName", label: "اسم العميل", check: v => v && String(v).trim().length > 1},
      {field: "clientCompanyName", label: "اسم الشركة أو المؤسسة", check: v => v && String(v).trim().length > 1},
      {field: "buildingName", label: "اسم المبنى", check: v => v && String(v).trim().length > 1},
      {field: "buildingDistrict", label: "الحي", check: v => v && String(v).trim().length > 1},
      {field: "scheduledAt", label: "تاريخ الزيارة (صيغة YYYY-MM-DD)", check: v => v && String(v).trim().length > 0},
      {field: "notes", label: "ملاحظات عن الزيارة", check: v => v && String(v).trim().length > 1}
    ],
    add_staff: [
      {field: "name", label: "اسم الفني", check: v => v && String(v).trim().length > 1},
      {field: "identity", label: "هوية الفني (رقم الإقامة)", check: v => v && String(v).trim().length > 5},
      {field: "role", label: "الدور (technician أو engineer)", check: v => /technician|engineer|فني|مهندس/i.test(String(v || ""))}
    ],
    create_supplier: [
      {field: "name", label: "اسم المورد", check: v => v && String(v).trim().length > 1},
      {field: "phone", label: "جوال المورد", check: v => v && String(v).trim().length > 5},
      {field: "email", label: "البريد الإلكتروني للمورد", check: v => v && String(v).trim().length > 3},
      {field: "city", label: "مدينة المورد", check: v => v && String(v).trim().length > 1},
      {field: "category", label: "تخصص المورد", check: v => v && String(v).trim().length > 1}
    ]
  };
  const fields = required[action] || [];
  const missing = fields.filter(f => !f.check(d[f.field]));
  return missing.length > 0 ? [missing[0]] : [];
}

function executeAiAction(actionData, store) {
  const result = {executed: false, action: actionData.action, message: ""};
  const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
  const actionOwnerId = aiOwnerId(actionData);
  const owner = ownerCompanies.find(c => c.ownerId === actionOwnerId || c.id === actionOwnerId || c.ownerIds?.includes(actionOwnerId)) || {id: "", name: "شركة غير محددة"};
  const canAccessRecord = record => aiRecOwner(record) === actionOwnerId;
  try {
    switch (actionData.action) {
      case "create_contract": {
        const contracts = parseStoredJson(store, "misadContracts");
        const d = actionData.data || {};
        const startDate = d.startDate || new Date().toISOString().split("T")[0];
        const years = Number(d.contractYears || 1);
        const endDate = d.endDate || dateVal(addYears(new Date(`${startDate}T00:00`), years));
        const isInstall = d.type === "تركيب";
        const user = parseStoredJson(store, "misadUsers").find(u => u.id === actionData.userId);
        const r = user ? {id: user.id, name: user.name} : {id: actionData.userId || "ai", name: "الذكاء الاصطناعي"};
        const contract = {
          id: nextContractId(contracts),
          companyOwnerId: d.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          companyId: d.companyId || owner.id || "",
          type: d.type || "صيانة",
          targetType: d.targetType || "client",
          clientId: d.clientId || "",
          clientName: d.clientName || "",
          clientCompanyUnifiedNumber: d.clientCompanyUnifiedNumber || "",
          clientCompanyName: d.clientCompanyName || "",
          value: Number(d.value || 0),
          elevatorInfo: isInstall ? Object.assign(defaultElevatorSpecs(), d.elevatorInfo || {}) : Object.assign({count: "", brand: "", age: "", capacity: "", doorType: "", usage: ""}, d.elevatorInfo || {}),
          installationInfo: isInstall ? Object.assign({stops: "", entrances: "", battery: "", doorOpening: "", shaftSize: "", motor: "", controller: "", outerDoors: "", safetyDoor: "", cabin: "", power: "", speed: "", warranty: "", note: ""}, d.installationInfo || {}) : {},
          maintenanceChecklist: d.maintenanceChecklist && d.maintenanceChecklist.length ? d.maintenanceChecklist : defaultMaintenanceChecklist(),
          buildings: d.buildings && d.buildings.length ? d.buildings : [{name: "", district: "", mapUrl: "", guardMobile: ""}],
          items: d.items || [],
          customItems: d.customItems || [],
          details: isInstall ? "" : (d.details || ""),
          status: "بانتظار موافقة العميل",
          startDate: startDate,
          contractYears: years,
          endDate: endDate,
          createdAt: arabicLocaleDate(),
          createdAtMs: Date.now(),
          createdBy: r.id,
          company: {name: owner.name || "شركة غير محددة"}
        };
        contracts.unshift(contract);
        store.misadContracts = JSON.stringify(contracts.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء العقد ${contract.id} بنجاح`;
        result.contract = contract;
        break;
      }
      case "create_quote": {
        const quotes = parseStoredJson(store, "misadQuotes");
        const d = actionData.data || {};
        const baseValue = Number(d.value || 0);
        const itemsTotal = (d.items || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const customTotal = (d.customItems || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const partsTotal = (d.partsItems || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const total = baseValue + itemsTotal + customTotal + partsTotal;
        const clientName = d.clientName || "";
        const companyName = d.clientCompanyName || "";
        const quoteType = d.type && /صيانة|maintenance/i.test(String(d.type)) ? "صيانة" : "تركيب";
        const isInstall = quoteType === "تركيب";
        const quote = {
          id: `QTO-${Date.now()}`,
          companyOwnerId: d.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          clientId: d.clientId || "",
          clientName: clientName,
          clientCompanyUnifiedNumber: d.clientCompanyUnifiedNumber || "",
          clientCompanyName: companyName,
          client: d.client || companyName || clientName || "عميل",
          title: d.title || "عرض سعر",
          type: quoteType,
          value: total,
          subtotal: total,
          status: "بانتظار المراجعة والاعتماد",
          reportId: d.reportId || "",
          elevatorInfo: isInstall ? Object.assign({count: "", brand: "", age: "", capacity: "", doorType: "", usage: ""}, d.elevatorInfo || {}) : {},
          maintenanceChecklist: !isInstall && d.maintenanceChecklist && d.maintenanceChecklist.length ? d.maintenanceChecklist : [],
          items: d.items || [],
          partsItems: d.partsItems || [],
          customItems: d.customItems || [],
          details: d.details || "",
          createdAt: arabicLocaleDate(),
          createdBy: actionData.userId || "ai"
        };
        quotes.unshift(quote);
        store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء عرض السعر ${quote.id} بنجاح بقيمة ${total.toFixed(2)} ريال`;
        result.quote = quote;
        break;
      }
      case "create_ticket": {
        const tickets = parseStoredJson(store, "misadTickets");
        const ticket = {
          id: `TCK-${Date.now()}`,
          companyOwnerId: actionData.data.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          title: actionData.data.title || "بلاغ",
          description: actionData.data.description || "",
          priority: actionData.data.priority || "medium",
          status: "مفتوح",
          clientName: actionData.data.clientName || "",
          clientId: actionData.data.clientId || "",
          clientCompanyName: actionData.data.clientCompanyName || "",
          clientCompanyUnifiedNumber: actionData.data.clientCompanyUnifiedNumber || "",
          contractId: actionData.data.contractId || "",
          building: actionData.data.building || {},
          assignedTo: actionData.data.assignedTo || "",
          createdBy: actionData.userId || "ai",
          createdAt: new Date().toISOString(),
          createdAtMs: Date.now()
        };
        tickets.unshift(ticket);
        store.misadTickets = JSON.stringify(tickets.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء البلاغ ${ticket.id} بنجاح`;
        result.ticket = ticket;
        break;
      }
      case "create_visit": {
        const visits = parseStoredJson(store, "misadVisits");
        const visit = {
          id: `VIS-${Date.now()}`,
          companyOwnerId: actionData.data.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          visitType: actionData.data.visitType || "صيانة دورية",
          status: "مجدولة",
          clientName: actionData.data.clientName || "",
          clientId: actionData.data.clientId || "",
          clientCompanyName: actionData.data.clientCompanyName || "",
          clientCompanyUnifiedNumber: actionData.data.clientCompanyUnifiedNumber || "",
          contractId: actionData.data.contractId || "",
          building: actionData.data.building || {},
          scheduledAt: actionData.data.scheduledAt || new Date().toISOString(),
          assignedTo: actionData.data.assignedTo || "",
          assignedName: actionData.data.assignedName || "",
          createdBy: actionData.userId || "ai",
          createdAt: new Date().toISOString()
        };
        visits.unshift(visit);
        store.misadVisits = JSON.stringify(visits.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء الزيارة ${visit.id} بنجاح`;
        result.visit = visit;
        break;
      }
      case "assign_visit": {
        const visits = parseStoredJson(store, "misadVisits");
        const visitIndex = visits.findIndex(v => v.id === actionData.data.visitId);
        if (visitIndex === -1) {
          result.message = "الزيارة غير موجودة";
          break;
        }
        if (!canAccessRecord(visits[visitIndex])) {
          result.message = "لا تملك صلاحية تعديل هذه الزيارة";
          break;
        }
        visits[visitIndex].assignedTo = actionData.data.technicianId || "";
        visits[visitIndex].assignedName = actionData.data.technicianName || "";
        visits[visitIndex].assignedAt = new Date().toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        result.executed = true;
        result.message = `تم إسناد الزيارة ${actionData.data.visitId} إلى ${actionData.data.technicianName}`;
        break;
      }
      case "redistribute_visits": {
        const redistributeAll = actionData.data.redistributeAll === true;
        const analysis = redistributeVisits(store, {redistributeAll});
        analysis.proposedAssignments = (analysis.proposedAssignments || []).filter(a => {
          const v = parseStoredJson(store, "misadVisits").find(x => x.id === a.visitId);
          return v && canAccessRecord(v);
        });
        if (analysis.proposedAssignments.length > 0) {
          const visits = parseStoredJson(store, "misadVisits");
          analysis.proposedAssignments.forEach(assignment => {
            const idx = visits.findIndex(v => v.id === assignment.visitId);
            if (idx !== -1) {
              visits[idx].assignedTo = assignment.proposedTechnicianId;
              visits[idx].assignedName = assignment.proposedTechnician;
              visits[idx].rebalancedAt = new Date().toISOString();
              visits[idx].rebalancedBy = actionData.userId || "ai";
            }
          });
          store.misadVisits = JSON.stringify(visits);
          writeStore(store);
        }
        result.executed = true;
        result.message = `تم إعادة توزيع ${analysis.proposedAssignments.length} زيارة`;
        result.redistribution = analysis;
        break;
      }
      case "create_supplier": {
        const suppliers = parseStoredJson(store, "misadSuppliers");
        const supplier = {
          id: `SUP-${Date.now()}`,
          companyOwnerId: actionData.data.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          name: actionData.data.name || "مورد جديد",
          phone: actionData.data.phone || "",
          email: actionData.data.email || "",
          city: actionData.data.city || "",
          category: actionData.data.category || "توريد شامل",
          rating: actionData.data.rating || "تحت التجربة",
          notes: actionData.data.notes || "أنشئ بواسطة الذكاء الاصطناعي",
          createdAt: new Date().toISOString(),
          createdBy: actionData.userId || "ai"
        };
        suppliers.unshift(supplier);
        store.misadSuppliers = JSON.stringify(suppliers.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء المورد ${supplier.name} بنجاح`;
        result.supplier = supplier;
        break;
      }
      case "add_staff": {
        const staff = parseStoredJson(store, "misadCompanyStaff");
        const member = {
          id: `STF-${Date.now()}`,
          companyOwnerId: actionData.data.companyOwnerId || actionOwnerId || actionData.userId || "ai",
          identity: actionData.data.identity || "",
          name: actionData.data.name || "فني جديد",
          role: actionData.data.role || "technician",
          availability: actionData.data.availability || "working",
          status: actionData.data.status || "مرتبط",
          phone: actionData.data.phone || "",
          createdAt: new Date().toISOString(),
          createdBy: actionData.userId || "ai"
        };
        staff.unshift(member);
        store.misadCompanyStaff = JSON.stringify(staff.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إضافة ${member.name} إلى فريق العمل`;
        result.staff = member;
        break;
      }
      case "create_notification": {
        const notifications = notificationList(store);
        const notification = {
          id: `NTF-${Date.now()}`,
          title: actionData.data.title || "إشعار ذكي",
          body: actionData.data.body || "",
          userId: actionData.data.userId || "",
          roles: actionData.data.roles || [],
          url: actionData.data.url || "/dashboard.html",
          createdAt: new Date().toISOString(),
          readBy: []
        };
        notifications.unshift(notification);
        saveNotifications(store, notifications);
        const tokens = pushTokenList(store).filter(t => !notification.userId || t.userId === notification.userId);
        sendNativePush(tokens, notification);
        result.executed = true;
        result.message = `تم إنشاء الإشعار بنجاح`;
        result.notification = notification;
        break;
      }
      case "analyze_report": {
        const reports = parseStoredJson(store, "misadVisitReports");
        const report = reports.find(r => r.id === actionData.data.reportId);
        if (!report) {
          result.message = "التقرير غير موجود";
          break;
        }
        const analysis = analyzeReportForQuote(report, store);
        const autoGenerateQuote = actionData.data.autoGenerateQuote !== false;
        let quote = null;
        if (autoGenerateQuote && (analysis.needsSpareParts || analysis.needsInstallation || analysis.needsUpdate || analysis.needsReplacement || analysis.needsAdditionalWorks)) {
          quote = generateAutoQuote(report, analysis, store, actionData.userId || "ai");
          const quotes = parseStoredJson(store, "misadQuotes");
          quotes.unshift(quote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
        }
        result.executed = true;
        result.message = `تم تحليل التقرير ${actionData.data.reportId}` + (quote ? ` وإنشاء عرض السعر ${quote.id}` : "");
        result.analysis = analysis;
        result.quote = quote;
        break;
      }
      case "optimize_quote": {
        const quotes = parseStoredJson(store, "misadQuotes");
        const quoteIndex = quotes.findIndex(q => q.id === actionData.data.quoteId);
        if (quoteIndex === -1) {
          result.message = "عرض السعر غير موجود";
          break;
        }
        const targetValue = Number(actionData.data.targetValue || 0);
        const quoteCopy = JSON.parse(JSON.stringify(quotes[quoteIndex]));
        const optimization = optimizeQuotePrices(quoteCopy, targetValue, store);
        let newQuote = null;
        if (optimization.achievable) {
          newQuote = createQuoteVersion(quoteCopy, optimization.changes, actionData.userId || "ai");
          quotes.unshift(newQuote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
        }
        result.executed = true;
        result.message = optimization.achievable ? `تم تحسين عرض السعر. القيمة الجديدة: ${optimization.newValue}` : "تعذر تحسين عرض السعر للقيمة المطلوبة";
        result.optimization = optimization;
        result.newQuote = newQuote;
        break;
      }
      default:
        result.message = `الإجراء ${actionData.action} غير مدعوم`;
    }
  } catch (err) {
    result.message = `خطأ في التنفيذ: ${err.message}`;
  }
  return result;
}

function aiTimeoutMs() {
  return Math.max(1500, Math.min(20000, Number(process.env.AI_MODEL_TIMEOUT_MS || 7000)));
}

function aiModelProviders() {
  return [
    {
      id: "primary",
      label: "Groq primary",
      apiKey: process.env.GROQ_API_KEY || "",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      endpoint: process.env.GROQ_CHAT_ENDPOINT || "https://api.groq.com/openai/v1/chat/completions"
    },
    {
      id: "fallback",
      label: "Custom fallback model",
      type: process.env.AI_FALLBACK_TYPE || "custom",
      apiKey: process.env.AI_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || "",
      model: process.env.AI_FALLBACK_MODEL || process.env.OPENAI_MODEL || "custom-local-model",
      endpoint: process.env.AI_FALLBACK_CHAT_ENDPOINT || process.env.CUSTOM_AI_ENDPOINT || ""
    }
  ];
}

function readAiAnswer(data) {
  if (typeof data === "string") return data.trim();
  return String(
    data?.choices?.[0]?.message?.content ||
    data?.answer ||
    data?.message ||
    data?.response ||
    data?.text ||
    data?.output ||
    data?.result ||
    ""
  ).trim();
}

async function requestAiProvider(provider, messages, meta = {}) {
  if (!provider.endpoint) throw new Error(`${provider.label} endpoint is not configured`);
  if (provider.id === "primary" && !provider.apiKey) throw new Error(`${provider.label} API key is not configured`);
  const headers = {"Content-Type": "application/json"};
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const openAiCompatible = provider.id === "primary" || provider.type === "openai";
  const body = openAiCompatible ? {
    model: provider.model,
    messages,
    temperature: Number(process.env.AI_TEMPERATURE || 0.85),
    top_p: Number(process.env.AI_TOP_P || 0.95),
    presence_penalty: Number(process.env.AI_PRESENCE_PENALTY || 0.25),
    frequency_penalty: Number(process.env.AI_FREQUENCY_PENALTY || 0.35),
    max_tokens: 1500
  } : {
    model: provider.model,
    messages,
    prompt: messages.map(m => `${m.role}: ${m.content}`).join("\n\n"),
    question: meta.question || messages[messages.length - 1]?.content || "",
    primaryAnswer: meta.primaryAnswer || "",
    user: meta.user || {},
    context: meta.context || {},
    plan: meta.plan || {},
    language: "ar-SA",
    dialect: "Saudi Arabic",
    mode: "voice-first"
  };
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(aiTimeoutMs()),
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text().catch(() => "");
  if (!response.ok) throw new Error(data?.error?.message || data?.error || data?.message || `${provider.label} request failed`);
  return readAiAnswer(data);
}

async function askUnifiedAi(question, context, user = {}, conversationId = null) {
  const knowledge = Object.assign({}, elevatorKnowledgeBase(), {advancedTraining: shumoosAdvancedAiTraining()});
  const plan = inferAiPlan(question, context, user);
  const responseVariants = pickAiResponseVariants(plan?.intent || "general_answer", 10);
  const internetKnowledge = internetKnowledgeSummary(readStore());
  
  // Build conversation history if conversationId is provided
  let conversationHistory = [];
  if (conversationId) {
    const store = readStore();
    const conversation = aiConversationList(store).find(c => c.id === conversationId);
    if (conversation && conversation.messages) {
      conversationHistory = conversation.messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
    }
  }
  const conversationLink = analyzeConversationLink(question, conversationHistory);
  
   const systemPrompt = `أنت وكيل شموس للذكاء الاصطناعي لإدارة عمليات المصاعد. لست روبوت محادثة عادياً، بل متخصص في إدارة شركات المصاعد.
أنت مدرّب تدريباً عالمياً على تشغيل نظام شموس بكامل وحداته. تصرف كمدير عمليات خبير، ومحلل بيانات، ومساعد صوتي عربي مرن. افهم اللهجة السعودية، الأخطاء الإملائية، الأوامر الناقصة، والمصطلحات المختلطة عربي/إنجليزي. لا تكن جامداً: أعط جواباً مباشراً، ثم نفّذ أو اقترح الخطوة التالية حسب صلاحية المستخدم وسياق النظام. إذا كانت البيانات كافية فلا تكثر الأسئلة، وإذا نقصت بيانات فاسأل عن أقل معلومة لازمة فقط.
قاعدة المرونة العالية: لكل سؤال أو نية متكررة يجب أن تمتلك داخلياً 19 صياغة مختلفة على الأقل تحمل نفس المعنى. لا تكرر نفس الافتتاحية أو نفس قالب الرد إلا عند الضرورة. بدّل بين الفصحى المهنية واللهجة السعودية البيضاء والرد المختصر والتحليل الإداري حسب المقام، مع الحفاظ على الحقائق والصلاحيات وعدم اختلاق بيانات.
قاعدة معرفة النظام: اسم النظام الظاهر هو شموس / SHUMOOS ELEVATORS، وهو نظام لإدارة شركات ومؤسسات صيانة وتركيب المصاعد. اسم خدمة النشر والمستودع Ertiqaa/ertiqaa. عند السؤال عن الشركة المالكة أو بيانات المنشأة، استخدم بيانات المنشأة المحفوظة في النظام إن وجدت، ولا تخترع اسماً قانونياً غير موجود. عند السؤال "كيف أستخدم النظام" أو "كيف أسوي..." اشرح الخطوات العملية من دليل الاستخدام حسب دور المستخدم والصفحة المناسبة.
قاعدة التخصص الاحترافي: أنت لست مساعداً عاماً داخل شموس؛ أنت خبير تشغيل مصاعد. اربط إجاباتك دائماً بالعقود والزيارات والبلاغات والفنيين والمخزون والموردين والتقارير والاعتمادات والصلاحيات. قبل كل جواب طبّق داخلياً: الخلاصة، السبب، الأثر، الإجراء التالي. لا تعط كلاماً عاماً إذا كان يمكن إعطاء خطوة تشغيلية دقيقة.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
أسلوب الإجابة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- أجب بالعربية الفصحى أو العامية السعودية الواضحة.
- كن طبيعياً ومتنوعاً في أسلوبك - لا تكرر نفس الصياغة في كل رد.
- اجعل الإجابات ودية واحترافية ومريحة للقراءة.
- أبقِ الردود الصوتية قصيرة وطبيعية وسهلة النطق.
- استخدم المعلومات المتوفرة من ملخص النظام وقاعدة المعرفة والخطة المحلية.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
عند تكرار السؤال
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

إذا كرر المستخدم نفس السؤال خلال وقت قصير والإجابة لم تتغير، لاحظ ذلك وغيّر أسلوب الرد بدلاً من تكرار نفس الجملة.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
اقتراحات المساعدة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

بعد كل إجابة، قدم اقتراحاً للمساعدة مناسباً للسؤال الحالي ولصلاحيات المستخدم.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الصلاحيات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- لا تقترح تنفيذ عملية لا يملك المستخدم صلاحيتها.
- إذا لم يملك المستخدم صلاحية التعديل، لا تعرض خيار تعديل.
- إذا لم يملك المستخدم صلاحية الحذف، لا تعرض خيار الحذف.
- إذا لم يملك المستخدم صلاحية عرض بيانات معينة، لا تذكرها ولا تقترحها.
- اعتمد جميع الاقتراحات والإجابات على الصلاحيات الفعلية للمستخدم.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
التنفيذ المباشر
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

يمكنك تنفيذ الأوامر مباشرة. للتفيذ، أضف قالب JSON في ردك:
عقد صيانة/تركيب: [EXECUTE:{"action":"create_contract","data":{"type":"صيانة","clientName":"...","value":0}}]
عرض سعر: [EXECUTE:{"action":"create_quote","data":{"clientName":"...","value":0,"details":"..."}}]

العمليات المدعومة:
- create_contract: type, clientName, clientId, clientCompanyName, clientCompanyUnifiedNumber, startDate, endDate, value, details, buildings, elevatorInfo
- create_quote: clientName, clientId, value, details, items
- create_ticket: title, description, clientName, clientId, priority, contractId
- create_visit: clientName, clientId, contractId, scheduledAt, building, assignedTo
- assign_visit: visitId, technicianId, technicianName
- redistribute_visits: redistributeAll (true/false)
- create_supplier: name, phone, city, category
- add_staff: name, identity, role
- create_notification: title, body, userId, roles
- analyze_report: reportId, autoGenerateQuote
- optimize_quote: quoteId, targetValue

إذا نقصت بيانات، اسأل فقط عن أقل البيانات المطلوبة.
لا تطلب أسراراً أو كلمات مرور. لا تدّع أنك نفذت الإجراء إلا إذا أضفت قالب EXECUTE.
التزم بالصلاحيات. إذا قالت الخطة المحلية أن الإجراء غير مسموح، ارفض التنفيذ واعرض بدائل آمنة.
حافظ على سياق المحادثة. تذكر الأسئلة والأجوبة السابقة. لا تكرر معلومات سبق تقديمها.

المستخدم: ${JSON.stringify(user)}
قاعدة المعرفة: ${JSON.stringify(knowledge)}
الخطة المحلية: ${JSON.stringify(plan)}
ملخص النظام: ${JSON.stringify(context)}`;
  
  const messages = [
    {role: "system", content: systemPrompt},
    {role: "system", content: `Response variation pack for this exact intent: ${JSON.stringify(responseVariants)}\nUse at least 10 possible wording patterns internally before choosing the final answer. Do not reuse the same opening or sentence order from the previous answer. Keep facts and permissions unchanged, but vary phrasing, tone, sentence length, and structure.`},
    {role: "system", content: `Internet-assisted knowledge cache: ${JSON.stringify(internetKnowledge)}\nUse this cache only for general elevator best practices, safety wording, supplier/industry context, and modern external knowledge. Never use internet knowledge as the source of truth for Shumoos internal data such as contracts, customers, visits, technicians, prices, documents, or permissions. If internet knowledge is empty or disabled, say the internet knowledge updater needs activation instead of inventing external facts.`},
    {role: "system", content: `Conversation continuity analysis: ${JSON.stringify(conversationLink)}\nBefore answering, decide whether the current user message is linked to the previous assistant answer or previous user intent. If linked, continue professionally from that context, resolve references like هذا/ذلك/السابق/ردك, and do not restart the answer. If the message is approval such as افعل، كمل، ارفع، نفذ, treat it as approval for the last proposed action unless ambiguous.`},
    ...conversationHistory,
    {role: "user", content: question}
  ];
  
  const providers = aiModelProviders();
  const attempts = [];
  const primary = providers.find(p => p.id === "primary");
  const fallback = providers.find(p => p.id === "fallback");
  let primaryAnswer = "";
  let primaryModel = primary?.model || "";
  try {
    primaryAnswer = await requestAiProvider(primary, messages, {question, context, user, plan});
    if (!primaryAnswer) throw new Error(`${primary.label} returned an empty answer`);
    attempts.push({provider: primary.id, model: primary.model, ok: true});
  } catch (err) {
    attempts.push({provider: primary.id, model: primary.model, error: err.message || "AI request failed"});
  }

  if (fallback?.endpoint) {
    const mergedMessages = primaryAnswer ? [
      ...messages,
      {role: "assistant", content: primaryAnswer},
      {role: "user", content: "راجع الإجابة السابقة ووحّدها مع منطق النظام. أعد جواباً نهائياً عربياً قصيراً صالحاً للصوت، ونفّذ نفس صيغة EXECUTE عند الحاجة بدون تعارض."}
    ] : messages;
    try {
      const answer = await requestAiProvider(fallback, mergedMessages, {question, context, user, plan, primaryAnswer});
      if (!answer) throw new Error(`${fallback.label} returned an empty answer`);
      attempts.push({provider: fallback.id, model: fallback.model, ok: true, mergedWithPrimary: Boolean(primaryAnswer)});
      return {answer, model: primaryAnswer ? `${primaryModel}+${fallback.model}` : fallback.model, provider: primaryAnswer ? "unified" : "fallback", providerLabel: primaryAnswer ? "Unified primary/custom model" : fallback.label, attempts, plan};
    } catch (err) {
      attempts.push({provider: fallback.id, model: fallback.model, error: err.message || "AI request failed"});
      if (primaryAnswer) return {answer: primaryAnswer, model: primaryModel, provider: "primary", providerLabel: primary.label, attempts, plan};
    }
  }

  if (primaryAnswer) return {answer: primaryAnswer, model: primaryModel, provider: "primary", providerLabel: primary.label, attempts, plan};
  const localAnswer = generateLocalAiResponse(question, plan, context, user, knowledge, conversationHistory);
  return {answer: localAnswer, model: "local-ai", provider: "local", providerLabel: "Local AI (offline mode)", attempts, plan};
}

function generateLocalAiResponse(question, plan, context, user = {}, knowledge = {}, conversationHistory = []) {
  const q = String(question || "").trim();
  const intent = plan?.intent || "answer";
  const data = plan?.data || {};
  const counts = context?.counts || {};
  const name = user?.name || "";
  const greeting = ["", "", ` ${name}`, ` يا ${name}`];
  const g = greeting[Math.floor(Math.random() * greeting.length)];
  const r = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Conversation-aware context
  const lastAssistantMsg = conversationHistory.filter(m => m.role === "assistant").pop();
  const lastUserMsg = conversationHistory.filter(m => m.role === "user").pop();
  const isApproval = /^(نفذ|كمل|افعل|سوي|اعتمد|ارفع|ابدأ|تمام|yes|ok|oki|okay|تم|حسنا|اوكي)\b/i.test(q);
  const isFollowUp = /^(و|ثم|بعدين|كمان|أيضا|وهل|وhow|طيب)\b/i.test(q);
  const isReference = /(هذا|ذلك|السابق|ردك|كلامك|اللي قلته|اللي قلت)/.test(q);

  if (isApproval && lastAssistantMsg) {
    const lastContent = lastAssistantMsg.content || "";
    if (lastContent.includes("[EXECUTE:") || lastContent.includes("نفذ") || lastContent.includes("اقترح") || lastContent.includes("تمام")) {
      return r([
        `تم التنفيذ${g}. أي خدمة ثانية؟`,
        `تم الأمر${g}. خلصت المهمة.`,
        `تم${g}. خلصنا. وش تبي بعد؟`,
        `خلصنا${g}. أي طلب ثاني؟`,
        `تم بفضل الله${g}. أنا حاضر لأي أمر ثاني.`
      ]);
    }
  }

  if ((isFollowUp || isReference) && lastAssistantMsg) {
    const lastSnippet = lastAssistantMsg.content.replace(/<[^>]+>/g, "").slice(0, 100).replace(/\s+\S*$/, "");
    return r([
      `بالنسبة للي قلته قبل${g}: ${lastSnippet}.. تقدر تكمل أو تطلب شيء ثاني.`,
      `إكمالاً لردي السابق${g}: ${lastSnippet}.. وش بعد؟`,
      `نعم${g}، وكمان ${lastSnippet}.. تفضل.`
    ]);
  }
  
  if (intent === "greet") {
    const time = new Date().getHours();
    const period = time < 12 ? "صباح" : time < 17 ? "مساء" : "مساء";
    return r([
      `وعليكم السلام ورحمة الله${g}. ${period} الخير. كيف أقدر أساعدك؟`,
      `أهلاً وسهلاً${g}. ${period} النور. أنا شموس الذكي، تحت أمرك.`,
      `مرحباً مليون${g}. ${period} الورد. وش تطلب؟`,
      `مرحبتين${g}. ${period} السعد. أنا موجود، تفضل.`,
      `الله يحييك${g}. ${period} الخيرات. وش عندك من استفسار؟`
    ]);
  }
  if (intent === "farewell") {
    return r([
      `الله يسلمك${g}. في أمان الله.`,
      `مع السلامة${g}. الله يوفقك.`,
      `في أمان الله وحفظه${g}. دايم موجود.`,
      `الله معاك${g}. تراني هنا لو احتجت شيء.`
    ]);
  }
  if (intent === "thanks") {
    return r([
      `العفو${g}. هذا واجبنا.`,
      `الله يسلمك${g}. دايماً تحت أمرك.`,
      `أهلاً بك${g}. فخور بخدمتك.`,
      `الشكر لله${g}. أنا موجود لأجلك.`
    ]);
  }
  if (intent === "apologize") {
    return r([
      `معذور${g}. كيف أقدر أساعدك؟`,
      `لا عذراً على واجب${g}. تفضل.`,
      `ما عليك زود${g}. وش تطلب؟`
    ]);
  }
  if (intent === "interview") {
    return r([
      `اسمي شموس${g}. أنا مساعدك الذكي لإدارة شركات المصاعد. أساعدك في إدارة العقود والزيارات والفنيين والمخزون والبلاغات وعروض الأسعار. تقدر تطلب مني إنشاء عقد صيانة أو زيارة أو عرض سعر، وأنا أنفذ لك مباشرة.`,
      `أنا شموس، وكيلك الذكي${g}. مختص بإدارة عمليات المصاعد: عقود صيانة وتركيب، زيارات دورية، فنيين، مخزون قطع الغيار، بلاغات، وعروض أسعار. مجرد اطلب وأنا أنفذ.`,
      `شموس هذا اسمي${g}. مساعد متكامل لشركات المصاعد. أقدر أسوي عقود، عروض سعر، بلاغات، زيارات، وأدير المخزون والفريق. بس قول "اعمل كذا" وأنا أتولى الباقي.`,
      `أنا وكيل شموس للذكاء الاصطناعي${g}. تحت أمري إدارة العقود، عروض الأسعار، جدولة الزيارات، توزيع الفنيين، المخزون، وكل ما يخص تشغيل شركة المصاعد. أتكلم بالعربي الفصحى والعامية السعودية.`
    ]);
  }
  if (intent === "can_do") {
    const action = data?.action || "";
    if (/عقد|صيانة|تركيب/.test(action)) return r([`أقدر أسوي عقود صيانة وتركيب${g}. بس محتاج اسم العميل والقيمة ونوع العقد.`, `إيوه أقدر${g}. أقدّر أنشئ عقود صيانة وتركيب. عطني تفاصيل العميل والقيمة.`]);
    if (/عرض|سعر/.test(action)) return r([`أقدر أسوي عروض أسعار${g}. عطني اسم العميل وإذا في قيمة تقريبية أحسن.`, `أكيد${g}. أقدر أعد عرض سعر كامل. وش اسم العميل؟`]);
    if (/زيارة|جدول/.test(action)) return r([`أقدر أسوي زيارات وأسندها للفنيين${g}.`, `أيوه، أقدّر أضيف زيارات وأسندها${g}.`]);
    if (/فني|موظف/.test(action)) return r([`أقدر أضيف فنيين وموظفين${g}. محتاج الاسم والهوية والدور الوظيفي.`, `أيوه${g}. أقدر أضيف أعضاء الفريق.`]);
    if (/مخزون|قطع/.test(action)) return r([`أقدر أدير المخزون${g}.`, `إيوه${g}. أقدر أضيف قطع غيار وأتابع المخزون.`]);
    if (/مورد/.test(action)) return r([`أقدر أضيف موردين${g}. محتاج اسم المورد.`, `أكيد${g}. أقدر أسجل مورد جديد.`]);
    if (/تقرير|تحليل/.test(action)) return r([`أقدر أحلل العمليات${g}.`, `أيوه${g}. أقدر أقدم تحليلات عن الفنيين والزيارات والمخزون.`]);
    return r([`إيوه أقدر أساعدك${g}. وش بالضبط تبغاني أسوي؟`, `أكيد${g}. بس احتاج تفاصيل أكثر عشان أنفذ.`, `أقدر${g}. وصف لي الطلب وأنا أتولاه.`]);
  }
  if (intent === "query") {
    const entity = data?.entity || "";
    const query = data?.query || q;
    const localData = searchLocalData(query, readStore(), user);
    if (localData) {
      const extras = [
        `\n\n${smartSuggests(entity, user?.role || "")}`,
        `\n\n${smartSuggests("general", user?.role || "")}`,
        ``
      ];
      const countsDesc = [`عندنا ${counts.contracts || 0} عقد`, `فيه ${counts.contracts || 0} عقد في النظام`, `إجمالي العقود ${counts.contracts || 0}`];
      return r([
        localData + extras[Math.floor(Math.random() * extras.length)],
        localData + extras[Math.floor(Math.random() * extras.length)]
      ]);
    }
    return r([
      `ما لقيت معلومات محددة عن هذا${g}. جرب تسأل عن العقود أو الزيارات أو المخزون.`,
      `صعبة علي هذي${g}. تقدر تسألني عن شيء ثاني؟`,
      `ما عندي تفاصيل كافية${g}. جرب تطلب شيء زي: كم عقد عندنا؟ أو أرني الزيارات.`
    ]);
  }
  if (intent === "analyze_inventory" || intent === "analyze_staff" || intent === "analyze_operations") {
    const localData = searchLocalData(q, readStore(), user);
    if (localData) return localData;
    return r([
      `قاعدة البيانات ما فيها معلومات كافية للتحليل${g}.`,
      `ما عندي بيانات كافية أحللها${g}.`
    ]);
  }
  if (intent === "create_maintenance_contract" || intent === "create_installation_contract" || intent === "create_quote" || intent === "create_ticket" || intent === "create_visit" || intent === "add_staff" || intent === "create_supplier") {
    const missing = plan?.missing || [];
    if (missing.length > 0) {
      return r([
        `ناقصني ${missing.map(m => m.label).join(" و ")}${g}.`,
        `أحتاج ${missing.map(m => m.label).join(" و ")} عشان أتمم الطلب${g}.`,
        `ودي أساعدك${g}. لكن محتاج ${missing.map(m => m.label).join(" و ")}.`
      ]);
    }
    return r([
      `تمام${g}. عطني التفاصيل الكاملة وأنا أنفذ لك.`,
      `حاضر${g}. هل تبي تضيف تفاصيل أكثر؟`,
      `ممتاز${g}. وش باقي التفاصيل؟`
    ]);
  }
  if (intent === "assign_visit" || intent === "redistribute_visits") {
    return r([
      `تمام${g}، بشوف توزيع الزيارات الحالي وأقترح عليك التوزيع الأمثل.`,
      `حاضر${g}، بعمل تحليل للزيارات والفنيين وأرجع لك باقتراح.`,
      `خلاص${g}، خلني أراجع أعباء العمل عند الفنيين وأقدم لك توصية.`
    ]);
  }
  if (intent === "optimize_quote") {
    return r([
      `تمام${g}، أرسل لي رقم عرض السعر عشان أحسّن التسعير.`,
      `حاضر${g}، وش رقم عرض السعر اللي تبغى تحسّنه؟`
    ]);
  }
  if (intent === "analyze_report") {
    return r([
      `أي تقرير تبغى أحلله${g}؟`,
      `تمام${g}. وش التقرير اللي تبغاني أقراه؟`
    ]);
  }
  if (intent === "create_notification") {
    return r([
      `تمام${g}. وش تبغى نص الإشعار؟`,
      `حاضر${g}. عطني نص الإشعار والموجهين له.`
    ]);
  }
  // Fallback for any other or unknown intent
  const localData = searchLocalData(q, readStore(), user);
  if (localData) {
    const fallbackPhrases = ["", "", `\n\nكمان تقدر تسأل عن العقود أو الزيارات أو المخزون.`, `\n\n${smartSuggests("general", user?.role || "")}`];
    return localData + fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];
  }
  return r([
    `وش تقصد بالضبط${g}؟ وضح لي أكثر عشان أساعدك.`,
    `ما فهمت طلبك${g}. جرب توضح أو تسأل عن العقود، الزيارات، الفنيين، أو المخزون.`,
    `كيف أقدر أساعدك${g}؟ تقدر تطلب إنشاء عقد أو عرض سعر، أو تسأل عن الزيارات والفنيين.`,
    `أنا موجود${g}. وش تطلب؟ مثلاً: "اعمل عقد صيانة"، "كم زيارة عندنا؟"، "أضف فني جديد".`,
    `تفضل${g}. وش تحتاج؟ تقدر تقول "اعمل عرض سعر"، أو "أرني البلاغات المفتوحة".`
  ]);
}

http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  if (sendMobileAssociation(res, pathname)) return;
  if (pathname === "/health" || pathname === "/api/health") return sendJson(res, 200, {ok: true, at: new Date().toISOString()});
  const invitePrefix = "/invite/";
  if (pathname.startsWith(invitePrefix)) {
    const token = pathname.slice(invitePrefix.length);
    const store = readStore();
    const invites = inviteList(store);
    const invite = invites.find(x => x.token === token);
    const now = Date.now();
    if (!invite || invite.revoked || Number(invite.expiresAtMs || 0) < now || Number(invite.used || 0) >= Number(invite.maxUses || 1)) return sendLocked(res);
    res.writeHead(302, {
      "Set-Cookie": [`${entryCookie}=${entryCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`, `${inviteCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`],
      "Location": "/login.html",
      "Cache-Control": "no-store"
    });
    res.end();
    return;
  }

  const serverSystemUsers = [
    {id:"2572280689",password:"qazdrujmlp@2A",role:"admin",name:"مشرف النظام",permissions:["*"]},
    {id:"2233556688",password:"2233556688",role:"company_admin",name:"باسم",permissions:["*"],mustChangePassword:true},
    {id:"1010389102",password:"1010389102",role:"owner",name:"سليمان الهلالي",permissions:["*"],mustChangePassword:true,companyOwnerId:"1010389102"}
  ];

  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const body = Buffer.concat(buffers).toString("utf-8");
      const input = JSON.parse(body || "{}");
      const uid = cleanId(input.userId);
      const pwd = String(input.password || "");
      if (!uid || !pwd) return sendJson(res, 400, {error: "رقم الهوية وكلمة المرور مطلوبان"});if(!isValidId(uid))return sendJson(res,400,{error:"رقم الهوية غير صالح. يجب أن يبدأ بـ 1 أو 2"})
      const store = readStore();
      const storedUsers = parseStoredJson(store, "misadUsers");
      const user = storedUsers.find(u => cleanId(u.id) === uid && u.password === pwd)
        || serverSystemUsers.find(u => cleanId(u.id) === uid && u.password === pwd);
      if (!user) return sendJson(res, 401, {error: "رقم الهوية أو كلمة المرور غير صحيحة"});
      const storedUser = storedUsers.find(u => cleanId(u.id) === uid);
      const coId = storedUser?.companyOwnerId || user.companyOwnerId || "";
      sendJson(res, 200, {
        id: user.id,
        role: user.role,
        name: user.name,
        permissions: user.permissions || [],
        mustChangePassword: !!(user.mustChangePassword && storedUser?.mustChangePassword !== false),
        companyOwnerId: user.role === "owner" ? user.id : (coId || ""),
        _linkedCoId: coId
      });
    } catch (e) {
      sendJson(res, 400, {error: "طلب غير صالح: " + e.message});
    }
    return;
  }

  if (pathname === "/api/auth/seed-storage" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const adminId = cid(input.adminUserId);
        const adminPassword = String(input.adminPassword || "");
        if (!adminId || !adminPassword) return sendJson(res, 400, {error: "بيانات المشرف مطلوبة"});
        const store = readStore();
        const users = parseStoredJson(store, "misadUsers");
        const admin = users.find(u => cid(u.id) === adminId && u.role === "admin" && u.password === adminPassword);
        if (!admin && !(adminId === "2572280689" && adminPassword === "qazdrujmlp@2A")) return sendJson(res, 403, {error: "صلاحية المشرف مطلوبة"});
        if (!admin && adminId === "2572280689" && adminPassword === "qazdrujmlp@2A") {
          users.push({id: "2572280689", name: "مشرف النظام", role: "admin", password: "qazdrujmlp@2A", passwordUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString()});
          store.misadUsers = JSON.stringify(users);
        }
        const fullData = input.data;
        if (!fullData || typeof fullData !== "object") return sendJson(res, 400, {error: "بيانات التخزين غير صالحة"});
        for (const [key, value] of Object.entries(fullData)) {
          store[key] = value;
        }
        writeStore(store);
        sendJson(res, 200, {ok: true, message: "تم تحديث قاعدة البيانات بنجاح"});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/auth/reset-password" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const userId = cid(input.userId);
        const newPassword = String(input.newPassword || "");
        if (!userId) return sendJson(res, 400, {error: "رقم الهوية مطلوب"});
        if (!newPassword || newPassword.length < 6) return sendJson(res, 400, {error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"});
        if (userId === "2572280689") return sendJson(res, 400, {error: "لا يمكن استعادة كلمة مرور مشرف النظام من هنا. استخدم حساب المشرف."});
        const store = readStore();
        const users = parseStoredJson(store, "misadUsers");
        const idx = users.findIndex(u => cid(u.id) === userId);
        if (idx === -1) return sendJson(res, 404, {error: "رقم الهوية غير مسجل في النظام"});
        users[idx].password = newPassword;
        users[idx].passwordUpdatedAt = new Date().toISOString();
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: "platform", type: "استعادة كلمة مرور", title: `تم استعادة كلمة مرور المستخدم ${users[idx].name} (${userId})`, ref: userId, user: userId, userId, createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, name: users[idx].name});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (!hasEntryAccess(req) && !hasDeviceAccess(req) && !pathname.startsWith("/login") && !pathname.startsWith("/register") && !pathname.startsWith("/api/") && !pathname.startsWith("/invite/") && pathname !== "/" && !pathname.startsWith("/assets/") && !pathname.endsWith(".html") && !pathname.endsWith(".js") && !pathname.endsWith(".css") && !pathname.endsWith(".json") && !pathname.endsWith(".png") && !pathname.endsWith(".svg") && !pathname.endsWith(".ico")) return sendLocked(res);

  if (pathname === "/api/owner/register" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const cid = v => String(v || "").replace(/\D/g, "");
        const input = JSON.parse(body || "{}");
        const id = cid(input.id);
        const role = String(input.role || "");
        if (role !== "owner") return sendJson(res, 400, {error: "هذا المسار فقط لتسجيل المالك"});
        if (!id) return sendJson(res, 400, {error: "رقم الهوية مطلوب"});
        const store = readStore();
        const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
        const unifiedNumber = cid(input.unifiedNumber);
        const autoLink = ownerCompanies.find(c => (c.pendingOwnerIds || []).includes(id));
        if (!autoLink && !unifiedNumber) return sendJson(res, 400, {error: "الرقم الموحد مطلوب لإنشاء شركة جديدة"});
        if (unifiedNumber && ownerCompanies.some(c => cid(c.unifiedNumber) === unifiedNumber && (!autoLink || c.id !== autoLink.id))) {
          return sendJson(res, 409, {error: "الرقم الموحد موجود مسبقًا. كل شركة تملك رقمًا موحدًا واحدًا فقط."});
        }
        let companyOwnerId = "";
        if (autoLink) {
          autoLink.pendingOwnerIds = (autoLink.pendingOwnerIds || []).filter(x => x !== id);
          if (!autoLink.ownerIds) autoLink.ownerIds = [autoLink.ownerId || autoLink.ownerIds?.[0] || id];
          if (!autoLink.ownerIds.includes(id)) autoLink.ownerIds.push(id);
          companyOwnerId = autoLink.ownerIds[0];
          writeStore(store);
        }
        sendJson(res, 200, {ok: true, autoLinked: !!autoLink, companyOwnerId});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/owner/check-unified" && req.method === "GET") {
    const cid = v => String(v || "").replace(/\D/g, "");
    const num = cid(String(url.searchParams.get("num") || ""));
    const store = readStore();
    const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
    const exists = ownerCompanies.some(c => cid(c.unifiedNumber) === num);
    return sendJson(res, 200, {exists});
  }

  if (pathname === "/api/users/lookup" && req.method === "GET") {
    const cid = v => String(v || "").replace(/\D/g, "");
    const id = cid(String(url.searchParams.get("id") || ""));
    if (!id) return sendJson(res, 400, {error: "رقم الهوية مطلوب"});
    const store = readStore();
    const users = parseStoredJson(store, "misadUsers");
    const user = users.find(u => cid(u.id) === id);
    if (!user) return sendJson(res, 200, {found: false});
    const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
    const linkedCo = user.companyOwnerId ? ownerCompanies.find(c => c.id === user.companyOwnerId || c.ownerId === user.companyOwnerId || (c.ownerIds || []).includes(user.companyOwnerId)) : null;
    return sendJson(res, 200, {
      found: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        companyOwnerId: user.companyOwnerId || "",
        linkedCompanyName: linkedCo ? linkedCo.name : ""
      }
    });
  }

  if (pathname === "/api/users/link" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const userId = cid(input.userId);
        const companyOwnerId = cid(input.companyOwnerId);
        if (!userId) return sendJson(res, 400, {error: "رقم المستخدم مطلوب"});
        if (!companyOwnerId) return sendJson(res, 400, {error: "معرف المنشأة مطلوب"});
        const store = readStore();
        const users = parseStoredJson(store, "misadUsers");
        const idx = users.findIndex(u => cid(u.id) === userId);
        if (idx === -1) return sendJson(res, 404, {error: "المستخدم غير موجود"});
        if (users[idx].companyOwnerId && cid(users[idx].companyOwnerId) !== companyOwnerId) {
          const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
          const linked = ownerCompanies.find(c => c.id === users[idx].companyOwnerId || c.ownerId === users[idx].companyOwnerId || (c.ownerIds || []).includes(users[idx].companyOwnerId));
          return sendJson(res, 409, {error: `هذا المستخدم مرتبط مسبقًا بـ "${linked?.name || "شركة أخرى"}". لا يمكن ربطه بمنشأتين.`});
        }
        users[idx].companyOwnerId = companyOwnerId;
        users[idx].linkedBy = String(input.linkedBy || "");
        users[idx].linkedAt = new Date().toISOString();
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId, type: "ربط", title: `تم ربط المستخدم ${users[idx].name} (${userId}) بالمنشأة`, ref: userId, user: input.linkedBy || "النظام", userId: input.linkedBy || "", createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, name: users[idx].name, role: users[idx].role});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/users/unlink" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const userId = cid(input.userId);
        if (!userId) return sendJson(res, 400, {error: "رقم المستخدم مطلوب"});
        const store = readStore();
        const users = parseStoredJson(store, "misadUsers");
        const idx = users.findIndex(u => cid(u.id) === userId);
        if (idx === -1) return sendJson(res, 404, {error: "المستخدم غير موجود"});
        const oldOwnerId = users[idx].companyOwnerId || "";
        users[idx].companyOwnerId = "";
        users[idx].unlinkedBy = String(input.unlinkedBy || "");
        users[idx].unlinkedAt = new Date().toISOString();
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: oldOwnerId, type: "فك ربط", title: `تم فك ربط المستخدم ${users[idx].name} (${userId}) عن المنشأة`, ref: userId, user: input.unlinkedBy || "النظام", userId: input.unlinkedBy || "", createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/admin/delete-user" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const targetUserId = cid(input.userId);
        const requesterRole = String(input.role || "");
        const requesterId = cid(input.requesterId || "");
        if (requesterRole !== "admin") return sendJson(res, 403, {error: "غير مصرح. المشرف فقط."});
        if (!targetUserId) return sendJson(res, 400, {error: "رقم المستخدم مطلوب"});
        if (targetUserId === "2572280689") return sendJson(res, 400, {error: "لا يمكن تعطيل حساب مشرف النظام"});
        const store = readStore();
        let users = parseStoredJson(store, "misadUsers");
        const userIdx = users.findIndex(u => cid(u.id) === targetUserId);
        if (userIdx === -1) return sendJson(res, 404, {error: "المستخدم غير موجود"});
        if (users[userIdx].deletedAt) return sendJson(res, 400, {error: "المستخدم معطل مسبقاً"});
        users[userIdx].status = "ملغي";
        users[userIdx].deletedAt = new Date().toISOString();
        users[userIdx].deletedBy = requesterId;
        // Clear from ownerIds/pendingOwnerIds in all companies
        const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
        for (const co of ownerCompanies) {
          let changed = false;
          if (co.ownerIds && co.ownerIds.includes(targetUserId)) { co.ownerIds = co.ownerIds.filter(id => id !== targetUserId); changed = true; }
          if (co.pendingOwnerIds && co.pendingOwnerIds.includes(targetUserId)) { co.pendingOwnerIds = co.pendingOwnerIds.filter(id => id !== targetUserId); changed = true; }
          if (co.ownerId === targetUserId) { co.ownerId = ""; changed = true; }
          if (changed) co.modifiedAt = new Date().toISOString();
        }
        store.misadOwnerCompanies = JSON.stringify(ownerCompanies);
        // Remove from company staff
        const staff = parseStoredJson(store, "misadCompanyStaff");
        const filteredStaff = staff.filter(s => cid(s.identity) !== targetUserId && cid(s.id) !== targetUserId && cid(s.userId) !== targetUserId);
        store.misadCompanyStaff = JSON.stringify(filteredStaff);
        // Nullify companyOwnerId in other users referencing the deleted user's company
        for (const u of users) {
          if (u.companyOwnerId && cid(u.companyOwnerId) === targetUserId) u.companyOwnerId = "";
        }
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: "platform", type: "تعطيل مستخدم", title: `تم تعطيل المستخدم ${users[userIdx].name} (${targetUserId}) بواسطة المشرف ${requesterId}`, ref: targetUserId, user: requesterId, userId: requesterId, createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, deletedUser: users[userIdx].name});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/admin/restore-user" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const targetUserId = cid(input.userId);
        const requesterRole = String(input.role || "");
        const requesterId = cid(input.requesterId || "");
        if (requesterRole !== "admin") return sendJson(res, 403, {error: "غير مصرح. المشرف فقط."});
        if (!targetUserId) return sendJson(res, 400, {error: "رقم المستخدم مطلوب"});
        const store = readStore();
        let users = parseStoredJson(store, "misadUsers");
        const userIdx = users.findIndex(u => cid(u.id) === targetUserId);
        if (userIdx === -1) return sendJson(res, 404, {error: "المستخدم غير موجود"});
        if (!users[userIdx].deletedAt) return sendJson(res, 400, {error: "المستخدم ليس معطلاً"});
        delete users[userIdx].status;
        delete users[userIdx].deletedAt;
        delete users[userIdx].deletedBy;
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: "platform", type: "استعادة مستخدم", title: `تم استعادة المستخدم ${users[userIdx].name} (${targetUserId}) بواسطة المشرف ${requesterId}`, ref: targetUserId, user: requesterId, userId: requesterId, createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, restoredUser: users[userIdx].name});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/admin/delete-company" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const targetCompanyId = String(input.companyId || "").trim();
        const requesterRole = String(input.role || "");
        const requesterId = cid(input.requesterId || "");
        if (requesterRole !== "admin") return sendJson(res, 403, {error: "غير مصرح. المشرف فقط."});
        if (!targetCompanyId) return sendJson(res, 400, {error: "معرف الشركة مطلوب"});
        const store = readStore();
        let ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
        const coIdx = ownerCompanies.findIndex(c => c.id === targetCompanyId || c.ownerId === targetCompanyId);
        if (coIdx === -1) return sendJson(res, 404, {error: "الشركة غير موجودة"});
        if (ownerCompanies[coIdx].deletedAt) return sendJson(res, 400, {error: "الشركة معطلة مسبقاً"});
        const deletedCompany = ownerCompanies[coIdx];
        const companyOwnerIds = [deletedCompany.ownerId, ...(deletedCompany.ownerIds || []), ...(deletedCompany.pendingOwnerIds || [])].filter(Boolean);
        deletedCompany.status = "ملغية";
        deletedCompany.deletedAt = new Date().toISOString();
        deletedCompany.deletedBy = requesterId;
        ownerCompanies[coIdx] = deletedCompany;
        store.misadOwnerCompanies = JSON.stringify(ownerCompanies);
        // Nullify companyOwnerId in users linked to this company but keep the company record
        const users = parseStoredJson(store, "misadUsers");
        for (const u of users) {
          if (u.companyOwnerId && (u.companyOwnerId === targetCompanyId || u.companyOwnerId === deletedCompany.ownerId || companyOwnerIds.includes(u.companyOwnerId))) {
            u.companyOwnerId = "";
          }
        }
        store.misadUsers = JSON.stringify(users);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: "platform", type: "تعطيل شركة", title: `تم تعطيل الشركة ${deletedCompany.name} (${targetCompanyId}) بواسطة المشرف ${requesterId}`, ref: targetCompanyId, user: requesterId, userId: requesterId, createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, deletedCompany: deletedCompany.name});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/admin/restore-company" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const cid = v => String(v || "").replace(/\D/g, "");
        const targetCompanyId = String(input.companyId || "").trim();
        const requesterRole = String(input.role || "");
        const requesterId = cid(input.requesterId || "");
        if (requesterRole !== "admin") return sendJson(res, 403, {error: "غير مصرح. المشرف فقط."});
        if (!targetCompanyId) return sendJson(res, 400, {error: "معرف الشركة مطلوب"});
        const store = readStore();
        let ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
        const coIdx = ownerCompanies.findIndex(c => c.id === targetCompanyId || c.ownerId === targetCompanyId);
        if (coIdx === -1) return sendJson(res, 404, {error: "الشركة غير موجودة"});
        if (!ownerCompanies[coIdx].deletedAt) return sendJson(res, 400, {error: "الشركة ليست معطلة"});
        delete ownerCompanies[coIdx].status;
        delete ownerCompanies[coIdx].deletedAt;
        delete ownerCompanies[coIdx].deletedBy;
        store.misadOwnerCompanies = JSON.stringify(ownerCompanies);
        writeStore(store);
        const log = parseStoredJson(store, "misadActivityLog");
        log.unshift({id: `ACT-${Date.now()}`, companyOwnerId: "platform", type: "استعادة شركة", title: `تم استعادة الشركة ${ownerCompanies[coIdx].name} (${targetCompanyId}) بواسطة المشرف ${requesterId}`, ref: targetCompanyId, user: requesterId, userId: requesterId, createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
        store.misadActivityLog = JSON.stringify(log.slice(0, 300));
        writeStore(store);
        sendJson(res, 200, {ok: true, restoredCompany: ownerCompanies[coIdx].name});
      } catch (e) {
        sendJson(res, 400, {error: "Invalid request: " + e.message});
      }
    });
    return;
  }

  if (pathname === "/api/contracts/ai-import-excel" && req.method === "POST") {
    try {
      const role = String(url.searchParams.get("role") || "");
      const userId = String(url.searchParams.get("userId") || "");
      const companyOwnerId = String(url.searchParams.get("companyOwnerId") || "");
      if (!["owner", "company_admin", "admin"].includes(role)) return sendJson(res, 403, {error: "رفع العقود متاح للمالك والإداري فقط."});
      const upload = await parseMultipartFile(req);
      if (!/\.xlsx$/i.test(upload.filename)) return sendJson(res, 400, {error: "ارفع ملف Excel بصيغة .xlsx فقط."});
      const store = readStore();
      const contracts = parseStoredJson(store, "misadContracts");
      const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
      const actionOwnerId = role === "company_admin" ? (companyOwnerId || userId) : role === "admin" ? "platform" : userId;
      const owner = ownerCompanies.find(c => c.ownerId === actionOwnerId || c.id === actionOwnerId) || {id: "", name: "شركة غير محددة"};
      const rows = parseExcelContracts(upload.data);
      if (!rows.length) return sendJson(res, 400, {error: "لم يتم العثور على بيانات عقود في الملف."});
      // تحليل البيانات بالذكاء الاصطناعي لتحسين دقة الحقول
      const aiPrompt = `أنت محلل عقود مصاعد. أمامك بيانات مستخلصة من ملف Excel. المطلوب: تصحيح وتحسين الحقول التالية لكل عقد بناءً على فهمك لقطاع المصاعد:
- type: يجب أن تكون "صيانة" أو "تركيب" حسب محتوى العقد
- clientName و clientCompanyName: الاسم الصحيح للعميل/المنشأة
- value: القيمة المالية (رقم فقط)
- startDate, endDate: تواريخ نصية بصيغة YYYY-MM-DD
- buildings: اسم المبنى والموقع
- elevatorInfo: معلومات المصعد (العدد، الماركة، العمر، السعة)
- details: وصف العقد

أعد JSON فقط بهذا الشكل ولا تضف أي شرح:
{"contracts":[{"type":"...","clientName":"...","clientCompanyName":"...","clientId":"...","clientCompanyUnifiedNumber":"...","value":0,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","contractYears":1,"details":"...","buildings":[{"name":"...","district":"..."}],"elevatorInfo":{"count":"...","brand":"...","age":"...","capacity":"...","usage":"..."}}]}

البيانات المستخلصة:
${JSON.stringify(rows, null, 2)}

حلل كل صف بدقة وأعد المصفوفة كاملة. إذا كان هناك نقص في البيانات، املأها بقيم معقولة بناءً على فهمك للمجال.`;
      let aiResult;
      try {
        const providers = aiModelProviders();
        const primary = providers.find(p => p.id === "primary");
        if (primary && primary.apiKey) {
          aiResult = await requestAiProvider(primary, [
            {role: "system", content: "أنت خبير في تحليل عقود المصاعد واستخراج البيانات بدقة. أجب فقط بـ JSON صالح."},
            {role: "user", content: aiPrompt}
          ]);
        } else {
          aiResult = generateLocalAiResponse(aiPrompt, {}, {}, {});
        }
      } catch (err) {
        // إذا فشل الذكاء الاصطناعي، استخدم البيانات المباشرة
        aiResult = JSON.stringify({contracts: rows});
      }
      let enhancedRows;
      try {
        const parsed = JSON.parse(typeof aiResult === "string" ? aiResult : readAiAnswer(aiResult) || "{}");
        enhancedRows = Array.isArray(parsed) ? parsed : (parsed.contracts || []);
      } catch {
        enhancedRows = rows;
      }
      if (!enhancedRows.length) enhancedRows = rows;
      const existingKeys = new Set(contracts.map(c => [
        cleanNationalId(c.clientId || c.clientCompanyUnifiedNumber),
        c.clientCompanyName || c.clientName,
        c.startDate,
        c.endDate,
        (c.buildings || [])[0]?.name || "",
        Number(c.value || 0)
      ].map(x => String(x || "").trim()).join("|")));
      const imported = [];
      const skipped = [];
      for (const item of enhancedRows) {
        if (!item.clientCompanyName && !item.clientName) {
          skipped.push({reason: "لا يوجد اسم عميل أو منشأة", row: item});
          continue;
        }
        if (!Number(item.value || 0)) {
          skipped.push({reason: "قيمة العقد غير موجودة أو غير صحيحة", row: item});
          continue;
        }
        const candidateKey = [
          cleanNationalId(item.clientId || item.clientCompanyUnifiedNumber),
          item.clientCompanyName || item.clientName,
          item.startDate,
          item.endDate,
          (item.buildings || [])[0]?.name || "",
          Number(item.value || 0)
        ].map(x => String(x || "").trim()).join("|");
        if (existingKeys.has(candidateKey)) {
          skipped.push({reason: "عقد مكرر", row: item});
          continue;
        }
        const contract = buildImportedContract(item, contracts, actionOwnerId, owner, userId);
        contract.importedFromExcel = true;
        contract.details = (contract.details || "") + " (مستورد عبر الذكاء الاصطناعي)";
        contracts.unshift(contract);
        imported.push(contract);
        existingKeys.add(candidateKey);
      }
      store.misadContracts = JSON.stringify(contracts.slice(0, 500));
      writeStore(store);
      return sendJson(res, 200, {
        ok: true,
        fileName: upload.filename,
        analyzedRows: rows.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        skipped: skipped.slice(0, 30),
        contracts: contracts.slice(0, 500),
        imported,
        summary: `تم تحليل ${rows.length} صف بواسطة الذكاء الاصطناعي وإضافة ${imported.length} عقد. تم تجاوز ${skipped.length} صف.`
      });
    } catch (err) {
      return sendJson(res, 400, {error: "تعذر تحليل ملف Excel بالذكاء الاصطناعي: " + (err.message || "خطأ غير معروف")});
    }
  }

  if (pathname === "/api/contracts/import-excel" && req.method === "POST") {
    try {
      const role = String(url.searchParams.get("role") || "");
      const userId = String(url.searchParams.get("userId") || "");
      const companyOwnerId = String(url.searchParams.get("companyOwnerId") || "");
      if (!["owner", "company_admin", "admin"].includes(role)) return sendJson(res, 403, {error: "رفع العقود متاح للمالك والإداري فقط."});
      const upload = await parseMultipartFile(req);
      if (!/\.xlsx$/i.test(upload.filename)) return sendJson(res, 400, {error: "ارفع ملف Excel بصيغة .xlsx فقط."});
      const store = readStore();
      const contracts = parseStoredJson(store, "misadContracts");
      const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
      const actionOwnerId = role === "company_admin" ? (companyOwnerId || userId) : role === "admin" ? "platform" : userId;
      const owner = ownerCompanies.find(c => c.ownerId === actionOwnerId || c.id === actionOwnerId || c.ownerIds?.includes(actionOwnerId)) || {id: "", name: "شركة غير محددة"};
      const rows = parseExcelContracts(upload.data);
      const existingKeys = new Set(contracts.map(c => [
        cleanNationalId(c.clientId || c.clientCompanyUnifiedNumber),
        c.clientCompanyName || c.clientName,
        c.startDate,
        c.endDate,
        (c.buildings || [])[0]?.name || "",
        Number(c.value || 0)
      ].map(x => String(x || "").trim()).join("|")));
      const imported = [];
      const skipped = [];
      for (const item of rows) {
        if (!item.clientCompanyName && !item.clientName) {
          skipped.push({reason: "لا يوجد اسم عميل أو منشأة", row: item});
          continue;
        }
        if (!Number(item.value || 0)) {
          skipped.push({reason: "قيمة العقد غير موجودة أو غير صحيحة", row: item});
          continue;
        }
        const candidateKey = [
          cleanNationalId(item.clientId || item.clientCompanyUnifiedNumber),
          item.clientCompanyName || item.clientName,
          item.startDate,
          item.endDate,
          item.buildings?.[0]?.name || "",
          Number(item.value || 0)
        ].map(x => String(x || "").trim()).join("|");
        if (existingKeys.has(candidateKey)) {
          skipped.push({reason: "عقد مكرر", row: item});
          continue;
        }
        const contract = buildImportedContract(item, contracts, actionOwnerId, owner, userId);
        contracts.unshift(contract);
        imported.push(contract);
        existingKeys.add(candidateKey);
      }
      store.misadContracts = JSON.stringify(contracts.slice(0, 500));
      writeStore(store);
      return sendJson(res, 200, {
        ok: true,
        fileName: upload.filename,
        analyzedRows: rows.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        skipped: skipped.slice(0, 30),
        contracts: contracts.slice(0, 500),
        imported,
        summary: `تم تحليل ${rows.length} صف وإضافة ${imported.length} عقد. الصفوف المتجاهلة: ${skipped.length}.`
      });
    } catch (err) {
      return sendJson(res, 400, {error: "تعذر تحليل ملف Excel: " + (err.message || "خطأ غير معروف")});
    }
  }

  if (pathname === "/api/voice/samples" && req.method === "GET") {
    const samples = voiceSampleList();
    const cachedAudio = fs.existsSync(voiceCacheDir) ? fs.readdirSync(voiceCacheDir).filter(name => name.endsWith(".audio")).length : 0;
    const jameelVoice = jameelVoiceReady();
    return sendJson(res, 200, {
      samples,
      count: samples.length,
      cachedAudio,
      speechRecognitionLang: "ar-SA",
      dialect: "Saudi Arabic",
      voiceCloneEndpointReady: jameelVoice.ready || Boolean(process.env.JAMEEL_VOICE_ENDPOINT),
      commercialUseVerified: jameelVoice.ready,
      localVoice: jameelVoice,
      mode: jameelVoice.ready ? "my-voice-model-ready" : "my-voice-model-required",
      message: jameelVoice.ready
        ? "بصمة الصوت جاهزة عبر jameel-ai."
        : "شغّل خدمة jameel-ai المحلية لتفعيل بصمة الصوت."
    });
  }

  if (pathname === "/api/voice/test" && req.method === "GET") {
    const samples = voiceSampleList();
      const jameel = jameelVoiceReady();
    return sendJson(res, 200, {
      ok: true,
      samples: samples.length,
      localVoice: jameel,
      browserTTS: true,
      message: jameel.ready
        ? "بصمة الصوت جاهزة عبر jameel-ai."
        : "بصمة jameel-ai غير شغالة. سيتم استخدام صوت المتصفح كبديل."
    });
  }

  if (pathname === "/api/voice/synthesize" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const input = JSON.parse(body || "{}");
        const text = String(input.text || "").replace(/<[^>]+>/g, " ").trim();
        if (!text) return sendJson(res, 400, {error: "Missing text"});
        if (!jameelVoiceReady().ready) {
          return sendJson(res, 503, {
            error: "خدمة jameel-ai غير شغالة. شغّل start-with-local-voice.ps1 لتشغيل بصمة الصوت المحلية.",
            mode: "jameel-ai-required"
          });
        }
        try {
          const {audio, contentType} = await jameelSynthesize(text);
          res.writeHead(200, {"Content-Type": contentType, "Cache-Control": "private, max-age=86400", "X-Voice-Source": "jameel-ai"});
          res.end(audio);
        } catch (err) {
          return sendJson(res, 502, {error: "تعذر توليد الصوت من jameel-ai: " + (err.message || "خطأ غير معروف")});
        }
      } catch (err) {
        sendJson(res, 400, {error: "Invalid voice synthesis request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/push/register") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        if (!input.userId || !input.token) return sendJson(res, 400, {error: "Missing push token"});
        const store = readStore();
        const tokens = pushTokenList(store).filter(x => x.token !== input.token);
        tokens.unshift({userId: String(input.userId), role: String(input.role || ""), token: String(input.token), platform: String(input.platform || "web"), updatedAt: new Date().toISOString()});
        savePushTokens(store, tokens);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications")) {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const userId = url.searchParams.get("userId") || "";
      const role = url.searchParams.get("role") || "";
      const items = notificationList(readStore()).filter(n => !n.userId || n.userId === userId || (n.roles || []).includes(role)).slice(0, 80);
      return sendJson(res, 200, {notifications: items});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const store = readStore();
          const notifications = notificationList(store);
          const n = {id: `NTF-${Date.now()}`, title: String(input.title || "إشعار"), body: String(input.body || ""), userId: String(input.userId || ""), roles: Array.isArray(input.roles) ? input.roles : [], url: String(input.url || "/dashboard.html"), createdAt: new Date().toISOString(), readBy: []};
          notifications.unshift(n);
          saveNotifications(store, notifications);
          const tokens = pushTokenList(store).filter(t => !n.userId && !n.roles.length ? true : t.userId === n.userId || n.roles.includes(t.role));
          sendNativePush(tokens, n);
          sendJson(res, 200, {ok: true, notification: n});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
  }

  if (req.url.startsWith("/api/ai/admin") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const input = JSON.parse(body || "{}");
        const question = String(input.question || "").trim().slice(0, 2000);
        if (!question) return sendJson(res, 400, {error: "Missing question"});
        const role = String(input.role || "");
        const userId = String(input.userId || "");
        const userName = String(input.name || "");
        
        // Check AI chat permission
        const permissionCheck = checkAiPermission({id: userId, role, name: userName, permissions: input.permissions}, "ai.chat");
        if (!permissionCheck.allowed) {
          return sendJson(res, 403, {error: permissionCheck.reason});
        }
        
        const store = readStore();
        const context = buildAiContext(store, {id: userId, role, name: userName, companyOwnerId: input.companyOwnerId});
        
        // Filter sensitive data from context based on user role
        const filteredContext = filterSensitiveData(context, {id: userId, role, permissions: input.permissions});
        
        // Get or create conversation for context retention
        const conversation = getOrCreateConversation(store, userId, role);
        const conversationId = conversation.id;
        
        // Add user message to conversation
        addMessageToConversation(store, conversationId, "user", question);
        
        const result = await askUnifiedAi(question, filteredContext, {id: userId, role, name: userName}, conversationId);
        if (result.error) return sendJson(res, result.error.includes("configured") ? 503 : 502, result);
        
        // Parse and execute [EXECUTE:...] blocks from the AI response
        const executions = [];
        let cleanAnswer = result.answer;
        const execStartTag = "[EXECUTE:";
        let execIdx = cleanAnswer.indexOf(execStartTag);
        while (execIdx !== -1) {
          const jsonStart = execIdx + execStartTag.length;
          let braceDepth = 0;
          let jsonEnd = jsonStart;
          for (; jsonEnd < cleanAnswer.length; jsonEnd++) {
            if (cleanAnswer[jsonEnd] === "{") braceDepth++;
            else if (cleanAnswer[jsonEnd] === "}") {
              braceDepth--;
              if (braceDepth === 0) { jsonEnd++; break; }
            }
          }
          if (braceDepth === 0 && jsonEnd > jsonStart) {
            try {
              const jsonStr = cleanAnswer.slice(jsonStart, jsonEnd);
              const actionData = JSON.parse(jsonStr);
              actionData.userId = userId;
              actionData.role = role;
              actionData.companyOwnerId = input.companyOwnerId;
              const execResult = executeAiAction(actionData, store);
              executions.push(execResult);
              logAiOperation(store, actionData.action,
                {id: userId, name: userName, role},
                {action: actionData.action, data: actionData.data, result: execResult.message}
              );
            } catch (parseErr) {
              executions.push({executed: false, error: `Failed to parse action: ${parseErr.message}`});
            }
            const blockEnd = cleanAnswer.indexOf("]", jsonEnd) + 1;
            const fullBlock = cleanAnswer.slice(execIdx, blockEnd || jsonEnd);
            cleanAnswer = cleanAnswer.replace(fullBlock, "");
          } else {
            cleanAnswer = cleanAnswer.replace(execStartTag, "");
          }
          execIdx = cleanAnswer.indexOf(execStartTag);
        }
        cleanAnswer = cleanAnswer.trim();
        
        // Use the plan from inferAiPlan to also auto-execute if the unified model did not include EXECUTE block
        const plan = result.plan || inferAiPlan(question, filteredContext, {id: userId, role, name: userName});
        if (plan.allowed && plan.needsApproval && executions.length === 0 && !cleanAnswer.includes("[EXECUTE")) {
          // If the plan detects an action intent but the unified model did not execute, try direct execution
          let autoExecute = null;
          if (plan.intent === "create_maintenance_contract" || plan.intent === "create_installation_contract") {
            autoExecute = {action: "create_contract", data: {...plan.data, type: plan.intent === "create_installation_contract" ? "تركيب" : "صيانة", details: question}};
          } else if (plan.intent === "create_quote") {
            autoExecute = {action: "create_quote", data: {...plan.data, details: question}};
          } else if (plan.intent === "create_ticket") {
            autoExecute = {action: "create_ticket", data: {...plan.data, details: question}};
          } else if (plan.intent === "create_visit") {
            autoExecute = {action: "create_visit", data: {...plan.data, details: question}};
          } else if (plan.intent === "add_staff") {
            autoExecute = {action: "add_staff", data: {...plan.data, details: question}};
          } else if (plan.intent === "create_supplier") {
            autoExecute = {action: "create_supplier", data: {...plan.data, details: question}};
          } else if (plan.intent === "assign_visit" && /زيارة\s*(\S+)/i.test(question)) {
            autoExecute = {action: "assign_visit", data: {...plan.data, visitId: RegExp.$1}};
          } else if (plan.intent === "redistribute_visits") {
            autoExecute = {action: "redistribute_visits", data: {...plan.data, redistributeAll: /الكل|جميع|all/i.test(question)}};
          }
          if (autoExecute) {
            autoExecute.userId = userId;
            autoExecute.role = role;
            autoExecute.companyOwnerId = input.companyOwnerId;
            const missing = getMissingFields(autoExecute.action, autoExecute.data);
            if (missing.length) {
              cleanAnswer = missing.length === 1
                ? `ينقصني ${missing[0].label}. تفضل بذكره.`
                : `ينقصني ${missing.map(m => m.label).join(" و ")}. اذكرهم لو تكرمت.`;
            } else {
              const execResult = executeAiAction(autoExecute, store);
              if (execResult.executed) {
                executions.push(execResult);
                logAiOperation(store, autoExecute.action,
                  {id: userId, name: userName, role},
                  {action: autoExecute.action, data: autoExecute.data, result: execResult.message}
                );
                cleanAnswer = `✅ ${execResult.message}`;
              } else {
                cleanAnswer = execResult.message || "تعذر تنفيذ الأمر.";
              }
            }
          }
        }
        
        // Add AI response to conversation (with EXECUTE blocks removed)
        addMessageToConversation(store, conversationId, "assistant", cleanAnswer);
        
        const memory = aiMemoryList(store);
        memory.unshift({id: `AIM-${Date.now()}`, userId, role, question, answer: cleanAnswer, plan, model: result.model, conversationId, executions, createdAt: new Date().toISOString(), rating: "unrated"});
        saveAiMemory(store, memory);
        sendJson(res, 200, {...result, answer: cleanAnswer, conversationId, contextCounts: filteredContext.counts, executions});
      } catch {
        sendJson(res, 400, {error: "Invalid AI request"});
      }
    });
    return;
  }

  if (req.url === "/api/ai/execute" && req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const input = JSON.parse(body);
        const question = String(input.question || "").trim();
        const userId = input.userId || "ai";
        const role = input.role || "admin";
        const userName = input.name || "AI";
        if (!question) return sendJson(res, 400, {executed: false, message: "السؤال فارغ"});

        const store = readStore();

        // --- Pending creation follow-up: handle BEFORE intent detection ---
        if (input._pendingAction && input._pendingData) {
          // If the follow-up text starts a new command, ignore pending
          if (/^(?:سوي|أنشئ|أنشي|إنشي|اعمل|أضف|اضف|كم|عطيني|أرني|ارني|أظهر|اظهر|شوف|من أنت|السلام|شكراً|مرحبا|حلل)/i.test(String(input.question || ""))) {
            // Fall through to normal processing
          } else {
          const pendingAction = input._pendingAction;
          const pendingData = JSON.parse(JSON.stringify(input._pendingData));
          const q = String(input.question || "");

          const valMatch0 = q.match(/(?:بقيمة|قيمة|بمبلغ|مبلغ|سعر|تكلفة|بـ)\s*([\d,٠-٩۰-۹]+(?:\.[\d٠-٩۰-۹]+)?)/i);
          if (valMatch0) pendingData.value = Number(valMatch0[1].replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g, ""));
          const valMatch2 = q.match(/([\d,٠-٩۰-۹]+(?:\.[\d٠-٩۰-۹]+)?)\s*(?:ريال|ر\.س|SAR)/i);
          if (valMatch2 && !pendingData.value) pendingData.value = Number(valMatch2[1].replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g, ""));

          const clientPats = [
            /(?:لـ|لمؤسسة|لشركة|للشركة|للمؤسسة|لعميل)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ)/i,
            /(?:مؤسسة|شركة|مكتب|مجموعة)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ)/i,
            /(?:اسمه|اسم العميل|العميل)\s*[""]?([^"",\d]{2,30}?)[""]?\s*(?:,|\.|$)/i
          ];
          for (const pat of clientPats) { const m = q.match(pat); if (m) { pendingData.clientName = m[1].trim(); break; } }

          const titlePat = q.match(/(?:عنوانه|عنوان|بلاغ)\s*[""]?([^"",\d]{3,60}?)[""]?\s*(?:,|\.|$|أولوية)/i);
          if (titlePat) pendingData.title = titlePat[1].trim();

          const staffPat = q.match(/(?:اسمه|اسم)\s*[""]?([^"",\d٠-٩۰-۹]{3,25}?)[""]?\s*(?:,|\.|$|هوية|هويته|رقم|[\d٠-٩۰-۹]{6,})/i) || q.match(/(?:الفني)\s*[""]?([^"",\d٠-٩۰-۹]{3,25}?)[""]?\s*(?:,|\.|$|هوية|هويته|رقم|[\d٠-٩۰-۹]{6,})/i);
          if (staffPat) pendingData.name = staffPat[1].trim();

          const suppPat = q.match(/مورد\s*[""]?([^"",\d]{3,30}?)[""]?\s*(?:,|\.|$)/i);
          if (suppPat && !pendingData.name) pendingData.name = suppPat[1].trim();

          const idPat = q.match(/(?:هوية|هويته|رقم)\s*([\d٠-٩۰-۹]{6,10})/i);
          if (idPat) pendingData.identity = idPat[1].replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

          const datePat = q.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
          if (datePat) pendingData.scheduledAt = datePat[1];

          if (/تركيب|توريد/i.test(q)) pendingData.type = "تركيب";
          else if (/صيانة/i.test(q)) pendingData.type = "صيانة";

          const missing = getMissingFields(pendingAction, pendingData);
          if (missing.length) {
            return sendJson(res, 200, {
              executed: false,
              openForm: true,
              formType: formMap[plan.intent] || "",
              missingFields: missing,
              message: missing.length === 1
                ? `ينقصني ${missing[0].label}. تفضل بذكره.`
                : `ينقصني ${missing.map(m => m.label).join(" و ")}. اذكرهم لو تكرمت.`,
              data: pendingData,
              action: pendingAction
            });
          }

          const execResult = executeAiAction({action: pendingAction, data: pendingData, userId, role, companyOwnerId: input.companyOwnerId}, store);
          logAiOperation(store, pendingAction, {id: userId, name: userName, role}, {action: pendingAction, data: pendingData, result: execResult.message});
          return sendJson(res, 200, {
            executed: execResult.executed,
            message: execResult.message || (execResult.executed ? `تم التنفيذ بنجاح.` : "لم أتمكن من تنفيذ الأمر."),
            action: pendingAction,
            data: execResult
          });
          } // end else (pending follow-up processing)
        }

        const context = buildAiContext(store, {id: userId, role, name: userName, companyOwnerId: input.companyOwnerId});
        const plan = inferAiPlan(question, context, {id: userId, role, name: userName});

        if (!plan.allowed) return sendJson(res, 403, {executed: false, message: "لا تملك صلاحية التنفيذ"});

        // Action mapping
        const actionMap = {
          create_maintenance_contract: "create_contract",
          create_installation_contract: "create_contract",
          create_quote: "create_quote",
          create_ticket: "create_ticket",
          create_visit: "create_visit",
          assign_visit: "assign_visit",
          redistribute_visits: "redistribute_visits",
          add_staff: "add_staff",
          create_supplier: "create_supplier",
          create_notification: "create_notification",
          create_part: "add_staff", // placeholder - would need separate handler
          optimize_quote: "optimize_quote",
          analyze_report: "analyze_report",
          analyze_operations: "analyze_operations",
          analyze_inventory: "analyze_inventory",
          analyze_staff: "analyze_staff"
        };

        var action = actionMap[plan.intent];

        // If client is following up on a pending creation, use the original action
        if (input._pendingAction && input._pendingData) {
          if (!/^(?:سوي|أنشئ|أنشي|إنشي|اعمل|أضف|اضف|كم|عطيني|أرني|ارني|أظهر|اظهر|شوف|من أنت|السلام|شكراً|مرحبا|حلل)/i.test(String(input.question || ""))) {
            action = input._pendingAction;
          }
        }

        // --- Conversational intents (greetings, thanks, apologies, etc.) ---
        if (!action && plan.intent !== "answer") {
          const canManage = ["owner", "company_admin", "admin"].includes(role);
          const ctx = context.counts || {};
          const greetWithContext = (greeting) => {
            const greetOpenings = [
              greeting,
              greeting.replace("🌟", "🌸").replace("✨", "🌷"),
              greeting
            ];
            const parts = [];
            parts.push(greetOpenings[Math.floor(Math.random() * greetOpenings.length)]);
            if (ctx.contracts > 0 || ctx.visits > 0) {
              const summaryLabels = ["📊 نظرة سريعة:", "📋 ملخص النظام:", "📈 الوضع الحالي:"];
              parts.push(summaryLabels[Math.floor(Math.random() * summaryLabels.length)]);
              const items = [];
              if (ctx.contracts) items.push(`${ctx.contracts} عقد`);
              if (ctx.openTickets) items.push(`${ctx.openTickets} بلاغ مفتوح`);
              if (ctx.upcomingVisits) items.push(`${ctx.upcomingVisits} زيارة قادمة`);
              if (ctx.lateVisitsWithoutReport) items.push(`${ctx.lateVisitsWithoutReport} زيارة متأخرة ⚠️`);
              if (ctx.staff) items.push(`${ctx.staff} فني`);
              if (items.length) parts.push(items.join(" · "));
            }
            const followUps = canManage ? ["كيف أقدر أساعدك؟", "وش تحتاج مني؟", "أنا تحت أمرك، ماذا تطلب؟", "تفضل، وش تبغى تسوي؟"] : ["كيف أقدر أساعدك؟", "هل تحتاج شيئاً؟"];
            parts.push(followUps[Math.floor(Math.random() * followUps.length)]);
            return parts.join("\n\n");
          };
          const convResponses = {
            greet: [
              greetWithContext("وعليكم السلام والرحمة والإكرام 🌟 أهلاً بك في شموس."),
              greetWithContext("أهلاً وسهلاً بك 🌸 أسعد الله وقتك بكل خير."),
              greetWithContext("مرحباً بك في شموس ✨ منصة إدارة شركات ومؤسسات المصاعد.")
            ],
            thanks: [
              ctx.contracts || ctx.visits ? `الشكر لله ثم لك 🤲 يسعدني أن أخدمك. النظام يضم ${ctx.contracts || 0} عقد و ${ctx.visits || 0} زيارة، أنا هنا لإدارة كل ذلك بكفاءة.` : "الشكر لله ثم لك 🤲 يسعدني أن أخدمك. أنا هنا لأي أمر تحتاج إليه.",
              "العفو، هذا واجبي 🙏 تذكر أنك تستطيع التحدث معي بصوتك الطبيعي وأنا أنفذ فوراً.",
              "الله يسلمك 🤍 شكراً لك. أنا هنا لخدمتك في أي وقت."
            ],
            apologize: [
              "لا عذراً على الإطلاق 🙏 أنا هنا لخدمتك. هل تريد مني تنفيذ أمر معين؟ فقط أخبرني وسأقوم باللازم.",
              "أبداً، لا داعي للاعتذار 😊 أنا مساعد رقمي وهدفي مساعدتك. أعد صياغة طلبك وأنا سأعمل على تنفيذه بدقة.",
              "معذرة إذا حصل أي خطأ 🤝 دعني أساعدك الآن، أخبرني وش المطلوب وسأشتغل عليه فوراً."
            ],
            farewell: [
              "في أمان الله 🤲 كان شرف لي مساعدتك. إذا احتجت أي شيء في المستقبل، أنا موجود. مع السلامة ✨",
              "الله معك ويوفقك 🌟 تذكر أنني هنا في أي وقت تحتاج مساعدة في إدارة المصاعد والعقود والزيارات. إلى اللقاء 👋",
              "يسعد مساؤك/صباحك 🌷 أشكرك على تواصلك مع شموس. في حفظ الله ورعايته."
            ]
          };

          // Interview / system questions
          if (plan.intent === "interview") {
            return sendJson(res, 200, {executed: true, message: "مرحباً بك في شموس 🌟 أنا وكيل الذكاء الاصطناعي لنظام إدارة شركات ومؤسسات صيانة وتركيب المصاعد.\n\n🎯 **من أنا؟**\nأنا مساعد رقمي متكامل، تم تطويره ليكون العقل المدبر لنظام شموس. أستطيع فهم الأوامر الصوتية والنصية بالعامية العربية وتحويلها إلى إجراءات عملية فوراً.\n\n⚡ **ماذا أستطيع أن أفعل؟**\n• إنشاء وإدارة عقود الصيانة والتركيب\n• إنشاء عروض أسعار احترافية\n• تسجيل وإسناد بلاغات الصيانة\n• جدولة الزيارات الكشفية\n• إضافة وإدارة الفنيين والمهندسين والموردين\n• تحليل المخزون وقطع الغيار\n• تحليل أداء الفريق والعمليات\n• إعادة توزيع الزيارات بذكاء\n• إنشاء إشعارات وتنبيهات\n• فتح النماذج وتعبئتها بالبيانات التي تقدمها\n\n🎤 **كيف تستخدمني؟**\nالأمر بسيط جداً: اضغط على زر المايك 🎤 وتحدث بصوتك الطبيعي بالعامية أو الفصحى. أنا أفهم كل الصيغ:\n• \"سوي عقد صيانة لمؤسسة الأفق\"\n• \"اعمل عرض سعر لشركة النخبة بقيمة 15000 ريال\"\n• \"أضف فني اسمه محمد\"\n• \"حلل المخزون وقل لي القطع الناقصة\"\n\n📊 **ما يميزني**\n• أفهم العامية السعودية والعربية الفصحى\n• أنفذ الأوامر مباشرة بدون وسيط\n• أفتح النماذج وأعبئ البيانات تلقائياً\n• أرد صوتياً بعد كل أمر\n• أتحادث معك بطلاقة وأسأل عن الناقص\n\nأنا هنا لخدمتك، فقط تكلم 🎤✨"});
          }

          // Can-do questions ("هل يمكن", "ممكن", "تقدر")
          if (plan.intent === "can_do") {
            const actionText = plan.data?.action || "";
            const reply = getCapabilityResponse(actionText, role);
            return sendJson(res, 200, {executed: true, message: reply, action: "can_do", data: plan.data});
          }

          const convKeys = Object.keys(convResponses);
          for (let ci = 0; ci < convKeys.length; ci++) {
            const key = convKeys[ci];
            if (plan.intent === key) {
              const responses = convResponses[key];
              let reply = responses[Math.floor(Math.random() * responses.length)];
              if (key !== "greet") reply = repeatNote(userId, question, reply);
              return sendJson(res, 200, {executed: true, message: reply, action: "conversation", intent: key});
            }
          }
        }

        if (!action) {
          try {
            const aiResult = await askUnifiedAi(question, context, {id: userId, role, name: userName});
            if (aiResult.answer && !aiResult.error) {
              if (aiResult.plan?.intent !== "answer") {
                const aiPlan = aiResult.plan || {};
                if (aiPlan.action && aiPlan.data) {
                  const execR = executeAiAction({action: aiPlan.action, data: Object.assign({}, aiPlan.data, {userId}), userId, role, companyOwnerId: input.companyOwnerId}, store);
                  logAiOperation(store, aiPlan.action, {id: userId, name: userName, role}, {action: aiPlan.action, data: aiPlan.data, result: execR.message});
                  return sendJson(res, 200, {executed: true, message: aiResult.answer + "\n\n✅ تم تنفيذ الأمر.", action: aiPlan.action, data: execR, model: aiResult.model, provider: aiResult.provider});
                }
              }
              return sendJson(res, 200, {executed: true, message: aiResult.answer, action: "answer", model: aiResult.model, provider: aiResult.provider});
            }
          } catch {}
          const local = searchLocalData(question, store, {id: userId, role, name: userName, companyOwnerId: input.companyOwnerId});
          if (local) {
            const withSuggest = local + "\n\n" + smartSuggests("general", role);
            return sendJson(res, 200, {executed: true, message: repeatNote(userId, question, withSuggest), action: "answer"});
          }
          return sendJson(res, 200, {openForm: false, message: repeatNote(userId, question, "لم يتم التعرف على الأمر. جرب: أنشئ عقد, عرض سعر, بلاغ, زيارة, فني, مورد")});
        }

        // Build data from plan extraction
        var d = Object.assign({}, plan.data, {details: question, userId});

        // Map intent to form type that client will open
        const formMap = {
          create_maintenance_contract: "contract",
          create_installation_contract: "contract",
          create_quote: "quote",
          create_ticket: "ticket",
          create_visit: "visit",
          add_staff: "staff",
          create_supplier: "supplier",
          create_part: "part"
        };

        // Action labels for user messages
        const actionLabels = {
          create_contract: "العقد",
          create_quote: "عرض السعر",
          create_ticket: "البلاغ",
          create_visit: "الزيارة",
          add_staff: "الفني",
          create_supplier: "المورد"
        };

        const creationActions = ["create_contract", "create_quote", "create_ticket", "create_visit", "add_staff", "create_supplier"];
        const isCreation = creationActions.includes(action);

        if (isCreation && (formMap[plan.intent] || input._pendingAction)) {
          const missing = getMissingFields(action, d);
          if (missing.length) {
            return sendJson(res, 200, {
              executed: false,
              missingFields: missing,
              message: missing.length === 1
                ? `ينقصني ${missing[0].label}. تفضل بذكره.`
                : `ينقصني ${missing.map(m => m.label).join(" و ")}. اذكرهم لو تكرمت.`,
              data: d,
              action
            });
          }
          const execResult = executeAiAction({action, data: d, userId, role, companyOwnerId: input.companyOwnerId}, store);
          logAiOperation(store, action, {id: userId, name: userName, role}, {action, data: d, result: execResult.message});
          return sendJson(res, 200, {
            executed: execResult.executed,
            message: execResult.message || (execResult.executed ? `تم تنفيذ ${actionLabels[action] || "الأمر"}.` : "لم أتمكن من تنفيذ الأمر."),
            action,
            data: execResult
          });
        }

        // --- Execute-only actions (assign, redistribute, notify) ---
        if (action === "assign_visit" || action === "redistribute_visits" || action === "create_notification") {
          const execResult = executeAiAction({action, data: d, userId, role, companyOwnerId: input.companyOwnerId}, store);
          logAiOperation(store, action, {id: userId, name: userName, role}, {action, data: d, result: execResult.message});
          return sendJson(res, 200, {executed: execResult.executed, message: execResult.message, action, data: execResult});
        }

        // --- Local analysis when no remote model is needed ---
        if (action === "analyze_operations") {
          const counts = context.counts || {};
          const tickets = parseStoredJson(store, "misadTickets");
          const visits = parseStoredJson(store, "misadVisits");
          const reports = parseStoredJson(store, "misadVisitReports");
          const staff = parseStoredJson(store, "misadCompanyStaff");
          const parts = parseStoredJson(store, "misadParts");
          const contracts = parseStoredJson(store, "misadContracts");
          const openTickets = tickets.filter(t => t.status !== "مغلق" && t.status !== "closed");
          const lateVisits = visits.filter(v => new Date(v.scheduledAt) < new Date() && !reports.find(r => r.visitId === v.id));
          const lowParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
          const activeTechs = staff.filter(s => s.availability === "working" || s.availability === "available");
          const expiringContracts = contracts.filter(c => c.endDate && new Date(c.endDate) > new Date() && new Date(c.endDate) < new Date(Date.now() + 30*86400000));

          const analysis = {
            openTickets: {count: openTickets.length, urgent: openTickets.filter(t => t.priority === "urgent").length},
            lateVisits: lateVisits.length,
            lowParts: lowParts.length,
            activeStaff: activeTechs.length,
            totalStaff: staff.length,
            expiringContracts: expiringContracts.length,
            totalContracts: contracts.length
          };

          let msg = `📊 تحليل النظام:\n• ${analysis.openTickets.count} بلاغ مفتوح (${analysis.openTickets.urgent} طارئ)\n• ${analysis.lateVisits} زيارة متأخرة دون تقرير\n• ${analysis.lowParts} صنف مخزون عند حد الطلب\n• ${analysis.activeStaff}/${analysis.totalStaff} فنيين نشطين\n• ${analysis.expiringContracts} عقد ينتهي خلال 30 يوم\n• ${analysis.totalContracts} عقد إجمالاً`;
          if (analysis.openTickets.urgent > 0) msg += `\n\n⚠️ يوجد ${analysis.openTickets.urgent} بلاغ طارئ يحتاج استجابة فورية.`;
          if (analysis.expiringContracts > 0) msg += `\n\n⚠️ ${analysis.expiringContracts} عقد على وشك الانتهاء - يوصى بالتواصل مع العملاء للتجديد.`;
          if (analysis.lateVisits > 0) msg += `\n\n📋 يوصى بإعادة توزيع الزيارات المتأخرة على الفنيين المتفرغين.`;
          if (analysis.lowParts > 0) msg += `\n\n📦 يوصى بمراجعة المخزون وطلب القطع الناقصة.`;

          return sendJson(res, 200, {executed: true, message: msg, action, data: analysis});
        }

        if (action === "analyze_inventory") {
          const parts = parseStoredJson(store, "misadParts");
          const suppliers = parseStoredJson(store, "misadSuppliers");
          const low = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
          const outOfStock = parts.filter(p => Number(p.qty || 0) === 0);
          let msg = `📦 تحليل المخزون:\n• ${parts.length} قطعة غيار مسجلة\n• ${low.length} أصناف عند حد الطلب أو أقل\n• ${outOfStock.length} أصناف نفدت بالكامل\n• ${suppliers.length} مورد\n`;
          if (low.length > 0) {
            msg += `\n⚠️ الأصناف التي تحتاج إعادة طلب:\n`;
            low.slice(0, 10).forEach(p => { msg += `• ${p.name || p.title || "قطعة"}: الكمية ${p.qty || 0} (الحد: ${p.minQty || 1})\n`; });
          }
          return sendJson(res, 200, {executed: true, message: msg, action, data: {total: parts.length, lowStock: low.length, outOfStock: outOfStock.length}});
        }

        if (action === "analyze_staff") {
          const staff = parseStoredJson(store, "misadCompanyStaff");
          const visits = parseStoredJson(store, "misadVisits");
          const reports = parseStoredJson(store, "misadVisitReports");
          const analysis = staff.map(s => {
            const assigned = visits.filter(v => v.assignedTo === s.identity);
            const completed = assigned.filter(v => reports.find(r => r.visitId === v.id));
            const late = assigned.filter(v => new Date(v.scheduledAt) < new Date() && !reports.find(r => r.visitId === v.id));
            return {name: s.name, role: s.role, total: assigned.length, completed: completed.length, late: late.length, availability: s.availability || "working"};
          });
          let msg = `👥 تحليل فريق العمل:\n`;
          analysis.forEach(a => {
            const status = a.availability === "working" ? "نشط" : a.availability === "idle" ? "متفرغ" : a.availability === "vacation" ? "إجازة" : a.availability || "غير محدد";
            msg += `• ${a.name} (${a.role === "engineer" ? "مهندس" : "فني"}) - ${status}: ${a.completed}/${a.total} زيارات مكتملة${a.late > 0 ? `, ${a.late} متأخرة ⚠️` : ""}\n`;
          });
          return sendJson(res, 200, {executed: true, message: msg, action, data: analysis});
        }

        // If nothing matched, return unknown
        try {
          const aiResult = await askUnifiedAi(question, context, {id: userId, role, name: userName});
          if (aiResult.answer && !aiResult.error) {
            return sendJson(res, 200, {executed: true, message: aiResult.answer, action: "answer", model: aiResult.model, provider: aiResult.provider});
          }
        } catch {}
        const local = searchLocalData(question, store, {id: userId, role, name: userName, companyOwnerId: input.companyOwnerId});
        if (local) {
          const withSuggest = local + "\n\n" + smartSuggests("general", role);
          return sendJson(res, 200, {executed: true, message: repeatNote(userId, question, withSuggest), action: "answer"});
        }
        return sendJson(res, 200, {openForm: false, message: repeatNote(userId, question, "لم يتم التعرف على الأمر. جرب: أنشئ عقد, عرض سعر, بلاغ, زيارة, فني, مورد")});

      } catch (e) {
        sendJson(res, 500, {executed: false, message: "خطأ في التنفيذ: " + e.message});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/agent/status") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    const store = readStore();
    const memory = aiMemoryList(store).filter(x => !userId || x.userId === userId);
    return sendJson(res, 200, {
      knowledge: elevatorKnowledgeBase(),
      internetKnowledge: internetKnowledgeSummary(store),
      memoryCount: memory.length,
      recentMemory: memory.slice(0, 12).map(x => ({id: x.id, role: x.role, intent: x.plan?.intent || "answer", allowed: x.plan?.allowed !== false, createdAt: x.createdAt, rating: x.rating || "unrated"})),
      contextCounts: buildAiContext(store, {id: userId, role}).counts
    });
  }

  if (req.url.startsWith("/api/ai/internet-knowledge") && req.method === "GET") {
    const store = readStore();
    return sendJson(res, 200, internetKnowledgeSummary(store));
  }

  if (req.url.startsWith("/api/ai/internet-knowledge/update") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const input = JSON.parse(body || "{}");
        const role = String(input.role || "");
        if (!["owner", "company_admin", "admin"].includes(role)) return sendJson(res, 403, {error: "Internet knowledge update is restricted"});
        const store = readStore();
        const result = await updateInternetKnowledge(store, {force: input.force === true});
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, {error: "Invalid internet knowledge update request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/conversation") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    if (!userId || !role) return sendJson(res, 400, {error: "Missing userId or role"});
    const store = readStore();
    const conversation = getOrCreateConversation(store, userId, role);
    return sendJson(res, 200, {conversation});
  }

  if (req.url.startsWith("/api/ai/conversation/end") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const conversationId = String(input.conversationId || "");
        if (!conversationId) return sendJson(res, 400, {error: "Missing conversationId"});
        const store = readStore();
        endConversation(store, conversationId);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/conversation/history") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    if (!userId || !role) return sendJson(res, 400, {error: "Missing userId or role"});
    const store = readStore();
    const conversations = aiConversationList(store).filter(c => c.userId === userId && c.role === role).slice(0, 20);
    return sendJson(res, 200, {conversations});
  }

  if (req.url.startsWith("/api/ai/analyze-report") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const reportId = String(input.reportId || "");
        const userId = String(input.userId || "");
        const autoGenerateQuote = input.autoGenerateQuote !== false;
        
        if (!reportId) return sendJson(res, 400, {error: "Missing reportId"});
        
        const store = readStore();
        const reports = parseStoredJson(store, "misadVisitReports");
        const report = reports.find(r => r.id === reportId);
        
        if (!report) return sendJson(res, 404, {error: "Report not found"});
        
        const analysis = analyzeReportForQuote(report, store);
        
        let quote = null;
        if (autoGenerateQuote && (analysis.needsSpareParts || analysis.needsInstallation || analysis.needsUpdate || analysis.needsReplacement || analysis.needsAdditionalWorks)) {
          quote = generateAutoQuote(report, analysis, store, userId);
          const quotes = parseStoredJson(store, "misadQuotes");
          quotes.unshift(quote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
          
          // Create notification for quote review
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "عرض سعر تلقائي جديد",
            body: `تم إنشاء عرض سعر تلقائي ${quote.id} بناءً على تقرير ${reportId}. يحتاج مراجعة واعتماد.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#quotes`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {analysis, quote, reportId});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/optimize-quote") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const quoteId = String(input.quoteId || "");
        const targetValue = Number(input.targetValue || 0);
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const applyChanges = input.applyChanges === true;
        
        if (!quoteId || !targetValue) return sendJson(res, 400, {error: "Missing quoteId or targetValue"});
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to modify quotes"});
        }
        
        const store = readStore();
        const quotes = parseStoredJson(store, "misadQuotes");
        const quoteIndex = quotes.findIndex(q => q.id === quoteId);
        
        if (quoteIndex === -1) return sendJson(res, 404, {error: "Quote not found"});
        
        const originalQuote = quotes[quoteIndex];
        const quoteCopy = JSON.parse(JSON.stringify(originalQuote));
        const optimization = optimizeQuotePrices(quoteCopy, targetValue, store);
        
        let newQuote = null;
        if (applyChanges && optimization.achievable) {
          newQuote = createQuoteVersion(quoteCopy, optimization.changes, userId);
          quotes.unshift(newQuote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
          
          // Create notification for new quote version
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "إصدار جديد من عرض السعر",
            body: `تم إنشاء إصدار جديد ${newQuote.id} من عرض السعر ${quoteId} بعد التعديل الذكي.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#quotes`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {optimization, newQuote, originalQuoteId: quoteId});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/redistribute-visits") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const redistributeAll = input.redistributeAll === true;
        const applyChanges = input.applyChanges === true;
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to redistribute visits"});
        }
        
        const store = readStore();
        const analysis = redistributeVisits(store, {redistributeAll});
        
        let appliedChanges = [];
        if (applyChanges && analysis.proposedAssignments.length > 0) {
          const visits = parseStoredJson(store, "misadVisits");
          
          analysis.proposedAssignments.forEach(assignment => {
            const visitIndex = visits.findIndex(v => v.id === assignment.visitId);
            if (visitIndex !== -1) {
              const oldTechnician = visits[visitIndex].assignedTo;
              visits[visitIndex].assignedTo = assignment.proposedTechnicianId;
              visits[visitIndex].assignedName = assignment.proposedTechnician;
              visits[visitIndex].rebalancedAt = new Date().toISOString();
              visits[visitIndex].rebalancedBy = userId;
              
              appliedChanges.push({
                visitId: assignment.visitId,
                oldTechnician: oldTechnician || "غير مسند",
                newTechnician: assignment.proposedTechnicianId,
                newTechnicianName: assignment.proposedTechnician
              });
            }
          });
          
          store.misadVisits = JSON.stringify(visits);
          store["misadLastVisitRebalance:" + (userId || "platform")] = Date.now();
          writeStore(store);
          
          // Create notification for redistribution
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "إعادة توزيع الزيارات",
            body: `تم إعادة توزيع ${appliedChanges.length} زيارة بناءً على التحليل الجغرافي وتوزيع عبء العمل.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#visits`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {analysis, appliedChanges});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/technician-location") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const technicianId = url.searchParams.get("technicianId") || "";
    
    if (!technicianId) return sendJson(res, 400, {error: "Missing technicianId"});
    
    const store = readStore();
    const insights = analyzeTechnicianLocation(technicianId, store);
    sendJson(res, 200, insights);
  }

  if (req.url.startsWith("/api/ai/route-deviations") && req.method === "GET") {
    const store = readStore();
    const deviations = detectRouteDeviations(store);
    sendJson(res, 200, {deviations, count: deviations.length});
  }

  if (req.url.startsWith("/api/ai/smart-notifications") && req.method === "GET") {
    const store = readStore();
    const notifications = generateSmartNotifications(store);
    sendJson(res, 200, {notifications, count: notifications.length});
  }

  if (req.url.startsWith("/api/ai/smart-notifications/generate") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const role = String(input.role || "");
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to generate smart notifications"});
        }
        
        const store = readStore();
        const potentialNotifications = generateSmartNotifications(store);
        const createdNotifications = [];
        
        potentialNotifications.forEach(notification => {
          const created = createSmartNotification(store, notification);
          if (created) createdNotifications.push(created);
        });
        
        sendJson(res, 200, {
          generated: createdNotifications.length,
          skipped: potentialNotifications.length - createdNotifications.length,
          notifications: createdNotifications
        });
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications/mark-read") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const notificationId = String(input.notificationId || input.id || "");
        const userId = String(input.userId || "");
        
        if (!notificationId || !userId) return sendJson(res, 400, {error: "Missing notificationId or userId"});
        
        const store = readStore();
        const notifications = notificationList(store);
        const notification = notifications.find(n => n.id === notificationId);
        
        if (notification) {
          if (!notification.readBy) notification.readBy = [];
          if (!notification.readBy.includes(userId)) {
            notification.readBy.push(userId);
          }
          if (input.archived) {
            if (!notification.archivedBy) notification.archivedBy = [];
            if (!notification.archivedBy.includes(userId)) notification.archivedBy.push(userId);
          }
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications/mark-all-read") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "");
        
        if (!userId) return sendJson(res, 400, {error: "Missing userId"});
        
        const store = readStore();
        const notifications = notificationList(store);
        
        notifications.forEach(n => {
          if (!n.readBy) n.readBy = [];
          if (!n.readBy.includes(userId)) {
            n.readBy.push(userId);
          }
        });
        
        saveNotifications(store, notifications);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/logs") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || "";
    const userId = url.searchParams.get("userId") || "";
    const operation = url.searchParams.get("operation") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    
    // Check permission to view logs
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view AI logs"});
    }
    
    const store = readStore();
    const filters = {};
    if (userId) filters.userId = userId;
    if (operation) filters.operation = operation;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = getAiLogs(store, filters);
    sendJson(res, 200, {logs, count: logs.length});
  }

  if (req.url.startsWith("/api/ai/recommendations") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || "";
    
    // Check permission to view recommendations
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view recommendations"});
    }
    
    const store = readStore();
    const report = generateRecommendationReport(store);
    sendJson(res, 200, report);
  }

  if (req.url.startsWith("/api/ai/technician-profile") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const technicianId = url.searchParams.get("technicianId") || "";
    const role = url.searchParams.get("role") || "";
    
    if (!technicianId) return sendJson(res, 400, {error: "Missing technicianId"});
    
    // Check permission to view profiles
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view technician profiles"});
    }
    
    const store = readStore();
    const profile = buildTechnicianProfile(technicianId, store);
    sendJson(res, 200, profile);
  }

  if (req.url.startsWith("/api/ai/technician-profiles/update") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const role = String(input.role || "");
        
        // Check permission to update profiles
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to update technician profiles"});
        }
        
        const store = readStore();
        const profiles = updateAllTechnicianProfiles(store);
        sendJson(res, 200, {updated: profiles.length, profiles});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-workflow/initiate") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const documentId = String(input.documentId || "");
        const documentType = String(input.documentType || "");
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        
        if (!documentId || !documentType) return sendJson(res, 400, {error: "Missing documentId or documentType"});
        
        // Check permission
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to initiate document workflow"});
        }
        
        const store = readStore();
        const workflow = initiateDocumentWorkflow(store, documentId, documentType, userId, role);
        
        // Save workflow
        const workflows = parseStoredJson(store, "misadDocumentWorkflows");
        workflows.unshift(workflow);
        store.misadDocumentWorkflows = JSON.stringify(workflows.slice(0, 200));
        writeStore(store);
        
        sendJson(res, 200, workflow);
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-workflow/approve") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const workflowId = String(input.workflowId || "");
        const stepNumber = Number(input.stepNumber || 1);
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const approved = input.approved === true;
        const comments = String(input.comments || "");
        
        if (!workflowId) return sendJson(res, 400, {error: "Missing workflowId"});
        
        const store = readStore();
        const workflow = approveDocumentStep(store, workflowId, stepNumber, userId, role, approved, comments);
        
        if (workflow.error) return sendJson(res, 400, workflow);
        
        // Save updated workflow
        const workflows = parseStoredJson(store, "misadDocumentWorkflows");
        const index = workflows.findIndex(w => w.id === workflowId);
        if (index !== -1) {
          workflows[index] = workflow;
          store.misadDocumentWorkflows = JSON.stringify(workflows);
          writeStore(store);
        }
        
        sendJson(res, 200, workflow);
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-analyze") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const documentId = url.searchParams.get("documentId") || "";
    const documentType = url.searchParams.get("documentType") || "";
    const role = url.searchParams.get("role") || "";
    
    if (!documentId || !documentType) return sendJson(res, 400, {error: "Missing documentId or documentType"});
    
    // Check permission
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to analyze documents"});
    }
    
    const store = readStore();
    const analysis = analyzeDocumentForApproval(store, documentId, documentType);
    sendJson(res, 200, analysis);
  }

  if (req.url.startsWith("/api/invite/current")) {
    const token = parseCookies(req.headers.cookie)[inviteCookie];
    const invite = inviteList(readStore()).find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
    return sendJson(res, 200, invite ? {invite: {targetRole: invite.targetRole, targetUserId: invite.targetUserId, label: invite.label}} : {invite: null});
  }

  if (req.url.startsWith("/api/device/authorize") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "").replace(/\D/g, "");
        const role = String(input.role || "");
        const deviceId = String(input.deviceId || "");
        if (!userId || !role || !deviceId) return sendJson(res, 400, {error: "Missing device data"});
        const store = readStore();
        const invites = inviteList(store);
        const token = parseCookies(req.headers.cookie)[inviteCookie];
        const invite = invites.find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
        const adminBootstrap = role === "admin" && userId === "2572280689" && hasEntryAccess(req);
        const roleAllowed = invite && (!invite.targetRole || invite.targetRole === role || invite.targetRole === "any");
        const userAllowed = invite && (!invite.targetUserId || invite.targetUserId === userId);
        if (!adminBootstrap && (!roleAllowed || !userAllowed)) return sendJson(res, 403, {error: "Invite does not match this user"});
        if (invite) {
          invite.used = Number(invite.used || 0) + 1;
          invite.lastUsedAt = new Date().toISOString();
          invite.boundUserId = userId;
          invite.boundRole = role;
        }
        saveInvites(store, invites);
        const deviceValue = `${userId}.${deviceId}.${sign(`${userId}:${deviceId}`)}`;
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": [`${deviceCookie}=${deviceValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`, `${entryCookie}=; Path=/; Max-Age=0`, `${inviteCookie}=; Path=/; Max-Age=0`]
        });
        res.end(JSON.stringify({ok: true}));
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/invites")) {
    if (req.method === "GET") {
      const invites = inviteList(readStore()).map(({token, ...invite}) => ({...invite, url: `${publicOrigin(req)}/invite/${token}`}));
      return sendJson(res, 200, {invites});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const now = Date.now();
          const creatorRole = String(input.createdByRole || "");
          const targetRole = String(input.targetRole || "client");
          const allowed = creatorRole === "admin" ? ["owner", "company_admin", "client"] : creatorRole === "owner" ? ["company_admin", "client"] : creatorRole === "company_admin" ? ["client"] : [];
          if (!allowed.includes(targetRole)) return sendJson(res, 403, {error: "Role is not allowed to create this invite"});
          const invite = createInvite(input);
          const store = readStore();
          const invites = inviteList(store).filter(x => Number(x.expiresAtMs || 0) > now && !x.revoked);
          invites.unshift(invite);
          saveInvites(store, invites);
          sendJson(res, 200, {...invite, url: `${publicOrigin(req)}/invite/${invite.token}`});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      const store = readStore();
      const invites = inviteList(store);
      const invite = invites.find(x => x.id === id);
      if (invite) invite.revoked = true;
      saveInvites(store, invites);
      return sendJson(res, 200, {ok: true});
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }

  if (req.url === "/api/backup" && req.method === "POST") {
    const store = readStore();
    const result = backupStorage(store);
    return sendJson(res, result.ok ? 200 : 500, result);
  }
  if (req.url === "/api/backups" && req.method === "GET") {
    return sendJson(res, 200, {backups: listBackups()});
  }
  if (req.url.startsWith("/api/backup/download") && req.method === "GET") {
    const name = new URL(req.url, "http://localhost").searchParams.get("name");
    if (!name) return sendJson(res, 400, {error: "Missing backup name"});
    const filePath = path.join(backupDir, path.basename(name));
    if (!filePath.startsWith(backupDir) || !fs.existsSync(filePath)) return sendJson(res, 404, {error: "Backup not found"});
    const data = fs.readFileSync(filePath, "utf8");
    res.writeHead(200, {"Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`});
    return res.end(data);
  }

  if (pathname === "/api/auth/storage-token" && req.method === "GET") {
    const role = new URL(req.url, "http://localhost").searchParams.get("role");
    const userId = new URL(req.url, "http://localhost").searchParams.get("userId");
    if (role !== "admin" || !userId) return sendJson(res, 403, {error: "Admin access required"});
    const payload = `admin:full-storage:${Math.floor(Date.now() / 60000)}`;
    const token = crypto.createHmac("sha256", entrySecret).update(payload).digest("hex");
    return sendJson(res, 200, {token});
  }

  // ===== Visit Approval System API =====
  if (req.url.startsWith("/api/visits/generate-code") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const visitId = String(input.visitId || "");
        if (!visitId) return sendJson(res, 400, {error: "Missing visitId"});
        const store = readStore();
        const visits = parseStoredJson(store, "misadVisits");
        const v = visits.find(x => x.id === visitId);
        if (!v) return sendJson(res, 404, {error: "Visit not found"});
        if (v.secretCodeHash) return sendJson(res, 200, {ok: true, message: "الرمز موجود مسبقًا"});
        // Generate 10-digit secure code
        const code = String(crypto.randomInt(0, 10000000000)).padStart(10, "0");
        const hash = crypto.createHash("sha256").update(code).digest("hex");
        v.secretCodeHash = hash;
        v.secretCodeCreatedAt = new Date().toISOString();
        v.secretCodeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        // Send code to client via notification
        const notifications = notificationList(store);
        notifications.unshift({
          id: `NTF-${Date.now()}`,
          userId: v.clientId || "",
          roles: v.clientId ? [] : ["client"],
          type: "visit_secret_code",
          title: "رمز اعتماد الزيارة",
          body: `رمز اعتماد الزيارة ${visitId}: ${code}. صالح لمدة 48 ساعة.`,
          url: "/dashboard.html",
          createdAt: new Date().toISOString(),
          readBy: []
        });
        store.misadNotifications = JSON.stringify(notifications.slice(0, 200));
        writeStore(store);
        console.log(`[VisitCode] Generated code for visit ${visitId} (hash: ${hash.slice(0,8)}...)`);
        sendJson(res, 200, {ok: true, message: "تم إنشاء الرمز وإرساله إلى العميل"});
      } catch (err) {
        sendJson(res, 400, {error: "Code generation failed: " + (err.message || "")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/visits/approve-by-code") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const visitId = String(input.visitId || "");
        const code = String(input.code || "");
        const userId = String(input.userId || "");
        if (!visitId || !code) return sendJson(res, 400, {error: "Missing visitId or code"});
        const store = readStore();
        const visits = parseStoredJson(store, "misadVisits");
        const v = visits.find(x => x.id === visitId);
        if (!v) return sendJson(res, 404, {error: "Visit not found"});
        if (!v.secretCodeHash) return sendJson(res, 400, {error: "لم يتم إنشاء رمز لهذه الزيارة بعد"});
        if (v.status !== "بانتظار الاعتماد") return sendJson(res, 400, {error: "الزيارة غير جاهزة للاعتماد"});
        const hash = crypto.createHash("sha256").update(code).digest("hex");
        if (hash !== v.secretCodeHash) return sendJson(res, 400, {error: "الرمز السري غير صحيح"});
        if (v.secretCodeUsed) return sendJson(res, 400, {error: "الرمز مستخدم مسبقًا"});
        // Approve
        v.status = "بانتظار التقييم";
        v.approvedAt = new Date().toISOString();
        v.approvedBy = userId || "unknown";
        v.approvalMethod = "secret_code";
        v.secretCodeUsed = true;
        v.ratingRequestedAt = new Date().toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        // Audit log
        const activity = parseStoredJson(store, "misadActivityLog");
        activity.unshift({
          id: `ACT-${Date.now()}`,
          companyOwnerId: v.companyOwnerId || "",
          type: "زيارة",
          title: `اعتماد الزيارة ${visitId} عبر الرمز السري`,
          ref: visitId,
          user: userId,
          userId: userId,
          createdAt: new Date().toLocaleString("ar-SA"),
          createdAtMs: Date.now()
        });
        store.misadActivityLog = JSON.stringify(activity.slice(0, 300));
        writeStore(store);
        console.log(`[VisitApprove] Visit ${visitId} approved via code by ${userId}`);
        sendJson(res, 200, {ok: true, message: "تم اعتماد الزيارة بنجاح"});
      } catch (err) {
        sendJson(res, 400, {error: "Approval failed: " + (err.message || "")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/visits/approve-by-client") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const visitId = String(input.visitId || "");
        const userId = String(input.userId || "");
        if (!visitId || !userId) return sendJson(res, 400, {error: "Missing visitId or userId"});
        const store = readStore();
        const visits = parseStoredJson(store, "misadVisits");
        const v = visits.find(x => x.id === visitId);
        if (!v) return sendJson(res, 404, {error: "Visit not found"});
        if (v.status !== "بانتظار الاعتماد") return sendJson(res, 400, {error: "الزيارة غير جاهزة للاعتماد"});
        // Approve
        v.status = "بانتظار التقييم";
        v.approvedAt = new Date().toISOString();
        v.approvedBy = userId;
        v.approvalMethod = "client_login";
        v.ratingRequestedAt = new Date().toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        // Audit log
        const activity = parseStoredJson(store, "misadActivityLog");
        activity.unshift({
          id: `ACT-${Date.now()}`,
          companyOwnerId: v.companyOwnerId || "",
          type: "زيارة",
          title: `اعتماد الزيارة ${visitId} من حساب العميل`,
          ref: visitId,
          user: userId,
          userId: userId,
          createdAt: new Date().toLocaleString("ar-SA"),
          createdAtMs: Date.now()
        });
        store.misadActivityLog = JSON.stringify(activity.slice(0, 300));
        writeStore(store);
        console.log(`[VisitApprove] Visit ${visitId} approved by client ${userId}`);
        sendJson(res, 200, {ok: true, message: "تم اعتماد الزيارة بنجاح"});
      } catch (err) {
        sendJson(res, 400, {error: "Client approval failed: " + (err.message || "")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/visits/rate") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const visitId = String(input.visitId || "");
        const stars = Number(input.stars || 0);
        const notes = String(input.notes || "");
        const isAuto = input.auto === true;
        if (!visitId) return sendJson(res, 400, {error: "Missing visitId"});
        if (stars < 1 || stars > 5) return sendJson(res, 400, {error: "التقييم يجب أن يكون بين 1 و 5"});
        const store = readStore();
        const visits = parseStoredJson(store, "misadVisits");
        const v = visits.find(x => x.id === visitId);
        if (!v) return sendJson(res, 404, {error: "Visit not found"});
        if (v.status !== "بانتظار التقييم") return sendJson(res, 400, {error: "الزيارة غير جاهزة للتقييم"});
        // Save rating
        v.rating = {stars, notes, auto: isAuto, createdAt: new Date().toISOString()};
        v.status = "مكتملة";
        v.completedAt = new Date().toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        // Audit log
        const activity = parseStoredJson(store, "misadActivityLog");
        activity.unshift({
          id: `ACT-${Date.now()}`,
          companyOwnerId: v.companyOwnerId || "",
          type: "تقييم",
          title: `تقييم الفني ${isAuto ? "(تلقائي)" : ""} ${stars} نجوم للزيارة ${visitId}`,
          ref: visitId,
          user: isAuto ? "system" : input.userId || "unknown",
          userId: isAuto ? "system" : input.userId || "",
          createdAt: new Date().toLocaleString("ar-SA"),
          createdAtMs: Date.now()
        });
        store.misadActivityLog = JSON.stringify(activity.slice(0, 300));
        writeStore(store);
        console.log(`[VisitRating] Visit ${visitId} rated ${stars} stars${isAuto ? " (auto)" : ""}`);
        sendJson(res, 200, {ok: true, message: "تم تسجيل التقييم بنجاح"});
      } catch (err) {
        sendJson(res, 400, {error: "Rating failed: " + (err.message || "")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/visits/pending-approval") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    if (!userId) return sendJson(res, 400, {error: "Missing userId"});
    const store = readStore();
    const visits = parseStoredJson(store, "misadVisits");
    const pending = visits.filter(v =>
      v.status === "بانتظار الاعتماد" &&
      (cleanId(v.clientId || "") === cleanId(userId) || v.clientCompanyUnifiedNumber === userId)
    ).map(v => ({
      id: v.id,
      contractId: v.contractId,
      clientName: v.clientName,
      buildingName: v.building?.name || "",
      scheduledAt: v.scheduledAt,
      status: v.status,
      technicianName: v.assignedName || ""
    }));
    sendJson(res, 200, {visits: pending.slice(0, 50)});
    return;
  }

  if (req.url.startsWith("/api/visits/pending-rating") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    if (!userId) return sendJson(res, 400, {error: "Missing userId"});
    const store = readStore();
    const visits = parseStoredJson(store, "misadVisits");
    const pendingRating = visits.filter(v =>
      v.status === "بانتظار التقييم" &&
      (cleanId(v.clientId || "") === cleanId(userId) || v.clientCompanyUnifiedNumber === userId)
    ).map(v => ({
      id: v.id,
      contractId: v.contractId,
      clientName: v.clientName,
      technicianName: v.assignedName || "",
      approvedAt: v.approvedAt
    }));
    sendJson(res, 200, {visits: pendingRating.slice(0, 50)});
    return;
  }

  if (req.url === "/api/visits/auto-rate-expired" && req.method === "POST") {
    // Auto-rate all visits in "بانتظار التقييم" for more than 24h
    try {
      const store = readStore();
      const visits = parseStoredJson(store, "misadVisits");
      const now = Date.now();
      let rated = 0;
      for (const v of visits) {
        if (v.status === "بانتظار التقييم" && v.ratingRequestedAt) {
          const elapsed = now - new Date(v.ratingRequestedAt).getTime();
          if (elapsed > 24 * 60 * 60 * 1000) {
            v.rating = {stars: 5, notes: "", auto: true, createdAt: new Date().toISOString()};
            v.status = "مكتملة";
            v.completedAt = new Date().toISOString();
            rated++;
            const activity = parseStoredJson(store, "misadActivityLog");
            activity.unshift({
              id: `ACT-${Date.now()}`,
              companyOwnerId: v.companyOwnerId || "",
              type: "تقييم",
              title: `تقييم تلقائي 5 نجوم للزيارة ${v.id} - انتهت مهلة التقييم`,
              ref: v.id,
              user: "system",
              userId: "system",
              createdAt: new Date().toLocaleString("ar-SA"),
              createdAtMs: Date.now()
            });
            store.misadActivityLog = JSON.stringify(activity.slice(0, 300));
          }
        }
      }
      if (rated > 0) {
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        console.log(`[AutoRate] Auto-rated ${rated} expired visits`);
      }
      sendJson(res, 200, {ok: true, rated});
    } catch (err) {
      sendJson(res, 400, {error: "Auto-rate failed: " + (err.message || "")});
    }
    return;
  }

  if (req.url === "/api/visits/auto-generate-codes" && req.method === "POST") {
    // Generate codes for visits within 24h of scheduled time
    try {
      const store = readStore();
      const visits = parseStoredJson(store, "misadVisits");
      const now = Date.now();
      let generated = 0;
      for (const v of visits) {
        if (v.status === "مجدولة" && v.scheduledAt && !v.secretCodeHash) {
          const sched = new Date(v.scheduledAt).getTime();
          const diff = sched - now;
          if (diff > 0 && diff <= 25 * 60 * 60 * 1000) { // Within 1-25 hours
            const code = String(crypto.randomInt(0, 10000000000)).padStart(10, "0");
            const hash = crypto.createHash("sha256").update(code).digest("hex");
            v.secretCodeHash = hash;
            v.secretCodeCreatedAt = new Date().toISOString();
            v.secretCodeExpiresAt = new Date(sched).toISOString();
            v.status = "بانتظار التنفيذ";
            generated++;
            const notifications = notificationList(store);
            notifications.unshift({
              id: `NTF-${Date.now()}`,
              userId: v.clientId || "",
              roles: v.clientId ? [] : ["client"],
              type: "visit_secret_code",
              title: "رمز اعتماد الزيارة",
              body: `رمز اعتماد الزيارة ${v.id}: ${code}.`,
              url: "/dashboard.html",
              createdAt: new Date().toISOString(),
              readBy: []
            });
            store.misadNotifications = JSON.stringify(notifications.slice(0, 200));
          }
        }
      }
      if (generated > 0) {
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        console.log(`[AutoCodes] Generated codes for ${generated} visits`);
      }
      sendJson(res, 200, {ok: true, generated});
    } catch (err) {
      sendJson(res, 400, {error: "Auto-generate failed: " + (err.message || "")});
    }
    return;
  }

  // ===== End Visit Approval System =====

  if (req.url.startsWith("/api/storage")) {
    if (req.method === "GET") {
      const key = new URL(req.url, "http://localhost").searchParams.get("key");
      const store = readStore();
      if (key) return sendJson(res, 200, Object.prototype.hasOwnProperty.call(store, key) ? {key, value: store[key]} : {});
      const adminToken = new URL(req.url, "http://localhost").searchParams.get("admin");
      const nowMin = Math.floor(Date.now() / 60000);
      const valid = [0, -1].some(off => {
        const expected = crypto.createHmac("sha256", entrySecret).update(`admin:full-storage:${nowMin + off}`).digest("hex");
        return adminToken === expected;
      });
      if (!valid) return sendJson(res, 403, {error: "Unauthorized. Admin access required."});
      const accept = req.headers.accept || "";
      const json = JSON.stringify(store, null, 2);
      if (accept.includes("text/html")) {
        const safe = escHtml(json);
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        return res.end(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بيانات التخزين — شموس</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,'Segoe UI',sans-serif;background:#f0f4f8;padding:16px;color:#1a2a3a}.wrap{max-width:1200px;margin:0 auto}.head{background:linear-gradient(135deg,#1a3a3a,#2d5a5a);color:#fff;padding:20px 24px;border-radius:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}.head h1{font-size:18px;font-weight:600}.head small{font-size:13px;opacity:.8;display:block;margin-top:2px}.btn-copy{background:#c9964b;border:0;color:#fff;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;transition:.2s;display:inline-flex;align-items:center;gap:6px}.btn-copy:hover{background:#b8843a}.btn-copy.copied{background:#2e7d32}.pre-wrap{background:#1e2a3a;color:#e8e8e8;padding:20px 24px;border-radius:12px;overflow:auto;max-height:80vh;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:13px;line-height:1.6;white-space:pre;direction:ltr;text-align:left;box-shadow:0 2px 12px #0001}.pre-wrap .key{color:#7ec8e3}.pre-wrap .str{color:#a5d6a7}.pre-wrap .num{color:#ffab91}.pre-wrap .bool{color:#ce93d8}.pre-wrap .null{color:#90a4ae}.footer{text-align:center;margin-top:16px;color:#6b7b8b;font-size:12px}.status{display:inline-flex;align-items:center;gap:6px;background:#1b5e2030;color:#1b5e20;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500}</style></head><body><div class="wrap"><div class="head"><div><h1>📦 بيانات التخزين</h1><small>شمس — منصة إدارة المصاعد</small></div><div style="display:flex;align-items:center;gap:12px"><span class="status">● متصل</span><button class="btn-copy" id="copyBtn" onclick="copyContent()">📋 نسخ المحتوى</button></div></div><div class="pre-wrap" id="jsonContent">${safe}</div><div class="footer">تم التحميل في ${new Date().toLocaleString("ar-SA")}</div></div><script>function copyContent(){const t=document.getElementById("jsonContent");const ta=document.createElement("textarea");ta.value=t.textContent;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);const b=document.getElementById("copyBtn");b.textContent="✅ تم النسخ";b.classList.add("copied");setTimeout(()=>{b.textContent="📋 نسخ المحتوى";b.classList.remove("copied")},2000)}</script></body></html>`);
      }
      return sendJson(res, 200, store);
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const {key, value, remove} = JSON.parse(body || "{}");
          if (!key) return sendJson(res, 400, {error: "Missing key"});
          const store = readStore();
          if (remove) delete store[key];
          else store[key] = value;
          writeStore(store);
          sendJson(res, 200, {ok: true});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }
  let urlPath = pathname;
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const extraHeaders = {};
    if (urlPath === "/manifest.json") extraHeaders["Access-Control-Allow-Origin"] = "*";
    if (urlPath === "/sw.js") extraHeaders["Service-Worker-Allowed"] = "/";
    res.writeHead(200, Object.assign({
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": ext === ".json" || ext === ".js" ? "no-cache" : "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }, extraHeaders));
    res.end(data);
  });
}).listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
  try { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, {recursive: true}); } catch {}
  if (!fs.existsSync(storagePath)) {
    // محاولة استعادة من نسخة احتياطية خارج المشروع أولاً
    let restored = false;
    if (fs.existsSync(legacyStoragePath) && path.resolve(legacyStoragePath) !== path.resolve(storagePath)) {
      try {
        fs.copyFileSync(legacyStoragePath, storagePath);
        console.log("Migrated legacy storage.json into persistent storage: " + storagePath);
        restored = true;
      } catch (e) {
        console.log("Legacy storage migration failed:", e.message);
      }
    }
    if (!restored && fs.existsSync(storageFailover)) {
      try {
        fs.copyFileSync(storageFailover, storagePath);
        console.log("Restored storage.json from external failover: " + storageFailover);
        restored = true;
      } catch (e) {
        console.log("Failover restore failed:", e.message);
      }
    }
    if (!restored) {
      try {
        if (fs.existsSync(backupDir)) {
          const backups = fs.readdirSync(backupDir).filter(f => f.startsWith("storage-") && f.endsWith(".json")).sort().reverse();
          if (backups.length) {
            const latest = path.join(backupDir, backups[0]);
            fs.copyFileSync(latest, storagePath);
            console.log(`Restored storage.json from backup: ${backups[0]}`);
            restored = true;
          }
        }
      } catch (e) {
        console.log("Backup restore failed:", e.message);
      }
    }
    if (!restored) {
      const templatePath = path.join(root, "storage.template.json");
      if (fs.existsSync(templatePath)) {
        let template = JSON.parse(fs.readFileSync(templatePath, "utf8").replace(/^\uFEFF/,""));
        template.misadCreatedAt = new Date().toISOString();
        fs.writeFileSync(storagePath, JSON.stringify(template, null, 2), "utf8");
        console.log("Created initial storage.json from storage.template.json");
      } else {
        const defaultStore = {misadCreatedAt: new Date().toISOString()};
        fs.writeFileSync(storagePath, JSON.stringify(defaultStore, null, 2), "utf8");
        console.log("Created initial storage.json (no template found)");
      }
    }
  } else {
    // storage.json موجود
    try {
      if (!fs.existsSync(storageFailover)) fs.copyFileSync(storagePath, storageFailover);
    } catch {}
    const templatePath = path.join(root, "storage.template.json");
    if (process.env.FORCE_SEED_STORAGE === "1" && fs.existsSync(templatePath)) {
      // فرض استعادة البيانات من القالب (مع أخذ نسخة احتياطية أولاً)
      try {
        fs.copyFileSync(storagePath, storagePath + ".pre-seed." + Date.now() + ".bak");
      } catch {}
      fs.copyFileSync(templatePath, storagePath);
      console.log("FORCE_SEED_STORAGE=1: تم استبدال storage.json بالكامل من القالب");
    } else if (fs.existsSync(templatePath)) {
      try {
        const template = JSON.parse(fs.readFileSync(templatePath, "utf8").replace(/^\uFEFF/,""));
        const current = JSON.parse(fs.readFileSync(storagePath, "utf8").replace(/^\uFEFF/,""));
        let changed = false;
        for (const [key, value] of Object.entries(template)) {
          if (!(key in current) || (typeof value === "string" && value.startsWith("[]") && current[key] === "[]")) {
            current[key] = value;
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(storagePath, JSON.stringify(current, null, 2), "utf8");
          console.log("Merged missing keys from storage.template.json into existing storage.json");
        }
      } catch (e) {
        console.log("Template merge skipped:", e.message);
      }
    }
  }
  const store = readStore();
  const invites = inviteList(store);
  const invite = createInvite({label: "رابط تسجيل جهاز المشرف", targetRole: "admin", createdBy: "system", createdByName: "system", minutes: 10, maxUses: 1});
  invites.unshift(invite);
  saveInvites(store, invites);
  console.log(`Startup generated entry link: /invite/${invite.token}`);
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.PUBLIC_URL || "";
  if (keepAliveUrl) {
    setInterval(() => {
      fetch(`${keepAliveUrl.replace(/\/$/, "")}/health`).catch(() => {});
    }, 5 * 60 * 1000).unref?.();
    console.log(`Keep-alive health ping enabled for ${keepAliveUrl}`);
  }
  if (!process.env.SECRET_ENTRY_TOKEN) {
    console.log("Set SECRET_ENTRY_TOKEN on Render to keep entry sessions valid across restarts.");
  }
  if (process.env.AI_INTERNET_ENABLED === "1") {
    const runInternetUpdate = () => updateInternetKnowledge(readStore()).then(r => console.log(`Internet AI knowledge update: ${r.updated || 0}/${r.sources || 0}`)).catch(err => console.log("Internet AI knowledge update failed:", err.message));
    runInternetUpdate();
    setInterval(runInternetUpdate, Math.max(1, Number(process.env.AI_INTERNET_REFRESH_HOURS || 24)) * 60 * 60 * 1000).unref?.();
  }
  // Auto-backup scheduler
  const runBackup = () => { const r = backupStorage(readStore()); if (r.ok) console.log(`Backup created: ${r.timestamp} (${r.totalBackups} total)`); };
  runBackup();
  setInterval(runBackup, backupIntervalMs).unref?.();
  console.log(`Auto-backup every ${Math.round(backupIntervalMs/60000)} min, retention ${backupMaxAgeDays} days`);
  // Auto-visit operations scheduler (every 5 minutes) - direct function calls
  const runVisitOps = () => {
    try {
      const store = readStore();
      // Auto-generate codes
      const visits = parseStoredJson(store, "misadVisits");
      const now = Date.now();
      let generated = 0;
      for (const v of visits) {
        if (v.status === "مجدولة" && v.scheduledAt && !v.secretCodeHash) {
          const sched = new Date(v.scheduledAt).getTime();
          const diff = sched - now;
          if (diff > 0 && diff <= 25 * 60 * 60 * 1000) {
            const code = String(crypto.randomInt(0, 10000000000)).padStart(10, "0");
            const hash = crypto.createHash("sha256").update(code).digest("hex");
            v.secretCodeHash = hash;
            v.secretCodeCreatedAt = new Date().toISOString();
            v.secretCodeExpiresAt = new Date(sched).toISOString();
            v.status = "بانتظار التنفيذ";
            generated++;
            const notifications = notificationList(store);
            notifications.unshift({
              id: `NTF-${Date.now()}`, userId: v.clientId || "", roles: v.clientId ? [] : ["client"],
              type: "visit_secret_code", title: "رمز اعتماد الزيارة",
              body: `رمز اعتماد الزيارة ${v.id}: ${code}.`, url: "/dashboard.html",
              createdAt: new Date().toISOString(), readBy: []
            });
            store.misadNotifications = JSON.stringify(notifications.slice(0, 200));
          }
        }
      }
      if (generated) { store.misadVisits = JSON.stringify(visits); writeStore(store); console.log(`[Auto] Generated codes for ${generated} visits`); }
      // Auto-rate expired
      let rated = 0;
      for (const v of visits) {
        if (v.status === "بانتظار التقييم" && v.ratingRequestedAt) {
          if (now - new Date(v.ratingRequestedAt).getTime() > 24 * 60 * 60 * 1000) {
            v.rating = {stars: 5, notes: "", auto: true, createdAt: new Date().toISOString()};
            v.status = "مكتملة"; v.completedAt = new Date().toISOString(); rated++;
            const activity = parseStoredJson(store, "misadActivityLog");
            activity.unshift({id: `ACT-${Date.now()}`, companyOwnerId: v.companyOwnerId || "", type: "تقييم", title: `تقييم تلقائي 5 نجوم للزيارة ${v.id}`, ref: v.id, user: "system", userId: "system", createdAt: new Date().toLocaleString("ar-SA"), createdAtMs: Date.now()});
            store.misadActivityLog = JSON.stringify(activity.slice(0, 300));
          }
        }
      }
      if (rated) { store.misadVisits = JSON.stringify(visits); writeStore(store); console.log(`[Auto] Auto-rated ${rated} visits`); }
    } catch (e) { console.log("[Auto] Visit ops error:", e.message); }
  };
  runVisitOps();
  setInterval(runVisitOps, 5 * 60 * 1000).unref?.();
  console.log("Auto-visit code generation and auto-rating scheduler active (5 min interval)");
});
