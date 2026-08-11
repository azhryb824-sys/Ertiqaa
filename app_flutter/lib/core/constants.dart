import 'dart:math';

/// ثوابت النظام المستخرجة حرفياً من app.js — تطابق تام مطلوب.
class AppConstants {
  AppConstants._();

  // ===== مفاتيح التخزين =====
  static const List<String> storageKeys = [
    'misadUsers', 'misadContracts', 'misadVisits', 'misadTickets',
    'misadCompanyStaff', 'misadStaffLocations', 'misadClientCompanies',
    'misadOwnerCompanies', 'misadDefaultItems', 'misadVisitReports',
    'misadQuotes', 'misadCompanyDocs', 'misadElevatorAssets',
    'misadPartsInventory', 'misadSuppliers', 'misadActivityLog',
    'misadVisitMessages', 'misadMeetings', 'misadSystemBanners',
    'misadKnowledgePages', 'misadAdminInvites',     'misadFinancialEntries',
    'misadReceipts', 'misadClaims', 'misadInvoices', 'misadCustodies', 'misadPayrolls',
    'misadCustomerInvoices', 'misadTreasury', 'misadBankAccounts',
    'misadPurchaseInvoices', 'misadContractExpenses', 'misadContractPayments',
    'misadStaffPurchaseInvoices', 'misadStaffVouchers',
    'misadChartOfAccounts', 'misadJournalEntries', 'misadFinanceAuditLog',
  ];

  static const String kClaims = 'misadClaims';
  static const String kInvoices = 'misadInvoices';
  static const String kCustodies = 'misadCustodies';
  static const String kPayrolls = 'misadPayrolls';
  static const String kFormDrafts = 'misadFormDrafts';
  static const String kSession = 'misadSession';
  static const String kDeviceId = 'misadDeviceId';
  static const String kContractPdfDownloads = 'misadContractPdfDownloads';
  static const String kQuotePdfDownloads = 'misadQuotePdfDownloads';
  static const String kCustomerInvoices = 'misadCustomerInvoices';
  static const String kTreasury = 'misadTreasury';
  static const String kBankAccounts = 'misadBankAccounts';

  // ===== الأدوار =====
  static const String roleOwner = 'owner';
  static const String roleCompanyAdmin = 'company_admin';
  static const String roleTechnician = 'technician';
  static const String roleEngineer = 'engineer';
  static const String roleAdministrative = 'administrative';
  static const String roleClient = 'client';
  static const String roleAdmin = 'admin';

  static const Map<String, String> roleLabels = {
    roleOwner: 'مالك المنشأة',
    roleCompanyAdmin: 'إداري بصلاحية نظام',
    roleTechnician: 'فني',
    roleEngineer: 'مهندس',
    roleAdministrative: 'موظف إداري',
    roleClient: 'عميل',
    roleAdmin: 'مشرف النظام',
  };

  static const List<String> manageRoles = [
    roleOwner, roleCompanyAdmin, roleAdmin,
  ];

  static const List<String> fieldRoles = [roleTechnician, roleEngineer];

  // ===== مستخدمو النظام الثابتون (fallback عند عدم توفر الخادم) =====
  // تُمرر بيانات الدخول وقت البناء عبر --dart-define ولا تُحفظ في المستودع.
  static const String _fallbackAdminId =
      String.fromEnvironment('ERTIQAA_FALLBACK_ADMIN_ID');
  static const String _fallbackAdminPassword =
      String.fromEnvironment('ERTIQAA_FALLBACK_ADMIN_PASSWORD');
  static const String _fallbackCompanyAdminId =
      String.fromEnvironment('ERTIQAA_FALLBACK_COMPANY_ADMIN_ID');
  static const String _fallbackCompanyAdminPassword =
      String.fromEnvironment('ERTIQAA_FALLBACK_COMPANY_ADMIN_PASSWORD');
  static const String _fallbackOwnerId =
      String.fromEnvironment('ERTIQAA_FALLBACK_OWNER_ID');
  static const String _fallbackOwnerPassword =
      String.fromEnvironment('ERTIQAA_FALLBACK_OWNER_PASSWORD');

