const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const storagePath = path.join(root, "storage.json");
const entrySecret = process.env.SECRET_ENTRY_TOKEN || crypto.randomBytes(32).toString("hex");
const entryCookie = "misad_entry";
const inviteCookie = "misad_invite";
const deviceCookie = "misad_device";
const entryCookieValue = crypto.createHash("sha256").update(entrySecret).digest("hex");
let storeCache = null;
let storeMtime = 0;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const index = part.indexOf("=");
    if (index === -1) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

function hasEntryAccess(req) {
  return parseCookies(req.headers.cookie)[entryCookie] === entryCookieValue;
}

function sign(value) {
  return crypto.createHmac("sha256", entrySecret).update(value).digest("hex");
}

function hasDeviceAccess(req) {
  const token = parseCookies(req.headers.cookie)[deviceCookie] || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, deviceId, sig] = parts;
  return Boolean(userId && deviceId && sig === sign(`${userId}:${deviceId}`));
}

function readStore() {
  try {
    const stat = fs.existsSync(storagePath) ? fs.statSync(storagePath) : null;
    const mtime = stat?.mtimeMs || 0;
    if (storeCache && mtime === storeMtime) return storeCache;
    storeCache = JSON.parse(fs.readFileSync(storagePath, "utf8") || "{}");
    storeMtime = mtime;
    return storeCache;
  } catch {
    storeCache = {};
    storeMtime = 0;
    return storeCache;
  }
}

function writeStore(store) {
  fs.writeFileSync(storagePath, JSON.stringify(store, null, 2), "utf8");
  storeCache = store;
  storeMtime = fs.statSync(storagePath).mtimeMs;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function publicOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const hostName = req.headers["x-forwarded-host"] || req.headers.host || `${host}:${port}`;
  return `${proto}://${hostName}`;
}

function inviteList(store) {
  try {
    return JSON.parse(store.misadEntryInvites || "[]");
  } catch {
    return [];
  }
}

function saveInvites(store, invites) {
  store.misadEntryInvites = JSON.stringify(invites.slice(0, 200));
  writeStore(store);
}

function createInvite(input = {}) {
  const maxUses = Math.max(1, Math.min(20, Number(input.maxUses || 1)));
  const minutes = Math.max(1, Math.min(1440, Number(input.minutes || 10)));
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  return {
    id: `INV-${now}`,
    token,
    label: String(input.label || "رابط دخول عميل").slice(0, 80),
    targetRole: String(input.targetRole || "client"),
    targetUserId: String(input.targetUserId || ""),
    createdBy: String(input.createdBy || ""),
    createdByName: String(input.createdByName || ""),
    createdAt: new Date(now).toISOString(),
    expiresAtMs: now + minutes * 60000,
    maxUses,
    used: 0,
    kind: String(input.kind || "device"),
    revoked: false
  };
}

