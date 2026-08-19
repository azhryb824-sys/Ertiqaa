(function () {
  "use strict";
  window.__ERTIQAA_EDITION__ = "v2-full-clone";
  document.documentElement.dataset.edition = "v2";

  // Coalesce the legacy application's broad DOM observers to one callback per
  // paint. Large tables and forms otherwise trigger repeated full-page scans.
  const NativeMutationObserver = window.MutationObserver;
  if (NativeMutationObserver) {
    window.MutationObserver = class EfficientMutationObserver {
      constructor(callback) {
        this.pending=[];this.frame=0;
        this.native=new NativeMutationObserver(records=>{
          this.pending.push(...records);if(this.frame)return;
          this.frame=requestAnimationFrame(()=>{this.frame=0;const batch=this.pending.splice(0);if(batch.length)callback(batch,this)});
        });
      }
      observe(target,options){return this.native.observe(target,options)}
      disconnect(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.pending=[];return this.native.disconnect()}
      takeRecords(){return this.pending.splice(0).concat(this.native.takeRecords())}
    };
  }

  const isolatedStorageUrl = "/api/v2/legacy-storage";
  const mapStorageUrl = raw => {
    const value = String(raw || "");
    if (value === "/api/storage" || value.startsWith("/api/storage?")) return value.replace("/api/storage", isolatedStorageUrl);
    return raw;
  };

  const NativeXHR = window.XMLHttpRequest;
  if (NativeXHR) {
    const nativeOpen = NativeXHR.prototype.open;
    NativeXHR.prototype.open = function (method, url) {
      const args = Array.from(arguments);
      args[1] = mapStorageUrl(url);
      return nativeOpen.apply(this, args);
    };
  }

  // The preview service has its own storage and database boundary. Never point
  // this edition's write traffic at the production origin.
  const productionOrigin = "https://ertiqaa.onrender.com";
  const originalFetch = window.fetch && window.fetch.bind(window);
  if (originalFetch) {
    window.fetch = function (input, init) {
      const raw = typeof input === "string" ? input : input && input.url;
      if (raw) {
        const target = new URL(raw, location.href);
        if (target.origin === productionOrigin && init && !/^(GET|HEAD)$/i.test(init.method || "GET")) {
          return Promise.reject(new Error("V2_WRITE_TO_V1_BLOCKED"));
        }
      }
      if (typeof input === "string") input = mapStorageUrl(input);
      return originalFetch(input, init);
    };
  }
  if (navigator.sendBeacon) {
    const nativeBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => nativeBeacon(mapStorageUrl(url), data);
  }

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const rows = (state, key) => Array.isArray(state?.[key]) ? state[key] : [];
  const money = value => `${Number(value || 0).toLocaleString("ar-SA", {maximumFractionDigits: 2})} ر.س`;
  let advancedState = {}, advancedHealth = {};

  const table = (heads, body) => `<div class="v2-advanced-table"><table><thead><tr>${heads.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${body.length ? body.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">لا توجد بيانات</td></tr>`}</tbody></table></div>`;
  const shell = (title, subtitle, content, actions = "") => `<section class="v2-advanced-page"><header class="v2-advanced-head"><div><small>شموس المطوّر · تشغيل مؤسسي</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div>${actions}</div></header>${content}</section>`;
  const kpi = (label, value, detail) => `<article class="v2-advanced-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></article>`;
  const activeJournals = () => rows(advancedState, "misadJournalEntries").filter(item => !item.voidedAt);
  const balanced = journal => { const debit=rows(journal,"lines").filter(x=>x.side==="debit").reduce((s,x)=>s+Number(x.amount||0),0),credit=rows(journal,"lines").filter(x=>x.side==="credit").reduce((s,x)=>s+Number(x.amount||0),0); return debit>0&&Math.abs(debit-credit)<=.01; };
  const today = () => new Date().toISOString().slice(0,10);
  const option = (value,label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const field = (name,label,type="text",extra="") => `<label><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" ${extra} required></label>`;
  const select = (name,label,items) => `<label><span>${esc(label)}</span><select name="${esc(name)}" required><option value="">اختر...</option>${items.join("")}</select></label>`;
  function closeV2Dialog(){document.querySelector("#v2ActionDialog")?.remove()}
  function openV2Dialog(title,command,fields,page){
    closeV2Dialog();
    const wrap=document.createElement("div");wrap.id="v2ActionDialog";wrap.className="v2-dialog";wrap.innerHTML=`<div class="v2-dialog-card" role="dialog" aria-modal="true" aria-labelledby="v2DialogTitle"><button class="v2-dialog-close" type="button" aria-label="إغلاق">×</button><header><small>إجراء محكوم ومسجل</small><h2 id="v2DialogTitle">${esc(title)}</h2></header><form data-v2-form="${esc(command)}" data-return-page="${esc(page)}"><div class="v2-form-grid">${fields}</div><p class="v2-form-error" role="alert"></p><footer><button type="button" class="v2-cancel">إلغاء</button><button type="submit" class="v2-submit">حفظ وتنفيذ</button></footer></form></div>`;document.body.appendChild(wrap);wrap.querySelector("input,select")?.focus();
  }
  function commandDialog(kind){
    const banks=rows(advancedState,"misadBankAccounts"),orders=rows(advancedState,"v2PurchaseOrders"),receipts=rows(advancedState,"v2GoodsReceipts"),periods=rows(advancedState,"v2AccountingPeriods"),journals=activeJournals();
    if(kind==="bank-account")return openV2Dialog("إضافة حساب بنكي","bank-account.create",field("bankName","اسم البنك")+field("accountName","اسم الحساب")+field("iban","رقم IBAN السعودي","text",'dir="ltr" pattern="SA[0-9]{22}"')+field("ledgerAccountId","حساب الأستاذ","text",'value="1200"'),"v2-treasury");
    if(kind==="period-close")return openV2Dialog("إقفال فترة محاسبية","period.close",field("from","من تاريخ","date",`value="${today().slice(0,8)}01"`)+field("to","إلى تاريخ","date",`value="${today()}"`)+field("reason","سبب الإقفال"),"v2-treasury");
    if(kind==="period-reopen")return openV2Dialog("إعادة فتح فترة","period.reopen",select("periodId","الفترة المقفلة",periods.filter(x=>x.status==="closed").map(x=>option(x.id,`${x.from} — ${x.to}`)))+field("reason","سبب إعادة الفتح"),"v2-treasury");
    if(kind==="goods-receipt")return openV2Dialog("تسجيل استلام مخزني","goods-receipt.create",select("orderId","أمر الشراء المعتمد",orders.filter(x=>x.status==="معتمد").map(x=>option(x.id,`${x.id} · ${x.supplierName||"مورد"} · ${money(x.total)}`)))+field("warehouseId","معرف المستودع")+field("date","تاريخ الاستلام","date",`value="${today()}"`)+field("itemId","معرف الصنف")+field("name","اسم الصنف")+field("quantity","الكمية","number",'min="0.01" step="0.01"')+field("unitCost","تكلفة الوحدة","number",'min="0.01" step="0.01"'),"v2-procurement");
    if(kind==="invoice-match")return openV2Dialog("مطابقة فاتورة شراء","purchase-invoice.match",select("receiptId","محضر الاستلام",receipts.filter(x=>!x.invoiceId).map(x=>option(x.id,`${x.id} · ${money(x.total)}`)))+field("supplierName","اسم المورد")+field("date","تاريخ الفاتورة","date",`value="${today()}"`)+field("net","الصافي قبل الضريبة","number",'min="0.01" step="0.01"')+`<label class="v2-check"><input name="taxEnabled" type="checkbox" checked><span>تطبيق ضريبة 15%</span></label>`,"v2-procurement");
    if(kind==="bank-reconcile")return openV2Dialog("مطابقة حركة بنكية","bank-line.reconcile",field("statementId","معرف الكشف")+field("lineId","معرف الحركة")+select("journalId","القيد المحاسبي",journals.map(x=>option(x.id,`${x.id} · ${x.description||"قيد"}`))),"v2-treasury");
    if(kind==="bank-statement")return openV2Dialog("استيراد كشف بنكي","bank-statement.import",select("bankAccountId","الحساب البنكي",banks.map(x=>option(x.id,`${x.bankName} · ${x.accountName||x.iban}`)))+field("from","من تاريخ","date")+field("to","إلى تاريخ","date")+field("openingBalance","الرصيد الافتتاحي","number",'step="0.01"')+field("closingBalance","الرصيد الختامي","number",'step="0.01"')+field("lineDate","تاريخ الحركة","date")+field("reference","مرجع الحركة")+field("description","البيان")+field("amount","قيمة الحركة (+ إيداع / - سحب)","number",'step="0.01"'),"v2-treasury");
  }

  function renderAdvanced(page) {
    const content = document.querySelector("#dashboardContent");
    if (!content) return;
    const audits = rows(advancedState,"v2Audit"), approvals=rows(advancedState,"v2Approvals"), journals=activeJournals(), pending=approvals.filter(x=>x.status==="pending");
    if (page === "v2-command") {
      const cards = [
        ["الرقابة والاعتمادات","فصل المهام، الإقفال، القيود العكسية وسجل غير قابل للمحو","v2-controls","✓"],
        ["المشتريات والمخزون","أمر شراء ← اعتماد ← استلام ← مطابقة فاتورة ← ترحيل","v2-procurement","▦"],
        ["الخزينة والمطابقة","حسابات بنكية، كشوف، مطابقة القيود وإقفال الفترات","v2-treasury","▣"],
        ["التقارير المتقدمة","ميزان مراجعة، دخل، مركز مالي، أعمار ذمم وربحية العقود","v2-reports","◫"]
      ];
      content.innerHTML=shell("مركز الإصدار المطور","طبقة تشغيل ورقابة مدمجة داخل النظام الكامل — لا تستبدل أي وظيفة من النسخة الأصلية",`<div class="v2-readiness-strip"><div><b>${advancedHealth.readiness?.score ?? "—"}%</b><span>الجاهزية الآلية</span></div><div><b>${journals.length}</b><span>قيود نشطة</span></div><div><b>${pending.length}</b><span>اعتمادات معلقة</span></div><div><b>${audits.length}</b><span>عمليات مدققة</span></div></div><div class="v2-capability-grid">${cards.map(([n,d,p,i])=>`<button data-v2-page="${p}"><i>${i}</i><b>${n}</b><span>${d}</span><em>فتح المركز ←</em></button>`).join("")}</div>`);
    } else if (page === "v2-controls") {
      const bad=journals.filter(x=>!balanced(x));
      content.innerHTML=shell("الرقابة والامتثال","ضوابط محاسبية فعلية على بيانات النظام الكامل",`<div class="v2-kpi-grid">${kpi("القيود المتوازنة",journals.length-bad.length,`من ${journals.length}`)}${kpi("قيود تحتاج مراجعة",bad.length,bad.length?"يلزم إجراء":"سليم")}${kpi("طلبات الاعتماد",pending.length,"فصل المنشئ عن المعتمد")}${kpi("سجل التدقيق",audits.length,"غير قابل للحذف")}</div><div class="v2-control-grid">${[["اتزان القيود",!bad.length],["منع حذف القيود",true],["الفترات المحاسبية",true],["فصل المهام",true],["عزل بيانات الإنتاج",true],["النسخ قبل الأوامر",true]].map(([n,ok])=>`<article><i>${ok?"✓":"!"}</i><div><b>${n}</b><span>${ok?"مفعل وسليم":"يحتاج مراجعة"}</span></div></article>`).join("")}</div><h2>طلبات الاعتماد</h2>${table(["الطلب","النوع","المنشئ","الحالة","الإجراء"],approvals.map(x=>[esc(x.id),esc(x.commandType),esc(x.requestedByName||x.requestedBy||"—"),`<span class="v2-status">${esc(x.status)}</span>`,x.status==="pending"?`<button class="v2-row-action" data-v2-approve="${esc(x.id)}">اعتماد</button>`:"—"]))}<h2>آخر عمليات التدقيق</h2>${table(["التاريخ","المستخدم","الإجراء","الكيان","التفاصيل"],audits.slice(0,50).map(x=>[esc(x.at||x.createdAt||"—"),esc(x.userName||x.userId||"—"),esc(x.action),esc(x.entity),esc(x.detail||"—")]))}`);
    } else if (page === "v2-procurement") {
      const suppliers=rows(advancedState,"misadSuppliers"),orders=rows(advancedState,"v2PurchaseOrders"),receipts=rows(advancedState,"v2GoodsReceipts"),invoices=rows(advancedState,"misadPurchaseInvoices");
      content.innerHTML=shell("دورة المشتريات والمخزون","مطابقة ثلاثية بين أمر الشراء والاستلام والفاتورة قبل الترحيل",`<div class="v2-kpi-grid">${kpi("الموردون",suppliers.length,"ملفات الموردين")}${kpi("أوامر الشراء",orders.length,"طلبات واعتمادات")}${kpi("محاضر الاستلام",receipts.length,"استلام مخزني")}${kpi("فواتير المشتريات",invoices.length,money(invoices.reduce((s,x)=>s+Number(x.total||0),0)))}</div><div class="v2-toolbar"><button data-v2-command="goods-receipt">تسجيل استلام</button><button data-v2-command="invoice-match">مطابقة فاتورة</button></div><div class="v2-process"><span>طلب شراء</span><i>←</i><span>اعتماد مستقل</span><i>←</i><span>استلام مخزني</span><i>←</i><span>مطابقة الفاتورة</span><i>←</i><span>قيد المورد والمخزون</span></div><h2>أوامر الشراء</h2>${table(["الأمر","المورد","التاريخ","القيمة","الحالة","الإجراء"],orders.map(x=>[esc(x.id),esc(x.supplierName||"—"),esc(x.date||"—"),money(x.total),`<span class="v2-status">${esc(x.status)}</span>`,["مسودة","بانتظار الاعتماد"].includes(x.status)?`<button class="v2-row-action" data-v2-po-approve="${esc(x.id)}">اعتماد</button>`:"—"]))}<h2>محاضر الاستلام</h2>${table(["المحضر","أمر الشراء","المستودع","التاريخ","الحالة"],receipts.map(x=>[esc(x.id),esc(x.orderId),esc(x.warehouseId),esc(x.date),`<span class="v2-status">${esc(x.status)}</span>`]))}`);
    } else if (page === "v2-treasury") {
      const banks=rows(advancedState,"misadBankAccounts"),statements=rows(advancedState,"v2BankStatements"),periods=rows(advancedState,"v2AccountingPeriods").concat(rows(advancedState,"misadAccountingPeriods"));
      content.innerHTML=shell("الخزينة والمطابقة البنكية","ربط حركة البنك بالقيد مرة واحدة ومنع الترحيل داخل الفترات المقفلة",`<div class="v2-kpi-grid">${kpi("الحسابات البنكية",banks.length,"IBAN سعودي")}${kpi("الكشوف المستوردة",statements.length,"أرصدة متحققة")}${kpi("فترات مقفلة",periods.filter(x=>x.status==="closed").length,"منع الأثر الرجعي")}${kpi("القيود النشطة",journals.length,"دفتر الأستاذ")}</div><div class="v2-toolbar"><button data-v2-command="bank-account">إضافة حساب بنكي</button><button data-v2-command="bank-statement">استيراد كشف</button><button data-v2-command="bank-reconcile">مطابقة حركة</button><button data-v2-command="period-close">إقفال فترة</button><button data-v2-command="period-reopen" class="secondary">إعادة فتح</button></div><h2>الحسابات البنكية</h2>${table(["البنك","الحساب","IBAN","حساب الأستاذ","الحالة"],banks.map(x=>[esc(x.bankName),esc(x.accountName),`<span dir="ltr">${esc(x.iban)}</span>`,esc(x.ledgerAccountId),esc(x.status)]))}<h2>المطابقات البنكية</h2>${table(["الكشف","الفترة","الرصيد الختامي","الحالة"],statements.map(x=>[esc(x.id),`${esc(x.from)} — ${esc(x.to)}`,money(x.closingBalance),`<span class="v2-status">${esc(x.status)}</span>`]))}`);
    } else if (page === "v2-reports") {
      const reports=[["trial-balance","ميزان المراجعة","اختبار اتزان الأستاذ"],["income-statement","قائمة الدخل","الإيرادات والمصروفات"],["balance-sheet","المركز المالي","الأصول والالتزامات وحقوق الملكية"],["receivables-aging","أعمار الذمم المدينة","تحصيلات العملاء"],["payables-aging","أعمار الذمم الدائنة","التزامات الموردين"],["employee-ledger","كشف موظف","السلف والعهد والمصروفات"],["contract-profitability","ربحية عقد","الإيراد والتكلفة والهامش"]];
      content.innerHTML=shell("مركز التقارير المتقدمة","تقارير مشتقة من القيود ويمكن تتبعها إلى المستند المصدر",`<div class="v2-report-grid">${reports.map(([type,name,desc])=>`<button data-v2-report="${type}"><b>${name}</b><span>${desc}</span><em>إنشاء التقرير ←</em></button>`).join("")}</div><div id="v2ReportResult"></div>`);
    }
  }

  async function loadAdvanced(page) {
    const content=document.querySelector("#dashboardContent");
    if(content)content.innerHTML='<div class="v2-loading">جاري تحميل مركز الإصدار المطور...</div>';
    try { const [state,health]=await Promise.all([window.V2Persistence.load(),window.V2Persistence.health()]); advancedState=state.data||{}; advancedHealth=health||{}; renderAdvanced(page); }
    catch(error){ if(content)content.innerHTML=shell("تعذر تحميل المركز",error.status===401?"انتهت جلسة الدخول المشتركة. سجّل الدخول مرة واحدة لتفعيلها على الإصدار المطور.":(error.message||"تحقق من تسجيل الدخول"),error.status===401?'<a class="v2-login-action" href="/login.html?return=/v2/dashboard.html">تسجيل الدخول</a>':'<button class="btn-primary" data-v2-page="v2-command">إعادة المحاولة</button>'); }
  }

  function addAdvancedNavigation() {
    const nav=document.querySelector("#sideNav");
    if(!nav||nav.querySelector("[data-v2-page]"))return true;
    const label=document.createElement("small"); label.className="v2-nav-label"; label.textContent="مراكز الإصدار المطور"; nav.appendChild(label);
    [["v2-command","مركز التطوير","◆"],["v2-controls","الرقابة والاعتمادات","✓"],["v2-procurement","المشتريات المتقدمة","▦"],["v2-treasury","الخزينة والمطابقة","▣"],["v2-reports","التقارير المتقدمة","◫"]].forEach(([page,name,icon])=>{const button=document.createElement("button");button.type="button";button.dataset.v2Page=page;button.innerHTML=`<span>${icon}</span>${name}`;nav.appendChild(button)});return true;
  }

  addEventListener("DOMContentLoaded",()=>{
    addAdvancedNavigation();
    document.addEventListener("click",async event=>{
      const page=event.target.closest("[data-v2-page]");
      if(page){event.preventDefault();event.stopImmediatePropagation();document.querySelectorAll("#sideNav button").forEach(x=>x.classList.toggle("active",x===page));await loadAdvanced(page.dataset.v2Page);return}
      const report=event.target.closest("[data-v2-report]");
      if(report){event.preventDefault();event.stopImmediatePropagation();const type=report.dataset.v2Report;if(type==="employee-ledger")return openV2Dialog("كشف حساب موظف","report:employee-ledger",field("staffId","مرجع الموظف"),"v2-reports");if(type==="contract-profitability")return openV2Dialog("ربحية عقد","report:contract-profitability",field("contractId","مرجع العقد"),"v2-reports");const target=document.querySelector("#v2ReportResult");if(target)target.innerHTML='<div class="v2-loading">جاري إنشاء التقرير...</div>';try{const result=await window.V2Persistence.report(type,{});if(target)target.innerHTML=`<pre class="v2-report-output">${esc(JSON.stringify(result.report,null,2))}</pre>`}catch(error){if(target)target.textContent=error.message}return}
      const approval=event.target.closest("[data-v2-approve]");
      if(approval){event.preventDefault();event.stopImmediatePropagation();try{await window.V2Persistence.command("approval.approve",{approvalId:approval.dataset.v2Approve});await loadAdvanced("v2-controls")}catch(error){alert(error.message)}return}
      const poApproval=event.target.closest("[data-v2-po-approve]");
      if(poApproval){event.preventDefault();event.stopImmediatePropagation();try{await window.V2Persistence.command("purchase-order.approve",{orderId:poApproval.dataset.v2PoApprove});await loadAdvanced("v2-procurement")}catch(error){alert(error.message)}return}
      const command=event.target.closest("[data-v2-command]");
      if(command){event.preventDefault();event.stopImmediatePropagation();commandDialog(command.dataset.v2Command);return}
      if(event.target.closest(".v2-dialog-close,.v2-cancel")||event.target.id==="v2ActionDialog"){event.preventDefault();closeV2Dialog()}
    },true);
    document.addEventListener("submit",async event=>{
      const form=event.target.closest("[data-v2-form]");if(!form)return;event.preventDefault();event.stopImmediatePropagation();const submit=form.querySelector(".v2-submit"),errorBox=form.querySelector(".v2-form-error"),data=Object.fromEntries(new FormData(form));data.taxEnabled=form.elements.taxEnabled?.checked||false;["quantity","unitCost","net","openingBalance","closingBalance","amount"].forEach(key=>{if(key in data)data[key]=Number(data[key])});const command=form.dataset.v2Form;submit.disabled=true;errorBox.textContent="";
      try{
        if(command.startsWith("report:")){const type=command.slice(7),result=await window.V2Persistence.report(type,data);closeV2Dialog();const target=document.querySelector("#v2ReportResult");if(target)target.innerHTML=`<pre class="v2-report-output">${esc(JSON.stringify(result.report,null,2))}</pre>`;return}
        if(command==="goods-receipt.create")data.lines=[{itemId:data.itemId,name:data.name,quantity:data.quantity,unitCost:data.unitCost}];
        if(command==="bank-statement.import"){data.lines=[{date:data.lineDate,reference:data.reference,description:data.description,amount:data.amount}];delete data.lineDate;delete data.reference;delete data.description;delete data.amount}
        await window.V2Persistence.command(command,data);const page=form.dataset.returnPage;closeV2Dialog();await loadAdvanced(page);
      }catch(error){errorBox.textContent=error.message||"تعذر تنفيذ الإجراء";submit.disabled=false}
    },true);
    document.addEventListener("keydown",event=>{if(event.key==="Escape")closeV2Dialog()});
  });
})();
