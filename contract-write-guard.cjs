"use strict";

function parseContracts(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const equal = (left, right) => String(left || "") === String(right || "");

function validateContractWrite(currentValue, incomingValue, authenticatedUserId) {
  const current = parseContracts(currentValue);
  const incoming = parseContracts(incomingValue);
  if (current.length && !incoming.length) return {ok: false, error: "Contract write refused: invalid or empty contract list"};

  const incomingById = new Map(incoming.filter(c => c?.id).map(c => [String(c.id), c]));
  for (const oldContract of current) {
    if (!oldContract?.id) continue;
    const nextContract = incomingById.get(String(oldContract.id));
    if (!nextContract) return {ok: false, error: `Contract write refused: existing contract ${oldContract.id} is missing`};
    const startChanged = !equal(oldContract.startDate, nextContract.startDate);
    const endChanged = !equal(oldContract.endDate, nextContract.endDate);
    if (oldContract.status !== "منتهيا" && nextContract.status === "منتهيا") {
      const endDate = String(nextContract.endDate || "").slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      if (startChanged || endChanged || !endDate || endDate >= today) {
        return {ok: false, error: `Contract write refused: invalid expiry for ${oldContract.id}`};
      }
    }
    if (!startChanged && !endChanged) continue;
    const explicitEdit = Boolean(nextContract.updatedAt && !equal(oldContract.updatedAt, nextContract.updatedAt) && equal(nextContract.updatedBy, authenticatedUserId));
    const explicitRenewal = Boolean(!startChanged && nextContract.renewedAt && !equal(oldContract.renewedAt, nextContract.renewedAt));
    if (!explicitEdit && !explicitRenewal) {
      return {ok: false, error: `Contract write refused: dates changed without an explicit edit for ${oldContract.id}`};
    }
  }
  return {ok: true};
}

module.exports = {parseContracts, validateContractWrite};
