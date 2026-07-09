const explainableAI = {
  available: false,

  explainRecommendation: function(recId, context) {
    return { explanation: "Explanation system ready. Integrate with recommendationEngine for detailed justifications." };
  },

  explainPrediction: function(prediction, features) {
    return { explanation: "Feature importance analysis ready when ML models are integrated." };
  },

  generateReport: function(decisions) {
    return { report: "Explainability report module is ready for integration." };
  }
};

module.exports = { explainableAI };