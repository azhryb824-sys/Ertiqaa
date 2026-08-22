"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {loadConfig, normalizeRemoteUrl, publicConfig, saveConfig, validateToken} = require("../desktop/config-store.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ertiqaa-desktop-config-"));
const file = path.join(dir, "config.json");
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(`protected:${value}`, "utf8"),
  decryptString: value => value.toString("utf8").replace(/^protected:/, "")
};
const token = "0123456789abcdef0123456789abcdef";
assert.equal(normalizeRemoteUrl("https://ertiqaa.onrender.com/"), "https://ertiqaa.onrender.com");
assert.throws(() => normalizeRemoteUrl("http://example.com"), /HTTPS/);
assert.throws(() => validateToken("short"), /قصير/);
saveConfig(file, safeStorage, {remoteUrl: "https://ertiqaa.onrender.com/", token});
assert.deepEqual(loadConfig(file, safeStorage), {remoteUrl: "https://ertiqaa.onrender.com", token});
assert.deepEqual(publicConfig(file, safeStorage), {configured: true, remoteUrl: "https://ertiqaa.onrender.com"});
assert(!fs.readFileSync(file, "utf8").includes(token), "must never store the plaintext token");
console.log("desktop encrypted configuration tests passed");