  static const List<Map<String, dynamic>> systemUsers = [
    {'id': _fallbackAdminId, 'password': _fallbackAdminPassword, 'role': roleAdmin, 'name': 'مشرف النظام', 'permissions': ['*']},
    {'id': _fallbackCompanyAdminId, 'password': _fallbackCompanyAdminPassword, 'role': roleCompanyAdmin, 'name': 'إداري الشركة', 'permissions': ['*'], 'mustChangePassword': true},
    {'id': _fallbackOwnerId, 'password': _fallbackOwnerPassword, 'role': roleOwner, 'name': 'مالك المنشأة', 'permissions': ['*'], 'mustChangePassword': true, 'companyOwnerId': _fallbackOwnerId},
  ];

  // ===== حالات =====
  static const String statusActive = 'ساري';
  static const String statusPendingClient = 'بانتظار موافقة العميل';
  static const String statusPendingReceipt = 'بانتظار مراجعة إيصال الدفع';
  static const String statusCancelled = 'ملغي';
  static const String statusExpired = 'منتهيا';
  static const String statusDeleted = 'محذوف';
  static const String statusOld = 'قديم';

  static const List<String> ticketPriorities = ['urgent', 'high', 'medium', 'low'];
  static const Map<String, String> ticketPriorityLabels = {
    'urgent': 'طارئة', 'high': 'عالية', 'medium': 'متوسطة', 'low': 'منخفضة',
  };

  static const List<String> contractTypes = [
    'صيانة', 'تركيب', 'توريد وتركيب قطع غيار', 'إعادة تأهيل مصعد',
    'إضافة ملحقات مصعد', 'استبدال مكون',
  ];

  // ===== القيم الافتراضية للمواصفات =====
  static const Map<String, String> specDefaults = {
    'elevatorType': 'ركاب', 'usage': 'سكني', 'entrances': '1',
    'doorDirection': 'سنتر', 'doorType': 'أوتوماتيك', 'speedSystem': 'VVVF',
    'motorType': 'Gearless', 'motorManufacturer': 'محلي', 'controller': 'VEGA',
    'doorManufacturer': 'Sky', 'ropeManufacturer': 'ATIKA', 'railManufacturer': 'MF',
    'originCountry': 'إيطاليا', 'floorType': 'رخام', 'wallType': 'ستانلس ستيل',
    'ceilingType': 'ستانلس ستيل', 'lightingType': 'LED', 'displayType': 'Digital',
    'risotType': 'أزرار ستانلس', 'bufferType': 'Hydraulic',
    'doorLockType': 'Electromechanical', 'rescueSystem': 'نعم',
    'coolingSystem': 'مروحة', 'intercom': 'نعم', 'camera': 'لا',
    'mirrors': 'نعم', 'fan': 'نعم', 'voiceAnnouncement': 'لا', 'braille': 'لا',
    'fireMode': 'نعم', 'warranty': '5 سنوات', 'capacity': '450 كجم',
    'persons': '6', 'stops': '3', 'age': '', 'speed': '1 م/ث',
    'travelHeight': 'حسب الموقع', 'shaftWidth': '160 سم', 'shaftLength': '160 سم',
    'pitDepth': '140 سم', 'overhead': '360 سم', 'doorWidth': '80 سم',
    'doorHeight': '200 سم', 'motorPower': '5.5 kW', 'motorSpeed': '1500 rpm',
    'voltage': '380V', 'frequency': '60Hz', 'phases': '3',
    'cabinSize': '110 × 140 سم', 'ropesCount': '4', 'ropeDiameter': '10 مم',
    'counterweight': 'حسب التصميم', 'railSize': 'T9', 'travelCableSize': '24 خط',
    'doorOpenTime': '3 ثوان', 'doorCloseTime': '3 ثوان',
    'powerConsumption': 'حسب التشغيل', 'notes': '',
  };