function sendLocked(res) {
  res.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متاح</title><body style="font-family:Arial,Tahoma,sans-serif;background:#f7f3ec;color:#17231f;display:grid;min-height:100vh;place-items:center;margin:0"><main style="max-width:520px;padding:32px;text-align:center"><h1>الرابط غير متاح</h1><p>لا يمكن فتح النظام إلا من خلال رابط الدخول السري المرسل من المالك أو الإداري.</p></main></body></html>`);
}

function sendMobileAssociation(res, pathname) {
  const androidPackage = process.env.ANDROID_PACKAGE_NAME || "com.ertiqaa.app";
  const androidFingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "").split(",").map(x => x.trim()).filter(Boolean);
  const iosTeamId = process.env.IOS_TEAM_ID || "";
  const iosBundleId = process.env.IOS_BUNDLE_ID || "com.ertiqaa.app";
  if (pathname === "/.well-known/assetlinks.json") {
    sendJson(res, 200, androidFingerprints.length ? [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {namespace: "android_app", package_name: androidPackage, sha256_cert_fingerprints: androidFingerprints}
    }] : []);
    return true;
  }
  if (pathname === "/.well-known/apple-app-site-association") {
    res.writeHead(200, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
    res.end(JSON.stringify({applinks: {apps: [], details: iosTeamId ? [{appIDs: [`${iosTeamId}.${iosBundleId}`], components: [{"/": "/invite/*"}, {"/": "/dashboard.html"}, {"/": "/login.html"}]}] : []}}));
    return true;
  }
  return false;
}

function notificationList(store) {
  try { return JSON.parse(store.misadNotifications || "[]"); } catch { return []; }
}

function saveNotifications(store, notifications) {
  store.misadNotifications = JSON.stringify(notifications.slice(0, 500));
  writeStore(store);
}

function pushTokenList(store) {
  try { return JSON.parse(store.misadPushTokens || "[]"); } catch { return []; }
}

function savePushTokens(store, tokens) {
  store.misadPushTokens = JSON.stringify(tokens.slice(0, 1000));
  writeStore(store);
}

function sendNativePush(tokens, notification) {
  const key = process.env.FCM_SERVER_KEY || "";
  if (!key || !tokens.length || typeof fetch !== "function") return;
  const body = {
    registration_ids: tokens.map(x => x.token),
    notification: {title: notification.title, body: notification.body},
    data: {url: notification.url || "/dashboard.html", notificationId: notification.id}
  };
  fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": `key=${key}`},
    body: JSON.stringify(body)
  }).catch(() => {});
}

http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  if (sendMobileAssociation(res, pathname)) return;
  if (pathname === "/health" || pathname === "/api/health") return sendJson(res, 200, {ok: true, at: new Date().toISOString()});
  const invitePrefix = "/invite/";
  if (pathname.startsWith(invitePrefix)) {
    const token = pathname.slice(invitePrefix.length);
    const store = readStore();
    const invites = inviteList(store);
    const invite = invites.find(x => x.token === token);
    const now = Date.now();
    if (!invite || invite.revoked || Number(invite.expiresAtMs || 0) < now || Number(invite.used || 0) >= Number(invite.maxUses || 1)) return sendLocked(res);
    res.writeHead(302, {
      "Set-Cookie": [`${entryCookie}=${entryCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`, `${inviteCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`],
      "Location": "/login.html",
      "Cache-Control": "no-store"
    });
    res.end();
    return;
  }

  if (!hasEntryAccess(req) && !hasDeviceAccess(req)) return sendLocked(res);

  if (req.url.startsWith("/api/push/register") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        if (!input.userId || !input.token) return sendJson(res, 400, {error: "Missing push token"});
        const store = readStore();
        const tokens = pushTokenList(store).filter(x => x.token !== input.token);
        tokens.unshift({userId: String(input.userId), role: String(input.role || ""), token: String(input.token), platform: String(input.platform || "web"), updatedAt: new Date().toISOString()});
        savePushTokens(store, tokens);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications")) {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const userId = url.searchParams.get("userId") || "";
      const role = url.searchParams.get("role") || "";
      const items = notificationList(readStore()).filter(n => !n.userId || n.userId === userId || (n.roles || []).includes(role)).slice(0, 80);
      return sendJson(res, 200, {notifications: items});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const store = readStore();
          const notifications = notificationList(store);
          const n = {id: `NTF-${Date.now()}`, title: String(input.title || "إشعار"), body: String(input.body || ""), userId: String(input.userId || ""), roles: Array.isArray(input.roles) ? input.roles : [], url: String(input.url || "/dashboard.html"), createdAt: new Date().toISOString(), readBy: []};
          notifications.unshift(n);
          saveNotifications(store, notifications);
          const tokens = pushTokenList(store).filter(t => !n.userId && !n.roles.length ? true : t.userId === n.userId || n.roles.includes(t.role));
          sendNativePush(tokens, n);
          sendJson(res, 200, {ok: true, notification: n});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
  }

  if (req.url.startsWith("/api/invite/current")) {
    const token = parseCookies(req.headers.cookie)[inviteCookie];
    const invite = inviteList(readStore()).find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
    return sendJson(res, 200, invite ? {invite: {targetRole: invite.targetRole, targetUserId: invite.targetUserId, label: invite.label}} : {invite: null});
  }

  if (req.url.startsWith("/api/device/authorize") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "").replace(/\D/g, "");
        const role = String(input.role || "");
        const deviceId = String(input.deviceId || "");
        if (!userId || !role || !deviceId) return sendJson(res, 400, {error: "Missing device data"});
        const store = readStore();
        const invites = inviteList(store);
        const token = parseCookies(req.headers.cookie)[inviteCookie];
        const invite = invites.find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
        const adminBootstrap = role === "admin" && userId === "2572280689" && hasEntryAccess(req);
        const roleAllowed = invite && (!invite.targetRole || invite.targetRole === role || invite.targetRole === "any");
        const userAllowed = invite && (!invite.targetUserId || invite.targetUserId === userId);
        if (!adminBootstrap && (!roleAllowed || !userAllowed)) return sendJson(res, 403, {error: "Invite does not match this user"});
        if (invite) {
          invite.used = Number(invite.used || 0) + 1;
          invite.lastUsedAt = new Date().toISOString();
          invite.boundUserId = userId;
          invite.boundRole = role;
        }
        saveInvites(store, invites);
        const deviceValue = `${userId}.${deviceId}.${sign(`${userId}:${deviceId}`)}`;
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": [`${deviceCookie}=${deviceValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`, `${entryCookie}=; Path=/; Max-Age=0`, `${inviteCookie}=; Path=/; Max-Age=0`]
        });
        res.end(JSON.stringify({ok: true}));
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/invites")) {
    if (req.method === "GET") {
      const invites = inviteList(readStore()).map(({token, ...invite}) => ({...invite, url: `${publicOrigin(req)}/invite/${token}`}));
      return sendJson(res, 200, {invites});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const now = Date.now();
          const creatorRole = String(input.createdByRole || "");
          const targetRole = String(input.targetRole || "client");
          const allowed = creatorRole === "admin" ? ["owner", "company_admin"] : ["owner", "company_admin"].includes(creatorRole) ? ["client"] : [];
          if (!allowed.includes(targetRole)) return sendJson(res, 403, {error: "Role is not allowed to create this invite"});
          const invite = createInvite(input);
          const store = readStore();
          const invites = inviteList(store).filter(x => Number(x.expiresAtMs || 0) > now && !x.revoked);
          invites.unshift(invite);
          saveInvites(store, invites);
          sendJson(res, 200, {...invite, url: `${publicOrigin(req)}/invite/${invite.token}`});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      const store = readStore();
      const invites = inviteList(store);
      const invite = invites.find(x => x.id === id);
      if (invite) invite.revoked = true;
      saveInvites(store, invites);
      return sendJson(res, 200, {ok: true});
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }

  if (req.url.startsWith("/api/storage")) {
    if (req.method === "GET") {
      const key = new URL(req.url, "http://localhost").searchParams.get("key");
      const store = readStore();
      if (key) return sendJson(res, 200, Object.prototype.hasOwnProperty.call(store, key) ? {key, value: store[key]} : {});
      return sendJson(res, 200, store);
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const {key, value, remove} = JSON.parse(body || "{}");
          if (!key) return sendJson(res, 400, {error: "Missing key"});
          const store = readStore();
          if (remove) delete store[key];
          else store[key] = value;
          writeStore(store);
          sendJson(res, 200, {ok: true});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }
  let urlPath = pathname;
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
  const store = readStore();
  const invites = inviteList(store);
  const invite = createInvite({label: "رابط تسجيل جهاز المشرف", targetRole: "admin", createdBy: "system", createdByName: "system", minutes: 10, maxUses: 1});
  invites.unshift(invite);
  saveInvites(store, invites);
  console.log(`Startup generated entry link: /invite/${invite.token}`);
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.PUBLIC_URL || "";
  if (keepAliveUrl) {
    setInterval(() => {
      fetch(`${keepAliveUrl.replace(/\/$/, "")}/health`).catch(() => {});
    }, 5 * 60 * 1000).unref?.();
    console.log(`Keep-alive health ping enabled for ${keepAliveUrl}`);
  }
  if (!process.env.SECRET_ENTRY_TOKEN) {
    console.log("Set SECRET_ENTRY_TOKEN on Render to keep entry sessions valid across restarts.");
  }
});
