/* =====================================================================
   SERVICE WORKER KOTOBA JOYCARE
   - Aplikasi (index.html, css, js) disimpan di HP, jadi bisa dibuka tanpa internet.
   - Pembaruan BERTAHAP: tiap file dicek ke GitHub dengan ETag. File yang tidak berubah
     tidak diunduh ulang (server membalas 304, hampir tanpa data). Hanya file yang berubah yang diunduh.
   - Pembaruan bersifat semua-atau-tidak-sama-sekali, supaya tidak ada file versi lama dan baru bercampur.
   - Daftar file diambil otomatis dari index.html (__css('...') / __js('...')): file baru ikut terdaftar sendiri.
   Letakkan file ini di folder yang sama dengan index.html.
   ===================================================================== */
var VERSI_SW = 1;                       // naikkan bila isi sw.js ini diubah
var CACHE_SHELL = 'kotoba-shell-v1';
var CACHE_ASET = 'kotoba-aset-v1';
var SCOPE = self.registration.scope;
var URL_INDEX = new URL('index.html', SCOPE).href;

function mutlak(f) { return new URL(f, SCOPE).href; }

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(perbarui({ senyap: true }).catch(function() {}));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(ks) {
        return Promise.all(ks.filter(function(k) { return k !== CACHE_SHELL && k !== CACHE_ASET; })
          .map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

/* ---------- melayani permintaan ---------- */
self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;                         // Apps Script, Drive, YouTube, dll: biarkan langsung ke jaringan
  if (url.pathname.slice(-12) === 'version.json') return;             // selalu ambil yang terbaru dari jaringan
  if (url.pathname.slice(-6) === '/sw.js') return;
  if (req.headers.get('range')) return;                               // audio/video bertahap: jangan disimpan

  // halaman utama: dari simpanan (cepat & offline); jaringan hanya bila belum pernah tersimpan
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE_SHELL).then(function(c) {
        return c.match(URL_INDEX).then(function(hit) {
          return hit || fetch(req).catch(function() {
            return new Response('<meta charset="utf-8"><body style="font-family:sans-serif;padding:24px"><h3>Sedang offline</h3><p>Aplikasi belum tersimpan di HP ini. Sambungkan internet sekali, lalu buka lagi.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          });
        });
      })
    );
    return;
  }

  // file aplikasi (css/js): dari simpanan, tanpa melihat ?v=
  e.respondWith(
    caches.open(CACHE_SHELL).then(function(c) {
      return c.match(req, { ignoreSearch: true }).then(function(hit) {
        if (hit) return hit;
        return caches.open(CACHE_ASET).then(function(ca) {
          return ca.match(req, { ignoreSearch: true }).then(function(h2) {
            var jaringan = fetch(req).then(function(res) {
              if (res && res.ok) { var salin = res.clone(); e.waitUntil(ca.put(req, salin)); }
              return res;
            });
            if (h2) { e.waitUntil(jaringan.catch(function() {})); return h2; }   // gambar: tampilkan yang tersimpan, perbarui diam-diam
            return jaringan;
          });
        });
      });
    })
  );
});

/* ---------- pesan dari halaman ---------- */
self.addEventListener('message', function(e) {
  var d = e.data || {};
  if (d.tipe === 'PERBARUI') e.waitUntil(perbarui({ build: d.build }).catch(function() {}));
  if (d.tipe === 'SIMPAN_ASET') e.waitUntil(simpanAset(d.urls || []).catch(function() {}));
});

function siarkan(pesan) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(function(cs) {
    cs.forEach(function(c) { try { c.postMessage(pesan); } catch (x) {} });
  });
}

function daftarDariIndex(teks) {
  var h = ['index.html'], re = /__(?:css|js)\(\s*'([^']+)'\s*\)/g, m;
  while ((m = re.exec(teks))) if (h.indexOf(m[1]) < 0) h.push(m[1]);
  return h;
}

