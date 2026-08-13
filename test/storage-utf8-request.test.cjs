const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {Readable} = require("node:stream");

const serverPath = path.join(__dirname, "..", "server.cjs");
const serverSource = fs.readFileSync(serverPath, "utf8");
const storagePostStart = serverSource.indexOf('if (req.url.startsWith("/api/storage"))');
const storagePostEnd = serverSource.indexOf("let urlPath = pathname;", storagePostStart);
const storageRoute = serverSource.slice(storagePostStart, storagePostEnd);

assert.ok(storagePostStart >= 0, "storage route must exist");
assert.match(
  storageRoute,
  /if \(req\.method === "POST"\) \{[\s\S]*?req\.setEncoding\("utf8"\);[\s\S]*?req\.on\("data", chunk => body \+= chunk\)/,
  "storage POST must enable streaming UTF-8 decoding before collecting text"
);

const original = JSON.stringify({value: "فحص التوصيلات الكهربائية أعلى الصاعدة"});
const bytes = Buffer.from(original, "utf8");
const arabicByte = bytes.findIndex(byte => byte >= 0xc0);
assert.ok(arabicByte >= 0, "fixture must contain multibyte UTF-8 text");

const stream = new Readable({read() {}});
stream.setEncoding("utf8");
let decoded = "";
stream.on("data", chunk => decoded += chunk);
stream.push(bytes.subarray(0, arabicByte + 1));
stream.push(bytes.subarray(arabicByte + 1));
stream.push(null);

stream.on("end", () => {
  assert.equal(decoded, original, "split Arabic bytes must decode without replacement characters");
  assert.equal(decoded.includes("�"), false);
  console.log("storage UTF-8 request regression test passed");
});
