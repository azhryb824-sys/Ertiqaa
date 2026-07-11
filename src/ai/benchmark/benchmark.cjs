const { nlpProcessor } = require("../nlpProcessor.cjs");
const { vectorSearch } = require("../vectorSearch.cjs");
const { deepLearningModels } = require("../deepLearningModels.cjs");
const { knowledgeBase } = require("../elevatorKnowledgeBase.cjs");

const TEST_SUITE = {
  "تصنيف النية (Intent Classification)": [
    { q: "عاوز أبلغ عن عطل في المصعد", expect: "إنشاء بلاغ", lang: "ar" },
    { q: "عندي مشكلة في المصعد محتاج مساعدة", expect: "إنشاء بلاغ", lang: "ar" },
    { q: "موتور المصعد واقف والكابينة ما تتحركش", expect: "إنشاء بلاغ", lang: "ar" },
    { q: "في عطل طاري في مصعد المبنى A", expect: "إنشاء بلاغ", lang: "ar" },
    { q: "عايز استفسر عن عقد الصيانة", expect: "استفسار عن عقد", lang: "ar" },
    { q: "موعد انتهاء العقد الحالي", expect: "استفسار عن عقد", lang: "ar" },
    { q: "محتاج أعرف تفاصيل العقد بتاعي", expect: "استفسار عن عقد", lang: "ar" },
    { q: "أرسل فني صيانة للمصعد", expect: "طلب صيانة", lang: "ar" },
    { q: "في صوت غريب من الماكينة", expect: "طلب صيانة", lang: "ar" },
    { q: "المصعد بطيء وبيهتز كتير", expect: "طلب صيانة", lang: "ar" },
    { q: "أبغى تقرير الزيارة الأخيرة", expect: "تقرير زيارة", lang: "ar" },
    { q: "أظهر الزيارات السابقة للمصعد", expect: "تقرير زيارة", lang: "ar" },
    { q: "سوي أمر تشغيل للمصعد رقم 5", expect: "أمر تشغيل", lang: "ar" },
    { q: "شغل المصعد بعد الصيانة", expect: "أمر تشغيل", lang: "ar" },
    { q: "ايش هو جدول الصيانة الدورية", expect: "استعلام عام", lang: "ar" },
  ],
  "استخراج الكيانات (Entity Extraction)": [
    { q: "عطل في المحرك والباب", expect: { faults: ["المحرك", "الأبواب"] }, lang: "ar" },
    { q: "الكنترول والانفرتر فيه مشكلة", expect: { faults: ["الكنترول", "الإنفرتر"] }, lang: "ar" },
    { q: "فرامل المصعد والحبال محتاجة تغيير", expect: { faults: ["الفرامل", "الحبال"] }, lang: "ar" },
    { q: "المصعد لا يعمل بالكامل خطير جدا", expect: { severity: "critical" }, lang: "ar" },
  ],
  "التشابه الدلالي (Semantic Similarity)": [
    { a: "توقف المصعد عن العمل", b: "المصعد لا يتحرك", expect: 0.5, lang: "ar" },
    { a: "الصيانة الدورية للباب", b: "صيانة الباب بشكل منتظم", expect: 0.4, lang: "ar" },
    { a: "تغيير زيت الماكينة", b: "تبديل زيت المحرك", expect: 0.4, lang: "ar" },
    { a: "عطل في الكنترول", b: "مشكلة في لوحة التحكم", expect: 0.3, lang: "ar" },
    { a: "هذا بلاغ عن عطل", b: "تقرير عن مشكلة في المصعد", expect: 0.3, lang: "ar" },
  ],
  "التنبؤ بالمخاطر (Risk Prediction)": [
    { visits: 10, openTickets: 3, highSeverity: 4, unresolved: 2, daysSinceMaint: 60, expect: "high", lang: "ar" },
    { visits: 15, openTickets: 0, highSeverity: 0, unresolved: 0, daysSinceMaint: 10, expect: "low", lang: "ar" },
    { visits: 5, openTickets: 5, highSeverity: 3, unresolved: 3, daysSinceMaint: 120, expect: "critical", lang: "ar" },
  ],
  "البحث الدلالي (Vector Search)": [
    { q: "عطل في المحرك", type: "fault_code", lang: "ar" },
    { q: "مشكلة في الأبواب", type: "fault_code", lang: "ar" },
    { q: "معايير السلامة", type: "safety_standard", lang: "ar" },
  ],
  "التصنيف العاطفي والأسلوب (Response Style)": [
    { role: "client", question: "عاوز أعرف طلبي وصل فين", expect: "customer_success_employee", lang: "ar" },
    { role: "technician", question: "في عطل في المحرك محتاج قطعة", expect: "technical_dispatch_employee", lang: "ar" },
    { role: "admin", question: "أظهر تقرير الأداء الشهري", expect: "operations_employee", lang: "ar" },
  ],
};

