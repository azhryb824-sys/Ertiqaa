const base = process.env.AI_TEST_BASE_URL || "http://127.0.0.1:4173";
const readOnly = process.env.AI_TEST_READ_ONLY === "1";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const owner = {userId:`AI-TEST-OWNER-${runId}`, role:"owner", name:"مختبر الجودة", permissions:["*"], companyOwnerId:"AI-TEST-COMPANY"};
const client = {userId:`AI-TEST-CLIENT-${runId}`, role:"client", name:"عميل اختبار", permissions:[], companyOwnerId:"AI-TEST-COMPANY"};
const results = [];

async function request(name, path, options = {}, validate = () => true) {
  const started = Date.now();
  try {
    const {expectError, ...fetchOptions} = options;
    const response = await fetch(base + path, {...fetchOptions, signal:AbortSignal.timeout(Number(process.env.AI_TEST_TIMEOUT_MS||20000))});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    const valid = (response.ok || expectError) && validate(data, response);
    results.push({name, ok:valid, status:response.status, ms:Date.now()-started, detail:valid?"":String(data?.error||data?.message||text).slice(0,180)});
    return data;
  } catch (error) {
    results.push({name, ok:false, status:0, ms:Date.now()-started, detail:error.message});
    return null;
  }
}

function post(body) {
  return {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)};
}

function hasArabicAnswer(data) {
  const answer = String(data?.answer||data?.message||"");
  return answer.length >= 12 && /[\u0600-\u06ff]/.test(answer) && !/undefined|null|NaN/.test(answer);
}

