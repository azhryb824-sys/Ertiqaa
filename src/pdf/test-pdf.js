// Test Arabic PDF Generator
const ArabicPDFGenerator = require('./html-pdf-generator');
const path = require('path');

async function testContract() {
  console.log('Testing contract generation...');
  
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
      'الالتزام بالمعايير السلامة السعودية'
    ],
    pricing: {
      contractValue: '25,000',
      paymentMethod: 'دفعة واحدة',
      duration: 'سنة واحدة'
    },
    companyName: 'شركة شموس للمصاعد'
  };
  
  const outputPath = path.join(__dirname, '../../output/contract-test.pdf');
  await generator.generateContract(contractData, outputPath);
  
  console.log('✓ Contract generated:', outputPath);
}

async function testQuote() {
  console.log('Testing quote generation...');
  
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
      {
        name: 'صيانة دورية',
        description: 'صيانة شهرية شاملة لمصعد ركاب',
        quantity: '12',
        price: '1,500',
        total: '18,000'
      },
      {
        name: 'قطع غيار',
        description: 'توفير قطع غيار أساسية',
        quantity: '1',
        price: '3,000',
        total: '3,000'
      }
    ],
    totals: {
      subtotal: '23,000',
      tax: '1,150',
      total: '24,150'
    },
    companyName: 'شركة شموس للمصاعد'
  };
  
  const outputPath = path.join(__dirname, '../../output/quote-test.pdf');
  await generator.generateQuote(quoteData, outputPath);
  
  console.log('✓ Quote generated:', outputPath);
}

async function testReport() {
  console.log('Testing report generation...');
  
  const generator = new ArabicPDFGenerator();
  
  const reportData = {
    company: {
      name: 'شركة شموس للمصاعد',
      address: 'الرياض، المملكة العربية السعودية',
      phone: '+966 11 234 5678',
      email: 'info@shumoos-elevators.com'
    },
    title: 'تقرير الأداء الشهري',
    subtitle: 'يناير 2024',
    summary: [
      'تم تنفيذ 45 زيارة صيانة خلال الشهر',
      'نسبة رضا العملاء وصلت إلى 95%',
      'انخفضت حالات الطوارئ بنسبة 20%'
    ],
    statistics: {
      'إجمالي الزيارات': '45',
      'الزيارات المكتملة': '42',
      'حالات الطوارئ': '5',
      'نسبة الرضا': '95%'
    },
    tables: [
      {
        title: 'أداء الفنيين',
        headers: ['الفني', 'عدد الزيارات', 'التقييم'],
        data: [
          ['أحمد محمد', '15', '4.8/5'],
          ['خالد علي', '12', '4.5/5']
        ]
      }
    ],
    recommendations: [
      'زيادة عدد الفنيين في منطقة جدة',
      'تحديث نظام الحجز'
    ]
  };
  
  const outputPath = path.join(__dirname, '../../output/report-test.pdf');
  await generator.generateReport(reportData, outputPath);
  
  console.log('✓ Report generated:', outputPath);
}

async function main() {
  const fs = require('fs');
  const outputDir = path.join(__dirname, '../../output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    await testContract();
    await testQuote();
    await testReport();
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

main();
