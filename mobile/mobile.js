const baseUrl = "https://ertiqaa.onrender.com";
const App = window.Capacitor?.Plugins?.App;
const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;

function openInApp(url) {
  if (!url) return;
  location.href = url.startsWith(baseUrl) ? url : `${baseUrl}/dashboard.html`;
}

App?.addListener("appUrlOpen", event => openInApp(event.url));

async function registerPush() {
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
}

PushNotifications?.addListener("registration", token => {
  localStorage.setItem("ertiqaaPushToken", token.value);
});

PushNotifications?.addListener("pushNotificationActionPerformed", action => {
  openInApp(action.notification?.data?.url || `${baseUrl}/dashboard.html`);
});

if (PushNotifications) registerPush().catch(() => {});