  // ===== مجموعات المواصفات =====
  /// كل مجموعة: (الاسم، [ [الحقل، التسمية، النوع، [خيارات]] ])
  static const List<Map<String, dynamic>> specGroups = [
    {
      'tab': 'مواصفات المصعد',
      'fields': [
        ['elevatorType', 'نوع المصعد', 'select', ['ركاب', 'حمولة', 'بانوراما', 'طعام', 'سيارات']],
        ['usage', 'الاستخدام', 'select', ['سكني', 'تجاري', 'فندقي', 'مستشفى', 'مواقف']],
        ['capacity', 'الحمولة', 'input', null],
        ['persons', 'عدد الأشخاص', 'input', null],
        ['stops', 'عدد الوقفات', 'input', null],
        ['age', 'عمر المصعد', 'input', null],
        ['speed', 'السرعة', 'input', null],
        ['travelHeight', 'ارتفاع المشوار', 'input', null],
        ['shaftLength', 'طول البئر', 'input', null],
        ['shaftWidth', 'عرض البئر', 'input', null],
        ['pitDepth', 'عمق الحفرة', 'input', null],
        ['overhead', 'الارتفاع العلوي', 'input', null],
        ['entrances', 'عدد المداخل', 'select', ['1', '2', '3']],
        ['doorDirection', 'اتجاه الأبواب', 'select', ['سنتر', 'تلسكوبي']],
        ['speedSystem', 'نظام السرعة', 'select', ['VVVF', 'هيدروليك', 'سرعة واحدة', 'سرعتان']],
        ['doorType', 'نوع الأبواب', 'select', ['أتوماتيك', 'نصف أتوماتيك']],
        ['motorManufacturer', 'ماركة المصعد', 'select', ['Italy Gears', 'Sicor', 'Montanari', 'Fuji', 'Ziehl-Abegg', 'محلي']],
      ],
    },
    {
      'tab': 'المحرك والكنترول',
      'fields': [
        ['motorType', 'نوع المحرك', 'select', ['Gearless', 'Geared', 'Hydraulic']],
        ['motorPower', 'قدرة المحرك', 'input', null],
        ['motorSpeed', 'سرعة المحرك', 'input', null],
        ['controller', 'الكنترول', 'select', ['VEGA', 'Monarch', 'Arkel', 'Fuji', 'STEP']],
        ['ropeManufacturer', 'الشركة المصنعة للحبال', 'select', ['ATIKA', 'Gustav Wolf', 'PFEIFER', 'Brugg']],
        ['ropesCount', 'عدد الحبال', 'input', null],
        ['ropeDiameter', 'قطر الحبال', 'input', null],
        ['counterweight', 'وزن الثقال', 'input', null],
        ['railManufacturer', 'الشركة المصنعة للسكك', 'select', ['MF', 'Monteferro', 'Savera', 'Marazzi']],
        ['railSize', 'مقاس السكك', 'input', null],
        ['originCountry', 'بلد المنشأ', 'select', ['إيطاليا', 'تركيا', 'ألمانيا', 'الصين', 'إسبانيا', 'محلي']],
      ],
    },
    {
      'tab': 'الكابينة',
      'fields': [
        ['cabinSize', 'أبعاد الكابينة', 'input', null],
        ['floorType', 'نوع الأرضية', 'select', ['رخام', 'جرانيت', 'PVC', 'ستانلس']],
        ['wallType', 'نوع الجدران', 'select', ['ستانلس ستيل', 'زجاج', 'خشب', 'دهان']],
        ['ceilingType', 'نوع السقف', 'select', ['ستانلس ستيل', 'سقف معلق', 'زجاج']],
        ['lightingType', 'نوع الإنارة', 'select', ['LED', 'Spotlight', 'Indirect']],
        ['displayType', 'نوع شاشة العرض', 'select', ['Digital', 'LCD', 'Dot Matrix']],
        ['risotType', 'نوع البرشوت', 'select', ['أزرار ستانلس', 'Touch', 'Braille Buttons']],
        ['mirrors', 'وجود مرايا', 'select', ['نعم', 'لا']],
        ['fan', 'وجود مروحة', 'select', ['نعم', 'لا']],
        ['voiceAnnouncement', 'وجود Voice Announcement', 'select', ['نعم', 'لا']],
        ['braille', 'وجود Braille', 'select', ['نعم', 'لا']],
      ],
    },
    {
      'tab': 'الأبواب',
      'fields': [
        ['doorManufacturer', 'الشركة المصنعة للأبواب', 'select', ['Sky', 'Fermator', 'Selcom', 'Wittur']],
        ['doorWidth', 'عرض الباب', 'input', null],
        ['doorHeight', 'ارتفاع الباب', 'input', null],
        ['doorOpenTime', 'زمن فتح الباب', 'input', null],
        ['doorCloseTime', 'زمن إغلاق الباب', 'input', null],
        ['doorLockType', 'نوع أقفال الأبواب', 'select', ['Electromechanical', 'Mechanical', 'Safety Lock']],
      ],
    },
    {
      'tab': 'أنظمة الأمان',
      'fields': [
        ['bufferType', 'نوع Buffer', 'select', ['Hydraulic', 'Spring', 'Polyurethane']],
        ['rescueSystem', 'نظام الإنقاذ', 'select', ['نعم', 'لا']],
        ['coolingSystem', 'نظام التبريد', 'select', ['مروحة', 'تكييف', 'لا يوجد']],
        ['intercom', 'وجود إنتركم', 'select', ['نعم', 'لا']],
        ['camera', 'وجود كاميرا', 'select', ['نعم', 'لا']],
        ['fireMode', 'وجود Fire Mode', 'select', ['نعم', 'لا']],
      ],
    },
    {
      'tab': 'الكهرباء',
      'fields': [
        ['voltage', 'الجهد', 'input', null],
        ['frequency', 'التردد', 'input', null],
        ['phases', 'عدد الفازات', 'input', null],
        ['travelCableSize', 'مقاس الكيبل المرن', 'input', null],
        ['powerConsumption', 'استهلاك الكهرباء', 'input', null],
      ],
    },
    {
      'tab': 'الضمان',
      'fields': [
        ['warranty', 'مدة الضمان', 'select', ['سنة', 'سنتان', '3 سنوات', '5 سنوات']],
        ['notes', 'الملاحظات', 'textarea', null],
      ],
    },
  ];

