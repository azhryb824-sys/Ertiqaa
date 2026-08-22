"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_REMOTE_URL = "https://ertiqaa.onrender.com";

function normalizeRemoteUrl(value) {
  const url = String(value || DEFAULT_REMOTE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(url)) throw new Error("أدخل رابط HTTPS صحيحًا لخدمة ارتقاء");
  return url;
}

function validateToken(value) {
  const token = String(value || "").trim();
  if (token.length < 24) throw new Error("رمز المزامنة غير صالح أو قصير جدًا");
  return token;
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value), {encoding: "utf8", mode: 0o600});
  fs.renameSync(temp, file);
}

function saveConfig(file, safeStorage, input) {
  if (!safeStorage?.isEncryptionAvailable?.()) throw new Error("حماية Windows غير متاحة لحفظ رمز المزامنة");
  const token = validateToken(input.token);
  const remoteUrl = normalizeRemoteUrl(input.remoteUrl);
  const config = {
    version: 1,
    remoteUrl,
    encryptedToken: safeStorage.encryptString(token).toString("base64"),
    updatedAt: new Date().toISOString()
  };
  atomicWrite(file, config);
  return {remoteUrl, token};
}

function loadConfig(file, safeStorage) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!saved?.encryptedToken || !safeStorage?.isEncryptionAvailable?.()) return null;
    const token = validateToken(safeStorage.decryptString(Buffer.from(saved.encryptedToken, "base64")));
    return {remoteUrl: normalizeRemoteUrl(saved.remoteUrl), token};
  } catch { return null; }
}

function publicConfig(file, safeStorage) {
  const config = loadConfig(file, safeStorage);
  return {configured: Boolean(config), remoteUrl: config?.remoteUrl || DEFAULT_REMOTE_URL};
}

module.exports = {DEFAULT_REMOTE_URL, loadConfig, normalizeRemoteUrl, publicConfig, saveConfig, validateToken};
