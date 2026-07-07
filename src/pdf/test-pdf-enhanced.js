// Test Enhanced Arabic PDF Generator with Smart Page Breaks
const ArabicPDFGenerator = require('./html-pdf-generator-enhanced');
const path = require('path');

async function testContractLarge() {
  console.log('Testing contract generation with large content...');
  
  const generator = new ArabicPDFGenerator();
  
  const contractData = {
    company: {
      name: 'شركة شموس للمصاعد',
      address: 'الرياض، المملكة العربية السعودية',
      phone: '+966 11 234 5678',
      email: 'info@shumoos-elevators.com'
    },
    contractNumber: 'CTR-2024-001',
    date: '2024-01-15',
    clientName: 'محمد أحمد العلي',
    clientAddress: 'جدة، حي النخيل',
    clientPhone: '+966 50 123 4567',
    location: 'برج الأفق، جدة',
    elevatorType: 'مصعد ركاب',
    capacity: '13 شخص',
    elevatorCount: '2',
    terms: [
      'تلتزم الشركة بصيانة دورية للمصعد كل شهر',
      'استبدال القطع التالفة فوراً',
      'التواجد على مدار الساعة للطوارئ',
      'الالتزام بالمعايير السلامة السعودية',
      'توفير تقارير شهرية عن حالة المصعد',
      'تدريب الفنيين على أحدث التقنيات',
      'استخدام قطع غيار أصلية فقط',
      'ضمان الجودة على جميع الخدمات',
      'الالتزام بمواعيد الصيانة المحددة',
      'توفير دعم فني على مدار الساعة',
      'إجراء فحص شامل قبل التسليم',
      'توثيق جميع عمليات الصيانة',
      'التأكد من سلامة جميع الأجهزة',
      'اختبار الأنظمة بعد كل صيانة',
      'تزويد العميل بتقرير مفصل'
    ],
    pricing: {
      contractValue: '25,000',
      paymentMethod: 'دفعة واحدة',
      duration: 'سنة واحدة'
    },
    companyName: 'شركة شموس للمصاعد'
  };
  
  const outputPath = path.join(__dirname, '../../output/contract-large-test.pdf');
  await generator.generateContract(contractData, outputPath);
  
  console.log('✓ Large contract generated:', outputPath);
}

async function testQuoteLarge() {
  console.log('Testing quote generation with large content...');
  
  const generator = new ArabicPDFGenerator();
  
  const quoteData = {
    company: {
      name: 'شركة شموس للمصاعد',
      address: 'الرياض، المملكة العربية السعودية',
      phone: '+966 11 234 5678',
      email: 'info@shumoos-elevators.com'
    },
    quoteNumber: 'QT-2024-001',
    date: '2024-01-15',
    clientName: 'شركة الأفق للتطوير العقاري',
    validUntil: '2024-02-15',
    items: [
      { name: 'صيانة دورية', description: 'صيانة شهرية شاملة لمصعد ركاب', quantity: '12', price: '1,500', total: '18,000' },
      { name: 'قطع غيار', description: 'توفير قطع غيار أساسية', quantity: '1', price: '3,000', total: '3,000' },
      { name: 'خدمة طوارئ', description: 'خدمة 24/7 للطوارئ', quantity: '1', price: '2,000', total: '2,000' },
      { name: 'فحص سنوي', description: 'فحص شامل سنوي للمصعد', quantity: '1', price: '1,500', total: '1,500' },
      { name: 'تحديث برمجيات', description: 'تحديث برمجيات التحكم', quantity: '1', price: '1,000', total: '1,000' },
      { name: 'تدريب', description: 'تدريب العاملين على الاستخدام', quantity: '2', price: '500', total: '1,000' },
      { name: 'توثيق', description: 'توثيق جميع العمليات', quantity: '1', price: '500', total: '500' },
      { name: 'دعم فني', description: 'دعم فني مستمر', quantity: '12', price: '200', total: '2,400' },
      { name: 'استبدال كابلات', description: 'استبدال كابلات التآكل', quantity: '1', price: '2,000', total: '2,000' },
      { name: 'صيانة أبواب', description: 'صيانة أبواب المصعد', quantity: '4', price: '300', total: '1,200' },
      { name: 'فحص أمان', description: 'فحص أجهزة الأمان', quantity: '1', price: '800', total: '800' },
      { name: 'تنظيف', description: 'تنظيف شامل للمصعد', quantity: '12', price: '150', total: '1,800' }
    ],
    totals: {
      subtotal: '35,200',
      tax: '1,760',
      total: '36,960'
    },
    terms: [
      'الأسعار شاملة الضريبة المضافة',
      'صالح لمدة 30 يوماً من تاريخ الإصدار',
      'الدفع مقدماً 50% والباقي عند التسليم',
      'الضمان سنة كاملة على جميع الخدمات',
      'الالتزام بالمعايير السعودية',
      'توفير دعم فني مستمر'
    ],
    companyName: 'شركة شموس للمصاعد'
  };
  
  const outputPath = path.join(__dirname, '../../output/quote-large-test.pdf');
  await generator.generateQuote(quoteData, outputPath);
  
  console.log('✓ Large quote generated:', outputPath);
}

