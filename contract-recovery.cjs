"use strict";

const fs = require("fs");
const path = require("path");

function parseStoredList(store, key) {
  try {
    const value = store && store[key];
    const parsed = Array.isArray(value) ? value : JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoreFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid storage root");
  }
  return parsed;
}

function clean(value) {
  return String(value || "").trim();
}

function contractOwner(contract) {
  return clean(contract?.companyOwnerId || contract?.createdBy || contract?.linkedBy);
}

function allowedOwnerIds(store, user = {}) {
  if (String(user.role || "") === "admin") return null;
  const ids = new Set([
    clean(user.id || user.userId),
    clean(user.companyOwnerId)
  ].filter(Boolean));
  const companies = parseStoredList(store, "misadOwnerCompanies");
  let changed = true;
  while (changed) {
    changed = false;
    companies.forEach(company => {
      const related = [company.id, company.ownerId, ...(company.ownerIds || [])].map(clean).filter(Boolean);
      if (!related.some(id => ids.has(id))) return;
      related.forEach(id => {
        if (!ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      });
    });
  }
  return ids;
}

function canAccessContract(store, contract, user) {
  const allowed = allowedOwnerIds(store, user);
  if (allowed === null) return true;
  const owner = contractOwner(contract);
  return Boolean(owner && allowed.has(owner));
}

function sourceFiles(sourcePaths, maxSources) {
  const unique = [...new Set((sourcePaths || []).map(file => path.resolve(file)))];
  const configured = Number(maxSources || 96);
  const limit = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 96;
  return unique
    .filter(file => {
      try { return fs.statSync(file).isFile(); } catch { return false; }
    })
    .map(file => ({file, mtimeMs: fs.statSync(file).mtimeMs}))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, limit);
}

function candidateFromRecord({record, kind, sourcePath = "", sourceMtime = 0}) {
  return {
    id: clean(record.id),
    kind,
    record,
    sourcePath,
    sourceName: sourcePath ? path.basename(sourcePath) : "current-storage",
    sourceMtime
  };
}

function discoverRecoverableContracts({store, sourcePaths, user, maxSources = 96}) {
  const current = parseStoredList(store, "misadContracts");
  const currentById = new Map(current.map(contract => [clean(contract.id), contract]).filter(([id]) => id));
  const candidates = new Map();
  const errors = [];

  current.forEach(contract => {
    const id = clean(contract.id);
    if (!id || String(contract.status || "") !== "محذوف" || !canAccessContract(store, contract, user)) return;
    candidates.set(id, candidateFromRecord({record: contract, kind: "hidden"}));
  });

  for (const source of sourceFiles(sourcePaths, maxSources)) {
    let sourceStore;
    try {
      sourceStore = readStoreFile(source.file);
    } catch (error) {
      errors.push({sourceName: path.basename(source.file), error: error.message});
      continue;
    }
    for (const record of parseStoredList(sourceStore, "misadContracts")) {
      const id = clean(record.id);
      if (!id || !canAccessContract(sourceStore, record, user)) continue;
      const existing = currentById.get(id);
      if (!existing) {
        if (!candidates.has(id)) {
          candidates.set(id, candidateFromRecord({
            record,
            kind: "missing",
            sourcePath: source.file,
            sourceMtime: source.mtimeMs
          }));
        }
        continue;
      }
      const hidden = candidates.get(id);
      if (hidden?.kind === "hidden" && String(record.status || "") !== "محذوف" && !hidden.sourcePath) {
        candidates.set(id, candidateFromRecord({
          record,
          kind: "hidden",
          sourcePath: source.file,
          sourceMtime: source.mtimeMs
        }));
      }
    }
  }

  return {
    candidates: [...candidates.values()].sort((left, right) => {
      const leftTime = Number(left.record.createdAtMs || left.sourceMtime || 0);
      const rightTime = Number(right.record.createdAtMs || right.sourceMtime || 0);
      return rightTime - leftTime;
    }),
    errors
  };
}

function recoverySummary(candidate) {
  const contract = candidate.record || {};
  return {
    id: candidate.id,
    kind: candidate.kind,
    type: clean(contract.type),
    status: clean(contract.status),
    clientName: clean(contract.clientCompanyName || contract.clientName),
    startDate: clean(contract.startDate),
    endDate: clean(contract.endDate),
    value: Number(contract.value || 0),
    createdAt: clean(contract.createdAt),
    createdAtMs: Number(contract.createdAtMs || 0),
    sourceName: candidate.sourceName,
    sourceMtime: Number(candidate.sourceMtime || 0)
  };
}

function recoverContract({store, sourcePaths, user, contractId, recoveredBy, maxSources = 96, now = new Date()}) {
  const id = clean(contractId);
  if (!id) return {ok: false, error: "Missing contract id"};
  const discovery = discoverRecoverableContracts({store, sourcePaths, user, maxSources});
  const candidate = discovery.candidates.find(item => item.id === id);
  if (!candidate) return {ok: false, error: "Contract is not recoverable from the available backups"};

  const contracts = parseStoredList(store, "misadContracts");
  const recoveredAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  let restored;

  if (candidate.kind === "hidden") {
    restored = contracts.find(contract => clean(contract.id) === id);
    if (!restored || !canAccessContract(store, restored, user)) {
      return {ok: false, error: "Contract access denied"};
    }
    const backupStatus = clean(candidate.record.status);
    restored.status = backupStatus && backupStatus !== "محذوف" ? backupStatus : "مسودة";
    delete restored.deletedAt;
    delete restored.deletedBy;
    restored.recoveredAt = recoveredAt;
    restored.recoveredBy = clean(recoveredBy || user.id || user.userId);
    restored.recoverySource = candidate.sourceName;
  } else {
    if (contracts.some(contract => clean(contract.id) === id)) {
      return {ok: false, error: "A contract with the same id already exists"};
    }
    restored = JSON.parse(JSON.stringify(candidate.record));
    restored.recoveredAt = recoveredAt;
    restored.recoveredBy = clean(recoveredBy || user.id || user.userId);
    restored.recoverySource = candidate.sourceName;
    contracts.unshift(restored);
  }

  store.misadContracts = JSON.stringify(contracts);
  return {
    ok: true,
    kind: candidate.kind,
    contract: restored,
    sourceName: candidate.sourceName,
    totalContracts: contracts.length
  };
}

module.exports = {
  allowedOwnerIds,
  canAccessContract,
  discoverRecoverableContracts,
  parseStoredList,
  readStoreFile,
  recoverContract,
  recoverySummary,
  sourceFiles
};
