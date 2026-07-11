const { huggingFacePipeline } = require("./huggingFacePipeline.cjs");
const { inferenceEngine } = require("./inferenceEngine.cjs");

const SEVERITY_LABELS = ["low", "medium", "high", "critical"];
const INTENT_LABELS = ["إنشاء بلاغ", "استفسار عن عقد", "طلب صيانة", "تقرير زيارة", "استعلام عام", "أمر تشغيل"];

const _arabicStopWords = new Set(["في", "من", "إلى", "عن", "على", "كان", "هذا", "هذه", "ذلك", "هو", "هي", "هم", "أن", "إن", "مع", "بين", "قد", "سوف", "لم", "لن", "ما", "لا", "أو", "ثم", "لكن", "حتى", "إذا", "هناك"]);

function normalizeArabic(text) {
  if (!text) return "";
  let n = text.replace(/[إأآا]/g, "ا").replace(/[ىي]/g, "ي").replace(/[ة]/g, "ه").replace(/[\u064B-\u065F]/g, "").replace(/[^\w\s\u0600-\u06FF]/g, " ").replace(/\s+/g, " ").trim();
  return n;
}

const nlpProcessor = {
  ready: false,

  init: async function () {
    inferenceEngine.init();
    this.ready = await huggingFacePipeline.ready();
    return this.ready;
  },

  classifyIntent: async function (text) {
    if (!text) return { intent: "استعلام عام", score: 0 };
    const trained = inferenceEngine.classifyIntent(text);
    if (trained && trained.score > 0.6) {
      return { intent: trained.intent, score: trained.score, all: trained.all, source: trained.source };
    }
    const ruleResult = this._ruleIntent(text);
    try {
      if (this.ready) {
        const result = await huggingFacePipeline.classifyText(text, INTENT_LABELS);
        if (result && result.score > 0.7 && result.all && result.all.length >= 2) {
          const margin = result.score - (result.all[1]?.score || 0);
          if (margin > 0.2) {
            return { intent: result.label, score: result.score, all: result.all, source: "hf" };
          }
        }
      }
    } catch {}
    return ruleResult;
  },

  _ruleIntent: function (text) {
    const t = text.toLowerCase();
    let bestIntent = "استعلام عام";
    let bestScore = 0.3;
    const intents = [
      { name: "إنشاء بلاغ", words: ["بلغ", "بلاغ", "عطل", "طاري", "طارئ", "عاجل", "مشكلة"] },
      { name: "استفسار عن عقد", words: ["عقد", "اتفاقية", "انتهاء"] },
      { name: "طلب صيانة", words: ["صيانة", "تصليح", "إصلاح", "فني", "صوت", "بطيء", "اهتزاز"] },
      { name: "تقرير زيارة", words: ["زيارة", "تقرير", "الزيارات"] },
      { name: "أمر تشغيل", words: ["سوي", "اعمل", "أنشئ", "افتح", "شغل", "نفذ", "جدول"] },
    ];
    for (const intent of intents) {
      let hits = 0;
      for (const w of intent.words) {
        if (t.includes(w)) hits++;
      }
      if (hits > 0) {
        const s = 0.4 + (hits / intent.words.length) * 0.3 + (hits / Math.max(1, t.split(/\s+/).length)) * 0.2;
        if (s > bestScore) { bestScore = s; bestIntent = intent.name; }
      }
    }
    const n = t.replace(/[إأآا]/g, "ا");
    if (/ابلغ|بلاغ|عطل|واقف|ما.*تحركش/i.test(t) || /ابلغ|بلاغ|عطل/i.test(n)) { bestIntent = "إنشاء بلاغ"; bestScore = Math.max(bestScore, 0.6); }
    if (t.includes("عقد") && t.includes("صيانة")) bestIntent = "استفسار عن عقد";
    if (t.includes("جدول") && !t.includes("سوي") && !t.includes("اعمل")) bestIntent = "استعلام عام";
    if (t.includes("استفسر") || t.includes("استفسار")) bestIntent = "استفسار عن عقد";
    if (t.includes("اظهر") || t.includes("ابغى") || t.includes("أرني")) bestIntent = "تقرير زيارة";
    if (/شغل|تشغيل/.test(t)) bestIntent = "أمر تشغيل";
    return { intent: bestIntent, score: Math.round(Math.min(bestScore, 0.95) * 100) / 100 };
  },

  extractEntities: async function (text) {
    if (!text) return { faults: [], parts: [], brands: [], actions: [], severity: "low" };
    const normalized = normalizeArabic(text);
    const ruleResult = this._ruleEntities(normalized);

    if (this.ready) {
      try {
        const sim = await huggingFacePipeline.similarity(text, "هذا بلاغ عن عطل في المصعد");
        if (sim !== null && sim > 0.6) {
          ruleResult.severity = ruleResult.severity === "low" ? "medium" : ruleResult.severity;
        }
      } catch {}
    }

    return ruleResult;
  },

  _ruleEntities: function (text) {
    const faults = [];
    const parts = [];
    if (/محرك|موتور|motor/i.test(text)) faults.push("المحرك");
    if (/باب|أبواب|door/i.test(text)) faults.push("الأبواب");
    if (/كنترول|لوحة|كارتة|board/i.test(text)) faults.push("الكنترول");
    if (/انفرتر|إنفرتر|inverter|vfd/i.test(text)) faults.push("الإنفرتر");
    if (/حبل|حبال|كابل|rope/i.test(text)) faults.push("الحبال");
    if (/فرامل|brake/i.test(text)) faults.push("الفرامل");
    if (/حساس|sensor/i.test(text)) parts.push("حساس");
    if (/محرك|موتور/i.test(text)) parts.push("محرك");
    if (/باب/i.test(text)) parts.push("باب");
    if (/كابل|سلك/i.test(text)) parts.push("كابل");
    let severity = "low";
    if (/توقف|مقطوع|كسر|حريق|خطير|عالق/i.test(text)) severity = "critical";
    else if (/عطل|مشكلة|لا يعمل|تلف/i.test(text)) severity = "high";
    else if (/بطيء|اهتزاز|صوت/i.test(text)) severity = "medium";
    return { faults: [...new Set(faults)], parts: [...new Set(parts)], brands: [], actions: [], severity };
  },

  semanticSimilarity: async function (a, b) {
    if (this.ready) {
      try { return await huggingFacePipeline.similarity(a, b); } catch {}
    }
    return this._jaccardSimilarity(a, b);
  },

  _jaccardSimilarity: function (a, b) {
    if (!a || !b) return 0;
    const w1 = normalizeArabic(a).split(/\s+/).filter(w => w.length > 2 && !_arabicStopWords.has(w));
    const w2 = normalizeArabic(b).split(/\s+/).filter(w => w.length > 2 && !_arabicStopWords.has(w));
    if (!w1.length || !w2.length) return 0;
    const s1 = new Set(w1);
    let intersection = 0;
    w2.forEach(w => { if (s1.has(w)) intersection++; });
    const union = new Set([...w1, ...w2]).size;
    return union > 0 ? intersection / union : 0;
  },

  getEmbedding: async function (text) {
    if (this.ready) {
      try { return await huggingFacePipeline.getEmbedding(text); } catch {}
    }
    return null;
  },

  recordMemory: function () {},

  extractFaultCodes: function (text) {
    if (!text) return [];
    const matches = text.match(/[A-Z]{1,3}[-]?\d{2,4}/g) || [];
    return [...new Set(matches)];
  },

  extractMeasurements: function (text) {
    if (!text) return { numbers: [], units: [] };
    const numPattern = /\b(\d+[.,]?\d*)\s*(متر|سم|مم|كجم|جرام|فولت|أمبير|واط|هرتز|ثانية|دقيقة|ساعة|يوم|شهر|عام|٪|%|°|درجة)\b/g;
    const matches = text.match(numPattern) || [];
    const numbers = [];
    const units = [];
    matches.forEach(m => {
      const numMatch = m.match(/\d+[.,]?\d*/);
      const unitMatch = m.match(/[a-zA-Z\u0600-\u06FF٪°]+$/);
      if (numMatch && unitMatch) { numbers.push(parseFloat(numMatch[0].replace(",", "."))); units.push(unitMatch[0]); }
    });
    const bareNumbers = (text.match(/\b\d{2,4}\b/g) || []).map(n => parseInt(n, 10));
    numbers.push(...bareNumbers);
    return { numbers: [...new Set(numbers)], units: [...new Set(units)] };
  },

  normalizeArabic: normalizeArabic,

  status: async function () {
    return { ready: this.ready, backend: await huggingFacePipeline.status(), inferenceEngine: inferenceEngine.status() };
  }
};

module.exports = { nlpProcessor };
