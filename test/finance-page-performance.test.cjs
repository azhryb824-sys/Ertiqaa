const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');

test('finance enhancements are debounced and scoped to dashboard content', () => {
  assert.match(app, /function scheduleFinanceEnhancement/);
  assert.match(app, /financeEnhanceQueued/);
  assert.match(app, /requestAnimationFrame/);
  assert.match(app, /observe\(document\.getElementById\("dashboardContent"\)/);
  assert.doesNotMatch(app, /new MutationObserver\(enhanceFinanceCategoryFilters\)\.observe\(document\.body/);
});

test('each financial list is enhanced only once per render', () => {
  assert.match(app, /section\.dataset\.financialListEnhanced===kind/);
  assert.match(app, /section\.dataset\.financialListEnhanced=kind/);
});

test('period, category and payment-status filters compose without re-showing hidden rows', () => {
  assert.match(app, /inPeriod=target\.dataset\.financialRangeHidden!=="1"/);
  assert.match(app, /ok=inPeriod&&financeCategoryMatches/);
  assert.match(app, /applyFinancialRangeToVisibleSection\(section,kind\);applyFinanceFilters/);
});
