"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {changedStorageRows, cloneJson} = require("../src/storage/supabase-diff.cjs");

const template = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "storage.template.json"), "utf8"));
const next = cloneJson(template);
next.misadStaffLocations = JSON.stringify([{identity: "2000000000", lat: 21.4, lng: 39.8, updatedAtMs: Date.now()}]);

const legacyPayloadBytes = Buffer.byteLength(JSON.stringify(Object.entries(next).map(([key, value]) => ({key, value, updated_by: "ertiqaa-server"}))));
const differentialRows = changedStorageRows(template, next);
const differentialPayloadBytes = Buffer.byteLength(JSON.stringify(differentialRows));

assert.deepEqual(differentialRows.map(row => row.key), ["misadStaffLocations"]);
assert.ok(differentialPayloadBytes < legacyPayloadBytes * 0.01, `expected >99% reduction, got ${differentialPayloadBytes}/${legacyPayloadBytes}`);

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.match(appSource, /locationPersistIntervalMs=30000/);
assert.match(appSource, /now-lastLocationPersistAt>=locationPersistIntervalMs/);

console.log(JSON.stringify({
  ok: true,
  legacyPayloadBytes,
  differentialPayloadBytes,
  reductionPercent: Number(((1 - differentialPayloadBytes / legacyPayloadBytes) * 100).toFixed(2)),
}));
