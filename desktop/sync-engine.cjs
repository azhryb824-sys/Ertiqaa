"use strict";

const crypto = require("crypto");

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function equal(left, right) { return left === right || JSON.stringify(left) === JSON.stringify(right); }

function changedUpdates(baseline, current) {
  const before = baseline && typeof baseline === "object" ? baseline : {};
  const after = current && typeof current === "object" ? current : {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(key => /^misad[A-Za-z0-9:_-]{1,100}$/.test(key)).flatMap(key => {
    if (!Object.prototype.hasOwnProperty.call(after, key)) return [{key, remove: true, baseValue: clone(before[key])}];
    if (equal(before[key], after[key])) return [];
    return [{key, value: clone(after[key]), baseValue: clone(before[key])}];
  });
}

function revision(store) { return crypto.createHash("sha256").update(JSON.stringify(store || {})).digest("hex"); }

async function jsonRequest(url, token, options = {}) {
  const response = await fetch(url, {...options, headers: {"Accept": "application/json", "Content-Type": "application/json", "X-Desktop-Sync-Token": token, ...(options.headers || {})}});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Sync request failed (${response.status})`);
  return payload;
}

async function synchronize({localUrl, remoteUrl, token, baseline}) {
  if (!remoteUrl) throw new Error("ERTIQAA_REMOTE_URL is not configured");
  const local = await jsonRequest(`${localUrl}/api/desktop-sync`, token);
  if (!baseline) {
    const remote = await jsonRequest(`${remoteUrl}/api/desktop-sync`, token);
    const localUpdates = changedUpdates(local.store, remote.store);
    if (localUpdates.length) await jsonRequest(`${localUrl}/api/desktop-sync`, token, {method: "POST", body: JSON.stringify({updates: localUpdates})});
    return {store: remote.store, uploaded: 0, downloaded: localUpdates.length, revision: remote.revision};
  }
  const outbound = changedUpdates(baseline, local.store);
  const remote = await jsonRequest(`${remoteUrl}/api/desktop-sync`, token, {method: "POST", body: JSON.stringify({updates: outbound})});
  const inbound = changedUpdates(local.store, remote.store);
  if (inbound.length) await jsonRequest(`${localUrl}/api/desktop-sync`, token, {method: "POST", body: JSON.stringify({updates: inbound})});
  return {store: remote.store, uploaded: outbound.length, downloaded: inbound.length, revision: remote.revision || revision(remote.store)};
}

module.exports = {changedUpdates, equal, jsonRequest, revision, synchronize};
