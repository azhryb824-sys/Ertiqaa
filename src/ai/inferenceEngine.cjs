const path = require("path");
const fs = require("fs");

const MODELS_DIR = path.join(__dirname, "..", "..", "models");
const MODEL_PATH = path.join(MODELS_DIR, "sklearn_model.json");

let _model = null;
let _vocabMap = null;

function normalize(text) {
  if (!text) return "";
  let t = text.toLowerCase();
  t = t.replace(/[إأآا]/g, "ا").replace(/[ىي]/g, "ي").replace(/[ة]/g, "ه");
  t = t.replace(/[\u064B-\u065F]/g, ""); // tashkeel
  t = t.replace(/[^\w\s\u0600-\u06FFa-zA-Z]/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

function* charNgrams(text, minN, maxN) {
  const chars = Array.from(text);
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= chars.length - n; i++) {
      yield chars.slice(i, i + n).join("");
    }
  }
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

function loadModel() {
  if (_model) return _model;
  try {
    if (!fs.existsSync(MODEL_PATH)) return null;
    _model = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
    _vocabMap = {};
    _model.vocab.forEach((w, i) => { _vocabMap[w] = i; });
    return _model;
  } catch {
    return null;
  }
}

function predictVector(tfidfVector) {
  const model = loadModel();
  if (!model) return null;

  const numClasses = model.classes.length;
  const scores = new Array(numClasses).fill(0);

  for (let c = 0; c < numClasses; c++) {
    let score = model.intercept[c];
    const coefRow = model.coef[c];
    for (let i = 0; i < tfidfVector.length; i++) {
      const [featIdx, value] = tfidfVector[i];
      score += coefRow[featIdx] * value;
    }
    scores[c] = score;
  }

  return softmax(scores);
}

function vectorize(text) {
  const model = loadModel();
  if (!model) return null;

  const norm = normalize(text);
  const ngrams = Array.from(charNgrams(norm, model.ngram_range[0], model.ngram_range[1]));

  // Count term frequencies
  const tf = {};
  for (const ng of ngrams) {
    const idx = _vocabMap[ng];
    if (idx !== undefined) {
      tf[idx] = (tf[idx] || 0) + 1;
    }
  }

  // Build TF-IDF vector (sparse: [featureIndex, value])
  const maxFeatures = model.max_features;
  const maxTf = Math.max(1, ...Object.values(tf));
  const vector = [];

  for (const [featIdx, count] of Object.entries(tf)) {
    const idx = parseInt(featIdx);
    if (idx >= maxFeatures) continue;

    // TF = 0.5 + 0.5 * count / maxTF (sublinear_tf)
    let tfValue;
    if (model.sublinear_tf) {
      tfValue = 0.5 + 0.5 * count / maxTf;
    } else {
      tfValue = count;
    }

    // IDF
    const idfValue = model.idf[idx] || 1.0;

    // TF-IDF = TF * IDF, then l2 normalize
    let value = tfValue * idfValue;
    vector.push([idx, value]);
  }

  // L2 normalize
  let sumSq = 0;
  for (const [, v] of vector) sumSq += v * v;
  const norm2 = Math.sqrt(sumSq) || 1;
  for (const item of vector) item[1] /= norm2;

  return vector;
}

const inferenceEngine = {
  ready: false,

  init: function () {
    const model = loadModel();
    this.ready = !!model;
    if (this.ready) {
      console.log(`[inferenceEngine] Model loaded: ${model.model_type} (${model.classes.length} classes, ${model.vocab.length} features, ${(model.coef[0].length * 4 / 1024).toFixed(1)}KB)`);
    } else {
      console.log("[inferenceEngine] Model not found, inference disabled");
    }
    return this.ready;
  },

  classifyIntent: function (text) {
    if (!text || !this.ready) return null;

    const vector = vectorize(text);
    if (!vector || vector.length === 0) return null;

    const probs = predictVector(vector);
    if (!probs) return null;

    const model = _model;
    const scores = model.classes.map((label, i) => ({
      label,
      score: Math.round(probs[i] * 100000) / 100000
    }));
    scores.sort((a, b) => b.score - a.score);

    return {
      intent: scores[0].label,
      score: scores[0].score,
      all: scores,
      source: "trained_model"
    };
  },

  status: function () {
    const model = loadModel();
    return {
      ready: this.ready,
      modelType: model?.model_type || null,
      classes: model?.classes || [],
      numClasses: model?.classes?.length || 0,
      accuracy: model?.accuracy || null,
      modelSizeKB: model ? Math.round(fs.statSync(MODEL_PATH).size / 1024) : 0
    };
  }
};

module.exports = { inferenceEngine };
