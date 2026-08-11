"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  CURRENT_SCHEMA_VERSION,
  FINANCE_ARRAY_KEYS,
  migrateStorageFile,
  migrateStoreNonDestructive,
  storedArrayCounts,
} = require("../src/storage/non-destructive-migration.cjs");

const records = value => JSON.stringify(value);
const source = {
  misadCreatedAt: "2026-01-01T00:00:00.000Z",
  misadOwnerCompanies: records([{id: "OWN-1", ownerId: "OWNER-1", ownerIds: ["OWNER-1"], name: "شركة"}]),
  misadUsers: records([{id: "OWNER-1", role: "owner", companyOwnerId: "OWNER-1"}]),
  misadCompanyStaff: records([
    {id: "STF-1", identity: "١٠١٠٣٨٩١٠٢", role: "technician", name: "فني", status: "مرتبط", companyOwnerId: "OWNER-1"},
    {id: "STF-2", identity: "2020202020", role: "administrative", name: "إداري", baseSalary: 6000, companyOwnerId: "OWNER-1"},
  ]),
  misadContracts: records([{id: "CONT-1", companyOwnerId: "OWNER-1", value: 12000}]),
  misadVisits: records([{id: "VIS-1", contractId: "CONT-1"}]),
  misadClaims: records([{id: "CLM-1", value: 500}]),
  misadChartOfAccounts: records([{id: "9999", name: "حساب مخصص", type: "asset", nature: "debit", companyOwnerId: "OWNER-1"}]),
  misadJournalEntries: records([{
    id: "JRN-1",
    companyOwnerId: "OWNER-1",
    lines: [
      {account: "1100", side: "debit", amount: 100},
      {account: "3100", side: "credit", amount: 100},
    ],
  }]),
  customProtectedValue: {must: "remain unchanged"},
};

const original = JSON.parse(JSON.stringify(source));
const migrated = migrateStoreNonDestructive(source, {now: "2026-08-11T12:00:00.000Z"});
assert.equal(migrated.changed, true);
assert.deepEqual(source, original, "الترقية النقية لا تعدل كائن المصدر");
assert.equal(migrated.store.misadSchemaVersion, CURRENT_SCHEMA_VERSION);
assert.deepEqual(migrated.store.customProtectedValue, original.customProtectedValue);
assert.equal(JSON.parse(migrated.store.misadContracts).length, 1);
assert.equal(JSON.parse(migrated.store.misadVisits).length, 1);
assert.equal(JSON.parse(migrated.store.misadClaims).length, 1);
assert.equal(migrated.journals.count, 1);

for (const key of FINANCE_ARRAY_KEYS) {
  assert.ok(Object.hasOwn(migrated.store, key), `تم إنشاء المفتاح المالي ${key}`);
  assert.ok(Array.isArray(JSON.parse(migrated.store[key])), `${key} مصفوفة JSON سليمة`);
}

const staff = JSON.parse(migrated.store.misadCompanyStaff);
assert.equal(staff.length, 2, "لم يُحذف أي موظف");
assert.equal(staff[0].financialId, "1010389102");
assert.equal(staff[0].financialProfileId, "SFIN-1010389102");
assert.equal(staff[0].employeeType, "technician");
assert.equal(staff[0].baseSalary, 0, "لا يتم اختلاق راتب للموظف القديم");
assert.equal(staff[0].salaryConfigured, false);
assert.equal(staff[0].financialProfileStatus, "بانتظار إدخال الراتب");
assert.equal(staff[1].baseSalary, 6000, "الراتب الموجود محفوظ");
assert.equal(staff[1].salaryConfigured, true);

const chart = JSON.parse(migrated.store.misadChartOfAccounts);
assert.deepEqual(chart[0], JSON.parse(source.misadChartOfAccounts)[0], "الحساب المخصص محفوظ");
assert.ok(chart.some(account => account.id === "1410" && account.companyOwnerId === "OWNER-1"));
assert.ok(chart.some(account => account.id === "1420" && account.companyOwnerId === "OWNER-1"));
assert.equal(
  chart.slice(1).some(account => /tax|vat|ضريب/i.test(`${account.id} ${account.name}`)),
  false,
  "الترقية لا تضيف حسابات ضريبية",
);

const beforeCounts = storedArrayCounts(source);
const afterCounts = storedArrayCounts(migrated.store);
for (const [key, count] of Object.entries(beforeCounts)) {
  assert.ok(afterCounts[key] >= count, `${key}: لا ينخفض عدد السجلات`);
}

const secondPass = migrateStoreNonDestructive(migrated.store, {now: "2026-08-12T12:00:00.000Z"});
assert.equal(secondPass.changed, false, "الترقية قابلة للتكرار بلا تغييرات جديدة");
assert.deepEqual(secondPass.store, migrated.store);

assert.throws(() => migrateStoreNonDestructive({
  ...source,
  misadJournalEntries: records([{
    id: "BAD-JOURNAL",
    lines: [
      {side: "debit", amount: 100},
      {side: "credit", amount: 90},
    ],
  }]),
}), /Unbalanced journal entries/, "القيد غير المتوازن يوقف الترقية ولا يُعدّل آلياً");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ertiqaa-storage-migration-"));
try {
  const storagePath = path.join(temporaryDirectory, "storage.json");
  const backupDirectory = path.join(temporaryDirectory, "backups");
  fs.writeFileSync(storagePath, JSON.stringify(source, null, 2));
  const fileResult = migrateStorageFile({
    storagePath,
    backupDirectory,
    now: "2026-08-11T12:00:00.000Z",
  });
  assert.equal(fileResult.changed, true);
  assert.ok(fileResult.backup && fs.existsSync(fileResult.backup.path), "أُنشئت نسخة احتياطية قبل الكتابة");
  assert.deepEqual(JSON.parse(fs.readFileSync(fileResult.backup.path, "utf8")), source, "النسخة الاحتياطية مطابقة للأصل");
  const written = JSON.parse(fs.readFileSync(storagePath, "utf8"));
  assert.equal(written.misadSchemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(JSON.parse(written.misadContracts).length, 1);
  assert.equal(fs.readdirSync(temporaryDirectory).some(name => name.endsWith(".tmp")), false, "لا تبقى ملفات كتابة مؤقتة");

  const invalidPath = path.join(temporaryDirectory, "invalid-storage.json");
  const invalidSource = JSON.stringify({...source, misadPayrolls: "not-json"}, null, 2);
  fs.writeFileSync(invalidPath, invalidSource);
  assert.throws(
    () => migrateStorageFile({storagePath: invalidPath, backupDirectory}),
    /misadPayrolls contains invalid JSON/,
  );
  assert.equal(fs.readFileSync(invalidPath, "utf8"), invalidSource, "الملف غير السليم لا يُستبدل ولا يُفرغ");
} finally {
  fs.rmSync(temporaryDirectory, {recursive: true, force: true});
}

console.log("non-destructive storage migration tests passed");