async function runBenchmark() {
  console.log("=".repeat(70));
  console.log("معيار أداء نماذج الذكاء الاصطناعي - نظام إدارة المصاعد");
  console.log("=".repeat(70));

  console.log("\n[1] تهيئة المحركات...");
  console.time("init");
  await nlpProcessor.init();
  await vectorSearch.init();
  await vectorSearch.addElevatorKnowledge(knowledgeBase);
  console.timeEnd("init");

  const results = [];

  for (const [category, tests] of Object.entries(TEST_SUITE)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`>> ${category}`);
    console.log(`${"=".repeat(60)}`);

    let passed = 0, failed = 0;

    for (const test of tests) {
      const result = await evaluate(test, category);
      if (result.passed) { passed++; } else { failed++; }
      if (result.passed) {
        console.log(`  ✓ ${result.label} (${(result.timeMs).toFixed(0)}ms)`);
      } else {
        console.log(`  ✗ ${result.label}`);
        console.log(`    Expected: ${JSON.stringify(test.expect)}`);
        console.log(`    Got: ${JSON.stringify(result.got)}`);
      }
      results.push(result);
    }

    console.log(`  نتيجة: ${passed}/${tests.length} نجاح`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("النتائج الإجمالية");
  console.log("=".repeat(70));
  const total = results.length;
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = total - totalPassed;
  const avgTime = results.reduce((s, r) => s + r.timeMs, 0) / total;
  console.log(`  المجموع: ${totalPassed}/${total} نجاح`);
  console.log(`  نسبة النجاح: ${(totalPassed / total * 100).toFixed(1)}%`);
  console.log(`  متوسط زمن الاستجابة: ${avgTime.toFixed(1)}ms`);

  const intentResults = results.filter(r => r.category === "تصنيف النية (Intent Classification)");
  const entityResults = results.filter(r => r.category === "استخراج الكيانات (Entity Extraction)");
  const simResults = results.filter(r => r.category === "التشابه الدلالي (Semantic Similarity)");
  const riskResults = results.filter(r => r.category === "التنبؤ بالمخاطر (Risk Prediction)");

  if (intentResults.length) {
    const ir = intentResults.filter(r => r.passed).length;
    console.log(`\n  تصنيف النية: ${ir}/${intentResults.length} (${(ir/intentResults.length*100).toFixed(1)}%)`);
  }
  if (entityResults.length) {
    const er = entityResults.filter(r => r.passed).length;
    console.log(`  استخراج الكيانات: ${er}/${entityResults.length} (${(er/entityResults.length*100).toFixed(1)}%)`);
  }
  if (simResults.length) {
    const avgSim = simResults.reduce((s, r) => s + (typeof r.got === 'number' ? r.got : 0), 0) / simResults.length;
    console.log(`  متوسط التشابه الدلالي: ${(avgSim*100).toFixed(1)}%`);
  }
  if (riskResults.length) {
    const rr = riskResults.filter(r => r.passed).length;
    console.log(`  التنبؤ بالمخاطر: ${rr}/${riskResults.length} (${(rr/riskResults.length*100).toFixed(1)}%)`);
  }

  console.log(`\n${"=".repeat(70)}`);
  return { total, totalPassed, totalFailed, avgTime, results };
}

async function evaluate(test, category) {
  const start = Date.now();
  let got, passed = false;
  const label = test.q || test.a || test.expect?.substring(0, 40);
  try {
    if (category === "تصنيف النية (Intent Classification)") {
      const r = await nlpProcessor.classifyIntent(test.q);
      got = r.intent;
      passed = r.intent === test.expect;
    } else if (category === "استخراج الكيانات (Entity Extraction)") {
      const r = await nlpProcessor.extractEntities(test.q);
      got = { faults: r.faults, severity: r.severity };
      if (test.expect.faults) passed = test.expect.faults.every(f => r.faults.includes(f));
      if (test.expect.severity) passed = r.severity === test.expect.severity;
    } else if (category === "التشابه الدلالي (Semantic Similarity)") {
      got = await nlpProcessor.semanticSimilarity(test.a, test.b);
      passed = got >= test.expect;
    } else if (category === "التنبؤ بالمخاطر (Risk Prediction)") {
      const input = {
        visits: Array(test.visits).fill({ id: "v1", date: new Date().toISOString(), severity: test.highSeverity > 0 ? "high" : "low", resolved: false }),
        tickets: Array(test.openTickets).fill({ id: "t1", status: "open" }),
        reports: Array(test.highSeverity).fill({ id: "r1", severity: "high" }),
        lastMaintenanceDate: new Date(Date.now() - test.daysSinceMaint * 86400000).toISOString(),
        now: new Date().toISOString()
      };
      const r = deepLearningModels.predictFailureRisk(input);
      got = r.risk;
      passed = r.risk === test.expect;
    } else if (category === "البحث الدلالي (Vector Search)") {
      const r = await vectorSearch.query(test.q, 3);
      got = r.length;
      passed = r.length > 0;
    } else if (category === "التصنيف العاطفي والأسلوب (Response Style)") {
      const r = deepLearningModels.predictResponseStyle({ user: { role: test.role }, question: test.question, intent: "answer" });
      got = r.persona;
      passed = r.persona === test.expect;
    }
  } catch (e) {
    got = e.message;
  }
  const timeMs = Date.now() - start;
  return { category, label, passed, got, timeMs };
}

async function testContinuousLearning() {
  console.log("\n[2] اختبار التعلم المستمر...");
  const { continuousLearning } = require("../continuousLearning.cjs");
  console.time("seed");
  const r = await continuousLearning.seedFromOperationalData({
    reports: [
      { id: "R1", description: "توقف المصعد - عطل في المحرك", parts: "محرك 5HP", technicianId: "T1", createdAt: new Date().toISOString(), elevatorId: "E1" },
      { id: "R2", description: "صوت غريب من الباب - يحتاج تشحيم", parts: "زيت تشحيم", technicianId: "T2", createdAt: new Date().toISOString(), elevatorId: "E2" },
      { id: "R3", description: "الكنترول لا يعمل - يحتاج استبدال الكارتة", parts: "كارتة كنترول", technicianId: "T1", createdAt: new Date().toISOString(), elevatorId: "E3" }
    ],
    tickets: [
      { id: "TK1", title: "بلاغ عطل في الانفرتر", description: "الانفرتر لا يعمل", status: "open", elevatorId: "E4", createdAt: new Date().toISOString() }
    ]
  });
  console.timeEnd("seed");
  console.log(`  تمت إضافة ${r.added} سجلاً، إجمالي: ${r.totalVisits} زيارة، ${r.totalPatterns} نمط`);

  const metrics = continuousLearning.getMetrics();
  console.log(`  المقاييس: نجاح=${metrics.successRate.toFixed(1)}%, أنماط=${metrics.totalPatterns}, مصاعد=${metrics.uniqueElevators}`);

  const issuePred = await continuousLearning.predictIssues("E1");
  console.log(`  التنبؤ بالمخاطر (E1): المخاطرة=${issuePred.risk}, النتيجة=${issuePred.riskScore}`);
  console.log(`  التوقعات: ${issuePred.predictions.length}`);

  const similar = await continuousLearning.findSemanticallySimilar("عطل في الموتور", 0.3);
  console.log(`  البحث الدلالي: ${similar.length} نتيجة مشابهة`);

  return r;
}

async function testDeepLearning() {
  console.log("\n[3] اختبار نماذج التعلم العميق...");
  await deepLearningModels.init();

  const status = await deepLearningModels.getStatus();
  const hfReady = status.huggingFace?.pipelineReady;
  console.log(`  HuggingFace Transformers: ${hfReady ? 'جاهز' : 'غير جاهز'}`);

  if (hfReady) {
    console.time("hf_classify");
    const cls = await deepLearningModels.classifyWithHF("توقف المصعد عن العمل", ["عطل", "صيانة", "استعلام", "أمر تشغيل"]);
    console.timeEnd("hf_classify");
    console.log(`  تصنيف النص بالذكاء الاصطناعي: ${cls?.label || 'N/A'} (${(cls?.score*100||0).toFixed(1)}%)`);
  }

  console.time("risk_pred");
  const risk = deepLearningModels.predictFailureRisk({
    visits: Array(8).fill({ id: "v1", date: new Date().toISOString(), severity: "high", resolved: false, faults: ["المحرك", "الكنترول"] }),
    tickets: [{ id: "t1", status: "open" }],
    lastMaintenanceDate: new Date(Date.now() - 90*86400000).toISOString()
  });
  console.timeEnd("risk_pred");
  console.log(`  التنبؤ بالمخاطر: ${risk.risk} (${(risk.score*100).toFixed(0)}%)`);

  console.time("response_style");
  const style = deepLearningModels.predictResponseStyle({
    user: { role: "client" },
    question: "عاوز أتابع طلب الصيانة بتاعي",
    memory: [{ rating: 5 }, { rating: 4 }]
  });
  console.timeEnd("response_style");
  console.log(`  أسلوب الرد: شخص=${style.persona}, نبرة=${style.tone}`);
}

async function main() {
  try {
    await runBenchmark();
    await testContinuousLearning();
    await testDeepLearning();
    console.log("\n✓ اكتمل المعيار بنجاح");
  } catch (e) {
    console.error("خطأ في المعيار:", e);
  }
}

main();
