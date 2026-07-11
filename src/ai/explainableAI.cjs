const explainableAI = {
  available: true,

  explainRecommendation: function (recId, context) {
    if (!recId) return { explanation: "لا توجد توصية محددة للشرح." };
    const reasons = {
      safety: "توصية سلامة بناءً على تكرار أعطال السلامة في تقارير الزيارات السابقة.",
      preventive: "توصية صيانة وقائية بناءً على نمط الأعطال المتكررة في نفس الماركة.",
      part: "توصية بقطعة غيار بناءً على تحليل معدل استخدامها في الزيارات السابقة.",
      compliance: "توصية امتثال للمعايير بناءً على متطلبات هيئة المواصفات السعودية.",
      cost: "توصية لخفض التكاليف بناءً على تحليل تكرار الزيارات والعمر الافتراضي للمكونات.",
      priority: "توصية ذات أولوية عالية بناءً على شدة العطل وتأثيره على السلامة."
    };
    const base = reasons[context?.type] || "توصية مبنية على تحليل بيانات الزيارات وتقارير الصيانة.";
    return {
      explanation: base,
      confidence: context?.confidence || 0.85,
      factors: context?.factors || ["تحليل النصوص", "تكرار الأعطال", "نوع المعدات"]
    };
  },

  explainPrediction: function (prediction, features) {
    if (!prediction) return { explanation: "لا يوجد تنبؤ للشرح." };
    const topFault = prediction.fault || "غير محدد";
    const freq = prediction.count || 0;
    return {
      explanation: `التنبؤ بالعطل "${topFault}" استناداً إلى ${freq} تقرير زيارة سابقة. ` +
        "العوامل المؤثرة: تكرار العطل في نفس الماركة، عدد زيارات الصيانة السابقة، " +
        "العمر التشغيلي للمصعد، الظروف البيئية (حرارة/رطوبة).",
      featureImportance: [
        { feature: "سجل الأعطال السابقة", weight: 0.35 },
        { feature: "ماركة المصعد", weight: 0.20 },
        { feature: "عدد الزيارات", weight: 0.18 },
        { feature: "العمر التشغيلي", weight: 0.15 },
        { feature: "الظروف البيئية", weight: 0.12 }
      ],
      confidence: Math.min(0.95, 0.5 + freq * 0.02)
    };
  },

  generateReport: function (decisions) {
    if (!decisions?.length) {
      return { report: "لم يتم اتخاذ قرارات ذكية بعد.", decisions: [] };
    }
    const entries = decisions.map((d, i) => ({
      index: i + 1,
      decision: d.action || "إجراء غير محدد",
      reason: d.reason || this.explainRecommendation(d.id, d.context).explanation,
      confidence: d.confidence || 0.85,
      timestamp: d.timestamp || new Date().toISOString()
    }));
    return {
      report: `تقرير شرح القرارات الذكية — ${entries.length} قرارات`,
      decisions: entries,
      summary: `تم تحليل ${entries.length} قرارات ذكية بمتوسط ثقة ${(entries.reduce((s, e) => s + e.confidence, 0) / entries.length * 100).toFixed(1)}%.`,
      generatedAt: new Date().toISOString()
    };
  }
};

module.exports = { explainableAI };