async function run() {
  await request("واجهة لوحة التحكم", "/dashboard.html", {}, d => typeof d === "string" && d.includes("app.js"));
  await request("حالة الوكيل", `/api/ai/agent/status?userId=${owner.userId}&role=owner`, {}, d => d && d.knowledge && typeof d.memoryCount === "number");
  await request("ملخص الإدارة الذكية", "/api/ai/dashboard/summary?role=owner", {}, d => d && d.stats);
  await request("حالة التعلم العميق", "/api/ai/deep-learning/status", {}, d => d && typeof d === "object");
  await request("حالة HuggingFace", "/api/ai/huggingface/status", {}, d => d && typeof d === "object");
  await request("حالة NLP", "/api/ai/nlp/status", {}, d => d && typeof d === "object");
  await request("معايير السلامة", "/api/ai/knowledge/safety-standards?role=owner", {}, d => Array.isArray(d)||Array.isArray(d?.standards));
  await request("عوامل البيئة", "/api/ai/knowledge/environmental-factors?role=owner", {}, d => Array.isArray(d)||Array.isArray(d?.factors));
  await request("إجراءات الصيانة", "/api/ai/knowledge/maintenance-procedures?role=owner&component=doors", {}, d => Array.isArray(d)||Array.isArray(d?.procedures));
  await request("التنبؤ بالأعطال", "/api/ai/predict-failures?role=owner", {}, d => d && typeof d.totalReports === "number");
  await request("مقاييس التعلم", "/api/ai/learning/metrics?role=owner", {}, d => d && typeof d === "object");
  await request("أنماط التعلم", "/api/ai/learning/patterns?role=owner", {}, d => d && typeof d === "object");
  await request("البحث في معرفة المصاعد", "/api/ai/elevator-knowledge/search?q=أعطال%20باب%20المصعد&role=owner", {}, d => d && typeof d === "object");
  await request("تصنيف نية عربية", "/api/ai/nlp/classify", post({text:"أنشئ بلاغاً عاجلاً عن توقف المصعد"}), d => d && d.intent);
  await request("تشابه دلالي", "/api/ai/semantic-similarity", post({a:"تعطل باب المصعد", b:"باب المصعد لا يفتح"}), d => d && Number.isFinite(Number(d.similarity)));
  await request("بحث دلالي", "/api/ai/vector-search", post({query:"صيانة أبواب المصاعد", topK:3}), d => d && Array.isArray(d.results));

  const questions = [
    ["تحية عربية", "السلام عليكم، عرف بنفسك باختصار"],
    ["استعلام قدرات", "ما الأعمال التي تستطيع تنفيذها داخل نظام إدارة المصاعد؟"],
    ["تحليل تشغيلي", "حلل حالة العقود والزيارات والبلاغات وحدد الأولويات"],
    ["تحليل مخزون", "حلل المخزون واقترح ما يجب طلبه"],
    ["استعلام سلامة", "ما الخطوات الآمنة عند توقف باب المصعد؟"],
    ["فهم لهجة سعودية", "وش الزيارات المتأخرة عندنا ووش نسوي فيها؟"],
    ["تحمل خطأ إملائي", "ابغا تحلل البلاغات المتاخره وتعطيني الاولويه"],
    ["سؤال ناقص", "أنشئ عقد"],
    ["مدخل غير مفهوم", "!@# 12345"],
    ["محادثة عميل", "ما حالة طلباتي وما الخطوة التالية؟", client]
  ];
  for (const [name, question, user = owner] of questions) {
    await request(name, "/api/ai/admin", post({...user, question}), hasArabicAnswer);
  }

  const executions = readOnly ? [] : [
    ["معاينة عقد مكتمل", "أنشئ عقداً، النوع: صيانة، اسم العميل: أحمد محمد، اسم منشأة العميل: شركة اختبار الجودة، القيمة: 12000 ريال، مدة العقد: سنة واحدة، تاريخ البداية: 2026-07-13، التفاصيل: صيانة دورية شاملة", true],
    ["معاينة عرض سعر مكتمل", "أنشئ عرض سعر، النوع: تركيب، اسم العميل: أحمد محمد، اسم منشأة العميل: شركة اختبار الجودة، العنوان: توريد وتركيب مصعد، القيمة: 25000 ريال، التفاصيل: توريد وتركيب مصعد كامل", true],
    ["معاينة بلاغ مكتمل", "أنشئ بلاغاً، العنوان: توقف مصعد الاختبار، الوصف: المصعد لا يعمل، الأولوية: عاجل، اسم العميل: أحمد محمد، اسم منشأة العميل: شركة اختبار الجودة", true],
    ["معاينة مورد مكتمل", "أضف مورداً، الاسم: مورد اختبار الجودة، المدينة: الرياض، الجوال: 0500000000، البريد الإلكتروني: test@example.com، التصنيف: قطع غيار", true],
    ["معاينة زيارة مكتملة", "أنشئ زيارة، اسم العميل: أحمد محمد، اسم منشأة العميل: شركة اختبار الجودة، اسم المبنى: برج الجودة، الحي: العليا، موعد الزيارة: 2026-07-20 09:00، الملاحظات: فحص شامل", true],
    ["معاينة فني مكتمل", "أضف فني، اسم الفني: محمد المختبر، رقم الهوية: 2123456789، الدور: فني", true],
    ["تحليل العمليات التنفيذي", "حلل العمليات وحدد أعلى ثلاث أولويات", false],
    ["إعادة توزيع الزيارات", "أعد توزيع جميع الزيارات على الفنيين المتاحين", false]
  ];
  for (const [name, question, preview] of executions) {
    await request(name, "/api/ai/execute", post({...owner, question}), d => d && (preview
      ? d.preview===true && d.requiresApproval===true && d.openForm===true && d.executed===false && d.formType
      : (d.executed===true || d.action==="answer")) && hasArabicAnswer(d));
  }

  if (!readOnly) {
    const answerFor = {
      type:"صيانة", clientName:"أحمد محمد", clientCompanyName:"شركة اختبار الجودة",
      value:"12000", contractYears:"1", startDate:"2026-07-13", details:"صيانة دورية شاملة",
      title:"توقف المصعد", description:"المصعد لا يعمل", priority:"عاجل",
      buildingName:"برج الجودة", buildingDistrict:"العليا", scheduledAt:"2026-07-20 09:00", notes:"فحص شامل",
      name:"محمد المختبر", identity:"2123456789", role:"فني",
      phone:"0500000000", email:"test@example.com", city:"الرياض", category:"قطع غيار"
    };
    const sequences = [
      ["تسلسل عقد ناقص","أنشئ عقد"],
      ["تسلسل عرض ناقص","أنشئ عرض سعر"],
      ["تسلسل بلاغ ناقص","أنشئ بلاغ"],
      ["تسلسل زيارة ناقصة","أنشئ زيارة"],
      ["تسلسل فني ناقص","أضف فني"],
      ["تسلسل مورد ناقص","أضف مورد"]
    ];
    for (const [sequenceName, firstQuestion] of sequences) {
      let state = await request(`${sequenceName} - بدء`, "/api/ai/execute", post({...owner, question:firstQuestion}), d => d && d.executed===false && d.missingFields?.length===1);
      let steps = 0;
      while (state?.missingFields?.length && steps < 12) {
        const field = state.missingFields[0].field;
        state = await request(`${sequenceName} - استكمال ${field}`, "/api/ai/execute", post({...owner, question:answerFor[field]||"بيانات اختبار", _pendingAction:state.action, _pendingData:state.data}), d => d && (d.missingFields?.length===1 || d.preview===true));
        steps++;
      }
      results.push({name:`${sequenceName} - معاينة نهائية`, ok:Boolean(state?.preview && state?.requiresApproval && state?.openForm && !state?.executed), status:200, ms:0, detail:state?.message||"لم تصل المحادثة إلى المعاينة"});
    }
  }

  if (!readOnly) await request("منع العميل من إجراء إداري", "/api/ai/execute", {...post({...client, question:"أعد توزيع جميع الزيارات"}), expectError:true}, (d,r) => r.status===403 && /صلاحية/.test(String(d.message||d.error||"")));
  await request("رفض سؤال فارغ", "/api/ai/admin", {...post({...owner, question:""}), expectError:true}, (d, r) => r.status===400);

  const passed = results.filter(x=>x.ok).length;
  const failed = results.length-passed;
  const times = results.filter(x=>x.status).map(x=>x.ms).sort((a,b)=>a-b);
  const summary = {base,total:results.length,passed,failed,successRate:Math.round(passed/results.length*100),averageMs:Math.round(times.reduce((a,b)=>a+b,0)/Math.max(times.length,1)),p95Ms:times[Math.max(0,Math.ceil(times.length*.95)-1)]||0};
  console.log(JSON.stringify({summary, failures:results.filter(x=>!x.ok), results}, null, 2));
  process.exitCode = failed ? 1 : 0;
}

run();
