const TASK_TYPES = {
  TEXT_ANALYSIS: "text_analysis",
  FAULT_PREDICTION: "fault_prediction",
  REPORT_ANALYSIS: "report_analysis",
  KNOWLEDGE_LOOKUP: "knowledge_lookup",
  COMPLIANCE_CHECK: "compliance_check",
  RECOMMENDATION: "recommendation",
  VOICE_SYNTHESIS: "voice_synthesis",
  IMAGE_ANALYSIS: "image_analysis",
  SENSOR_ANALYSIS: "sensor_analysis"
};

const MODEL_CAPABILITIES = {
  groq_llm: { tasks: [TASK_TYPES.TEXT_ANALYSIS, TASK_TYPES.REPORT_ANALYSIS, TASK_TYPES.RECOMMENDATION], cost: 'medium', speed: 'fast', languages: ['ar', 'en'] },
  openai_llm: { tasks: [TASK_TYPES.TEXT_ANALYSIS, TASK_TYPES.REPORT_ANALYSIS, TASK_TYPES.RECOMMENDATION], cost: 'high', speed: 'medium', languages: ['ar', 'en'] },
  rule_engine: { tasks: [TASK_TYPES.FAULT_PREDICTION, TASK_TYPES.COMPLIANCE_CHECK], cost: 'low', speed: 'instant', languages: [] },
  knowledge_base: { tasks: [TASK_TYPES.KNOWLEDGE_LOOKUP], cost: 'low', speed: 'instant', languages: [] },
  keyword_matcher: { tasks: [TASK_TYPES.REPORT_ANALYSIS, TASK_TYPES.COMPLIANCE_CHECK], cost: 'low', speed: 'instant', languages: ['ar'] },
  time_series_ml: { tasks: [TASK_TYPES.SENSOR_ANALYSIS, TASK_TYPES.FAULT_PREDICTION], cost: 'medium', speed: 'medium', languages: [] },
  deep_learning: { tasks: [TASK_TYPES.IMAGE_ANALYSIS], cost: 'high', speed: 'slow', languages: [] },
  statistical_model: { tasks: [TASK_TYPES.FAULT_PREDICTION], cost: 'low', speed: 'fast', languages: [] },
  voice_synthesizer: { tasks: [TASK_TYPES.VOICE_SYNTHESIS], cost: 'low', speed: 'instant', languages: ['ar', 'en'] }
};

