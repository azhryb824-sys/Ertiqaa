let pipeCache = {};
let _ready = false;

async function init() {
  if (_ready) return true;
  try {
    const { pipeline } = require("@xenova/transformers");
    pipeCache._pipeline = pipeline;
    _ready = true;
    return true;
  } catch {
    return false;
  }
}

async function getPipeline(task, model) {
  if (!_ready && !(await init())) return null;
  const key = `${task}:${model || "default"}`;
  if (pipeCache[key]) return pipeCache[key];
  try {
    const instance = await pipeCache._pipeline(task, model, { quantized: true });
    pipeCache[key] = instance;
    return instance;
  } catch {
    return null;
  }
}

const huggingFacePipeline = {
  _ready: false,

  ready: async function () { this._ready = await init(); return this._ready; },

  classifyText: async function (text, labels) {
    if (!text || !(await this.ready())) return null;
    try {
      const pipe = await getPipeline("zero-shot-classification", "Xenova/distilbert-base-uncased-mnli");
      if (!pipe) return null;
      const result = await pipe(text, labels || ["خدمة عملاء", "أمر تشغيل", "بلاغ", "استفسار", "توجيه"], { multiLabel: false });
      return { label: result.labels[0], score: result.scores[0], all: result.labels.map((l, i) => ({ label: l, score: result.scores[i] })) };
    } catch { return null; }
  },

  getEmbedding: async function (text) {
    if (!text || !(await this.ready())) return null;
    try {
      const pipe = await getPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      if (!pipe) return null;
      const result = await pipe(text, { pooling: "mean", normalize: true });
      return Array.from(result.data);
    } catch { return null; }
  },

  similarity: async function (a, b) {
    const [embA, embB] = await Promise.all([this.getEmbedding(a), this.getEmbedding(b)]);
    if (!embA || !embB) return null;
    const dot = embA.reduce((s, v, i) => s + v * embB[i], 0);
    const normA = Math.sqrt(embA.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(embB.reduce((s, v) => s + v * v, 0));
    return dot / (normA * normB);
  },

  summarize: async function (text) {
    if (!text || text.length < 20 || !(await this.ready())) return null;
    try {
      const pipe = await getPipeline("summarization", "Xenova/distilbart-cnn-6-6");
      if (!pipe) return null;
      const result = await pipe(text, { max_length: 130, min_length: 30 });
      return result[0]?.summary_text || null;
    } catch { return null; }
  },

  status: async function () {
    const ready = await this.ready();
    return {
      available: ready,
      models: ["Xenova/distilbert-base-uncased-mnli (zero-shot)", "Xenova/all-MiniLM-L6-v2 (embeddings)", "Xenova/distilbart-cnn-6-6 (summarization)"],
      loadedPipelines: Object.keys(pipeCache).filter(k => k !== "_pipeline"),
      backend: ready ? (typeof WebAssembly !== "undefined" && typeof WebAssembly.validate === "function" ? "wasm" : "cpu") : "none"
    };
  },

  free: function () { pipeCache = {}; _ready = false; this._ready = false; }
};

module.exports = { huggingFacePipeline };
