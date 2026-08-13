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

  function safeLabel(obj){
    if (A.contractLabel) {
      var r = A.contractLabel(obj);
      if (r && r !== "غير محدد") return r;
    }
    var label = obj.clientName || obj.clientId || obj.clientPhone || "غير محدد";
    return String(label).trim();
  }

  function safeMoney(v){
    var n = Number(v || 0);
    return n.toLocaleString("en-US") + ' ر.س';
  }

  function safeFooter(){
    if (A.fixedPdfFooter) {
      var f = A.fixedPdfFooter();
      return f ? f.replace(/<[^>]+>/g, '').trim() : '';
    }
    return '';
  }

  function activeCompanyName(){
    if (A.activeOwnerCompany) {
      var co = A.activeOwnerCompany();
      if (co && co.name) return co.name;
    }
    return "شموس";
  }

  function buildHeader(logoData){
    var parts = [];
    if (logoData) parts.push({ image: logoData, width: 28, height: 28, alignment: 'left' });
    parts.push({
      stack: [
        { text: 'نظام شموس لإدارة المصاعد', fontSize: 13, bold: true, color: '#1e3a5f' },
        { text: 'Shumoos Elevators Management System', fontSize: 10, color: '#64748b' }
      ],
      alignment: 'center', width: '*'
    });
    return [
      { columns: parts, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#c9a84c' }], margin: [0, 0, 0, 6] }
    ];
  }

  function appendDocumentHeader(content, logoData, opts){
    if (opts && opts.clean) return;
    if (opts && opts.letterhead) {
      return;
    }
    Array.prototype.push.apply(content, buildHeader(logoData));
  }

  function buildSignature(side1, side2, companyOnly){
    var stamp = (A.companyStamp && A.companyStamp()) || '';
    var signature = (A.companySignature && A.companySignature()) || '';
    var partyOneApproval = [];
    if (signature) partyOneApproval.push({
      stack: [
        { text: 'التوقيع', fontSize: 8, color: '#94a3b8', alignment: 'center' },
        { image: signature, fit: [150, 88], alignment: 'center', margin: [0, 3, 0, 0] }
      ],
      width: '*'
    });
    if (stamp) partyOneApproval.push({
      stack: [
        { text: 'الختم', fontSize: 8, color: '#94a3b8', alignment: 'center' },
        { image: stamp, fit: [135, 96], alignment: 'center', margin: [0, 3, 0, 0] }
      ],
      width: '*'
    });
    var sig1 = partyOneApproval.length
      ? { columns: partyOneApproval, columnGap: 3, margin: [0, 5, 0, 0] }
      : { text: 'التوقيع: ........................', fontSize: 10, color: '#94a3b8', alignment: 'center' };
    if (companyOnly) {
      return [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#94a3b8' }], margin: [0, 0, 0, 6] },
        {
          columns: [
            { text: '', width: '*' },
            {
              width: 280,
              stack: [
                { text: 'اعتماد الشركة', bold: true, fontSize: 12, color: '#64748b', alignment: 'center' },
                { text: side1, fontSize: 13, color: '#1e3a5f', alignment: 'center', margin: [0, 2, 0, 2] },
                sig1
              ]
            },
            { text: '', width: '*' }
          ],
          margin: [0, 0, 0, 10]
        }
      ];
    }
    return [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#94a3b8' }], margin: [0, 0, 0, 6] },
      {
        columns: [
          {
            stack: [
              { text: 'الطرف الثاني', bold: true, fontSize: 12, color: '#64748b', alignment: 'center' },
              { text: side2, fontSize: 13, color: '#1e3a5f', alignment: 'center', margin: [0, 2, 0, 2] },
              { text: 'التوقيع: ........................', fontSize: 10, color: '#94a3b8', alignment: 'center' }
            ]
          },
          {
            stack: [
              { text: 'الطرف الأول', bold: true, fontSize: 12, color: '#64748b', alignment: 'center' },
              { text: side1, fontSize: 13, color: '#1e3a5f', alignment: 'center', margin: [0, 2, 0, 2] },
              sig1
            ]
          }
        ],
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function summaryTable(rows){
    var header = rows.map(function(r){ return { text: r.label, bold: true, alignment: 'right', color: '#fff', fillColor: '#1e3a5f' }; });
    var values = rows.map(function(r){ return { text: r.value || 'غير محدد', bold: true, alignment: 'right', color: '#1e3a5f' }; });
    return {
      table: {
        widths: rows.map(function(){ return '*'; }),
        body: [header, values]
      },
      layout: {
        hLineWidth: function(i){ return i === 0 ? 0 : 0.35; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(){ return '#cbd5e1'; },
        vLineColor: function(){ return '#cbd5e1'; },
        paddingLeft: function(){ return 8; },
        paddingRight: function(){ return 8; },
        paddingTop: function(){ return 4; },
        paddingBottom: function(){ return 4; },
        fillColor: function(i){ return i === 0 ? null : '#f8f7f4'; }
      },
      margin: [0, 0, 0, 10]
    };
  }

  function statusBadge(status){
    if (status === 'بانتظار المراجعة والاعتماد') status = 'قيد الاعتماد';
    var color = '#2d7d6d';
    if (!status) { status = ''; color = '#6b7280'; }
    if (status.indexOf('بانتظار') >= 0) color = '#b8862d';
    if (status.indexOf('ملغي') >= 0 || status.indexOf('ملغى') >= 0) color = '#dc2626';
    if (status.indexOf('منته') >= 0) color = '#6b7280';
    if (status.indexOf('مغلق') >= 0) color = '#6b7280';
    return { text: status, fontSize: 10, color: '#fff', background: color, alignment: 'center', margin: [0, 2, 0, 2], width: 90 };
  }

  function elevatorTable(ei){
    if (!ei || typeof ei !== 'object') return null;
    var labels = {
      elevatorType:'نوع المصعد',usage:'الاستخدام',capacity:'الحمولة',persons:'عدد الأشخاص',stops:'عدد الوقفات',speed:'السرعة',travelHeight:'ارتفاع المشوار',shaftLength:'طول البئر',shaftWidth:'عرض البئر',pitDepth:'عمق الحفرة',overhead:'الارتفاع العلوي',entrances:'عدد المداخل',doorDirection:'اتجاه الأبواب',speedSystem:'نظام السرعة',doorType:'نوع الأبواب',
      motorType:'نوع المحرك',motorManufacturer:'ماركة المصعد',motorPower:'قدرة المحرك',motorSpeed:'سرعة المحرك',controller:'الكنترول',ropeManufacturer:'الشركة المصنعة للحبال',ropesCount:'عدد الحبال',ropeDiameter:'قطر الحبال',counterweight:'وزن الثقال',railManufacturer:'الشركة المصنعة للسكك',railSize:'مقاس السكك',originCountry:'بلد المنشأ',
      cabinSize:'أبعاد الكابينة',floorType:'نوع الأرضية',wallType:'نوع الجدران',ceilingType:'نوع السقف',lightingType:'نوع الإنارة',displayType:'نوع شاشة العرض',risotType:'نوع البرشوت',mirrors:'وجود مرايا',fan:'وجود مروحة',voiceAnnouncement:'وجود الإعلان الصوتي',braille:'وجود Braille',
      doorManufacturer:'الشركة المصنعة للأبواب',doorWidth:'عرض الباب',doorHeight:'ارتفاع الباب',doorOpenTime:'زمن فتح الباب',doorCloseTime:'زمن إغلاق الباب',doorLockType:'نوع أقفال الأبواب',
      bufferType:'نوع Buffer',rescueSystem:'نظام الإنقاذ',coolingSystem:'نظام التبريد',intercom:'وجود إنتركم',camera:'وجود كاميرا',fireMode:'وجود Fire Mode',
      voltage:'الجهد',frequency:'التردد',phases:'عدد الفازات',travelCableSize:'مقاس الكيبل المرن',powerConsumption:'استهلاك الكهرباء',warranty:'مدة الضمان',notes:'ملاحظات المواصفات',
      type:'نوع المصعد',elevatorId:'رقم المصعد',location:'الموقع',count:'العدد',brand:'العلامة التجارية',age:'عدد الوقفات'
    };
    var preferredKeys = Object.keys(labels);
    var seen = {};
    var data = preferredKeys.filter(function(key){
      if (seen[key] || ei[key] == null || String(ei[key]).trim() === '') return false;
      seen[key] = true;
      if (key === 'type' && ei.elevatorType) return false;
      if (key === 'brand' && ei.motorManufacturer) return false;
      if (key === 'age' && ei.stops) return false;
      return true;
    }).map(function(key){ return { label: labels[key], value: String(ei[key]) }; });
    if (!data.length) return null;
    return [
      { text: 'بيانات المصعد', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] },
      {
        table: {
          widths: [120, '*'],
          body: [[
            { text: 'البيان', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
            { text: 'القيمة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' }
          ]].concat(data.map(function(r){
            return [
              { text: r.label, bold: true, fillColor: '#e8e6e1', fontSize: 10, alignment: 'right', color: '#1e3a5f' },
              { text: r.value, fontSize: 10, alignment: 'right', color: '#334155' }
            ];
          }))
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#94a3b8'; },
          vLineColor: function(){ return '#94a3b8'; },
          paddingLeft: function(){ return 8; },
          paddingRight: function(){ return 8; },
          paddingTop: function(){ return 5; },
          paddingBottom: function(){ return 5; },
          fillColor: function(i){ return i < 2 ? null : (i % 2 === 0 ? null : '#f1f0ec'); }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function maintenanceTable(checklist, options){
    if (!checklist || !checklist.length) return null;
    var items = [];
    checklist.forEach(function(item, idx){
      var label = '';
      if (typeof item === 'string') label = item;
      else if (item && item.label) label = item.label;
      else if (item && item.name) label = item.name;
      else if (item && item.title) label = item.title;
      var section = (typeof item === 'object' && item) ? (item.section || 'بنود الصيانة') : 'بنود الصيانة';
      var status = (typeof item === 'object' && item) ? (item.status || 'مطلوب') : 'مطلوب';
      var checked = !!(typeof item === 'object' && item && item.checked);
      var note = (typeof item === 'object' && item) ? (item.note || item.description || item.desc || '') : '';
      items.push([
        { text: section, fontSize: 9, alignment: 'right', color: '#64748b' },
        { text: label, fontSize: 10, alignment: 'right', color: '#334155' },
        { text: (checked ? '✓ ' : '□ ') + status, fontSize: 9, bold: true, color: checked ? '#2d7d6d' : '#64748b', alignment: 'center' },
        { text: note, fontSize: 9, color: '#64748b', alignment: 'right' }
      ]);
    });
    var title = options && options.compactTitle
      ? { text: 'بنود الصيانة الدورية', fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 0, 0, 4], alignment: 'right' }
      : sectionTitle('بنود الصيانة الدورية', [0, 0, 0, 4]);
    return [
      title,
      {
        table: {
          headerRows: 1,
          keepWithHeaderRows: 2,
          dontBreakRows: true,
          widths: [72, '*', 62, 92],
          body: [[
            { text: 'القسم', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
            { text: 'البند', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
            { text: 'الحالة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
            { text: 'الملاحظة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' }
          ]].concat(items)
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#94a3b8'; },
          vLineColor: function(){ return '#94a3b8'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#f1f0ec'; }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function paymentPlanTable(value, customPlan){
    var total = Number(value || 0);
    var plan = (customPlan && customPlan.length) ? customPlan.map(function(p){
      return { label: p.label, desc: p.description || '', pct: p.percent > 1 ? p.percent/100 : (p.percent || 0) };
    }) : [
      { label: 'دفعة مقدمة', desc: 'تسدد فور التوقيع وقبل بدء العمل', pct: 0.5 },
      { label: 'دفعة ثانية', desc: 'عند الانتهاء من التركيب', pct: 0.35 },
      { label: 'دفعة ثالثة', desc: 'عند الانتهاء من الاستلام النهائي والتشغيل', pct: 0.15 }
    ];
    var body = [[
      { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'البيان', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'النسبة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'المبلغ', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' }
    ]];
    plan.forEach(function(p){
      var amount = total * p.pct;
      body.push([
        { text: p.label, fontSize: 10, bold: true, alignment: 'right', color: '#1e3a5f' },
        { text: p.desc, fontSize: 10, color: '#64748b', alignment: 'right' },
        { text: Math.round(p.pct * 100) + '%', fontSize: 10, alignment: 'center', color: '#1e3a5f' },
        { text: safeMoney(amount), fontSize: 10, bold: true, color: '#c9a84c', alignment: 'center' }
      ]);
    });
    return [
      sectionTitle('جدول الدفعات', [0, 0, 0, 4]),
      {
        table: {
          headerRows: 1,
          keepWithHeaderRows: 2,
          dontBreakRows: true,
          widths: [60, '*', 40, 70],
          body: body
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#94a3b8'; },
          vLineColor: function(){ return '#94a3b8'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#f1f0ec'); }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function renderItems(arr, title){
    if (!arr || !arr.length) return null;
    var items = [];
    arr.forEach(function(item){
      var t = '', d = '';
      if (typeof item === 'string') { t = item; }
      else if (item && item.section) { t = item.title || item.section; d = item.description || ''; }
      else if (item && item.title) { t = item.title; d = item.description || ''; }
      else if (item && item.name) { t = item.name; d = item.description || item.desc || ''; }
      else { try { t = JSON.stringify(item); } catch(e){} }
      items.push({ text: t, bold: true, fontSize: 10, color: '#1e293b', margin: [0, 0, 0, 1], alignment: 'right' });
      if (d) items.push({ text: d, fontSize: 10, color: '#475569', margin: [0, 0, 0, 2], alignment: 'right' });
      if (item && typeof item === 'object' && item.price != null && Number(item.price) !== 0) {
        items.push({ text: 'القيمة: ' + safeMoney(item.price), fontSize: 10, bold: true, color: '#b8862d', margin: [0, 0, 0, 4], alignment: 'right' });
      }
    });
    var titleEl = { text: title, fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] };
    if (items.length > 0) {
      return [{
        stack: [titleEl, items[0]],
        unbreakable: true
      }].concat(items.slice(1)).concat({ text: '', margin: [0, 0, 0, 4] });
    }
    return [titleEl, { text: '', margin: [0, 0, 0, 4] }];
  }

  function partsTable(arr, title){
    if (!arr || !arr.length) return null;
    var body = [[
      { text: 'الصنف', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'الكمية', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'سعر الوحدة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'الإجمالي', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' }
    ]];
    var total = 0;
    arr.forEach(function(item){
      var name = item.title || item.name || '';
      var qty = Number(item.qty || 1);
      var unitPrice = Number(item.unitPrice || item.price || 0);
      var lineTotal = Number(item.price || unitPrice * qty);
      total += lineTotal;
      body.push([
        { text: name, fontSize: 10, alignment: 'right', color: '#334155' },
        { text: String(qty), fontSize: 10, alignment: 'center', color: '#334155' },
        { text: safeMoney(unitPrice), fontSize: 10, alignment: 'center', color: '#334155' },
        { text: safeMoney(lineTotal), fontSize: 10, alignment: 'center', bold: true, color: '#1e3a5f' }
      ]);
    });
    body.push([
      { text: 'الإجمالي', colSpan: 3, alignment: 'left', bold: true, fontSize: 10, color: '#b8862d' },
      {}, {},
      { text: safeMoney(total), alignment: 'center', bold: true, fontSize: 10, color: '#b8862d' }
    ]);
    return [
      { text: title, fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] },
      {
        table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: ['*', 50, 70, 80], body: body },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#94a3b8'; },
          vLineColor: function(){ return '#94a3b8'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#f1f0ec'); }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  var _sharedDd = {
    rtl: true,
    styles: {
      sectionTitle: { fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] },
      summaryLabel: { fontSize: 10, color: '#64748b', bold: true },
      summaryValue: { fontSize: 10, color: '#1e3a5f', bold: true }
    },
    defaultStyle: { font: 'Cairo', fontSize: 10, lineHeight: 1.15, color: '#334155', bold: true },
    pageSize: 'A4',
    pageMargins: [24, 68, 24, 78],
    header: function(currentPage, pageCount){
      var co = (A.activeOwnerCompany && A.activeOwnerCompany()) || null;
      var companyName = (co && co.name) || 'نظام شموس';
      return {
        stack: [
          { text: companyName, fontSize: 9, color: '#1e3a5f', alignment: 'center', margin: [0, 8, 0, 2], bold: true },
          { canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.5, lineColor: '#c9a84c' }] },
          { text: '', margin: [0, 0, 0, 6] }
        ]
      };
    },
    footer: function(currentPage, pageCount, cleanFooter){
      var f = [];
      f.push({ canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#c9a84c' }], margin: [0, 0, 0, 2] });
      if (cleanFooter) f.push({ text: cleanFooter, fontSize: 7, color: '#64748b', alignment: 'center', margin: [0, 0, 0, 1] });
      f.push({ text: '' + currentPage + ' / ' + pageCount, fontSize: 7, color: '#94a3b8', alignment: 'center' });
      return { stack: f, margin: [28, 0, 28, 6] };
    }
  };

  function normalizePdfNodes(nodes, insideTable){
    if (!nodes) return;
    if (Array.isArray(nodes)) {
      nodes.forEach(function(node){ normalizePdfNodes(node, insideTable); });
      return;
    }
    if (typeof nodes !== 'object') return;

    if (Number(nodes.lineHeight) > 1.2) nodes.lineHeight = 1.2;
    var isMainHeading = nodes.bold && Number(nodes.fontSize) >= 12 && typeof nodes.text !== 'undefined';
    var isGoldSubheading = nodes.bold && Number(nodes.fontSize) >= 10 && nodes.color === '#c9a84c' && typeof nodes.text !== 'undefined';
    if (!insideTable && (isMainHeading || isGoldSubheading)) {
      nodes.headlineLevel = 1;
    }

    if (nodes.table && Array.isArray(nodes.table.body)) {
      var firstRow = nodes.table.body[0];
      var hasVisualHeader = Array.isArray(firstRow) && firstRow.length > 0 && firstRow.every(function(cell){
        return cell && typeof cell === 'object' && (cell.fillColor === '#1e3a5f' || cell.color === '#fff');
      });
      if (!Number(nodes.table.headerRows) && hasVisualHeader) nodes.table.headerRows = 1;
      if (Number(nodes.table.headerRows) > 0) {
        nodes.table.keepWithHeaderRows = Math.min(2, Math.max(2, nodes.table.body.length - Number(nodes.table.headerRows)));
        nodes.table.dontBreakRows = true;
      }
      nodes.layout = {
        hLineWidth: function(i, node){ return (i === 0 || i === node.table.body.length) ? 0.6 : 0.3; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(i){ return i === 0 ? '#1e3a5f' : '#cbd5e1'; },
        vLineColor: function(){ return '#cbd5e1'; },
        paddingLeft: function(){ return 6; },
        paddingRight: function(){ return 6; },
        paddingTop: function(){ return 3; },
        paddingBottom: function(){ return 3; },
        fillColor: function(rowIndex){ return rowIndex > 0 && rowIndex % 2 === 0 ? '#f5f4f1' : null; }
      };
    }

    ['stack', 'columns', 'ul', 'ol'].forEach(function(key){ normalizePdfNodes(nodes[key], insideTable); });
    if (nodes.table) normalizePdfNodes(nodes.table.body, true);
  }

  function bindHeadingsToFollowingText(content){
    if (!Array.isArray(content)) return;
    for (var i = 0; i < content.length - 1; i++) {
      var heading = content[i];
      var next = content[i + 1];
      if (!heading || heading.headlineLevel !== 1 || heading.unbreakable) continue;
      if (!next || next.table || next.pageBreak || next.unbreakable) continue;
      if (typeof next.text === 'undefined') continue;
      content.splice(i, 2, {
        stack: [heading, next],
        unbreakable: true,
        headlineLevel: 1
      });
    }
  }

  function makeDd(content, cleanFooter, opts){
    var dd = JSON.parse(JSON.stringify(_sharedDd, function(k, v){
      return typeof v === 'function' ? undefined : v;
    }));
    normalizePdfNodes(content);
    bindHeadingsToFollowingText(content);
    dd.content = content;
    dd.pageBreakBefore = function(currentNode, followingNodesOnPage){
      return (currentNode.headlineLevel === 1 || currentNode.headlineLevel === 2) && followingNodesOnPage.length < 2;
    };
    if (opts && opts.letterhead) {
      dd.pageMargins = [24, 208, 24, 78];
      dd.header = function(){ return null; };
      dd.footer = function(){ return null; };
      var bg = A.companyLetterhead ? A.companyLetterhead() : '';
      if (!bg) return null;
      dd.background = function(){
        return { image: bg, width: 595, height: 842, absolutePosition: { x: 0, y: 0 } };
      };
    } else if (opts && opts.clean) {
      dd.pageMargins = [24, 88, 24, 78];
      dd.header = function(){ return null; };
      dd.footer = function(){ return null; };
    } else {
      dd.header = function(){ return _sharedDd.header(); };
      dd.footer = function(cp, pc){ return _sharedDd.footer(cp, pc, cleanFooter); };
    }
    return dd;
  }

  function contractIntroParagraph(c, isInstall){
    var co = (A.activeOwnerCompany && A.activeOwnerCompany()) || null;
    var party1Name = (c.company && c.company.name) || (co && co.name) || activeCompanyName();
    var p1 = party1Name;
    if (co && co.unifiedNumber && co.unifiedNumber !== '') p1 += ' - الرقم الموحد: ' + String(co.unifiedNumber);
    if (co && co.address && co.address !== '') p1 += ' - المقر: ' + String(co.address);

    var p2 = safeLabel(c);
    var p2Extra = [];
    if (c.clientId) p2Extra.push('رقم الهوية: ' + String(c.clientId));
    if (c.clientCompanyName && c.clientCompanyName !== '') p2Extra.push('اسم المنشأة: ' + String(c.clientCompanyName));
    if (c.clientCompanyUnifiedNumber && c.clientCompanyUnifiedNumber !== '') p2Extra.push('الرقم الموحد: ' + String(c.clientCompanyUnifiedNumber));
    if (c.clientPhone && c.clientPhone !== '') p2Extra.push('جوال: ' + String(c.clientPhone));
    if (p2Extra.length) p2 += ' - ' + p2Extra.join(' - ');

    var dateRef = c.startDate || c.createdAt || '';
    var datePart = 'تاريخ العقد';
    if (dateRef) {
      var dd = new Date(dateRef);
      if (!isNaN(dd.getTime())) {
        datePart = dd.toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    }

    var actionText = isInstall
      ? 'على توريد وتركيب مصعد وفق المواصفات والبنود الواردة في هذا العقد.'
      : 'على صيانة المصعد (المصاعد) وفق بنود الصيانة الدورية والشروط والمواصفات الواردة في هذا العقد.';

    return [
      { text: [{ text: 'إنه في يوم ', fontSize: 10, color: '#475569' }, { text: datePart, fontSize: 10, color: '#475569' }, { text: ' تم الاتفاق بين:', fontSize: 10, color: '#475569' }], alignment: 'right', margin: [0, 0, 0, 4] },
      { stack: [
          { text: [{ text: 'الطرف الأول: ', bold: true, fontSize: 10, color: '#1e3a5f' }, { text: p1, fontSize: 10, color: '#475569' }], margin: [0, 2, 0, 1], alignment: 'right' },
          { text: [{ text: 'الطرف الثاني: ', bold: true, fontSize: 10, color: '#1e3a5f' }, { text: p2, fontSize: 10, color: '#475569' }], margin: [0, 0, 0, 4], alignment: 'right' }
      ]},
      { text: actionText, fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 10], alignment: 'right' }
    ];
  }

  function sectionTitle(text, margin){
    return { text: text, fontSize: 12, bold: true, color: '#1e3a5f', margin: margin || [0, 0, 0, 4], alignment: 'right', headlineLevel: 1 };
  }

  function scopeText(text, fallback){
    return { text: text || fallback, fontSize: 12, color: '#475569', margin: [0, 0, 0, 8], alignment: 'right', lineHeight: 1.15 };
  }

  var specGroups = [
    {
      tab: 'مواصفات المصعد',
      fields: [
        ['elevatorType', 'نوع المصعد'], ['usage', 'الاستخدام'], ['capacity', 'الحمولة'],
        ['persons', 'عدد الأشخاص'], ['stops', 'عدد الوقفات'], ['age', 'عمر المصعد'], ['speed', 'السرعة'],
        ['travelHeight', 'ارتفاع المشوار'], ['shaftLength', 'طول البئر'], ['shaftWidth', 'عرض البئر'],
        ['pitDepth', 'عمق الحفرة'], ['overhead', 'الارتفاع العلوي'], ['entrances', 'عدد المداخل'],
        ['doorDirection', 'اتجاه الأبواب'], ['speedSystem', 'نظام السرعة'],
        ['doorType', 'نوع الأبواب'], ['motorManufacturer', 'ماركة المصعد']
      ]
    },
    {
      tab: 'المحرك والكنترول',
      fields: [
        ['motorType', 'نوع المحرك'],
        ['motorPower', 'قدرة المحرك'], ['motorSpeed', 'سرعة المحرك'], ['controller', 'الكنترول'],
        ['ropeManufacturer', 'الشركة المصنعة للحبال'], ['ropesCount', 'عدد الحبال'],
        ['ropeDiameter', 'قطر الحبال'], ['counterweight', 'وزن الثقال'],
        ['railManufacturer', 'الشركة المصنعة للسكك'], ['railSize', 'مقاس السكك'],
        ['originCountry', 'بلد المنشأ']
      ]
    },
    {
      tab: 'الكابينة',
      fields: [
        ['cabinSize', 'أبعاد الكابينة'], ['floorType', 'نوع الأرضية'], ['wallType', 'نوع الجدران'],
        ['ceilingType', 'نوع السقف'], ['lightingType', 'نوع الإنارة'], ['displayType', 'نوع شاشة العرض'],
        ['risotType', 'نوع البرشوت'], ['mirrors', 'وجود مرايا'], ['fan', 'وجود مروحة'],
        ['voiceAnnouncement', 'Voice Announcement'], ['braille', 'Braille']
      ]
    },
    {
      tab: 'الأبواب',
      fields: [
        ['doorManufacturer', 'الشركة المصنعة للأبواب'],
        ['doorWidth', 'عرض الباب'], ['doorHeight', 'ارتفاع الباب'],
        ['doorOpenTime', 'زمن فتح الباب'], ['doorCloseTime', 'زمن إغلاق الباب'],
        ['doorLockType', 'نوع أقفال الأبواب']
      ]
    },
    {
      tab: 'أنظمة الأمان',
      fields: [
        ['bufferType', 'نوع Buffer'], ['rescueSystem', 'نظام الإنقاذ'],
        ['coolingSystem', 'نظام التبريد'], ['intercom', 'إنتركم'],
        ['camera', 'كاميرا'], ['fireMode', 'Fire Mode']
      ]
    },
    {
      tab: 'الكهرباء',
      fields: [
        ['voltage', 'الجهد'], ['frequency', 'التردد'], ['phases', 'عدد الفازات'],
        ['travelCableSize', 'مقاس الكيبل المرن'], ['powerConsumption', 'استهلاك الكهرباء']
      ]
    },
    {
      tab: 'الضمان',
      fields: [
        ['warranty', 'مدة الضمان'], ['notes', 'الملاحظات']
      ]
    }
  ];

  function horizontalKeyValueTables(rows, columns){
    var out = [];
    var size = columns || 4;
    for (var index = 0; index < rows.length; index += size) {
      var chunk = rows.slice(index, index + size);
      out.push({
        table: {
          headerRows: 1,
          keepWithHeaderRows: 1,
          dontBreakRows: true,
          widths: chunk.map(function(){ return '*'; }),
          body: [
            chunk.map(function(row){
              return { text: String(row[0]), bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' };
            }),
            chunk.map(function(row){
              return { text: String(row[1]), bold: true, fontSize: 9, color: '#334155', fillColor: '#f8fafc', alignment: 'center' };
            })
          ]
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#94a3b8'; },
          vLineColor: function(){ return '#94a3b8'; },
          paddingLeft: function(){ return 5; },
          paddingRight: function(){ return 5; },
          paddingTop: function(){ return 5; },
          paddingBottom: function(){ return 5; }
        },
        margin: [0, 0, 0, 7]
      });
    }
    return out;
  }

  function maintenanceSpecTable(info, overallTitle){
    if (!info || typeof info !== 'object') return null;
    var out = [];
    if (overallTitle) out.push(sectionTitle(overallTitle, [0, 0, 0, 4]));
    var allowed = {count:true,elevatorType:true,usage:true,capacity:true,persons:true,stops:true,age:true,doorType:true,motorManufacturer:true,motorType:true,controller:true,doorManufacturer:true,rescueSystem:true,intercom:true,camera:true,fan:true,fireMode:true,warranty:true,notes:true};
    var fields = [['count', 'عدد المصاعد']];
    specGroups.forEach(function(group){
      (group.fields || []).forEach(function(f){
        if (allowed[f[0]]) fields.push([f[0], f[1]]);
      });
    });
    if (!info.motorManufacturer && info.brand) fields.push(['brand', 'الماركة']);
    var seen = {};
    var rows = fields.filter(function(field){
      if (seen[field[0]]) return false;
      seen[field[0]] = true;
      return info[field[0]] != null && String(info[field[0]]).trim() !== '';
    }).map(function(field){ return [field[1], String(info[field[0]])]; });
    if (!rows.length) {
      out.push({
        text: 'مواصفات المصعد غير موجودة في بيانات هذا العقد، ويلزم استعادتها من نسخة موثوقة قبل اعتماد المستند.',
        bold: true,
        fontSize: 9,
        color: '#9f3a38',
        fillColor: '#fff4f2',
        alignment: 'right',
        margin: [8, 7, 8, 7]
      });
      return out;
    }
    Array.prototype.push.apply(out, horizontalKeyValueTables(rows, 4));
    return out;
  }

  function specTable(info, overallTitle){
    if (!info || typeof info !== 'object') return null;
    var out = [];
    specGroups.forEach(function(group){
      var rows = [];
      group.fields.forEach(function(f){
        var val = info[f[0]];
        if (val && val !== '') {
          rows.push([
            { text: f[1], bold: true, fontSize: 10, fillColor: '#e8e6e1', alignment: 'right', color: '#1e3a5f' },
            { text: val, fontSize: 10, alignment: 'right', color: '#334155' }
          ]);
        }
      });
      if (rows.length) {
        if (overallTitle && !out.length) {
          out.push(sectionTitle(overallTitle, [0, 0, 0, 4]));
        }
        out.push({ text: group.tab, fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 0, 0, 2], alignment: 'right' });
        out.push({
          table: {
            headerRows: 0,
            widths: [100, '*'],
            body: rows
          },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#94a3b8'; },
            vLineColor: function(){ return '#94a3b8'; },
            paddingLeft: function(){ return 8; },
            paddingRight: function(){ return 8; },
            paddingTop: function(){ return 5; },
            paddingBottom: function(){ return 5; },
            fillColor: function(i){ return i % 2 === 0 ? null : '#f1f0ec'; }
          },
          margin: [0, 0, 0, 8]
        });
      }
    });
    if (!out.length) return null;
    return out;
  }

  function sectionBlock(num, heading, body){
    var label = num + ': ' + heading;
    var title = sectionTitle(label, [0, 0, 0, 2]);
    if (Array.isArray(body)) {
      if (body.length > 0) {
        return [{
          stack: [title, body[0]],
          unbreakable: true
        }].concat(body.slice(1));
      }
      return [title];
    }
    return [{
      stack: [title, body],
      unbreakable: true
    }];
  }

  function maintenancePdfClauses(){
    return [
      { text: 'خامساً: الضمان على أعمال الصيانة', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'تتحمل الشركة المصنعة أو الموردة أو الشركة المنفذة لأعمال الصيانة (الطرف الأول) مسؤولية ضمان أعمال الصيانة التي تقوم بها وتكون مسؤولة عن أي عيوب أو أخطاء في تلك الأعمال.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'يكون الضمان ساري المفعول لمدة عام من تاريخ بداية العقد على الأجزاء التي تمت صيانتها أو استبدالها في حالة الصيانة الناتجة عن سوء التركيب أو التصنيع أو عدم سلامة التصنيع.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'مدة الضمان لعملية الصيانة تكون عاماً من تاريخ التنفيذ، وفي حال وجود أي عيوب في أعمال الصيانة يجب على الطرف الأول إعادة الصيانة أو إصلاح العيوب خلال مدة لا تتجاوز خمسة عشر يوماً من تاريخ الإشعار وبما لا يخل بضمان أعمال الصيانة.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'في حالة وجود أي عيوب أو أخطاء في الصيانة من وجهة نظر الطرف الثاني، عليه إخطار الطرف الأول بذلك ويجب أن يتضمن الإخطار وصفاً كاملاً للعيوب أو الأخطاء.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'سادساً: التزامات الطرف الثاني', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يلتزم الطرف الثاني بتوفير متطلبات السلامة لحماية العاملين في الموقع، وتوفير مساحة عمل آمنة ومناسبة لفريق الصيانة، مع توفير الإضاءة والطاقة الكهربائية اللازمة لتنفيذ أعمالهم بأمان وسلامة.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'إخلاء مسؤولية الطرف الأول عن أي حوادث أو إصابات أو أضرار تلحق بالغير أو بالعاملين في الموقع نتيجة إهمال الطرف الثاني أو عدم توفير بيئة عمل آمنة.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'يلتزم الطرف الثاني بإبلاغ الطرف الأول فوراً في حال حدوث أي عطل مفاجئ في المصعد.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'في حال عدم قيام الطرف الثاني بالتزاماته، يحق للطرف الأول تعليق الخدمة حتى يتم الالتزام.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'سابعاً: المسؤولية والسلامة', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يكون الطرف الأول مسؤولاً عن سلامة تنفيذ أعمال الصيانة وفقاً لأصول المهنة والشروط المتفق عليها.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'يكون الطرف الثاني مسؤولاً عن سلامة الموقع وتوفير بيئة عمل آمنة وفقاً للوائح وأنظمة السلامة المهنية.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'يكون الطرف الأول مسؤولاً عن سلامة وأداء المصعد (المصاعد) بعد الصيانة.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'ثامناً: التأخير أو التقصير', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: [{ text: 'التأخير أو التقصير: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'في حال تقصير أو تأخير الطرف الأول في تنفيذ أعمال الصيانة الدورية، يجب عليه إخطار الطرف الثاني بأسباب التأخير.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: [{ text: 'الإخلال بالالتزامات: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'في حال إخلال الطرف الأول بالتزاماته الجوهرية، يحق للطرف الثاني تعليق استحقاق الدفعات المستحقة للطرف الأول.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: [{ text: 'حدود المسؤولية: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'لا يتحمل الطرف الأول المسؤولية عن الأضرار غير المباشرة (سواء كانت مادية أو معنوية) مثل فقدان الأرباح أو توقف العمل أو غيرها، وتكون المسؤولية في جميع الأحوال محصورة بقيمة العقد المدفوعة من الطرف الثاني للطرف الأول.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: [{ text: 'إيقاف العقد: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'يحق للطرف الأول إيقاف العقد في حال عدم قيام الطرف الثاني بدفع الدفعات المستحقة في مواعيدها، على أن يكون الإيقاف بعد إنذار خطي لمدة لا تقل عن 7 أيام.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'تاسعاً: فسخ العقد', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يحق لأي من الطرفين فسخ العقد في حال إخلال الطرف الآخر بالتزاماته الجوهرية مع إنذار خطي لمدة لا تقل عن 30 يوماً.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'في حال فسخ العقد، يستحق الطرف الأول قيمة الأعمال التي تم تنفيذها فعلاً.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: 'لا يحق للطرف الثاني فسخ العقد بسبب ظروفه المادية أو الإدارية أو تغير موقفه المالي، أو لأي سبب غير مبرر، وإلا أعتبر ذلك إخلالاً بالتزاماته.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'عاشراً: المسؤولية عن الأعطال التي تتطلب قطع غيار', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: [{ text: 'الأعطال التي تتطلب قطع غيار: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'في حال وجود عطل بالمصعد يتطلب تغيير قطعة غيار، تتحمل الطرف الثاني قيمة القطعة وتكاليف الشحن والتركيب والنقل والخدمات اللوجستية، على أن تقوم الطرف الأول بتوفير القطعة وتنفيذ أعمال الاستبدال بأسرع وقت ممكن، ويتم وضع خطة لتفادي توقف المصعد لفترات طويلة.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] },
      { text: [{ text: 'الأعطال غير المشمولة: ', bold: true, fontSize: 10, color: '#1e293b' }, { text: 'أما الأعطال الناتجة عن سوء الاستخدام أو التعديلات غير المصرح بها من قبل الطرف الثاني أو الغير، أو الأعطال الناتجة عن سوء التركيب أو التصنيع من قبل الغير والشركات المنفذة للتركيب أو التصنيع، أو ظروف قاهرة مثل كوارث طبيعية أو حرائق أو فيضانات أو سرقات وتخريب، أو انقطاع التيار الكهربائي أو عدم استقرار الجهد الكهربائي، أو عدم تنفيذ الصيانة الوقائية الدورية المتفق عليها في العقد، أو وجود أي تعديلات هيكلية في المبنى تؤثر على سلامة المصعد، فلا تكون الطرف الأول مسؤولة عنها وتتحمل الطرف الثاني أي تكاليف إضافية لإعادة التأهيل والصيانة.', fontSize: 10, color: '#475569' }], alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 8] },
      { text: 'نسخ العقد', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'تم تحرير هذا العقد من نسختين (2) بيد كل طرف نسخة واحدة، وتعتبر جميعها نسخاً أصلية، وتسري أحكام هذا العقد اعتباراً من تاريخ توقيعه من الطرفين.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 4] }
    ];
  }

  function maintenanceContractPartiesTable(c, companyName){
    var co = (A.activeOwnerCompany && A.activeOwnerCompany()) || {};
    var partyOneId = [];
    if (co.unifiedNumber) partyOneId.push('الرقم الموحد: ' + String(co.unifiedNumber));
    if (co.commercialNumber) partyOneId.push('السجل التجاري: ' + String(co.commercialNumber));
    var partyTwoId = [];
    if (c.clientCompanyUnifiedNumber) partyTwoId.push('الرقم الموحد: ' + String(c.clientCompanyUnifiedNumber));
    if (c.clientId) partyTwoId.push('رقم الهوية: ' + String(c.clientId));
    var partyTwoName = c.clientCompanyName && c.clientName
      ? String(c.clientCompanyName) + ' / ' + String(c.clientName)
      : safeLabel(c);
    var body = [[
      { text: 'الطرف', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'الاسم / المنشأة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'الهوية / الرقم الموحد', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'التواصل / العنوان', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' }
    ], [
      { text: 'الطرف الأول', bold: true, color: '#1e3a5f', alignment: 'right' },
      { text: companyName || co.name || 'غير محدد', alignment: 'right' },
      { text: partyOneId.join(' — ') || '—', alignment: 'right' },
      { text: [co.phone, co.address].filter(Boolean).join(' — ') || '—', alignment: 'right' }
    ], [
      { text: 'الطرف الثاني', bold: true, color: '#1e3a5f', alignment: 'right' },
      { text: partyTwoName, alignment: 'right' },
      { text: partyTwoId.join(' — ') || '—', alignment: 'right' },
      { text: c.clientPhone || '—', alignment: 'right' }
    ]];
    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 2,
        dontBreakRows: true,
        widths: [55, 105, 135, '*'],
        body: body
      },
      margin: [0, 0, 0, 8]
    };
  }

  function maintenanceContractDataTable(c, companyName){
    var paymentMethod = A.contractPaymentMethods ? A.contractPaymentMethods(c) : 'لم تسجل دفعات بعد';
    var rows = [
      ['رقم العقد', c.id || '—'],
      ['حالة العقد', c.status || '—'],
      ['بداية العقد', c.startDate || 'غير محدد'],
      ['نهاية العقد', c.endDate || 'غير محدد'],
      ['مدة العقد', String(Number(c.contractYears || 1)) + ' سنة'],
      ['قيمة العقد', safeMoney(c.value)],
      ['طريقة الدفع', paymentMethod],
      ['منشأة الإصدار', companyName || 'غير محدد']
    ];
    return { stack: horizontalKeyValueTables(rows, 4), margin: [0, 0, 0, 2] };
  }

  function maintenanceContractBuildingsTable(buildings){
    if (!buildings || !buildings.length) return null;
    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 2,
        dontBreakRows: true,
        widths: [90, 70, 70, 85, '*'],
        body: [[
          { text: 'المبنى', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'الحي', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'رقم المبنى', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'جوال المسؤول', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'رابط الخريطة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' }
        ]].concat(buildings.map(function(b){
          return [
            { text: b.name || 'غير محدد', alignment: 'right' },
            { text: b.district || '—', alignment: 'right' },
            { text: b.buildingNumber || '—', alignment: 'right' },
            { text: b.guardMobile || '—', alignment: 'right' },
            { text: b.mapUrl || '—', alignment: 'right', fontSize: 8 }
          ];
        }))
      },
      margin: [0, 0, 0, 8]
    };
  }

  function maintenanceContractTerms(arr, title){
    if (!arr || !arr.length) return [];
    var nodes = [{ text: title, fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 2, 0, 4], alignment: 'right' }];
    arr.forEach(function(item){
      var heading = item && (item.title || item.name || item.section) || '';
      var description = item && (item.description || item.desc) || '';
      if (heading) nodes.push({ text: heading, bold: true, fontSize: 10, color: '#1e293b', margin: [0, 0, 0, 1], alignment: 'right' });
      if (description) nodes.push({ text: description, fontSize: 9, color: '#475569', margin: [0, 0, 0, 3], alignment: 'right' });
    });
    return nodes;
  }

  // ==================== CONTRACT ====================
  function contractPdfDefinition(c, logoData, opts){
    var companyName = (c.company && c.company.name) || activeCompanyName();
    var cf = safeFooter();
    var content = [];
    var isInstall = c.type === 'تركيب';
    var isParts = c.type === 'توريد وتركيب قطع غيار';

    console.log("PDFGEN", "contract type:", c.type, "is install:", isInstall);

    appendDocumentHeader(content, logoData, opts);

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'عقد ' + (c.type || ''), bold: true, fontSize: 14, color: '#1e3a5f', alignment: 'right' },
            { text: 'رقم العقد: ' + c.id, bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [4, 2, 4, 2] }
          ]
        ]
      },
      layout: {
        hLineWidth: function(){ return 0; },
        vLineWidth: function(){ return 0; },
        paddingLeft: function(){ return 0; },
        paddingRight: function(){ return 0; },
        paddingTop: function(){ return 0; },
        paddingBottom: function(){ return 0; }
      },
      margin: [0, 0, 0, 8]
    });

    if (isInstall) {
      content.push({
        stack: [
          { text: 'بسم الله الرحمن الرحيم', fontSize: 10, color: '#94a3b8', alignment: 'center', margin: [0, 0, 0, 2] },
          { text: 'عقد تركيب مصعد', fontSize: 12, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] },
          { text: 'يسعدنا نحن ' + companyName + ' أن نتقدم لسعادتكم بهذا العقد لتوريد وتركيب مصعد في موقعكم الموضح أدناه، وفق المواصفات الفنية والبنود العامة المعتمدة.', fontSize: 10, color: '#475569', alignment: 'right', margin: [0, 0, 0, 6], lineHeight: 1.15 }
        ],
        margin: [0, 0, 0, 6]
      });
    }

    if (isInstall) {
      content.push(summaryTable([
        { label: 'بداية العقد', value: c.startDate },
        { label: 'نهاية العقد', value: c.endDate },
        { label: 'منشأة الإصدار', value: companyName }
      ].concat([{label:'مدة التركيب',value:(c.installationInfo?.installDuration||'45 يوماً')}]).concat(c.deliveryDate?[{label:'تاريخ التسليم',value:c.deliveryDate}]:[]).concat([{label:'طريقة الدفع',value:A.contractPaymentMethods?A.contractPaymentMethods(c):'لم تسجل دفعات بعد'}])));

      if (c.financialNotes) {
        content.push({ text: 'ملاحظات مالية', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 6, 0, 4], alignment: 'right' });
        content.push({ text: c.financialNotes, fontSize: 10, color: '#475569', margin: [0, 0, 0, 6], alignment: 'right' });
      }

      var intro = contractIntroParagraph(c, true);
      if (intro) Array.prototype.push.apply(content, intro);
    }

    if (isInstall) {
      var scopeDefault = 'يشمل العقد توريد وتركيب المصعد والسكة والأبواب والكابينة والمكينة ولوحة التحكم والتشغيل والاختبار والتسليم النهائي وفقاً للمواصفات الفنية الواردة بهذا العقد، مع توفير الضمان اللازم للأجزاء الموردة حسب ما هو متفق عليه.';
      var sec = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً'];
      var si = 0;
      Array.prototype.push.apply(content, sectionBlock(sec[si++], 'نطاق التوريد والتركيب', scopeText(c.details, scopeDefault)));

      var st = specTable(c.elevatorInfo, 'البند ' + sec[si++] + ': المواصفات الفنية للمصعد');
      if (st && st.length) {
        Array.prototype.push.apply(content, st);
      }

      var pt = paymentPlanTable(c.value, c.paymentPlan);
      if (pt) {
        Array.prototype.push.apply(content, sectionBlock(sec[si++], 'شروط الدفع', pt));
      }

      var ti = renderItems(c.items, sec[si] + ': البنود الافتراضية');
      if (ti) { Array.prototype.push.apply(content, ti); si++; }
      var ci = renderItems(c.customItems, sec[si] + ': البنود الإضافية');
      if (ci) { Array.prototype.push.apply(content, ci); si++; }

      var buildings = c.buildings || [];
      if (buildings.length > 0) {
        var bd = [{ text: '', margin: [0, 0, 0, 2] }];
        buildings.forEach(function(b){
          bd.push({
            stack: [
              { text: b.name || 'غير محدد', bold: true, fontSize: 10, color: '#1e293b', margin: [0, 0, 0, 1], alignment: 'right' },
              { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 10, color: '#64748b', margin: [0, 0, 0, 4], alignment: 'right' }
            ],
            margin: [0, 0, 0, 2]
          });
        });
        Array.prototype.push.apply(content, sectionBlock(sec[si++], 'المباني والمواقع', bd));
      }
      if (c.deliveryDate && c.maintenanceEndDate) {
        var p = { text: 'تبدأ فترة الصيانة من تاريخ تسليم المصعد (' + c.deliveryDate + ') إلى تاريخ (' + c.maintenanceEndDate + ')، على أن تشمل أعمال الصيانة الدورية والطارئة وفق بنود الصيانة المتفق عليها أعلاه.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15 };
        content.push(sectionBlock(sec[si++], 'فترة الصيانة', p));
      }
    } else if (isParts) {
      var partsParty = safeLabel(c);
      content.push({
        stack: [
          { text: 'عقد توريد وتركيب قطع غيار', fontSize: 13, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 5] },
          { text: 'تم الاتفاق بين ' + companyName + ' والطرف الثاني ' + partsParty + ' على توريد وتركيب واختبار قطع الغيار المبينة في هذا العقد وفق الأصول الفنية وتعليمات السلامة.', fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.2, margin: [0, 0, 0, 8] }
        ]
      });
      content.push(summaryTable([
        {label:'الطرف الثاني',value:partsParty},
        {label:'بداية العقد',value:c.startDate},
        {label:'نهاية العقد',value:c.endDate},
        {label:'قيمة العقد',value:safeMoney(c.value)},
        {label:'طريقة الدفع',value:A.contractPaymentMethods?A.contractPaymentMethods(c):'لم تسجل دفعات بعد'}
      ]));
      var partsRows = (c.partsItems && c.partsItems.length) ? c.partsItems : (c.customItems || []).filter(function(x){ return x && x.section === 'قطع الغيار'; });
      var partsNode = partsTable(partsRows, 'أولاً: قطع الغيار والكميات');
      if (partsNode) Array.prototype.push.apply(content, partsNode);
      else content.push(sectionBlock('أولاً', 'قطع الغيار والكميات', scopeText('', 'لم تُسجل قطع غيار في هذا العقد.')));
      content.push(sectionBlock('ثانياً', 'نطاق التنفيذ', scopeText(c.details, 'يشمل نطاق العمل توريد القطع المعتمدة ونقلها إلى الموقع وتركيبها وضبطها واختبارها والتأكد من سلامة تشغيل المصعد بعد الإنجاز.')));
      content.push(sectionBlock('ثالثاً', 'التزامات الطرف الأول', [
        scopeText('يلتزم الطرف الأول بتوريد قطع مطابقة للمواصفات المتفق عليها وتنفيذ التركيب بواسطة فنيين مؤهلين، مع الالتزام بمتطلبات السلامة وتسليم الموقع بحالة تشغيلية سليمة.', ''),
        scopeText('لا يُنفذ أي عمل إضافي أو استبدال خارج نطاق العقد إلا بعد موافقة الطرف الثاني وتوثيق أثره المالي والزمني.', '')
      ]));
      content.push(sectionBlock('رابعاً', 'الضمان والاستلام', scopeText('', 'يبدأ ضمان القطع وأعمال التركيب من تاريخ الاستلام والتشغيل، وفق مدة الضمان المثبتة لكل قطعة أو العرض المعتمد، ولا يشمل سوء الاستخدام أو العبث أو الأعطال الناتجة عن أسباب خارجة عن نطاق العمل.')));
      var partsBuildings = maintenanceContractBuildingsTable(c.buildings || []);
      if (partsBuildings) content.push(sectionBlock('خامساً', 'موقع التنفيذ', partsBuildings));
    } else {
      var basicNodes = [
        maintenanceContractPartiesTable(c, companyName),
        { text: 'بيانات العقد', fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 2, 0, 4], alignment: 'right' },
        maintenanceContractDataTable(c, companyName)
      ];
      var maintenanceBuildings = maintenanceContractBuildingsTable(c.buildings || []);
      if (maintenanceBuildings) {
        basicNodes.push({ text: 'المباني والمواقع', fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 2, 0, 4], alignment: 'right' });
        basicNodes.push(maintenanceBuildings);
      }
      if (c.financialNotes) {
        basicNodes.push({ text: 'ملاحظات مالية', fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 2, 0, 3], alignment: 'right' });
        basicNodes.push({ text: c.financialNotes, fontSize: 10, color: '#475569', margin: [0, 0, 0, 6], alignment: 'right' });
      }
      Array.prototype.push.apply(content, sectionBlock('أولاً', 'البيانات الأساسية', basicNodes));

      var maintenanceSpecs = maintenanceSpecTable(c.elevatorInfo, 'ثانياً: مواصفات المصعد');
      if (maintenanceSpecs && maintenanceSpecs.length) {
        Array.prototype.push.apply(content, maintenanceSpecs);
      } else {
        content.push(sectionTitle('ثانياً: مواصفات المصعد'));
        content.push({ text: 'لا توجد مواصفات مصعد مسجلة.', fontSize: 10, color: '#64748b', alignment: 'right', margin: [0, 0, 0, 8] });
      }

      var maintenanceScope = c.details || 'يشمل العقد أعمال الصيانة الدورية للمصعد وفق البنود المحددة للحفاظ على سلامته وأدائه طوال مدة العقد.';
      content.push({
        stack: [
          sectionTitle('ثالثاً: الصيانة', [0, 0, 0, 4]),
          { text: 'نطاق الصيانة', fontSize: 10, bold: true, color: '#c9a84c', margin: [0, 0, 0, 2], alignment: 'right' },
          { text: maintenanceScope, fontSize: 10, color: '#475569', alignment: 'right', lineHeight: 1.15, margin: [0, 0, 0, 5] },
          { text: 'عدد الزيارات: اثنتا عشرة (12) زيارة دورية خلال مدة العقد.', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'right', margin: [0, 0, 0, 6] }
        ],
        unbreakable: true
      });
      var maintenanceChecklist = maintenanceTable(c.maintenanceChecklist, { compactTitle: true });
      if (maintenanceChecklist) Array.prototype.push.apply(content, maintenanceChecklist);
      Array.prototype.push.apply(content, maintenanceContractTerms(c.items, 'بنود الصيانة المعتمدة'));
      Array.prototype.push.apply(content, maintenanceContractTerms(c.customItems, 'بنود الصيانة الإضافية'));
    }

    content.push({
      stack: buildSignature(companyName, safeLabel(c)),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== QUOTE ====================
  function quotePdfDefinition(q, logoData, opts){
    var total = Number(q.subtotal != null ? q.subtotal : (q.value != null ? q.value : (q.totalWithTax || 0)));
    var party = q.client || q.clientCompanyName || q.clientName || "غير محدد";
    var isInstall = q.type === "تركيب";
    var isParts = q.type === "توريد وتركيب قطع غيار";
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'عرض سعر' + (q.type ? ' - ' + q.type : ''), bold: true, fontSize: 14, color: '#1e3a5f' },
        statusBadge(q.status || 'بانتظار الرد')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم عرض السعر: ' + q.id, bold: true, fontSize: 12, color: '#c9a84c', alignment: 'right' },
            { text: 'الإجمالي', fontSize: 10, color: '#64748b', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(total), bold: true, fontSize: 12, color: '#c9a84c', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push({
      stack: [
        { text: 'الطرف الموجه إليه عرض السعر', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] },
        { text: party, bold: true, fontSize: 12, color: '#1e3a5f', margin: [0, 2, 0, 4], alignment: 'right' }
      ],
      margin: [0, 0, 0, 8]
    });
    var quoteSummary = [
      { label: 'العنوان', value: q.title || 'عرض سعر' },
      { label: 'تاريخ الإصدار', value: q.createdAt },
      { label: 'مرجع الكشف', value: q.reportId || '?' }
    ];
    if (q.clientName) quoteSummary.push({ label: 'اسم العميل', value: q.clientName });
    if (q.clientId) quoteSummary.push({ label: 'هوية العميل', value: q.clientId });
    if (q.clientCompanyName) quoteSummary.push({ label: 'منشأة العميل', value: q.clientCompanyName });
    if (q.clientCompanyUnifiedNumber) quoteSummary.push({ label: 'الرقم الموحد', value: q.clientCompanyUnifiedNumber });
    content.push(summaryTable(quoteSummary));

    var financialRows = [[
      { text: 'الإجمالي', alignment: 'right', bold: true, color: '#b8862d' },
      { text: safeMoney(total), alignment: 'center', bold: true, color: '#b8862d' }
    ]];
    content.push({
      table: { widths: ['*', 110], body: financialRows },
      layout: {
        hLineWidth: function(){ return 0.5; },
        vLineWidth: function(){ return 0.5; },
        hLineColor: function(){ return '#cbd5e1'; },
        vLineColor: function(){ return '#cbd5e1'; },
        paddingLeft: function(){ return 7; },
        paddingRight: function(){ return 7; },
        paddingTop: function(){ return 5; },
        paddingBottom: function(){ return 5; },
        fillColor: function(i){ return i === financialRows.length - 1 ? '#fdf6e8' : (i % 2 ? '#f5f4f1' : null); }
      },
      margin: [0, 0, 0, 10]
    });

    var et = elevatorTable(q.elevatorInfo);
    if (et) Array.prototype.push.apply(content, et);

    if (isInstall) {
      var plan = (q.paymentPlan && q.paymentPlan.length) ? q.paymentPlan : [];
      if (plan.length) {
        var planRows = [[
          { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'البيان', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
          { text: 'القيمة', bold: true, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' }
        ]];
        plan.forEach(function(p){
          var label = p.label || (Array.isArray(p) ? p[0] : 'دفعة');
          var desc = p.description || (Array.isArray(p) ? p[1] : '');
          var pct = p.percent > 1 ? p.percent / 100 : (p.percent || (Array.isArray(p) ? p[2] : 0));
          var amount = total * pct;
          planRows.push([
            { text: label, fontSize: 10, alignment: 'right' },
            { text: desc, fontSize: 10, color: '#64748b', alignment: 'right' },
            { text: safeMoney(amount), alignment: 'center', fontSize: 10, bold: true }
          ]);
        });
        planRows.push([
          { text: 'الإجمالي', colSpan: 2, alignment: 'left', bold: true, fontSize: 10, color: '#b8862d' },
          {},
          { text: safeMoney(total), alignment: 'center', bold: true, fontSize: 10, color: '#b8862d' }
        ]);
        content.push({ text: 'جدول الدفعات', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] });
        content.push({
          table: { headerRows: 1, keepWithHeaderRows: 2, dontBreakRows: true, widths: ['*', '*', 80], body: planRows },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#94a3b8'; },
            vLineColor: function(){ return '#94a3b8'; },
            paddingLeft: function(){ return 6; },
            paddingRight: function(){ return 6; },
            paddingTop: function(){ return 4; },
            paddingBottom: function(){ return 4; },
            fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#f1f0ec'); }
          },
          margin: [0, 0, 0, 10]
        });
      }
    }

    if (isParts) {
      var pt = partsTable(q.partsItems, 'قطع الغيار المطلوب توريدها وتركيبها');
      if (pt) Array.prototype.push.apply(content, pt);
    }

    if (!isInstall && !isParts) {
      var mt = maintenanceTable(q.maintenanceChecklist);
      if (mt) Array.prototype.push.apply(content, mt);
    }

    var pi = !isParts ? renderItems(q.partsItems, 'قطع الغيار بأقل أسعار الموردين') : null;
    if (pi) Array.prototype.push.apply(content, pi);
    var ti = renderItems(q.items, 'البنود الافتراضية');
    if (ti) Array.prototype.push.apply(content, ti);
    var ci = renderItems(q.customItems, 'البنود الإضافية');
    if (ci) Array.prototype.push.apply(content, ci);

    if (q.details) {
      content.push({ text: 'التفاصيل', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] });
      content.push({ text: q.details, fontSize: 10, color: '#475569', margin: [0, 0, 0, 10], alignment: 'right' });
    }

if (isParts) {
      content.push({
        stack: [
          { text: '', margin: [0, 0, 0, 0] },
          { stack: buildSignature(companyName, party, true), pageBreak: 'avoid', margin: [0, 0, 0, 0] }
        ],
        unbreakable: true
      });
    } else {
      content.push({
        stack: buildSignature(companyName, party, true),
        unbreakable: true,
        margin: [0, 0, 0, 0]
      });
    }
    return makeDd(content, cf, opts);
  }

  // ==================== REPORT ====================
  function reportPdfDefinition(r, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'تقرير زيارة فنية', bold: true, fontSize: 14, color: '#1e3a5f' },
        statusBadge(r.status || 'بانتظار اعتماد العميل')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم التقرير: ' + r.id, bold: true, fontSize: 12, color: '#c9a84c', alignment: 'right' },
            { text: r.technician || r.technicianId || 'الفني', fontSize: 10, color: '#64748b', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push(summaryTable([
      { label: 'العقد', value: r.contractId || 'زيارة كشفية' },
      { label: 'الطرف الثاني', value: r.clientName || r.clientCompanyName || safeLabel(r) },
      { label: 'الموقع', value: r.buildingName || 'غير محدد' },
      { label: 'موعد الزيارة', value: r.scheduledAt || 'غير محدد' },
      { label: 'تاريخ التقرير', value: r.createdAt },
      { label: 'حالة المصعد', value: r.elevatorStatus || 'غير محدد' }
    ]));

    function section(title, text){
      if (!text) return null;
      return [
        { text: title, fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' },
        { text: text, fontSize: 10, color: '#475569', margin: [0, 0, 0, 10], alignment: 'right' }
      ];
    }

    var s1 = section('الأعمال المنفذة', r.workDone);
    if (s1) Array.prototype.push.apply(content, s1);
    var s2 = section('الأعطال والملاحظات الفنية', r.issues);
    if (s2) Array.prototype.push.apply(content, s2);

    if (r.parts || r.recommendations) {
      content.push({ text: 'قطع الغيار المطلوبة / المستخدمة والتوصيات', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.parts) content.push({ text: r.parts, fontSize: 10, color: '#475569', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.recommendations) content.push({ text: r.recommendations, fontSize: 10, color: '#475569', margin: [0, 0, 0, 10], alignment: 'right' });
    }

    var s3 = section('صور أو روابط مرفقة', r.attachments);
    if (s3) Array.prototype.push.apply(content, s3);

    content.push({
      stack: buildSignature(companyName, r.clientName || r.clientCompanyName || 'العميل'),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== TICKET ====================
  function ticketPdfDefinition(t, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'بلاغ - ' + t.id, bold: true, fontSize: 14, color: '#1e3a5f' },
        statusBadge(t.status)
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      stack: [
        { text: t.title, bold: true, fontSize: 12, color: '#1e3a5f', margin: [0, 0, 0, 2], alignment: 'right' },
        { text: t.description || '', fontSize: 10, color: '#475569', margin: [0, 0, 0, 6], alignment: 'right' }
      ],
      margin: [0, 0, 0, 8]
    });
    content.push(summaryTable([
      { label: 'العميل / المنشأة', value: t.clientCompanyName || t.clientName || 'غير محدد' },
      { label: 'العقد', value: t.contractId || 'غير مرتبط' },
      { label: 'الموقع', value: (t.building && t.building.name) || 'غير محدد' },
      { label: 'المسند إليه', value: t.assignedTo || 'غير مسند' },
      { label: 'تاريخ الإنشاء', value: t.createdAt }
    ]));

    var et = elevatorTable(t.elevatorInfo);
    if (et) Array.prototype.push.apply(content, et);

    content.push({
      stack: buildSignature(companyName, t.clientCompanyName || t.clientName || 'العميل'),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== CLAIM ====================
  function claimPdfDefinition(cl, logoData, opts){
    var companyName = activeCompanyName();
    var contract;
    if (A.visibleContracts) contract = A.visibleContracts().find(function(x){ return x.id === cl.contractId; });
    var partyName = cl.clientName || (contract && (contract.clientName || contract.clientCompanyName || contract.clientPhone)) || safeLabel(cl);
    if (!partyName || partyName === 'غير محدد' || partyName.trim() === 'غير محدد') {
      if (A.contractLabel) partyName = A.contractLabel(cl);
      if (!partyName || partyName === 'غير محدد') partyName = (contract && A.contractLabel) ? A.contractLabel(contract) : (contract ? (contract.clientName || contract.clientCompanyName || 'غير محدد') : 'غير محدد');
    }
    var isReceipt = !!cl.receiptEntryId || cl.period === 'سند قبض';
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    if (isReceipt) {
      // ============ سند قبض ============
      var linkedEntry = null;
      var allEntriesForReceipt = [];
      try {
        allEntriesForReceipt = A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]');
        if (cl.receiptEntryId) linkedEntry = allEntriesForReceipt.find(function(x){ return x.id === cl.receiptEntryId; });
        if (!linkedEntry && cl.contractId) linkedEntry = allEntriesForReceipt.filter(function(x){ return x.contractId === cl.contractId && x.direction === 'in'; }).slice().reverse().find(function(x){ return Number(x.amount||0) === Number(cl.value||0); });
      } catch(e){}

      var receiptNo = cl.id || '—';
      var receiptDate = (linkedEntry && linkedEntry.date) || cl.createdAt || '—';
      var paymentMethod = (linkedEntry && linkedEntry.paymentMethod) || '—';
      var installmentLabel = (linkedEntry && (linkedEntry.paymentLabel || linkedEntry.description)) || (cl.purpose || 'دفعة من عقد');

      content.push({
        columns: [
          { text: 'سند قبض', bold: true, fontSize: 16, color: '#1e3a5f' },
          statusBadge(cl.status || 'معتمد')
        ],
        margin: [0, 0, 0, 6]
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#c9a84c' }], margin: [0, 0, 0, 6] });

      content.push({
        columns: [
          {
            stack: [
              { text: 'رقم السند', fontSize: 9, color: '#94a3b8', alignment: 'right' },
              { text: receiptNo, bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'right' }
            ],
            width: '50%'
          },
          {
            stack: [
              { text: 'تاريخ الإصدار', fontSize: 9, color: '#94a3b8', alignment: 'left' },
              { text: receiptDate, bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'left' }
            ],
            width: '50%'
          }
        ],
        margin: [0, 0, 0, 12]
      });

      content.push({
        text: 'استلمنا من السيد / الطرف الثاني الموضحة بياناته أدناه مبلغ',
        fontSize: 11, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4]
      });
      content.push({
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'المبلغ', fontSize: 9, color: '#94a3b8', alignment: 'center', margin: [0, 0, 0, 2] },
                { text: safeMoney(cl.value), bold: true, fontSize: 20, color: '#b8862d', alignment: 'center' }
              ],
              alignment: 'center',
              fillColor: '#fdf6e8',
              margin: [10, 10, 10, 10]
            }
          ]]
        },
        layout: {
          hLineWidth: function(){ return 1; },
          vLineWidth: function(){ return 0; },
          hLineColor: function(){ return '#c9a84c'; },
          paddingLeft: function(){ return 0; },
          paddingRight: function(){ return 0; },
          paddingTop: function(){ return 0; },
          paddingBottom: function(){ return 0; }
        },
        margin: [0, 0, 0, 10]
      });

      content.push(summaryTable([
        { label: 'استلمنا من', value: partyName },
        { label: 'العقد', value: cl.contractId || 'غير محدد' },
        { label: 'البيان / الدفعة', value: installmentLabel },
        { label: 'طريقة الدفع', value: paymentMethod }
      ]));

      if (contract && contract.type === 'تركيب') {
        var plan = (contract.paymentPlan && contract.paymentPlan.length) ? contract.paymentPlan : [];
        var rlabel = (linkedEntry && linkedEntry.paymentLabel) || '';
        if (rlabel && plan.length) {
          var ridx = -1;
          for (var rpi = 0; rpi < plan.length; rpi++) { var rll = Array.isArray(plan[rpi]) ? plan[rpi][0] : plan[rpi].label; if (rll === rlabel) { ridx = rpi; break; } }
          if (ridx >= 0) {
            var rp = plan[ridx];
            var rpct = Array.isArray(rp) ? rp[2] : rp.percent;
            rpct = rpct > 1 ? rpct / 100 : (rpct || 0);
            var rtotal = Number(contract.value || 0);
            var rexpected = rtotal * rpct;
            var rpaid = allEntriesForReceipt.filter(function(x){ return x.contractId === contract.id && x.direction === 'in'; }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
            var rremaining = Math.max(0, rtotal - rpaid);
            content.push(summaryTable([
              { label: 'إجمالي العقد', value: safeMoney(rtotal) },
              { label: 'الدفعة', value: rlabel },
              { label: 'المستحق لهذه الدفعة', value: safeMoney(rexpected) },
              { label: 'المتبقي بعد هذه الدفعة', value: safeMoney(rremaining) }
            ]));
          }
        }
      }

      if (cl.details) {
        content.push({ text: 'بيان', fontSize: 11, bold: true, color: '#1e3a5f', margin: [0, 4, 0, 2], alignment: 'right' });
        content.push({ text: cl.details, fontSize: 10, color: '#475569', margin: [0, 0, 0, 6], alignment: 'right' });
      }

      content.push({
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] },
          {
            columns: [
              {
                stack: [
                  { text: 'العميل (الطرف الثاني)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] },
                  { text: partyName, fontSize: 11, color: '#1e3a5f', bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
                  { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }
                ]
              },
              {
                stack: [
                  { text: 'المصدر (المنشأة)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] },
                  { text: companyName, fontSize: 11, color: '#1e3a5f', bold: true, alignment: 'center' },
                  (function(){ var stamp = (A.companyStamp && A.companyStamp()) || ''; var signature = (A.companySignature && A.companySignature()) || ''; var imgs = []; if (signature) imgs.push({ image: signature, fit: [120, 70], alignment: 'center', margin: [0, 3, 0, 0] }); if (stamp) imgs.push({ image: stamp, fit: [120, 90], alignment: 'center', margin: [0, 3, 0, 0] }); if (imgs.length) return { stack: [{ text: 'التوقيع / الختم', fontSize: 8, color: '#94a3b8', alignment: 'center' }].concat(imgs) }; return { text: 'التوقيع / الختم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }; })()
                ]
              }
            ],
            columnGap: 20,
            margin: [0, 4, 0, 6]
          }
        ],
        unbreakable: true,
        margin: [0, 0, 0, 0]
      });

      return makeDd(content, cf, opts);
    }

    // ============ مستخلص مالي (عادي) ============
    content.push({
      columns: [
        { text: 'مستخلص مالي', bold: true, fontSize: 14, color: '#1e3a5f' },
        statusBadge(cl.status || 'قيد المراجعة')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم المستخلص: ' + cl.id, bold: true, fontSize: 12, color: '#c9a84c', alignment: 'right' },
            { text: 'قيمة المستخلص', fontSize: 10, color: '#64748b', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(cl.value), bold: true, fontSize: 12, color: '#c9a84c', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push(summaryTable([
      { label: 'العقد', value: cl.contractId || 'غير محدد' },
      { label: 'الطرف الثاني', value: partyName },
      { label: 'الفترة', value: cl.period || 'غير محددة' },
      { label: 'تاريخ الإنشاء', value: cl.createdAt }
    ]));

    content.push({ text: 'بيان المستخلص', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4], alignment: 'right' });
    content.push({
      text: 'مستخلص عن الفترة الموضحة أعلاه بمبلغ إجمالي ' + safeMoney(cl.value) + ' وفق بيانات العقد والخدمات المسجلة في النظام.',
      fontSize: 10, color: '#475569', margin: [0, 0, 0, 10], alignment: 'right'
    });

    content.push({
      stack: buildSignature(companyName, partyName || 'الطرف الثاني'),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== RECEIPT ====================
  function receiptPdfDefinition(r, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'سند قبض', bold: true, fontSize: 16, color: '#1e3a5f' },
        statusBadge(r.status || 'معتمد')
      ],
      margin: [0, 0, 0, 6]
    });

    var separator = { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#c9a84c' }], margin: [0, 0, 0, 6] };
    content.push(separator);

    content.push({
      columns: [
        {
          stack: [
            { text: 'رقم السند', fontSize: 9, color: '#94a3b8', alignment: 'right' },
            { text: r.id, bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'right' }
          ],
          width: '50%'
        },
        {
          stack: [
            { text: 'تاريخ الإصدار', fontSize: 9, color: '#94a3b8', alignment: 'left' },
            { text: r.createdAt || '—', bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'left' }
          ],
          width: '50%'
        }
      ],
      margin: [0, 0, 0, 12]
    });

    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'المبلغ', fontSize: 9, color: '#94a3b8', alignment: 'center', margin: [0, 0, 0, 2] },
                { text: safeMoney(r.amount), bold: true, fontSize: 18, color: '#b8862d', alignment: 'center' }
              ],
              alignment: 'center',
              fillColor: '#fdf6e8',
              margin: [10, 8, 10, 8]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: function(){ return 1; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(){ return '#c9a84c'; },
        paddingLeft: function(){ return 0; },
        paddingRight: function(){ return 0; },
        paddingTop: function(){ return 0; },
        paddingBottom: function(){ return 0; }
      },
      margin: [0, 0, 0, 10]
    });

    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] });

    var contract = (A.visibleContracts && A.visibleContracts()) ? A.visibleContracts().find(function(x){ return x.id === r.contractId; }) : null;
    var paymentDate = r.createdAt || '—';
    if (contract && contract.type === 'صيانة' && contract.startDate) paymentDate = contract.startDate;

    var paymentMethod = '—';
    try {
      var allEntries = A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]');
      var linkedEntries = allEntries.filter(function(e){ return e.receiptId === r.id || e.contractId === r.contractId; });
      if (linkedEntries.length) {
        var methods = {};
        linkedEntries.forEach(function(e){
          if (e.paymentMethod && e.paymentMethod !== 'سند قبض') methods[e.paymentMethod] = true;
        });
        var keys = Object.keys(methods);
        if (keys.length) paymentMethod = keys.join(', ');
        else paymentMethod = linkedEntries[0].paymentMethod || 'سند قبض';
      }
    } catch(e){}

    var summaryItems = [
      { label: 'العميل', value: r.clientName || r.clientCompanyName || 'غير محدد' },
      { label: 'العقد', value: r.contractId || 'غير مرتبط' },
      { label: 'طريقة الدفع', value: paymentMethod },
      { label: 'تاريخ الدفع', value: paymentDate }
    ];
    if (r.purpose) summaryItems.push({ label: 'الغرض', value: r.purpose });
    if (r.clientCompanyUnifiedNumber) summaryItems.push({ label: 'الرقم الموحد', value: r.clientCompanyUnifiedNumber });
    content.push(summaryTable(summaryItems));

    if (r.details) {
      content.push({ text: 'تفاصيل إضافية', fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 6, 0, 4], alignment: 'right' });
      content.push({ text: r.details, fontSize: 10, color: '#475569', margin: [0, 0, 0, 10], alignment: 'right' });
    }

    content.push({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] },
        {
          columns: [
            {
              stack: [
                { text: 'المستلم (العميل)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] },
                { text: 'الاسم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' },
                { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }
              ]
            },
            {
              stack: [
                { text: 'المصدر (المنشأة)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] },
                { text: companyName, fontSize: 10, color: '#1e3a5f', bold: true, alignment: 'center' },
                (function(){ var stamp = (A.companyStamp && A.companyStamp()) || ''; var signature = (A.companySignature && A.companySignature()) || ''; var imgs = []; if (signature) imgs.push({ image: signature, fit: [120, 70], alignment: 'center', margin: [0, 3, 0, 0] }); if (stamp) imgs.push({ image: stamp, fit: [120, 90], alignment: 'center', margin: [0, 3, 0, 0] }); if (imgs.length) return { stack: [{ text: 'التوقيق / الختم', fontSize: 8, color: '#94a3b8', alignment: 'center' }].concat(imgs) }; return { text: 'التوقيق / الختم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }; })()
              ]
            }
          ],
          columnGap: 20,
          margin: [0, 4, 0, 0]
        }
      ],
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== STAFF FINANCE ====================
  function custodyPdfDefinition(c, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ columns: [ { text: 'سند عهدة', bold: true, fontSize: 16, color: '#1e3a5f' }, statusBadge(c.status || 'نشطة') ], margin: [0, 0, 0, 6] });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#c9a84c' }], margin: [0, 0, 0, 6] });
    content.push({
      columns: [
        { stack: [ { text: 'رقم السند', fontSize: 9, color: '#94a3b8', alignment: 'right' }, { text: c.id, bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'right' } ], width: '50%' },
        { stack: [ { text: 'تاريخ الإصدار', fontSize: 9, color: '#94a3b8', alignment: 'left' }, { text: c.createdAt || '—', bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'left' } ], width: '50%' }
      ],
      margin: [0, 0, 0, 12]
    });
    content.push({
      table: { widths: ['*'], body: [ [ { stack: [ { text: 'قيمة العهدة', fontSize: 9, color: '#94a3b8', alignment: 'center', margin: [0, 0, 0, 2] }, { text: safeMoney(c.value), bold: true, fontSize: 18, color: '#b8862d', alignment: 'center' } ], alignment: 'center', fillColor: '#fdf6e8', margin: [10, 8, 10, 8] } ] ] },
      layout: { hLineWidth: function(){ return 1; }, vLineWidth: function(){ return 0; }, hLineColor: function(){ return '#c9a84c'; }, paddingLeft: function(){ return 0; }, paddingRight: function(){ return 0; }, paddingTop: function(){ return 0; }, paddingBottom: function(){ return 0; } },
      margin: [0, 0, 0, 10]
    });
    var summaryItems = [
      { label: 'الموظف', value: c.staffName || c.staffIdentity || 'غير محدد' },
      { label: 'الهوية', value: c.staffIdentity || '—' },
      { label: 'المخصوم من الراتب', value: safeMoney(c.deducted || 0) },
      { label: 'المتبقي', value: safeMoney(c.remaining || 0) }
    ];
    if (c.description) summaryItems.push({ label: 'البيان', value: c.description });
    content.push(summaryTable(summaryItems));
    content.push({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] },
        {
          columns: [
            { stack: [ { text: 'الموظف (المستلم)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: 'الاسم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }, { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] },
            { stack: [ { text: 'المصدر (المنشأة)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: companyName, fontSize: 10, color: '#1e3a5f', bold: true, alignment: 'center' }, { text: 'التوقيع / الختم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] }
          ],
          columnGap: 20,
          margin: [0, 4, 0, 0]
        }
      ],
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  function payrollPdfDefinition(p, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ columns: [ { text: 'مسير رواتب', bold: true, fontSize: 16, color: '#1e3a5f' }, statusBadge(p.status || 'مسدد') ], margin: [0, 0, 0, 6] });
    content.push(summaryTable([
      { label: 'الفترة', value: p.period || '—' },
      { label: 'عدد الموظفين', value: String((p.rows || []).length) },
      { label: 'الإجمالي الصافي', value: safeMoney(p.totalNet) },
      { label: 'خصم العهد', value: safeMoney(p.totalCustodyDeducted || 0) }
    ]));
    var payrollRows = (p.rows || []).map(function(row){
      return [
        { text: row.staffName || '—', bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'right' },
        { text: safeMoney(row.base), fontSize: 10, alignment: 'center' },
        { text: safeMoney(row.allowances), fontSize: 10, alignment: 'center' },
        { text: safeMoney(row.deductions), fontSize: 10, alignment: 'center' },
        { text: safeMoney(row.custodyDeduction), fontSize: 10, alignment: 'center' },
        { text: safeMoney(row.net), bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'center' }
      ];
    });
    var payrollHeader = [
      { text: 'الموظف', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'right' },
      { text: 'الراتب', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'البدلات', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'الخصومات', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'العهدة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' },
      { text: 'الصافي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center' }
    ];
    content.push({
      table: { widths: ['*', 70, 70, 70, 70, 80], body: [payrollHeader].concat(payrollRows) },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10]
    });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] });
    content.push({
      columns: [
        { stack: [ { text: 'إعداد (الإدارة المالية)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] },
        { stack: [ { text: 'اعتماد (المالك)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] }
      ],
      columnGap: 20,
      margin: [0, 6, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  function salaryReceiptPdfDefinition(r, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ columns: [ { text: 'سند قبض راتب', bold: true, fontSize: 16, color: '#1e3a5f' }, statusBadge('معتمد') ], margin: [0, 0, 0, 6] });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#c9a84c' }], margin: [0, 0, 0, 6] });
    content.push({
      table: { widths: ['*'], body: [ [ { stack: [ { text: 'صافي الراتب المستلم', fontSize: 9, color: '#94a3b8', alignment: 'center', margin: [0, 0, 0, 2] }, { text: safeMoney(r.amount), bold: true, fontSize: 18, color: '#b8862d', alignment: 'center' } ], alignment: 'center', fillColor: '#fdf6e8', margin: [10, 8, 10, 8] } ] ] },
      layout: { hLineWidth: function(){ return 1; }, vLineWidth: function(){ return 0; }, hLineColor: function(){ return '#c9a84c'; }, paddingLeft: function(){ return 0; }, paddingRight: function(){ return 0; }, paddingTop: function(){ return 0; }, paddingBottom: function(){ return 0; } },
      margin: [0, 0, 0, 10]
    });
    var salaryDetails = (r.details || []).map(function(d){ return { label: d.label, value: safeMoney(d.value) }; });
    salaryDetails.push({ label: 'الصافي', value: safeMoney(r.amount) });
    content.push(summaryTable([
      { label: 'الموظف', value: r.staffName || '—' },
      { label: 'الهوية', value: r.staffIdentity || '—' },
      { label: 'الفترة', value: r.period || '—' }
    ].concat(salaryDetails)));
    content.push({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 6] },
        { text: 'أستلمت أنا (الموظف) من مؤسسة (' + companyName + ') مبلغ ' + safeMoney(r.amount) + ' ريال صافي راتب عن فترة (' + (r.period || '—') + ')، وتقررت بذلك براءة ذمتي.', fontSize: 10, color: '#475569', alignment: 'right', margin: [0, 0, 0, 8] },
        {
          columns: [
            { stack: [ { text: 'الموظف (المستلم)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: 'الاسم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' }, { text: 'التوقيع: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] },
            { stack: [ { text: 'المصدر (المنشأة)', fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 4] }, { text: companyName, fontSize: 10, color: '#1e3a5f', bold: true, alignment: 'center' }, { text: 'التوقيع / الختم: ...............................', fontSize: 10, color: '#94a3b8', alignment: 'center' } ] }
          ],
          columnGap: 20,
          margin: [0, 4, 0, 0]
        }
      ],
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  function contractFinancePdfDefinition(c, logoData, opts){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'إيصال سداد مالي', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push({
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'رقم العقد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: 'الطرف الثاني', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: 'إجمالي العقد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] }
          ],
          [
            { text: String(c.id), bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: safeLabel(c), bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: safeMoney(c.value), bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] }
          ]
        ]
      },
      layout: {
        hLineWidth: function(i){ return i === 0 ? 0 : 0.35; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(){ return '#cbd5e1'; },
        vLineColor: function(){ return '#cbd5e1'; },
        paddingLeft: function(){ return 4; },
        paddingRight: function(){ return 4; },
        paddingTop: function(){ return 1; },
        paddingBottom: function(){ return 1; },
        fillColor: function(i){ return i === 0 ? null : '#f8f7f4'; }
      },
      margin: [0, 0, 0, 2]
    });
    var allEntries = [], paid = 0, remaining = 0, overdue = 0, installmentEntries = [];
    try {
      allEntries = JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]');
      installmentEntries = allEntries.filter(function(x){ return x.contractId === c.id && x.direction === 'in'; });
      paid = installmentEntries.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
      remaining = Math.max(0, Number(c.value||0) - paid);
      overdue = 0;
      if (Number(c.value||0) > 0 && c.type === 'تركيب') {
        var plan = (c.paymentPlan && c.paymentPlan.length) ? c.paymentPlan : [{label:"الدفعة الأولى",percent:0.5},{label:"الدفعة الثانية",percent:0.35},{label:"الدفعة الثالثة",percent:0.15}];
        var completion = c.stageCompletion || {};
        var pctOfPlan = function(p){ var v; if(Array.isArray(p)){ v = p[2]; } else { v = p.percent; } return v > 1 ? v / 100 : (v || 0); };
        var labelOfPlan = function(p){ return Array.isArray(p) ? p[0] : (p.label || ''); };
        plan.forEach(function(p){
          var expected = Number(c.value||0) * pctOfPlan(p);
          var received = installmentEntries.filter(function(x){ return x.paymentLabel === labelOfPlan(p); }).reduce(function(a,x){ return a + Number(x.amount||0); }, 0);
          var premaining = Math.max(0, expected - received);
          var pdone = !!(completion[labelOfPlan(p)] && completion[labelOfPlan(p)].done);
          if (pdone && premaining > 0) overdue += premaining;
        });
      }
    } catch(e){}
    content.push({
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            { text: '', fontSize: 10, alignment: 'center' },
            { text: 'المدفوع', bold: true, fontSize: 10, color: '#64748b', alignment: 'center' },
            { text: 'المتبقي', bold: true, fontSize: 10, color: '#64748b', alignment: 'center' },
            { text: 'المتأخر', bold: true, fontSize: 10, color: '#64748b', alignment: 'center' }
          ],
          [
            { text: '', alignment: 'center' },
            { text: safeMoney(paid), bold: true, fontSize: 10, color: '#2d7d6d', alignment: 'center', margin: [0, 3, 0, 3] },
            { text: safeMoney(remaining), bold: true, fontSize: 10, color: remaining > 0 ? '#dc2626' : '#2d7d6d', alignment: 'center', margin: [0, 3, 0, 3] },
            { text: safeMoney(overdue), bold: true, fontSize: 10, color: overdue > 0 ? '#dc2626' : '#2d7d6d', alignment: 'center', margin: [0, 3, 0, 3] }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2]
    });
    if (installmentEntries.length) {
      var sorted = installmentEntries.sort(function(a,b){ return (b.createdAtMs||0) - (a.createdAtMs||0); }).slice(0, 5);
      var rows = sorted.map(function(e){
        return [
          { text: e.description || e.paymentLabel || '—', fontSize: 10, alignment: 'right' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.date || '—', fontSize: 10, alignment: 'center' },
          { text: e.paymentMethod || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ text: 'سجل الدفعات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      content.push({
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          headerRows: 1,
          body: [
            [
              { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
              { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
              { text: 'تاريخ الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
              { text: 'طريقة الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
            ]
          ].concat(rows)
        },
        margin: [0, 0, 0, 4]
      });
    }
    if (c.type === 'تركيب') {
      try {
        var plan = (c.paymentPlan && c.paymentPlan.length) ? c.paymentPlan : [{label:"الدفعة الأولى",percent:0.5},{label:"الدفعة الثانية",percent:0.35},{label:"الدفعة الثالثة",percent:0.15}];
        var completion = c.stageCompletion || {};
        var pctOfPlan = function(p){ var v; if(Array.isArray(p)){ v = p[2]; } else { v = p.percent; } return v > 1 ? v / 100 : (v || 0); };
        var labelOfPlan = function(p){ return Array.isArray(p) ? p[0] : (p.label || ''); };
        var planRows = plan.map(function(p){
          var expected = Number(c.value||0) * pctOfPlan(p);
          var ppaid = installmentEntries.filter(function(x){ return x.paymentLabel === labelOfPlan(p); }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
          var premaining = Math.max(0, expected - ppaid);
          var pdone = !!(completion[labelOfPlan(p)] && completion[labelOfPlan(p)].done);
          return [
            { text: labelOfPlan(p), fontSize: 10, alignment: 'right' },
            { text: safeMoney(expected), fontSize: 10, alignment: 'center' },
            { text: safeMoney(ppaid), fontSize: 10, alignment: 'center' },
            { text: safeMoney(premaining), fontSize: 10, alignment: 'center', bold: true, color: premaining > 0 ? '#dc2626' : '#2d7d6d' },
            { text: pdone ? (premaining > 0 ? 'متأخرة' : 'مكتملة') : 'لم تبدأ', fontSize: 10, alignment: 'center', bold: true, color: pdone ? (premaining > 0 ? '#dc2626' : '#2d7d6d') : '#94a3b8' }
          ];
        });
        content.push({ text: 'خطة الدفعات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
        content.push({
          table: {
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            headerRows: 1,
            body: [
              [
                { text: 'الدفعة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
                { text: 'المستحق', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
                { text: 'المدفوع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
                { text: 'المتبقي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
                { text: 'الحالة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] }
              ]
            ].concat(planRows)
          },
          margin: [0, 0, 0, 4]
        });
      } catch(e){}
    }
    var stamp = (A.companyStamp && A.companyStamp()) || '';
    var sig = (A.companySignature && A.companySignature()) || '';
    var partyOneApproval = [];
    if (sig) partyOneApproval.push({
      stack: [
        { text: 'التوقيع', fontSize: 9, color: '#94a3b8', alignment: 'center' },
        { image: sig, fit: [220, 140], alignment: 'center', margin: [0, 2, 0, 0] }
      ],
      width: '*'
    });
    if (stamp) partyOneApproval.push({
      stack: [
        { text: 'الختم', fontSize: 9, color: '#94a3b8', alignment: 'center' },
        { image: stamp, fit: [200, 140], alignment: 'center', margin: [0, 2, 0, 0] }
      ],
      width: '*'
    });
    content.push({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: '#94a3b8' }], margin: [0, 0, 0, 1] },
        {
          stack: [
            { text: companyName, bold: true, fontSize: 10, color: '#1e3a5f', alignment: 'center', margin: [0, 0, 0, 0] },
            partyOneApproval.length
              ? { columns: partyOneApproval, columnGap: 4, margin: [0, 1, 0, 0] }
              : { text: 'التوقيع: ........................', fontSize: 10, color: '#94a3b8', alignment: 'center' }
          ],
          alignment: 'center'
        }
      ],
      unbreakable: true,
      margin: [0, 2, 0, 0]
    });
    return makeDd(content, cf, opts);
  }
  // ==================== MAIN ENTRY ====================
  function contractPaymentsPdfDefinition(c, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'كشف دفعات العقد', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم العقد', value: String(c.id) },
      { label: 'الطرف الثاني', value: safeLabel(c) },
      { label: 'إجمالي العقد', value: safeMoney(c.value) }
    ]));
    var entries = [];
    try { entries = JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]'); } catch(e){}
    var inEntries = entries.filter(function(x){ return x.contractId === c.id && x.direction === 'in'; })
      .sort(function(a,b){ return (b.createdAtMs||0) - (a.createdAtMs||0); });
    var paid = inEntries.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var remaining = Math.max(0, Number(c.value||0) - paid);
    content.push(summaryTable([
      { label: 'المدفوع', value: safeMoney(paid) },
      { label: 'المتبقي', value: safeMoney(remaining) }
    ]));
    if (c.type === 'تركيب') {
      var plan = (c.paymentPlan && c.paymentPlan.length) ? c.paymentPlan : [{label:"الدفعة الأولى",percent:0.5},{label:"الدفعة الثانية",percent:0.35},{label:"الدفعة الثالثة",percent:0.15}];
      var pctOfPlan = function(p){ var v; if(Array.isArray(p)){ v = p[2]; } else { v = p.percent; } return v > 1 ? v / 100 : (v || 0); };
      var labelOfPlan = function(p){ return Array.isArray(p) ? p[0] : (p.label || ''); };
      var planRows = plan.map(function(p){
        var expected = Number(c.value||0) * pctOfPlan(p);
        var ppaid = inEntries.filter(function(x){ return x.paymentLabel === labelOfPlan(p); }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
        var premaining = Math.max(0, expected - ppaid);
        return [
          { text: labelOfPlan(p), fontSize: 10, alignment: 'right' },
          { text: safeMoney(expected), fontSize: 10, alignment: 'center' },
          { text: safeMoney(ppaid), fontSize: 10, alignment: 'center' },
          { text: safeMoney(premaining), fontSize: 10, alignment: 'center', bold: true, color: premaining > 0 ? '#dc2626' : '#2d7d6d' }
        ];
      });
      content.push({ text: 'خطة الدفعات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      content.push({
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          headerRows: 1,
          body: [
            [
              { text: 'الدفعة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
              { text: 'المستحق', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
              { text: 'المدفوع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] },
              { text: 'المتبقي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1, 1, 1, 1] }
            ]
          ].concat(planRows)
        },
        margin: [0, 0, 0, 4]
      });
    }
    content.push({ text: 'سجل الدفعات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if (inEntries.length) {
      var rows = inEntries.map(function(e){
        return [
          { text: e.description || e.paymentLabel || '—', fontSize: 10, alignment: 'right' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.date || '—', fontSize: 10, alignment: 'center' },
          { text: e.paymentMethod || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'تاريخ الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'طريقة الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد دفعات مسجلة', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }

  function installmentPdfDefinition(c, label, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var allEntries = [];
    try { allEntries = JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]'); } catch(e){}
    var inEntries = allEntries.filter(function(x){ return x.contractId === c.id && x.direction === 'in' && (x.paymentLabel === label || x.description === label); });
    var planDef = (c.paymentPlan && c.paymentPlan.length) ? c.paymentPlan : [{label:"الدفعة الأولى",percent:0.5},{label:"الدفعة الثانية",percent:0.35},{label:"الدفعة الثالثة",percent:0.15}];
    var pctOf2 = function(p){ var v; if(Array.isArray(p)){ v = p[2]; } else { v = p.percent; } return v > 1 ? v / 100 : (v || 0); };
    var labelOf2 = function(p){ return Array.isArray(p) ? p[0] : (p.label || ''); };
    var planOf = planDef.find(function(p){ return labelOf2(p) === label; });
    var expected = planOf ? (Number(c.value||0) * pctOf2(planOf)) : (inEntries.length ? inEntries[0].amount : 0);
    var collected = inEntries.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var allocated = 0, expenseUsed = 0, invoices = [];
    try {
      var allInv = JSON.parse(localStorage.getItem('misadPurchaseInvoices') || '[]');
      allInv.filter(function(x){ return x.contractId === c.id; }).forEach(function(x){
        var alloc = (x.allocations || []).filter(function(a){ return a.label === label; });
        if (alloc.length) { allocated += alloc.reduce(function(s,a){ return s + Number(a.amount||0); }, 0); invoices.push(x); }
      });
    } catch(e){}
    try {
      var allExp = JSON.parse(localStorage.getItem('misadContractExpenses') || '[]');
      expenseUsed = allExp.filter(function(x){ return x.contractId === c.id && x.installmentLabel === label; }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    } catch(e){}
    var used = allocated + expenseUsed;
    var available = Math.max(0, collected - used);
    var usagePct = collected > 0 ? Math.round((used / collected) * 100) : 0;
    var saved = {};
    try { saved = (JSON.parse(localStorage.getItem('misadContractPayments') || '[]') || []).find(function(x){ return x.contractId === c.id && x.label === label; }) || {}; } catch(e){}
    content.push({ text: 'كشف الدفعة', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'الدفعة', value: label },
      { label: 'العقد', value: String(c.id) + ' - ' + safeLabel(c) },
      { label: 'تاريخ الاستحقاق', value: saved.dueDate || '—' }
    ]));
    content.push(summaryTable([
      { label: 'قيمة الدفعة', value: safeMoney(expected) },
      { label: 'المحصل', value: safeMoney(collected) },
      { label: 'المتبقي للتحصيل', value: safeMoney(Math.max(0, expected - collected)) }
    ]));
    content.push({ text: 'ملخص استخدام الدفعة', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    content.push({ table: { widths: ['*', 'auto'], headerRows: 1, body: [
      [ { text: 'البند', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1,1,1,1] },
        { text: 'القيمة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1,1,1,1] } ],
      [ { text: 'المحصل من الدفعة', fontSize: 10 }, { text: safeMoney(collected), fontSize: 10, alignment: 'center' } ],
      [ { text: 'المستخدم في المشتريات', fontSize: 10 }, { text: safeMoney(allocated), fontSize: 10, alignment: 'center' } ],
      [ { text: 'المستخدم في المصروفات', fontSize: 10 }, { text: safeMoney(expenseUsed), fontSize: 10, alignment: 'center' } ],
      [ { text: 'الرصيد المتاح', fontSize: 10, bold: true }, { text: safeMoney(available), fontSize: 10, alignment: 'center', bold: true, color: available > 0 ? '#2d7d6d' : '#dc2626' } ],
      [ { text: 'نسبة الاستخدام', fontSize: 10 }, { text: usagePct + '%', fontSize: 10, alignment: 'center' } ]
    ] }, margin: [0, 0, 0, 4] });
    if (invoices.length) {
      content.push({ text: 'المشتريات الممولة من الدفعة', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      var iRows = invoices.map(function(x){
        var allocAmt = (x.allocations || []).filter(function(a){ return a.label === label; }).reduce(function(s,a){ return s + Number(a.amount||0); }, 0);
        return [
          { text: x.invoiceNo || x.id, fontSize: 10, alignment: 'right' },
          { text: safeMoney(allocAmt), fontSize: 10, alignment: 'center' },
          { text: safeMoney(x.total), fontSize: 10, alignment: 'center' },
          { text: x.status || 'مستحقة', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [ { text: 'الفاتورة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'المخصص', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الإجمالي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الحالة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(iRows) }, margin: [0, 0, 0, 4] });
    }
    content.push({ text: 'حركة الدفعة', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if (inEntries.length) {
      var mRows = inEntries.sort(function(a,b){ return (b.createdAtMs||0) - (a.createdAtMs||0); }).map(function(e){
        return [
          { text: e.description || e.paymentLabel || '—', fontSize: 10, alignment: 'right' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.paymentMethod || '—', fontSize: 10, alignment: 'center' },
          { text: e.date || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [ { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'طريقة الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
        ].concat(mRows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد حركة على الدفعة', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }

  function customerInvoicePdfDefinition(inv, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var contract = {};
    if (A.visibleContracts) contract = A.visibleContracts().find(function(x){ return x.id === inv.contractId; }) || {};
    var invPayments = Array.isArray(inv.payments) ? inv.payments : [];
    var paid = invPayments.length ? invPayments.reduce(function(s,p){ return s + Math.max(0, Number(p.amount||0)); }, 0) : Math.max(0, Number(inv.paid||0));
    var total = Number(inv.total||0);
    var rawStatus = String(inv.status || '').trim().toLowerCase();
    var cancelled = ['ملغي','ملغى','ملغاة','ملغية','محذوف','cancelled','canceled','deleted'].indexOf(rawStatus) >= 0;
    var due = cancelled ? 0 : Math.max(0, total - paid);
    var status = cancelled ? 'ملغاة' : (due <= 0 && total > 0 ? 'مدفوعة' : (paid > 0 ? 'جزئية' : 'مستحقة'));
    var clName = inv.clientName || (contract.id ? safeLabel(contract) : (inv.clientCompanyName || '—'));
    content.push({ text: 'فاتورة عميل', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم الفاتورة', value: inv.invoiceNo || inv.id },
      { label: 'العميل', value: clName },
      { label: 'المنشأة', value: inv.clientCompanyName || contract.clientCompanyName || '—' }
    ]));
    content.push(summaryTable([
      { label: 'التاريخ', value: inv.date || '—' },
      { label: 'تاريخ الاستحقاق', value: inv.dueDate || '—' },
      { label: 'الحالة', value: status }
    ]));
    content.push({ text: 'بنود الفاتورة', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if ((inv.items||[]).length) {
      var itemRows = inv.items.map(function(x){
        return [
          { text: x.description || '—', fontSize: 10, alignment: 'right' },
          { text: String(x.qty||1), fontSize: 10, alignment: 'center' },
          { text: safeMoney(x.unitPrice), fontSize: 10, alignment: 'center' },
          { text: safeMoney(Number(x.qty||1)*Number(x.unitPrice||0)), fontSize: 10, alignment: 'center', bold: true }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [ { text: 'الوصف', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الكمية', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'سعر الوحدة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الإجمالي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(itemRows) }, margin: [0, 0, 0, 4] });
    }
    content.push({ text: 'ملخص المبالغ', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    var amountRows = [
      [ { text: 'البند', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1,1,1,1] },
        { text: 'القيمة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [1,1,1,1] } ],
      [ { text: 'المجموع الفرعي', fontSize: 10 }, { text: safeMoney(inv.subtotal), fontSize: 10, alignment: 'center' } ]
    ];
    if (Number(inv.tax||0) > 0) amountRows.push([
      { text: 'ضريبة محفوظة من فاتورة سابقة (' + Number(inv.taxRate||0) + '%)', fontSize: 10 },
      { text: safeMoney(inv.tax), fontSize: 10, alignment: 'center' }
    ]);
    amountRows.push(
      [ { text: 'الخصم', fontSize: 10 }, { text: safeMoney(inv.discount||0), fontSize: 10, alignment: 'center' } ],
      [ { text: 'الإجمالي', fontSize: 10, bold: true }, { text: safeMoney(total), fontSize: 10, alignment: 'center', bold: true } ],
      [ { text: 'المحصل', fontSize: 10 }, { text: safeMoney(paid), fontSize: 10, alignment: 'center' } ],
      [ { text: 'المتبقي', fontSize: 10, bold: true }, { text: safeMoney(due), fontSize: 10, alignment: 'center', bold: true, color: due > 0 ? '#dc2626' : '#2d7d6d' } ]
    );
    content.push({ table: { widths: ['*', 'auto'], headerRows: 1, body: amountRows }, margin: [0, 0, 0, 4] });
    if ((inv.payments||[]).length && (inv.payments||[]).some(function(p){ return p; })) {
      content.push({ text: 'سجل التحصيل', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      var payRows = inv.payments.map(function(p){
        return [
          { text: p.date || '—', fontSize: 10, alignment: 'center' },
          { text: safeMoney(p.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: p.paymentMethod || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['auto', 'auto', '*'], headerRows: 1, body: [
        [ { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'طريقة الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(payRows) }, margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }

  function treasuryPdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var tx=[],banks=[],cash=0;
    var ledgerState = null;
    try { if (A.treasuryState) ledgerState = A.treasuryState(); } catch(e){}
    if (ledgerState) {
      tx = (ledgerState.tx || []).slice();
      banks = (ledgerState.banks || []).map(function(b){ return Object.assign({}, b); });
      cash = Number(ledgerState.cash || 0);
    } else {
      try { tx = A._read ? A._read('misadTreasury') : JSON.parse(localStorage.getItem('misadTreasury') || '[]'); } catch(e){}
      try { banks = A._read ? A._read('misadBankAccounts') : JSON.parse(localStorage.getItem('misadBankAccounts') || '[]'); } catch(e){}
      if (A.sameCompany) tx=tx.filter(function(x){return A.sameCompany(x);});
      if (A.sameCompany) banks=banks.filter(function(x){return A.sameCompany(x);});
      banks = banks.map(function(b){ return Object.assign({}, b, { balance: 0 }); });
      tx.slice().sort(function(a,b){ return (a.createdAtMs||0)-(b.createdAtMs||0); }).forEach(function(t){
        var amt=Number(t.amount||0);
        if(t.type==='transfer'){var from=t.from==='cash'?null:banks.find(function(b){return b.id===t.from;}),to=t.to==='cash'?null:banks.find(function(b){return b.id===t.to;});if(from)from.balance-=amt;else cash-=amt;if(to)to.balance+=amt;else cash+=amt;}
        else{var target=t.account==='cash'?null:banks.find(function(b){return b.id===t.account;});if(t.type==='opening'){if(target)target.balance=amt;else cash=amt;}
        else if(t.type==='deposit'){if(target)target.balance+=amt;else cash+=amt;}
        else if(t.type==='withdraw'){if(target)target.balance-=amt;else cash-=amt;}}
      });
    }
    var bankTotal=banks.reduce(function(s,b){return s+b.balance;},0);
    var grand=cash+bankTotal;
    content.push({ text: 'كشف الخزينة والبنوك', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رصيد الخزينة (نقد)', value: safeMoney(cash) },
      { label: 'إجمالي البنوك', value: safeMoney(bankTotal) },
      { label: 'الإجمالي', value: safeMoney(grand) }
    ]));
    if (banks.length) {
      content.push({ text: 'الحسابات البنكية', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      var bRows = banks.map(function(b){
        return [
          { text: b.bankName || '—', fontSize: 10, alignment: 'right' },
          { text: b.accountName || '—', fontSize: 10, alignment: 'right' },
          { text: b.accountNumber || b.iban || '—', fontSize: 10, alignment: 'left' },
          { text: safeMoney(b.balance), fontSize: 10, alignment: 'center', bold: true }
        ];
      });
      content.push({ table: { widths: ['*', '*', 'auto', 'auto'], headerRows: 1, body: [
        [ { text: 'البنك', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'اسم الحساب', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'رقم الحساب / الآيبان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الرصيد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(bRows) }, margin: [0, 0, 0, 4] });
    }
    content.push({ text: 'حركات الخزينة والبنوك', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    var tRows = tx.slice().sort(function(a,b){ return (b.createdAtMs||0)-(a.createdAtMs||0); }).map(function(t){
      var nm;
      if(t.type==='transfer') nm = (t.from==='cash'?'الخزينة':((banks.find(function(b){return b.id===t.from;})||{}).bankName||t.from)) + ' ← ' + (t.to==='cash'?'الخزينة':((banks.find(function(b){return b.id===t.to;})||{}).bankName||t.to));
      else nm = (t.account==='cash'?'الخزينة':(banks.find(function(b){return b.id===t.account;})||{}).bankName||t.account);
      var tt = ({opening:'رصيد افتتاحي',deposit:'إيداع',withdraw:'سحب',transfer:'تحويل'})[t.type]||t.type;
      return [
        { text: tt, fontSize: 10, alignment: 'center' },
        { text: nm, fontSize: 10, alignment: 'right' },
        { text: safeMoney(t.amount), fontSize: 10, alignment: 'center', bold: true },
        { text: t.date || '—', fontSize: 10, alignment: 'center' },
        { text: t.note || '—', fontSize: 10, alignment: 'right' }
      ];
    });
    if (tRows.length) {
      content.push({ table: { widths: ['auto', '*', 'auto', 'auto', '*'], headerRows: 1, body: [
        [ { text: 'النوع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الحساب', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(tRows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد حركات خزينة', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }

  function purchaseInvoicePdfDefinition(pi, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var supplier = {};
    try {
      var supList = JSON.parse(localStorage.getItem('misadSuppliers') || '[]');
      supplier = supList.find(function(s){ return s.id === pi.supplierId; }) || {};
    } catch(e){}
    var contract = {};
    if (A.visibleContracts) contract = A.visibleContracts().find(function(x){ return x.id === pi.contractId; }) || {};
    content.push({ text: 'فاتورة شراء', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم الفاتورة', value: pi.invoiceNo || pi.id },
      { label: 'المورد', value: supplier.name || pi.supplierId || '—' },
      { label: 'العقد', value: pi.contractId ? (pi.contractId + ' - ' + safeLabel(contract)) : 'بدون ربط' }
    ]));
    var purchaseSummary = [
      { label: 'التاريخ', value: pi.date || '—' },
      { label: 'القيمة الأساسية', value: safeMoney(pi.subtotal) },
      { label: 'الإجمالي', value: safeMoney(pi.total) }
    ];
    if (Number(pi.tax||0) > 0) purchaseSummary.splice(2, 0, {
      label: 'ضريبة محفوظة من فاتورة سابقة (' + Number(pi.taxRate||0) + '%)',
      value: safeMoney(pi.tax)
    });
    content.push(summaryTable(purchaseSummary));
    if (pi.payments && pi.payments.length) {
      content.push({ text: 'سجل السداد', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      var pRows = pi.payments.map(function(p){
        return [
          { text: p.note || 'دفعة مورد', fontSize: 10, alignment: 'right' },
          { text: safeMoney(p.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: p.date || '—', fontSize: 10, alignment: 'center' },
          { text: p.paymentMethod || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'طريقة الدفع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(pRows) }, margin: [0, 0, 0, 4] });
    }
    content.push(summaryTable([
      { label: 'المدفوع', value: safeMoney(pi.paid) },
      { label: 'المتبقي', value: safeMoney(Math.max(0, Number(pi.total||0) - Number(pi.paid||0))) },
      { label: 'الحالة', value: pi.status || 'مستحقة' }
    ]));
    if (pi.notes) content.push({ text: 'ملاحظات: ' + pi.notes, fontSize: 10, color: '#64748b', margin: [0, 2, 0, 2] });
    return makeDd(content, cf, opts);
  }

  function contractExpensesPdfDefinition(c, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'كشف مصروفات العقد', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم العقد', value: String(c.id) },
      { label: 'الطرف الثاني', value: safeLabel(c) },
      { label: 'قيمة العقد', value: safeMoney(c.value) }
    ]));
    var list = [];
    try { list = JSON.parse(localStorage.getItem('misadContractExpenses') || '[]'); } catch(e){}
    list = list.filter(function(x){ return x.contractId === c.id; })
      .sort(function(a,b){ return (b.createdAtMs||0) - (a.createdAtMs||0); });
    var total = list.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    content.push(summaryTable([{ label: 'إجمالي المصروفات', value: safeMoney(total) }]));
    content.push({ text: 'المصروفات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if (list.length) {
      var rows = list.map(function(x){
        return [
          { text: x.description || '—', fontSize: 10, alignment: 'right' },
          { text: x.category || '—', fontSize: 10, alignment: 'center' },
          { text: safeMoney(x.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: x.date || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التصنيف', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد مصروفات مسجلة', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }

  function contractProfitPdfDefinition(c, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'مؤشر التدفق التشغيلي للعقد', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push({ text: 'مؤشر إداري مبني على المحصل والتكاليف المسجلة، وليس صافي ربح محاسبياً. استخدم قائمة الدخل للنتيجة المحاسبية.', fontSize: 9, color: '#64748b', margin: [0, 0, 0, 4] });
    content.push(summaryTable([
      { label: 'رقم العقد', value: String(c.id) },
      { label: 'الطرف الثاني', value: safeLabel(c) },
      { label: 'قيمة العقد', value: safeMoney(c.value) }
    ]));
    var entries = [], invList = [], expList = [];
    try { entries = JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]'); } catch(e){}
    try { invList = JSON.parse(localStorage.getItem('misadPurchaseInvoices') || '[]'); } catch(e){}
    try { expList = JSON.parse(localStorage.getItem('misadContractExpenses') || '[]'); } catch(e){}
    var paid = entries.filter(function(x){ return x.contractId === c.id && x.direction === 'in'; })
      .reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var purchases = invList.filter(function(x){ return x.contractId === c.id; })
      .reduce(function(s,x){ return s + Number(x.total||0); }, 0);
    var expenses = expList.filter(function(x){ return x.contractId === c.id; })
      .reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var net = paid - purchases - expenses;
    var total = Number(c.value||0);
    var margin = total > 0 ? (net / total) * 100 : 0;
    var rows = [
      { label: 'إجمالي المحصل', value: safeMoney(paid) },
      { label: 'تكلفة المشتريات', value: safeMoney(purchases) },
      { label: 'مصروفات العقد', value: safeMoney(expenses) },
      { label: 'إجمالي التكاليف', value: safeMoney(purchases + expenses) },
      { label: 'صافي المؤشر', value: safeMoney(net) },
      { label: 'نسبة المؤشر إلى قيمة العقد', value: margin.toFixed(1) + '%' }
    ];
    content.push({
      table: {
        widths: ['*', '*'],
        body: rows.map(function(r){
          return [
            { text: r.label, fontSize: 10, color: '#64748b', alignment: 'right', margin: [2, 2, 2, 2] },
            { text: r.value, fontSize: 10, bold: true, color: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
          ];
        })
      },
      layout: {
        hLineWidth: function(i){ return i === 0 ? 0 : 0.35; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(){ return '#cbd5e1'; },
        vLineColor: function(){ return '#cbd5e1'; },
        paddingLeft: function(){ return 8; },
        paddingRight: function(){ return 8; },
        paddingTop: function(){ return 4; },
        paddingBottom: function(){ return 4; },
        fillColor: function(i){ return i === 0 ? null : '#f8f7f4'; }
      },
      margin: [0, 0, 0, 4]
    });
    return makeDd(content, cf, opts);
  }
  function financeSummaryPdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'التقرير المالي الشامل', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    var entries = [], income = 0, expense = 0;
    try {
      var raw = (A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]'));
      var scoped = raw.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; });
      var cashSummary = A.financeCashSummary ? A.financeCashSummary() : null;
      if (cashSummary) {
        entries = (cashSummary.movements || []).slice();
        income = Number(cashSummary.received || 0);
        expense = Number(cashSummary.paid || 0);
      } else {
        entries = scoped.filter(function(x){
          var status = String(x.status || '').trim().toLowerCase();
          return Number(x.amount||0)>0 && (x.direction==='in'||x.direction==='out') &&
            ['مسودة','مستحق','مستحقة','مستلمة','ملغي','ملغى','ملغاة','ملغية','محذوف','cancelled','canceled','deleted'].indexOf(status)<0 &&
            ['allowance','deduction'].indexOf(String(x.type||''))<0;
        });
        income = entries.filter(function(x){ return x.direction === 'in'; }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
        expense = entries.filter(function(x){ return x.direction === 'out'; }).reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
      }
    } catch(e){}
    content.push(summaryTable([
      { label: 'المقبوضات الفعلية', value: safeMoney(income) },
      { label: 'المدفوعات الفعلية', value: safeMoney(expense) },
      { label: 'صافي التدفق النقدي', value: safeMoney(income - expense) }
    ]));
    var tx = [], banks = [];
    var cash = 0, summaryLedgerState = null;
    try { if (A.treasuryState) summaryLedgerState = A.treasuryState(); } catch(e){}
    if (summaryLedgerState) {
      tx = (summaryLedgerState.tx || []).slice();
      banks = (summaryLedgerState.banks || []).map(function(b){ return Object.assign({}, b); });
      cash = Number(summaryLedgerState.cash || 0);
    } else {
      try { tx = (A._read ? A._read('misadTreasury') : JSON.parse(localStorage.getItem('misadTreasury') || '[]')) || []; } catch(e){}
      try { banks = (A._read ? A._read('misadBankAccounts') : JSON.parse(localStorage.getItem('misadBankAccounts') || '[]')) || []; } catch(e){}
      if (A.sameCompany) tx = tx.filter(function(x){ return A.sameCompany(x); });
      if (A.sameCompany) banks = banks.filter(function(x){ return A.sameCompany(x); });
      banks = banks.map(function(b){ return Object.assign({}, b, { balance: 0 }); });
      tx.slice().sort(function(a,b){ return (a.createdAtMs||0) - (b.createdAtMs||0); }).forEach(function(t){
        var amt = Math.max(0, Number(t.amount||0));
        if (t.type === 'transfer') {
          var from = t.from === 'cash' ? null : banks.find(function(b){ return b.id === t.from; });
          var to = t.to === 'cash' ? null : banks.find(function(b){ return b.id === t.to; });
          if (from) from.balance -= amt; else cash -= amt;
          if (to) to.balance += amt; else cash += amt;
        } else {
          var target = t.account === 'cash' ? null : banks.find(function(b){ return b.id === t.account; });
          if (t.type === 'opening' || t.type === 'deposit') { if (target) target.balance += amt; else cash += amt; }
          else if (t.type === 'withdraw') { if (target) target.balance -= amt; else cash -= amt; }
        }
      });
    }
    var bankTotal = banks.reduce(function(s,b){ return s + b.balance; }, 0);
    var cinvs = [];
    try { cinvs = ((A._read ? A._read('misadCustomerInvoices') : JSON.parse(localStorage.getItem('misadCustomerInvoices') || '[]')) || []).filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }); } catch(e){}
    var cinvPaid = 0, cinvDue = 0;
    cinvs.forEach(function(x){
      var payments = Array.isArray(x.payments) ? x.payments : [];
      var paid = payments.length ? payments.reduce(function(s,p){ return s + Math.max(0, Number(p.amount||0)); }, 0) : Math.max(0, Number(x.paid||0));
      var due = Math.max(0, Number(x.total||0) - paid);
      cinvPaid += paid; cinvDue += due;
    });
    content.push(summaryTable([
      { label: 'رصيد الخزينة', value: safeMoney(cash) },
      { label: 'إجمالي البنوك', value: safeMoney(bankTotal) },
      { label: 'مستحقات فواتير العملاء', value: safeMoney(cinvDue) },
      { label: 'المحصل من فواتير العملاء', value: safeMoney(cinvPaid) }
    ]));
    if (banks.length) {
      content.push({ text: 'الحسابات البنكية', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
      var bRows = banks.map(function(b){
        return [
          { text: b.bankName || '—', fontSize: 10, alignment: 'right' },
          { text: b.accountName || '—', fontSize: 10, alignment: 'right' },
          { text: b.accountNumber || b.iban || '—', fontSize: 10, alignment: 'left' },
          { text: safeMoney(b.balance), fontSize: 10, alignment: 'center', bold: true }
        ];
      });
      content.push({ table: { widths: ['*', '*', 'auto', 'auto'], headerRows: 1, body: [
        [ { text: 'البنك', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'اسم الحساب', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'رقم الحساب / الآيبان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الرصيد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] } ]
      ].concat(bRows) }, margin: [0, 0, 0, 4] });
    }
    var sorted = entries.slice().sort(function(a,b){ return (b.createdAtMs||0) - (a.createdAtMs||0); });
    content.push({ text: 'أحدث الحركات النقدية الفعلية', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if (sorted.length) {
      var rows = sorted.slice(0, 60).map(function(e){
        return [
          { text: e.description || '—', fontSize: 10, alignment: 'right' },
          { text: e.direction === 'in' ? 'وارد' : 'صادر', fontSize: 10, alignment: 'center' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.date || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الوصف', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الاتجاه', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد قيود مالية', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function activeContractsTablePdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var list = [];
    if (A.visibleContracts) {
      list = A.visibleContracts().filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).filter(function(x){ return x.status === 'ساري'; });
    }
    list = list.slice().sort(function(a,b){ return String(a.endDate || 'zz').localeCompare(String(b.endDate || 'zz')); });
    var total = list.reduce(function(s,x){ return s + Number(x.value || 0); }, 0);
    content.push({ text: 'جدول العقود السارية', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'عدد العقود', value: String(list.length) },
      { label: 'إجمالي القيمة', value: safeMoney(total) }
    ]));
    if (list.length) {
      var rows = list.map(function(c){
        var blds = (c.buildings || []).map(function(b){ return (b.name || 'مبنى') + ' - ' + (b.district || ''); }).join('، ') || 'غير محدد';
        return [
          { text: c.id || '—', fontSize: 9, alignment: 'right' },
          { text: c.type || '—', fontSize: 9, alignment: 'center' },
          { text: safeLabel(c), fontSize: 9, alignment: 'right' },
          { text: blds, fontSize: 9, alignment: 'right' },
          { text: safeMoney(c.value), fontSize: 9, alignment: 'center', bold: true },
          { text: c.startDate || '—', fontSize: 9, alignment: 'center' },
          { text: c.endDate || '—', fontSize: 9, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['auto', 'auto', '*', '*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الرقم', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'النوع', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الطرف الثاني', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المباني', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'القيمة', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'البداية', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'النهاية', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد عقود سارية حالياً', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function monthLabel(ym){
    var p = String(ym || '').split('-');
    if (p.length !== 2) return ym || '—';
    var n = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    var m = parseInt(p[1], 10);
    return m >= 1 && m <= 12 ? (n[m - 1] + ' ' + p[0]) : ym;
  }
  function monthlyVisitsPdfDefinition(month, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var visits = [];
    try { visits = (A._read ? A._read('misadVisits') : JSON.parse(localStorage.getItem('misadVisits') || '[]')) || []; } catch(e){ visits = []; }
    var list = visits.filter(function(v){ return String(v.scheduledAt || '').slice(0, 7) === String(month || ''); }).filter(function(v){ return A.sameCompany ? A.sameCompany(v) : true; });
    list = list.slice().sort(function(a,b){ return String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')); });
    var monthName = monthLabel(month);
    var totalVisits = list.length;
    var done = list.filter(function(v){ return v.status === 'مكتملة'; }).length;
    var canceled = list.filter(function(v){ return v.status === 'ملغية'; }).length;
    content.push({ text: 'جدول زيارات ' + monthName, fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'عدد الزيارات', value: String(totalVisits) },
      { label: 'مكتملة', value: String(done) },
      { label: 'ملغية', value: String(canceled) }
    ]));
    if (list.length) {
      var rows = list.map(function(v){
        var c = null;
        if (A.visibleContracts) c = A.visibleContracts().find(function(x){ return x.id === v.contractId; });
        return [
          { text: v.id || '—', fontSize: 9, alignment: 'right' },
          { text: v.contractId || '—', fontSize: 9, alignment: 'center' },
          { text: (c && c.id) ? safeLabel(c) : (v.clientName || v.clientCompanyName || '—'), fontSize: 9, alignment: 'right' },
          { text: (v.building && (v.building.name || v.building.district)) ? ((v.building.name || 'مبنى') + (v.building.district ? ' - ' + v.building.district : '')) : 'غير محدد', fontSize: 9, alignment: 'right' },
          { text: v.assignedName || 'غير مسند', fontSize: 9, alignment: 'center' },
          { text: String(v.scheduledAt || '').replace('T', ' ') || '—', fontSize: 9, alignment: 'center' },
          statusBadge(v.status)
        ];
      });
      content.push({ table: { widths: ['auto', 'auto', '*', '*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الرقم', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'العقد', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الطرف الثاني', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الموقع', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الفني', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الموعد', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الحالة', bold: true, fontSize: 9, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد زيارات في هذا الشهر', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function staffFinancePdfDefinition(id, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var staffs = [];
    try { staffs = (A._read ? A._read('misadCompanyStaff') : JSON.parse(localStorage.getItem('misadCompanyStaff') || '[]')); } catch(e){}
    var staff = staffs.filter(function(x){ return (x.identity || x.id || x.idx) === id || (x.identity === id) || (x.id === id) || (x.idx === id); })[0] || {};
    content.push({ text: 'كشف مالي للموظف', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push({ text: staff.name || id, fontSize: 12, color: '#3a4f5a', margin: [0, 0, 0, 4] });
    var entries = [];
    try {
      var raw = (A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]'));
      entries = raw.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).filter(function(x){ return (x.staffId || '') === id || (x.staffId || '') === staff.identity || (x.staffId || '') === staff.id; });
    } catch(e){}
    var adv = entries.reduce(function(s,x){ return s + (x.type === 'advance' ? Number(x.amount||0) : 0); }, 0);
    var allw = entries.reduce(function(s,x){ return s + (x.type === 'allowance' && x.direction === 'in' ? Number(x.amount||0) : 0); }, 0);
    var ded = entries.reduce(function(s,x){ return s + (x.type === 'deduction' ? Number(x.amount||0) : 0); }, 0);
    content.push(summaryTable([
      { label: 'السلف', value: safeMoney(adv) },
      { label: 'الحوافز', value: safeMoney(allw) },
      { label: 'الخصومات', value: safeMoney(ded) }
    ]));
    content.push({ text: 'القيود المالية', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    var t = entries.slice().sort(function(a,b){ return (a.createdAtMs||0) - (b.createdAtMs||0); });
    if (t.length) {
      var rows = t.map(function(e){
        return [
          { text: e.description || '—', fontSize: 10, alignment: 'right' },
          { text: e.direction === 'in' ? 'وارد' : 'صادر', fontSize: 10, alignment: 'center' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.date || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الوصف', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الاتجاه', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد قيود مالية', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function supplierFinancePdfDefinition(id, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var suppliers = [];
    try { suppliers = (A._read ? A._read('misadSuppliers') : JSON.parse(localStorage.getItem('misadSuppliers') || '[]')); } catch(e){}
    var supplier = suppliers.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return (x.id || x.idx) === id; }) || {};
    content.push({ text: 'كشف مالي للمورد', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push({ text: supplier.name || id, fontSize: 12, color: '#3a4f5a', margin: [0, 0, 0, 4] });
    var invoices = [];
    try {
      var raw = (A._read ? A._read('misadPurchaseInvoices') : JSON.parse(localStorage.getItem('misadPurchaseInvoices') || '[]'));
      invoices = raw.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).filter(function(x){ return (x.supplierId || '') === id || (x.supplierId || '') === supplier.id; });
    } catch(e){}
    var total = invoices.reduce(function(s,x){ return s + Number(x.total||0); }, 0);
    var paid = invoices.reduce(function(s,x){ return s + Number(x.paid||0); }, 0);
    content.push(summaryTable([
      { label: 'إجمالي الفواتير', value: safeMoney(total) },
      { label: 'المدفوع', value: safeMoney(paid) },
      { label: 'المستحق', value: safeMoney(total - paid) }
    ]));
    content.push({ text: 'فواتير الشراء', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if (invoices.length) {
      var rows = invoices.map(function(x){
        return [
          { text: x.invoiceNo || x.id, fontSize: 10, alignment: 'right' },
          { text: x.contractId || '—', fontSize: 10, alignment: 'center' },
          { text: safeMoney(x.total), fontSize: 10, alignment: 'center', bold: true },
          { text: safeMoney(x.paid), fontSize: 10, alignment: 'center' },
          { text: safeMoney(Number(x.total||0) - Number(x.paid||0)), fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الفاتورة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'العقد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'الإجمالي', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المدفوع', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المستحق', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد فواتير', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function paymentVoucherPdfDefinition(x, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var contract = {};
    if (A.visibleContracts) contract = A.visibleContracts().find(function(c){ return c.id === x.contractId; }) || {};
    else { try { contract = (JSON.parse(localStorage.getItem('misadContracts') || '[]')).find(function(c){ return c.id === x.contractId; }) || {}; } catch(e){} }
    var staffName = '';
    var staffs = [];
    try { staffs = (A._read ? A._read('misadCompanyStaff') : JSON.parse(localStorage.getItem('misadCompanyStaff') || '[]')); } catch(e){}
    var st = staffs.find(function(s){ return (s.identity || s.id || '') === (x.staffId || ''); });
    if (st && st.name) staffName = st.name;
    var payee = staffName || (contract.id ? safeLabel(contract) : '');
    content.push({ text: 'سند صرف', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم السند', value: x.id || '—' },
      { label: 'التاريخ', value: x.date || '—' },
      { label: 'التصنيف', value: x.category || '—' }
    ]));
    content.push(summaryTable([
      { label: 'الصرف إلى', value: payee || '—' },
      { label: 'العقد', value: x.contractId ? String(x.contractId) : '—' },
      { label: 'المبلغ', value: safeMoney(Number(x.amount||0)) }
    ]));
    if (x.description) content.push({ text: x.description, fontSize: 11, italics: true, color: '#3a4f5a', margin: [2, 6, 2, 4] });
    content.push({ table: { widths: ['*', '*'], body: [
      [
        { text: 'التوقيع', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] },
        { text: 'الاستلام', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] }
      ]
    ] }, margin: [20, 22, 20, 0] });
    return makeDd(content, cf, opts);
  }
  function staffPaymentVoucherPdfDefinition(v, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var staffs = [];
    try { staffs = (A._read ? A._read('misadCompanyStaff') : JSON.parse(localStorage.getItem('misadCompanyStaff') || '[]')); } catch(e){}
    var st = staffs.find(function(s){ return (s.identity || s.id || '') === (v.staffId || ''); });
    var payee = v.staffName || (st && st.name) || v.staffId || '—';
    content.push({ text: 'سند صرف — مشتريات موظف', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'رقم السند', value: v.id || '—' },
      { label: 'التاريخ', value: v.date || '—' },
      { label: 'المرجع', value: v.invoiceNo || v.invoiceId || '—' }
    ]));
    content.push(summaryTable([
      { label: 'الصرف إلى', value: payee },
      { label: 'رقم الموظف', value: String(v.staffId || '—') },
      { label: 'المبلغ', value: safeMoney(Number(v.amount||0)) }
    ]));
    if (v.description) content.push({ text: v.description, fontSize: 11, italics: true, color: '#3a4f5a', margin: [2, 6, 2, 4] });
    content.push({ table: { widths: ['*', '*'], body: [
      [
        { text: 'التوقيع', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] },
        { text: 'الاستلام', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] }
      ]
    ] }, margin: [20, 22, 20, 0] });
    return makeDd(content, cf, opts);
  }
  function installmentDemandPdfDefinition(c, label, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var planDef = (c.paymentPlan && c.paymentPlan.length) ? c.paymentPlan : [{label:"الدفعة الأولى",percent:0.5},{label:"الدفعة الثانية",percent:0.35},{label:"الدفعة الثالثة",percent:0.15}];
    var pctOf2 = function(p){ var v; if(Array.isArray(p)){ v = p[2]; } else { v = p.percent; } return v > 1 ? v / 100 : (v || 0); };
    var labelOf2 = function(p){ return Array.isArray(p) ? p[0] : (p.label || ''); };
    var planOf = planDef.find(function(p){ return labelOf2(p) === label; });
    var expected = planOf ? (Number(c.value||0) * pctOf2(planOf)) : 0;
    var allEntries = [];
    try { allEntries = (A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]')); } catch(e){}
    var inEntries = allEntries.filter(function(x){ return x.contractId === c.id && x.paymentLabel === label && x.direction === 'in'; });
    var collected = inEntries.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var remaining = Math.max(0, expected - collected);
    var saved = {};
    try { saved = ((A._read ? A._read('misadContractPayments') : JSON.parse(localStorage.getItem('misadContractPayments') || '[]')) || []).find(function(x){ return x.contractId === c.id && x.label === label; }) || {}; } catch(e){}
    content.push({ text: 'مطالبة مالية بدفعة', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'السادة /', value: safeLabel(c) },
      { label: 'رقم العقد', value: String(c.id) },
      { label: 'الدفعة', value: label }
    ]));
    content.push(summaryTable([
      { label: 'قيمة الدفعة', value: safeMoney(expected) },
      { label: 'المسدّد', value: safeMoney(collected) },
      { label: 'المطلوب سداده', value: safeMoney(remaining) }
    ]));
    content.push({ text: 'نطالبكم بسداد المبلغ المتبقي ' + safeMoney(remaining) + ' من قيمة الدفعة «' + label + '» بتاريخ استحقاق (' + (saved.dueDate || 'غير محدد') + ')، شاكرين لكم تعاونكم.', fontSize: 11, lineHeight: 1.7, margin: [2, 8, 2, 8] });
    content.push({ table: { widths: ['*', '*'], body: [
      [
        { text: 'الإعداد', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] },
        { text: 'الاعتماد', alignment: 'center', fontSize: 10, color: '#3a4f5a', margin: [0, 34, 0, 0] }
      ]
    ] }, margin: [20, 22, 20, 0] });
    return makeDd(content, cf, opts);
  }
  function customerStatementPdfDefinition(contract, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var k0 = contract.clientId || '';
    var n0 = contract.clientCompanyUnifiedNumber || '';
    var clName = safeLabel(contract);
    var contracts = [];
    if (A.visibleContracts) contracts = A.visibleContracts().filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; });
    else { try { contracts = JSON.parse(localStorage.getItem('misadContracts') || '[]'); } catch(e){} }
    var sameStr = function(a,b){ return a && b && String(a).trim() === String(b).trim(); };
    var rel = contracts.filter(function(c){
      return (k0 && c.clientId && sameStr(c.clientId, k0)) || (n0 && c.clientCompanyUnifiedNumber && sameStr(c.clientCompanyUnifiedNumber, n0));
    });
    if (!rel.length) rel = [contract];
    var relIds = rel.map(function(x){ return x.id; });
    content.push({ text: 'كشف حساب عميل', fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    content.push({ text: clName, fontSize: 12, color: '#3a4f5a', margin: [0, 0, 0, 4] });
    var allEntries = [];
    try { allEntries = (A._read ? A._read('misadFinancialEntries') : JSON.parse(localStorage.getItem('misadFinancialEntries') || '[]')); } catch(e){}
    var iEntries = allEntries.filter(function(x){ return (A.sameCompany ? A.sameCompany(x) : true) && x.direction === 'in' && x.contractId && relIds.indexOf(x.contractId) >= 0; });
    var cinvs = [];
    try { cinvs = (A._read ? A._read('misadCustomerInvoices') : JSON.parse(localStorage.getItem('misadCustomerInvoices') || '[]')).filter(function(x){ return x.contractId && relIds.indexOf(x.contractId) >= 0; }); } catch(e){}
    var cValue = rel.reduce(function(s,c){ return s + Number(c.value||0); }, 0);
    var paid = iEntries.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
    var invTotal = cinvs.reduce(function(s,x){ return s + Number(x.total||0); }, 0);
    var invPaid = cinvs.reduce(function(s,x){ return s + (Number(x.paid||0) + (x.payments||[]).reduce(function(s2,p){ return s2 + Number(p.amount||0); }, 0)); }, 0);
    content.push(summaryTable([
      { label: 'عدد العقود', value: String(rel.length) },
      { label: 'إجمالي قيمة العقود', value: safeMoney(cValue) },
      { label: 'إجمالي المحصل', value: safeMoney(paid) }
    ]));
    content.push(summaryTable([
      { label: 'إجمالي فواتير العملاء', value: safeMoney(invTotal) },
      { label: 'المحصل من الفواتير', value: safeMoney(invPaid) },
      { label: 'المستحق', value: safeMoney(Math.max(0, cValue - paid)) }
    ]));
    content.push({ text: 'التحصيلات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    var t = iEntries.slice().sort(function(a,b){ return (a.createdAtMs||0) - (b.createdAtMs||0); });
    if (t.length) {
      var rows = t.map(function(e){
        return [
          { text: e.description || e.paymentLabel || '—', fontSize: 10, alignment: 'right' },
          { text: e.contractId || '—', fontSize: 10, alignment: 'center' },
          { text: safeMoney(e.amount), fontSize: 10, alignment: 'center', bold: true },
          { text: e.date || '—', fontSize: 10, alignment: 'center' }
        ];
      });
      content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'العقد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'المبلغ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2, 2, 2, 2] }
        ]
      ].concat(rows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد تحصيلات', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function accRange(){
    var r = { from: '', to: '' };
    try { if (A.finReportRange) r = A.finReportRange() || r; } catch(e){}
    return r;
  }
  function accRangeSuffix(){
    var r = accRange();
    if (!r.from && !r.to) return '';
    return ' (من ' + (r.from || 'البداية') + ' إلى ' + (r.to || 'النهاية') + ')';
  }
  function accAsOfSuffix(){
    var r = accRange();
    return r.to ? ' (كما في ' + r.to + ')' : ' (حتى آخر قيد مرحّل)';
  }
  function accTb(){
    var rows = [];
    try {
      if (A.accountingTrialBalance) rows = A.accountingTrialBalance() || [];
      else {
        var journal = (A._read ? A._read('misadJournalEntries') : JSON.parse(localStorage.getItem('misadJournalEntries') || '[]')) || [];
        var map = {};
        journal.forEach(function(j){ (j.lines||[]).forEach(function(l){ var k=String(l.account); map[k]=map[k]||{account:k,accountName:l.accountName||k,debit:0,credit:0}; if(l.side==='debit')map[k].debit+=Number(l.amount||0); else map[k].credit+=Number(l.amount||0); }); });
        rows = Object.keys(map).sort().map(function(k){ var b=map[k].debit-map[k].credit; return {account:k,accountName:map[k].accountName,debit:map[k].debit,credit:map[k].credit,balance:b,side:b>=0?'debit':'credit'}; });
      }
    } catch(e){}
    return rows;
  }
  function accJournal(){
    var journal = [];
    try {
      if (A.journalEntriesForCompany) journal = A.journalEntriesForCompany() || [];
      else journal = (A._read ? A._read('misadJournalEntries') : JSON.parse(localStorage.getItem('misadJournalEntries') || '[]') || []);
      var r = accRange();
      if (r.from || r.to) {
        journal = journal.filter(function(j){
          var d = String(j.date || '').slice(0,10);
          if (r.from && d && d < r.from) return false;
          if (r.to && d && d > r.to) return false;
          return true;
        });
      }
      journal = journal.slice(0, 200);
    } catch(e){}
    return journal;
  }
  function trialBalancePdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'ميزان المراجعة' + accRangeSuffix(), fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    var rows = accTb();
    var sumD = rows.reduce(function(s,x){ return s+Number(x.debit||0); },0);
    var sumC = rows.reduce(function(s,x){ return s+Number(x.credit||0); },0);
    content.push(summaryTable([
      { label: 'إجمالي المدين', value: safeMoney(sumD) },
      { label: 'إجمالي الدائن', value: safeMoney(sumC) },
      { label: 'الاتزان', value: Math.abs(sumD-sumC)<0.01 ? 'متوازن' : 'غير متوازن' }
    ]));
    if (rows.length) {
      var tbRows = rows.filter(function(x){ return x.account !== '1000' && x.account !== '2000' && x.account !== '3000' && x.account !== '4000' && x.account !== '5000'; }).map(function(x){
        return [
          { text: String(x.account), fontSize: 10, alignment: 'center', bold: x.account.length===4 ? true : false },
          { text: x.accountName || '—', fontSize: 10, alignment: 'right' },
          { text: x.debit>0? safeMoney(x.debit) : '—', fontSize: 10, alignment: 'center' },
          { text: x.credit>0? safeMoney(x.credit) : '—', fontSize: 10, alignment: 'center' },
          { text: x.side==='debit' ? 'مدين' : 'دائن', fontSize: 10, alignment: 'center' }
        ];
      });
      tbRows.push([
        { text: 'الإجمالي', fontSize: 10, bold: true, alignment: 'center', fillColor: '#fdf6e8' },
        { text: '', fontSize: 10, fillColor: '#fdf6e8' },
        { text: safeMoney(sumD), fontSize: 10, bold: true, alignment: 'center', fillColor: '#fdf6e8' },
        { text: safeMoney(sumC), fontSize: 10, bold: true, alignment: 'center', fillColor: '#fdf6e8' },
        { text: '', fontSize: 10, fillColor: '#fdf6e8' }
      ]);
      content.push({ table: { widths: ['auto', '*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'الحساب', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الاسم', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'مدين', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'دائن', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الطبيعة', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] }
        ]
      ].concat(tbRows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد قيود مزدوجة بعد', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function ledgerPdfDefinition(accountId, logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    var accName = '';
    try { if (A.coaAccount) { var a = A.coaAccount(accountId); if (a) accName = a.name || ''; } } catch(e){}
    content.push({ text: 'دفتر الأستاذ - ' + String(accountId) + accRangeSuffix(), fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    if (accName) content.push({ text: accName, fontSize: 12, color: '#3a4f5a', margin: [0, 0, 0, 4] });
    var rows = [];
    if (A.accountingLedger) rows = A.accountingLedger(accountId) || [];
    var running = 0;
    var lRows = rows.map(function(x){
      running += (x.side === 'debit' ? Number(x.amount||0) : -Number(x.amount||0));
      return [
        { text: x.date || '—', fontSize: 10, alignment: 'center' },
        { text: x.description || x.refType || '—', fontSize: 10, alignment: 'right' },
        { text: x.side === 'debit' ? safeMoney(x.amount) : '—', fontSize: 10, alignment: 'center' },
        { text: x.side === 'credit' ? safeMoney(x.amount) : '—', fontSize: 10, alignment: 'center' },
        { text: safeMoney(running), fontSize: 10, alignment: 'center', bold: true }
      ];
    });
    if (lRows.length) {
      content.push({ table: { widths: ['auto', '*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'مدين', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'دائن', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الرصيد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] }
        ]
      ].concat(lRows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد حركات على هذا الحساب', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  function incomePdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'قائمة الدخل' + accRangeSuffix(), fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    var rows = accTb();
    var statement = null;
    try { if (A.accountingIncomeStatement) statement = A.accountingIncomeStatement(); } catch(e){}
    if (!statement) {
      var revenue = rows.filter(function(x){ return String(x.account).charAt(0) === '4'; }).map(function(x){
        return Object.assign({}, x, { value: Number(x.credit||0) - Number(x.debit||0) });
      });
      var expenses = rows.filter(function(x){ return String(x.account).charAt(0) === '5'; }).map(function(x){
        return Object.assign({}, x, { value: Number(x.debit||0) - Number(x.credit||0) });
      });
      var totalRevenue = revenue.reduce(function(s,x){ return s + Number(x.value||0); }, 0);
      var totalExpenses = expenses.reduce(function(s,x){ return s + Number(x.value||0); }, 0);
      statement = { revenue: revenue, expenses: expenses, totalRevenue: totalRevenue, totalExpenses: totalExpenses, netIncome: totalRevenue-totalExpenses };
    }
    content.push({ text: 'الإيرادات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    var revRows = (statement.revenue||[]).map(function(x){
      return [ { text: x.accountName || x.account, fontSize: 10, alignment: 'right' }, { text: safeMoney(x.value), fontSize: 10, alignment: 'center' } ];
    });
    if (revRows.length) content.push({ table: { widths: ['*', 'auto'], body: revRows }, margin: [0, 0, 0, 2] });
    content.push({ text: 'المصروفات', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 4, 0, 2] });
    var expRows = (statement.expenses||[]).map(function(x){
      return [ { text: x.accountName || x.account, fontSize: 10, alignment: 'right' }, { text: safeMoney(x.value), fontSize: 10, alignment: 'center' } ];
    });
    if (expRows.length) content.push({ table: { widths: ['*', 'auto'], body: expRows }, margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'إجمالي الإيرادات', value: safeMoney(statement.totalRevenue) },
      { label: 'إجمالي المصروفات', value: safeMoney(statement.totalExpenses) },
      { label: 'صافي الدخل', value: safeMoney(statement.netIncome) }
    ]));
    return makeDd(content, cf, opts);
  }
  function balanceSheetPdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'قائمة المركز المالي' + accAsOfSuffix(), fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    var rows = accTb();
    var sheet = null;
    try { if (A.accountingBalanceSheet) sheet = A.accountingBalanceSheet(); } catch(e){}
    if (!sheet) {
      var assets = rows.filter(function(x){ return String(x.account).charAt(0) === '1'; }).map(function(x){ return Object.assign({},x,{value:Number(x.debit||0)-Number(x.credit||0)}); });
      var liabilities = rows.filter(function(x){ return String(x.account).charAt(0) === '2'; }).map(function(x){ return Object.assign({},x,{value:Number(x.credit||0)-Number(x.debit||0)}); });
      var equity = rows.filter(function(x){ return String(x.account).charAt(0) === '3'; }).map(function(x){ return Object.assign({},x,{value:Number(x.credit||0)-Number(x.debit||0)}); });
      var fallbackRevenue = rows.filter(function(x){return String(x.account).charAt(0)==='4';}).reduce(function(s,x){return s+Number(x.credit||0)-Number(x.debit||0);},0);
      var fallbackExpenses = rows.filter(function(x){return String(x.account).charAt(0)==='5';}).reduce(function(s,x){return s+Number(x.debit||0)-Number(x.credit||0);},0);
      var totalAssets = assets.reduce(function(s,x){return s+Number(x.value||0);},0);
      var totalLiabilities = liabilities.reduce(function(s,x){return s+Number(x.value||0);},0);
      var recordedEquity = equity.reduce(function(s,x){return s+Number(x.value||0);},0);
      var currentEarnings = fallbackRevenue-fallbackExpenses;
      var totalEquity = recordedEquity+currentEarnings;
      var difference = totalAssets-totalLiabilities-totalEquity;
      sheet = {assets:assets,liabilities:liabilities,equity:equity,currentEarnings:currentEarnings,totalAssets:totalAssets,totalLiabilities:totalLiabilities,recordedEquity:recordedEquity,totalEquity:totalEquity,difference:difference,balanced:Math.abs(difference)<=0.01};
    }
    content.push({ text: 'الأصول', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 2, 0, 2] });
    if ((sheet.assets||[]).length) content.push({ table: { widths: ['*', 'auto'], body: sheet.assets.map(function(x){ return [ { text: x.accountName || x.account, fontSize: 10, alignment: 'right' }, { text: safeMoney(x.value), fontSize: 10, alignment: 'center' } ]; }) }, margin: [0, 0, 0, 2] });
    content.push({ text: 'الخصوم', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 4, 0, 2] });
    if ((sheet.liabilities||[]).length) content.push({ table: { widths: ['*', 'auto'], body: sheet.liabilities.map(function(x){ return [ { text: x.accountName || x.account, fontSize: 10, alignment: 'right' }, { text: safeMoney(x.value), fontSize: 10, alignment: 'center' } ]; }) }, margin: [0, 0, 0, 2] });
    content.push({ text: 'حقوق الملكية', fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 4, 0, 2] });
    var equityRows = (sheet.equity||[]).map(function(x){ return [ { text: x.accountName || x.account, fontSize: 10, alignment: 'right' }, { text: safeMoney(x.value), fontSize: 10, alignment: 'center' } ]; });
    equityRows.push([ { text: 'نتيجة الفترات حتى تاريخ التقرير', fontSize: 10, alignment: 'right', bold: true }, { text: safeMoney(sheet.currentEarnings), fontSize: 10, alignment: 'center', bold: true } ]);
    content.push({ table: { widths: ['*', 'auto'], body: equityRows }, margin: [0, 0, 0, 2] });
    content.push(summaryTable([
      { label: 'إجمالي الأصول', value: safeMoney(sheet.totalAssets) },
      { label: 'إجمالي الخصوم', value: safeMoney(sheet.totalLiabilities) },
      { label: 'إجمالي حقوق الملكية', value: safeMoney(sheet.totalEquity) },
      { label: 'حالة الاتزان', value: sheet.balanced ? 'متوازن' : 'غير متوازن — الفرق ' + safeMoney(sheet.difference) }
    ]));
    return makeDd(content, cf, opts);
  }
  function journalPdfDefinition(logoData, opts){
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);
    content.push({ text: 'دفتر قيود اليومية (المزدوج)' + accRangeSuffix(), fontSize: 14, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 2] });
    var journal = accJournal();
    if (journal.length) {
      var jRows = journal.map(function(j){
        var lines = (j.lines||[]).slice(0, 2).map(function(l){
          return { text: '         ' + (l.accountName || l.account) + ' - ' + (l.side==='debit' ? 'مدين: ' : 'دائن: ') + safeMoney(l.amount), fontSize: 9, alignment: 'right' };
        });
        return [
          { text: j.id || '—', fontSize: 10, alignment: 'center' },
          { text: j.date || '—', fontSize: 10, alignment: 'center' },
          { text: j.description || '—', fontSize: 10, alignment: 'right' },
          { stack: lines, margin: [0, 0, 0, 0] },
          { text: safeMoney(j.debitTotal), fontSize: 10, alignment: 'center', bold: true },
          { text: safeMoney(j.creditTotal), fontSize: 10, alignment: 'center', bold: true }
        ];
      });
      content.push({ table: { widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto'], headerRows: 1, body: [
        [
          { text: 'القيد', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'التاريخ', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'البيان', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'الأسطر', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'مدين', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] },
          { text: 'دائن', bold: true, fontSize: 10, color: '#fff', fillColor: '#1e3a5f', alignment: 'center', margin: [2,2,2,2] }
        ]
      ].concat(jRows) }, margin: [0, 0, 0, 4] });
    } else {
      content.push({ text: 'لا توجد قيود مزدوجة بعد', fontSize: 10, color: '#94a3b8', margin: [0, 0, 0, 4] });
    }
    return makeDd(content, cf, opts);
  }
  // ==================== MAIN ENTRY ====================
  function pdfLog(msg){ console.log("PDFGEN", msg); if (A.toast) A.toast(msg); }

  function createPdfBlob(dd){
    return pdfMake.createPdf(dd).getBlob();
  }

  async function downloadPdfDefinition(dd, filename){
    var blob = await createPdfBlob(dd);
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  window.generatePdf = async function(type, id, opts){
    if (type === 'quote' && !(opts && opts.clean)) opts = Object.assign({}, opts || {}, {letterhead:true});
    console.log("PDFGEN", "pdfmake attempt", type, id, "ready:", pdfmakeReady);
    if (opts && opts.letterhead && A.canUseCompanyLetterhead && !A.canUseCompanyLetterhead()) {
      pdfLog('غير مصرح باستخدام مطبوعات الشركة');
      return;
    }
    if (opts && opts.letterhead && !(A.companyLetterhead && A.companyLetterhead())) {
      pdfLog('ارفع صورة مطبوعات الشركة من بيانات المنشأة أولا');
      return;
    }
    if (!pdfmakeReady) {
      if (type === 'quote') { pdfLog('تعذر تجهيز ملف عرض السعر حالياً، أعد المحاولة'); return; }
      if (opts && opts.letterhead) {
        pdfLog('تعذر توليد PDF على مطبوعات الشركة حالياً');
        return;
      }
      console.warn("PDFGEN", "pdfmake not ready — trying old method");
      if (A.downloadPdf) { A.downloadPdf(type, id); return; }
      pdfLog("PDF غير متاح حالياً");
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
        if (A.visibleContracts) contract = A.visibleContracts().find(function(x){ return x.id === id; });
        if (!contract) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = contractPdfDefinition(contract, logoData, opts);

      } else if (type === 'quote') {
        var quote;
        if (A.quotes && A.quotes.length) {
          quote = A.quotes.filter(function(q){ return A.sameCompany ? A.sameCompany(q) : true; }).find(function(x){ return x.id === id; });
        }
        if (!quote) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = quotePdfDefinition(quote, logoData, opts);

      } else if (type === 'report') {
        var report;
        if (A.reports && A.reports.length) {
          report = A.reports.filter(function(r){ return A.sameCompany ? A.sameCompany(r) : true; }).find(function(x){ return x.id === id; });
        }
        if (!report) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = reportPdfDefinition(report, logoData, opts);

      } else if (type === 'ticket') {
        var ticket;
        if (A.visibleTickets) ticket = A.visibleTickets().find(function(x){ return x.id === id; });
        if (!ticket) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = ticketPdfDefinition(ticket, logoData, opts);

      } else if (type === 'claim') {
        var claims;
        try { claims = A._read ? A._read('misadClaims') : JSON.parse(localStorage.getItem('misadClaims') || '[]'); } catch(e){ claims = null; }
        if (!claims || !claims.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var claim = claims.filter(function(c){ return A.sameCompany ? A.sameCompany(c) : true; }).find(function(x){ return x.id === id; });
        if (!claim) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = claimPdfDefinition(claim, logoData, opts);

      } else if (type === 'receipt') {
        var receipts;
        try { receipts = A._read ? A._read('misadReceipts') : JSON.parse(localStorage.getItem('misadReceipts') || '[]'); } catch(e){ receipts = null; }
        if (!receipts || !receipts.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var receipt = receipts.filter(function(r){ return A.sameCompany ? A.sameCompany(r) : true; }).find(function(x){ return x.id === id; });
        if (!receipt) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = receiptPdfDefinition(receipt, logoData, opts);

      } else if (type === 'contract-finance') {
        var contract;
        if (A.visibleContracts) contract = A.visibleContracts().find(function(x){ return x.id === id; });
        if (!contract) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = contractFinancePdfDefinition(contract, logoData, opts);

      } else if (type === 'contract-payments') {
        var cfContract;
        if (A.visibleContracts) cfContract = A.visibleContracts().find(function(x){ return x.id === id; });
        if (!cfContract) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = contractPaymentsPdfDefinition(cfContract, logoData, opts);

      } else if (type === 'purchase-invoice') {
        var pInvoices;
        try { pInvoices = A._read ? A._read('misadPurchaseInvoices') : JSON.parse(localStorage.getItem('misadPurchaseInvoices') || '[]'); } catch(e){ pInvoices = null; }
        if (!pInvoices || !pInvoices.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var pInvoice = pInvoices.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!pInvoice) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = purchaseInvoicePdfDefinition(pInvoice, logoData, opts);

      } else if (type === 'contract-expenses') {
        var cfContract2;
        if (A.visibleContracts) cfContract2 = A.visibleContracts().find(function(x){ return x.id === id; });
        if (!cfContract2) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = contractExpensesPdfDefinition(cfContract2, logoData, opts);

      } else if (type === 'contract-profit') {
        var cfContract3;
        if (A.visibleContracts) cfContract3 = A.visibleContracts().find(function(x){ return x.id === id; });
        if (!cfContract3) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = contractProfitPdfDefinition(cfContract3, logoData, opts);

      } else if (type === 'custody') {
        var custodies;
        try { custodies = A._read ? A._read('misadCustodies') : JSON.parse(localStorage.getItem('misadCustodies') || '[]'); } catch(e){ custodies = null; }
        if (!custodies || !custodies.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var custody = custodies.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!custody) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = custodyPdfDefinition(custody, logoData, opts);

      } else if (type === 'payroll') {
        var payrolls;
        try { payrolls = A._read ? A._read('misadPayrolls') : JSON.parse(localStorage.getItem('misadPayrolls') || '[]'); } catch(e){ payrolls = null; }
        if (!payrolls || !payrolls.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var payroll = payrolls.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!payroll) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = payrollPdfDefinition(payroll, logoData, opts);

      } else if (type === 'salary-receipt') {
        var allPayrolls;
        try { allPayrolls = A._read ? A._read('misadPayrolls') : JSON.parse(localStorage.getItem('misadPayrolls') || '[]'); } catch(e){ allPayrolls = null; }
        if (!allPayrolls || !allPayrolls.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var parts = String(id || '').split(':');
        var pay = allPayrolls.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === parts[0]; });
        var row = null;
        if (pay) row = (pay.rows || []).find(function(r){ return String(r.staffId || r.staffIdentity || '') === String(parts[1]); });
        if (!row) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var salaryRec = {
          id: pay.id + '-' + (row.staffId || row.staffIdentity || ''),
          staffName: row.staffName,
          staffIdentity: row.staffIdentity || row.staffId,
          period: pay.period,
          amount: row.net,
          details: [
            { label: 'الراتب الأساسي', value: row.base },
            { label: 'البدلات', value: row.allowances },
            { label: 'الخصومات', value: row.deductions },
            { label: 'خصم العهدة', value: row.custodyDeduction }
          ]
        };
        dd = salaryReceiptPdfDefinition(salaryRec, logoData, opts);

      } else if (type === 'finance-summary') {
        dd = financeSummaryPdfDefinition(logoData, opts);

      } else if (type === 'contracts-table') {
        dd = activeContractsTablePdfDefinition(logoData, opts);

      } else if (type === 'visits-monthly') {
        dd = monthlyVisitsPdfDefinition(String(id || '').slice(0, 7), logoData, opts);

      } else if (type === 'staff-finance') {
        dd = staffFinancePdfDefinition(id, logoData, opts);

      } else if (type === 'supplier-finance') {
        dd = supplierFinancePdfDefinition(id, logoData, opts);

      } else if (type === 'installment') {
        var instParts = String(id || '').split(':');
        var instCid = instParts[0];
        var instLabel = '';
        try { instLabel = decodeURIComponent(instParts.slice(1).join(':')); } catch(e){ instLabel = instParts.slice(1).join(':'); }
        var instContract;
        if (A.visibleContracts) instContract = A.visibleContracts().find(function(x){ return x.id === instCid; });
        if (!instContract) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = installmentPdfDefinition(instContract, instLabel, logoData, opts);

      } else if (type === 'customer-invoice') {
        var cinvs;
        try { cinvs = A._read ? A._read('misadCustomerInvoices') : JSON.parse(localStorage.getItem('misadCustomerInvoices') || '[]'); } catch(e){ cinvs = null; }
        if (!cinvs || !cinvs.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var cinv = cinvs.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!cinv) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = customerInvoicePdfDefinition(cinv, logoData, opts);

      } else if (type === 'treasury') {
        dd = treasuryPdfDefinition(logoData, opts);

      } else if (type === 'payment-voucher') {
        var pvexps;
        try { pvexps = (A._read ? A._read('misadContractExpenses') : JSON.parse(localStorage.getItem('misadContractExpenses') || '[]')); } catch(e){ pvexps = null; }
        if (!pvexps || !pvexps.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var px = pvexps.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!px) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = paymentVoucherPdfDefinition(px, logoData, opts);

      } else if (type === 'staff-payment-voucher') {
        var svcs;
        try { svcs = (A._read ? A._read('misadStaffVouchers') : JSON.parse(localStorage.getItem('misadStaffVouchers') || '[]')); } catch(e){ svcs = null; }
        if (!svcs || !svcs.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var sv = svcs.filter(function(x){ return A.sameCompany ? A.sameCompany(x) : true; }).find(function(x){ return x.id === id; });
        if (!sv) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = staffPaymentVoucherPdfDefinition(sv, logoData, opts);

      } else if (type === 'installment-demand') {
        var demParts = String(id || '').split(':');
        var demCid = demParts[0];
        var demLabel = '';
        try { demLabel = decodeURIComponent(demParts.slice(1).join(':')); } catch(e){ demLabel = demParts.slice(1).join(':'); }
        var demContract;
        if (A.visibleContracts) demContract = A.visibleContracts().find(function(x){ return x.id === demCid; });
        if (!demContract) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = installmentDemandPdfDefinition(demContract, demLabel, logoData, opts);

      } else if (type === 'customer-statement') {
        dd = customerStatementPdfDefinition(A.visibleContracts ? A.visibleContracts().find(function(x){ return x.id === id; }) : null, logoData, opts);

      } else if (type === 'accounting-ledger') {
        dd = ledgerPdfDefinition(id, logoData, opts);

      } else if (type === 'accounting-account-statement') {
        dd = ledgerPdfDefinition(id, logoData, opts);

      } else if (type === 'accounting-trial-balance') {
        dd = trialBalancePdfDefinition(logoData, opts);

      } else if (type === 'accounting-income') {
        dd = incomePdfDefinition(logoData, opts);

      } else if (type === 'accounting-balance-sheet') {
        dd = balanceSheetPdfDefinition(logoData, opts);

      } else if (type === 'accounting-journal') {
        dd = journalPdfDefinition(logoData, opts);

      } else {
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      }

      if (!dd) {
        if (type === 'quote') { pdfLog('تعذر توليد ملف عرض السعر'); return; }
        if (opts && opts.letterhead) { pdfLog('تعذر توليد PDF على مطبوعات الشركة'); return; }
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      }

      var suffix = (opts && opts.letterhead) ? ' (على مطبوعات الشركة)' : ((opts && opts.clean) ? ' (بدون ترويسة)' : '');
      await downloadPdfDefinition(dd, p.title + suffix + '.pdf');
      pdfLog('تم تحميل PDF بنجاح');

    } catch(err) {
      console.error("PDFGEN", "pdfmake error:", err);
      if (type === 'quote') { pdfLog('تعذر توليد ملف عرض السعر، أعد المحاولة'); return; }
      if (opts && opts.letterhead) {
        pdfLog('تعذر توليد PDF على مطبوعات الشركة');
        return;
      }
      pdfLog('PDF — خطأ في التوليد، تجربة الطريقة القديمة');
      if (A.downloadPdf) A.downloadPdf(type, id);
    }
  };

  window.generateContractPdfBlob = async function(id){
    if (!pdfmakeReady) throw new Error('PDF غير متاح حالياً');
    if (A.canUseCompanyLetterhead && !A.canUseCompanyLetterhead()) throw new Error('غير مصرح باستخدام مطبوعات الشركة');
    if (!(A.companyLetterhead && A.companyLetterhead())) throw new Error('ارفع صورة مطبوعات الشركة أولاً');
    var contract = A.visibleContracts && A.visibleContracts().find(function(x){ return x.id === id; });
    if (!contract) throw new Error('لم يتم العثور على العقد');
    var logoData = await loadLogo();
    var dd = contractPdfDefinition(contract, logoData, {letterhead:true});
    return createPdfBlob(dd);
  };

  window.generateQuotePdfBlob = async function(id){
    if (!pdfmakeReady) throw new Error('PDF غير متاح حالياً');
    if (A.canUseCompanyLetterhead && !A.canUseCompanyLetterhead()) throw new Error('غير مصرح باستخدام مطبوعات الشركة');
    if (!(A.companyLetterhead && A.companyLetterhead())) throw new Error('ارفع صورة مطبوعات الشركة أولاً');
    var quote = A.quotes && A.quotes.filter(function(q){ return A.sameCompany ? A.sameCompany(q) : true; }).find(function(x){ return x.id === id; });
    if (!quote) throw new Error('لم يتم العثور على عرض السعر');
    var logoData = await loadLogo();
    var dd = quotePdfDefinition(quote, logoData, {letterhead:true});
    return createPdfBlob(dd);
  };

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pdf-doc]');
    if (btn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var opts = {};
      if (btn.dataset.pdfClean === 'true') opts.clean = true;
      if (btn.dataset.pdfLetterhead === 'true') opts.letterhead = true;
      window.generatePdf(btn.dataset.pdfDoc, btn.dataset.pdfId, opts);
    }
  }, true);

  console.log("PDFGEN", "pdfmake-gen loaded, pdfmakeReady:", pdfmakeReady, "pdfMake exists:", typeof pdfMake !== 'undefined', "fonts defined:", !!(pdfMake && pdfMake.fonts));
})();