const modelSelectionSystem = {
  _models: {},

  selectModel: function(taskType, context) {
    const contextLang = (context && context.language) || 'ar';
    const contextUrgency = (context && context.urgency) || 'normal';
    const contextCost = (context && context.maxCost) || 'medium';

    const candidates = Object.entries(MODEL_CAPABILITIES).filter(([id, cap]) => {
      if (!cap.tasks.includes(taskType)) return false;
      if (cap.languages.length > 0 && !cap.languages.includes(contextLang)) return false;
      return true;
    });

    if (candidates.length === 0) {
      return { modelId: null, approach: 'rule_engine', description: 'لا يوجد نموذج مناسب، استخدام المحرك القاعدي' };
    }

    let best;
    if (contextUrgency === 'urgent') {
      best = candidates.sort((a, b) => {
        const speedOrder = { instant: 0, fast: 1, medium: 2, slow: 3 };
        return speedOrder[a[1].speed] - speedOrder[b[1].speed];
      })[0];
    } else if (contextCost === 'low') {
      best = candidates.sort((a, b) => {
        const costOrder = { low: 0, medium: 1, high: 2 };
        return costOrder[a[1].cost] - costOrder[b[1].cost];
      })[0];
    } else {
      best = candidates.sort((a, b) => {
        const quality = { deep_learning: 5, openai_llm: 5, groq_llm: 4, statistical_model: 3, rule_engine: 3, knowledge_base: 3, keyword_matcher: 2, time_series_ml: 4, voice_synthesizer: 3 };
        const aScore = quality[a[0]] || 3;
        const bScore = quality[b[0]] || 3;
        return bScore - aScore;
      })[0];
    }

    const modelId = best[0];
    const cap = best[1];
    const approachMap = {
      groq_llm: 'LLM (Groq)',
      openai_llm: 'LLM (OpenAI)',
      rule_engine: 'Rule Engine',
      knowledge_base: 'Knowledge Base Query',
      keyword_matcher: 'Keyword Matching + LLM',
      time_series_ml: 'Time-Series ML',
      deep_learning: 'Deep Learning',
      statistical_model: 'Statistical + Rule-Based',
      voice_synthesizer: 'Voice Synthesizer'
    };

    return {
      modelId,
      approach: approachMap[modelId] || 'Rule Engine',
      cost: cap.cost,
      speed: cap.speed,
      description: this._getTaskDescription(taskType, modelId),
      priority: 'high'
    };
  },

  getAvailableModels: function(taskType) {
    return Object.entries(MODEL_CAPABILITIES)
      .filter(([id, cap]) => cap.tasks.includes(taskType))
      .map(([id, cap]) => ({
        id,
        cost: cap.cost,
        speed: cap.speed,
        languages: cap.languages
      }));
  },

  estimatePerformance: function(modelId, taskType) {
    const cap = MODEL_CAPABILITIES[modelId];
    if (!cap) return { error: 'Model not found' };
    if (!cap.tasks.includes(taskType)) return { error: 'Task not supported by this model' };

    const speedScore = { instant: 1.0, fast: 0.8, medium: 0.5, slow: 0.2 };
    const reliabilityScore = { deep_learning: 0.7, openai_llm: 0.85, groq_llm: 0.8, rule_engine: 0.95, knowledge_base: 0.95, keyword_matcher: 0.7, time_series_ml: 0.75, statistical_model: 0.85, voice_synthesizer: 0.9 };

    return {
      modelId,
      taskType,
      expectedLatency: cap.speed,
      reliability: reliabilityScore[modelId] || 0.7,
      costPerCall: cap.cost,
      efficiency: speedScore[cap.speed] * 100,
      recommended: true
    };
  },

  registerModel: function(modelConfig) {
    if (!modelConfig.id || !modelConfig.tasks) {
      return { success: false, error: 'Model config must include id and tasks array' };
    }
    this._models[modelConfig.id] = {
      ...MODEL_CAPABILITIES[modelConfig.id],
      ...modelConfig,
      custom: true
    };
    return { success: true, modelId: modelConfig.id };
  },

  _getTaskDescription: function(taskType, modelId) {
    const descriptions = {
      text_analysis: 'تحليل النصوص العربية باستخدام ',
      fault_prediction: 'التنبؤ بالأعطال باستخدام التحليل الإحصائي',
      report_analysis: 'تحليل التقارير الفنية باستخدام مطابقة الكلمات المفتاحية',
      knowledge_lookup: 'استعلام مباشر من قاعدة المعرفة',
      compliance_check: 'فحص التوافق مع المعايير باستخدام المحرك القاعدي',
      recommendation: 'توليد توصيات ذكية باستخدام ',
      voice_synthesis: 'توليد الصوت باستخدام المحرك الصوتي',
      image_analysis: 'تحليل الصور باستخدام التعلم العميق (جاهز للتكامل)',
      sensor_analysis: 'تحليل بيانات الحساسات باستخدام نماذج السلاسل الزمنية (جاهز للتكامل)'
    };
    let desc = descriptions[taskType] || 'معالجة باستخدام النموذج المناسب';
    if (modelId === 'groq_llm' || modelId === 'openai_llm') {
      desc += ' ' + modelId.replace('_llm', '').toUpperCase();
    }
    return desc;
  }
};

module.exports = { modelSelectionSystem, TASK_TYPES };