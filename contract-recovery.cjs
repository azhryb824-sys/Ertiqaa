"use strict";

const crypto = require("crypto");
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

function normalizedText(value) {
  return clean(value)
    .toLocaleLowerCase("ar")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function normalizedIdentifier(value) {
  return normalizedText(value).replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizedContractType(value) {
  const type = normalizedText(value);
  if (/صيان|maintenance/.test(type)) return "maintenance";
  if (/تركيب|توريد|installation|install/.test(type)) return "installation";
  return type || "unknown";
}

function canonicalContractType(value) {
  const type = normalizedContractType(value);
  if (type === "maintenance") return "صيانة";
  if (type === "installation") return "تركيب";
  return "";
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

function canAccessReference(store, record, user) {
  const allowed = allowedOwnerIds(store, user);
  if (allowed === null) return true;
  const owner = contractOwner(record);
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
    .map(file => {
      const name = path.basename(file);
      const priority = /^prewrite-.+\.json$/i.test(name) ? 5
        : /^storage-.+\.json$/i.test(name) ? 4
          : /^pre-migration-.+\.json$/i.test(name) ? 3
            : /failover/i.test(name) ? 2
              : 1;
      return {file, mtimeMs: fs.statSync(file).mtimeMs, priority};
    })
    .sort((left, right) => right.priority - left.priority || right.mtimeMs - left.mtimeMs)
    .slice(0, limit);
}

function recordSourceMtime(record, source) {
  const archived = Number(record?.recoveryArchiveSourceAtMs || 0);
  return Number.isFinite(archived) && archived > 0 ? archived : source.mtimeMs;
}

function partyIdentity(record) {
  const companyNumber = normalizedIdentifier(record?.clientCompanyUnifiedNumber);
  if (companyNumber) return `company:${companyNumber}`;
  const clientId = normalizedIdentifier(record?.clientId);
  if (clientId) return `client:${clientId}`;
  const name = normalizedText(record?.clientCompanyName || record?.clientName);
  if (name) return `name:${name}`;
  return "";
}

function contractVariantKey(record) {
  const party = partyIdentity(record);
  const type = normalizedContractType(record?.type);
  if (party) return `${party}|${type}`;
  const buildings = (Array.isArray(record?.buildings) ? record.buildings : [])
    .map(building => normalizedText(building?.name))
    .filter(Boolean)
    .sort()
    .join("|");
  return [
    "anonymous",
    type,
    clean(record?.createdAtMs || record?.createdAt),
    clean(record?.startDate),
    clean(record?.value),
    buildings
  ].join("|");
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 20);
}

function isDeletedContract(contract) {
  const status = normalizedText(contract?.status);
  return status === "محذوف" || status === "deleted";
}

function candidateKey(kind, id, record) {
  return `${kind}:${clean(id)}:${shortHash(contractVariantKey(record))}`;
}

function candidateFromRecord({record, kind, sourcePath = "", sourceMtime = 0, currentRecord = null, evidenceCount = 0}) {
  const id = clean(record.id);
  return {
    id,
    kind,
    candidateKey: candidateKey(kind, id, record),
    record,
    currentRecord,
    evidenceCount: Number(evidenceCount || 0),
    sourcePath,
    sourceName: sourcePath ? path.basename(sourcePath) : "current-storage",
    sourceMtime
  };
}

function referenceDiagnostics(store, currentById, user) {
  const references = new Map();
  const currentIds = new Set(currentById.keys());
  const referenceFields = ["contractId", "sourceContractId", "parentInstallId"];

  Object.keys(store || {}).forEach(storeKey => {
    if (storeKey === "misadContracts") return;
    const records = parseStoredList(store, storeKey);
    records.forEach(record => {
      if (!record || typeof record !== "object" || !canAccessReference(store, record, user)) return;
      const found = new Set();
      referenceFields.forEach(field => {
        const id = clean(record[field]);
        if (/^CONT/i.test(id)) found.add(id);
      });
      const activityRef = clean(record.ref);
      if (/^CONT/i.test(activityRef)) found.add(activityRef);
      found.forEach(id => {
        if (!references.has(id)) references.set(id, {total: 0, stores: new Map(), parties: new Map()});
        const entry = references.get(id);
        entry.total += 1;
        entry.stores.set(storeKey, (entry.stores.get(storeKey) || 0) + 1);
        const party = partyIdentity(record);
        if (party) entry.parties.set(party, (entry.parties.get(party) || 0) + 1);
      });
    });
  });

  const orphanReferences = [];
  const referenceConflicts = [];
  references.forEach((entry, contractId) => {
    const stores = [...entry.stores.entries()]
      .map(([storeKey, count]) => ({storeKey, count}))
      .sort((left, right) => right.count - left.count);
    if (!currentIds.has(contractId)) {
      orphanReferences.push({contractId, total: entry.total, stores});
      return;
    }
    const accessibleCurrent = (currentById.get(contractId) || [])
      .filter(contract => canAccessContract(store, contract, user));
    const currentParties = new Set(accessibleCurrent.map(partyIdentity).filter(Boolean));
    const mismatched = [...entry.parties.entries()]
      .filter(([party]) => !currentParties.has(party))
      .reduce((sum, [, count]) => sum + count, 0);
    if (!accessibleCurrent.length || mismatched) {
      referenceConflicts.push({contractId, total: entry.total, mismatched});
    }
  });

  return {
    references,
    orphanReferences: orphanReferences.sort((left, right) => right.total - left.total),
    referenceConflicts: referenceConflicts.sort((left, right) => right.mismatched - left.mismatched)
  };
}

function currentContractDiagnostics(store, current, currentById, user) {
  const accessible = current.filter(contract => canAccessContract(store, contract, user));
  const visible = accessible.filter(contract => !isDeletedContract(contract));
  const duplicateIds = [...currentById.entries()]
    .filter(([, records]) => records.filter(record => canAccessContract(store, record, user)).length > 1)
    .map(([id]) => id)
    .sort();
  return {
    total: accessible.length,
    visible: visible.length,
    maintenance: visible.filter(contract => normalizedContractType(contract.type) === "maintenance").length,
    installation: visible.filter(contract => normalizedContractType(contract.type) === "installation").length,
    unclassified: visible.filter(contract => !["maintenance", "installation"].includes(normalizedContractType(contract.type))).length,
    hidden: accessible.length - visible.length,
    duplicateIds
  };
}

function candidateEvidenceCount(referenceInfo, record) {
  if (!referenceInfo) return 0;
  const party = partyIdentity(record);
  if (!party) return referenceInfo.total || 0;
  return referenceInfo.parties.get(party) || 0;
}

function discoverRecoverableContracts({store, sourcePaths, user, maxSources = 96}) {
  const current = parseStoredList(store, "misadContracts");
  const currentById = new Map();
  current.forEach(contract => {
    const id = clean(contract.id);
    if (!id) return;
    if (!currentById.has(id)) currentById.set(id, []);
    currentById.get(id).push(contract);
  });
  const referenceInfo = referenceDiagnostics(store, currentById, user);
  const candidates = new Map();
  const errors = [];

  current.forEach(contract => {
    const id = clean(contract.id);
    if (!id || !canAccessContract(store, contract, user)) return;
    if (isDeletedContract(contract)) {
      const candidate = candidateFromRecord({record: contract, kind: "hidden"});
      candidates.set(candidate.candidateKey, candidate);
      return;
    }
    const canonicalType = canonicalContractType(contract.type);
    if (canonicalType && clean(contract.type) !== canonicalType) {
      const candidate = candidateFromRecord({record: contract, kind: "misclassified", currentRecord: contract});
      candidates.set(candidate.candidateKey, candidate);
    }
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
      if (!id || isDeletedContract(record) || !canAccessContract(sourceStore, record, user)) continue;
      const existingRecords = currentById.get(id) || [];
      const accessibleExisting = existingRecords.filter(contract => canAccessContract(store, contract, user));
      const sameAccessibleVariant = accessibleExisting.find(contract => contractVariantKey(contract) === contractVariantKey(record));
      const reference = referenceInfo.references.get(id);

      if (!existingRecords.length) {
        const candidate = candidateFromRecord({
          record,
          kind: "missing",
          sourcePath: source.file,
          sourceMtime: recordSourceMtime(record, source),
          evidenceCount: candidateEvidenceCount(reference, record)
        });
        if (!candidates.has(candidate.candidateKey)) candidates.set(candidate.candidateKey, candidate);
        continue;
      }

      if (sameAccessibleVariant) {
        const hiddenKey = candidateKey("hidden", id, sameAccessibleVariant);
        const hidden = candidates.get(hiddenKey);
        if (hidden && !hidden.sourcePath) {
          const candidate = candidateFromRecord({
            record,
            kind: "hidden",
            sourcePath: source.file,
            sourceMtime: recordSourceMtime(record, source),
            currentRecord: sameAccessibleVariant,
            evidenceCount: candidateEvidenceCount(reference, record)
          });
          candidates.set(candidate.candidateKey, candidate);
        }
        continue;
      }

      const representative = accessibleExisting[0] || existingRecords[0];
      let kind = "conflict";
      if (!accessibleExisting.length) {
        kind = "ownership-conflict";
      } else if (
        partyIdentity(representative) &&
        partyIdentity(representative) === partyIdentity(record) &&
        normalizedContractType(representative.type) !== normalizedContractType(record.type)
      ) {
        kind = "type-conflict";
      }
      const candidate = candidateFromRecord({
        record,
        kind,
        sourcePath: source.file,
        sourceMtime: recordSourceMtime(record, source),
        currentRecord: accessibleExisting[0] || null,
        evidenceCount: candidateEvidenceCount(reference, record)
      });
      if (!candidates.has(candidate.candidateKey)) candidates.set(candidate.candidateKey, candidate);
    }
  }

  return {
    candidates: [...candidates.values()].sort((left, right) => {
      const evidence = Number(right.evidenceCount || 0) - Number(left.evidenceCount || 0);
      if (evidence) return evidence;
      const leftTime = Number(left.record.createdAtMs || left.sourceMtime || 0);
      const rightTime = Number(right.record.createdAtMs || right.sourceMtime || 0);
      return rightTime - leftTime;
    }),
    errors,
    diagnostics: {
      current: currentContractDiagnostics(store, current, currentById, user),
      orphanReferences: referenceInfo.orphanReferences,
      referenceConflicts: referenceInfo.referenceConflicts
    }
  };
}

function recoveryReason(kind) {
  return ({
    hidden: "مخفي داخل القاعدة الحالية",
    missing: "مفقود من قائمة العقود الحالية",
    conflict: "رقمه مستخدم حالياً لعقد مختلف",
    "ownership-conflict": "رقمه مستخدم في سجل غير تابع لمنشأتك حالياً",
    "type-conflict": "نوع العقد الحالي يختلف عن النسخة المحفوظة",
    misclassified: "نوع العقد مكتوب بصيغة لا تعرضها تبويبات العقود"
  })[kind] || "نسخة قابلة للاستعادة";
}

function recoverySummary(candidate) {
  const contract = candidate.record || {};
  return {
    id: candidate.id,
    candidateKey: candidate.candidateKey || candidateKey(candidate.kind, candidate.id, contract),
    kind: candidate.kind,
    reason: recoveryReason(candidate.kind),
    type: clean(contract.type),
    status: clean(contract.status),
    clientName: clean(contract.clientCompanyName || contract.clientName),
    startDate: clean(contract.startDate),
    endDate: clean(contract.endDate),
    value: Number(contract.value || 0),
    createdAt: clean(contract.createdAt),
    createdAtMs: Number(contract.createdAtMs || 0),
    evidenceCount: Number(candidate.evidenceCount || 0),
    sourceName: candidate.sourceName,
    sourceMtime: Number(candidate.sourceMtime || 0)
  };
}

function nextAvailableContractId(contracts) {
  const used = new Set(contracts.map(contract => clean(contract.id)).filter(Boolean));
  const maximum = contracts.reduce((max, contract) => {
    const match = clean(contract.id).match(/^CONT(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let number = maximum + 1;
  let id = `CONT${String(number).padStart(4, "0")}`;
  while (used.has(id)) {
    number += 1;
    id = `CONT${String(number).padStart(4, "0")}`;
  }
  return id;
}

function recoverContract({store, sourcePaths, user, contractId, selectedCandidateKey = "", recoveredBy, maxSources = 96, now = new Date()}) {
  const id = clean(contractId);
  const selection = clean(selectedCandidateKey);
  if (!id) return {ok: false, error: "Missing contract id"};
  const discovery = discoverRecoverableContracts({store, sourcePaths, user, maxSources});
  const matching = discovery.candidates.filter(item => item.id === id);
  const candidate = selection
    ? matching.find(item => item.candidateKey === selection)
    : matching.length === 1 ? matching[0] : null;
  if (!candidate) {
    return {
      ok: false,
      error: matching.length > 1
        ? "Select the exact saved version before recovery"
        : "Contract is not recoverable from the available backups"
    };
  }

  const contracts = parseStoredList(store, "misadContracts");
  const recoveredAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const recoveryUser = clean(recoveredBy || user.id || user.userId);
  let restored;
  let originalId = id;

  if (candidate.kind === "hidden") {
    restored = contracts.find(contract =>
      clean(contract.id) === id &&
      isDeletedContract(contract) &&
      canAccessContract(store, contract, user) &&
      contractVariantKey(contract) === contractVariantKey(candidate.record)
    );
    if (!restored) return {ok: false, error: "Contract access denied"};
    const backupStatus = clean(candidate.record.status);
    restored.status = backupStatus && !isDeletedContract(candidate.record) ? backupStatus : "مسودة";
    delete restored.deletedAt;
    delete restored.deletedBy;
  } else if (candidate.kind === "misclassified") {
    restored = contracts.find(contract => clean(contract.id) === id && canAccessContract(store, contract, user));
    const correctedType = canonicalContractType(restored?.type);
    if (!restored || !correctedType) return {ok: false, error: "Contract type cannot be repaired safely"};
    restored.type = correctedType;
  } else if (["conflict", "ownership-conflict", "type-conflict"].includes(candidate.kind)) {
    restored = JSON.parse(JSON.stringify(candidate.record));
    const recoveredId = nextAvailableContractId(contracts);
    restored.id = recoveredId;
    restored.recoveredOriginalId = id;
    restored.recoveredFromConflict = true;
    contracts.unshift(restored);
  } else {
    if (contracts.some(contract => clean(contract.id) === id)) {
      return {ok: false, error: "A contract with the same id already exists"};
    }
    restored = JSON.parse(JSON.stringify(candidate.record));
    contracts.unshift(restored);
  }

  restored.recoveredAt = recoveredAt;
  restored.recoveredBy = recoveryUser;
  restored.recoverySource = candidate.sourceName;
  restored.recoveryKind = candidate.kind;
  store.misadContracts = JSON.stringify(contracts);
  return {
    ok: true,
    kind: candidate.kind,
    contract: restored,
    originalId,
    sourceName: candidate.sourceName,
    totalContracts: contracts.length
  };
}

module.exports = {
  allowedOwnerIds,
  canAccessContract,
  canonicalContractType,
  contractVariantKey,
  discoverRecoverableContracts,
  parseStoredList,
  readStoreFile,
  recoverContract,
  recoverySummary,
  sourceFiles
};
