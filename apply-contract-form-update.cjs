const fs = require('node:fs');

function update(path, edits) {
  let source = fs.readFileSync(path, 'utf8');
  if (path === 'app.js') {
    source = source.replace(
      '  const maintenanceSpecKeys=new Set(["elevatorType","usage","capacity","persons","stops","age","doorType","motorManufacturer"]);',
      '  const maintenanceSpecKeys=new Set(specGroups.flatMap(group=>group.fields.map(field=>field[0])).filter(key=>!installOnlySpecKeys.includes(key)));',
    );
  }
  if (path === 'app.js' && !source.includes('const expireEndedContracts=()=>{};')) {
    source = source.replace(
      /^  const expireEndedContracts=.*$/m,
      '  // Never rewrite all contracts merely because a page was opened. Expiry is reconciled only after dates are verified.\n  const expireEndedContracts=()=>{};',
    );
  }
  if (path === 'app.js' && !source.includes('const expireStaleContracts=()=>{};')) {
    source = source.replace(
      /^  const expireStaleContracts=.*$/m,
      '  const expireStaleContracts=()=>{};',
    );
  }
  for (const [index, [before, after, optional]] of edits.entries()) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      if (optional) continue;
      throw new Error(`تعذر تطبيق تحديث العقد في ${path} (التعديل ${index + 1})`);
    }
    source = source.replace(before, () => after);
  }
  fs.writeFileSync(path, source);
}

update('app.js', [
  [
    '  const expireEndedContracts=()=>{const today=dateVal(new Date());let changed=false;contracts.forEach(c=>{if(!c.endDate||["منتهيا","ملغي","محذوف"].includes(c.status)||String(c.endDate).slice(0,10)>=today)return;c.status="منتهيا";c.expiredAt=Date.now();c.expiredAtLabel=new Date().toLocaleString("ar-SA");c.expirationReason="contract-end-date";changed=true});if(changed)write("misadContracts",contracts)};',
    '  // Never rewrite all contracts merely because a page was opened. Expiry is reconciled only after dates are verified.\n  const expireEndedContracts=()=>{};',
    true,
  ],
  [
    '  const installOnlySpecKeys=["travelHeight","shaftLength","shaftWidth","pitDepth","overhead","entrances","doorDirection","speedSystem"];',
    '  const installOnlySpecKeys=["travelHeight","shaftLength","shaftWidth","pitDepth","overhead","entrances","doorDirection","speedSystem"];\n  const maintenanceSpecKeys=new Set(specGroups.flatMap(group=>group.fields.map(field=>field[0])).filter(key=>!installOnlySpecKeys.includes(key)));',
  ],
  [
    '  const specValue=(info,key)=>info?.[key]??specDefaults[key]??"";',
    '  const specValue=(info,key)=>Object.prototype.hasOwnProperty.call(info||{},key)?(info[key]??""):(Object.keys(info||{}).length?"":(specDefaults[key]??""));',
  ],
  [
    '  const collectTechnicalSpecs=f=>{const els=typeof f?.querySelectorAll==="function"?$$("[name^=\'spec_\']",f):Array.from(f||[]).filter(el=>el.name&&el.name.startsWith("spec_"));return Object.assign({},specDefaults,...els.map(el=>({[el.name.replace(/^spec_/,"")]:el.value})))};',
    '  const collectTechnicalSpecs=f=>{const els=typeof f?.querySelectorAll==="function"?$$("[name^=\'spec_\']",f):Array.from(f||[]).filter(el=>el.name&&el.name.startsWith("spec_"));return Object.assign({},...els.map(el=>({[el.name.replace(/^spec_/,"")]:el.value})))};',
  ],
  [
    '      const tabIndex=isInstall?original:(original===0?0:(original===1?1:(original===lastIndex?2:-1)));',
    '      const tabIndex=isInstall?original:(original===0?0:(original===lastIndex?2:1));',
  ],
  [
    '      panel.style.display=!isInstall&&tabIndex===-1?"none":"";',
    '      panel.style.display="";',
  ],
  [
    '    if(!form)return fullContractForm(c);\n    syncContractTabLayout(form,c?.type==="تركيب");',
    '    if(!form)return fullContractForm(c);\n    form.querySelector(\'[name="paymentMethod"]\')?.closest("label")?.remove();\n    form.querySelector(\'[name="transferNotice"]\')?.closest("label")?.remove();\n    form.querySelector(\'[name="contractTransferNotice"]\')?.closest("fieldset")?.remove();\n    syncContractTabLayout(form,c?.type==="تركيب");',
  ],
  [
    '  contractForm=threeTabContractForm;\n\n  function maintenanceContractPartyData',
    '  contractForm=threeTabContractForm;\n\n  const updateContractTypeFieldsBase=updateContractTypeFields;\n  updateContractTypeFields=function(f){\n    updateContractTypeFieldsBase(f);\n    const isInstall=f?.type?.value==="تركيب";\n    f?.querySelectorAll(\'[name^="spec_"]\').forEach(field=>{\n      const key=String(field.name||"").replace(/^spec_/,""),label=field.closest("label");\n      if(label&&!maintenanceSpecKeys.has(key))label.style.display=isInstall?"":"none";\n    });\n  };\n\n  function maintenanceContractPartyData',
  ],
  [
    'fields=[["count","عدد المصاعد"],...(specGroups[0]?.fields||[]).map(field=>[field[0],field[1]])]',
    'fields=[["count","عدد المصاعد"],...(specGroups[0]?.fields||[]).filter(field=>maintenanceSpecKeys.has(field[0])).map(field=>[field[0],field[1]])]',
    true,
  ],
  [
    '    const normalized=Object.assign({},specDefaults,info||{}),seen=new Set(),fields=[["count","عدد المصاعد"],...(specGroups[0]?.fields||[]).filter(field=>maintenanceSpecKeys.has(field[0])).map(field=>[field[0],field[1]])];\n    const rows=fields.filter(([key])=>{if(seen.has(key))return false;seen.add(key);return true}).map(([key,label])=>[label,normalized[key]||"غير محدد"]);\n    return `<section class="contract-section" data-maintenance-contract-section="specifications"><h3>ثانياً: مواصفات المصعد</h3>${maintenanceHorizontalTables(rows,4,"maintenance-contract-specs")}</section>`;',
    '    const source=info&&typeof info==="object"?info:{},seen=new Set(),fields=[["count","عدد المصاعد"],...specGroups.flatMap(group=>(group.fields||[]).filter(field=>maintenanceSpecKeys.has(field[0])).map(field=>[field[0],field[1]]))];\n    const rows=fields.filter(([key])=>{if(seen.has(key))return false;seen.add(key);return String(source[key]??"").trim()!==""}).map(([key,label])=>[label,source[key]]);\n    const content=rows.length?maintenanceHorizontalTables(rows,4,"maintenance-contract-specs"):`<p class="form-note decision-note">مواصفات المصعد غير موجودة في بيانات هذا العقد، ويلزم استعادتها من نسخة موثوقة قبل اعتماد المستند.</p>`;\n    return `<section class="contract-section" data-maintenance-contract-section="specifications"><h3>ثانياً: مواصفات المصعد</h3>${content}</section>`;',
  ],
  [
    '  function maintenanceContractDetails(c){',
    '  function contractPaymentMethods(c){\n    const methods=financialEntries.filter(entry=>entry.contractId===c?.id&&entry.direction==="in"&&entry.paymentMethod).map(entry=>String(entry.paymentMethod).trim()).filter(Boolean);\n    return [...new Set(methods)].join("، ")||"لم تسجل دفعات بعد";\n  }\n\n  function maintenanceContractDetails(c){',
  ],
  [
    '  contractDetails=function(c){return c?.type==="صيانة"?maintenanceContractDetails(c):fullContractDetails(c)};',
    '  contractDetails=function(c){const pdfContract={...c,paymentMethod:contractPaymentMethods(c),transferNotices:[],transferNoticeData:""};return c?.type==="صيانة"?maintenanceContractDetails(pdfContract):fullContractDetails(pdfContract)};',
  ],
  [
    '    visibleContracts: visibleContracts,\n    visibleTickets:',
    '    visibleContracts: visibleContracts,\n    contractPaymentMethods: contractPaymentMethods,\n    visibleTickets:',
  ],
  [
    "  document.addEventListener('submit',e=>{const f=e.target,start=Date.now()",
    "  document.addEventListener('click',e=>{if(e.target.closest('[data-action=\"contract\"]'))setTimeout(()=>document.querySelector('form[data-form=\"contract\"] [name=\"contractTransferNotice\"]')?.closest('fieldset')?.remove(),0)});\n\n  document.addEventListener('submit',e=>{const f=e.target,start=Date.now()",
  ],
]);

