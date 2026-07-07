// Professional Arabic PDF Generator with Smart Page Breaks
// Prevents content cutting between pages with professional multi-page support

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class ArabicPDFGenerator {
  constructor(options = {}) {
    this.options = {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      ...options
    };
  }

  // Generate PDF from HTML
  async generateFromHTML(html, outputPath) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });
      
      await page.pdf({
        path: outputPath,
        format: this.options.format,
        printBackground: this.options.printBackground,
        margin: this.options.margin,
        preferCSSPageSize: true
      });
      
      await browser.close();
      
      return outputPath;
    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
  }

  // Generate contract PDF
  async generateContract(contractData, outputPath) {
    const html = this.getContractHTML(contractData);
    return this.generateFromHTML(html, outputPath);
  }

  // Generate quote PDF
  async generateQuote(quoteData, outputPath) {
    const html = this.getQuoteHTML(quoteData);
    return this.generateFromHTML(html, outputPath);
  }

  // Generate report PDF
  async generateReport(reportData, outputPath) {
    const html = this.getReportHTML(reportData);
    return this.generateFromHTML(html, outputPath);
  }

  // Contract HTML template with smart page breaks
  getContractHTML(data) {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>عقد صيانة - ${data.contractNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&display=swap');
        
        @page {
            size: A4;
            margin: 20mm;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: 'Cairo', 'Amiri', Arial, sans-serif;
            direction: rtl;
            line-height: 1.8;
            color: #333;
            background: #fff;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #1a5490;
            padding-bottom: 20px;
            page-break-after: avoid;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .title {
            text-align: center;
            margin: 30px 0;
            page-break-after: avoid;
        }
        
        .title h1 {
            font-size: 24px;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .section {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border-right: 4px solid #1a5490;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 15px;
            page-break-after: avoid;
        }
        
        .section-content ul {
            list-style: none;
            padding-right: 20px;
        }
        
        .section-content li {
            margin: 12px 0;
            position: relative;
            page-break-inside: avoid;
        }
        
        .section-content li:before {
            content: "•";
            color: #1a5490;
            font-weight: bold;
            position: absolute;
            right: -20px;
        }
        
        .pricing {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .pricing-item {
            display: flex;
            justify-content: space-between;
            margin: 12px 0;
            font-size: 16px;
            page-break-inside: avoid;
        }
        
        .signatures {
            display: flex;
            justify-content: space-around;
            margin: 50px 0;
            padding: 30px;
            page-break-inside: avoid;
        }
        
        .signature-box {
            text-align: center;
            width: 200px;
        }
        
        .signature-line {
            border-bottom: 2px solid #333;
            margin: 40px 0 10px 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            page-break-before: always;
        }
        
        /* Smart page breaks for tables */
        table {
            page-break-inside: auto;
        }
        
        tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        
        thead {
            display: table-header-group;
        }
        
        tfoot {
            display: table-footer-group;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${data.company.name}</div>
        </div>
        
        <div class="title">
            <h1>عقد صيانة</h1>
            <div>رقم العقد: ${data.contractNumber}</div>
        </div>
        
        <div class="section">
            <div class="section-title">بيانات العقد</div>
            <div class="section-content">
                <ul>
                    <li>التاريخ: ${data.date}</li>
                    <li>العميل: ${data.clientName}</li>
                    <li>العنوان: ${data.clientAddress}</li>
                    <li>رقم الهاتف: ${data.clientPhone}</li>
                </ul>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">بيانات المصعد</div>
            <div class="section-content">
                <ul>
                    <li>الموقع: ${data.location}</li>
                    <li>النوع: ${data.elevatorType}</li>
                    <li>السعة: ${data.capacity}</li>
                    <li>العدد: ${data.elevatorCount}</li>
                </ul>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">شروط العقد</div>
            <div class="section-content">
                <ul>
                    ${data.terms.map(term => `<li>${term}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <div class="pricing">
            <div class="pricing-item">
                <span>قيمة العقد:</span>
                <span>${data.pricing.contractValue} ريال</span>
            </div>
            <div class="pricing-item">
                <span>طريقة الدفع:</span>
                <span>${data.pricing.paymentMethod}</span>
            </div>
            <div class="pricing-item">
                <span>مدة العقد:</span>
                <span>${data.pricing.duration}</span>
            </div>
        </div>
        
        <div class="signatures">
            <div class="signature-box">
                <div>توقيع العميل</div>
                <div class="signature-line"></div>
                <div>${data.clientName}</div>
            </div>
            <div class="signature-box">
                <div>توقيع الشركة</div>
                <div class="signature-line"></div>
                <div>${data.companyName}</div>
            </div>
        </div>
        
        <div class="footer">
            ${data.company.name} - جميع الحقوق محفوظة
        </div>
    </div>
</body>
</html>
    `;
  }

  // Quote HTML template with smart page breaks
  getQuoteHTML(data) {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>عرض سعر - ${data.quoteNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&display=swap');
        
        @page {
            size: A4;
            margin: 20mm;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Cairo', 'Amiri', Arial, sans-serif;
            direction: rtl;
            line-height: 1.8;
            color: #333;
            background: #fff;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #1a5490;
            padding-bottom: 20px;
            page-break-after: avoid;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .title {
            text-align: center;
            margin: 30px 0;
            page-break-after: avoid;
        }
        
        .title h1 {
            font-size: 24px;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .section {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border-right: 4px solid #1a5490;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 15px;
            page-break-after: avoid;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: auto;
        }
        
        .table th, .table td {
            padding: 12px;
            text-align: right;
            border: 1px solid #ddd;
        }
        
        .table th {
            background: #1a5490;
            color: white;
            font-weight: 700;
        }
        
        .table tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        
        .table thead {
            display: table-header-group;
        }
        
        .table tbody {
            display: table-row-group;
        }
        
        .table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .totals {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .total-item {
            display: flex;
            justify-content: space-between;
            margin: 12px 0;
            page-break-inside: avoid;
        }
        
        .total-final {
            font-size: 24px;
            font-weight: 700;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid rgba(255,255,255,0.3);
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${data.company.name}</div>
        </div>
        
        <div class="title">
            <h1>عرض سعر</h1>
            <div>رقم العرض: ${data.quoteNumber}</div>
        </div>
        
        <div class="section">
            <div class="section-title">بيانات العرض</div>
            <div>
                التاريخ: ${data.date}<br>
                العميل: ${data.clientName}<br>
                صالح حتى: ${data.validUntil}
            </div>
        </div>
        
        <table class="table">
            <thead>
                <tr>
                    <th>البند</th>
                    <th>الوصف</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>الإجمالي</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>${item.price}</td>
                        <td>${item.total}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <div class="total-item">
                <span>المجموع:</span>
                <span>${data.totals.subtotal} ريال</span>
            </div>
            <div class="total-item">
                <span>الضريبة:</span>
                <span>${data.totals.tax} ريال</span>
            </div>
            <div class="total-final">
                <span>الإجمالي النهائي:</span>
                <span>${data.totals.total} ريال</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">الشروط والأحكام</div>
            <ul>
                ${data.terms.map(term => `<li>${term}</li>`).join('')}
            </ul>
        </div>
        
        <div class="footer">
            ${data.company.name} - جميع الحقوق محفوظة
        </div>
    </div>
</body>
</html>
    `;
  }

  // Report HTML template with smart page breaks
  getReportHTML(data) {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&display=swap');
        
        @page {
            size: A4;
            margin: 20mm;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Cairo', 'Amiri', Arial, sans-serif;
            direction: rtl;
            line-height: 1.8;
            color: #333;
            background: #fff;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #1a5490;
            padding-bottom: 20px;
            page-break-after: avoid;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .title {
            text-align: center;
            margin: 30px 0;
            page-break-after: avoid;
        }
        
        .title h1 {
            font-size: 28px;
            color: #1a5490;
            margin-bottom: 10px;
        }
        
        .section {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border-right: 4px solid #1a5490;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #1a5490;
            margin-bottom: 15px;
            page-break-after: avoid;
        }
        
        .section-content ul {
            list-style: none;
            padding-right: 20px;
        }
        
        .section-content li {
            margin: 12px 0;
            page-break-inside: avoid;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #1a5490;
        }
        
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: auto;
        }
        
        .table th, .table td {
            padding: 12px;
            text-align: right;
            border: 1px solid #ddd;
        }
        
        .table th {
            background: #1a5490;
            color: white;
            font-weight: 700;
        }
        
        .table tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        
        .table thead {
            display: table-header-group;
        }
        
        .table tbody {
            display: table-row-group;
        }
        
        .table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${data.company.name}</div>
        </div>
        
        <div class="title">
            <h1>${data.title}</h1>
            <div>${data.subtitle}</div>
        </div>
        
        <div class="section">
            <div class="section-title">ملخص تنفيذي</div>
            <div class="section-content">
                <ul>
                    ${data.summary.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">الإحصائيات</div>
            <div class="stats-grid">
                ${Object.entries(data.statistics).map(([key, value]) => `
                    <div class="stat-card">
                        <div class="stat-number">${value}</div>
                        <div class="stat-label">${key}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${data.tables.map(table => `
            <div class="section">
                <div class="section-title">${table.title}</div>
                <table class="table">
                    <thead>
                        <tr>
                            ${table.headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${table.data.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
        
        <div class="section">
            <div class="section-title">التوصيات</div>
            <div class="section-content">
                <ul>
                    ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <div class="footer">
            ${data.company.name} - تقرير داخلي
        </div>
    </div>
</body>
</html>
    `;
  }
}

module.exports = ArabicPDFGenerator;
