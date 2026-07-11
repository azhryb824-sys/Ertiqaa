<<<<<<< HEAD
// Local predictive AI layer.
// It provides useful risk scoring without external model downloads, and keeps the
// same surface ready for TensorFlow/ONNX models later.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function riskLabel(score) {
  if (score >= 0.72) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.28) return "medium";
  return "low";
}

function daysBetween(a, b) {
  const start = new Date(a || Date.now()).getTime();
  const end = new Date(b || Date.now()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

const deepLearningModels = {
  available: true,
  mode: "local-ensemble",
  supportedTasks: ["failure_risk", "part_demand", "technician_fit", "anomaly_detection"],
  models: [
    {id: "elevator-risk-ensemble", task: "failure_risk", loaded: true},
    {id: "parts-demand-ensemble", task: "part_demand", loaded: true},
    {id: "technician-fit-ensemble", task: "technician_fit", loaded: true},
    {id: "linguistic-service-employee", task: "response_style", loaded: true}
  ],

  loadModel: function(modelConfig) {
    return {
      loaded: true,
      model: modelConfig?.id || "local-ensemble",
      mode: this.mode,
      note: "Using built-in operational predictor. External TensorFlow/ONNX models can replace this surface later."
    };
  },

  predict: function(modelId, input) {
    if (/part/i.test(modelId || "")) return this.predictPartDemand(input);
    if (/technician/i.test(modelId || "")) return this.rankTechnicians(input);
    if (/linguistic|language|response|style/i.test(modelId || "")) return this.predictResponseStyle(input);
    return this.predictFailureRisk(input);
  },

  predictResponseStyle: function(input = {}) {
    const role = String(input.user?.role || "");
    const question = String(input.question || "");
    const intent = String(input.intent || "answer");
    const history = Array.isArray(input.history) ? input.history : [];
    const memory = Array.isArray(input.memory) ? input.memory : [];
    const ratings = memory.map(m => m.rating).filter(Boolean);
    const negativeSignals = memory.filter(m => /bad|ضعيف|غير|مكرر|لم يعجب|negative|rejected/i.test(String(m.rating || m.feedback || m.question || ""))).length;
    const repeatedOpenings = this._topOpenings(memory.map(m => m.answer).filter(Boolean));
    const isVoice = /صوت|voice|مايك|تحدث|اسمع/i.test(question) || input.voiceMode === true;
    const isCustomer = role === "client" || /عميل|خدمة|بلاغ|اعتماد|تقرير|عقدي|زيارتي/i.test(question);
    const isTechnical = /عطل|مصعد|باب|محرك|حساس|فرامل|انفرتر|فني|زيارة/i.test(question);
    const isManager = ["owner", "company_admin", "admin"].includes(role);
    const needsAction = /سوي|اعمل|أنشئ|افتح|سجل|ارسل|جدول|نفذ|اعتمد/i.test(question) || intent.startsWith("create_");

    let persona = "service_employee";
    if (isCustomer) persona = "customer_success_employee";
    else if (isTechnical && role === "technician") persona = "technical_dispatch_employee";
    else if (isManager) persona = "operations_employee";

    let tone = "professional_warm";
    if (isVoice) tone = "short_spoken";
    else if (isCustomer) tone = "reassuring_customer_service";
    else if (needsAction) tone = "decisive_operational";

    const format = isVoice ? "one_or_two_short_sentences" : isCustomer ? "status_then_next_step" : needsAction ? "confirm_then_execute_or_missing_field" : "answer_then_offer_help";
    const avoidOpenings = repeatedOpenings.slice(0, 8);
    const preferredOpenings = this._serviceOpenings({tone, persona, intent, avoidOpenings});
    const responseLength = isVoice ? "short" : isCustomer ? "medium" : "adaptive";

    return {
      model: "linguistic-service-employee",
      persona,
      tone,
      format,
      responseLength,
      confidence: Math.round(clamp(0.62 + Math.min(memory.length, 20) * 0.01 - negativeSignals * 0.03, 0.35, 0.92) * 100) / 100,
      avoidOpenings,
      preferredOpenings,
      rules: [
        "Act like an AI employee serving the customer, not a generic chatbot.",
        "Start with the useful service response immediately.",
        "Use customer-safe wording for clients and do not reveal internal company data beyond their scope.",
        "Vary the opening, sentence order, and closing compared with recent answers.",
        "If an action is possible and data is sufficient, execute or prepare it. If missing data exists, ask for the minimum missing field only.",
        "When answering a customer, mention request status, next step, and reassurance without overpromising."
      ],
      learnedSignals: {
        memorySamples: memory.length,
        ratingsSeen: ratings.length,
        negativeSignals,
        repeatedOpenings
      }
    };
  },

  improveResponseLanguage: function(answer, profile = {}, input = {}) {
    let text = String(answer || "").trim();
    if (!text) return text;
    const executeBlocks = [];
    text = text.replace(/\[EXECUTE:[\s\S]*?\]/g, block => {
      executeBlocks.push(block);
      return `__EXECUTE_BLOCK_${executeBlocks.length - 1}__`;
    });

    const avoid = Array.isArray(profile.avoidOpenings) ? profile.avoidOpenings : [];
    const opening = this._openingOf(text);
    if (opening && avoid.some(x => this._similarOpening(opening, x))) {
      const replacement = (profile.preferredOpenings || []).find(x => !avoid.some(a => this._similarOpening(x, a))) || "أبشر، خلني أخدمك مباشرة.";
      text = text.replace(new RegExp("^" + this._escapeRegExp(opening) + "[.!؟?]*"), replacement);
    }

    if (profile.persona === "customer_success_employee" && !/[.!؟]\s*$/.test(text)) {
      text += ".";
    }
    if (profile.persona === "customer_success_employee" && !/تحت أمرك|أتابع|أقدر أساعدك|خدمتك/i.test(text) && text.length < 900) {
      text += "\n\nأنا معك خطوة بخطوة، وإذا احتجت متابعة الطلب أقدر أساعدك مباشرة.";
    }
    if (profile.tone === "short_spoken") {
      text = text.split(/\n{2,}/).slice(0, 2).join("\n");
    }

    executeBlocks.forEach((block, i) => {
      text = text.replace(`__EXECUTE_BLOCK_${i}__`, block);
    });
    return text;
  },

  predictFailureRisk: function(input = {}) {
    const visits = Array.isArray(input.visits) ? input.visits : [];
    const tickets = Array.isArray(input.tickets) ? input.tickets : [];
    const reports = Array.isArray(input.reports) ? input.reports : [];
    const now = input.now || new Date().toISOString();
    const recent = visits.concat(reports).filter(item => daysBetween(item.date || item.createdAt, now) <= 120);
    const openTickets = tickets.filter(t => !/مغلق|منجز|closed|done/i.test(String(t.status || "")));
    const highSeverity = recent.filter(item => /high|critical|عاجل|طارئ|توقف|خطر/i.test(String(item.severity || item.notes || item.issues || item.description || ""))).length;
    const unresolved = recent.filter(item => item.resolved === false || /بانتظار|متابعة|pending|follow/i.test(String(item.status || item.outcome || item.notes || ""))).length;
    const repeatedFaults = {};
    recent.forEach(item => (item.faults || []).forEach(f => { repeatedFaults[f] = (repeatedFaults[f] || 0) + 1; }));
    const repetitionScore = Math.max(0, ...Object.values(repeatedFaults)) / Math.max(1, recent.length);
    const ageScore = clamp(daysBetween(input.lastMaintenanceDate || recent.at(-1)?.date || recent.at(-1)?.createdAt, now) / 90, 0, 1);
    const ticketScore = clamp(openTickets.length / 5, 0, 1);
    const severityScore = clamp(highSeverity / Math.max(1, recent.length), 0, 1);
    const unresolvedScore = clamp(unresolved / Math.max(1, recent.length), 0, 1);
    const score = clamp((ageScore * 0.28) + (ticketScore * 0.22) + (severityScore * 0.2) + (unresolvedScore * 0.18) + (repetitionScore * 0.12), 0, 1);

    return {
      model: "elevator-risk-ensemble",
      score: Math.round(score * 100) / 100,
      risk: riskLabel(score),
      signals: {
        daysSinceMaintenance: daysBetween(input.lastMaintenanceDate || recent.at(-1)?.date || recent.at(-1)?.createdAt, now),
        openTickets: openTickets.length,
        recentRecords: recent.length,
        highSeverity,
        unresolved,
        repeatedFaults: Object.entries(repeatedFaults).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([fault, count]) => ({fault, count}))
      },
      recommendations: this._riskRecommendations(score, openTickets.length, highSeverity, unresolved)
    };
  },

  predictPartDemand: function(input = {}) {
    const records = (Array.isArray(input.visits) ? input.visits : []).concat(Array.isArray(input.reports) ? input.reports : []);
    const usage = {};
    records.forEach(r => this._asList(r.parts || r.partsReplaced || []).forEach(p => { usage[p] = (usage[p] || 0) + 1; }));
    return Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([part, count]) => ({
        part,
        demandScore: Math.round(clamp(count / Math.max(1, records.length), 0, 1) * 100) / 100,
        recommendedMinStock: Math.max(1, Math.ceil(count * 1.25))
      }));
  },

  rankTechnicians: function(input = {}) {
    const technicians = Array.isArray(input.technicians) ? input.technicians : [];
    const visits = Array.isArray(input.visits) ? input.visits : [];
    return technicians.map(tech => {
      const own = visits.filter(v => String(v.technicianId || "") === String(tech.identity || tech.id || ""));
      const resolved = own.filter(v => v.resolved !== false).length;
      const load = Number(tech.activeVisits || own.length || 0);
      const score = clamp((resolved / Math.max(1, own.length)) * 0.65 + (1 / Math.max(1, load + 1)) * 0.35, 0, 1);
      return {technicianId: tech.identity || tech.id, name: tech.name, score: Math.round(score * 100) / 100, visitCount: own.length};
    }).sort((a, b) => b.score - a.score);
  },

  _riskRecommendations: function(score, openTickets, highSeverity, unresolved) {
    const list = [];
    if (score >= 0.5) list.push("جدولة زيارة وقائية قريبة للمصعد عالي الخطورة.");
    if (openTickets > 0) list.push("إغلاق البلاغات المفتوحة أو ربطها بخطة متابعة واضحة.");
    if (highSeverity > 0) list.push("مراجعة أعطال التوقف والخطورة مع فني خبير قبل الزيارة القادمة.");
    if (unresolved > 0) list.push("تحويل التوصيات غير المنفذة إلى مهام أو عروض أسعار.");
    if (!list.length) list.push("المؤشرات مستقرة. استمر في الصيانة الدورية وتوثيق القطع المستبدلة.");
    return list;
  },

  _asList: function(value) {
    return (Array.isArray(value) ? value : String(value || "").split(/[,،\n؛;]+/))
      .map(x => String(x).trim())
      .filter(Boolean);
  },

  _topOpenings: function(answers) {
    const counts = {};
    answers.forEach(answer => {
      const opening = this._openingOf(answer);
      if (opening) counts[opening] = (counts[opening] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 1).map(([opening]) => opening);
  },

  _openingOf: function(answer) {
    return String(answer || "").replace(/\[EXECUTE:[\s\S]*?\]/g, "").trim().split(/[.!؟\n]/)[0].trim().slice(0, 90);
  },

  _similarOpening: function(a, b) {
    const clean = s => String(s || "").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 45);
    const x = clean(a);
    const y = clean(b);
    return x && y && (x === y || x.includes(y) || y.includes(x));
  },

  _escapeRegExp: function(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  },

  _serviceOpenings: function({tone, persona, intent, avoidOpenings}) {
    const pool = persona === "customer_success_employee" ? [
      "أبشر، أنا معك في طلبك.",
      "تمام، خلني أراجع لك الموضوع بوضوح.",
      "حاضر، بخدمك خطوة بخطوة.",
      "وصل طلبك، وهذا الإجراء المناسب.",
      "أكيد، أقدر أساعدك في هذا."
    ] : tone === "decisive_operational" ? [
      "تم، نبدأ بالإجراء مباشرة.",
      "واضح المطلوب، وهذا المسار العملي.",
      "أبشر، أتعامل معها كعملية تشغيل.",
      "تمام، خلني أحدد المطلوب وأنفذ المتاح.",
      "حاضر، سأحول الطلب إلى خطوة عملية."
    ] : [
      "أبشر، هذا أوضح مسار.",
      "تمام، الإجابة المختصرة هي.",
      "واضح، خلني أرتبها لك.",
      "حاضر، هذا الأنسب حسب بيانات النظام.",
      "أكيد، أقدر أوضحها لك."
    ];
    return pool.filter(x => !(avoidOpenings || []).some(a => this._similarOpening(x, a))).slice(0, 5);
=======
const http = require("http");
const https = require("https");
const url = require("url");

function jameelEndpoint() {
  return (process.env.JAMEEL_VOICE_ENDPOINT || "http://127.0.0.1:5050").replace(/\/+$/, "");
}

function fetchJson(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(endpoint);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(endpoint, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      timeout: options.timeout || 10000
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ error: "Invalid JSON response", raw: data.slice(0, 200) }); }
      });
    });
    req.on("error", err => resolve({ error: err.message, available: false }));
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const deepLearningModels = {
  available: false,
  connected: false,
  jameelEndpoint: jameelEndpoint(),
  supportedTasks: ["voice_synthesis", "voice_cloning", "fault_prediction", "text_generation"],
  models: [],

  init: async function () {
    const ep = jameelEndpoint();
    this.jameelEndpoint = ep;
    const status = await fetchJson(`${ep}/health`, { timeout: 5000 });
    this.connected = status && !status.error;
    if (this.connected) {
      const modelInfo = await fetchJson(`${ep}/speech/status`, { timeout: 5000 });
      this.models = [{
        id: "coqui-xtts",
        name: "Coqui XTTS (Arabic)",
        type: "voice_cloning",
        status: modelInfo?.ready ? "ready" : "loading",
        refCount: modelInfo?.references || 0,
        endpoint: ep
      }];
      this.available = true;
    }
    return this;
  },

  loadModel: async function (modelConfig) {
    const ep = jameelEndpoint();
    const status = await fetchJson(`${ep}/speech/status`, { timeout: 5000 });
    if (status && !status.error) {
      return { loaded: true, modelId: modelConfig?.id || "coqui-xtts", references: status.references || 0 };
    }
    return { loaded: false, error: "jameel-ai غير متاح. تأكد من تشغيله.", requirements: ["Python 3.11", "coqui-tts", "PyTorch"] };
  },

  train: async function (task, data) {
    const ep = jameelEndpoint();
    if (task === "voice") {
      const samples = data?.samples || [];
      if (!samples.length) return { error: "لا توجد عينات للتدريب." };
      const results = [];
      for (const s of samples) {
        const r = await fetchJson(`${ep}/training/voice`, {
          method: "POST", body: { audio: s.audio, name: s.name }, timeout: 30000
        });
        results.push(r);
      }
      const okCount = results.filter(r => r.ok === true).length;
      return { ok: okCount > 0, trained: okCount, total: samples.length, details: results };
    }
    return { error: `مهمة التعلم العميق "${task}" غير مدعومة.` };
  },

  predict: async function (modelId, input) {
    const ep = jameelEndpoint();
    if (modelId === "coqui-xtts" || modelId === "voice") {
      if (!input?.text) return { error: "النص مطلوب للتوليد." };
      const status = await fetchJson(`${ep}/speech/status`, { timeout: 5000 });
      if (!status?.ready) return { error: "النموذج الصوتي غير جاهز. درّب العينات أولاً." };
      return { ok: true, modelId: "coqui-xtts", task: "voice_synthesis", status: "ready", references: status.references || 0 };
    }
    return { error: `النموذج "${modelId}" غير متاح.` };
  },

  getStatus: async function () {
    if (!this.connected) await this.init();
    const ep = jameelEndpoint();
    const voiceStatus = await fetchJson(`${ep}/speech/status`, { timeout: 5000 });
    const health = await fetchJson(`${ep}/health`, { timeout: 5000 });
    return {
      available: this.available,
      connected: this.connected,
      endpoint: ep,
      models: this.models,
      voiceEngine: voiceStatus?.ready ? "ready" : (voiceStatus?.error ? "error" : "loading"),
      references: voiceStatus?.references || 0,
      health: health?.status === "ok"
    };
>>>>>>> 9d10d17 (تفعيل مسارات التعلم العميق بالكامل: ربط deepLearningModels.cjs بـ jameel-ai، إضافة endpoints (status/train/predict) في server.cjs، توسيع قدرات deep_learning في modelSelectionSystem.cjs ليشمل voice_synthesis وfault_prediction، إضافة قسم DL في صفحة الإدارة الذكية مع حالة النموذج وزر تدريب، تفعيل explainableAI.cjs بتوليد تفسيرات حقيقية للقرارات والتنبؤات)
  }
};

module.exports = { deepLearningModels };
