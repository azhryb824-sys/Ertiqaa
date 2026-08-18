(function () {
  "use strict";
  window.__ERTIQAA_EDITION__ = "v2-full-clone";
  document.documentElement.dataset.edition = "v2";

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
      content.innerHTML=shell("الرقابة والامتثال","ضوابط محاسبية فعلية على بيانات النظام الكامل",`<div class="v2-kpi-grid">${kpi("القيود المتوازنة",journals.length-bad.length,`من ${journals.length}`)}${kpi("قيود تحتاج مراجعة",bad.length,bad.length?"يلزم إجراء":"سليم")}${kpi("طلبات الاعتماد",pending.length,"فصل المنشئ عن المعتمد")}${kpi("سجل التدقيق",audits.length,"غير قابل للحذف")}</div><div class="v2-control-grid">${[["اتزان القيود",!bad.length],["منع حذف القيود",true],["الفترات المحاسبية",true],["فصل المهام",true],["عزل بيانات الإنتاج",true],["النسخ قبل الأوامر",true]].map(([n,ok])=>`<article><i>${ok?"✓":"!"}</i><div><b>${n}</b><span>${ok?"مفعل وسليم":"يحتاج مراجعة"}</span></div></article>`).join("")}</div><h2>طلبات الاعتماد</h2>${table(["الطلب","النوع","المنشئ","الحالة"],approvals.map(x=>[esc(x.id),esc(x.commandType),esc(x.requestedByName||x.requestedBy||"—"),`<span class="v2-status">${esc(x.status)}</span>`]))}<h2>آخر عمليات التدقيق</h2>${table(["التاريخ","المستخدم","الإجراء","الكيان","التفاصيل"],audits.slice(0,50).map(x=>[esc(x.at||x.createdAt||"—"),esc(x.userName||x.userId||"—"),esc(x.action),esc(x.entity),esc(x.detail||"—")]))}`);
    } else if (page === "v2-procurement") {
      const suppliers=rows(advancedState,"misadSuppliers"),orders=rows(advancedState,"v2PurchaseOrders"),receipts=rows(advancedState,"v2GoodsReceipts"),invoices=rows(advancedState,"misadPurchaseInvoices");
      content.innerHTML=shell("دورة المشتريات والمخزون","مطابقة ثلاثية بين أمر الشراء والاستلام والفاتورة قبل الترحيل",`<div class="v2-kpi-grid">${kpi("الموردون",suppliers.length,"ملفات الموردين")}${kpi("أوامر الشراء",orders.length,"طلبات واعتمادات")}${kpi("محاضر الاستلام",receipts.length,"استلام مخزني")}${kpi("فواتير المشتريات",invoices.length,money(invoices.reduce((s,x)=>s+Number(x.total||0),0)))}</div><div class="v2-process"><span>طلب شراء</span><i>←</i><span>اعتماد مستقل</span><i>←</i><span>استلام مخزني</span><i>←</i><span>مطابقة الفاتورة</span><i>←</i><span>قيد المورد والمخزون</span></div><h2>أوامر الشراء</h2>${table(["الأمر","المورد","التاريخ","القيمة","الحالة"],orders.map(x=>[esc(x.id),esc(x.supplierName||"—"),esc(x.date||"—"),money(x.total),`<span class="v2-status">${esc(x.status)}</span>`]))}<h2>محاضر الاستلام</h2>${table(["المحضر","أمر الشراء","المستودع","التاريخ","الحالة"],receipts.map(x=>[esc(x.id),esc(x.orderId),esc(x.warehouseId),esc(x.date),`<span class="v2-status">${esc(x.status)}</span>`]))}`);
    } else if (page === "v2-treasury") {
      const banks=rows(advancedState,"misadBankAccounts"),statements=rows(advancedState,"v2BankStatements"),periods=rows(advancedState,"v2AccountingPeriods").concat(rows(advancedState,"misadAccountingPeriods"));
      content.innerHTML=shell("الخزينة والمطابقة البنكية","ربط حركة البنك بالقيد مرة واحدة ومنع الترحيل داخل الفترات المقفلة",`<div class="v2-kpi-grid">${kpi("الحسابات البنكية",banks.length,"IBAN سعودي")}${kpi("الكشوف المستوردة",statements.length,"أرصدة متحققة")}${kpi("فترات مقفلة",periods.filter(x=>x.status==="closed").length,"منع الأثر الرجعي")}${kpi("القيود النشطة",journals.length,"دفتر الأستاذ")}</div><div class="v2-toolbar"><button data-v2-command="bank-account">إضافة حساب بنكي</button><button data-v2-command="period-close">إقفال فترة</button></div><h2>الحسابات البنكية</h2>${table(["البنك","الحساب","IBAN","حساب الأستاذ","الحالة"],banks.map(x=>[esc(x.bankName),esc(x.accountName),`<span dir="ltr">${esc(x.iban)}</span>`,esc(x.ledgerAccountId),esc(x.status)]))}<h2>المطابقات البنكية</h2>${table(["الكشف","الفترة","الرصيد الختامي","الحالة"],statements.map(x=>[esc(x.id),`${esc(x.from)} — ${esc(x.to)}`,money(x.closingBalance),`<span class="v2-status">${esc(x.status)}</span>`]))}`);
    } else if (page === "v2-reports") {
      const reports=[["trial-balance","ميزان المراجعة","اختبار اتزان الأستاذ"],["income-statement","قائمة الدخل","الإيرادات والمصروفات"],["balance-sheet","المركز المالي","الأصول والالتزامات وحقوق الملكية"],["receivables-aging","أعمار الذمم المدينة","تحصيلات العملاء"],["payables-aging","أعمار الذمم الدائنة","التزامات الموردين"],["employee-ledger","كشف موظف","السلف والعهد والمصروفات"],["contract-profitability","ربحية عقد","الإيراد والتكلفة والهامش"]];
      content.innerHTML=shell("مركز التقارير المتقدمة","تقارير مشتقة من القيود ويمكن تتبعها إلى المستند المصدر",`<div class="v2-report-grid">${reports.map(([type,name,desc])=>`<button data-v2-report="${type}"><b>${name}</b><span>${desc}</span><em>إنشاء التقرير ←</em></button>`).join("")}</div><div id="v2ReportResult"></div>`);
    }
  }

  async function loadAdvanced(page) {
    const content=document.querySelector("#dashboardContent");
    if(content)content.innerHTML='<div class="v2-loading">جاري تحميل مركز الإصدار المطور...</div>';
    try { const [state,health]=await Promise.all([window.V2Persistence.load(),window.V2Persistence.health()]); advancedState=state.data||{}; advancedHealth=health||{}; renderAdvanced(page); }
    catch(error){ if(content)content.innerHTML=shell("تعذر تحميل المركز",error.message||"تحقق من تسجيل الدخول",'<button class="btn-primary" data-v2-page="v2-command">إعادة المحاولة</button>'); }
  }

  function addAdvancedNavigation() {
    const nav=document.querySelector("#sideNav");
    if(!nav||nav.querySelector("[data-v2-page]"))return;
    const label=document.createElement("small"); label.className="v2-nav-label"; label.textContent="مراكز الإصدار المطور"; nav.appendChild(label);
    [["v2-command","مركز التطوير","◆"],["v2-controls","الرقابة والاعتمادات","✓"],["v2-procurement","المشتريات المتقدمة","▦"],["v2-treasury","الخزينة والمطابقة","▣"],["v2-reports","التقارير المتقدمة","◫"]].forEach(([page,name,icon])=>{const button=document.createElement("button");button.type="button";button.dataset.v2Page=page;button.innerHTML=`<span>${icon}</span>${name}`;nav.appendChild(button)});
  }

  addEventListener("DOMContentLoaded",()=>{
    addAdvancedNavigation();
    new MutationObserver(addAdvancedNavigation).observe(document.querySelector("#sideNav")||document.body,{childList:true,subtree:true});
    document.addEventListener("click",async event=>{
      const page=event.target.closest("[data-v2-page]");
      if(page){event.preventDefault();event.stopImmediatePropagation();document.querySelectorAll("#sideNav button").forEach(x=>x.classList.toggle("active",x===page));await loadAdvanced(page.dataset.v2Page);return}
      const report=event.target.closest("[data-v2-report]");
      if(report){event.preventDefault();event.stopImmediatePropagation();const target=document.querySelector("#v2ReportResult");if(target)target.innerHTML='<div class="v2-loading">جاري إنشاء التقرير...</div>';try{const filters={};if(report.dataset.v2Report==="employee-ledger")filters.staffId=prompt("مرجع الموظف")||"";if(report.dataset.v2Report==="contract-profitability")filters.contractId=prompt("مرجع العقد")||"";const result=await window.V2Persistence.report(report.dataset.v2Report,filters);if(target)target.innerHTML=`<pre class="v2-report-output">${esc(JSON.stringify(result.report,null,2))}</pre>`}catch(error){if(target)target.textContent=error.message}return}
      const command=event.target.closest("[data-v2-command]");
      if(command){event.preventDefault();event.stopImmediatePropagation();const today=new Date().toISOString().slice(0,10);try{if(command.dataset.v2Command==="bank-account"){const bankName=prompt("اسم البنك"),accountName=prompt("اسم الحساب"),iban=prompt("IBAN سعودي"),ledgerAccountId=prompt("حساب الأستاذ","1200");if(bankName&&accountName&&iban)await window.V2Persistence.command("bank-account.create",{bankName,accountName,iban,ledgerAccountId})}else{const from=prompt("من تاريخ",today.slice(0,8)+"01"),to=prompt("إلى تاريخ",today),reason=prompt("سبب الإقفال");if(from&&to&&reason)await window.V2Persistence.command("period.close",{from,to,reason})}await loadAdvanced("v2-treasury")}catch(error){alert(error.message)} }
    },true);
  });
})();
