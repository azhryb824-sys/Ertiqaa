const DEFAULT_URL = "https://ertiqaa.onrender.com/dashboard.html";
const STORAGE_KEY = "shumoosServerUrl";
const LAST_URL_KEY = "shumoosLastUrl";

const App = window.Capacitor?.Plugins?.App;
const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
const StatusBar = window.Capacitor?.Plugins?.StatusBar;
const Network = window.Capacitor?.Plugins?.Network;
const SplashScreen = window.Capacitor?.Plugins?.SplashScreen;

const setupPanel = document.getElementById("setupPanel");
const appView = document.getElementById("appView");
const form = document.getElementById("urlForm");
const input = document.getElementById("serverUrl");
const error = document.getElementById("urlError");
const frame = document.getElementById("appFrame");
const settingsButton = document.getElementById("settingsButton");

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.href.endsWith("/") ? `${url.href}dashboard.html` : url.href;
}

function setSetupVisible(visible) {
  setupPanel?.classList.toggle("hidden", !visible);
  appView?.classList.toggle("active", !visible);
  if (visible) setTimeout(() => input?.focus(), 120);
}

function openInApp(url) {
  if (!frame || !url) return;
  frame.src = url;
  setSetupVisible(false);
}

function saveAndOpen(rawUrl) {
  try {
    const normalized = normalizeUrl(rawUrl);
    localStorage.setItem(STORAGE_KEY, normalized);
    localStorage.setItem(LAST_URL_KEY, normalized);
    if (error) error.textContent = "";
    openInApp(normalized);
  } catch {
    if (error) error.textContent = "فضلاً أدخل رابطاً صحيحاً يبدأ بـ https:// أو اسم نطاق صحيح.";
  }
}

form?.addEventListener("submit", event => {
  event.preventDefault();
  saveAndOpen(input?.value);
});

settingsButton?.addEventListener("click", () => {
  if (input) input.value = localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
  setSetupVisible(true);
});

frame?.addEventListener("load", () => {
  try {
    const currentUrl = frame.contentWindow?.location?.href;
    if (currentUrl && currentUrl !== "about:blank") localStorage.setItem(LAST_URL_KEY, currentUrl);
  } catch {}
});

App?.addListener("appUrlOpen", event => openInApp(event.url));

async function registerPush() {
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();
  } catch {}
}

PushNotifications?.addListener("registration", token => {
  localStorage.setItem("shumoosPushToken", token.value);
});

PushNotifications?.addListener("pushNotificationActionPerformed", action => {
  openInApp(action.notification?.data?.url || localStorage.getItem(STORAGE_KEY) || DEFAULT_URL);
});

if (PushNotifications) registerPush().catch(() => {});

StatusBar?.setStyle({ style: "dark" });
StatusBar?.setBackgroundColor({ color: "#102d2c" });

Network?.addListener("networkStatusChange", status => {
  if (!status.connected && frame) {
    try {
      frame.contentWindow?.postMessage({ type: "network-offline" }, "*");
    } catch {}
  }
});

App?.addListener("backButton", () => {
  if (frame && frame.contentWindow?.history?.length > 1) {
    try { frame.contentWindow.history.back(); } catch {}
  } else {
    App?.exitApp?.();
  }
});

SplashScreen?.hide?.();

const storedUrl = localStorage.getItem(STORAGE_KEY);
if (storedUrl) {
  openInApp(localStorage.getItem(LAST_URL_KEY) || storedUrl);
} else {
  if (input) input.value = DEFAULT_URL;
  setSetupVisible(true);
}
