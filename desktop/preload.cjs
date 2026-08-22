"use strict";
const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("ertiqaaDesktop", {isDesktop: true, getSyncStatus: () => ipcRenderer.invoke("desktop-sync-status"), onSyncStatus: callback => ipcRenderer.on("desktop-sync-status", (_event, status) => callback(status))});

window.addEventListener("DOMContentLoaded", () => {
  const badge = document.createElement("div");
  badge.id = "ertiqaaDesktopSyncBadge";
  badge.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:100000;padding:7px 12px;border-radius:20px;font:600 12px Cairo,Segoe UI,sans-serif;box-shadow:0 3px 14px #0002;background:#e8f0ee;color:#18302f;direction:rtl";
  document.body.appendChild(badge);
  const render = status => {
    const states = {starting: "تشغيل محلي", syncing: "جارٍ رفع البيانات…", online: "متصل · تمت المزامنة", offline: "دون اتصال · الحفظ محلي"};
    badge.textContent = states[status?.state] || "تطبيق سطح المكتب";
    badge.style.background = status?.state === "offline" ? "#fff0d9" : status?.state === "online" ? "#dff4eb" : "#e8f0ee";
    badge.title = status?.error || (status?.lastSuccessAt ? `آخر مزامنة: ${new Date(status.lastSuccessAt).toLocaleString("ar-SA")}` : "");
  };
  ipcRenderer.invoke("desktop-sync-status").then(render);
  ipcRenderer.on("desktop-sync-status", (_event, status) => render(status));
});
