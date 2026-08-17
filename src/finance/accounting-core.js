(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErtiqaaAccountingCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function amount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function customerInvoiceInfo(invoice) {
    const inv = invoice || {};
    const cancelledStatuses = ["ملغي", "ملغى", "ملغاة", "ملغية", "محذوف", "cancelled", "canceled", "deleted"];
    const payments = (Array.isArray(inv.payments) ? inv.payments : [])
      .filter(payment => !cancelledStatuses.includes(String(payment && payment.status || "").trim().toLowerCase()));
    const paid = payments.length
      ? payments.reduce((sum, payment) => sum + Math.max(0, amount(payment.amount)), 0)
      : Math.max(0, amount(inv.paid));
    const total = Math.max(0, amount(inv.total));
    const rawStatus = String(inv.status || "").trim().toLowerCase();
    const cancelled = cancelledStatuses.includes(rawStatus);
    const due = cancelled ? 0 : Math.max(0, total - paid);
    const status = cancelled
      ? "ملغاة"
      : due <= 0 && total > 0
        ? "مدفوعة"
        : paid > 0
          ? "جزئية"
          : "مستحقة";
    return { paid, total, due, status };
  }

  function collectionAllocation(value, receivableOutstanding) {
    const total = Math.max(0, amount(value));
    const receivable = Math.min(total, Math.max(0, amount(receivableOutstanding)));
    return {
      total,
      receivable,
      revenue: Math.max(0, Math.round((total - receivable) * 100) / 100),
    };
  }

  function treasuryState(transactions, bankAccounts) {
    const tx = (transactions || []).map(item => ({ ...item }));
    const banks = (bankAccounts || []).map(bank => ({ ...bank, balance: 0 }));
    let cash = 0;
    tx.sort((a, b) => amount(a.createdAtMs) - amount(b.createdAtMs)).forEach(move => {
      const value = Math.max(0, amount(move.amount));
      const findBank = ref => banks.find(bank => String(bank.id) === String(ref));
      if (["opening", "deposit", "withdraw"].includes(move.type)) {
        const target = move.account === "cash" ? null : findBank(move.account);
        if (move.type === "opening" || move.type === "deposit") {
          if (target) target.balance += value;
          else cash += value;
        } else if (target) target.balance -= value;
        else cash -= value;
      } else if (move.type === "transfer") {
        const from = move.from === "cash" ? null : findBank(move.from);
        const to = move.to === "cash" ? null : findBank(move.to);
        if (from) from.balance -= value;
        else cash -= value;
        if (to) to.balance += value;
        else cash += value;
      }
    });
    const total = cash + banks.reduce((sum, bank) => sum + amount(bank.balance), 0);
    return {
      cash,
      banks,
      total,
      tx: tx.sort((a, b) => amount(b.createdAtMs) - amount(a.createdAtMs)),
    };
  }

  function treasuryBalance(state, accountId) {
    if (accountId === "cash") return amount((state || {}).cash);
    const bank = ((state || {}).banks || []).find(item => String(item.id) === String(accountId));
    return amount(bank && bank.balance);
  }

  function validateTreasuryMove(state, move) {
    const value = amount(move && move.amount);
    if (!(value > 0) || !["opening", "deposit", "withdraw", "transfer"].includes(move && move.type)) {
      return { ok: false, error: "invalid" };
    }
    const accountExists = ref => ref === "cash" || ((state || {}).banks || []).some(bank => String(bank.id) === String(ref));
    if (move.type === "transfer") {
      if (!accountExists(move.from) || !accountExists(move.to) || move.from === move.to) return { ok: false, error: "account" };
      if (treasuryBalance(state, move.from) < value) return { ok: false, error: "insufficient" };
    } else {
      if (!accountExists(move.account)) return { ok: false, error: "account" };
      if (move.type === "withdraw" && treasuryBalance(state, move.account) < value) return { ok: false, error: "insufficient" };
    }
    return { ok: true };
  }

  function payrollBalanced(payroll) {
    const p = payroll || {};
    const gross = amount(p.totalGross) || (p.rows || []).reduce((sum, row) =>
      sum + amount(row.gross || (amount(row.base) + amount(row.allowances) - amount(row.deductions))), 0);
    const custody = Math.max(0, amount(p.totalCustodyDeducted));
    const net = Math.max(0, amount(p.totalNet));
    return gross > 0 && Math.abs(gross - custody - net) <= 0.01;
  }

  function journalBalances(entries, options) {
    const opts = options || {};
    const from = String(opts.from || "").slice(0, 10);
    const to = String(opts.to || "").slice(0, 10);
    const companyOwnerId = String(opts.companyOwnerId || "");
    const map = new Map();
    (entries || []).forEach(entry => {
      if (companyOwnerId && String(entry && entry.companyOwnerId || "") !== companyOwnerId) return;
      const date = String(entry && entry.date || "").slice(0, 10);
      if (from && date && date < from) return;
      if (to && date && date > to) return;
      (entry && entry.lines || []).forEach(line => {
        const account = String(line && line.account || "").trim();
        const side = line && line.side;
        const value = amount(line && line.amount);
        if (!account || !(value > 0) || !["debit", "credit"].includes(side)) return;
        const key = `${account}|${String(line.accountName || "")}`;
        if (!map.has(key)) map.set(key, {
          account,
          accountName: String(line.accountName || ""),
          debit: 0,
          credit: 0,
        });
        const row = map.get(key);
        row[side] += value;
      });
    });
    return [...map.values()].sort((a, b) => a.account.localeCompare(b.account)).map(row => {
      const balance = row.debit - row.credit;
      return { ...row, balance, side: balance >= 0 ? "debit" : "credit" };
    });
  }

  function incomeStatement(balances) {
    const revenue = (balances || []).filter(row => String(row.account).startsWith("4"))
      .map(row => ({ ...row, value: amount(row.credit) - amount(row.debit) }));
    const expenses = (balances || []).filter(row => String(row.account).startsWith("5"))
      .map(row => ({ ...row, value: amount(row.debit) - amount(row.credit) }));
    const totalRevenue = revenue.reduce((sum, row) => sum + row.value, 0);
    const totalExpenses = expenses.reduce((sum, row) => sum + row.value, 0);
    return { revenue, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
  }

  function balanceSheet(balances) {
    const rows = balances || [];
    const assets = rows.filter(row => String(row.account).startsWith("1"))
      .map(row => ({ ...row, value: amount(row.debit) - amount(row.credit) }));
    const liabilities = rows.filter(row => String(row.account).startsWith("2"))
      .map(row => ({ ...row, value: amount(row.credit) - amount(row.debit) }));
    const equity = rows.filter(row => String(row.account).startsWith("3"))
      .map(row => ({ ...row, value: amount(row.credit) - amount(row.debit) }));
    const income = incomeStatement(rows);
    const totalAssets = assets.reduce((sum, row) => sum + row.value, 0);
    const totalLiabilities = liabilities.reduce((sum, row) => sum + row.value, 0);
    const recordedEquity = equity.reduce((sum, row) => sum + row.value, 0);
    const totalEquity = recordedEquity + income.netIncome;
    const difference = totalAssets - totalLiabilities - totalEquity;
    return {
      assets,
      liabilities,
      equity,
      currentEarnings: income.netIncome,
      totalAssets,
      totalLiabilities,
      recordedEquity,
      totalEquity,
      difference,
      balanced: Math.abs(difference) <= 0.01,
    };
  }

  function isCashFinancialEntry(entry) {
    const row = entry || {};
    const status = String(row.status || "").trim().toLowerCase();
    if (!(amount(row.amount) > 0) || !["in", "out"].includes(row.direction)) return false;
    if (["مسودة", "مستحق", "مستحقة", "مستلمة", "ملغي", "ملغى", "ملغاة", "ملغية", "محذوف", "cancelled", "canceled", "deleted"].includes(status)) return false;
    if (["allowance", "deduction"].includes(String(row.type || ""))) return false;
    return true;
  }

  function cashSummary(entries) {
    const movements = (entries || []).filter(isCashFinancialEntry);
    const received = movements.filter(row => row.direction === "in")
      .reduce((sum, row) => sum + amount(row.amount), 0);
    const paid = movements.filter(row => row.direction === "out")
      .reduce((sum, row) => sum + amount(row.amount), 0);
    return { movements, received, paid, net: received - paid };
  }

  return {
    amount,
    customerInvoiceInfo,
    collectionAllocation,
    treasuryState,
    treasuryBalance,
    validateTreasuryMove,
    payrollBalanced,
    journalBalances,
    incomeStatement,
    balanceSheet,
    isCashFinancialEntry,
    cashSummary,
  };
});
