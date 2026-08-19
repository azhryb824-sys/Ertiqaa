"use strict";
const gates=[
  {id:"p0_security_accounting",name:"الأمن والسلامة المحاسبية",weight:45,earned:36,blocker:true,note:"المتبقي: تفعيل الوضع الصارم، اختبار الاستعادة الكامل، فحص التبعيات واختبار الاختراق"},
  {id:"p1_product",name:"اكتمال وظائف المنتج",weight:35,earned:24,blocker:false,note:"أضيفت دورات CRM والعروض والعقود والميدان والأصول وتفضيلات الإشعار؛ ما تزال الوظائف المتقدمة والتكاملات الخارجية مطلوبة"},
  {id:"zatca",name:"الفوترة الإلكترونية السعودية",weight:8,earned:2,blocker:true,note:"التحقق الأولي موجود؛ XML والتوقيع وSDK وبيئة المحاكاة غير مكتملة"},
  {id:"p2_quality",name:"الجودة التشغيلية والعرض",weight:12,earned:4,blocker:false,note:"أضيف تصدير بيانات مدقق وسياسة احتفاظ لا تحذف السجلات المالية؛ المتبقي E2E والأداء وإمكانية الوصول والمراقبة والسياسات المعتمدة ودليل التشغيل"}
];
function evaluate(runtime={}){const categories=gates.map(gate=>({...gate,earned:gate.id==="p0_security_accounting"&&runtime.strictAuth?Math.min(gate.weight,gate.earned+2):gate.earned}));if(runtime.accountingOk===false)categories.find(row=>row.id==="p0_security_accounting").earned-=8;if(runtime.backupOk===false)categories.find(row=>row.id==="p0_security_accounting").earned-=2;const score=Math.max(0,Math.min(100,Math.round(categories.reduce((sum,row)=>sum+row.earned,0)))),blockers=categories.filter(row=>row.blocker&&row.earned<row.weight).map(row=>({id:row.id,name:row.name,note:row.note}));return{score,status:score===100&&blockers.length===0?"commercial-ready":"not-commercial-ready",categories:categories.map(row=>({...row,percent:Math.round(row.earned/row.weight*100)})),blockers,method:"Weighted evidence gates: P0 45%, product 35%, ZATCA 8%, operational quality 12%"}}
module.exports={gates,evaluate};
