#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  migrateStorageFile,
  storedArrayCounts,
} = require("../src/storage/non-destructive-migration.cjs");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const requestedPath = argumentValue("--file") || process.env.STORAGE_PATH || path.join(process.cwd(), ".elevator-data", "storage.json");
const storagePath = path.resolve(requestedPath);
const backupDirectory = path.resolve(argumentValue("--backup-dir") || path.join(path.dirname(storagePath), "backups"));

try {
  const result = migrateStorageFile({storagePath, backupDirectory});
  const beforeCounts = result.beforeCounts || {};
  const afterCounts = result.afterCounts || storedArrayCounts(result.store);
  const removed = Object.entries(beforeCounts).filter(([key, count]) => !Object.hasOwn(afterCounts, key) || afterCounts[key] < count);
  if (removed.length) throw new Error(`Record loss detected: ${removed.map(([key]) => key).join(", ")}`);

  console.log(JSON.stringify({
    ok: true,
    changed: result.changed,
    schemaVersion: result.store.misadSchemaVersion,
    addedKeys: result.addedKeys.length,
    updatedStaff: result.updatedStaff,
    addedAccounts: result.addedAccounts,
    journalEntriesChecked: result.journals.count,
    removedRecords: 0,
    backup: result.backup ? {
      path: result.backup.path,
      bytes: result.backup.bytes,
      sha256: result.backup.sha256,
    } : null,
    storagePath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ok: false, error: error.message, storagePath}, null, 2));
  process.exitCode = 1;
}