update('pdfmake-gen.js', [
  [
    "    var fields = [['count', 'عدد المصاعد']];\n    (specGroups[0]?.fields || []).forEach(function(f){\n      fields.push([f[0], f[1]]);",
    "    var allowed = {elevatorType:true,usage:true,capacity:true,persons:true,stops:true,age:true,doorType:true,motorManufacturer:true};\n    var fields = [['count', 'عدد المصاعد']];\n    (specGroups[0]?.fields || []).forEach(function(f){\n      if (allowed[f[0]]) fields.push([f[0], f[1]]);",
    true,
  ],
  [
    "    var allowed = {elevatorType:true,usage:true,capacity:true,persons:true,stops:true,age:true,doorType:true,motorManufacturer:true};\n    var fields = [['count', 'عدد المصاعد']];\n    (specGroups[0]?.fields || []).forEach(function(f){\n      if (allowed[f[0]]) fields.push([f[0], f[1]]);\n    });",
    "    var excluded = {travelHeight:true,shaftLength:true,shaftWidth:true,pitDepth:true,overhead:true,entrances:true,doorDirection:true,speedSystem:true};\n    var fields = [['count', 'عدد المصاعد']];\n    specGroups.forEach(function(group){\n      (group.fields || []).forEach(function(f){\n        if (!excluded[f[0]]) fields.push([f[0], f[1]]);\n      });\n    });",
  ],
  [
    '  function maintenanceContractDataTable(c, companyName){\n    var rows = [',
    "  function maintenanceContractDataTable(c, companyName){\n    var paymentMethod = A.contractPaymentMethods ? A.contractPaymentMethods(c) : 'لم تسجل دفعات بعد';\n    var rows = [",
  ],
  [
    "      ['طريقة الدفع', c.paymentMethod || 'غير محدد'],",
    "      ['طريقة الدفع', paymentMethod],",
  ],
  [
    ").concat(c.paymentMethod?[{label:'طريقة الدفع',value:c.paymentMethod}]:[])));",
    ").concat([{label:'طريقة الدفع',value:A.contractPaymentMethods?A.contractPaymentMethods(c):'لم تسجل دفعات بعد'}])));",
  ],
  [
    '    if (!rows.length) return null;',
    "    if (!rows.length) {\n      out.push({ text: 'مواصفات المصعد غير موجودة في بيانات هذا العقد، ويلزم استعادتها من نسخة موثوقة قبل اعتماد المستند.', bold: true, fontSize: 9, color: '#9f3a38', fillColor: '#fff4f2', alignment: 'right', margin: [8, 7, 8, 7] });\n      return out;\n    }",
  ],
]);

console.log('Contract form and PDF update applied.');
