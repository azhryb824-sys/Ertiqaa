const base = process.env.AI_TEST_BASE_URL || "http://127.0.0.1:4173";
const timeout = Number(process.env.AI_TEST_TIMEOUT_MS || 20000);
const runId = Date.now().toString(36);
const user = {userId:`AI-CHANNEL-${runId}`,role:"owner",name:"مختبر قنوات الإنشاء",permissions:["*"],companyOwnerId:"AI-TEST-COMPANY"};
const results = [];

async function call(name, path, options, validate) {
  const started = Date.now();
  try {
    const response = await fetch(base + path, {...options, signal:AbortSignal.timeout(timeout)});
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    const ok = response.ok && Boolean(validate(data, response));
    results.push({name,ok,status:response.status,ms:Date.now()-started,detail:ok?"":String(data?.message||data?.error||raw).slice(0,220)});
    return data;
  } catch (error) {
    results.push({name,ok:false,status:0,ms:Date.now()-started,detail:error.message});
    return null;
  }
}

function post(body) {
  return {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
}

const definitions = [
  {type:"contract", action:"create_contract", commands:["أنشئ عقد","سوي عقد صيانة","أبغى عقد جديد"], fields:{type:"صيانة",clientName:"أحمد محمد",clientCompanyName:"شركة الأفق",value:"18500",contractYears:"2",startDate:"2026-08-01",details:"صيانة دورية شاملة"}},
  {type:"quote", action:"create_quote", commands:["أنشئ عرض سعر","سوي عرض تركيب","أبغى عرض سعر جديد"], fields:{type:"تركيب",clientName:"خالد علي",clientCompanyName:"مؤسسة البناء",title:"توريد وتركيب مصعد",value:"96000",details:"مصعد ركاب كامل بالمواصفات"}},
  {type:"ticket", action:"create_ticket", commands:["أنشئ بلاغ","سجل بلاغ عاجل","افتح بلاغ جديد"], fields:{title:"توقف باب المصعد",description:"الباب لا يفتح في الدور الثالث",priority:"عاجل",clientName:"سالم حسن",clientCompanyName:"شركة الواجهة"}},
  {type:"visit", action:"create_visit", commands:["أنشئ زيارة","جدول زيارة صيانة","سوي موعد زيارة"], fields:{clientName:"ناصر فهد",clientCompanyName:"مؤسسة النخبة",buildingName:"برج الواحة",buildingDistrict:"العليا",scheduledAt:"2026-08-12 10:30",notes:"فحص الأبواب ولوحة التحكم"}},
  {type:"staff", action:"add_staff", commands:["أضف فني","سجل فني جديد","أضف مهندس"], fields:{name:"ماجد عبدالله",identity:"2123456789",role:"فني"}},
  {type:"supplier", action:"create_supplier", commands:["أضف مورد","سجل مورد جديد","أبغى إضافة مورد"], fields:{name:"مورد التقنية",phone:"0501234567",email:"parts@example.com",city:"الرياض",category:"قطع غيار"}}
];

const labels = {type:"النوع",clientName:"اسم العميل",clientCompanyName:"اسم منشأة العميل",value:"القيمة",contractYears:"مدة العقد",startDate:"تاريخ البداية",details:"التفاصيل",title:"العنوان",description:"الوصف",priority:"الأولوية",buildingName:"اسم المبنى",buildingDistrict:"الحي",scheduledAt:"موعد الزيارة",notes:"الملاحظات",name:"الاسم",identity:"رقم الهوية",role:"الدور",phone:"الجوال",email:"البريد الإلكتروني",city:"المدينة",category:"التصنيف"};

function fullCommand(command, fields, separator) {
  return command + separator + Object.entries(fields).map(([key,value]) => `${labels[key]}: ${value}`).join(separator);
}

function isPreview(data, definition) {
  if (!data || data.executed !== false || data.preview !== true || data.requiresApproval !== true || data.openForm !== true || data.formType !== definition.type || data.action !== definition.action) return false;
  return Object.keys(definition.fields).every(key => data.data && data.data[key] !== undefined && String(data.data[key]).trim() !== "");
}

async function executeCase(name, text, channel, definition) {
  return call(name,"/api/ai/execute",post({...user,question:text,inputMode:channel,source:channel==="voice"?"speech-recognition-ar-SA":"keyboard"}),data=>isPreview(data,definition));
}

async function sequenceCase(name, command, channel, definition, answerStyle) {
  let state = await call(`${name} - بدء`,"/api/ai/execute",post({...user,question:command,inputMode:channel}),d=>d?.action===definition.action&&d?.missingFields?.length===1&&!d.executed);
  let steps = 0;
  while (state?.missingFields?.length && steps < 15) {
    const field = state.missingFields[0].field;
    const value = definition.fields[field];
    const answer = answerStyle === "label" ? `${labels[field]}: ${value}` : String(value);
    state = await call(`${name} - ${field}`,"/api/ai/execute",post({...user,question:answer,inputMode:channel,_pendingAction:state.action,_pendingData:state.data}),d=>d?.preview===true||d?.missingFields?.length===1);
    steps++;
  }
  const ok = isPreview(state,definition);
  results.push({name:`${name} - معاينة`,ok,status:200,ms:0,detail:ok?"":String(state?.message||"لم تصل المحادثة إلى المعاينة")});
}

async function run() {
  await call("ربط واجهة المايك","/dashboard.html",{},html=>typeof html==="string"&&html.includes("app.js"));
  await call("إعداد التعرف الصوتي العربي","/api/voice/samples",{},d=>d?.speechRecognitionLang==="ar-SA"&&d?.dialect==="Saudi Arabic");
  await call("حالة خدمة الصوت","/api/voice/test",{},d=>d?.ok===true&&d?.browserTTS===false&&d?.voiceOnly===true);

  for (const definition of definitions) {
    for (const channel of ["text","voice"]) {
      for (let i=0;i<definition.commands.length;i++) {
        const separator = i===1 ? "، " : "; ";
        await executeCase(`${channel} ${definition.type} مكتمل ${i+1}`,fullCommand(definition.commands[i],definition.fields,separator),channel,definition);
      }
      await sequenceCase(`${channel} ${definition.type} ناقص بإجابات مجردة`,definition.commands[0],channel,definition,"bare");
      await sequenceCase(`${channel} ${definition.type} ناقص بإجابات مسماة`,definition.commands[1],channel,definition,"label");
    }
  }

  const before = await call("ملخص عدم الحفظ","/api/ai/dashboard/summary?role=owner",{},d=>Boolean(d?.stats));
  results.push({name:"جميع الإنشاءات بقيت معاينات",ok:results.filter(r=>/مكتمل|معاينة/.test(r.name)).every(r=>r.ok),status:200,ms:0,detail:""});
  const passed=results.filter(x=>x.ok).length, failed=results.length-passed;
  const byChannel={text:results.filter(x=>x.name.startsWith("text ")).length,voice:results.filter(x=>x.name.startsWith("voice ")).length};
  console.log(JSON.stringify({summary:{base,total:results.length,passed,failed,successRate:Math.round(passed/results.length*100),byChannel},failures:results.filter(x=>!x.ok),results},null,2));
  process.exitCode=failed?1:0;
}

run();
