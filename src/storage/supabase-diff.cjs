"use strict";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonEqual(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedStorageRows(previousStore, nextStore, updatedBy = "ertiqaa-server") {
  const previous = previousStore && typeof previousStore === "object" ? previousStore : {};
  const next = nextStore && typeof nextStore === "object" ? nextStore : {};
  return Object.entries(next)
    .filter(([key, value]) => !Object.prototype.hasOwnProperty.call(previous, key) || !jsonEqual(previous[key], value))
    .map(([key, value]) => ({key, value: cloneJson(value), updated_by: updatedBy}));
}

function applyPersistedRows(store, rows) {
  const next = cloneJson(store && typeof store === "object" ? store : {});
  for (const row of rows || []) next[row.key] = cloneJson(row.value);
  return next;
}

module.exports = {applyPersistedRows, changedStorageRows, cloneJson, jsonEqual};
