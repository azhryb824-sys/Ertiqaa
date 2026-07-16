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
    if (A.contractLabel) return A.contractLabel(obj);
    var label = obj.clientName || obj.clientId || "غير محدد";
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
        { text: 'نظام شموس لإدارة المصاعد', fontSize: 16, bold: true, color: '#0d312f' },
        { text: 'Shumoos Elevators Management System', fontSize: 9, color: '#748481' }
      ],
      alignment: 'center', width: '*'
    });
    return [
      { columns: parts, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#c9964b' }], margin: [0, 0, 0, 6] }
    ];
  }

  function appendDocumentHeader(content, logoData, opts){
    if (opts && opts.clean) return;
    if (opts && opts.letterhead) {
      return;
    }
    Array.prototype.push.apply(content, buildHeader(logoData));
  }

  function buildSignature(side1, side2){
    var stamp = (A.companyStamp && A.companyStamp()) || '';
    var signature = (A.companySignature && A.companySignature()) || '';
    var partyOneApproval = [];
    if (signature) partyOneApproval.push({
      stack: [
        { text: 'التوقيع', fontSize: 8, color: '#8b9f99', alignment: 'center' },
        { image: signature, fit: [150, 88], alignment: 'center', margin: [0, 3, 0, 0] }
      ],
      width: '*'
    });
    if (stamp) partyOneApproval.push({
      stack: [
        { text: 'الختم', fontSize: 8, color: '#8b9f99', alignment: 'center' },
        { image: stamp, fit: [135, 96], alignment: 'center', margin: [0, 3, 0, 0] }
      ],
      width: '*'
    });
    var sig1 = partyOneApproval.length
      ? { columns: partyOneApproval, columnGap: 3, margin: [0, 5, 0, 0] }
      : { text: 'التوقيع: ........................', fontSize: 10, color: '#8b9f99', alignment: 'center' };
    return [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#a0b8ad' }], margin: [0, 0, 0, 6] },
      {
        columns: [
          {
            stack: [
              { text: 'الطرف الثاني', bold: true, fontSize: 14, color: '#748481', alignment: 'center' },
              { text: side2, fontSize: 13, color: '#0d312f', alignment: 'center', margin: [0, 2, 0, 2] },
              { text: 'التوقيع: ........................', fontSize: 10, color: '#8b9f99', alignment: 'center' }
            ]
          },
          {
            stack: [
              { text: 'الطرف الأول', bold: true, fontSize: 14, color: '#748481', alignment: 'center' },
              { text: side1, fontSize: 13, color: '#0d312f', alignment: 'center', margin: [0, 2, 0, 2] },
              sig1
            ]
          }
        ],
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function summaryTable(rows){
    var header = rows.map(function(r){ return { text: r.label, bold: true, alignment: 'right', color: '#fff', fillColor: '#0d312f' }; });
    var values = rows.map(function(r){ return { text: r.value || 'غير محدد', bold: true, alignment: 'right', color: '#0d312f' }; });
    return {
      table: {
        widths: rows.map(function(){ return '*'; }),
        body: [header, values]
      },
      layout: {
        hLineWidth: function(i){ return i === 0 ? 0 : 0.35; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(){ return '#c9d8d2'; },
        vLineColor: function(){ return '#c9d8d2'; },
        paddingLeft: function(){ return 8; },
        paddingRight: function(){ return 8; },
        paddingTop: function(){ return 4; },
        paddingBottom: function(){ return 4; },
        fillColor: function(i){ return i === 0 ? null : '#f1f6f3'; }
      },
      margin: [0, 0, 0, 10]
    };
  }

  function statusBadge(status){
    var color = '#3c8b70';
    if (!status) { status = ''; color = '#666'; }
    if (status.indexOf('بانتظار') >= 0) color = '#8b601f';
    if (status.indexOf('ملغي') >= 0 || status.indexOf('ملغى') >= 0) color = '#c85c59';
    if (status.indexOf('منته') >= 0) color = '#666';
    if (status.indexOf('مغلق') >= 0) color = '#666';
    return { text: status, fontSize: 10, color: '#fff', background: color, alignment: 'center', margin: [0, 2, 0, 2], width: 90 };
  }

  function elevatorTable(ei){
    if (!ei || typeof ei !== 'object' || typeof ei.type === 'undefined') return null;
    var data = [
      { label: 'نوع المصعد', value: ei.type },
      { label: 'السعة', value: ei.capacity },
      { label: 'السرعة', value: ei.speed },
      { label: 'عدد التوقفات', value: ei.stops },
      { label: 'رقم المصعد', value: ei.elevatorId },
      { label: 'الموقع', value: ei.location }
    ].filter(function(r){ return r.value; });
    if (!data.length) return null;
    return [
      { text: 'بيانات المصعد', fontSize: 12, bold: true, color: '#0d312f', margin: [0, 0, 0, 4] },
      {
        table: {
          widths: [120, '*'],
          body: [[
            { text: 'البيان', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
            { text: 'القيمة', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' }
          ]].concat(data.map(function(r){
            return [
              { text: r.label, bold: true, fillColor: '#dceee4', fontSize: 9, alignment: 'right', color: '#0d312f' },
              { text: r.value, fontSize: 9, alignment: 'right', color: '#1a2e2b' }
            ];
          }))
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#a0b8ad'; },
          vLineColor: function(){ return '#a0b8ad'; },
          paddingLeft: function(){ return 8; },
          paddingRight: function(){ return 8; },
          paddingTop: function(){ return 5; },
          paddingBottom: function(){ return 5; },
          fillColor: function(i){ return i < 2 ? null : (i % 2 === 0 ? null : '#e6f0ea'); }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function maintenanceTable(checklist){
    if (!checklist || !checklist.length) return null;
    var items = [];
    checklist.forEach(function(item, idx){
      var label = '';
      if (typeof item === 'string') label = item;
      else if (item && item.label) label = item.label;
      else if (item && item.name) label = item.name;
      else if (item && item.title) label = item.title;
      var desc = (typeof item === 'object' && item) ? (item.description || item.desc || '') : '';
      items.push([
        { text: String(idx + 1), alignment: 'center', color: '#d4a24e', bold: true, fontSize: 10 },
        { text: label, fontSize: 10, alignment: 'right', color: '#1a2e2b' },
        { text: desc, fontSize: 11, color: '#748481', alignment: 'right' }
      ]);
    });
    return [
      sectionTitle('بنود الصيانة الدورية', [0, 0, 0, 4]),
      {
        table: {
          headerRows: 1,
          keepWithHeaderRows: 2,
          dontBreakRows: true,
          widths: [22, '*', 70],
          body: [[
            { text: '#', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'center' },
            { text: 'البند', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
            { text: 'البيان', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' }
          ]].concat(items)
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#a0b8ad'; },
          vLineColor: function(){ return '#a0b8ad'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#e6f0ea'; }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function paymentPlanTable(value){
    var total = Number(value || 0);
    var plan = [
      { label: 'دفعة مقدمة', desc: 'تسدد فور التوقيع وقبل بدء العمل', pct: 0.5 },
      { label: 'دفعة ثانية', desc: 'عند الانتهاء من التركيب', pct: 0.35 },
      { label: 'دفعة ثالثة', desc: 'عند الانتهاء من الاستلام النهائي والتشغيل', pct: 0.15 }
    ];
    var body = [[
      { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
      { text: 'البيان', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
      { text: 'النسبة', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'center' },
      { text: 'المبلغ', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'center' }
    ]];
    plan.forEach(function(p){
      var amount = total * p.pct;
      body.push([
        { text: p.label, fontSize: 9, bold: true, alignment: 'right', color: '#0d312f' },
        { text: p.desc, fontSize: 8, color: '#748481', alignment: 'right' },
        { text: Math.round(p.pct * 100) + '%', fontSize: 9, alignment: 'center', color: '#0d312f' },
        { text: safeMoney(amount), fontSize: 9, bold: true, color: '#d4a24e', alignment: 'center' }
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
          hLineColor: function(){ return '#a0b8ad'; },
          vLineColor: function(){ return '#a0b8ad'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#e6f0ea'); }
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
      else if (item && item.section) { t = item.section; d = item.description || item.title || ''; }
      else if (item && item.title) { t = item.title; d = item.description || ''; }
      else if (item && item.name) { t = item.name; d = item.description || item.desc || ''; }
      else { try { t = JSON.stringify(item); } catch(e){} }
      items.push({ text: t, bold: true, fontSize: 11, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' });
      if (d) items.push({ text: d, fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 4], alignment: 'right' });
    });
    var titleEl = { text: title, fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4] };
    if (items.length > 0) {
      return [{
        stack: [titleEl, items[0]],
        unbreakable: true
      }].concat(items.slice(1)).concat({ text: '', margin: [0, 0, 0, 4] });
    }
    return [titleEl, { text: '', margin: [0, 0, 0, 4] }];
  }

  var _sharedDd = {
    rtl: true,
    styles: {
      sectionTitle: { fontSize: 16, bold: true, color: '#0d312f', margin: [0, 0, 0, 4] },
      summaryLabel: { fontSize: 10, color: '#5c7670', bold: true },
      summaryValue: { fontSize: 13, color: '#0d312f', bold: true }
    },
    defaultStyle: { font: 'Cairo', fontSize: 13, lineHeight: 1.5, color: '#1a2e2b', bold: true },
    pageSize: 'A4',
    pageMargins: [28, 64.35, 28, 85.04],
    header: function(){
      return {
        stack: [
          { text: 'نظام شموس', fontSize: 7, color: '#8b9f99', alignment: 'center', margin: [0, 6, 0, 0] },
          { canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#d4a24e' }] }
        ]
      };
    },
    footer: function(currentPage, pageCount, cleanFooter){
      var f = [];
      f.push({ canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#d4a24e' }], margin: [0, 0, 0, 2] });
      if (cleanFooter) f.push({ text: cleanFooter, fontSize: 7, color: '#748481', alignment: 'center', margin: [0, 0, 0, 1] });
      f.push({ text: '' + currentPage + ' / ' + pageCount, fontSize: 7, color: '#8b9f99', alignment: 'center' });
      return { stack: f, margin: [28, 0, 28, 6] };
    }
  };

  function normalizePdfNodes(nodes){
    if (!nodes) return;
    if (Array.isArray(nodes)) {
      nodes.forEach(normalizePdfNodes);
      return;
    }
    if (typeof nodes !== 'object') return;

    if (Number(nodes.lineHeight) > 1.55) nodes.lineHeight = 1.55;
    if (nodes.bold && Number(nodes.fontSize) >= 12 && typeof nodes.text !== 'undefined') {
      nodes.headlineLevel = 1;
    }

    if (nodes.table && Array.isArray(nodes.table.body)) {
      if (Number(nodes.table.headerRows) > 0) {
        nodes.table.keepWithHeaderRows = Math.min(2, Math.max(1, nodes.table.body.length - Number(nodes.table.headerRows)));
        nodes.table.dontBreakRows = true;
      }
      nodes.layout = {
        hLineWidth: function(i, node){ return (i === 0 || i === node.table.body.length) ? 0.6 : 0.3; },
        vLineWidth: function(){ return 0; },
        hLineColor: function(i){ return i === 0 ? '#0d312f' : '#c8d7d1'; },
        vLineColor: function(){ return '#c8d7d1'; },
        paddingLeft: function(){ return 6; },
        paddingRight: function(){ return 6; },
        paddingTop: function(){ return 3; },
        paddingBottom: function(){ return 3; },
        fillColor: function(rowIndex){ return rowIndex > 0 && rowIndex % 2 === 0 ? '#f3f7f5' : null; }
      };
    }

    ['stack', 'columns', 'ul', 'ol'].forEach(function(key){ normalizePdfNodes(nodes[key]); });
    if (nodes.table) normalizePdfNodes(nodes.table.body);
  }

  function makeDd(content, cleanFooter, opts){
    var dd = JSON.parse(JSON.stringify(_sharedDd, function(k, v){
      return typeof v === 'function' ? undefined : v;
    }));
    normalizePdfNodes(content);
    dd.content = content;
    dd.pageBreakBefore = function(currentNode, followingNodesOnPage){
      return currentNode.headlineLevel === 1 && followingNodesOnPage.length < 2;
    };
    if (opts && opts.letterhead) {
      dd.pageMargins = [28, 208.08, 28, 85.04];
      dd.header = function(){ return null; };
      dd.footer = function(){ return null; };
      var bg = A.companyLetterhead ? A.companyLetterhead() : '';
      if (!bg) return null;
      dd.background = function(){
        return { image: bg, width: 595, height: 842, absolutePosition: { x: 0, y: 0 } };
      };
    } else if (opts && opts.clean) {
      dd.pageMargins = [28, 84.35, 28, 85.04];
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
      { text: [{ text: 'إنه في يوم ', fontSize: 11, color: '#3b564f' }, { text: datePart, fontSize: 11, color: '#3b564f' }, { text: ' تم الاتفاق بين:', fontSize: 11, color: '#3b564f' }], alignment: 'right', margin: [0, 0, 0, 4] },
      { stack: [
          { text: [{ text: 'الطرف الأول: ', bold: true, fontSize: 11, color: '#0d312f' }, { text: p1, fontSize: 11, color: '#3b564f' }], margin: [0, 2, 0, 1], alignment: 'right' },
          { text: [{ text: 'الطرف الثاني: ', bold: true, fontSize: 11, color: '#0d312f' }, { text: p2, fontSize: 11, color: '#3b564f' }], margin: [0, 0, 0, 4], alignment: 'right' }
      ]},
      { text: actionText, fontSize: 11, bold: true, color: '#0d312f', margin: [0, 0, 0, 10], alignment: 'right' }
    ];
  }

  function sectionTitle(text, margin){
    return { text: text, fontSize: 15, bold: true, color: '#0d312f', margin: margin || [0, 0, 0, 4], alignment: 'right', headlineLevel: 1 };
  }

  function scopeText(text, fallback){
    return { text: text || fallback, fontSize: 12, color: '#3b564f', margin: [0, 0, 0, 8], alignment: 'right', lineHeight: 1.55 };
  }

  var specGroups = [
    {
      tab: 'مواصفات المصعد',
      fields: [
        ['elevatorType', 'نوع المصعد'], ['usage', 'الاستخدام'], ['capacity', 'الحمولة'],
        ['persons', 'عدد الأشخاص'], ['stops', 'عدد الوقفات'], ['speed', 'السرعة'],
        ['travelHeight', 'ارتفاع المشوار'], ['shaftLength', 'طول البئر'], ['shaftWidth', 'عرض البئر'],
        ['pitDepth', 'عمق الحفرة'], ['overhead', 'الارتفاع العلوي'], ['entrances', 'عدد المداخل'],
        ['doorDirection', 'اتجاه الأبواب'], ['speedSystem', 'نظام السرعة'],
        ['doorType', 'نوع الأبواب']
      ]
    },
    {
      tab: 'المحرك والكنترول',
      fields: [
        ['motorType', 'نوع المحرك'], ['motorManufacturer', 'الشركة المصنعة للمحرك'],
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
        ['risotType', 'نوع الريشوت'], ['mirrors', 'وجود مرايا'], ['fan', 'وجود مروحة'],
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

  function maintenanceSpecTable(info, overallTitle){
    if (!info || typeof info !== 'object') return null;
    var out = [];
    if (overallTitle) out.push(sectionTitle(overallTitle, [0, 0, 0, 4]));

    var basicFields = [
      ['count', 'عدد المصاعد'], ['brand', 'الماركة'], ['age', 'العمر'],
      ['capacity', 'السعة'], ['doorType', 'نوع الأبواب'], ['usage', 'الاستخدام']
    ];
    var basicRows = [];
    basicFields.forEach(function(f){
      var val = info[f[0]];
      if (val && val !== '') {
        basicRows.push([
          { text: f[1], bold: true, fontSize: 11, fillColor: '#dceee4', alignment: 'right', color: '#0d312f' },
          { text: val, fontSize: 11, alignment: 'right', color: '#0d312f' }
        ]);
      }
    });
    if (basicRows.length) {
      out.push({
        table: {
          headerRows: 0,
          widths: [80, '*'],
          body: basicRows
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#a0b8ad'; },
          vLineColor: function(){ return '#a0b8ad'; },
          paddingLeft: function(){ return 8; },
          paddingRight: function(){ return 8; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#e6f0ea'; }
        },
        margin: [0, 0, 0, 6]
      });
    }

    var rows = [];
    specGroups[0].fields.forEach(function(f){
      var val = info[f[0]];
      if (val && val !== '') {
        rows.push([
          { text: f[1], bold: true, fontSize: 11, fillColor: '#dceee4', alignment: 'right', color: '#0d312f' },
          { text: val, fontSize: 11, alignment: 'right', color: '#1a2e2b' }
        ]);
      }
    });
    if (rows.length) {
      out.push({
        table: {
          headerRows: 0,
          widths: [100, '*'],
          body: rows
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#a0b8ad'; },
          vLineColor: function(){ return '#a0b8ad'; },
          paddingLeft: function(){ return 8; },
          paddingRight: function(){ return 8; },
          paddingTop: function(){ return 5; },
          paddingBottom: function(){ return 5; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#e6f0ea'; }
        },
        margin: [0, 0, 0, 8]
      });
    }

    if (!basicRows.length && !rows.length) return null;
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
            { text: f[1], bold: true, fontSize: 11, fillColor: '#dceee4', alignment: 'right', color: '#0d312f' },
            { text: val, fontSize: 11, alignment: 'right', color: '#1a2e2b' }
          ]);
        }
      });
      if (rows.length) {
        if (overallTitle && !out.length) {
          out.push(sectionTitle(overallTitle, [0, 0, 0, 4]));
        }
        out.push({ text: group.tab, fontSize: 10, bold: true, color: '#d4a24e', margin: [0, 0, 0, 2], alignment: 'right' });
        out.push({
          table: {
            headerRows: 0,
            widths: [100, '*'],
            body: rows
          },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#a0b8ad'; },
            vLineColor: function(){ return '#a0b8ad'; },
            paddingLeft: function(){ return 8; },
            paddingRight: function(){ return 8; },
            paddingTop: function(){ return 5; },
            paddingBottom: function(){ return 5; },
            fillColor: function(i){ return i % 2 === 0 ? null : '#e6f0ea'; }
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
      { text: 'خامساً: الضمان على أعمال الصيانة', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'تتحمل الشركة المصنعة أو الموردة أو الشركة المنفذة لأعمال الصيانة (الطرف الأول) مسؤولية ضمان أعمال الصيانة التي تقوم بها وتكون مسؤولة عن أي عيوب أو أخطاء في تلك الأعمال.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'يكون الضمان ساري المفعول لمدة عام من تاريخ بداية العقد على الأجزاء التي تمت صيانتها أو استبدالها في حالة الصيانة الناتجة عن سوء التركيب أو التصنيع أو عدم سلامة التصنيع.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'مدة الضمان لعملية الصيانة تكون عاماً من تاريخ التنفيذ، وفي حال وجود أي عيوب في أعمال الصيانة يجب على الطرف الأول إعادة الصيانة أو إصلاح العيوب خلال مدة لا تتجاوز خمسة عشر يوماً من تاريخ الإشعار وبما لا يخل بضمان أعمال الصيانة.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'في حالة وجود أي عيوب أو أخطاء في الصيانة من وجهة نظر الطرف الثاني، عليه إخطار الطرف الأول بذلك ويجب أن يتضمن الإخطار وصفاً كاملاً للعيوب أو الأخطاء.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'سادساً: التزامات الطرف الثاني', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يلتزم الطرف الثاني بتوفير متطلبات السلامة لحماية العاملين في الموقع، وتوفير مساحة عمل آمنة ومناسبة لفريق الصيانة، مع توفير الإضاءة والطاقة الكهربائية اللازمة لتنفيذ أعمالهم بأمان وسلامة.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'إخلاء مسؤولية الطرف الأول عن أي حوادث أو إصابات أو أضرار تلحق بالغير أو بالعاملين في الموقع نتيجة إهمال الطرف الثاني أو عدم توفير بيئة عمل آمنة.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'يلتزم الطرف الثاني بإبلاغ الطرف الأول فوراً في حال حدوث أي عطل مفاجئ في المصعد.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'في حال عدم قيام الطرف الثاني بالتزاماته، يحق للطرف الأول تعليق الخدمة حتى يتم الالتزام.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'سابعاً: المسؤولية والسلامة', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يكون الطرف الأول مسؤولاً عن سلامة تنفيذ أعمال الصيانة وفقاً لأصول المهنة والشروط المتفق عليها.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'يكون الطرف الثاني مسؤولاً عن سلامة الموقع وتوفير بيئة عمل آمنة وفقاً للوائح وأنظمة السلامة المهنية.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'يكون الطرف الأول مسؤولاً عن سلامة وأداء المصعد (المصاعد) بعد الصيانة.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'ثامناً: التأخير أو التقصير', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: [{ text: 'التأخير أو التقصير: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'في حال تقصير أو تأخير الطرف الأول في تنفيذ أعمال الصيانة الدورية، يجب عليه إخطار الطرف الثاني بأسباب التأخير.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: [{ text: 'الإخلال بالالتزامات: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'في حال إخلال الطرف الأول بالتزاماته الجوهرية، يحق للطرف الثاني تعليق استحقاق الدفعات المستحقة للطرف الأول.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: [{ text: 'حدود المسؤولية: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'لا يتحمل الطرف الأول المسؤولية عن الأضرار غير المباشرة (سواء كانت مادية أو معنوية) مثل فقدان الأرباح أو توقف العمل أو غيرها، وتكون المسؤولية في جميع الأحوال محصورة بقيمة العقد المدفوعة من الطرف الثاني للطرف الأول.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: [{ text: 'إيقاف العقد: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'يحق للطرف الأول إيقاف العقد في حال عدم قيام الطرف الثاني بدفع الدفعات المستحقة في مواعيدها، على أن يكون الإيقاف بعد إنذار خطي لمدة لا تقل عن 7 أيام.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'تاسعاً: فسخ العقد', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'يحق لأي من الطرفين فسخ العقد في حال إخلال الطرف الآخر بالتزاماته الجوهرية مع إنذار خطي لمدة لا تقل عن 30 يوماً.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'في حال فسخ العقد، يستحق الطرف الأول قيمة الأعمال التي تم تنفيذها فعلاً.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: 'لا يحق للطرف الثاني فسخ العقد بسبب ظروفه المادية أو الإدارية أو تغير موقفه المالي، أو لأي سبب غير مبرر، وإلا أعتبر ذلك إخلالاً بالتزاماته.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'عاشراً: المسؤولية عن الأعطال التي تتطلب قطع غيار', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: [{ text: 'الأعطال التي تتطلب قطع غيار: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'في حال وجود عطل بالمصعد يتطلب تغيير قطعة غيار، تتحمل الطرف الثاني قيمة القطعة وتكاليف الشحن والتركيب والنقل والخدمات اللوجستية، على أن تقوم الطرف الأول بتوفير القطعة وتنفيذ أعمال الاستبدال بأسرع وقت ممكن، ويتم وضع خطة لتفادي توقف المصعد لفترات طويلة.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] },
      { text: [{ text: 'الأعطال غير المشمولة: ', bold: true, fontSize: 11, color: '#17413e' }, { text: 'أما الأعطال الناتجة عن سوء الاستخدام أو التعديلات غير المصرح بها من قبل الطرف الثاني أو الغير، أو الأعطال الناتجة عن سوء التركيب أو التصنيع من قبل الغير والشركات المنفذة للتركيب أو التصنيع، أو ظروف قاهرة مثل كوارث طبيعية أو حرائق أو فيضانات أو سرقات وتخريب، أو انقطاع التيار الكهربائي أو عدم استقرار الجهد الكهربائي، أو عدم تنفيذ الصيانة الوقائية الدورية المتفق عليها في العقد، أو وجود أي تعديلات هيكلية في المبنى تؤثر على سلامة المصعد، فلا تكون الطرف الأول مسؤولة عنها وتتحمل الطرف الثاني أي تكاليف إضافية لإعادة التأهيل والصيانة.', fontSize: 11, color: '#3b564f' }], alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 8] },
      { text: 'نسخ العقد', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
      { text: 'تم تحرير هذا العقد من نسختين (2) بيد كل طرف نسخة واحدة، وتعتبر جميعها نسخاً أصلية، وتسري أحكام هذا العقد اعتباراً من تاريخ توقيعه من الطرفين.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8, margin: [0, 0, 0, 4] }
    ];
  }

  // ==================== CONTRACT ====================
  function contractPdfDefinition(c, logoData, opts){
    var companyName = (c.company && c.company.name) || activeCompanyName();
    var cf = safeFooter();
    var content = [];
    var isInstall = c.type === 'تركيب';

    console.log("PDFGEN", "contract type:", c.type, "is install:", isInstall);

    appendDocumentHeader(content, logoData, opts);

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'عقد ' + (c.type || ''), bold: true, fontSize: 18, color: '#0d312f', alignment: 'right' },
            { text: 'رقم العقد: ' + c.id, bold: true, fontSize: 10, color: '#fff', fillColor: '#0d312f', alignment: 'center', margin: [4, 2, 4, 2] }
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
          { text: 'بسم الله الرحمن الرحيم', fontSize: 10, color: '#8b9f99', alignment: 'center', margin: [0, 0, 0, 2] },
          { text: 'عقد تركيب مصعد', fontSize: 14, bold: true, color: '#0d312f', alignment: 'center', margin: [0, 0, 0, 4] },
          { text: 'يسعدنا نحن ' + companyName + ' أن نتقدم لسعادتكم بهذا العقد لتوريد وتركيب مصعد في موقعكم الموضح أدناه، وفق المواصفات الفنية والبنود العامة المعتمدة.', fontSize: 11, color: '#3b564f', alignment: 'right', margin: [0, 0, 0, 6], lineHeight: 1.8 }
        ],
        margin: [0, 0, 0, 6]
      });
    }

    content.push(summaryTable([
      { label: 'بداية العقد', value: c.startDate },
      { label: 'نهاية العقد', value: c.endDate },
      { label: 'منشأة الإصدار', value: companyName }
    ].concat(isInstall?[{label:'مدة التركيب',value:(c.installationInfo?.installDuration||'45 يوماً')}]:[]).concat(isInstall&&c.deliveryDate?[{label:'تاريخ التسليم',value:c.deliveryDate}]:[])));

    var intro = contractIntroParagraph(c, isInstall);
    if (intro) Array.prototype.push.apply(content, intro);

    if (isInstall) {
      var scopeDefault = 'يشمل العقد توريد وتركيب المصعد والسكة والأبواب والكابينة والمكينة ولوحة التحكم والتشغيل والاختبار والتسليم النهائي وفقاً للمواصفات الفنية الواردة بهذا العقد، مع توفير الضمان اللازم للأجزاء الموردة حسب ما هو متفق عليه.';
      Array.prototype.push.apply(content, sectionBlock('أولاً', 'نطاق التوريد والتركيب', scopeText(c.details, scopeDefault)));

      var st = specTable(c.elevatorInfo, 'البند ثانياً: المواصفات الفنية للمصعد');
      if (st && st.length) {
        Array.prototype.push.apply(content, st);
      }

      var pt = paymentPlanTable(c.value);
      if (pt) {
        Array.prototype.push.apply(content, sectionBlock('ثالثاً', 'شروط الدفع', pt));
      }

      var ti = renderItems(c.items, 'رابعاً: البنود الافتراضية');
      if (ti) Array.prototype.push.apply(content, ti);
      var ci = renderItems(c.customItems, 'خامساً: البنود الإضافية');
      if (ci) Array.prototype.push.apply(content, ci);
      else if (!ti) content.push(sectionTitle('رابعاً: البنود'));

      var buildings = c.buildings || [];
      if (buildings.length > 0) {
        var bd = [{ text: '', margin: [0, 0, 0, 2] }];
        buildings.forEach(function(b){
          bd.push({
            stack: [
              { text: b.name || 'غير محدد', bold: true, fontSize: 10, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' },
              { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 11, color: '#748481', margin: [0, 0, 0, 4], alignment: 'right' }
            ],
            margin: [0, 0, 0, 2]
          });
        });
        Array.prototype.push.apply(content, sectionBlock('سادساً', 'المباني والمواقع', bd));
      }
      if (c.maintenanceChecklist && c.maintenanceChecklist.length > 0) {
        var mi = maintenanceTable(c.maintenanceChecklist);
        if (mi) Array.prototype.push.apply(content, sectionBlock('سابعاً', 'بنود الصيانة المتفق عليها', mi));
      }
      if (c.deliveryDate && c.maintenanceEndDate) {
        content.push(sectionBlock('ثامناً', 'فترة الصيانة', { text: 'تبدأ فترة الصيانة من تاريخ تسليم المصعد (' + c.deliveryDate + ') إلى تاريخ (' + c.maintenanceEndDate + ')، على أن تشمل أعمال الصيانة الدورية والطارئة وفق بنود الصيانة المتفق عليها أعلاه.', fontSize: 11, color: '#3b564f', alignment: 'right', lineHeight: 1.8 }));
      }
    } else {
      var scopeDefault = 'يشمل العقد أعمال الصيانة الدورية للمصعد (المصاعد) وفق بنود الصيانة والشروط والمواصفات الواردة في هذا العقد، للحفاظ على سلامة وأداء المصعد طوال مدة العقد.';
      Array.prototype.push.apply(content, sectionBlock('أولاً', 'نطاق الصيانة', scopeText(c.details, scopeDefault)));

      var st = maintenanceSpecTable(c.elevatorInfo, 'البند ثانياً: المواصفات الفنية للمصعد');
      if (st && st.length) {
        st[0].pageBreak = 'before';
        Array.prototype.push.apply(content, st);
      }

      var mt = maintenanceTable(c.maintenanceChecklist);
      if (mt) Array.prototype.push.apply(content, sectionBlock('ثالثاً', 'بنود الصيانة الدورية', mt));

      var buildings = c.buildings || [];
      if (buildings.length > 0) {
        var bd = [{ text: '', margin: [0, 0, 0, 2] }];
        buildings.forEach(function(b){
          bd.push({
            stack: [
              { text: b.name || 'غير محدد', bold: true, fontSize: 10, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' },
              { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 11, color: '#748481', margin: [0, 0, 0, 4], alignment: 'right' }
            ],
            margin: [0, 0, 0, 2]
          });
        });
        Array.prototype.push.apply(content, sectionBlock('رابعاً', 'المباني والمواقع', bd));
      }

      var ti = renderItems(c.items, 'البنود الافتراضية');
      if (ti) Array.prototype.push.apply(content, ti);
      var ci = renderItems(c.customItems, 'البنود الإضافية');
      if (ci) Array.prototype.push.apply(content, ci);
      var mc = maintenancePdfClauses();
      if (mc && mc.length) mc.forEach(function(x){ content.push(x); });
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
    var total = Number(q.totalWithTax != null ? q.totalWithTax : (q.subtotal != null ? q.subtotal : (q.value || 0)));
    var party = q.client || q.clientCompanyName || q.clientName || "غير محدد";
    var isInstall = q.type === "تركيب";
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'عرض سعر' + (q.type ? ' - ' + q.type : ''), bold: true, fontSize: 16, color: '#0d312f' },
        statusBadge(q.status || 'بانتظار الرد')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم عرض السعر: ' + q.id, bold: true, fontSize: 14, color: '#d4a24e', alignment: 'right' },
            { text: 'الإجمالي', fontSize: 10, color: '#748481', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(total), bold: true, fontSize: 18, color: '#d4a24e', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push({
      stack: [
        { text: 'الطرف الموجه إليه عرض السعر', fontSize: 12, bold: true, color: '#0d312f', margin: [0, 0, 0, 2] },
        { text: party, bold: true, fontSize: 14, color: '#0d312f', margin: [0, 2, 0, 4], alignment: 'right' }
      ],
      margin: [0, 0, 0, 8]
    });
    content.push(summaryTable([
      { label: 'العنوان', value: q.title || 'عرض سعر' },
      { label: 'تاريخ الإصدار', value: q.createdAt },
      { label: 'مرجع الكشف', value: q.reportId || '?' }
    ]));

    var et = elevatorTable(q.elevatorInfo);
    if (et) Array.prototype.push.apply(content, et);

    if (isInstall) {
      var plan = (q.paymentPlan && q.paymentPlan.length) ? q.paymentPlan : [];
      if (plan.length) {
        var planRows = [[
          { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
          { text: 'البيان', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'right' },
          { text: 'القيمة', bold: true, color: '#fff', fillColor: '#0d312f', alignment: 'center' }
        ]];
        plan.forEach(function(p){
          var label = p.label || (Array.isArray(p) ? p[0] : 'دفعة');
          var desc = p.description || (Array.isArray(p) ? p[1] : '');
          var pct = p.percent > 1 ? p.percent / 100 : (p.percent || (Array.isArray(p) ? p[2] : 0));
          var amount = total * pct;
          planRows.push([
            { text: label, fontSize: 9, alignment: 'right' },
            { text: desc, fontSize: 8, color: '#748481', alignment: 'right' },
            { text: safeMoney(amount), alignment: 'center', fontSize: 9, bold: true }
          ]);
        });
        planRows.push([
          { text: 'الإجمالي', colSpan: 2, alignment: 'left', bold: true, fontSize: 10, color: '#8b601f' },
          {},
          { text: safeMoney(total), alignment: 'center', bold: true, fontSize: 10, color: '#8b601f' }
        ]);
        content.push({ text: 'جدول الدفعات', fontSize: 12, bold: true, color: '#0d312f', margin: [0, 0, 0, 4] });
        content.push({
          table: { headerRows: 1, keepWithHeaderRows: 2, dontBreakRows: true, widths: ['*', '*', 80], body: planRows },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#a0b8ad'; },
            vLineColor: function(){ return '#a0b8ad'; },
            paddingLeft: function(){ return 6; },
            paddingRight: function(){ return 6; },
            paddingTop: function(){ return 4; },
            paddingBottom: function(){ return 4; },
            fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#e6f0ea'); }
          },
          margin: [0, 0, 0, 10]
        });
      }
    }

    if (!isInstall) {
      var mt = maintenanceTable(q.maintenanceChecklist);
      if (mt) Array.prototype.push.apply(content, mt);
    }

    var pi = renderItems(q.partsItems, 'قطع الغيار بأقل أسعار الموردين');
    if (pi) Array.prototype.push.apply(content, pi);
    var ti = renderItems(q.items, 'البنود الافتراضية');
    if (ti) Array.prototype.push.apply(content, ti);
    var ci = renderItems(q.customItems, 'البنود الإضافية');
    if (ci) Array.prototype.push.apply(content, ci);

    if (q.details) {
      content.push({ text: 'التفاصيل', fontSize: 12, bold: true, color: '#0d312f', margin: [0, 0, 0, 4] });
      content.push({ text: q.details, fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' });
    }

    content.push({
      stack: buildSignature(companyName, party),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
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
        { text: 'تقرير زيارة فنية', bold: true, fontSize: 16, color: '#0d312f' },
        statusBadge(r.status || 'بانتظار اعتماد العميل')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم التقرير: ' + r.id, bold: true, fontSize: 14, color: '#d4a24e', alignment: 'right' },
            { text: r.technician || r.technicianId || 'الفني', fontSize: 10, color: '#748481', alignment: 'center' }
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
        { text: title, fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' },
        { text: text, fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' }
      ];
    }

    var s1 = section('الأعمال المنفذة', r.workDone);
    if (s1) Array.prototype.push.apply(content, s1);
    var s2 = section('الأعطال والملاحظات الفنية', r.issues);
    if (s2) Array.prototype.push.apply(content, s2);

    if (r.parts || r.recommendations) {
      content.push({ text: 'قطع الغيار المطلوبة / المستخدمة والتوصيات', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.parts) content.push({ text: r.parts, fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.recommendations) content.push({ text: r.recommendations, fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' });
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
        { text: 'بلاغ - ' + t.id, bold: true, fontSize: 16, color: '#0d312f' },
        statusBadge(t.status)
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      stack: [
        { text: t.title, bold: true, fontSize: 14, color: '#0d312f', margin: [0, 0, 0, 2], alignment: 'right' },
        { text: t.description || '', fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 6], alignment: 'right' }
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
    var cf = safeFooter();
    var content = [];
    appendDocumentHeader(content, logoData, opts);

    content.push({
      columns: [
        { text: 'مستخلص مالي', bold: true, fontSize: 16, color: '#0d312f' },
        statusBadge(cl.status || 'قيد المراجعة')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم المستخلص: ' + cl.id, bold: true, fontSize: 14, color: '#d4a24e', alignment: 'right' },
            { text: 'قيمة المستخلص', fontSize: 10, color: '#748481', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(cl.value), bold: true, fontSize: 18, color: '#d4a24e', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push(summaryTable([
      { label: 'العقد', value: cl.contractId || 'غير محدد' },
      { label: 'الطرف الثاني', value: cl.clientName || safeLabel(cl) },
      { label: 'الفترة', value: cl.period || 'غير محددة' },
      { label: 'تاريخ الإنشاء', value: cl.createdAt }
    ]));

    content.push({ text: 'بيان المستخلص', fontSize: 14, bold: true, color: '#0d312f', margin: [0, 0, 0, 4], alignment: 'right' });
    content.push({
      text: 'مستخلص عن الفترة الموضحة أعلاه بمبلغ إجمالي ' + safeMoney(cl.value) + ' وفق بيانات العقد والخدمات المسجلة في النظام.',
      fontSize: 11, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right'
    });

    content.push({
      stack: buildSignature(companyName, cl.clientName || safeLabel(cl) || 'الطرف الثاني'),
      unbreakable: true,
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf, opts);
  }

  // ==================== MAIN ENTRY ====================
  function pdfLog(msg){ console.log("PDFGEN", msg); if (A.toast) A.toast(msg); }

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
        if (String(contract.transferNoticeData || '').startsWith('data:image/')) {
          dd.content.push({text: 'إشعار التحويل', style: 'sectionTitle', pageBreak: 'before', margin: [0, 20, 0, 14]});
          dd.content.push({image: contract.transferNoticeData, fit: [470, 680], alignment: 'center'});
        }

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
      pdfMake.createPdf(dd).download(p.title + suffix + '.pdf');
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
    if (String(contract.transferNoticeData || '').startsWith('data:image/')) {
      dd.content.push({text:'إشعار التحويل',style:'sectionTitle',pageBreak:'before',margin:[0,20,0,14]});
      dd.content.push({image:contract.transferNoticeData,fit:[470,680],alignment:'center'});
    }
    return await new Promise(function(resolve,reject){
      try { pdfMake.createPdf(dd).getBlob(resolve); } catch (err) { reject(err); }
    });
  };

  window.generateQuotePdfBlob = async function(id){
    if (!pdfmakeReady) throw new Error('PDF غير متاح حالياً');
    if (A.canUseCompanyLetterhead && !A.canUseCompanyLetterhead()) throw new Error('غير مصرح باستخدام مطبوعات الشركة');
    if (!(A.companyLetterhead && A.companyLetterhead())) throw new Error('ارفع صورة مطبوعات الشركة أولاً');
    var quote = A.quotes && A.quotes.filter(function(q){ return A.sameCompany ? A.sameCompany(q) : true; }).find(function(x){ return x.id === id; });
    if (!quote) throw new Error('لم يتم العثور على عرض السعر');
    var logoData = await loadLogo();
    var dd = quotePdfDefinition(quote, logoData, {letterhead:true});
    return await new Promise(function(resolve,reject){
      try { pdfMake.createPdf(dd).getBlob(resolve); } catch (err) { reject(err); }
    });
  };

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pdf-doc]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var opts = {};
      if (btn.dataset.pdfClean === 'true') opts.clean = true;
      if (btn.dataset.pdfLetterhead === 'true') opts.letterhead = true;
      window.generatePdf(btn.dataset.pdfDoc, btn.dataset.pdfId, opts);
    }
  }, true);

  console.log("PDFGEN", "pdfmake-gen loaded, pdfmakeReady:", pdfmakeReady, "pdfMake exists:", typeof pdfMake !== 'undefined', "fonts defined:", !!(pdfMake && pdfMake.fonts));
})();
