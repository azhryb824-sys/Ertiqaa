"use strict";
const CACHE="shumoos-v2-shell-2";
const SHELL=["./","./index.html","./v2.css","./persistence.js","./v2.js","./manifest.json","../assets/shumoos-logo.png","../assets/fonts/Cairo-Regular.ttf","../assets/fonts/Cairo-SemiBold.ttf","../assets/fonts/Cairo-Bold.ttf"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("shumoos-v2-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{const url=new URL(event.request.url);if(event.request.method!=="GET"||url.pathname.startsWith("/api/"))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))))});