function hash(buf) {
  return crypto.subtle.digest('SHA-1', buf).then(function(b) {
    return Array.prototype.map.call(new Uint8Array(b), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  });
}

// cek satu file: kembalikan { url, res, bytes } bila berubah, atau null bila sama
function cekFile(cache, file) {
  var url = mutlak(file);
  return cache.match(url, { ignoreSearch: true }).then(function(lama) {
    var h = new Headers();
    if (lama) {
      if (lama.headers.get('etag')) h.set('If-None-Match', lama.headers.get('etag'));
      else if (lama.headers.get('last-modified')) h.set('If-Modified-Since', lama.headers.get('last-modified'));
    }
    return fetch(new Request(url, { headers: h, cache: 'no-store' })).then(function(res) {
      if (res.status === 304) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + file);
      var baru = res.clone();
      return baru.arrayBuffer().then(function(buf) {
        if (!lama) return { file: file, url: url, res: res, bytes: buf.byteLength };
        return lama.clone().arrayBuffer().then(function(bufLama) {
          if (bufLama.byteLength !== buf.byteLength) return { file: file, url: url, res: res, bytes: buf.byteLength };
          return Promise.all([hash(buf), hash(bufLama)]).then(function(hh) {
            return hh[0] === hh[1] ? null : { file: file, url: url, res: res, bytes: buf.byteLength };   // isi sama persis: tidak dihitung berubah
          });
        });
      });
    });
  });
}

var sedangPerbarui = null;
function perbarui(opsi) {
  if (sedangPerbarui) return sedangPerbarui;
  opsi = opsi || {};
  if (!opsi.senyap) siarkan({ tipe: 'sw-status', status: 'cek' });
  sedangPerbarui = caches.open(CACHE_SHELL).then(function(cache) {
    // 1) index.html dulu: dari situ daftar file yang lain diketahui
    return cekFile(cache, 'index.html').then(function(idx) {
      var teksPromise = idx ? idx.res.clone().text() : cache.match(URL_INDEX).then(function(r) { return r ? r.text() : ''; });
      return teksPromise.then(function(teks) {
        var daftar = daftarDariIndex(teks);
        var lain = daftar.filter(function(f) { return f !== 'index.html'; });
        return Promise.all(lain.map(function(f) { return cekFile(cache, f); })).then(function(hasil) {
          var diubah = (idx ? [idx] : []).concat(hasil.filter(Boolean));
          // 2) semua file berhasil dicek -> baru tulis (semua-atau-tidak-sama-sekali)
          return Promise.all(diubah.map(function(d) { return cache.put(d.url, d.res); })).then(function() {
            // 3) bersihkan file yang sudah tidak dipakai lagi
            return cache.keys().then(function(ks) {
              var dipakai = daftar.map(mutlak);
              return Promise.all(ks.filter(function(k) { return dipakai.indexOf(k.url) < 0; }).map(function(k) { return cache.delete(k); }));
            }).then(function() {
              var bytes = diubah.reduce(function(a, d) { return a + d.bytes; }, 0);
              var info = { tipe: 'sw-status', status: opsi.senyap ? 'terbaru' : (diubah.length ? 'siap' : 'terbaru'),
                diubah: diubah.map(function(d) { return d.file; }), total: daftar.length, bytes: bytes, build: opsi.build || null };
              return siarkan(info);
            });
          });
        });
      });
    });
  }).catch(function(err) {
    return siarkan({ tipe: 'sw-status', status: 'gagal', pesan: String(err && err.message || err) });
  }).then(function() { sedangPerbarui = null; });
  return sedangPerbarui;
}

// simpan gambar (bingkai, ikon gelar, dll) supaya tampil saat offline; yang sudah tersimpan dilewati
function simpanAset(urls) {
  return caches.open(CACHE_ASET).then(function(ca) {
    var total = urls.length, selesai = 0, i = 0;
    function satu() {
      if (i >= urls.length) return Promise.resolve();
      var u = mutlak(urls[i++]);
      return ca.match(u, { ignoreSearch: true }).then(function(hit) {
        if (hit) return;
        return fetch(u).then(function(r) { if (r.ok) return ca.put(u, r); });
      }).catch(function() {}).then(function() {
        selesai++;
        return siarkan({ tipe: 'sw-aset', selesai: selesai, total: total });
      }).then(satu);
    }
    return Promise.all([satu(), satu(), satu()]);
  });
}
