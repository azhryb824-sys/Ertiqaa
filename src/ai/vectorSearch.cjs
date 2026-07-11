const { huggingFacePipeline } = require("./huggingFacePipeline.cjs");

function _normalizeArabic(t) {
  return String(t || "").replace(/[إأآا]/g, "ا").replace(/[ىي]/g, "ي").replace(/[ة]/g, "ه").replace(/[^\w\s\u0600-\u06FF]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function _keywordOverlap(a, b) {
  const wa = _normalizeArabic(a).split(/\s+/).filter(w => w.length > 2);
  const wb = _normalizeArabic(b).split(/\s+/).filter(w => w.length > 2);
  if (!wa.length || !wb.length) return 0;
  const sa = new Set(wa);
  let inter = 0;
  wb.forEach(w => { if (sa.has(w)) inter++; });
  return inter / Math.max(wa.length, wb.length);
}

class VectorSearch {
  constructor() {
    this._docs = [];
    this._embeddings = [];
    this.ready = false;
  }

  async init() {
    this.ready = await huggingFacePipeline.ready();
    return this.ready;
  }

  async addDocument(id, text, metadata = {}) {
    if (!text) return null;
    const embedding = await huggingFacePipeline.getEmbedding(text);
    if (!embedding) return null;
    const doc = { id, text, metadata, ts: Date.now() };
    this._docs.push(doc);
    this._embeddings.push(embedding);
    if (this._docs.length > 2000) {
      this._docs = this._docs.slice(-1500);
      this._embeddings = this._embeddings.slice(-1500);
    }
    return doc;
  }

  async query(text, topK = 5, minScore = 0.25) {
    if (!this._docs.length) return [];
    const queryEmb = await huggingFacePipeline.getEmbedding(text);
    if (!queryEmb) return this._fallbackQuery(text, topK, minScore);
    const scored = this._embeddings.map((emb, i) => ({
      doc: this._docs[i],
      semanticScore: cosineSimilarity(queryEmb, emb),
      keywordScore: _keywordOverlap(text, this._docs[i].text)
    }));
    scored.forEach(s => {
      s.score = Math.max(s.semanticScore, s.keywordScore * 0.5);
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score >= minScore).slice(0, topK).map(s => ({
      id: s.doc.id,
      text: s.doc.text.slice(0, 300),
      metadata: s.doc.metadata,
      score: Math.round(s.score * 10000) / 10000,
      semanticScore: Math.round(s.semanticScore * 10000) / 10000,
      keywordScore: Math.round(s.keywordScore * 10000) / 10000,
      ts: s.doc.ts
    }));
  }

  _fallbackQuery(text, topK, minScore) {
    const scored = this._docs.map(doc => ({
      doc,
      score: _keywordOverlap(text, doc.text)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score >= minScore).slice(0, topK).map(s => ({
      id: s.doc.id,
      text: s.doc.text.slice(0, 300),
      metadata: s.doc.metadata,
      score: Math.round(s.score * 10000) / 10000,
      ts: s.doc.ts
    }));
  }

  async addElevatorKnowledge(knowledgeBase) {
    let count = 0;
    for (const [, codes] of knowledgeBase.faultCodes) {
      for (const fc of codes) {
        const text = `عطل ${fc.description}. الأسباب: ${fc.possibleCauses.join("، ")}. الإجراءات: ${fc.recommendedActions.join("، ")}`;
        if (await this.addDocument(`fc:${fc.id}`, text, { type: "fault_code", code: fc.code, panel: fc.controlPanel, severity: fc.severity })) count++;
      }
    }
    for (const std of knowledgeBase.safetyStandards) {
      const text = `معيار ${std.standardId}: ${std.title}. المتطلبات: ${std.requirements.join("، ")}`;
      if (await this.addDocument(`std:${std.id}`, text, { type: "safety_standard", category: std.category })) count++;
    }
    return count;
  }

  async addVisit(visit) {
    const text = [visit.notes, ...(visit.faults || []), ...(visit.parts || [])].filter(Boolean).join(". ");
    if (!text) return null;
    return this.addDocument(`visit:${visit.id}`, text, {
      type: "visit",
      elevatorId: visit.elevatorId,
      technicianId: visit.technicianId,
      severity: visit.severity,
      resolved: visit.resolved,
      date: visit.date
    });
  }

  async searchSimilarFaults(text, topK = 3) {
    return this.query(text, topK, 0.3);
  }

  status() {
    return { ready: this.ready, documents: this._docs.length };
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

const vectorSearch = new VectorSearch();
module.exports = { VectorSearch, vectorSearch };
