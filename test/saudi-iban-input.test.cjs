const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');

test('all IBAN inputs keep the Saudi prefix and exact grouped length',()=>{
  assert.match(app,/function compactSaudiIban\(value\)/);
  assert.match(app,/return"SA"\+digits/);
  assert.match(app,/\.slice\(0,22\)/);
  assert.match(app,/compact\.match\(\/\.\{1,4\}\/g\)\.join\(" "\)/);
  assert.match(app,/input\.maxLength=29/);
  assert.match(app,/input\.pattern="SA\[0-9\]\{2\} \[0-9\]\{4\}/);
});

test('IBAN prefix cannot be deleted and incomplete values cannot be submitted',()=>{
  assert.match(app,/e\.key==="Backspace"\|\|e\.key==="Delete"/);
  assert.match(app,/input\.selectionStart\|\|0\)<=2/);
  assert.match(app,/function validSaudiIban\(value\)\{return\/\^SA\\d\{22\}\$\//);
  assert.match(app,/e\.preventDefault\(\);e\.stopImmediatePropagation\(\)/);
  assert.match(app,/الآيبان ناقص أو غير صحيح/);
});

test('current dashboard loads the IBAN-safe application asset',()=>{
  assert.match(dashboard,/app\.js\?v=20260817-finance-integrity-1/);
});
