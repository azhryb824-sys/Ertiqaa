(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErtiqaaStaffFinance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeRef(value) {
    const text = String(value == null ? "" : value)
      .trim()
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    if (!text) return "";
    const digits = text.replace(/\D/g, "");
    return /^[\d\s-]+$/.test(text) && digits ? digits : text.toLowerCase();
  }

  function uniqueRefs(values) {
    return [...new Set(values.map(normalizeRef).filter(Boolean))];
  }

  function staffRefs(staff) {
    const s = staff || {};
    return uniqueRefs([s.financialId, s.identity, s.id]);
  }

  function recordStaffRefs(record) {
    const r = record || {};
    return uniqueRefs([r.staffFinancialId, r.staffId, r.employeeId, r.staffIdentity]);
  }

  function financialId(staff) {
    return staffRefs(staff)[0] || "";
  }

  function matchesStaff(record, staff) {
    const targets = new Set(staffRefs(staff));
    return recordStaffRefs(record).some(ref => targets.has(ref));
  }

  function amount(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function isPaidPayroll(payroll) {
    return ["مسدد", "مدفوع", "paid"].includes(String((payroll || {}).status || "").toLowerCase());
  }

  function isCancelled(record) {
    return ["ملغي", "ملغى", "ملغاة", "ملغية", "محذوف", "cancelled", "canceled", "deleted"]
      .includes(String((record || {}).status || "").trim().toLowerCase());
  }

  function payrollRowForStaff(payroll, staff) {
    return ((payroll || {}).rows || []).find(row => matchesStaff(row, staff)) || null;
  }

  function payrollExistsForPeriod(payrolls, companyOwnerId, period) {
    return (payrolls || []).some(p =>
      String(p.period || "") === String(period || "") &&
      (!companyOwnerId || !p.companyOwnerId || String(p.companyOwnerId) === String(companyOwnerId)) &&
      !isCancelled(p)
    );
  }

  function isActiveStaff(staff) {
    const status = String((staff || {}).employmentStatus || (staff || {}).status || "");
    return !(staff || {}).deletedAt && !["منتهي الخدمة", "محذوف", "غير نشط", "deleted", "inactive"].includes(status.toLowerCase());
  }

  function calculateProfile(input) {
    const data = input || {};
    const staff = data.staff || {};
    const entries = (data.entries || []).filter(x => matchesStaff(x, staff) && !isCancelled(x));
    const custodies = (data.custodies || []).filter(x => matchesStaff(x, staff) && !isCancelled(x));
    const payrolls = (data.payrolls || []).filter(p => payrollRowForStaff(p, staff) && !isCancelled(p));
    const purchases = (data.purchases || []).filter(x => matchesStaff(x, staff) && !isCancelled(x));
    const vouchers = (data.vouchers || []).filter(x => matchesStaff(x, staff) && !isCancelled(x));

    const advancesIssued = entries
      .filter(x => x.type === "advance" && x.direction !== "in")
      .reduce((sum, x) => sum + amount(x.amount), 0);
    const advancesRecovered = entries
      .filter(x => x.type === "advance" && x.direction === "in")
      .reduce((sum, x) => sum + amount(x.amount), 0);
    const allowances = entries
      .filter(x => x.type === "allowance")
      .reduce((sum, x) => sum + amount(x.amount), 0);
    const deductions = entries
      .filter(x => x.type === "deduction")
      .reduce((sum, x) => sum + amount(x.amount), 0);
    const expenses = entries
      .filter(x => x.type === "expense")
      .reduce((sum, x) => sum + amount(x.amount), 0);

    let payrollGross = 0;
    let payrollNet = 0;
    let payrollPaid = 0;
    let payrollPayable = 0;
    payrolls.forEach(payroll => {
      const row = payrollRowForStaff(payroll, staff) || {};
      const gross = amount(row.gross || (amount(row.base) + amount(row.allowances) - amount(row.deductions)));
      const net = amount(row.net);
      payrollGross += gross;
      payrollNet += net;
      if (isPaidPayroll(payroll)) payrollPaid += net;
      else payrollPayable += net;
    });

    const custodyRemaining = custodies.reduce((sum, x) => sum + Math.max(0, amount(x.remaining)), 0);
    const custodyIssued = custodies.reduce((sum, x) => sum + amount(x.value || x.amount), 0);
    const purchasesPending = purchases
      .filter(x => !["مسدد", "مدفوع", "paid"].includes(String(x.status || "").toLowerCase()))
      .reduce((sum, x) => sum + amount(x.amount), 0);
    const vouchersPaid = vouchers.reduce((sum, x) => sum + amount(x.amount), 0);

    return {
      financialId: financialId(staff),
      baseSalary: amount(staff.baseSalary),
      entries,
      payrolls,
      custodies,
      purchases,
      vouchers,
      advancesIssued,
      advancesRecovered,
      advancesOutstanding: Math.max(0, advancesIssued - advancesRecovered),
      allowances,
      deductions,
      expenses,
      payrollGross,
      payrollNet,
      payrollPaid,
      payrollPayable,
      custodyIssued,
      custodyRemaining,
      purchasesPending,
      vouchersPaid
    };
  }

  function hasFinancialHistory(input) {
    const profile = calculateProfile(input);
    return Boolean(
      profile.entries.length || profile.payrolls.length || profile.custodies.length ||
      profile.purchases.length || profile.vouchers.length
    );
  }

  return {
    normalizeRef,
    financialId,
    staffRefs,
    recordStaffRefs,
    matchesStaff,
    amount,
    isPaidPayroll,
    isCancelled,
    payrollRowForStaff,
    payrollExistsForPeriod,
    isActiveStaff,
    calculateProfile,
    hasFinancialHistory
  };
});
