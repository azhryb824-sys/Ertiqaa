"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  discoverRecoverableContracts,
  recoverContract,
  recoverySummary,
} = require("../contract-recovery.cjs");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ertiqaa-contract-recovery-"));
const owner = {id: "1000000001", role: "owner"};
const otherOwner = "1000000002";
const companies = [{id: "CO-1", ownerId: owner.id, ownerIds: [owner.id]}];
const currentContracts = [
  {id: "CONT0001", type: "صيانة", companyOwnerId: owner.id, clientName: "حالي", status: "ساري", value: 1000},
  {id: "CONT0002", type: "صيانة", companyOwnerId: owner.id, clientName: "مخفي حالي", status: "محذوف", value: 2000, deletedAt: "2026-08-12"},
  {id: "CONT0999", type: "صيانة", companyOwnerId: otherOwner, clientName: "شركة أخرى", status: "ساري", value: 9999}
];
const currentStore = {
  misadOwnerCompanies: JSON.stringify(companies),
  misadContracts: JSON.stringify(currentContracts),
  misadFinancialEntries: JSON.stringify([{id: "FIN-KEEP", contractId: "CONT0001", amount: 100}]),
  untouchedKey: "must-stay"
};

const olderBackup = path.join(temp, "storage-older.json");
const newerBackup = path.join(temp, "prewrite-newer.json");
fs.writeFileSync(olderBackup, JSON.stringify({
  misadOwnerCompanies: JSON.stringify(companies),
  misadContracts: JSON.stringify([
    currentContracts[0],
    {...currentContracts[1], clientName: "نسخة قديمة", status: "بانتظار موافقة العميل", deletedAt: undefined},
    {id: "CONT0003", type: "صيانة", companyOwnerId: owner.id, clientName: "العقد المفقود القديم", status: "ساري", value: 3000, createdAtMs: 100},
    {id: "CONT0004", type: "صيانة", companyOwnerId: otherOwner, clientName: "غير مصرح", status: "ساري", value: 4000}
  ])
}));
fs.writeFileSync(newerBackup, JSON.stringify({
  misadOwnerCompanies: JSON.stringify(companies),
  misadContracts: JSON.stringify([
    currentContracts[0],
    {...currentContracts[1], clientName: "نسخة قبل الإخفاء", status: "ساري", deletedAt: undefined},
    {id: "CONT0003", type: "صيانة", companyOwnerId: owner.id, clientName: "العقد المفقود", status: "بانتظار موافقة العميل", value: 3500, createdAtMs: 200},
    {id: "CONT0004", type: "صيانة", companyOwnerId: otherOwner, clientName: "غير مصرح", status: "ساري", value: 4000}
  ])
}));
fs.utimesSync(olderBackup, new Date("2026-08-10T00:00:00Z"), new Date("2026-08-10T00:00:00Z"));
fs.utimesSync(newerBackup, new Date("2026-08-11T00:00:00Z"), new Date("2026-08-11T00:00:00Z"));

const discovery = discoverRecoverableContracts({
  store: currentStore,
  sourcePaths: [olderBackup, newerBackup],
  user: owner
});
assert.deepEqual(discovery.candidates.map(item => item.id).sort(), ["CONT0002", "CONT0003"]);
assert.equal(discovery.candidates.find(item => item.id === "CONT0002").record.status, "ساري", "يؤخذ آخر وضع غير محذوف للعقد المخفي");
assert.equal(discovery.candidates.find(item => item.id === "CONT0003").record.value, 3500, "تُستخدم أحدث نسخة متاحة للعقد المفقود");
assert.equal(discovery.candidates.some(item => item.id === "CONT0004"), false, "لا تظهر عقود شركة أخرى");
assert.deepEqual(Object.keys(recoverySummary(discovery.candidates[0])).sort(), [
  "clientName", "createdAt", "createdAtMs", "endDate", "id", "kind", "sourceMtime", "sourceName", "startDate", "status", "type", "value"
].sort(), "لا يسرّب ملخص الواجهة كامل سجل العقد");

const missingStore = JSON.parse(JSON.stringify(currentStore));
const missingResult = recoverContract({
  store: missingStore,
  sourcePaths: [olderBackup, newerBackup],
  user: owner,
  contractId: "CONT0003",
  recoveredBy: owner.id,
  now: new Date("2026-08-12T06:00:00Z")
});
assert.equal(missingResult.ok, true);
assert.equal(missingResult.kind, "missing");
assert.equal(JSON.parse(missingStore.misadContracts).length, currentContracts.length + 1, "يُضاف العقد وحده دون استبدال القائمة");
assert.equal(JSON.parse(missingStore.misadContracts)[0].clientName, "العقد المفقود");
assert.equal(missingStore.misadFinancialEntries, currentStore.misadFinancialEntries, "تبقى البيانات المالية دون تغيير");
assert.equal(missingStore.untouchedKey, "must-stay", "تبقى بقية مفاتيح القاعدة دون تغيير");

const hiddenStore = JSON.parse(JSON.stringify(currentStore));
const hiddenResult = recoverContract({
  store: hiddenStore,
  sourcePaths: [olderBackup, newerBackup],
  user: owner,
  contractId: "CONT0002",
  recoveredBy: owner.id,
  now: new Date("2026-08-12T06:00:00Z")
});
const restoredHidden = JSON.parse(hiddenStore.misadContracts).find(contract => contract.id === "CONT0002");
assert.equal(hiddenResult.ok, true);
assert.equal(hiddenResult.kind, "hidden");
assert.equal(restoredHidden.status, "ساري");
assert.equal(restoredHidden.clientName, "مخفي حالي", "لا تُستبدل حقول السجل الحالي ببيانات أقدم");
assert.equal("deletedAt" in restoredHidden, false);

const deniedStore = JSON.parse(JSON.stringify(currentStore));
const denied = recoverContract({
  store: deniedStore,
  sourcePaths: [olderBackup, newerBackup],
  user: {id: otherOwner, role: "owner"},
  contractId: "CONT0003",
  recoveredBy: otherOwner
});
assert.equal(denied.ok, false, "لا يمكن لمالك آخر استعادة العقد");
assert.equal(deniedStore.misadContracts, currentStore.misadContracts, "لا تحدث كتابة عند رفض الاستعادة");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.cjs"), "utf8");
assert.match(appSource, /data-contract-recovery/, "تظهر أداة الاستعادة في صفحة العقود");
assert.match(appSource, /data-recover-contract/, "يمكن اختيار عقد واحد فقط للاستعادة");
assert.match(serverSource, /\/api\/contracts\/recovery-candidates/, "يتوفر فحص مرخّص لنسخ العقود");
assert.match(serverSource, /\/api\/contracts\/recover/, "يتوفر مسار الاستعادة الانتقائية");
assert.match(serverSource, /writeStore\(store\)/, "تمر الاستعادة عبر الكتابة الآمنة ذات النسخة المسبقة");
const recoveryRoute = serverSource.slice(
  serverSource.indexOf('if (pathname === "/api/contracts/recover"'),
  serverSource.indexOf('if (pathname === "/api/auth/storage-token"')
);
assert.doesNotMatch(recoveryRoute, /activity\.slice\(/, "لا تُحذف سجلات نشاط قديمة أثناء الاستعادة");

fs.rmSync(temp, {recursive: true, force: true});
console.log("contract recovery tests passed");
