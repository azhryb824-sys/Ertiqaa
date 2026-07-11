const { vectorSearch } = require("./vectorSearch.cjs");

const continuousLearning = {
  _visits: [],
  _feedback: [],
  _patterns: [],
  _seededIds: new Set(),
  _nextPatternId: 1,

  recordVisit: async function(visit) {
    const faults = this._normalizeList(visit.faults && visit.faults.length ? visit.faults : [visit.findings, visit.issues, visit.faultCodes].flat());
    const parts = this._normalizeList(visit.parts && visit.parts.length ? visit.parts : [visit.partsReplaced, visit.partsUsed, visit.parts].flat());
    const storedVisit = {
      id: visit.id || `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      elevatorId: visit.elevatorId,
      technicianId: visit.technicianId,
      faults,
      parts,
      date: visit.date || new Date().toISOString(),
      duration: visit.duration || 0,
      resolved: visit.resolved !== undefined ? visit.resolved : !/fail|failed|unresolved|pending|متابعة|لم يتم|تعذر|فشل/i.test(String(visit.outcome || visit.status || "")),
      cost: visit.cost || 0,
      notes: visit.notes || visit.findings || visit.issues || '',
      severity: visit.severity || this._inferSeverity([visit.findings, visit.issues, visit.notes, visit.outcome].join(" ")),
      createdAt: new Date().toISOString()
    };
    this._visits.push(storedVisit);
    this._analyzeForPatterns(storedVisit);
    try { await vectorSearch.addVisit(storedVisit); } catch {}
    return storedVisit;
  },

  seedFromOperationalData: async function(data) {
    const reports = Array.isArray(data && data.reports) ? data.reports : [];
    const visits = Array.isArray(data && data.visits) ? data.visits : [];
    const tickets = Array.isArray(data && data.tickets) ? data.tickets : [];
    let added = 0;

    for (const report of reports) {
      const id = `report:${report.id || report.reportId || report.visitId || JSON.stringify(report).slice(0, 80)}`;
      if (this._seededIds.has(id) || this._visits.some(v => v.sourceId === id)) return;
      const relatedVisit = visits.find(v => String(v.id || "") === String(report.visitId || ""));
      const text = [report.description, report.workDone, report.issues, report.parts, report.recommendations, report.details, report.notes].filter(Boolean).join(" ");
      const stored = await this.recordVisit({
        id: report.id || report.visitId || id,
        elevatorId: this._elevatorId(report, relatedVisit),
        technicianId: report.technicianId || report.createdBy || relatedVisit?.technicianId || relatedVisit?.assignedTo || "",
        faults: this._extractFaults(text),
        parts: this._extractParts(report.parts || text),
        date: report.createdAt || relatedVisit?.date || relatedVisit?.scheduledAt,
        duration: Number(report.duration || relatedVisit?.duration || 0),
        resolved: !/توصية|يلزم|متابعة|بانتظار|pending|follow/i.test(text),
        cost: Number(report.cost || report.value || 0),
        notes: text,
        severity: this._inferSeverity(text)
      });
      stored.sourceId = id;
      this._seededIds.add(id);
      added++;
    }

    for (const ticket of tickets) {
      const id = `ticket:${ticket.id || JSON.stringify(ticket).slice(0, 80)}`;
      if (this._seededIds.has(id) || this._visits.some(v => v.sourceId === id)) return;
      const text = [ticket.title, ticket.description, ticket.details, ticket.notes].filter(Boolean).join(" ");
      const stored = await this.recordVisit({
        id: ticket.id || id,
        elevatorId: this._elevatorId(ticket),
        technicianId: ticket.assignedTo || "",
        faults: this._extractFaults(text),
        parts: this._extractParts(text),
        date: ticket.createdAt || ticket.updatedAt,
        resolved: /مغلق|منجز|تم|closed|done/i.test(String(ticket.status || "")),
        notes: text,
        severity: this._inferSeverity([text, ticket.priority].join(" "))
      });
      stored.sourceId = id;
      this._seededIds.add(id);
      added++;
    }

    return {added, totalVisits: this._visits.length, totalPatterns: this._patterns.length};
  },

  recordRecommendationFeedback: function(feedback) {
    const stored = {
      ...feedback,
      id: feedback.id || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: feedback.timestamp || new Date().toISOString()
    };
    this._feedback.push(stored);
    return stored;
  },

  getMetrics: function() {
    const totalVisits = this._visits.length;
    const totalFeedback = this._feedback.length;
    const resolvedVisits = this._visits.filter(v => v.resolved).length;
    const successRate = totalVisits > 0 ? (resolvedVisits / totalVisits) * 100 : 0;
    const totalCost = this._visits.reduce((sum, v) => sum + (v.cost || 0), 0);
    const avgDuration = totalVisits > 0 ? this._visits.reduce((sum, v) => sum + (v.duration || 0), 0) / totalVisits : 0;
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    this._visits.forEach(v => {
      if (severityCounts[v.severity] !== undefined) severityCounts[v.severity]++;
    });
    const validatedPatterns = this._patterns.filter(p => p.validated === true).length;
    const totalPatterns = this._patterns.length;
    const positiveFeedback = this._feedback.filter(f => f.satisfied || f.rating >= 4).length;
    const feedbackRate = totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0;

    return {
      totalVisits,
      totalFeedback,
      totalPatterns,
      validatedPatterns,
      successRate: Math.round(successRate * 100) / 100,
      averageCost: Math.round(totalCost / totalVisits * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      averageDuration: Math.round(avgDuration * 100) / 100,
      severityDistribution: severityCounts,
      positiveFeedbackRate: Math.round(feedbackRate * 100) / 100,
      uniqueElevators: new Set(this._visits.map(v => v.elevatorId)).size,
      uniqueTechnicians: new Set(this._visits.map(v => v.technicianId)).size
    };
  },

  getDiscoveredPatterns: function(validatedOnly) {
    if (validatedOnly) {
      return this._patterns.filter(p => p.validated === true);
    }
    return this._patterns;
  },

  predictIssues: async function(elevatorId) {
    const elevatorVisits = this._visits.filter(v => v.elevatorId === elevatorId);
    if (elevatorVisits.length === 0) {
      return { risk: 'unknown', message: 'No visit history for this elevator', predictions: [] };
    }

    const faultFrequency = {};
    const partFrequency = {};
    const recentVisits = elevatorVisits.slice(-10);

    recentVisits.forEach(v => {
      (v.faults || []).forEach(f => {
        faultFrequency[f] = (faultFrequency[f] || 0) + 1;
      });
      (v.parts || []).forEach(p => {
        partFrequency[p] = (partFrequency[p] || 0) + 1;
      });
    });

    const predictions = [];
    for (const [fault, count] of Object.entries(faultFrequency).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      const risk = count / recentVisits.length;
      const semanticBoost = await this._semanticBoost(fault, recentVisits);
      const adjusted = Math.min(1, risk + semanticBoost);
      predictions.push({
        type: 'fault',
        item: fault,
        probability: Math.round(adjusted * 100) / 100,
        riskLevel: adjusted > 0.5 ? 'high' : adjusted > 0.25 ? 'medium' : 'low',
        basedOn: count,
        semanticBoost: Math.round(semanticBoost * 100) / 100,
        totalVisits: recentVisits.length
      });
    }

    Object.entries(partFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([part, count]) => {
        const risk = count / recentVisits.length;
        predictions.push({
          type: 'part_replacement',
          item: part,
          probability: Math.round(risk * 100) / 100,
          riskLevel: risk > 0.5 ? 'high' : risk > 0.25 ? 'medium' : 'low',
          occurrences: count,
          totalVisits: recentVisits.length
        });
      });

    const totalFaults = predictions.filter(p => p.type === 'fault').length;
    const overallRisk = totalFaults > 0
      ? predictions.filter(p => p.type === 'fault').reduce((max, p) => Math.max(max, p.probability), 0)
      : 0;

    return {
      risk: overallRisk > 0.5 ? 'high' : overallRisk > 0.25 ? 'medium' : 'low',
      riskScore: Math.round(overallRisk * 100) / 100,
      totalVisitsAnalyzed: recentVisits.length,
      predictions
    };
  },

  _semanticBoost: async function(fault, recentVisits) {
    try {
      const similar = await vectorSearch.query(fault, 3, 0.5);
      if (similar.length) return similar.reduce((s, r) => s + r.score, 0) / similar.length * 0.15;
      const notes = recentVisits.map(v => v.notes).filter(Boolean).join(" ");
      if (notes) {
        const sim = await nlpProcessor.semanticSimilarity(fault, notes);
        if (sim !== null && sim > 0.5) return sim * 0.1;
      }
    } catch {}
    return 0;
  },

  generateLearningReport: function() {
    const metrics = this.getMetrics();
    const patterns = this._patterns.map(p => ({
      id: p.id,
      type: p.type,
      description: p.description,
      confidence: p.confidence,
      validated: p.validated,
      occurrences: p.occurrences
    }));

    const topFaults = {};
    const topParts = {};
    this._visits.forEach(v => {
      (v.faults || []).forEach(f => { topFaults[f] = (topFaults[f] || 0) + 1; });
      (v.parts || []).forEach(p => { topParts[p] = (topParts[p] || 0) + 1; });
    });

    return {
      generatedAt: new Date().toISOString(),
      metrics,
      patterns,
      topFaults: Object.entries(topFaults)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([fault, count]) => ({ fault, count })),
      topParts: Object.entries(topParts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([part, count]) => ({ part, count })),
      recentVisits: this._visits.slice(-10).map(v => ({
        id: v.id,
        elevatorId: v.elevatorId,
        date: v.date,
        faults: v.faults,
        resolved: v.resolved
      })),
      feedbackSummary: {
        total: this._feedback.length,
        positive: this._feedback.filter(f => f.satisfied || f.rating >= 4).length,
        negative: this._feedback.filter(f => f.satisfied === false || (f.rating && f.rating < 3)).length
      }
    };
  },

  validatePattern: function(patternId, isValid) {
    const pattern = this._patterns.find(p => p.id === patternId);
    if (!pattern) return false;
    pattern.validated = isValid;
    pattern.validatedAt = new Date().toISOString();
    return true;
  },

  exportLearningData: function() {
    return {
      visits: this._visits,
      feedback: this._feedback,
      patterns: this._patterns,
      nextPatternId: this._nextPatternId,
      exportedAt: new Date().toISOString()
    };
  },

  importLearningData: function(data) {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return false; }
    }
    if (!data || !Array.isArray(data.visits) || !Array.isArray(data.feedback) || !Array.isArray(data.patterns)) {
      return false;
    }
    this._visits = data.visits;
    this._feedback = data.feedback;
    this._patterns = data.patterns;
    this._seededIds = new Set(this._visits.map(v => v.sourceId).filter(Boolean));
    if (data.nextPatternId) this._nextPatternId = data.nextPatternId;
    return true;
  },

  _normalizeList: function(value) {
    return (Array.isArray(value) ? value : [value])
      .flat()
      .filter(Boolean)
      .join(",")
      .split(/[,،\n؛;]+/)
      .map(x => String(x).trim())
      .filter(x => x.length > 1)
      .slice(0, 12);
  },

  _extractFaults: function(text) {
    text = String(text || "").toLowerCase();
    const rules = [
      ["المحرك", /محرك|موتور|motor|machine/],
      ["الأبواب", /باب|ابواب|أبواب|door/],
      ["الكنترول", /كنترول|لوحة|كارتة|control|board/],
      ["الإنفرتر", /انفرتر|إنفرتر|inverter|vfd/],
      ["الحبال", /حبل|حبال|كابل|rope|cable/],
      ["الفرامل", /فرامل|brake/],
      ["حساس الباب", /حساس|sensor|safety edge/],
      ["قضبان التوجيه", /قضبان|سكة|rail|guide/],
      ["اهتزاز أو صوت", /اهتزاز|صوت|ضوضاء|noise|vibration/],
      ["توقف المصعد", /توقف|عطل|لا يعمل|stuck|shutdown|failure/]
    ];
    const found = rules.filter(([, re]) => re.test(text)).map(([name]) => name);
    return found.length ? found : this._normalizeList(text).slice(0, 3);
  },

  _extractParts: function(text) {
    text = String(text || "").toLowerCase();
    const rules = [
      ["حساس باب", /حساس|sensor/],
      ["كارتة كنترول", /كارتة|board|pcb/],
      ["إنفرتر", /انفرتر|إنفرتر|inverter|vfd/],
      ["فرامل", /فرامل|brake/],
      ["حبال", /حبال|حبل|rope/],
      ["رولر باب", /رولر|roller/],
      ["زيت وتشحيم", /زيت|تشحيم|oil|grease/]
    ];
    return rules.filter(([, re]) => re.test(text)).map(([name]) => name);
  },

  _inferSeverity: function(text) {
    text = String(text || "").toLowerCase();
    if (/محبوس|احتجاز|خطر|طارئ|critical|emergency|danger/.test(text)) return "critical";
    if (/توقف|لا يعمل|فشل|high|urgent|عاجل/.test(text)) return "high";
    if (/متابعة|توصية|medium|متوسط/.test(text)) return "medium";
    return "low";
  },

  _elevatorId: function(record, related) {
    return String(record?.elevatorId || record?.assetId || record?.contractId || record?.buildingName || related?.elevatorId || related?.contractId || "general");
  },

  findSemanticallySimilar: async function (text, threshold) {
    if (threshold === undefined) threshold = 0.6;
    const results = await vectorSearch.query(text, 3, threshold);
    if (results.length) return results;
    const visits = this._visits.slice(-50);
    let topScore = 0;
    let topVisit = null;
    for (const v of visits) {
      const jsim = this._jaccardSimilarity(text, [v.notes, ...(v.faults || [])].join(" "));
      if (jsim > topScore) { topScore = jsim; topVisit = v; }
    }
    return topScore >= threshold ? [{ score: topScore, id: topVisit.id, text: topVisit.notes }] : [];
  },

  _jaccardSimilarity: function(a, b) {
    if (!a || !b) return 0;
    const w1 = this._normalizeList(a.split(/\s+/)).filter(w => w.length > 2);
    const w2 = this._normalizeList(b.split(/\s+/)).filter(w => w.length > 2);
    if (!w1.length || !w2.length) return 0;
    const s1 = new Set(w1);
    let intersection = 0;
    w2.forEach(w => { if (s1.has(w)) intersection++; });
    const union = new Set([...w1, ...w2]).size;
    return union > 0 ? intersection / union : 0;
  },

  _analyzeForPatterns: async function(visit) {
    (visit.faults || []).forEach(fault => {
      const existing = this._patterns.find(p => p.type === 'recurring_fault' && p.fault === fault);
      if (existing) {
        existing.occurrences++;
        existing.confidence = Math.min(0.99, existing.confidence + 0.05);
        existing.lastSeen = visit.date;
      } else {
        this._patterns.push({
          id: `pat_${this._nextPatternId++}`,
          type: 'recurring_fault',
          fault,
          occurrences: 1,
          confidence: 0.3,
          validated: false,
          discoveredAt: new Date().toISOString(),
          lastSeen: visit.date,
          description: `تكرار العطل: ${fault}`
        });
      }
    });

    (visit.parts || []).forEach(part => {
      const existing = this._patterns.find(p => p.type === 'frequent_part' && p.part === part);
      if (existing) {
        existing.occurrences++;
        existing.confidence = Math.min(0.99, existing.confidence + 0.05);
        existing.lastSeen = visit.date;
      } else {
        this._patterns.push({
          id: `pat_${this._nextPatternId++}`,
          type: 'frequent_part',
          part,
          occurrences: 1,
          confidence: 0.25,
          validated: false,
          discovered: new Date().toISOString(),
          lastSeen: visit.date,
          description: `قطعة مطلوبة بشكل متكرر: ${part}`
        });
      }
    });

    const techVisits = this._visits.filter(v => v.technicianId === visit.technicianId);
    if (techVisits.length >= 3) {
      const successCount = techVisits.filter(v => v.resolved).length;
      const rate = successCount / techVisits.length;
      const existingTech = this._patterns.find(p => p.type === 'technician_performance' && p.technicianId === visit.technicianId);
      if (existingTech) {
        existingTech.successRate = rate;
        existingTech.visitCount = techVisits.length;
        existingTech.lastUpdated = new Date().toISOString();
      } else {
        this._patterns.push({
          id: `pat_${this._nextPatternId++}`,
          type: 'technician_performance',
          technicianId: visit.technicianId,
          successRate: rate,
          visitCount: techVisits.length,
          confidence: 0.5,
          validated: false,
          discovered: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          description: `معدل نجاح الفني`
        });
      }
    }
  }
};

module.exports = { continuousLearning };
