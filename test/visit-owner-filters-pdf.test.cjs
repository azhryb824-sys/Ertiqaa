const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const pdf=fs.readFileSync('pdfmake-gen.js','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');

test('owner and administrator visits page has today and month filters',()=>{
  assert.match(app,/data-visits-view="today"/);
  assert.match(app,/data-visits-view="month"/);
  assert.match(app,/visitsView==="month"\?allV\.filter/);
  assert.match(app,/لا توجد زيارات في الفترة المحددة/);
});

test('each visits filter downloads its matching PDF table',()=>{
  assert.match(app,/visits-daily":"visits-monthly/);
  assert.match(pdf,/function dailyVisitsPdfDefinition/);
  assert.match(pdf,/exactDay \? 10 : 7/);
  assert.match(pdf,/type === 'visits-daily'/);
  assert.match(pdf,/type === 'visits-monthly'/);
  assert.match(dashboard,/pdfmake-gen\.js\?v=[^"']+/);
});
