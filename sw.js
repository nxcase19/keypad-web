const CACHE_NAME = "keypad-web-v3";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.json","./sw.js","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",(e)=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):Promise.resolve()))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",(e)=>{const req=e.request;e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(req.method==="GET"&&res.status===200){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{})}return res}).catch(()=>cached)))});