  // ===== بنود الصيانة الدورية =====
  static const List<Map<String, dynamic>> maintenanceSections = [
    {
      'section': 'غرفة المصعد',
      'items': [
        'فحص زيت المحرك والتأكد من سيره الطبيعي.',
        'فحص قماش الفرامل.',
        'فحص عمل الفرامل وتضبيطه وتشحيم المحاور.',
        'فحص السيور والتأكد من سلامتها.',
        'فحص سلكتور والطوابق.',
        'فحص جهاز الهبوط الاضطراري.',
        'فحص منظم السرعة وضبطه.',
        'تنظيف أرضية الغرفة.',
        'التأكد من سلامة التمديدات الكهربائية بالغرفة.',
        'التأكد من عدم وجود تهريب مياه بالغرفة.',
        'التأكد من عدم وجود أي تخزين بالغرفة.',
        'التأكد من وجود التكييف بحالة سليمة.',
      ],
    },
    {
      'section': 'بئر المصعد',
      'items': [
        'فحص التوصيلات الكهربائية أعلى الصاعدة والتأكد من سلامتها.',
        'فحص جهاز الريفيزيون في حالة الصعود والهبوط والتوقف.',
        'فحص حبال الجر وشدادات الحبال.',
        'فحص بكرات الحبال والتأكد من سلامتها.',
        'تزييت وتشحيم أدلة سير الصاعدة والثقل.',
        'فحص قواطع نهاية المشوار.',
        'فحص مغناطيس الأدوار.',
        'الكشف على مروحة الصاعدة.',
      ],
    },
    {
      'section': 'داخل المصعد',
      'items': [
        'الكشف على أزرار التحكم والتشغيل.',
        'الكشف عن الإنارة والجرس والانتركوم.',
        'تنظيف مجاري الأبواب.',
      ],
    },
    {
      'section': 'أبواب الطوابق',
      'items': [
        'فحص أبواب الأدوار وضبطها.',
        'فحص محركات الأبواب.',
        'فحص وتنظيف الشوك والكوالين.',
        'فحص مفصلات الأبواب.',
        'فحص الكابلات والمؤشرات والمبينات وضبط الإضاءة.',
      ],
    },
    {
      'section': 'حفرة البئر',
      'items': [
        'الكشف على بكرة منظم السرعة.',
        'تنظيف وفحص قواطع نهاية المشوار.',
        'فحص التوصيلات الكهربائية أسفل الصاعدة والتأكد من سلامتها.',
        'تنظيف الحفرة.',
      ],
    },
  ];

