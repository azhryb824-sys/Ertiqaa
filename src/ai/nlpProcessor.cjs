const nlpProcessor = {
  _faultCodePattern: /[A-Z]{1,3}[-]?\d{2,4}/g,
  _arabicStopWords: new Set(['في', 'من', 'إلى', 'عن', 'على', 'كان', 'هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي', 'هم', 'أن', 'إن', 'مع', 'بين', 'تحت', 'فوق', 'بعد', 'قبل', 'عند', 'قد', 'لقد', 'سوف', 'لم', 'لن', 'ما', 'لا', 'إن', 'أو', 'ثم', 'لكن', 'حتى', 'إذا', 'أو', 'هناك', 'يكون', 'كانت', 'كانوا', 'يكون', 'تكون']),

  extractEntities: function(text) {
    if (!text) return { faults: [], parts: [], brands: [], actions: [], severity: 'low' };
    const normalized = this.normalizeArabic(text);

    const elevatorBrands = ['أوتيس', 'أوتيس', 'شيندلر', 'كاين', 'ميتسوبيشي', 'تيسن', 'فوجي', 'هيتاشي', 'توشيبا', 'إل.جي', 'مودرن', 'إسكيلايت'];
    const knownFaults = ['توقف المصعد', 'باب لا يعمل', 'عطل في المحرك', 'مشكلة في الكابينة', 'توقف الطابق', 'حساسات', 'لوحة تحكم', 'ضوء طارئ', 'إنذار', 'سلك مقطوع', 'تلف في الكابل', 'مكابح', 'موتور', 'باب', 'كبينة', 'لوحة', 'حساس', 'إنارة', 'أسلاك', 'مقصورة'];
    const partsList = ['محرك', 'موتور', 'باب', 'كبينة', 'حساس', 'لوحة تحكم', 'كابل', 'سلك', 'مكبح', 'إنارة', 'أسلاك', 'قاطع', 'مفتاح', 'بطارية', 'محول', 'مكثف', 'مقاومة', 'دايود', 'ترانزستور', 'ريلاي', 'كونتاكتور'];

    const faults = [];
    const parts = [];
    const brands = [];
    const actions = [];

    let severity = 'low';

    knownFaults.forEach(f => {
      if (normalized.includes(f)) faults.push(f);
    });

    partsList.forEach(p => {
      if (normalized.includes(p)) parts.push(p);
    });

    if (normalized.includes('توقف') || normalized.includes('مقطوع') || normalized.includes('كسر') || normalized.includes('حريق') || normalized.includes('خطير')) {
      severity = 'critical';
    } else if (normalized.includes('عطل') || normalized.includes('مشكلة') || normalized.includes('لا يعمل') || normalized.includes('تلف')) {
      severity = 'high';
    } else if (normalized.includes('صيانة') || normalized.includes('فحص') || normalized.includes('مراجعة')) {
      severity = 'low';
    }

    const actionWords = ['صيانة', 'إصلاح', 'استبدال', 'تركيب', 'فحص', 'تنظيف', 'تشحيم', 'ضبط', 'تعديل', 'اختبار', 'تشغيل'];
    actionWords.forEach(a => {
      if (normalized.includes(a)) actions.push(a);
    });

    return { faults: [...new Set(faults)], parts: [...new Set(parts)], brands: [...new Set(brands)], actions: [...new Set(actions)], severity };
  },

  normalizeArabic: function(text) {
    if (!text) return '';
    let normalized = text;

    normalized = normalized.replace(/[إأآا]/g, 'ا');
    normalized = normalized.replace(/[ىي]/g, 'ي');
    normalized = normalized.replace(/[ة]/g, 'ه');
    normalized = normalized.replace(/[\u064B-\u065F]/g, '');
    normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  },

  extractFaultCodes: function(text) {
    if (!text) return [];
    const matches = text.match(this._faultCodePattern) || [];
    return [...new Set(matches)];
  },

  similarity: function(text1, text2) {
    if (!text1 || !text2) return 0;
    const t1 = this.normalizeArabic(text1.toLowerCase());
    const t2 = this.normalizeArabic(text2.toLowerCase());
    if (t1 === t2) return 1.0;

    const words1 = t1.split(/\s+/).filter(w => w.length > 2 && !this._arabicStopWords.has(w));
    const words2 = t2.split(/\s+/).filter(w => w.length > 2 && !this._arabicStopWords.has(w));

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    let intersection = 0;
    words2.forEach(w => { if (set1.has(w)) intersection++; });

    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  },

  extractParts: function(text) {
    if (!text) return [];
    const partsList = ['محرك', 'موتور', 'باب', 'كبينة', 'حساس', 'لوحة تحكم', 'كابل', 'سلك', 'مكابح', 'مكبح', 'إنارة', 'أسلاك', 'قاطع', 'مفتاح', 'بطارية', 'محول', 'مكثف', 'مقاومة', 'دايود', 'ترانزستور', 'ريلاي', 'كونتاكتور', 'فواصم', 'مؤقت', 'عداد', 'شاشة', 'أزرار', 'لمبات', 'جرس', 'هاتف'];
    const normalized = this.normalizeArabic(text);
    const found = [];
    partsList.forEach(p => {
      if (normalized.includes(p)) found.push(p);
    });
    return [...new Set(found)];
  },

  classifySeverity: function(text) {
    if (!text) return 'low';
    const normalized = this.normalizeArabic(text);

    const criticalWords = ['توقف', 'مقطوع', 'كسر', 'حريق', 'انفجار', 'انهيار', 'انقطاع', 'خطر', 'طوارئ', 'إخلاء', 'محاصر', 'عالق'];
    const highWords = ['عطل', 'مشكلة', 'لا يعمل', 'تلف', 'عطل كبير', 'شديد', 'خطير', 'صعوبة', 'فشل'];
    const mediumWords = ['بطيء', 'اهتزاز', 'صوت', 'ضعف', 'بحاجة', 'تصليح', 'تحتاج'];

    for (const w of criticalWords) {
      if (normalized.includes(w)) return 'critical';
    }
    for (const w of highWords) {
      if (normalized.includes(w)) return 'high';
    }
    for (const w of mediumWords) {
      if (normalized.includes(w)) return 'medium';
    }
    return 'low';
  },

  extractMeasurements: function(text) {
    if (!text) return { numbers: [], units: [] };
    const numPattern = /\b(\d+[.,]?\d*)\s*(متر|سم|مم|كجم|جرام|فولت|أمبير|واط|هرتز|ثانية|دقيقة|ساعة|يوم|شهر|عام|٪|%|°|درجة)\b/g;
    const matches = text.match(numPattern) || [];
    const numbers = [];
    const units = [];

    matches.forEach(m => {
      const numMatch = m.match(/\d+[.,]?\d*/);
      const unitMatch = m.match(/[a-zA-Z\u0600-\u06FF٪°]+$/);
      if (numMatch && unitMatch) {
        numbers.push(parseFloat(numMatch[0].replace(',', '.')));
        units.push(unitMatch[0]);
      }
    });

    const bareNumbers = (text.match(/\b\d{2,4}\b/g) || []).map(n => parseInt(n, 10));
    numbers.push(...bareNumbers);

    return { numbers: [...new Set(numbers)], units: [...new Set(units)] };
  }
};

module.exports = { nlpProcessor };