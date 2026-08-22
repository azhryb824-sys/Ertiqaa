"use strict";

const {app, BrowserWindow, dialog, ipcMain} = require("electron");
const {spawn} = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const {synchronize} = require("./sync-engine.cjs");

let serverProcess, mainWindow, syncTimer, syncing = false;
let syncStatus = {state: "starting", lastSuccessAt: null, error: null, uploaded: 0, downloaded: 0};

function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
function loadJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function atomicJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive: true}); const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value), {mode: 0o600}); fs.renameSync(temp, file); }
async function waitForHealth(url) { for (let i = 0; i < 80; i += 1) { try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error("تعذر تشغيل خادم ارتقاء المحلي"); }

async function runSync(config) {
  if (syncing) return;
  syncing = true;
  syncStatus = {...syncStatus, state: "syncing", error: null};
  mainWindow?.webContents.send("desktop-sync-status", syncStatus);
  try {
    const baseline = loadJson(config.baselinePath, null)?.store || null;
    const result = await synchronize({...config, baseline});
    atomicJson(config.baselinePath, {store: result.store, revision: result.revision, syncedAt: new Date().toISOString()});
    syncStatus = {state: "online", lastSuccessAt: new Date().toISOString(), error: null, uploaded: result.uploaded, downloaded: result.downloaded};
  } catch (error) { syncStatus = {...syncStatus, state: "offline", error: error.message}; }
  finally { syncing = false; mainWindow?.webContents.send("desktop-sync-status", syncStatus); }
}

async function createWindow() {
  const dataDir = path.join(app.getPath("userData"), "data");
  const baselinePath = path.join(app.getPath("userData"), "sync-baseline.json");
  const token = process.env.DESKTOP_SYNC_TOKEN || "";
  const remoteUrl = String(process.env.ERTIQAA_REMOTE_URL || "https://ertiqaa.onrender.com").replace(/\/$/, "");
  if (!token) { dialog.showErrorBox("إعداد المزامنة ناقص", "يجب ضبط DESKTOP_SYNC_TOKEN لحماية قناة المزامنة."); return app.quit(); }
  const port = await freePort();
  const localUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [path.join(app.getAppPath(), "server.cjs")], {
    env: {...process.env, ELECTRON_RUN_AS_NODE: "1", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, STORAGE_PATH: path.join(dataDir, "storage.json"), STORAGE_FAILOVER_PATH: path.join(dataDir, "storage.failover.json"), ALLOW_EMPTY_STORAGE_INIT: "1", DESKTOP_SYNC_TOKEN: token, RENDER: "false"},
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  serverProcess.stdout.on("data", chunk => console.log(`[local] ${chunk}`.trim()));
  serverProcess.stderr.on("data", chunk => console.error(`[local] ${chunk}`.trim()));
  await waitForHealth(localUrl);
  const config = {localUrl, remoteUrl, token, baselinePath};
  await runSync(config);
  mainWindow = new BrowserWindow({width: 1440, height: 920, minWidth: 1024, minHeight: 700, show: false, autoHideMenuBar: true, backgroundColor: "#f4f7f6", icon: path.join(app.getAppPath(), "build", "icon.ico"), webPreferences: {preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false}});
  mainWindow.once("ready-to-show", () => mainWindow.show());
  await mainWindow.loadURL(`${localUrl}/login.html`);
  syncTimer = setInterval(() => runSync(config), 30000);
}

ipcMain.handle("desktop-sync-status", () => syncStatus);
app.whenReady().then(createWindow).catch(error => { dialog.showErrorBox("فشل تشغيل ارتقاء", error.message); app.quit(); });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (syncTimer) clearInterval(syncTimer); if (serverProcess && !serverProcess.killed) serverProcess.kill(); });
