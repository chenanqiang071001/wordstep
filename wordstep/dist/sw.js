const CACHE='wordstep-v3';
const ASSETS=['./','./index.html','./style.css','./v2.css','./app.js','./core.js','./senses.js','./words.json','./exam-papers.json','./manifest.webmanifest','./icon.svg','./licenses/ECDICT-LICENSE.txt','./licenses/QWERTY-LICENSE.txt'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wordstep-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(clients=>clients.forEach(c=>c.postMessage('OFFLINE_READY'))));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
