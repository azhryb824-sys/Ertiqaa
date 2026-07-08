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
    return obj.clientName || obj.clientId || "غير محدد";
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
        { text: 'نظام شموس لإدارة المصاعد', fontSize: 14, bold: true, color: '#102d2c' },
        { text: 'Shumoos Elevators Management System', fontSize: 8, color: '#748481' }
      ],
      alignment: 'center', width: '*'
    });
    return [
      { columns: parts, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#c9964b' }], margin: [0, 0, 0, 6] }
    ];
  }

  function buildSignature(side1, side2){
    return [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8e5' }], margin: [0, 0, 0, 6] },
      {
        columns: [
          {
            stack: [
              { text: 'الطرف الأول', bold: true, fontSize: 10, color: '#748481', alignment: 'center' },
              { text: side1, fontSize: 9, color: '#102d2c', alignment: 'center', margin: [0, 2, 0, 2] },
              { text: 'التوقيع: ........................', fontSize: 8, color: '#8b9f99', alignment: 'center' }
            ]
          },
          {
            stack: [
              { text: 'الطرف الثاني', bold: true, fontSize: 10, color: '#748481', alignment: 'center' },
              { text: side2, fontSize: 9, color: '#102d2c', alignment: 'center', margin: [0, 2, 0, 2] },
              { text: 'التوقيع: ........................', fontSize: 8, color: '#8b9f99', alignment: 'center' }
            ]
          }
        ],
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function summaryTable(rows){
    var header = rows.map(function(r){ return { text: r.label, bold: true, alignment: 'right' }; });
    var values = rows.map(function(r){ return { text: r.value || 'غير محدد', bold: true, alignment: 'right' }; });
    return {
      table: {
        widths: rows.map(function(){ return '*'; }),
        body: [header, values]
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
      { text: 'بيانات المصعد', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] },
      {
        table: {
          widths: [120, '*'],
          body: [[
            { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
            { text: 'القيمة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' }
          ]].concat(data.map(function(r){
            return [
              { text: r.label, bold: true, fillColor: '#eef5f1', fontSize: 9, alignment: 'right' },
              { text: r.value, fontSize: 9, alignment: 'right' }
            ];
          }))
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#e2e8e5'; },
          vLineColor: function(){ return '#e2e8e5'; },
          paddingLeft: function(){ return 8; },
          paddingRight: function(){ return 8; },
          paddingTop: function(){ return 5; },
          paddingBottom: function(){ return 5; }
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
        { text: String(idx + 1), alignment: 'center', color: '#c9964b', bold: true, fontSize: 9 },
        { text: label, fontSize: 9, alignment: 'right' },
        { text: desc, fontSize: 8, color: '#748481', alignment: 'right' }
      ]);
    });
    return [
      { text: 'بنود الصيانة الدورية', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [25, 130, '*'],
          body: [[
            { text: '#', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'center' },
            { text: 'البند', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
            { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' }
          ]].concat(items)
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#e2e8e5'; },
          vLineColor: function(){ return '#e2e8e5'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#f4f9f6'; }
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
      { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
      { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
      { text: 'النسبة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'center' },
      { text: 'المبلغ', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'center' }
    ]];
    plan.forEach(function(p){
      var amount = total * p.pct;
      body.push([
        { text: p.label, fontSize: 9, bold: true, alignment: 'right' },
        { text: p.desc, fontSize: 8, color: '#748481', alignment: 'right' },
        { text: Math.round(p.pct * 100) + '%', fontSize: 9, alignment: 'center' },
        { text: safeMoney(amount), fontSize: 9, bold: true, color: '#c9964b', alignment: 'center' }
      ]);
    });
    return [
      { text: 'جدول الدفعات', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [60, '*', 40, 70],
          body: body
        },
        layout: {
          hLineWidth: function(){ return 0.5; },
          vLineWidth: function(){ return 0.5; },
          hLineColor: function(){ return '#e2e8e5'; },
          vLineColor: function(){ return '#e2e8e5'; },
          paddingLeft: function(){ return 6; },
          paddingRight: function(){ return 6; },
          paddingTop: function(){ return 4; },
          paddingBottom: function(){ return 4; },
          fillColor: function(i){ return i % 2 === 0 ? null : '#f4f9f6'; }
        },
        margin: [0, 0, 0, 10]
      }
    ];
  }

  function renderItems(arr, title){
    if (!arr || !arr.length) return null;
    var out = [{ text: title, fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] }];
    arr.forEach(function(item){
      var t = '', d = '';
      if (typeof item === 'string') { t = item; }
      else if (item && item.section) { t = item.section; d = item.description || item.title || ''; }
      else if (item && item.title) { t = item.title; d = item.description || ''; }
      else if (item && item.name) { t = item.name; d = item.description || item.desc || ''; }
      else { try { t = JSON.stringify(item); } catch(e){} }
      out.push({ text: t, bold: true, fontSize: 9, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' });
      if (d) out.push({ text: d, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 4], alignment: 'right' });
    });
    out.push({ text: '', margin: [0, 0, 0, 4] });
    return out;
  }

  var _sharedDd = {
    rtl: true,
    styles: {
      sectionTitle: { fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 2] },
      summaryLabel: { fontSize: 8, color: '#748481', bold: true },
      summaryValue: { fontSize: 11, color: '#102d2c', bold: true }
    },
    defaultStyle: { font: 'Cairo', fontSize: 10, lineHeight: 1.5 },
    pageSize: 'A4',
    pageMargins: [28, 36, 28, 36],
    header: function(){
      return {
        stack: [
          { text: 'نظام شموس', fontSize: 7, color: '#8b9f99', alignment: 'center', margin: [0, 6, 0, 0] },
          { canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#c9964b' }] }
        ]
      };
    },
    footer: function(currentPage, pageCount, cleanFooter){
      var f = [];
      f.push({ canvas: [{ type: 'line', x1: 28, y1: 0, x2: 568, y2: 0, lineWidth: 0.3, lineColor: '#c9964b' }], margin: [0, 0, 0, 2] });
      if (cleanFooter) f.push({ text: cleanFooter, fontSize: 7, color: '#748481', alignment: 'center', margin: [0, 0, 0, 1] });
      f.push({ text: '' + currentPage + ' / ' + pageCount, fontSize: 7, color: '#8b9f99', alignment: 'center' });
      return { stack: f, margin: [28, 0, 28, 6] };
    }
  };

  function makeDd(content, cleanFooter){
    var dd = JSON.parse(JSON.stringify(_sharedDd, function(k, v){
      return typeof v === 'function' ? undefined : v;
    }));
    dd.content = content;
    dd.header = function(){ return _sharedDd.header(); };
    dd.footer = function(cp, pc){ return _sharedDd.footer(cp, pc, cleanFooter); };
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
        var days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        datePart = days[dd.getDay()] + ' ' + dd.getDate() + '/' + (dd.getMonth() + 1) + '/' + dd.getFullYear() + 'م';
      }
    }

    var actionText = isInstall
      ? 'على توريد وتركيب مصعد وفق المواصفات والبنود الواردة في هذا العقد.'
      : 'على صيانة المصعد (المصاعد) وفق بنود الصيانة الدورية والشروط والمواصفات الواردة في هذا العقد.';

    return [
      { text: 'إنه في يوم ' + datePart + ' تم الاتفاق بين:', fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 4], alignment: 'right' },
      { stack: [
          { text: [{ text: 'الطرف الأول: ', bold: true, fontSize: 9, color: '#102d2c' }, { text: p1, fontSize: 9, color: '#3b564f' }], margin: [0, 2, 0, 1], alignment: 'right' },
          { text: [{ text: 'الطرف الثاني: ', bold: true, fontSize: 9, color: '#102d2c' }, { text: p2, fontSize: 9, color: '#3b564f' }], margin: [0, 0, 0, 4], alignment: 'right' }
        ], margin: [0, 0, 0, 4] },
      { text: actionText, fontSize: 9, bold: true, color: '#102d2c', margin: [0, 0, 0, 10], alignment: 'right' }
    ];
  }

  function sectionTitle(text, margin){
    return { text: text, fontSize: 12, bold: true, color: '#102d2c', margin: margin || [0, 0, 0, 4], alignment: 'right' };
  }

  function scopeText(text, fallback){
    return { text: text || fallback, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right', lineHeight: 1.8 };
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

  function specTable(info, overallTitle){
    if (!info || typeof info !== 'object') return null;
    var out = [];
    specGroups.forEach(function(group){
      var rows = [];
      group.fields.forEach(function(f){
        var val = info[f[0]];
        if (val && val !== '') {
          rows.push([
            { text: f[1], bold: true, fontSize: 8, fillColor: '#eef5f1', alignment: 'right', color: '#102d2c' },
            { text: val, fontSize: 8, alignment: 'right' }
          ]);
        }
      });
      if (rows.length) {
        if (overallTitle && !out.length) {
          out.push(sectionTitle(overallTitle, [0, 0, 0, 4]));
        }
        out.push({ text: group.tab, fontSize: 9, bold: true, color: '#c9964b', margin: [0, 0, 0, 2], alignment: 'right' });
        out.push({
          table: {
            headerRows: 0,
            widths: [100, '*'],
            body: rows
          },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#e2e8e5'; },
            vLineColor: function(){ return '#e2e8e5'; },
            paddingLeft: function(){ return 8; },
            paddingRight: function(){ return 8; },
            paddingTop: function(){ return 3; },
            paddingBottom: function(){ return 3; }
          },
          margin: [0, 0, 0, 8]
        });
      }
    });
    if (!out.length) return null;
    return out;
  }

  function sectionBlock(num, heading, body){
    var out = [];
    var label = 'البند ' + num + ': ' + heading;
    out.push(sectionTitle(label, [0, 0, 0, 2]));
    if (Array.isArray(body)) {
      out = out.concat(body);
    } else {
      out.push(body);
    }
    return out;
  }

  // ==================== CONTRACT ====================
  function contractPdfDefinition(c, logoData){
    var companyName = (c.company && c.company.name) || activeCompanyName();
    var cf = safeFooter();
    var content = [];
    var isInstall = c.type === 'تركيب';

    console.log("PDFGEN", "contract type:", c.type, "is install:", isInstall);

    Array.prototype.push.apply(content, buildHeader(logoData));

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'عقد ' + (c.type || ''), bold: true, fontSize: 16, color: '#102d2c', alignment: 'right' },
            { text: 'رقم العقد: ' + c.id, bold: true, fontSize: 10, color: '#fff', fillColor: '#102d2c', alignment: 'center', margin: [4, 2, 4, 2] }
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
          { text: 'عقد تركيب مصعد', fontSize: 14, bold: true, color: '#102d2c', alignment: 'center', margin: [0, 0, 0, 4] },
          { text: 'يسعدنا نحن ' + companyName + ' أن نتقدم لسعادتكم بهذا العقد لتوريد وتركيب مصعد في موقعكم الموضح أدناه، وفق المواصفات الفنية والبنود العامة المعتمدة.', fontSize: 9, color: '#3b564f', alignment: 'right', margin: [0, 0, 0, 6], lineHeight: 1.8 }
        ],
        margin: [0, 0, 0, 6]
      });
    }

    content.push({
      stack: [
        { text: 'الطرف الثاني', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 2] },
        { text: safeLabel(c), bold: true, fontSize: 14, color: '#102d2c', margin: [0, 2, 0, 4] }
      ],
      margin: [0, 0, 0, 8]
    });

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
      if (st) Array.prototype.push.apply(content, st);

      var pt = paymentPlanTable(c.value);
      if (pt) {
        Array.prototype.push.apply(content, sectionBlock('ثالثاً', 'شروط الدفع', pt));
      }

      var ti = renderItems(c.items, 'البند رابعاً: البنود الافتراضية');
      if (ti) Array.prototype.push.apply(content, ti);
      var ci = renderItems(c.customItems, 'البند خامساً: البنود الإضافية');
      if (ci) Array.prototype.push.apply(content, ci);
      else if (!ti) content.push(sectionTitle('البند رابعاً: البنود'));

      var buildings = c.buildings || [];
      if (buildings.length > 0) {
        var bd = [{ text: '', margin: [0, 0, 0, 2] }];
        buildings.forEach(function(b){
          bd.push({
            stack: [
              { text: b.name || 'غير محدد', bold: true, fontSize: 10, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' },
              { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 9, color: '#748481', margin: [0, 0, 0, 4], alignment: 'right' }
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
        content.push(sectionBlock('ثامناً', 'فترة الصيانة', { text: 'تبدأ فترة الصيانة من تاريخ تسليم المصعد (' + c.deliveryDate + ') إلى تاريخ (' + c.maintenanceEndDate + ')، على أن تشمل أعمال الصيانة الدورية والطارئة وفق بنود الصيانة المتفق عليها أعلاه.', fontSize: 9, color: '#3b564f', alignment: 'right', lineHeight: 1.8 }));
      }
    } else {
      var scopeDefault = 'يشمل العقد أعمال الصيانة الدورية للمصعد (المصاعد) وفق بنود الصيانة والشروط والمواصفات الواردة في هذا العقد، للحفاظ على سلامة وأداء المصعد طوال مدة العقد.';
      Array.prototype.push.apply(content, sectionBlock('أولاً', 'نطاق الصيانة', scopeText(c.details, scopeDefault)));

      var st = specTable(c.elevatorInfo, 'البند ثانياً: المواصفات الفنية للمصعد');
      if (st) Array.prototype.push.apply(content, st);

      var mt = maintenanceTable(c.maintenanceChecklist);
      if (mt) Array.prototype.push.apply(content, sectionBlock('ثالثاً', 'بنود الصيانة الدورية', mt));

      var buildings = c.buildings || [];
      if (buildings.length > 0) {
        var bd = [{ text: '', margin: [0, 0, 0, 2] }];
        buildings.forEach(function(b){
          bd.push({
            stack: [
              { text: b.name || 'غير محدد', bold: true, fontSize: 10, color: '#17413e', margin: [0, 0, 0, 1], alignment: 'right' },
              { text: [b.district, b.mapUrl].filter(Boolean).join(' - ') || '', fontSize: 9, color: '#748481', margin: [0, 0, 0, 4], alignment: 'right' }
            ],
            margin: [0, 0, 0, 2]
          });
        });
        Array.prototype.push.apply(content, sectionBlock('رابعاً', 'المباني والمواقع', bd));
      }

      var ti = renderItems(c.items, 'خامساً: البنود الافتراضية');
      if (ti) Array.prototype.push.apply(content, ti);
      var ci = renderItems(c.customItems, 'البنود الإضافية');
      if (ci) Array.prototype.push.apply(content, ci);
    }

    content.push({
      table: {
        widths: ['*'],
        body: [[{ stack: buildSignature(companyName, safeLabel(c)) }]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf);
  }

  // ==================== QUOTE ====================
  function quotePdfDefinition(q, logoData){
    var total = Number(q.totalWithTax != null ? q.totalWithTax : (q.subtotal != null ? q.subtotal : (q.value || 0)));
    var party = q.client || q.clientCompanyName || q.clientName || "غير محدد";
    var isInstall = q.type === "تركيب";
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    Array.prototype.push.apply(content, buildHeader(logoData));

    content.push({
      columns: [
        { text: 'عرض سعر' + (q.type ? ' - ' + q.type : ''), bold: true, fontSize: 16, color: '#102d2c' },
        statusBadge(q.status || 'بانتظار الرد')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم عرض السعر: ' + q.id, bold: true, fontSize: 14, color: '#c9964b', alignment: 'right' },
            { text: 'الإجمالي', fontSize: 10, color: '#748481', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(total), bold: true, fontSize: 18, color: '#c9964b', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });
    content.push({
      stack: [
        { text: 'الطرف الموجه إليه عرض السعر', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 2] },
        { text: party, bold: true, fontSize: 14, color: '#102d2c', margin: [0, 2, 0, 4], alignment: 'right' }
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
          { text: 'الدفعة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
          { text: 'البيان', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'right' },
          { text: 'القيمة', bold: true, color: '#fff', fillColor: '#102d2c', alignment: 'center' }
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
        content.push({ text: 'جدول الدفعات', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] });
        content.push({
          table: { headerRows: 1, widths: ['*', '*', 80], body: planRows },
          layout: {
            hLineWidth: function(){ return 0.5; },
            vLineWidth: function(){ return 0.5; },
            hLineColor: function(){ return '#e2e8e5'; },
            vLineColor: function(){ return '#e2e8e5'; },
            paddingLeft: function(){ return 6; },
            paddingRight: function(){ return 6; },
            paddingTop: function(){ return 4; },
            paddingBottom: function(){ return 4; },
            fillColor: function(i){ return i === 0 ? null : (i % 2 === 0 ? null : '#f4f9f6'); }
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
      content.push({ text: 'التفاصيل', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4] });
      content.push({ text: q.details, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' });
    }

    content.push({
      table: { widths: ['*'], body: [[{ stack: buildSignature(companyName, party) }]] },
      layout: 'noBorders', margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf);
  }

  // ==================== REPORT ====================
  function reportPdfDefinition(r, logoData){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    Array.prototype.push.apply(content, buildHeader(logoData));

    content.push({
      columns: [
        { text: 'تقرير زيارة فنية', bold: true, fontSize: 16, color: '#102d2c' },
        statusBadge(r.status || 'بانتظار اعتماد العميل')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم التقرير: ' + r.id, bold: true, fontSize: 14, color: '#c9964b', alignment: 'right' },
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
        { text: title, fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4], alignment: 'right' },
        { text: text, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' }
      ];
    }

    var s1 = section('الأعمال المنفذة', r.workDone);
    if (s1) Array.prototype.push.apply(content, s1);
    var s2 = section('الأعطال والملاحظات الفنية', r.issues);
    if (s2) Array.prototype.push.apply(content, s2);

    if (r.parts || r.recommendations) {
      content.push({ text: 'قطع الغيار المطلوبة / المستخدمة والتوصيات', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.parts) content.push({ text: r.parts, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 4], alignment: 'right' });
      if (r.recommendations) content.push({ text: r.recommendations, fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right' });
    }

    var s3 = section('صور أو روابط مرفقة', r.attachments);
    if (s3) Array.prototype.push.apply(content, s3);

    content.push({
      table: { widths: ['*'], body: [[{ stack: buildSignature(companyName, r.clientName || r.clientCompanyName || 'العميل') }]] },
      layout: 'noBorders', margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf);
  }

  // ==================== TICKET ====================
  function ticketPdfDefinition(t, logoData){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    Array.prototype.push.apply(content, buildHeader(logoData));

    content.push({
      columns: [
        { text: 'بلاغ - ' + t.id, bold: true, fontSize: 16, color: '#102d2c' },
        statusBadge(t.status)
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      stack: [
        { text: t.title, bold: true, fontSize: 14, color: '#102d2c', margin: [0, 0, 0, 2], alignment: 'right' },
        { text: t.description || '', fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 6], alignment: 'right' }
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
      table: { widths: ['*'], body: [[{ stack: buildSignature(companyName, t.clientCompanyName || t.clientName || 'العميل') }]] },
      layout: 'noBorders', margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf);
  }

  // ==================== CLAIM ====================
  function claimPdfDefinition(cl, logoData){
    var companyName = activeCompanyName();
    var cf = safeFooter();
    var content = [];
    Array.prototype.push.apply(content, buildHeader(logoData));

    content.push({
      columns: [
        { text: 'مستخلص مالي', bold: true, fontSize: 16, color: '#102d2c' },
        statusBadge(cl.status || 'قيد المراجعة')
      ],
      margin: [0, 0, 0, 6]
    });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            { text: 'رقم المستخلص: ' + cl.id, bold: true, fontSize: 14, color: '#c9964b', alignment: 'right' },
            { text: 'قيمة المستخلص', fontSize: 10, color: '#748481', alignment: 'center' }
          ],
          [
            { text: '', border: [false, false, false, false] },
            { text: safeMoney(cl.value), bold: true, fontSize: 18, color: '#c9964b', alignment: 'center' }
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

    content.push({ text: 'بيان المستخلص', fontSize: 12, bold: true, color: '#102d2c', margin: [0, 0, 0, 4], alignment: 'right' });
    content.push({
      text: 'مستخلص عن الفترة الموضحة أعلاه بمبلغ إجمالي ' + safeMoney(cl.value) + ' وفق بيانات العقد والخدمات المسجلة في النظام.',
      fontSize: 9, color: '#3b564f', margin: [0, 0, 0, 10], alignment: 'right'
    });

    content.push({
      table: { widths: ['*'], body: [[{ stack: buildSignature(companyName, cl.clientName || safeLabel(cl) || 'الطرف الثاني') }]] },
      layout: 'noBorders', margin: [0, 0, 0, 0]
    });
    return makeDd(content, cf);
  }

  // ==================== MAIN ENTRY ====================
  function pdfLog(msg){ console.log("PDFGEN", msg); if (A.toast) A.toast(msg); }

  window.generatePdf = async function(type, id){
    console.log("PDFGEN", "pdfmake attempt", type, id, "ready:", pdfmakeReady);
    if (!pdfmakeReady) {
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
        dd = contractPdfDefinition(contract, logoData);

      } else if (type === 'quote') {
        var quote;
        if (A.quotes && A.quotes.length) {
          quote = A.quotes.filter(function(q){ return A.sameCompany ? A.sameCompany(q) : true; }).find(function(x){ return x.id === id; });
        }
        if (!quote) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = quotePdfDefinition(quote, logoData);

      } else if (type === 'report') {
        var report;
        if (A.reports && A.reports.length) {
          report = A.reports.filter(function(r){ return A.sameCompany ? A.sameCompany(r) : true; }).find(function(x){ return x.id === id; });
        }
        if (!report) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = reportPdfDefinition(report, logoData);

      } else if (type === 'ticket') {
        var ticket;
        if (A.visibleTickets) ticket = A.visibleTickets().find(function(x){ return x.id === id; });
        if (!ticket) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = ticketPdfDefinition(ticket, logoData);

      } else if (type === 'claim') {
        var claims;
        try { claims = A._read ? A._read('misadClaims') : JSON.parse(localStorage.getItem('misadClaims') || '[]'); } catch(e){ claims = null; }
        if (!claims || !claims.length) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        var claim = claims.filter(function(c){ return A.sameCompany ? A.sameCompany(c) : true; }).find(function(x){ return x.id === id; });
        if (!claim) { if (A.downloadPdf) A.downloadPdf(type, id); return; }
        dd = claimPdfDefinition(claim, logoData);

      } else {
        if (A.downloadPdf) A.downloadPdf(type, id);
        return;
      }

      if (!dd) { if (A.downloadPdf) A.downloadPdf(type, id); return; }

      pdfMake.createPdf(dd).download(p.title + '.pdf');
      pdfLog('تم تحميل PDF بنجاح');

    } catch(err) {
      console.error("PDFGEN", "pdfmake error:", err);
      pdfLog('PDF — خطأ في التوليد، تجربة الطريقة القديمة');
      if (A.downloadPdf) A.downloadPdf(type, id);
    }
  };

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pdf-doc]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      window.generatePdf(btn.dataset.pdfDoc, btn.dataset.pdfId);
    }
  }, true);

  console.log("PDFGEN", "pdfmake-gen loaded, pdfmakeReady:", pdfmakeReady, "pdfMake exists:", typeof pdfMake !== 'undefined', "fonts defined:", !!(pdfMake && pdfMake.fonts));
})();
