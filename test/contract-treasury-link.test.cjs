const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');

test('contract payments post against the canonical company owner', () => {
  assert.match(app, /const oid=sameCompany\(c\)\?ownerId\(\)/);
  assert.match(app, /companyOwnerId:ownerId\(\),type:"sale"/);
});

test('legacy contract journals are normalized non-destructively', () => {
  assert.match(app, /function normalizeContractJournalOwners\(\)/);
  assert.match(app, /contract-journal-owner-normalization/);
  assert.match(app, /misadFinanceLinkBackups/);
  assert.match(app, /normalizeContractJournalOwners\(\);const oid=ownerId\(\)/);
});

test('treasury totals derive from the accounting cash and bank balances', () => {
  assert.match(app, /cash=accountBalance\("1100"\)/);
  assert.match(app, /balance:accountBalance\(b\.ledgerAccountId\)/);
});
