"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CURRENT_SCHEMA_VERSION = "2026.08.11-finance-staff-v1";

const FINANCE_ARRAY_KEYS = Object.freeze([
  "misadFinancialEntries",
  "misadReceipts",
  "misadClaims",
  "misadInvoices",
  "misadCustodies",
  "misadPayrolls",
  "misadCustomerInvoices",
  "misadTreasury",
  "misadBankAccounts",
  "misadPurchaseInvoices",
  "misadContractExpenses",
  "misadContractPayments",
  "misadStaffPurchaseInvoices",
  "misadStaffVouchers",
  "misadChartOfAccounts",
  "misadJournalEntries",
  "misadFinanceAuditLog",
  "misadContractPdfDownloads",
  "misadQuotePdfDownloads",
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseJsonArray(store, key, options = {}) {
  if (!hasOwn(store, key)) return options.missingValue === undefined ? null : options.missingValue;
  const raw = store[key];
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error(`Storage key ${key} contains invalid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`Storage key ${key} must contain an array`);
  return parsed;
}

function serializeArrayLike(original, records) {
  return typeof original === "string" || original === undefined ? JSON.stringify(records) : records;
}

function normalizeRef(value) {
  const text = String(value == null ? "" : value)
    .trim()
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  return /^[\d\s-]+$/.test(text) && digits ? digits : text.toLowerCase();
}

function employeeTypeForRole(role) {
  return /technician|engineer|فني|مهندس/i.test(String(role || "")) ? "technician" : "administrative";
}

function isInactiveStaff(staff) {
  const status = String(staff.employmentStatus || staff.status || "").trim().toLowerCase();
  return Boolean(staff.deletedAt) || [
    "منتهي الخدمة", "غير نشط", "محذوف", "inactive", "deleted", "terminated",
  ].includes(status);
}

function enrichStaffRecord(record) {
  const current = record && typeof record === "object" ? record : {};
  const next = {...current};
  const financialId = normalizeRef(current.financialId || current.identity || current.id);
  const salary = Number(current.baseSalary);
  const salaryConfigured = typeof current.salaryConfigured === "boolean"
    ? current.salaryConfigured
    : Number.isFinite(salary) && salary > 0;

  if (!hasOwn(next, "financialId") && financialId) next.financialId = financialId;
  if (!hasOwn(next, "financialProfileId") && financialId) next.financialProfileId = `SFIN-${financialId}`;
  if (!hasOwn(next, "employeeType")) next.employeeType = employeeTypeForRole(current.role);
  if (!hasOwn(next, "jobTitle")) next.jobTitle = "";
  if (!hasOwn(next, "department")) next.department = "";
  if (!hasOwn(next, "employmentType")) next.employmentType = "";
  if (!hasOwn(next, "employmentStatus")) next.employmentStatus = isInactiveStaff(current) ? "منتهي الخدمة" : "على رأس العمل";
  if (!hasOwn(next, "hireDate")) next.hireDate = "";
  if (!hasOwn(next, "baseSalary")) next.baseSalary = 0;
  if (!hasOwn(next, "salaryConfigured")) next.salaryConfigured = salaryConfigured;
  if (!hasOwn(next, "financialProfileStatus")) {
    next.financialProfileStatus = salaryConfigured ? "مكتمل" : "بانتظار إدخال الراتب";
  }
  if (!hasOwn(next, "bankAccount")) next.bankAccount = "";
  if (!hasOwn(next, "leaveBalance")) next.leaveBalance = 0;
  if (!hasOwn(next, "hrNotes")) next.hrNotes = "";

  return next;
}

const ACCOUNT_DEFINITIONS = Object.freeze([
  ["1000", "الأصول", "group", "debit"],
  ["1100", "الصندوق (الخزينة النقدية)", "asset", "debit"],
  ["1200", "البنوك", "asset", "debit"],
  ["1300", "ذمم العملاء", "asset", "debit"],
  ["1310", "ذمم عملاء حسب العقد", "asset", "debit"],
  ["1320", "ذمم فواتير العملاء", "asset", "debit"],
  ["1400", "سلف وعهد الموظفين", "asset", "debit"],
  ["1410", "سلف الموظفين", "asset", "debit"],
  ["1420", "عهد الموظفين", "asset", "debit"],
  ["1500", "مخزون قطع الغيار", "asset", "debit"],
  ["1600", "أصول ثابتة (مصاعد/معدات)", "asset", "debit"],
  ["2000", "الخصوم", "group", "credit"],
  ["2100", "ذمم الموردين", "liability", "credit"],
  ["2200", "مستحقات", "liability", "credit"],
  ["3000", "حقوق الملكية", "equity", "credit"],
  ["3100", "رأس المال", "equity", "credit"],
  ["3200", "جاري المالك", "equity", "credit"],
  ["3300", "أرباح/خسائر متراكمة", "equity", "credit"],
  ["4000", "إيرادات", "group", "credit"],
  ["4100", "إيرادات عقود الصيانة", "revenue", "credit"],
  ["4200", "إيرادات عقود التركيب", "revenue", "credit"],
  ["4300", "إيرادات فواتير العملاء", "revenue", "credit"],
  ["4400", "إيرادات أخرى", "revenue", "credit"],
  ["5000", "مصروفات", "group", "debit"],
  ["5100", "رواتب وأجور", "expense", "debit"],
  ["5200", "مشتريات وتكاليف عقود", "expense", "debit"],
  ["5300", "مصروفات تشغيل", "expense", "debit"],
  ["5400", "مصروفات عامة وإدارية", "expense", "debit"],
  ["5500", "خصومات ومنح", "expense", "debit"],
]);

function defaultChartOfAccounts(companyOwnerId) {
  const ownerId = String(companyOwnerId || "").trim();
  if (!ownerId) return [];
  return ACCOUNT_DEFINITIONS.map(([id, name, type, nature]) => ({
    id,
    name,
    type,
    nature,
    companyOwnerId: ownerId,
  }));
}

function canonicalCompanyOwnerIds(store) {
  const ids = new Set();
  const add = value => {
    const id = String(value || "").trim();
    if (id) ids.add(id);
  };
  const companies = parseJsonArray(store, "misadOwnerCompanies", {missingValue: []});
  companies.forEach(company => add(company?.ownerIds?.[0] || company?.ownerId || company?.id));
  for (const key of ["misadCompanyStaff", "misadContracts", "misadUsers"]) {
    const records = parseJsonArray(store, key, {missingValue: []});
    records.forEach(record => {
      if (key === "misadUsers" && record?.role === "owner") add(record.companyOwnerId || record.id);
      else add(record?.companyOwnerId);
    });
  }
  return [...ids];
}

function storedArrayCounts(store) {
  const counts = {};
  for (const [key, raw] of Object.entries(store || {})) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) counts[key] = parsed.length;
    } catch {}
  }
  return counts;
}

function validatePreservedRecords(before, after) {
  for (const key of Object.keys(before)) {
    if (!hasOwn(after, key)) throw new Error(`Migration removed storage key ${key}`);
  }

  const mutableKeys = new Set([
    "misadCompanyStaff",
    "misadChartOfAccounts",
    "misadSchemaVersion",
    "misadSchemaMigrations",
  ]);
  for (const key of Object.keys(before)) {
    if (!mutableKeys.has(key) && !jsonEqual(before[key], after[key])) {
      throw new Error(`Migration changed protected storage key ${key}`);
    }
  }

  const beforeCounts = storedArrayCounts(before);
  const afterCounts = storedArrayCounts(after);
  for (const [key, count] of Object.entries(beforeCounts)) {
    if (!hasOwn(afterCounts, key) || afterCounts[key] < count) {
      throw new Error(`Migration removed records from ${key}: ${count} -> ${afterCounts[key] ?? "missing"}`);
    }
  }

  const oldStaff = parseJsonArray(before, "misadCompanyStaff", {missingValue: []});
  const newStaff = parseJsonArray(after, "misadCompanyStaff", {missingValue: []});
  if (oldStaff.length !== newStaff.length) throw new Error("Migration changed the staff record count");
  oldStaff.forEach((record, index) => {
    for (const [field, value] of Object.entries(record || {})) {
      if (!jsonEqual(value, newStaff[index]?.[field])) {
        throw new Error(`Migration changed existing staff field ${field} at index ${index}`);
      }
    }
  });

  const oldChart = parseJsonArray(before, "misadChartOfAccounts", {missingValue: []});
  const newChart = parseJsonArray(after, "misadChartOfAccounts", {missingValue: []});
  oldChart.forEach((account, index) => {
    if (!jsonEqual(account, newChart[index])) throw new Error(`Migration changed existing chart account at index ${index}`);
  });
  return {beforeCounts, afterCounts};
}

function validateJournals(store) {
  const journals = parseJsonArray(store, "misadJournalEntries", {missingValue: []});
  const unbalanced = [];
  journals.forEach((journal, index) => {
    let debit = 0;
    let credit = 0;
    (Array.isArray(journal?.lines) ? journal.lines : []).forEach(line => {
      const value = Number(line?.amount || 0);
      if (!Number.isFinite(value) || value < 0) return;
      if (line?.side === "debit") debit += value;
      if (line?.side === "credit") credit += value;
    });
    if (Math.abs(debit - credit) > 0.01) {
      unbalanced.push(String(journal?.id || `index-${index}`));
    }
  });
  if (unbalanced.length) {
    throw new Error(`Unbalanced journal entries detected: ${unbalanced.slice(0, 10).join(", ")}`);
  }
  return {count: journals.length, unbalanced: 0};
}

function migrateStoreNonDestructive(inputStore, options = {}) {
  if (!inputStore || typeof inputStore !== "object" || Array.isArray(inputStore)) {
    throw new Error("Storage root must be a JSON object");
  }
  const before = jsonClone(inputStore);
  const next = jsonClone(inputStore);
  const appliedAt = new Date(options.now || Date.now()).toISOString();
  const addedKeys = [];

  for (const key of FINANCE_ARRAY_KEYS) {
    if (!hasOwn(next, key)) {
      next[key] = "[]";
      addedKeys.push(key);
    } else {
      parseJsonArray(next, key);
    }
  }

  const originalStaffValue = next.misadCompanyStaff;
  const staff = parseJsonArray(next, "misadCompanyStaff", {missingValue: []});
  const enrichedStaff = staff.map(enrichStaffRecord);
  const updatedStaff = enrichedStaff.reduce((total, record, index) => total + (jsonEqual(record, staff[index]) ? 0 : 1), 0);
  if (updatedStaff) next.misadCompanyStaff = serializeArrayLike(originalStaffValue, enrichedStaff);

  const originalChartValue = next.misadChartOfAccounts;
  const chart = parseJsonArray(next, "misadChartOfAccounts", {missingValue: []});
  const chartNext = [...chart];
  let addedAccounts = 0;
  for (const companyOwnerId of canonicalCompanyOwnerIds(next)) {
    for (const account of defaultChartOfAccounts(companyOwnerId)) {
      const exists = chartNext.some(existing =>
        String(existing?.id || "") === account.id &&
        String(existing?.companyOwnerId || "") === account.companyOwnerId
      );
      if (!exists) {
        chartNext.push(account);
        addedAccounts++;
      }
    }
  }
  if (addedAccounts) next.misadChartOfAccounts = serializeArrayLike(originalChartValue, chartNext);

  const migrationValue = next.misadSchemaMigrations;
  const migrations = parseJsonArray(next, "misadSchemaMigrations", {missingValue: []});
  if (!migrations.some(item => item?.id === CURRENT_SCHEMA_VERSION)) {
    migrations.push({id: CURRENT_SCHEMA_VERSION, appliedAt, mode: "non-destructive"});
    next.misadSchemaMigrations = serializeArrayLike(migrationValue, migrations);
  }
  next.misadSchemaVersion = CURRENT_SCHEMA_VERSION;

  const preservation = validatePreservedRecords(before, next);
  const journals = validateJournals(next);
  const changed = !jsonEqual(before, next);
  return {
    store: next,
    changed,
    addedKeys,
    updatedStaff,
    addedAccounts,
    beforeCounts: preservation.beforeCounts,
    afterCounts: preservation.afterCounts,
    journals,
  };
}

function readJsonObjectFile(filePath) {
  let parsed;
  try {
    const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Cannot read valid storage JSON from ${filePath}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Storage file ${filePath} must contain a JSON object`);
  }
  return parsed;
}

function atomicWriteJson(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, {recursive: true});
  const token = crypto.randomBytes(6).toString("hex");
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${token}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2), "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    try {
      const directoryDescriptor = fs.openSync(directory, "r");
      fs.fsyncSync(directoryDescriptor);
      fs.closeSync(directoryDescriptor);
    } catch {}
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function createVerifiedBackup(storagePath, backupDirectory, prefix = "pre-migration") {
  const original = fs.readFileSync(storagePath);
  JSON.parse(original.toString("utf8").replace(/^\uFEFF/, ""));
  fs.mkdirSync(backupDirectory, {recursive: true});
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const token = crypto.randomBytes(4).toString("hex");
  const backupPath = path.join(backupDirectory, `${prefix}-${stamp}-${token}.json`);
  fs.writeFileSync(backupPath, original, {flag: "wx", mode: 0o600});
  const copied = fs.readFileSync(backupPath);
  const originalHash = crypto.createHash("sha256").update(original).digest("hex");
  const backupHash = crypto.createHash("sha256").update(copied).digest("hex");
  if (originalHash !== backupHash) throw new Error("Storage backup verification failed");
  return {path: backupPath, sha256: backupHash, bytes: copied.length};
}

