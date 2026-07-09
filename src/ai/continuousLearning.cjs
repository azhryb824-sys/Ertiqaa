// Continuous Learning Module
// Maintains in-memory datasets for visits, feedback, patterns, and metrics
// Analyzes visit data to discover patterns and predict issues

const continuousLearning = {
  _visits: [],
  _feedback: [],
  _patterns: [],
  _nextPatternId: 1,

  recordVisit: function(visit) {
    const storedVisit = {
      id: visit.id || `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      elevatorId: visit.elevatorId,
      technicianId: visit.technicianId,
      faults: visit.faults || [],
      parts: visit.parts || [],
      date: visit.date || new Date().toISOString(),
      duration: visit.duration || 0,
      resolved: visit.resolved !== undefined ? visit.resolved : true,
      cost: visit.cost || 0,
      notes: visit.notes || '',
      severity: visit.severity || 'low',
      createdAt: new Date().toISOString()
    };
    this._visits.push(storedVisit);
    this._analyzeForPatterns(storedVisit);
    return storedVisit;
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

  predictIssues: function(elevatorId) {
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
    Object.entries(faultFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([fault, count]) => {
        const risk = count / recentVisits.length;
        predictions.push({
          type: 'fault',
          item: fault,
          probability: Math.round(risk * 100) / 100,
          riskLevel: risk > 0.5 ? 'high' : risk > 0.25 ? 'medium' : 'low',
          basedOn: count,
          totalVisits: recentVisits.length
        });
      });

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
    if (!data || !Array.isArray(data.visits) || !Array.isArray(data.feedback) || !Array.isArray(data.patterns)) {
      return false;
    }
    this._visits = data.visits;
    this._feedback = data.feedback;
    this._patterns = data.patterns;
    if (data.nextPatternId) this._nextPatternId = data.nextPatternId;
    return true;
  },

  _analyzeForPatterns: function(visit) {
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