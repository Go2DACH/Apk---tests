/* IR-Pilot Service Worker – Offline-Cache (nur bei http/https aktiv). */
var CACHE = 'ir-pilot-v7';
var ASSETS = [
  './', './index.html', './dashboard.html', './css/app.css',
  './js/core.js', './js/native.js', './js/hosts.js', './js/sources.js', './js/cloud.js', './js/assistant.js', './js/selftest.js', './js/framework.js', './js/report.js', './js/tabletop.js', './js/app.js',
  './data/catalog.js', './data/playbooks.js', './data/comms.js',
  './data/toolkit.js', './data/questions.js',
  './manifest.webmanifest', './assets/icon.svg'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
