/* =====================================================================
   OFFLINE-DATA.JS  —  data aplikasi tersimpan di HP + pembaruan bertahap
   Muat SETELAH kotoba-app.js:   <script>__js('offline-data.js')</script>

   CARA KERJA
   1) Semua pemanggilan google.script.run.getXxx() dibungkus:
        online  -> ambil dari server, simpan salinannya di IndexedDB
        offline -> pakai salinan di HP (juga bila server lambat > 10 detik)
      Test pilihan ganda / tulis dibuat dari data kotoba yang tersimpan bila offline.
   2) "Unduh data offline": mengunduh semua kotoba, dokkai, kana, ujian, avatar
      sesuai kelas siswa (sekali saja, dengan tombol).
   3) Pembaruan BERTAHAP: version.json memuat nomor versi per bagian data, mis.
        { "version": "25", "data": { "kotoba:irodori": 2, "ujian:jlpt:N5": 3 } }
      Hanya bagian yang nomornya berubah yang diunduh ulang. "*" = ulang semua.
   4) Mendaftarkan sw.js (aplikasi offline) dan meminta sw.js memeriksa file yang berubah.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- pengaturan ---------------- */
  var DB_NAMA = 'kotoba-offline';
  var JENIS_BAB = { modul: 15, irodori: 18, irodori2: 18, kaigo: 19, konstruksi: 7, kotoba: 3 };
  var KONSTRUKSI_SUB = { 'Bab 5': ['土木', '建築', 'ライフライン'], 'Bab 6': ['土木', '建築'] };
  var TIDAK_DI_CACHE = ['getNotifikasi', 'getPapanPeringkat', 'getRiwayatBelajar'];   // data pribadi/real-time
  var JANGAN_SIMPAN = ['getQuizData'];                                                // acak: dibuat ulang tiap kali
  var LAMA_TUNGGU_MS = 10000;      // server lebih lambat dari ini -> pakai salinan di HP
  var AUTO_PERTAMA = false;        // true = unduhan pertama juga otomatis (tanpa menunggu tombol)
  var JEDA_CEK_MS = 10 * 60 * 1000;
  // Tambahan untuk modul lain (Kanji, Bunpou, dst.). Isi dengan nama fungsi server + argumennya:
  //   { id: 'kanji:N5', fn: 'getKanjiList', args: ['N5'] }
  var EKSTRA = [];
  // Penulisan (simpan progres, skor, pencapaian, dst.) yang ditahan di HP saat offline lalu dikirim otomatis saat online.
  var ANTRIAN = ['simpanSkor', 'simpanPencapaian', 'simpanLencanaKotoba', 'simpanAvatar', 'simpanHafal', 'tandaiNotifDibaca', 'logAktivitas'];
  // data "keadaan terakhir": entri lama dengan kunci sama diganti yang terbaru (indeks argumen yang jadi kunci)
  // fungsi yang tidak ada di sini (logAktivitas) = catatan kejadian, semuanya dikirim berurutan
  var KUNCI_ANTRIAN = { simpanSkor: [0], simpanPencapaian: [0], simpanAvatar: [0], tandaiNotifDibaca: [0], simpanHafal: [0, 1], simpanLencanaKotoba: [0, 1] };
  var BATAS_ANTRIAN = 300;         // maksimal entri tertahan
  var BATAS_COBA = 8;              // setelah gagal sebanyak ini entri dibuang

  var asli = window.google && google.script && google.script.run;
  if (!asli) return;

  function $(id) { return document.getElementById(id); }

  /* ---------------- IndexedDB ---------------- */
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB tidak tersedia')); return; }
      var r = indexedDB.open(DB_NAMA, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbP;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction('kv', mode), rq = fn(tx.objectStore('kv'));
        tx.oncomplete = function () { res(rq && rq.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function baca(k) { return idb('readonly', function (s) { return s.get(k); }).catch(function () { return undefined; }); }
  function tulis(k, v) { return idb('readwrite', function (s) { return s.put(v, k); }).catch(function () {}); }

  function kunci(fn, args) {
    args = args || [];
    if (fn === 'getUjian' && args[0] === 'jft') args = ['jft'];     // JFT tidak bergantung level
    return fn + '|' + JSON.stringify(args);
  }

  /* ---------------- membungkus google.script.run ---------------- */
  function langsung(fn, args, s, f) {
    var r = asli;
    if (s) r = r.withSuccessHandler(s);
    if (f) r = r.withFailureHandler(f);
    r[fn].apply(r, args);
  }
  function ambilServer(fn, args) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('Waktu habis')); }, 45000);
      langsung(fn, args,
        function (d) { clearTimeout(t); res(d); },
        function (e) { clearTimeout(t); rej(e || new Error('Gagal')); });
    });
  }

  function acak(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function daftarBab(jenis) {
    var n = JENIS_BAB[jenis] || 0, out = [];
    for (var i = 1; i <= n; i++) {
      var b = 'Bab ' + i;
      if (jenis === 'konstruksi' && KONSTRUKSI_SUB[b]) KONSTRUKSI_SUB[b].forEach(function (s) { out.push(b + ' - ' + s); });
      else out.push(b);
    }
    return out;
  }
  function kotobaOffline(jenis, bab) {
    if (bab !== 'Semua bab') return baca(kunci('getKotoba', [jenis, bab, 'Semua'])).then(function (c) { return c && c.d; });
    return Promise.all(daftarBab(jenis).map(function (b) { return baca(kunci('getKotoba', [jenis, b, 'Semua'])); })).then(function (arr) {
      var out = [];
      arr.forEach(function (c) { if (c && c.d && c.d.length) out = out.concat(c.d); });
      return out.length ? out : undefined;
    });
  }
  /* soal pilihan ganda dibuat dari kotoba tersimpan: type 0 = tampil kotoba+bacaan, jawab arti;
     type 1 = tampil arti, jawab kotoba */
  function kuisOffline(args) {
    return kotobaOffline(args[0], args[1]).then(function (items) {
      if (!items || !items.length) return undefined;
      var lim = args[2], n = (lim === 'Semua' || !lim) ? items.length : Math.min(parseInt(lim, 10) || 10, items.length);
      return acak(items.slice()).slice(0, n).map(function (it) {
        var tipe = Math.random() < 0.5 ? 0 : 1, benar = tipe === 0 ? it.arti : it.kotoba, seen = {}, lain = [];
        seen[benar] = 1;
        acak(items.slice()).forEach(function (x) {
          var v = tipe === 0 ? x.arti : x.kotoba;
          if (lain.length < 3 && v && !seen[v]) { seen[v] = 1; lain.push(v); }
        });
        return { type: tipe, kotoba: it.kotoba, carabaca: it.carabaca, arti: it.arti, pilihan: acak([benar].concat(lain)), kunci: benar };
      });
    });
  }
  function tulisOffline(args) {
    return kotobaOffline(args[0], args[1]).then(function (items) {
      if (!items) return undefined;
      var k = items.filter(function (x) { return x.kotoba !== x.carabaca; });
      return k.length ? k : items;
    });
  }
  function ambilOffline(fn, args) {
    if (fn === 'getQuizData') return kuisOffline(args);
    return baca(kunci(fn, args)).then(function (c) {
      if (c && c.d != null) return c.d;
      if (fn === 'getKotoba' && args[1] === 'Semua bab') return kotobaOffline(args[0], 'Semua bab');
      if (fn === 'getTulisKotoba') return tulisOffline(args);
      return undefined;
    });
  }

  function pesanOffline() {
    return new Error('Sedang offline dan data ini belum tersimpan di HP. Sambungkan internet sekali, atau unduh data offline di menu Setting.');
  }
  /* ---------------- antrian penulisan (offline -> kirim saat online) ---------------- */
  var rantai = Promise.resolve(), jumlahAntrian = 0, mengirim = false, jadwal = null, uid = 0;
  function kerja(fn) { var p = rantai.then(fn); rantai = p.catch(function () {}); return p; }   // satu per satu, anti tabrakan
  function setJumlah(a) { jumlahAntrian = a.length; S.antri = jumlahAntrian ? '📤 ' + jumlahAntrian + ' data belajar menunggu dikirim (otomatis terkirim saat online).' : ''; ui(); }
  function tambahAntrian(fn, args) {
    return kerja(function () {
      return baca('antrian').then(function (a) {
        a = a || [];
        var idx = KUNCI_ANTRIAN[fn], sig = null;
        if (idx) { sig = fn + '|' + idx.map(function (i) { return JSON.stringify(args[i]); }).join('|'); a = a.filter(function (x) { return x.sig !== sig; }); }
        a.push({ id: Date.now() + '-' + (++uid), sig: sig, fn: fn, args: args, t: Date.now(), n: 0 });
        if (a.length > BATAS_ANTRIAN) a = a.slice(-BATAS_ANTRIAN);
        return tulis('antrian', a).then(function () { setJumlah(a); });
      });
    });
  }
  function ubahAntrian(id, hapusIni) {
    return kerja(function () {
      return baca('antrian').then(function (a) {
        a = (a || []).filter(function (x) {
          if (x.id !== id) return true;
          if (hapusIni) return false;
          x.n = (x.n || 0) + 1; return x.n < BATAS_COBA;
        });
        return tulis('antrian', a).then(function () { setJumlah(a); });
      });
    });
  }
  function kirimSatu(x) {
    return new Promise(function (res) {
      var t = setTimeout(function () { res(false); }, 30000);
      langsung(x.fn, x.args, function () { clearTimeout(t); res(true); }, function () { clearTimeout(t); res(false); });
    });
  }
  function kirimAntrian() {
    if (mengirim || navigator.onLine === false) return;
    mengirim = true;
    function lanjut() {
      return kerja(function () { return baca('antrian'); }).then(function (a) {
        a = a || []; setJumlah(a);
        if (!a.length) return;
        var x = a[0];
        return kirimSatu(x).then(function (ok) {
          return ubahAntrian(x.id, ok).then(function () { if (ok) return lanjut(); jadwalKirim(30000); });
        });
      });
    }
    lanjut().catch(function () {}).then(function () { mengirim = false; });
  }
  function jadwalKirim(ms) { clearTimeout(jadwal); jadwal = setTimeout(kirimAntrian, ms || 1500); }
  function tulisAman(fn, args, s, f) {
    if (navigator.onLine === false) { tambahAntrian(fn, args); if (f) f(pesanOffline()); return; }
    langsung(fn, args, s, function (e) { tambahAntrian(fn, args).then(function () { jadwalKirim(15000); }); if (f) f(e); });
  }

  function panggil(fn, args, s, f) {
    if (ANTRIAN.indexOf(fn) >= 0) { tulisAman(fn, args, s, f); return; }
    if (!/^get/.test(fn) || TIDAK_DI_CACHE.indexOf(fn) >= 0) { langsung(fn, args, s, f); return; }
    var k = kunci(fn, args), selesai = false, timer = null;
    function dariCache(galat) {
      ambilOffline(fn, args).then(function (d) {
        if (selesai) return;
        if (d !== undefined) { selesai = true; clearTimeout(timer); if (s) s(d); }
        else if (galat) {
          selesai = true; clearTimeout(timer);
          if (f) f(galat);
          else if (window.tampilkanCustomAlert) tampilkanCustomAlert('Sedang offline 📴', galat.message || String(galat));
        }
      });
    }
    if (navigator.onLine === false) { dariCache(pesanOffline()); return; }
    timer = setTimeout(function () { dariCache(null); }, LAMA_TUNGGU_MS);
    langsung(fn, args, function (d) {
      if (d != null && JANGAN_SIMPAN.indexOf(fn) < 0) tulis(k, { d: d, t: Date.now() });
      if (selesai) return;
      selesai = true; clearTimeout(timer); if (s) s(d);
    }, function (err) {
      if (selesai) return;
      dariCache(err || pesanOffline());
    });
  }
  function buat(s, f) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { return buat(fn, f); };
        if (prop === 'withFailureHandler') return function (fn) { return buat(s, fn); };
        return function () { panggil(String(prop), Array.prototype.slice.call(arguments), s, f); };
      }
    });
  }
  try { google.script.run = buat(null, null); } catch (e) { return; }

  /* ---------------- daftar data yang diunduh ---------------- */
  function jenisBoleh() {
    var j = ['modul', 'irodori', 'irodori2'], k = (window.studentClass || '');
    if (k === 'Joycare') j.push('kaigo');
    else if (k === 'Joybridge') j.push('konstruksi');
    else if (k === 'Joyserve') j.push('kotoba');
    return j;
  }
  function daftarDataset() {
    var ds = [];
    jenisBoleh().forEach(function (j) {
      var p = [];
      daftarBab(j).forEach(function (b) {
        p.push({ fn: 'getKotoba', args: [j, b, 'Semua'] });
        if (j === 'irodori' || j === 'irodori2') p.push({ fn: 'getDokkai', args: [j, b] });
      });
      ds.push({ id: 'kotoba:' + j, p: p });
    });
    ds.push({ id: 'kana', p: [{ fn: 'getKana', args: [] }] });
    ds.push({ id: 'ujian:jft', p: [{ fn: 'getUjian', args: ['jft', 'N5'] }] });
    ['N5', 'N4', 'N3', 'N2', 'N1'].forEach(function (lv) { ds.push({ id: 'ujian:jlpt:' + lv, p: [{ fn: 'getUjian', args: ['jlpt', lv] }] }); });
    ds.push({ id: 'avatar', p: [{ fn: 'getDaftarAvatar', args: [] }] });
    EKSTRA.forEach(function (e) {
      var d = null;
      ds.forEach(function (x) { if (x.id === e.id) d = x; });
      if (!d) { d = { id: e.id, p: [] }; ds.push(d); }
      d.p.push({ fn: e.fn, args: e.args || [] });
    });
    return ds;
  }

  /* ---------------- status & tampilan ---------------- */
  var S = { app: '', data: '', antri: '', persen: -1, reload: false, sibuk: false, cek: 0 };
  function ui() {
    var teks = [S.app, S.data, S.antri].filter(Boolean).join('\n');
    ['off-ket-mod', 'off-ket-set'].forEach(function (id) { var e = $(id); if (e) e.textContent = teks; });
    ['off-bar-mod', 'off-bar-set'].forEach(function (id) {
      var e = $(id); if (!e) return;
      e.style.display = S.persen >= 0 ? 'block' : 'none';
      if (e.firstChild) e.firstChild.style.width = Math.max(0, S.persen) + '%';
    });
  }
  function pasangUi() {
    if (!$('off-css')) {
      var st = document.createElement('style'); st.id = 'off-css';
      st.textContent = '.off-ket{white-space:pre-line;font-size:12.5px;line-height:1.45;color:#64748b;text-align:left;margin:8px 0 4px}' +
        '.off-bar{display:none;height:6px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin:6px 0}' +
        '.off-bar i{display:block;height:100%;width:0;background:#0d9488;transition:width .25s}' +
        'html.dark .off-ket{color:#94a3b8}html.dark .off-bar{background:#334155}';
      document.head.appendChild(st);
    }
    var foot = document.querySelector('.upd2-foot');
    if (foot && !$('off-ket-mod')) {
      var w = document.createElement('div');
      w.innerHTML = '<div class="off-ket" id="off-ket-mod" role="button" onclick="OFFLINE.klik()"></div><div class="off-bar" id="off-bar-mod"><i></i></div>';
      foot.insertBefore(w, foot.firstChild);
    }
    var tab = $('tab-setting');
    if (tab && !$('off-kartu')) {
      var c = document.createElement('div');
      c.className = 'mm-card mm-teal'; c.id = 'off-kartu'; c.onclick = function () { OFFLINE.klik(); };
      c.innerHTML = '<span class="mm-ico">📴</span><span class="mm-txt"><b>Mode Offline</b><small>Unduh data agar bisa dipakai tanpa internet</small>' +
        '<span class="off-ket" id="off-ket-set"></span><span class="off-bar" id="off-bar-set"><i></i></span></span><span class="mm-arrow">›</span>';
      var rose = tab.querySelector('.mm-rose');
      tab.insertBefore(c, rose || null);
    }
    ui();
  }

  /* ---------------- pemeriksaan & unduhan bertahap ---------------- */
  function versiDari(m, id) {
    var d = (m && m.data) || {};
    return String(d[id] || 0) + '.' + String(d['*'] || 0);
  }
  function ambilManifest() {
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }
  function tglSingkat(t) {
    var d = new Date(t || Date.now()); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function periksa(opsi) {
    opsi = opsi || {};
    if (S.sibuk || !window.studentName) return;
    if (!opsi.paksa && Date.now() - S.cek < JEDA_CEK_MS) return;
    S.cek = Date.now();
    pasangUi();
    if (navigator.onLine === false) { S.data = 'Sedang offline. Memakai data yang tersimpan di HP.'; S.persen = -1; ui(); return; }
    S.sibuk = true; S.data = 'Memeriksa pembaruan data…'; S.persen = -1; ui();
    kirimKeSW();
    Promise.all([ambilManifest(), baca('meta')]).then(function (h) {
      var m = h[0] || {}, meta = h[1] || { pernah: false, versi: {}, t: 0 };
      var ds = daftarDataset();
      var perlu = ds.filter(function (d) { return opsi.semua || meta.versi[d.id] !== versiDari(m, d.id); });
      if (!perlu.length) {
        S.sibuk = false; S.persen = -1;
        S.data = 'Data offline sudah terbaru ✅' + (meta.t ? ' (' + tglSingkat(meta.t) + ')' : ''); ui(); return;
      }
      if (!meta.pernah && !opsi.paksa && !AUTO_PERTAMA) {
        S.sibuk = false; S.persen = -1;
        S.data = 'Data belum diunduh. Ketuk di sini untuk mengunduh agar aplikasi bisa dipakai offline.'; ui(); return;
      }
      return unduh(perlu, m, meta);
    }).catch(function (e) {
      S.sibuk = false; S.persen = -1; S.data = 'Gagal memeriksa pembaruan: ' + (e && e.message || e); ui();
    });
  }

  function unduh(perlu, m, meta) {
    var tugas = [], total = 0, selesai = 0, gagal = 0;
    perlu.forEach(function (d) { d.p.forEach(function (c) { tugas.push({ d: d, c: c }); }); });
    total = tugas.length;
    var sisaDs = {};
    perlu.forEach(function (d) { sisaDs[d.id] = { n: d.p.length, gagal: 0 }; });
    function tampil() {
      S.persen = Math.round(selesai / total * 100);
      S.data = 'Mengunduh pembaruan data… ' + selesai + '/' + total + (gagal ? ' (gagal ' + gagal + ')' : ''); ui();
    }
    tampil();
    var i = 0;
    function satu() {
      if (i >= tugas.length) return Promise.resolve();
      var t = tugas[i++];
      return ambilServer(t.c.fn, t.c.args).then(function (d) {
        return tulis(kunci(t.c.fn, t.c.args), { d: d, t: Date.now() });
      }).catch(function () { gagal++; sisaDs[t.d.id].gagal++; }).then(function () { selesai++; tampil(); }).then(satu);
    }
    return Promise.all([satu(), satu(), satu(), satu()]).then(function () {
      var baru = { pernah: true, versi: meta.versi || {}, t: Date.now() };
      perlu.forEach(function (d) { if (!sisaDs[d.id].gagal) baru.versi[d.id] = versiDari(m, d.id); });
      return tulis('meta', baru).then(function () {
        S.sibuk = false; S.persen = -1;
        S.data = gagal ? 'Sebagian data (' + gagal + ') gagal diunduh. Ketuk untuk mencoba lagi.' : 'Data offline sudah terbaru ✅ (' + tglSingkat(baru.t) + ')';
        ui();
        if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
      });
    });
  }

  /* ---------------- service worker (aplikasi offline) ---------------- */
  function kirimKeSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(function (r) {
      if (r.active) r.active.postMessage({ tipe: 'PERBARUI', build: window.APP_BUILD });
    }).catch(function () {});
  }
  function fmtByte(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function daftarSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.tipe !== 'sw-status') return;
      if (d.status === 'cek') S.app = 'Memeriksa pembaruan aplikasi…';
      else if (d.status === 'siap') {
        S.reload = true;
        S.app = 'Pembaruan aplikasi sudah diunduh (' + (d.diubah || []).length + ' file, ' + fmtByte(d.bytes || 0) + '). Ketuk di sini untuk memuat ulang.';
        if (window.questToast) questToast('⬇️ Pembaruan siap. Buka Setting > Mode Offline untuk memuat ulang.');
      }
      else if (d.status === 'terbaru') S.app = S.reload ? S.app : 'Aplikasi sudah versi terbaru ✅';
      else if (d.status === 'gagal') S.app = 'Pembaruan aplikasi gagal: ' + (d.pesan || '');
      ui();
    });
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ---------------- pintu masuk ---------------- */
  window.OFFLINE = {
    klik: function () {
      if (S.reload) { location.reload(); return; }
      periksa({ paksa: true });
    },
    periksa: periksa,
    segarkanSemua: function () { periksa({ paksa: true, semua: true }); },
    kirimAntrian: kirimAntrian,
    // hapus data unduhan; antrian yang belum terkirim tetap dipertahankan
    hapus: function () {
      return baca('antrian').then(function (a) {
        return idb('readwrite', function (s) { return s.clear(); }).then(function () { return a && a.length ? tulis('antrian', a) : null; });
      });
    }
  };
  // tombol "Download Update" di Info Update sekarang memperbarui aplikasi + data (bukan lagi cek APK).
  // Cek APK tetap ada di Setting > Cek Update Aplikasi.
  window.unduhDariInfoUpdate = function () { OFFLINE.klik(); };

  var asliInfo = window.tampilkanUpdateTerbaru;
  if (typeof asliInfo === 'function') {
    window.tampilkanUpdateTerbaru = function () {
      asliInfo.apply(this, arguments);
      pasangUi(); periksa({});
    };
  }
  // kembali online: kirim dulu progres yang tertahan, baru periksa pembaruan data
  window.addEventListener('online', function () { kirimAntrian(); periksa({ paksa: true }); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { kirimAntrian(); periksa({}); } });
  setInterval(function () { if (jumlahAntrian) kirimAntrian(); }, 60000);

  daftarSW();
  baca('antrian').then(function (a) { setJumlah(a || []); if (a && a.length) jadwalKirim(3000); });
  setTimeout(function () { pasangUi(); periksa({}); }, 2500);
})();
