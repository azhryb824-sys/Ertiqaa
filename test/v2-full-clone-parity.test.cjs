const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const original = fs.readFileSync(path.join(root, "dashboard.html"), "utf8");
const evolved = fs.readFileSync(path.join(root, "v2", "dashboard.html"), "utf8");
const selector = fs.readFileSync(path.join(root, "version-select.html"), "utf8");
const runtime = fs.readFileSync(path.join(root, "v2", "full-clone.js"), "utf8");

const ids = source => [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
const functionalScripts = source => [...source.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(match => match[1].split("?")[0])
  .filter(src => !src.startsWith("http") && !src.startsWith("v2/"))
  .sort();

assert.deepEqual(ids(evolved), ids(original), "V2 must preserve every functional dashboard mount point");
assert.deepEqual(functionalScripts(evolved), functionalScripts(original), "V2 must load the complete V1 application engine");
assert.match(evolved, /<base href="\/">/, "V2 clone must resolve all original relative routes from the service root");
assert.match(evolved, /v2\/full-theme\.css/, "V2 clone must add its theme as an overlay, not replace V1 styles");
assert.match(selector, /href="v2\/dashboard\.html"/, "version chooser must open the full clone");
assert.match(selector, /href="https:\/\/ertiqaa\.onrender\.com\/dashboard\.html"/, "V1 must remain on its untouched production origin");
assert.doesNotMatch(selector, /href="v2\/index\.html"/, "sparse V2 must no longer be the primary edition");
assert.match(runtime, /V2_WRITE_TO_V1_BLOCKED/, "V2 must contain an explicit production-write barrier");

console.log("v2 full-clone parity tests passed");
