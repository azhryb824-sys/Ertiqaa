"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const render = process.env.RENDER === "true";
const dataDir = render ? "/var/data" : (process.env.DATA_DIR || path.join(require("os").homedir(), ".elevator-data"));
const storagePath = render ? "/var/data/storage.json" : (process.env.STORAGE_PATH || path.join(dataDir, "storage.json"));

function mounted() {
  if (!render) return true;
  try {
    return fs.readFileSync("/proc/self/mountinfo", "utf8").split("\n").some(line => line.split(" ")[4] === "/var/data");
  } catch {
    return false;
  }
}

if (!mounted()) throw new Error("Persistent disk is not mounted at /var/data; startup refused to prevent data rollback.");

process.env.DATA_DIR = dataDir;
process.env.STORAGE_PATH = storagePath;
process.env.STORAGE_FAILOVER_PATH = path.join(dataDir, "storage.failover.json");
process.env.REQUIRE_PERSISTENT_STORAGE = "1";

if (!render || fs.existsSync(storagePath)) {
  require("./server.cjs");
} else {
  const port = Number(process.env.PORT || 4173);
  const serverSource = fs.readFileSync(path.join(__dirname, "server.cjs"), "utf8");
  const configuredDefault = serverSource.match(/\{id:"2572280689", password:process\.env\.ADMIN_PASSWORD \|\| "([^"]+)"/)?.[1] || "";
  const expected = String(process.env.ADMIN_PASSWORD || configuredDefault);
  if (!expected) throw new Error("Mounted disk is empty and ADMIN_PASSWORD is unavailable; migration refused.");
  const equal = (left, right) => {
    const a = Buffer.from(String(left || ""));
    const b = Buffer.from(String(right || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  http.createServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"});
      return res.end(JSON.stringify({ok: true, migrationPending: true}));
    }
    if (req.url !== "/api/bootstrap-storage" || req.method !== "POST") {
      res.writeHead(503, {"Content-Type": "application/json"});
      return res.end(JSON.stringify({error: "Persistent storage migration is pending"}));
    }
    if (!equal(req.headers["x-bootstrap-token"], expected)) {
      res.writeHead(403, {"Content-Type": "application/json"});
      return res.end(JSON.stringify({error: "Unauthorized"}));
    }
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) req.destroy();
      else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const store = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const contracts = JSON.parse(store.misadContracts || "[]");
        if (!store || typeof store !== "object" || Array.isArray(store) || contracts.length !== 42) throw new Error("Snapshot validation failed");
        fs.mkdirSync(dataDir, {recursive: true});
        const temp = `${storagePath}.migration-${process.pid}`;
        fs.writeFileSync(temp, JSON.stringify(store), {mode: 0o600});
        fs.renameSync(temp, storagePath);
        res.writeHead(201, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ok: true, contracts: contracts.length, restarting: true}), () => setTimeout(() => process.exit(0), 250));
      } catch (error) {
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: error.message}));
      }
    });
  }).listen(port, "0.0.0.0", () => console.log("Secure persistent-storage migration mode is ready"));
}
