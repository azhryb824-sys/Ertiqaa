const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');

assert.match(app, /reports-center","التقارير/);
assert.match(app, /data-report-this-month/);
assert.match(app, /activeContractsForReport/);
assert.match(app, /data-pdf-doc="staff-summary"/);
assert.match(app, /generatePdf\("reports-bundle"/);
assert.match(pdf, /reportsBundlePdfDefinition/);
assert.match(pdf, /staffSummaryPdfDefinition/);
assert.match(pdf, /'contracts-table': true/);
assert.match(pdf, /'visits-monthly': true/);
assert.match(pdf, /'reports-bundle': true/);
assert.match(pdf, /'report': true/);
assert.match(pdf, /ensureFinancialCompanyApproval/);

console.log('Report center and approved PDF tests passed.');