async function testReportLarge() {
  console.log('Testing report generation with large content...');
  
  const generator = new ArabicPDFGenerator();
  
  const reportData = {
    company: {
      name: 'شركة شموس للمصاعد',
      address: 'الرياض، المملكة العربية السعودية',
      phone: '+966 11 234 5678',
      email: 'info@shumoos-elevators.com'
    },
    title: 'تقرير الأداء الشهري المفصل',
    subtitle: 'يناير 2024',
    summary: [
      'تم تنفيذ 45 زيارة صيانة خلال الشهر',
      'نسبة رضا العملاء وصلت إلى 95%',
      'انخفضت حالات الطوارئ بنسبة 20%',
      'تم تدريب 3 فنيين جدد',
      'تحديث 5 مصاعد بالبرمجيات الجديدة',
      'استبدال 20 قطعة غيار تالفة',
      'إجراء 15 فحص أمان شامل',
      'تزويد العملاء بتقارير شهرية',
      'تحسين زمن الاستجابة بنسبة 15%',
      'زيادة كفاءة الفنيين بنسبة 10%'
    ],
    statistics: {
      'إجمالي الزيارات': '45',
      'الزيارات المكتملة': '42',
      'الزيارات المؤجلة': '3',
      'حالات الطوارئ': '5',
      'متوسط زمن الاستجابة': '25 دقيقة',
      'نسبة الرضا': '95%',
      'إجمالي الفنيين': '12',
      'الفنيون النشطون': '10',
      'المصاعد المدعومة': '35',
      'القطع المستبدلة': '20'
    },
    tables: [
      {
        title: 'أداء الفنيين المفصل',
        headers: ['الفني', 'عدد الزيارات', 'التقييم', 'الحالة', 'الخبرة'],
        data: [
          ['أحمد محمد', '15', '4.8/5', 'نشط', '5 سنوات'],
          ['خالد علي', '12', '4.5/5', 'نشط', '3 سنوات'],
          ['سعيد عبدالله', '10', '4.7/5', 'نشط', '4 سنوات'],
          ['عمر حسن', '8', '4.6/5', 'نشط', '2 سنة'],
          ['يوسف أحمد', '7', '4.4/5', 'نشط', '3 سنوات'],
          ['محمد علي', '6', '4.3/5', 'نشط', '1 سنة'],
          ['عبدالله سعيد', '5', '4.5/5', 'نشط', '4 سنوات'],
          ['فهد محمد', '4', '4.2/5', 'نشط', '2 سنة'],
          ['تركي خالد', '3', '4.6/5', 'نشط', '5 سنوات'],
          ['سالم أحمد', '2', '4.4/5', 'نشط', '3 سنوات']
        ]
      },
      {
        title: 'حالة المصاعد',
        headers: ['الموقع', 'نوع المصعد', 'آخر صيانة', 'الحالة', 'الأولوية'],
        data: [
          ['برج الأفق', 'ركاب', '2024-01-10', 'جيد', 'عادية'],
          ['مجلس الرياض', 'بضائع', '2024-01-08', 'جيد', 'عادية'],
          ['فندق النخيل', 'ركاب', '2024-01-12', 'ممتاز', 'عالية'],
          ['مجمع الياسمين', 'ركاب', '2024-01-05', 'جيد', 'عادية'],
          ['برج الخليج', 'ركاب', '2024-01-15', 'ممتاز', 'عالية'],
          ['مجمع الهدى', 'بضائع', '2024-01-09', 'جيد', 'عادية'],
          ['فندق الريان', 'ركاب', '2024-01-11', 'ممتاز', 'عالية'],
          ['برج النور', 'ركاب', '2024-01-07', 'جيد', 'عادية'],
          ['مجلس القصيم', 'بضائع', '2024-01-14', 'ممتاز', 'عادية'],
          ['برج الفيصلية', 'ركاب', '2024-01-13', 'جيد', 'عادية']
        ]
      }
    ],
    recommendations: [
      'زيادة عدد الفنيين في منطقة جدة',
      'تحديث نظام الحجز لتقليل التأخير',
      'توفير تدريب إضافي على المصاعد الحديثة',
      'تحسين نظام التواصل مع العملاء',
      'استثمار في قطع غيار إضافية',
      'تطوير تطبيق للعملاء',
      'تحديث البرمجيات القديمة',
      'زيادة عدد فحوصات الأمان'
    ]
  };
  
  const outputPath = path.join(__dirname, '../../output/report-large-test.pdf');
  await generator.generateReport(reportData, outputPath);
  
  console.log('✓ Large report generated:', outputPath);
}

async function main() {
  const fs = require('fs');
  const outputDir = path.join(__dirname, '../../output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    await testContractLarge();
    await testQuoteLarge();
    await testReportLarge();
    
    console.log('\n✅ All enhanced tests passed!');
    console.log('Generated PDFs with smart page breaks to prevent content cutting');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

main();
