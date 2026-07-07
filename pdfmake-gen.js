(function(){
  "use strict";
  var A = window.__appBridge || {};
  var pdfmakeReady = typeof pdfMake !== 'undefined' && pdfMake.fonts && pdfMake.fonts.Cairo;

  function loadLogo(){
    return new Promise(function(resolve){
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function(){
        try {
          var c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch(e){ resolve(null); }
      };
      img.onerror = function(){ resolve(null); };
      img.src = "assets/shumoos-logo.png?v=" + Date.now();
      if (img.complete && img.naturalWidth > 0) {
        try {
          var c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch(e){ resolve(null); }
      }
    });
  }

  function safeLabel(c){
    if (A.contractLabel) return A.contractLabel(c);
    return c.clientName || c.clientId || "غير محدد";
  }

  function safeMoney(v){
    if (A.money) return A.money(v);
    return String(v || 0);
  }

  function safeFooter(){
    if (A.fixedPdfFooter) {
      var f = A.fixedPdfFooter();
      return f ? f.replace(/<[^>]+>/g, '').trim() : '';
    }
    return '';
  }

  function safeCompanyName(c){
    if (c && c.company && c.company.name) return c.company.name;
    if (A.activeOwnerCompany) {
      var co = A.activeOwnerCompany();
      if (co && co.name) return co.name;
    }
    return "شموس";
  }

  function contractPdfDefinition(c, logoData){
    var companyName = safeCompanyName(c);
    var cleanFooter = safeFooter();
    var content = [];

    // --- HEADER ---
    var headerParts = [];
    if (logoData) {
      headerParts.push({ image: logoData, width: 28, height: 28, alignment: 'left' });
    }
    headerParts.push({
      stack: [
        { text: 'نظام شموس لإدارة المصاعد', style: 'headerTitle' },
        { text: 'Shumoos Elevators Management System', style: 'headerSub' }
      ],
      alignment: 'center',
      width: '*'
    });
    content.push({ columns: headerParts, margin: [0, 0, 0, 4] });

    // Gold line
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#d79a2b' }],
      margin: [0, 0, 0, 6]
    });

    // --- CONTRACT TYPE & STATUS ---
    var statusColor = '#0d6b4f';
    if (c.status === 'بانتظار موافقة العميل' || c.status === 'بانتظار') statusColor = '#8b601f';
    if (c.status === 'ملغي' || c.status === 'ملغى') statusColor = '#b33a3a';
    if (c.status === 'منتهي' || c.status === 'منتهيا') statusColor = '#666';

    content.push({
      columns: [
        { text: 'عقد ' + (c.type || ''), bold: true, fontSize: 16, color: '#102d2c' },
        { text: c.status || '', fontSize: 10, color: '#fff', background: statusColor, alignment: 'center', margin: [0, 2, 0, 2], width: 90 }
      ],
      margin: [0, 0, 0, 6]
    });

    // --- CONTRACT NUMBER & VALUE ---
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم العقد: ' + c.id, bold: true, fontSize: 14, color: '#d79a2b', alignment: 'right' },
            { text: 'قيمة العقد', fontSize: 10, color: '#60756f', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(c.value), bold: true, fontSize: 18, color: '#d79a2b', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });

    // --- PARTY ---
    content.push({
      stack: [
        { text: 'الطرف الثاني', style: 'sectionTitle' },
        { text: safeLabel(c), bold: true, fontSize: 14, color: '#102d2c', margin: [0, 2, 0, 4] }
      ],
      margin: [0, 0, 0, 8]
    });

    // --- SUMMARY ---
    content.push({
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'بداية العقد', style: 'summaryLabel' },
            { text: 'نهاية العقد', style: 'summaryLabel' },
            { text: 'منشأة الإصدار', style: 'summaryLabel' }
          ],
          [
            { text: c.startDate || 'غير محدد', style: 'summaryValue' },
            { text: c.endDate || 'غير محدد', style: 'summaryValue' },
            { text: companyName, style: 'summaryValue' }
          ]
        ]
      },
      layout: {
        hLineWidth: function(i){ return i === 0 ? 0 : 0.5; },
        vLineWidth: function(){ return 0.5; },
        hLineColor: function(){ return '#dfe8e4'; },
        vLineColor: function(){ return '#dfe8e4'; },
        paddingLeft: function(){ return 8; },
        paddingRight: function(){ return 8; },
        paddingTop: function(){ return 6; },
        paddingBottom: function(){ return 6; },
        fillColor: function(i){ return i === 0 ? '#f0f6f3' : '#f8fbf9'; }
      },
      margin: [0, 0, 0, 10]
    });

    // --- ELEVATOR INFO ---
    var ei = c.elevatorInfo;
    if (ei && typeof ei === 'object' && typeof ei.type !== 'undefined') {
      content.push({ text: 'بيانات المصعد', style: 'sectionTitle', margin: [0, 0, 0, 4] });
      var elevData = [
        { label: 'نوع المصعد', value: ei.type },
        { label: 'السعة', value: ei.capacity },
        { label: 'السرعة', value: ei.speed },
        { label: 'عدد التوقفات', value: ei.stops },
        { label: 'رقم المصعد', value: ei.elevatorId },
        { label: 'الموقع', value: ei.location }
      ].filter(function(r){ return r.value; });

      if (elevData.length > 0) {
        var eHeader = [
          { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
          { text: 'القيمة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' }
        ];
        var eRows = elevData.map(function(r){
          return [
            { text: r.label, bold: true, fillColor: '#eef5f1', fontSize: 9 },
            { text: r.value, fontSize: 9 }
          ];
        });
        content.push({
          table: { widths: [120, '*'], body: [eHeader].concat(eRows) },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#c5d9cf'; },
            vLineColor: function(){ return '#c5d9cf'; },
            paddingLeft: function(){ return 8; },
            paddingRight: function(){ return 8; },
            paddingTop: function(){ return 5; },
            paddingBottom: function(){ return 5; }
          },
          margin: [0, 0, 0, 10]
        });
      }
    }

    // --- MAINTENANCE CHECKLIST ---
    var checklist = c.maintenanceChecklist || [];
    if (checklist.length > 0) {
      content.push({ text: 'بنود الصيانة الدورية', style: 'sectionTitle', margin: [0, 0, 0, 4] });

      var chkHeader = [
        { text: '#', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'center', width: 25 },
        { text: 'البند', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
        { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' }
      ];

      var chkRows = checklist.map(function(item, idx){
        var label = '';
        if (typeof item === 'string') label = item;
        else if (item && item.label) label = item.label;
        else if (item && item.name) label = item.name;
        else if (item && item.title) label = item.title;
        else label = '';
        var desc = '';
        if (typeof item === 'object' && item) desc = item.description || item.desc || '';
        return [
          { text: String(idx + 1), alignment: 'center', color: '#d79a2b', bold: true, fontSize: 9 },
          { text: label, fontSize: 9 },
          { text: desc, fontSize: 8, color: '#60756f' }
        ];
      });

      content.push({
        table: {
          headerRows: 1,
          widths: [25, 130, '*'],
          body: [chkHeader].concat(chkRows)
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#c5d9cf'; },
          vLineColor: function(){ return '#c5d9cf'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#f4f9f6'; }
        },
        margin: [0, 0, 0, 10]
      });
    }

    // --- BUILDINGS ---
    var buildings = c.buildings || [];
    if (buildings.length > 0) {
      content.push({ text: 'المباني والمواقع', style: 'sectionTitle', margin: [0, 0, 0, 4] });
      buildings.forEach(function(b){
        content.push({
          stack: [
            { text: b.name || 'غير محدد', bold: true, fontSize: 11, color: '#17413e', margin: [0, 0, 0, 2] },
            { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 9, color: '#60756f', margin: [0, 0, 0, 4] }
          ],
          margin: [0, 0, 0, 4]
        });
      });
      content.push({ text: '', margin: [0, 0, 0, 4] });
    }

    // --- TERMS (items) ---
    function renderTermItems(arr, title){
      if (!arr || arr.length === 0) return;
      content.push({ text: title, style: 'sectionTitle', margin: [0, 0, 0, 4] });
      arr.forEach(function(item){
        var t = '', d = '';
        if (typeof item === 'string') { t = item; }
        else if (item && item.section) { t = item.section; d = item.description || item.title || ''; }
        else if (item && item.title) { t = item.title; d = item.description || ''; }
        else if (item && item.name) { t = item.name; d = item.description || item.desc || ''; }
        else { try { t = JSON.stringify(item); } catch(e){} }
        content.push({ text: t, bold: true, fontSize: 9, color: '#17413e', margin: [0, 0, 0, 1] });
        if (d) content.push({ text: d, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 4] });
      });
      content.push({ text: '', margin: [0, 0, 0, 4] });
    }

    renderTermItems(c.items, 'البنود الافتراضية');
    renderTermItems(c.customItems, 'البنود الإضافية');

    // --- DETAILS ---
    if (c.details) {
      content.push({ text: 'نطاق العمل', style: 'sectionTitle', margin: [0, 0, 0, 4] });
      content.push({ text: c.details, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10] });
    }

    // --- SIGNATURE ---
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#c5d9cf' }],
      margin: [0, 0, 0, 6]
    });
    content.push({
      columns: [
        {
          stack: [
            { text: 'الطرف الأول', bold: true, fontSize: 10, color: '#60756f', alignment: 'center' },
            { text: companyName, fontSize: 9, color: '#102d2c', alignment: 'center', margin: [0, 2, 0, 2] },
            { text: 'التوقيع: ........................', fontSize: 8, color: '#8b9f99', alignment: 'center' }
          ]
        },
        {
          stack: [
            { text: 'الطرف الثاني', bold: true, fontSize: 10, color: '#60756f', alignment: 'center' },
            { text: safeLabel(c), fontSize: 9, color: '#102d2c', alignment: 'center', margin: [0, 2, 0, 2] },
            { text: 'التوقيع: ........................', fontSize: 8, color: '#8b9f99', alignment: 'center' }
          ]
        }
      ],
      margin: [0, 0, 0, 10]
    });

    return {
      content: content,
      styles: {
        headerTitle: { fontSize: 14, bold: true, color: '#102d2c', alignment: 'center' },
        headerSub: { fontSize: 8, color: '#6b7f7a', alignment: 'center' },
        sectionTitle: { fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 2] },
        summaryLabel: { fontSize: 8, color: '#60756f', bold: true },
        summaryValue: { fontSize: 11, color: '#102d2c', bold: true }
      },
      defaultStyle: {
        font: 'Cairo',
        fontSize: 10,
        alignment: 'right',
        lineHeight: 1.5
      },
      pageSize: 'A4',
      pageMargins: [28, 40, 28, 40],
      header: function(){
        return {
          stack: [
            { text: 'نظام شموس', fontSize: 7, color: '#8b9f99', alignment: 'center', margin: [0, 8, 0, 0] },
            { canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#d79a2b' }] }
          ]
        };
      },
      footer: function(currentPage, pageCount){
        var f = [];
        f.push({ canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#d79a2b' }], margin: [0, 0, 0, 2] });
        if (cleanFooter) f.push({ text: cleanFooter, fontSize: 7, color: '#6b7f7a', alignment: 'center', margin: [0, 0, 0, 1] });
        f.push({ text: currentPage + ' / ' + pageCount, fontSize: 7, color: '#8b9f99', alignment: 'center' });
        return { stack: f, margin: [28, 0, 28, 8] };
      }
    };
  }

  // Show a toast/console message about PDF generation status
  function pdfLog(msg){ console.log("PDFGEN", msg); if (A.toast) A.toast(msg); }

  window.generatePdf = async function(type, id){
    console.log("PDFGEN", "pdfmake attempt", type, id, "ready:", pdfmakeReady);
    if (!pdfmakeReady) {
      console.warn("PDFGEN", "pdfmake not ready — trying old method");
      if (A.downloadPdf) {
        A.downloadPdf(type, id);
      } else {
        pdfLog("PDF غير متاح حالياً");
      }
      return;
    }

    try {
      var p = A.docPayload ? A.docPayload(type, id) : null;
      if (!p || !p.title) {
        if (A.toast) A.toast('لم يتم العثور على المستند');
        return;
      }

      var logoData = await loadLogo();
      var dd = null;

      if (type === 'contract') {
        var contract;
        if (A.visibleContracts) {
          contract = A.visibleContracts().find(function(x){ return x.id === id; });
        }
        if (!contract) {
          if (A.downloadPdf) A.downloadPdf(type, id);
          return;
        }
        dd = contractPdfDefinition(contract, logoData);
      } else if (type === 'quote') {
        // For now, fall back for quotes
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      } else if (type === 'report') {
        // For now, fall back for reports
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      } else {
        // Fall back for other types
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      }

      if (!dd) {
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      }

      pdfMake.createPdf(dd).download(p.title + '.pdf');
      pdfLog('تم تحميل PDF بنجاح');

    } catch(err) {
      console.error("PDFGEN", "pdfmake error:", err);
      pdfLog('PDF — خطأ في التوليد، تجربة الطريقة القديمة');
      if (A.downloadPdf) A.downloadPdf(type, id);
    }
  };

  // Patch click handlers to intercept PDF download requests
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pdf-doc]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var type = btn.dataset.pdfDoc;
      var id = btn.dataset.pdfId;
      window.generatePdf(type, id);
    }
  }, true);

  console.log("PDFGEN", "pdfmake-gen loaded, pdfmakeReady:", pdfmakeReady, "pdfMake exists:", typeof pdfMake !== 'undefined', "fonts defined:", !!(pdfMake && pdfMake.fonts));
})();