  /// خطة الدفعات الافتراضية لعقود التركيب
  static const List<Map<String, dynamic>> defaultPaymentPlan = [
    {'label': 'الدفعة الأولى', 'description': 'عند توقيع العقد لتوريد وتركيب السكة والأبواب والبيت الحديدي', 'percent': 50},
    {'label': 'الدفعة الثانية', 'description': 'لتوريد وتركيب الكابينة', 'percent': 35},
    {'label': 'الدفعة الثالثة', 'description': 'لتوريد وتركيب المكينة ولوحة التحكم والتشغيل والاختبار', 'percent': 15},
  ];

  static const double quoteTaxRate = 0;

  // ===== لوحة التنقل حسب الدور =====
  static const Map<String, List<List<String>>> navs = {
    roleOwner: [
      ['overview', 'نظرة عامة'], ['ai-admin', 'الإدارة الذكية'], ['predictions', 'التنبؤ بالأعطال'],
      ['knowledge-base', 'قاعدة المعرفة'], ['analytics', 'التحليلات'], ['drafts', 'المسودات'],
      ['operations', 'مركز التشغيل'], ['notifications', 'الإشعارات'], ['whatsapp', 'واتساب'],
      ['contracts', 'العقود'], ['assets', 'أصول المصاعد'], ['tickets', 'البلاغات'],
      ['company-customers', 'عملاء الشركة'], ['quotes', 'عروض الأسعار'], ['default-items', 'البنود الافتراضية'],
      ['finance', 'الإدارة المالية'], ['claims', 'المستخلصات'], ['receipts', 'سندات القبض'], ['staff-finance', 'مالية الموظفين'],
      ['visits', 'الزيارات'],
      ['meetings', 'الاجتماعات'], ['tracking', 'تتبع الفنيين'], ['reports', 'تقارير الزيارات'],
      ['inventory', 'المخزون'], ['suppliers', 'الموردون'], ['team', 'فريق العمل'],
      ['company-docs', 'المستندات'], ['activity', 'سجل النشاط'], ['company', 'بيانات المنشأة'],
      ['entry-links', 'روابط التسجيل'], ['data-tools', 'إدارة البيانات'], ['voice-settings', 'إعدادات الصوت'],
    ],
    roleCompanyAdmin: [
      ['overview', 'نظرة عامة'], ['ai-admin', 'الإدارة الذكية'], ['predictions', 'التنبؤ بالأعطال'],
      ['knowledge-base', 'قاعدة المعرفة'], ['analytics', 'التحليلات'], ['drafts', 'المسودات'],
      ['operations', 'مركز التشغيل'], ['notifications', 'الإشعارات'], ['whatsapp', 'واتساب'],
      ['team', 'الفنيون'], ['tickets', 'البلاغات'], ['visits', 'الزيارات'],
      ['meetings', 'الاجتماعات'], ['tracking', 'تتبع الفنيين'], ['reports', 'تقارير الزيارات'],
      ['assets', 'أصول المصاعد'], ['receipts', 'سندات القبض'], ['staff-finance', 'مالية الموظفين'],
      ['inventory', 'المخزون'],
      ['suppliers', 'الموردون'], ['company-docs', 'المستندات'], ['activity', 'سجل النشاط'],
      ['company', 'بيانات الشركة'], ['entry-links', 'روابط التسجيل'], ['voice-settings', 'إعدادات الصوت'],
    ],
    roleTechnician: [
      ['overview', 'نظرة عامة'], ['ai-admin', 'المساعد الذكي'], ['predictions', 'التنبؤ بالأعطال'],
      ['knowledge-base', 'قاعدة المعرفة'], ['notifications', 'الإشعارات'], ['drafts', 'المسودات'],
      ['tickets', 'بلاغاتي'], ['visits', 'زياراتي'], ['my-location', 'موقعي'],
      ['reports', 'تقارير الزيارات'], ['voice-settings', 'إعدادات الصوت'],
    ],
    roleClient: [
      ['overview', 'نظرة عامة'], ['ai-admin', 'المساعد الذكي'], ['notifications', 'الإشعارات'],
      ['client-companies', 'منشآتي'], ['contracts', 'عقودي'], ['tickets', 'بلاغاتي'],
      ['quotes', 'عروض الأسعار'], ['visits', 'الزيارات'], ['reports', 'تقارير الزيارات'],
      ['voice-settings', 'إعدادات الصوت'],
    ],
    roleAdmin: [
      ['overview', 'نظرة عامة'], ['ai-admin', 'الإدارة الذكية'], ['predictions', 'التنبؤ بالأعطال'],
      ['knowledge-base', 'قاعدة المعرفة'], ['analytics', 'التحليلات'], ['drafts', 'المسودات'],
      ['operations', 'مركز التشغيل'], ['notifications', 'الإشعارات'], ['users', 'المستخدمون'],
      ['companies', 'الشركات والمؤسسات'], ['system', 'النظام'], ['banners', 'البنرات'],
      ['contracts', 'العقود'], ['assets', 'أصول المصاعد'],
      ['tickets', 'البلاغات'], ['company-customers', 'عملاء الشركة'], ['quotes', 'عروض الأسعار'],
      ['default-items', 'البنود الافتراضية'], ['claims', 'المستخلصات'], ['receipts', 'سندات القبض'],
      ['visits', 'الزيارات'], ['meetings', 'الاجتماعات'], ['tracking', 'تتبع الفنيين'],
      ['reports', 'تقارير الزيارات'], ['inventory', 'المخزون'], ['suppliers', 'الموردون'],
      ['team', 'فريق العمل'], ['company-docs', 'المستندات'], ['activity', 'سجل النشاط'],
      ['company', 'بيانات المنشأة'], ['entry-links', 'روابط التسجيل'], ['moderation', 'الإنذارات والحظر'],
      ['data-tools', 'إدارة البيانات'], ['storage-data', 'بيانات التخزين'], ['voice-settings', 'إعدادات الصوت'],
    ],
  };

  // ===== شارة الحالة =====
  static const Set<String> successStatuses = {'ساري', 'مجدولة', 'معتمدة', 'مكتملة', 'مسددة'};
  static const String badgeCancelled = 'ملغي';
  static const String badgePending = 'pending';

  // ===== هويات محظورة =====
  static const List<String> blockedIds = ['0000000000', '1111111111', '3333333333'];

  // ===== توليد معرفات =====
  static String id(String prefix) => '$prefix-${DateTime.now().millisecondsSinceEpoch}';
  static String nextContractId(List<String> existingIds) {
    final used = existingIds.toSet();
    var n = 0;
    for (final id in existingIds) {
      final m = RegExp(r'^CONT(\d{4})$').firstMatch(id);
      if (m != null) n = max(n, int.parse(m.group(1)!));
    }
    n += 1;
    while (used.contains('CONT${n.toString().padLeft(4, '0')}')) n++;
    return 'CONT${n.toString().padLeft(4, '0')}';
  }
}