function migrateStorageFile(options) {
  const storagePath = path.resolve(options?.storagePath || "");
  if (!storagePath) throw new Error("storagePath is required");
  const backupDirectory = path.resolve(options?.backupDirectory || path.join(path.dirname(storagePath), "backups"));
  const before = readJsonObjectFile(storagePath);
  const migration = migrateStoreNonDestructive(before, {now: options?.now});
  if (!migration.changed) return {...migration, backup: null, storagePath};

  const backup = createVerifiedBackup(storagePath, backupDirectory, options?.backupPrefix || "pre-migration");
  atomicWriteJson(storagePath, migration.store);
  const written = readJsonObjectFile(storagePath);
  validatePreservedRecords(before, written);
  validateJournals(written);
  return {...migration, backup, storagePath};
}

module.exports = {
  ACCOUNT_DEFINITIONS,
  CURRENT_SCHEMA_VERSION,
  FINANCE_ARRAY_KEYS,
  atomicWriteJson,
  canonicalCompanyOwnerIds,
  createVerifiedBackup,
  defaultChartOfAccounts,
  enrichStaffRecord,
  migrateStorageFile,
  migrateStoreNonDestructive,
  readJsonObjectFile,
  storedArrayCounts,
  validateJournals,
  validatePreservedRecords,
};
