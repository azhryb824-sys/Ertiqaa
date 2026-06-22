const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 4173;
const host = "127.0.0.1";
const storagePath = path.join(root, "storage.json");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  if (req.url.startsWith("/api/storage")) {
    const sendJson = (status, payload) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(payload));
    };
    const readStore = () => {
      try {
        return JSON.parse(fs.readFileSync(storagePath, "utf8") || "{}");
      } catch {
        return {};
      }
    };
    const writeStore = store => fs.writeFileSync(storagePath, JSON.stringify(store, null, 2), "utf8");
    if (req.method === "GET") return sendJson(200, readStore());
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const {key, value, remove} = JSON.parse(body || "{}");
          if (!key) return sendJson(400, {error: "Missing key"});
          const store = readStore();
          if (remove) delete store[key];
          else store[key] = value;
          writeStore(store);
          sendJson(200, {ok: true});
        } catch {
          sendJson(400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    return sendJson(405, {error: "Method not allowed"});
  }
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
}).listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
