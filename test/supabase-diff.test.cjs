"use strict";

const assert = require("node:assert/strict");
const {
  applyPersistedRows,
  changedStorageRows,
  cloneJson,
} = require("../src/storage/supabase-diff.cjs");

const previous = {
  misadContracts: JSON.stringify([{id: "CONT-1", value: 1000}]),
  misadVisits: JSON.stringify([{id: "VIS-1", status: "مجدولة"}]),
  misadStaffLocations: JSON.stringify([{identity: "1", lat: 21.4, lng: 39.8}]),
};
const next = cloneJson(previous);
next.misadStaffLocations = JSON.stringify([{identity: "1", lat: 21.41, lng: 39.81}]);

const rows = changedStorageRows(previous, next);
assert.equal(rows.length, 1, "تغيير الموقع لا يعيد كتابة العقود والزيارات");
assert.equal(rows[0].key, "misadStaffLocations");
assert.equal(rows[0].updated_by, "ertiqaa-server");
assert.deepEqual(changedStorageRows(next, cloneJson(next)), [], "لا تُرسل الصفوف التي لم تتغير");

const persisted = applyPersistedRows(previous, rows);
assert.deepEqual(persisted, next);
rows[0].value = "changed-after-persist";
assert.equal(persisted.misadStaffLocations, next.misadStaffLocations, "لقطة الحالة المحفوظة مستقلة عن كائن الطلب");

const added = changedStorageRows(next, {...next, misadNotifications: "[]"});
assert.deepEqual(added.map(row => row.key), ["misadNotifications"]);
assert.equal(previous.misadNotifications, undefined, "المقارنة لا تعدل المصدر");

console.log("Supabase differential storage tests passed");
