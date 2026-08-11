const assert = require('node:assert/strict');
const finance = require('../src/finance/staff-finance.js');

const staff = {
  id: 'STF-100',
  identity: '١٠١٠٣٨٩١٠٢',
  financialId: '1010389102',
  baseSalary: 5000,
};

assert.equal(finance.financialId(staff), '1010389102');
assert.equal(finance.matchesStaff({staffId: '1010389102'}, staff), true);
assert.equal(finance.matchesStaff({staffId: 'STF-100'}, staff), true);
assert.equal(finance.matchesStaff({staffId: '999'}, staff), false);

const payrolls = [
  {
    id: 'PAY-1', companyOwnerId: 'CO-1', period: '2026-08', status: 'مستحق',
    rows: [{staffFinancialId: '1010389102', base: 5000, allowances: 300, deductions: 100, custodyDeduction: 200, gross: 5200, net: 5000}],
  },
  {
    id: 'PAY-0', companyOwnerId: 'CO-1', period: '2026-07', status: 'مسدد',
    rows: [{staffId: 'STF-100', base: 5000, allowances: 0, deductions: 0, gross: 5000, net: 5000}],
  },
  {
    id: 'PAY-X', companyOwnerId: 'CO-1', period: '2026-06', status: 'ملغى',
    rows: [{staffId: 'STF-100', base: 9000, allowances: 0, deductions: 0, gross: 9000, net: 9000}],
  },
];

const profile = finance.calculateProfile({
  staff,
  entries: [
    {staffId: '1010389102', type: 'advance', direction: 'out', amount: 1000},
    {staffId: 'STF-100', type: 'advance', direction: 'in', amount: 250},
    {staffIdentity: '1010389102', type: 'allowance', direction: 'out', amount: 300},
    {staffFinancialId: '1010389102', type: 'deduction', direction: 'out', amount: 100},
    {staffId: '1010389102', type: 'advance', direction: 'out', amount: 999, status: 'ملغى'},
  ],
  custodies: [
    {staffId: 'STF-100', value: 800, remaining: 200},
    {staffId: 'STF-100', value: 900, remaining: 900, status: 'ملغاة'},
  ],
  payrolls,
  purchases: [
    {staffId: '1010389102', amount: 150, status: 'معلّقة'},
    {staffId: '1010389102', amount: 500, status: 'canceled'},
  ],
  vouchers: [
    {staffId: 'STF-100', amount: 75},
    {staffId: 'STF-100', amount: 600, status: 'ملغية'},
  ],
});

assert.equal(profile.baseSalary, 5000);
assert.equal(profile.advancesOutstanding, 750);
assert.equal(profile.allowances, 300);
assert.equal(profile.deductions, 100);
assert.equal(profile.payrollGross, 10200);
assert.equal(profile.payrollNet, 10000);
assert.equal(profile.payrollPaid, 5000);
assert.equal(profile.payrollPayable, 5000);
assert.equal(profile.custodyRemaining, 200);
assert.equal(profile.purchasesPending, 150);
assert.equal(profile.vouchersPaid, 75);
assert.equal(finance.payrollExistsForPeriod(payrolls, 'CO-1', '2026-08'), true);
assert.equal(finance.payrollExistsForPeriod(payrolls, 'CO-2', '2026-08'), false);
assert.equal(finance.hasFinancialHistory({staff, payrolls}), true);
assert.equal(finance.hasFinancialHistory({staff}), false);

console.log('staff-finance tests passed');
