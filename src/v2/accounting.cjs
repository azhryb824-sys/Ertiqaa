"use strict";

const crypto = require("crypto");
const TOLERANCE = 0.01;
const number = value => Number(value || 0);
const dateOnly = value => String(value || "").slice(0, 10);
const id = prefix => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const clone = value => JSON.parse(JSON.stringify(value));

function periodClosed(date, periods = [], companyOwnerId = "") {
  const target = dateOnly(date);
  return periods.some(period => String(period.companyOwnerId || "") === String(companyOwnerId || "") && period.status === "closed" && (!period.from || target >= dateOnly(period.from)) && (!period.to || target <= dateOnly(period.to)));
}
function totals(lines = []) {
  return lines.reduce((result, line) => {
    const amount = number(line.amount);
    if (line.side === "debit") result.debit += amount;
    if (line.side === "credit") result.credit += amount;
    return result;
  }, {debit: 0, credit: 0});
}
function validateJournal(candidate, periods = []) {
  const lines = Array.isArray(candidate.lines) ? candidate.lines : [];
  if (!candidate.companyOwnerId) return {ok: false, error: "Company is required"};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly(candidate.date))) return {ok: false, error: "Valid journal date is required"};
  if (periodClosed(candidate.date, periods, candidate.companyOwnerId)) return {ok: false, error: "Accounting period is closed"};
  if (lines.length < 2) return {ok: false, error: "At least two journal lines are required"};
  if (lines.some(line => !line.account || !["debit", "credit"].includes(line.side) || !(number(line.amount) > 0))) return {ok: false, error: "Invalid journal line"};
  const value = totals(lines);
  if (!(value.debit > 0) || Math.abs(value.debit - value.credit) > TOLERANCE) return {ok: false, error: "Journal is not balanced", ...value};
  return {ok: true, ...value};
}
function postJournal(state, candidate, actor, periods = []) {
  const validation = validateJournal(candidate, periods);
  if (!validation.ok) return validation;
  const journals = Array.isArray(state.journals) ? state.journals : [];
  if (candidate.id && journals.some(entry => String(entry.id) === String(candidate.id))) return {ok: false, error: "Duplicate journal id"};
  if (candidate.refType && candidate.refId && journals.some(entry => !entry.voidedAt && entry.refType === candidate.refType && String(entry.refId) === String(candidate.refId))) return {ok: false, error: "Source already posted"};
  const entry = clone({...candidate, id: candidate.id || id("V2-JRN"), date: dateOnly(candidate.date), debitTotal: validation.debit, creditTotal: validation.credit, createdAt: new Date().toISOString(), createdBy: actor});
  entry.lines = entry.lines.map(line => ({...line, amount: number(line.amount)}));
  journals.unshift(entry); state.journals = journals;
  return {ok: true, entry};
}
function nextOpenDate(start, periods, companyOwnerId) {
  const cursor = new Date(`${dateOnly(start)}T12:00:00Z`);
  for (let count = 0; count < 370; count += 1) {
    const value = cursor.toISOString().slice(0, 10);
    if (!periodClosed(value, periods, companyOwnerId)) return value;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return "";
}
function reverseJournal(state, journalId, actor, reason, periods = [], requestedDate = new Date().toISOString().slice(0, 10)) {
  const journals = Array.isArray(state.journals) ? state.journals : [];
  const original = journals.find(entry => String(entry.id) === String(journalId));
  if (!original) return {ok: false, error: "Journal not found"};
  if (original.voidedAt) return {ok: false, error: "Journal already reversed"};
  if (journals.some(entry => entry.reversalOf === original.id)) return {ok: false, error: "Reversal already exists"};
  const reversalDate = nextOpenDate(requestedDate, periods, original.companyOwnerId);
  if (!reversalDate) return {ok: false, error: "No open accounting date available"};
  const posted = postJournal(state, {
    companyOwnerId: original.companyOwnerId, date: reversalDate, description: `عكس ${original.description || original.id}`,
    refType: "reversal", refId: original.id, reversalOf: original.id, reason,
    lines: original.lines.map(line => ({...line, side: line.side === "debit" ? "credit" : "debit"}))
  }, actor, periods);
  if (!posted.ok) return posted;
  original.voidedAt = new Date().toISOString(); original.voidedBy = actor; original.voidReason = reason; original.reversalJournalId = posted.entry.id;
  return {ok: true, original, reversal: posted.entry};
}
function replacePostedSource(state, journalId, replacement, actor, reason, periods = []) {
  const snapshot = clone(state);
  const reversed = reverseJournal(state, journalId, actor, reason, periods, replacement.date);
  if (!reversed.ok) return reversed;
  const posted = postJournal(state, {...replacement, correctionOf: journalId}, actor, periods);
  if (!posted.ok) { Object.keys(state).forEach(key => delete state[key]); Object.assign(state, snapshot); return posted; }
  return {ok: true, reversal: reversed.reversal, replacement: posted.entry};
}

module.exports = {TOLERANCE, totals, periodClosed, validateJournal, postJournal, reverseJournal, replacePostedSource, nextOpenDate};
