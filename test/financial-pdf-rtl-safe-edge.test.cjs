const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pdf = fs.readFileSync('pdfmake-gen.js', 'utf8');

test('RTL financial tables reserve enough room for cell padding and borders', () => {
  assert.match(pdf, /var available=720/);
  assert.match(pdf, /paddingLeft:function\(\)\{return 2\}/);
  assert.match(pdf, /paddingRight:function\(\)\{return 2\}/);
  assert.match(pdf, /pageMargins=\[30,/);
  assert.match(pdf, /alignment:'center'/);
});

test('financial landscape header spans the landscape page safely', () => {
  assert.match(pdf, /function financialLandscapeChrome/);
  assert.match(pdf, /x1:30,y1:0,x2:812/);
  assert.match(pdf, /financialLandscapeChrome\(makeDd\(content,cf,opts\),opts\)/);
});
