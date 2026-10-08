/* ==================== KANJI CHALLENGE (modul tambahan) ====================
   Tahap 1–2 : tombol di menu Kanji + halaman utama
   Tahap 3–7 : Buat Room, Gabung Room, Room Code, Lobby, Avatar+Nama+Ready
   Tahap 8–25: Game Board, timer, giliran, kartu, kamus kotoba, validasi, hint, score, streak,
               PASS, semua-PASS, card replacement, usageCount, Victory
   Tahap 26–29: sinkron realtime, disconnect/reconnect, keluar di tengah game, main lagi
   Tahap 7b  : Lapisan data Firebase (Realtime Database + login anonim).
               Jika Firebase gagal dimuat, otomatis kembali ke mode uji (satu HP). */

var KC_MAKS = 3;
var KC_MIN = 2;
var KC_DURASI = [10, 20, 30];
var KC_LEVEL = ['N5', 'N4', 'N3', 'N2'];
var KC_HALAMAN = ['kanji-challenge-page', 'kc-buat-page', 'kc-gabung-page', 'kc-lobby-page', 'kc-game-page'];

var KC_FB_VER = '13.0.0';
var KC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdWVSNKlX1aYL7QDJXwwn6dO7iuHuSgg4",
  authDomain: "kanji-challange.firebaseapp.com",
  databaseURL: "https://kanji-challange-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kanji-challange",
  storageBucket: "kanji-challange.firebasestorage.app",
  messagingSenderId: "261799563542",
  appId: "1:261799563542:web:630d6e102f93e617214037",
  measurementId: "G-Z8YZV7P8T8"
};

var kcState = { code: '', unsub: null, sibuk: false };
var kcPilihan = { durasi: 10, level: 'N5' };
var kcFb = { uid: '', error: '', promise: null };
var kcLocalUid = '';

/* ---------- util ---------- */
function kcEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function kcTampil(idHalaman) {
  KC_HALAMAN.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== idHalaman);
  });
}
function kcUid() {
  if (kcFb.uid) return kcFb.uid;               // mode Firebase: pakai uid login anonim
  if (kcLocalUid) return kcLocalUid;
  var id = '';
  try { id = localStorage.getItem('kc_uid') || ''; } catch (e) {}
  if (!id) {
    id = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    try { localStorage.setItem('kc_uid', id); } catch (e) {}
  }
  kcLocalUid = id;
  return id;
}
function kcPemainSaya() {
  var nama = (typeof studentName !== 'undefined' && studentName) ? studentName : 'Pemain';
  var av = (typeof avatarId !== 'undefined' && avatarId) ? avatarId : '';
  return { id: kcUid(), name: nama, avatar: av, ready: false };
}
function kcAvatarHtml(av) {
  if (av && typeof urlAvatar === 'function') {
    return '<img src="' + kcEsc(urlAvatar(av, 120)) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'🙂\'))">';
  }
  return '🙂';
}
var kcRoomTerakhir = null, kcPollId = null, kcSinyalTerender = '', kcPollBusy = false;
function kcSinyal(r) {
  if (!r) return 'null';
  var g = r.game;
  return [r.status, r.hostId, r.players.map(function (p) { return p.id + ':' + (p.ready ? 1 : 0) + (p.online === false ? 'x' : ''); }).join(','), g ? (g.turnNo + '/' + g.seq + '/' + (g.resets || 0)) : ''].join('|');
}
// Jaring pengaman realtime: cek ke server tiap 1,5 dtk. Bandingkan dengan yang SUDAH BERHASIL TAMPIL
// (bukan yang sekadar diterima), sehingga bila render gagal sekali, akan dicoba lagi otomatis.
function kcMulaiPoll() {
  if (kcPollId || !kcDb.ambil) return;
  kcPollId = setInterval(function () {
    var c = kcState.code; if (!c || !kcDb.ambil || kcPollBusy) return;
    kcPollBusy = true;
    kcDb.ambil(c).then(function (r) {
      kcPollBusy = false;
      if (c !== kcState.code) return;
      if (kcSinyal(r) !== kcSinyalTerender) kcRoomUpdate(r);
    }).catch(function () { kcPollBusy = false; });
  }, 1500);
}
function kcBersihkanListener() {
  if (kcPollId) { clearInterval(kcPollId); kcPollId = null; }
  kcPollBusy = false; kcSinyalTerender = '';
  kcRoomTerakhir = null;
  if (typeof kcState.unsub === 'function') { try { kcState.unsub(); } catch (e) {} }
  kcState.unsub = null;
  kcResetGameLokal();
}
function kcGalat(kode, pesan) { var e = new Error(pesan); e.kode = kode; return e; }
function kcPesanError(e) {
  var m = e ? (String(e.code || '') + ' ' + String(e.message || '')) : '';
  if (/permission/i.test(m)) return 'Akses ditolak oleh aturan database Firebase (cek tab Rules).';
  if (/operation-not-allowed|admin-restricted/i.test(m)) return 'Login anonim belum diaktifkan di Firebase Authentication.';
  if (/network|offline|timeout|failed to fetch|dynamically imported/i.test(m)) return 'Koneksi internet bermasalah atau Firebase gagal dimuat.';
  return 'Terjadi kesalahan: ' + (e && e.message ? e.message : 'tidak diketahui');
}
var KC_ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa 0 O 1 I L supaya tidak membingungkan
function kcBuatKode() {
  var k = '';
  for (var i = 0; i < 5; i++) k += KC_ALFABET.charAt(Math.floor(Math.random() * KC_ALFABET.length));
  return k;
}

/* ---------- lapisan data A: MOCK (satu HP, cadangan) ---------- */
var kcDbMock = (function () {
  var rooms = {};
  var listeners = {};
  function salin(o) { return o ? JSON.parse(JSON.stringify(o)) : null; }
  function emit(code) {
    (listeners[code] || []).slice().forEach(function (fn) { fn(salin(rooms[code])); });
  }
  return {
    mode: 'mock',
    createRoom: function (opt) {
      return new Promise(function (ok) {
        var c;
        do { c = kcBuatKode(); } while (rooms[c]);
        var p = opt.player; p.joinedAt = Date.now();
        rooms[c] = { code: c, hostId: p.id, durasi: opt.durasi, level: opt.level,
                     maxPlayers: KC_MAKS, status: 'lobby', players: [p] };
        ok(c);
      });
    },
    joinRoom: function (code, player) {
      return new Promise(function (ok, gagal) {
        var r = rooms[code];
        if (!r) return gagal(kcGalat('NOT_FOUND', 'Room tidak ditemukan.'));
        var ada = r.players.some(function (x) { return x.id === player.id; });
        if (ada) return ok(code);
        if (r.status !== 'lobby') return gagal(kcGalat('STARTED', 'Game sudah dimulai.'));
        if (r.players.length >= r.maxPlayers) return gagal(kcGalat('FULL', 'Room sudah penuh.'));
        player.joinedAt = Date.now();
        r.players.push(player);
        emit(code);
        ok(code);
      });
    },
    listen: function (code, cb) {
      var aktif = true, off = null, ref = null;
      function pasang() {
        if (!aktif) return;
        off = A.onValue(rr(code), function (snap) {
          var r = normalisasi(snap.val(), code);
          cb(r);
          if (r && r.players.length && !r.players.some(function (p) { return p.id === r.hostId; })) {
            angkatHost(code, r.players);                       // host hilang -> pemain tertua jadi host
          }
        }, function () {                                       // listener dibatalkan server -> pasang ulang
          if (aktif) setTimeout(pasang, 1500);
        });
      }
      pasang();
      // koneksi putus lalu pulih (HP tidur / sinyal hilang) -> ambil data terbaru langsung
      var pulih = null, pernahOnline = false;
      try {
        pulih = A.onValue(A.ref(db, '.info/connected'), function (s) {
          if (s.val() === true) {
            if (pernahOnline && aktif) {
              A.get(rr(code)).then(function (sn) { if (aktif) cb(normalisasi(sn.val(), code)); }).catch(function () {});
            }
            pernahOnline = true;
          }
        });
      } catch (e) {}
      return function () {
        aktif = false;
        try { if (off) off(); } catch (e) {}
        try { if (pulih) pulih(); } catch (e) {}
      };
    },

    setReady: function (code, id, val) {
      var r = rooms[code]; if (!r) return;
      r.players.forEach(function (p) { if (p.id === id) p.ready = !!val; });
      emit(code);
    },
    leave: function (code, id) {                    // mode uji: satu HP, pemain lain hanya contoh -> room dihapus
      delete rooms[code];
      emit(code);
    },
    now: function () { return Date.now(); },
    tx: function (code, fn) {                       // transaksi: fn(room) -> room | null(hapus) | undefined(batal)
      return new Promise(function (ok) {
        var r = rooms[code]; if (!r) return ok({ committed: false });
        var out = fn(salin(r));
        if (out === undefined) return ok({ committed: false });
        if (out === null) delete rooms[code]; else rooms[code] = out;
        emit(code);
        ok({ committed: true });
      });
    },
    aktifkanGame: function () {},
    modeLobby: function () {},
    addDummy: function (code) {
      var r = rooms[code]; if (!r || r.players.length >= r.maxPlayers) return;
      var nama = ['Budi', 'Andi', 'Sari'][r.players.length - 1] || 'Tamu';
      r.players.push({ id: 'dummy' + r.players.length + Date.now(), name: nama, avatar: '', ready: false, joinedAt: Date.now() });
      emit(code);
    }
  };
})();

/* ---------- lapisan data B: FIREBASE Realtime Database ----------
   Struktur:  rooms/{code} = { code, hostId, durasi, level, maxPlayers, status, createdAt,
                               players: { uid: { id, name, avatar, ready, joinedAt } } }
   A  = modul firebase-database (ref, get, remove, set, runTransaction, onValue, onDisconnect)
   db = instance database */
function kcBuatDbFirebase(A, db) {
  function rr(code) { return A.ref(db, 'rooms/' + code); }
  function pr(code, id) { return A.ref(db, 'rooms/' + code + '/players/' + id); }
  function urut(a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); }
  var offset = 0, pantauUnsub = null, pantauKe = '';
  try { A.onValue(A.ref(db, '.info/serverTimeOffset'), function (s) { offset = s.val() || 0; }); } catch (e) {}

  // ubah data mentah Firebase menjadi bentuk yang dipakai tampilan (players = array berurutan)
  function normalisasi(r, code) {
    if (!r) return null;
    var pl = r.players || {};
    var arr = Object.keys(pl).map(function (k) { var p = pl[k]; if (p) p.id = p.id || k; return p; })
      .filter(function (p) { return p && p.name; });          // buang "pemain hantu" tanpa nama
    arr.sort(urut);
    r.players = arr;
    r.code = r.code || code;
    r.maxPlayers = r.maxPlayers || KC_MAKS;
    return r;
  }
  // set()/update() ke dalam room MEMBATALKAN transaksi room yang masih menunggu ("Error: set").
  // Maka tulisan non-transaksi ditunda sampai tidak ada transaksi yang berjalan.
  function saatAman(fn, n) {
    n = n || 0;
    if (typeof kcTxJalan !== 'undefined' && kcTxJalan > 0 && n < 50) { setTimeout(function () { saatAman(fn, n + 1); }, 200); return; }
    try { fn(); } catch (e) {}
  }
  function pasangDisconnect(code, id) {
    try { A.onDisconnect(pr(code, id)).remove().catch(function () {}); } catch (e) {}
  }
  function angkatHost(code, players) {
    if (!players.length) return;
    var ids = players.map(function (p) { return p.id; });
    var next = ids[0];
    return A.runTransaction(A.ref(db, 'rooms/' + code + '/hostId'), function (cur) {
      return (cur !== null && ids.indexOf(cur) !== -1) ? cur : next;
    }).catch(function () {});
  }

  return {
    mode: 'firebase',
    now: function () { return Date.now() + offset; },   // jam server -> timer sama di semua HP

    createRoom: function (opt) {
      var p = opt.player;
      function coba(n) {
        if (n >= 8) return Promise.reject(new Error('Gagal membuat kode room yang unik. Coba lagi.'));
        var c = kcBuatKode();
        p.joinedAt = Date.now();
        var obj = { code: c, hostId: p.id, durasi: opt.durasi, level: opt.level, maxPlayers: KC_MAKS,
                    status: 'lobby', createdAt: Date.now(), players: {} };
        obj.players[p.id] = p;
        return A.runTransaction(rr(c), function (cur) {
          return (cur === null || !cur.players) ? obj : undefined;   // kode terpakai -> batal, coba kode lain
        }).then(function (res) {
          if (!res.committed) return coba(n + 1);
          pasangDisconnect(c, p.id);
          return c;
        });
      }
      return coba(0);
    },

    joinRoom: function (code, player) {
      return A.get(rr(code)).then(function (snap) {
        var r = snap.val();
        if (!r || !r.players) throw kcGalat('NOT_FOUND', 'Room tidak ditemukan.');
        if (r.players[player.id]) { pasangDisconnect(code, player.id); return code; }
        if (r.status !== 'lobby') throw kcGalat('STARTED', 'Game sudah dimulai.');
        var penuh = false;
        player.joinedAt = Date.now();
        return A.runTransaction(A.ref(db, 'rooms/' + code + '/players'), function (pl) {
          penuh = false;
          pl = pl || {};
          if (pl[player.id]) return pl;
          if (Object.keys(pl).length >= KC_MAKS) { penuh = true; return undefined; }
          pl[player.id] = player;
          return pl;
        }).then(function () {
          if (penuh) throw kcGalat('FULL', 'Room sudah penuh.');
          pasangDisconnect(code, player.id);
          return code;
        });
      });
    },

    listen: function (code, cb) {
      return A.onValue(rr(code), function (snap) {
        var r = normalisasi(snap.val(), code);
        cb(r);
        if (r && r.players.length && !r.players.some(function (p) { return p.id === r.hostId; })) {
          angkatHost(code, r.players);                         // host hilang -> pemain tertua jadi host
        }
      }, function () { /* dibatalkan: abaikan */ });
    },

    setReady: function (code, id, val) {
      return new Promise(function (ok) { saatAman(function () { A.set(A.ref(db, 'rooms/' + code + '/players/' + id + '/ready'), !!val).catch(function () {}).then(ok); }); });
    },

    tx: function (code, fn) {
      return A.runTransaction(rr(code), function (cur) {
        if (cur === null) return undefined;            // cache belum siap / room hilang -> batal (jangan menghapus room)
        return fn(cur);
      }).then(function (res) { return { committed: !!res.committed }; })
        .catch(function (e) { return { committed: false, error: e || new Error('gagal') }; });
    },
    ambil: function (code) {                           // baca satu kali (cadangan bila listener realtime terlambat)
      return A.get(rr(code)).then(function (s) { return normalisasi(s.val(), code); });
    },

    // Saat game berjalan: koneksi putus => pemain ditandai offline (BUKAN dikeluarkan), bisa kembali dengan kode room.
    aktifkanGame: function (code, id) {
      if (pantauKe === code + '/' + id) return;
      if (pantauUnsub) { try { pantauUnsub(); } catch (e) {} pantauUnsub = null; }
      pantauKe = code + '/' + id;
      var onl = A.ref(db, 'rooms/' + code + '/players/' + id + '/online');
      try {
        A.onDisconnect(pr(code, id)).cancel().then(function () {
          A.onDisconnect(onl).set(false).catch(function () {});
        }).catch(function () {});
        pantauUnsub = A.onValue(A.ref(db, '.info/connected'), function (s) {
          if (s.val() === true) {
            saatAman(function () { A.set(onl, true).catch(function () {}); });
            A.onDisconnect(onl).set(false).catch(function () {});
          }
        });
      } catch (e) {}
    },
    // Kembali ke lobby (main lagi): putus = keluar dari room seperti semula.
    modeLobby: function (code, id) {
      if (pantauUnsub) { try { pantauUnsub(); } catch (e) {} pantauUnsub = null; }
      pantauKe = '';
      try {
        A.onDisconnect(pr(code, id)).cancel().then(function () { pasangDisconnect(code, id); }).catch(function () {});
        saatAman(function () { A.set(A.ref(db, 'rooms/' + code + '/players/' + id + '/online'), true).catch(function () {}); });
      } catch (e) {}
    },

    leave: function (code, id) {
      try { A.onDisconnect(pr(code, id)).cancel().catch(function () {}); } catch (e) {}
      if (pantauUnsub) { try { pantauUnsub(); } catch (e) {} pantauUnsub = null; }
      pantauKe = '';
      return A.runTransaction(rr(code), function (cur) {
        if (cur === null) return cur;
        return kcFnKeluar(id)(cur);               // hapus pemain, urus host & game; kosong -> room dihapus
      }).catch(function () {});
    }
  };
}

/* ---------- pemilih lapisan data ---------- */
var kcDb = kcDbMock;

function kcMuatFirebase() {
  var base = 'https://www.gstatic.com/firebasejs/' + KC_FB_VER + '/';
  return Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-database.js')
  ]).then(function (m) {
    var app = m[0].initializeApp(KC_FIREBASE_CONFIG);
    var auth = m[1].getAuth(app);
    var A = m[2];
    var db = A.getDatabase(app);
    return m[1].signInAnonymously(auth).then(function (cred) {
      kcFb.uid = cred.user.uid;
      kcFb.error = '';
      kcDb = kcBuatDbFirebase(A, db);
    });
  });
}

// Selalu berhasil (tidak pernah reject): kalau gagal, kcDb tetap mode uji dan kcFb.error berisi alasan.
function kcInitFirebase() {
  if (kcDb.mode === 'firebase') return Promise.resolve();
  if (kcFb.promise) return kcFb.promise;
  var batas = new Promise(function (_, gagal) {
    setTimeout(function () { gagal(new Error('timeout memuat Firebase')); }, 12000);
  });
  kcFb.promise = Promise.race([kcMuatFirebase(), batas]).catch(function (e) {
    kcFb.error = kcPesanError(e);
    kcDb = kcDbMock;
  }).then(function () { kcFb.promise = null; });   // boleh dicoba lagi pada panggilan berikutnya
  return kcFb.promise;
}

/* ---------- Halaman utama ---------- */
function kcBuka() {
  catatAktivitas('Kanji Challenge');
  kcInitFirebase();                                   // mulai sambungkan di latar belakang
  document.getElementById('kanji-main-page').classList.add('hidden');
  kcTampil('kanji-challenge-page');
}
function kcKembali() {
  kcTampil(null);
  document.getElementById('kanji-main-page').classList.remove('hidden');
}

/* ---------- Tahap 3 : Buat Room ---------- */
function kcBuatRoom() {
  kcRenderPilihan();
  kcTampil('kc-buat-page');
}
function kcRenderPilihan() {
  var d = document.getElementById('kc-pilih-durasi');
  var l = document.getElementById('kc-pilih-level');
  if (d) d.innerHTML = KC_DURASI.map(function (m) {
    return '<div class="kc-chip' + (kcPilihan.durasi === m ? ' on' : '') + '" onclick="kcSetDurasi(' + m + ')">' + m + ' menit</div>';
  }).join('');
  if (l) l.innerHTML = KC_LEVEL.map(function (v) {
    return '<div class="kc-chip' + (kcPilihan.level === v ? ' on' : '') + '" onclick="kcSetLevel(\'' + v + '\')">' + v + '</div>';
  }).join('');
}
function kcSetDurasi(m) { kcPilihan.durasi = m; kcRenderPilihan(); }
function kcSetLevel(v) { kcPilihan.level = v; kcRenderPilihan(); }

function kcBuatSekarang() {
  if (kcState.sibuk) return;
  kcState.sibuk = true;
  var btn = document.getElementById('kc-btn-buat');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyambungkan…'; }
  kcInitFirebase()
    .then(function () { return kcDb.createRoom({ durasi: kcPilihan.durasi, level: kcPilihan.level, player: kcPemainSaya() }); })
    .then(function (code) { kcMasukLobby(code); })
    .catch(function (e) { tampilkanCustomAlert('Gagal', kcPesanError(e)); })
    .then(function () { kcState.sibuk = false; if (btn) { btn.disabled = false; btn.textContent = 'BUAT ROOM'; } });
}

/* ---------- Tahap 4 : Gabung Room ---------- */
function kcGabungRoom() {
  var inp = document.getElementById('kc-kode-input');
  if (inp) inp.value = '';
  kcTampilError('');
  kcTampil('kc-gabung-page');
}
function kcTampilError(pesan) {
  var el = document.getElementById('kc-gabung-error');
  if (el) el.textContent = pesan || '';
}
function kcBersihkanKode(el) {
  el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  kcTampilError('');
}
function kcKodeEnter(ev) { if (ev && ev.key === 'Enter') kcGabungSekarang(); }

function kcGabungSekarang() {
  if (kcState.sibuk) return;
  var inp = document.getElementById('kc-kode-input');
  var code = inp ? inp.value.trim().toUpperCase() : '';
  if (code.length < 5) { kcTampilError('Masukkan 5 karakter Room Code.'); return; }
  kcState.sibuk = true;
  kcTampilError('Menyambungkan…');
  kcInitFirebase()
    .then(function () { return kcDb.joinRoom(code, kcPemainSaya()); })
    .then(function () { kcTampilError(''); kcMasukLobby(code); })
    .catch(function (e) { kcTampilError(e && e.kode ? e.message : kcPesanError(e)); })
    .then(function () { kcState.sibuk = false; });
}

/* ---------- Tahap 5–7 : Lobby ---------- */
function kcMasukLobby(code) {
  kcBersihkanListener();
  kcState.code = code;
  kcState.unsub = kcDb.listen(code, kcRoomUpdate);
  kcTampil('kc-lobby-page');
  kcMuatKamus();                                       // siapkan database kotoba di latar belakang
  kcMulaiPoll();
}

/* Penghubung: satu listener room -> tampilkan Lobby atau Game Board sesuai status room */
function kcRoomUpdate(room) {
  if (!kcState.code) return;
  kcRoomTerakhir = room;
  try {
    kcRoomUpdateInti(room);
    kcSinyalTerender = kcSinyal(room);               // hanya ditandai bila render berhasil
  } catch (e) {
    kcSinyalTerender = '';                           // gagal -> poll akan mencoba lagi
    try { console.error('[KC] gagal render room:', e); } catch (x) {}
  }
}
function kcRoomUpdateInti(room) {
  if (!room) { kcRoomTutup('Room sudah tidak tersedia.'); return; }
  var saya = kcUid();
  if (!room.players.some(function (p) { return p.id === saya; })) { kcRoomTutup('Kamu tidak lagi berada di room ini.'); return; }
  if (room.status === 'main' || room.status === 'selesai') { kcRenderGame(room); return; }
  if (kcAktifCode) {                                   // baru kembali dari game (main lagi)
    kcResetGameLokal();
    if (kcDb.modeLobby) kcDb.modeLobby(room.code, saya);
  }
  kcTampil('kc-lobby-page');
  kcRenderLobby(room);
}

function kcKeluarRoom() {
  var code = kcState.code;
  kcBersihkanListener();
  kcState.code = '';
  if (code) kcDb.leave(code, kcUid());
  kcTampil('kanji-challenge-page');
}

function kcRoomTutup(pesan) {
  kcBersihkanListener();
  kcState.code = '';
  tampilkanCustomAlert('Room ditutup', pesan, function () { kcTampil('kanji-challenge-page'); });
}

function kcRenderLobby(room) {
  if (!kcState.code) return;
  var body = document.getElementById('kc-lobby-body');
  if (!body) return;
  if (!room) { kcRoomTutup('Room sudah tidak tersedia.'); return; }

  var saya = kcUid();
  var sayaAda = room.players.some(function (p) { return p.id === saya; });
  if (!sayaAda) { kcRoomTutup('Kamu tidak lagi berada di room ini.'); return; }

  var adalahHost = room.hostId === saya;
  var jumlah = room.players.length;
  var siap = room.players.filter(function (p) { return p.ready; }).length;
  var semuaSiap = jumlah >= KC_MIN && siap === jumlah;
  var sayaReady = room.players.filter(function (p) { return p.id === saya; })[0].ready;
  var mock = kcDb.mode === 'mock';

  var h = '';
  h += '<div class="kc-room-box">';
  h += '  <div class="kc-room-label">ROOM CODE</div>';
  h += '  <div class="kc-room-code">' + kcEsc(room.code) + '</div>';
  h += '  <button id="kc-salin-btn" class="kc-salin" onclick="kcSalinKode()">📋 Salin</button>';
  h += '  <div class="kc-room-info">⏱ ' + room.durasi + ' menit &nbsp;•&nbsp; 🎖️ ' + kcEsc(room.level) + ' &nbsp;•&nbsp; 👥 ' + jumlah + '/' + room.maxPlayers + (mock ? '' : ' &nbsp;•&nbsp; 🟢 Online') + '</div>';
  h += '</div>';

  h += '<div class="kc-slots">';
  for (var i = 0; i < room.maxPlayers; i++) {
    var p = room.players[i];
    if (!p) {
      h += '<div class="kc-slot kosong"><div class="kc-av">＋</div><div class="kc-slot-info"><div class="kc-slot-nama">Slot kosong</div><div class="kc-slot-sub">Menunggu pemain…</div></div></div>';
      continue;
    }
    var dummy = String(p.id).indexOf('dummy') === 0;
    var klik = (mock && dummy) ? ' onclick="kcToggleDummy(\'' + kcEsc(p.id) + '\')"' : '';
    h += '<div class="kc-slot' + (p.ready ? ' ready' : '') + (p.id === saya ? ' saya' : '') + '"' + klik + '>';
    h += '  <div class="kc-av">' + kcAvatarHtml(p.avatar) + '</div>';
    h += '  <div class="kc-slot-info">';
    h += '    <div class="kc-slot-nama">' + kcEsc(p.name) + (p.id === saya ? ' <small>(kamu)</small>' : '') + '</div>';
    h += '    <div class="kc-slot-sub">Player ' + (i + 1) + (p.id === room.hostId ? ' • 👑 Host' : '') + '</div>';
    h += '  </div>';
    h += '  <div class="kc-badge ' + (p.ready ? 'on' : '') + '">' + (p.ready ? '✓ READY' : 'Belum') + '</div>';
    h += '</div>';
  }
  h += '</div>';

  var status;
  if (jumlah < KC_MIN) status = 'Menunggu minimal ' + (KC_MIN - jumlah) + ' pemain lagi…';
  else if (!semuaSiap) status = 'Menunggu semua pemain READY (' + siap + '/' + jumlah + ')';
  else status = '✅ Semua pemain siap!';
  h += '<div class="kc-status' + (semuaSiap ? ' ok' : '') + '">' + status + '</div>';

  h += '<button class="kc-big-btn' + (sayaReady ? ' kc-alt' : '') + '" onclick="kcToggleReady()">' + (sayaReady ? '✅ READY (ketuk untuk batal)' : '✋ READY') + '</button>';
  if (adalahHost) {
    h += '<button class="kc-big-btn kc-mulai" ' + (semuaSiap ? '' : 'disabled') + ' onclick="kcMulaiGame()">▶ MULAI GAME</button>';
  } else {
    h += '<div class="kc-tunggu-host">Game dimulai oleh Host setelah semua READY.</div>';
  }
  if (mock) {
    var alasan = kcFb.error ? '<br>⚠️ Firebase belum tersambung: ' + kcEsc(kcFb.error) : '';
    h += '<div class="kc-mock">🧪 <b>Mode uji (satu HP).</b> Room belum tersambung antar HP. Ketuk pemain contoh untuk mengubah status READY-nya.' + alasan
       + '<button class="kc-mock-btn" onclick="kcTambahDummy()">➕ Tambah pemain uji</button></div>';
  }
  body.innerHTML = h;
}

function kcToggleReady() {
  var code = kcState.code; if (!code) return;
  var sedang = document.querySelector('#kc-lobby-body .kc-slot.saya');
  var val = !(sedang && sedang.classList.contains('ready'));
  kcDb.setReady(code, kcUid(), val);
}
function kcToggleDummy(id) {
  var sl = document.querySelectorAll('#kc-lobby-body .kc-slot');
  for (var i = 0; i < sl.length; i++) {
    if (sl[i].getAttribute('onclick') && sl[i].getAttribute('onclick').indexOf("'" + id + "'") !== -1) {
      kcDb.setReady(kcState.code, id, !sl[i].classList.contains('ready'));
      return;
    }
  }
}
function kcTambahDummy() { if (kcDb.addDummy && kcState.code) kcDb.addDummy(kcState.code); }

function kcSalinKode() {
  var c = kcState.code; if (!c) return;
  function selesai() {
    var b = document.getElementById('kc-salin-btn');
    if (b) { b.textContent = '✅ Tersalin'; setTimeout(function () { b.textContent = '📋 Salin'; }, 1500); }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(c).then(selesai, function () {});
      return;
    }
  } catch (e) {}
  try {
    var t = document.createElement('textarea');
    t.value = c; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
    selesai();
  } catch (e) {}
}

/* =====================================================================
   KAMUS KOTOBA  (Tahap 13) — database adalah HAKIM GAME
   Sumber: getKanjiDaisukiData() (kotobaSet, pairsByLevel) + getReferensiKotoba() (cara baca, arti).
   Kalau Apps Script tidak ada (uji di luar aplikasi) -> memakai kamus contoh kecil. */
var kcKamus = { siap: false, sedang: null, contoh: false, kata: {}, baca: {}, arti: {}, byKey: {}, levelKata: {}, cache: {} };

var KC_CONTOH = ['日本|にほん|Jepang', '日本人|にほんじん|orang Jepang', '日本語|にほんご|bahasa Jepang', '学生|がくせい|pelajar', '先生|せんせい|guru',
  '学校|がっこう|sekolah', '大学|だいがく|universitas', '大学生|だいがくせい|mahasiswa', '小学校|しょうがっこう|sekolah dasar', '中学校|ちゅうがっこう|sekolah menengah pertama',
  '会社|かいしゃ|perusahaan', '会社員|かいしゃいん|karyawan', '社会|しゃかい|masyarakat', '会話|かいわ|percakapan', '電話|でんわ|telepon', '電車|でんしゃ|kereta listrik',
  '電気|でんき|listrik', '天気|てんき|cuaca', '元気|げんき|sehat', '食事|しょくじ|makan', '毎日|まいにち|setiap hari', '毎年|まいとし|setiap tahun', '今日|きょう|hari ini',
  '今年|ことし|tahun ini', '今月|こんげつ|bulan ini', '先月|せんげつ|bulan lalu', '先週|せんしゅう|minggu lalu', '来年|らいねん|tahun depan', '来月|らいげつ|bulan depan',
  '来週|らいしゅう|minggu depan', '人口|じんこう|jumlah penduduk', '外国|がいこく|luar negeri', '外国人|がいこくじん|orang asing', '国語|こくご|bahasa nasional',
  '英語|えいご|bahasa Inggris', '時間|じかん|waktu', '家族|かぞく|keluarga', '旅行|りょこう|perjalanan', '新聞|しんぶん|koran', '空気|くうき|udara', '水道|すいどう|air ledeng', '学年|がくねん|tingkat kelas'];

function kcKunci(arr) { return arr.slice().sort().join(''); }
function kcKataKanji(w) { return typeof w === 'string' && w.length >= 2 && w.length <= 3 && /^[\u4e00-\u9fff々]+$/.test(w); }

function kcBangunKamus(data) {
  var K = { kata: {}, baca: {}, arti: {}, byKey: {}, levelKata: data.pairsByLevel || {}, cache: {} };
  function tambah(w) {
    if (!kcKataKanji(w) || K.kata[w]) return;
    K.kata[w] = 1;
    var k = kcKunci(w.split(''));
    (K.byKey[k] = K.byKey[k] || []).push(w);
  }
  (data.kotobaSet || []).forEach(tambah);
  (data.referensi || []).forEach(function (it) {
    if (!it || !it.kotoba) return;
    tambah(it.kotoba);
    if (kcKataKanji(it.kotoba)) { K.baca[it.kotoba] = it.caraBaca || ''; K.arti[it.kotoba] = it.arti || ''; }
  });
  kcKamus.kata = K.kata; kcKamus.baca = K.baca; kcKamus.arti = K.arti;
  kcKamus.byKey = K.byKey; kcKamus.levelKata = K.levelKata; kcKamus.cache = {};
}

function kcMuatKamus() {
  if (kcKamus.siap) return Promise.resolve();
  if (kcKamus.sedang) return kcKamus.sedang;
  var punyaGas = (typeof google !== 'undefined') && google.script && google.script.run;
  var data = { kotobaSet: [], pairsByLevel: {}, referensi: [] };

  function ambilDaisuki() {
    return new Promise(function (res) {
      if (typeof kdDataLoaded !== 'undefined' && kdDataLoaded) {      // sudah dimuat oleh Kanji Daisuki Games
        data.kotobaSet = Object.keys(kdKotobaSet || {}); data.pairsByLevel = kdPairsByLevel || {};
        return res();
      }
      if (!punyaGas) return res();
      google.script.run.withSuccessHandler(function (d) {
        data.kotobaSet = (d && d.kotobaSet) || []; data.pairsByLevel = (d && d.pairsByLevel) || {};
        res();
      }).withFailureHandler(function () { res(); }).getKanjiDaisukiData();
    });
  }
  function ambilReferensi() {
    return new Promise(function (res) {
      if (typeof referensiKotobaLoaded !== 'undefined' && referensiKotobaLoaded) { data.referensi = referensiKotobaData || []; return res(); }
      if (!punyaGas) return res();
      google.script.run.withSuccessHandler(function (d) { data.referensi = d || []; res(); })
        .withFailureHandler(function () { res(); }).getReferensiKotoba();
    });
  }
  var batas = new Promise(function (res) { setTimeout(res, 25000); });
  kcKamus.sedang = Promise.race([Promise.all([ambilDaisuki(), ambilReferensi()]), batas]).then(function () {
    kcBangunKamus(data);
    if (!Object.keys(kcKamus.kata).length) {                            // database kosong/tidak ada -> kamus contoh
      var cth = { kotobaSet: [], pairsByLevel: {}, referensi: [] }, sem = [];
      KC_CONTOH.forEach(function (s) { var p = s.split('|'); cth.kotobaSet.push(p[0]); cth.referensi.push({ kotoba: p[0], caraBaca: p[1], arti: p[2] }); if (p[0].length === 2) sem.push(p[0]); });
      KC_LEVEL.forEach(function (v) { cth.pairsByLevel[v] = sem; });
      kcBangunKamus(cth);
      kcKamus.contoh = true;
    } else { kcKamus.contoh = false; }
    kcKamus.siap = true;
    kcKamus.sedang = null;
  });
  return kcKamus.sedang;
}

// Cari kotoba yang tersusun dari kanji-kanji ini (urutan bebas, yang penting ADA di database).
// Kotoba yang SUDAH TERJAWAB (solved) tidak dihitung lagi -> tidak ada pengulangan.
// Prioritas: urutan Random Kanji dulu lalu urutan ketukan; kalau tidak ada, urutan lain yang valid & belum terjawab.
function kcCari(chars, solved) {
  var list = kcKamus.byKey[kcKunci(chars)];
  if (!list || !list.length) return null;
  solved = solved || {};
  var pas = chars.join('');
  if (list.indexOf(pas) >= 0 && !solved[pas]) return pas;
  for (var i = 0; i < list.length; i++) if (!solved[list[i]]) return list[i];
  return null;
}
function kcSudahTerjawab(chars, solved) {            // kotoba ada di database, tapi semua susunannya sudah pernah dijawab
  var list = kcKamus.byKey[kcKunci(chars)];
  return !!(list && list.length && !kcCari(chars, solved));
}
function kcBisaLanjut(total, sisaTangan, solved) {   // HINT: masih bisa jadi kotoba lebih panjang (yang belum terjawab)?
  if (total.length >= 3) return false;
  var seen = {};
  for (var i = 0; i < sisaTangan.length; i++) {
    var h = sisaTangan[i];
    if (seen[h]) continue; seen[h] = 1;
    if (kcCari(total.concat([h]), solved)) return true;
  }
  return false;
}

function kcLevelData(level) {
  if (kcKamus.cache[level]) return kcKamus.cache[level];
  var daftar = (kcKamus.levelKata[level] || []).filter(function (w) { return kcKamus.kata[w]; });
  if (!daftar.length) daftar = Object.keys(kcKamus.kata).filter(function (w) { return w.length === 2; });
  var set = {}, chars = [];
  daftar.forEach(function (w) { for (var i = 0; i < w.length; i++) { var c = w.charAt(i); if (!set[c]) { set[c] = 1; chars.push(c); } } });
  var mitra = {}, pairs = [];
  Object.keys(kcKamus.kata).forEach(function (w) {
    if (w.length !== 2) return;
    var a = w.charAt(0), b = w.charAt(1);
    if (a === b || !set[a] || !set[b]) return;
    pairs.push(w);
    (mitra[a] = mitra[a] || []); if (mitra[a].indexOf(b) < 0) mitra[a].push(b);
    (mitra[b] = mitra[b] || []); if (mitra[b].indexOf(a) < 0) mitra[b].push(a);
  });
  var d = { chars: chars, mitra: mitra, pairs: pairs, utama: chars.filter(function (c) { return mitra[c] && mitra[c].length; }) };
  kcKamus.cache[level] = d;
  return d;
}

/* =====================================================================
   MESIN GAME (Tahap 9–25) — fungsi murni yang dijalankan di dalam transaksi.
   Struktur room.game:
   { level, order[uid], turn, turnNo, kanji, passes, seq, sel[], tMulai, batas, mulai, akhir,
     hands{uid:[kanji]}, scores{uid}, streaks{uid}, need{uid}, usage{kanji:n}, last{...} } */
var KC_KARTU = 4;                    // kartu di tangan
var KC_GILIRAN_DETIK = 60;           // batas waktu satu giliran (lewat -> otomatis PASS)
var KC_OFFLINE_DETIK = 8;            // pemain offline dilewati setelah ini
var KC_DENDA_SALAH = 1;              // poin yang dikurangi setiap pilihan kartu salah (skor tidak turun di bawah 0)
var KC_RESET_MAKS = 3;                // jumlah reset kartu per giliran
var KC_GANTI_KANJI_SETELAH_BENAR = true;   // true: setelah ada yang benar, Random Kanji diganti baru

function kcArr(x) {
  if (!x) return [];
  var a = Array.isArray(x) ? x : Object.keys(x).sort(function (p, q) { return p - q; }).map(function (k) { return x[k]; });
  return a.filter(function (v) { return v !== null && v !== undefined && v !== ''; });
}
function kcObj(x) { return (x && typeof x === 'object') ? x : {}; }
function kcPlayersArr(r) {
  var pl = r.players, arr;
  if (Array.isArray(pl)) arr = pl.slice();
  else arr = Object.keys(kcObj(pl)).map(function (k) { var p = pl[k]; if (p && !p.id) p.id = k; return p; });
  arr = arr.filter(function (p) { return p && p.name; });
  arr.sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
  return arr;
}
function kcHapusPemain(r, id) {
  if (Array.isArray(r.players)) r.players = r.players.filter(function (p) { return p.id !== id; });
  else if (r.players) delete r.players[id];
}
function kcNormG(g) {
  g.order = kcArr(g.order); g.sel = kcArr(g.sel);
  g.hands = kcObj(g.hands); g.usage = kcObj(g.usage); g.scores = kcObj(g.scores);
  g.streaks = kcObj(g.streaks); g.need = kcObj(g.need);
  g.solved = kcObj(g.solved); g.shown = kcObj(g.shown);
  g.order.forEach(function (id) { g.hands[id] = kcArr(g.hands[id]); g.scores[id] = g.scores[id] || 0; g.streaks[id] = g.streaks[id] || 0; g.need[id] = g.need[id] || 0; });
  g.resets = g.resets || 0; g.passes = g.passes || 0; g.seq = g.seq || 0; g.turnNo = g.turnNo || 1;
  return g;
}
function kcPilih(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function kcNow() { return kcDb.now ? kcDb.now() : Date.now(); }

function kcPunyaPasangan(g, kanji, c) {                // kanji + c masih membentuk kotoba yang BELUM terjawab?
  return !!kcCari([kanji, c], g.solved);
}
function kcKartuHidup(g) {                             // kanji yang masih punya minimal 1 kotoba belum terjawab
  var d = kcLevelData(g.level);
  return d.chars.filter(function (c) {
    var m = d.mitra[c] || [];
    for (var i = 0; i < m.length; i++) if (kcPunyaPasangan(g, c, m[i])) return true;
    return false;
  });
}
function kcPoolAktif(g) { return kcKartuHidup(g); }
function kcSisaKotoba(g) {                             // sisa kotoba (di referensi level ini) yang belum terjawab
  var sv = g.solved || {};
  return kcLevelData(g.level).pairs.filter(function (w) { return !sv[w]; }).length;
}

// Random Kanji: (1) masih punya kotoba belum terjawab, (2) punya PASANGAN di tangan pemain yang sedang giliran,
// (3) dipilih dari yang paling jarang muncul -> tidak berulang-ulang.
function kcKanjiBaru(g, uid) {
  var d = kcLevelData(g.level), tangan = (uid && g.hands[uid]) || [], cand = {};
  tangan.forEach(function (c) {
    (d.mitra[c] || []).forEach(function (m) { if (m !== g.kanji && kcPunyaPasangan(g, m, c)) cand[m] = 1; });
  });
  var kand = Object.keys(cand);
  if (!kand.length) kand = kcKartuHidup(g).filter(function (c) { return c !== g.kanji; });
  if (!kand.length) kand = kcKartuHidup(g);
  if (!kand.length) return '';                         // semua kotoba sudah terjawab
  var min = Infinity;
  kand.forEach(function (c) { min = Math.min(min, g.shown[c] || 0); });
  var k = kcPilih(kand.filter(function (c) { return (g.shown[c] || 0) === min; }));
  g.shown[k] = (g.shown[k] || 0) + 1;
  return k;
}

// Tarik 1 kartu: hanya kanji yang masih "hidup", TIDAK kembar dengan kartu di tangan, dan yang paling jarang dibagikan.
function kcAmbilKartu(g, tangan, hindari) {
  var hidup = kcKartuHidup(g);
  if (!hidup.length) return null;
  tangan = tangan || []; hindari = hindari || [];
  var pool = hidup.filter(function (c) { return tangan.indexOf(c) < 0 && hindari.indexOf(c) < 0; });
  if (!pool.length) pool = hidup.filter(function (c) { return tangan.indexOf(c) < 0; });
  if (!pool.length) pool = hidup;
  var min = Infinity;
  pool.forEach(function (c) { min = Math.min(min, g.usage[c] || 0); });
  var c = kcPilih(pool.filter(function (x) { return (g.usage[x] || 0) === min; }));
  g.usage[c] = (g.usage[c] || 0) + 1;
  return c;
}

// Pastikan Random Kanji punya pasangan di tangan pemain ini. Kalau belum: tukar 1 kartu (kembar diutamakan) dengan kartu pasangan.
// Kalau Random Kanji sudah tidak punya kotoba tersisa: ganti Random Kanji. Return false jika semua kotoba sudah habis.
function kcPastikanPasangan(g, uid) {
  var tangan = g.hands[uid]; if (!tangan) return true;
  var d = kcLevelData(g.level);
  function pasangan() { return g.kanji ? (d.mitra[g.kanji] || []).filter(function (c) { return kcPunyaPasangan(g, g.kanji, c); }) : []; }
  var mitra = pasangan();
  if (!mitra.length) { g.kanji = kcKanjiBaru(g, uid); if (!g.kanji) return false; mitra = pasangan(); }
  if (tangan.some(function (c) { return mitra.indexOf(c) >= 0; })) return true;
  if (!mitra.length) return true;
  var min = Infinity;
  mitra.forEach(function (c) { min = Math.min(min, g.usage[c] || 0); });
  var p = kcPilih(mitra.filter(function (c) { return (g.usage[c] || 0) === min; }));
  g.usage[p] = (g.usage[p] || 0) + 1;
  if (tangan.length < KC_KARTU) { tangan.push(p); return true; }
  var ix = -1;
  for (var i = 0; i < tangan.length; i++) if (tangan.indexOf(tangan[i]) !== i) { ix = i; break; }   // kartu kembar dulu
  if (ix < 0) ix = Math.floor(Math.random() * tangan.length);
  g.usage[tangan[ix]] = Math.max(0, (g.usage[tangan[ix]] || 0) - 1);
  tangan[ix] = p;
  return true;
}
function kcSetGiliran(g, id) {                         // pindah giliran + bagikan kartu pengganti yang tertunda
  g.turn = id; g.turnNo++; g.sel = []; g.resets = 0;
  var now = kcNow(); g.tMulai = now; g.batas = now + KC_GILIRAN_DETIK * 1000;
  var n = g.need[id] || 0;
  while (n > 0 && g.hands[id].length < KC_KARTU) { var c = kcAmbilKartu(g, g.hands[id]); if (!c) break; g.hands[id].push(c); n--; }
  g.need[id] = 0;
  if (!kcPastikanPasangan(g, id)) g.habis = true;      // Random Kanji selalu punya pasangan di tangan pemain yg giliran
}
function kcGiliranBerikut(g) { return g.order[(g.order.indexOf(g.turn) + 1) % g.order.length]; }

function kcEngInit(ids, durasi, level, now) {
  var g = { level: level, order: ids.slice(), usage: {}, solved: {}, shown: {}, hands: {}, scores: {}, streaks: {}, need: {},
            passes: 0, turnNo: 0, seq: 0, sel: [], kanji: '', mulai: now, akhir: now + durasi * 60000 };
  g.pertama = kcPilih(ids);                            // pemain pertama RANDOM
  ids.forEach(function (id) {
    g.hands[id] = []; g.scores[id] = 0; g.streaks[id] = 0; g.need[id] = 0;
    for (var i = 0; i < KC_KARTU; i++) { var c = kcAmbilKartu(g, g.hands[id]); if (c) g.hands[id].push(c); }
  });
  g.kanji = kcKanjiBaru(g, g.pertama);                 // Random Kanji pertama: pasti ada pasangannya di tangan pemain pertama
  kcSetGiliran(g, g.pertama);
  return g;
}

function kcFnMulai(uid) {
  return function (r) {
    if (r.status !== 'lobby' || r.hostId !== uid || !kcKamus.siap) return undefined;
    var pl = kcPlayersArr(r);
    if (pl.length < KC_MIN || pl.length > KC_MAKS) return undefined;
    if (!pl.every(function (p) { return p.ready; })) return undefined;
    r.game = kcEngInit(pl.map(function (p) { return p.id; }), r.durasi, r.level, kcNow());
    r.status = 'main';
    return r;
  };
}
function kcSiapAksi(r, uid, now) {                     // pemain tidak aktif / game selesai TIDAK boleh mengubah state
  if (!r.game || r.status !== 'main') return null;
  var g = kcNormG(r.game);
  if (g.turn !== uid || now >= g.akhir) return null;
  return g;
}
function kcFnGerak(uid, kartu) {
  return function (r) {
    var now = kcNow(), g = kcSiapAksi(r, uid, now);
    if (!g || !kartu || !kartu.length || kartu.length > 2) return undefined;
    var tangan = g.hands[uid].slice();
    for (var i = 0; i < kartu.length; i++) {
      var ix = tangan.indexOf(kartu[i]);
      if (ix < 0) return undefined;                    // kartu tidak dimiliki
      tangan.splice(ix, 1);
    }
    var kata = kcCari([g.kanji].concat(kartu), g.solved);   // VALIDASI oleh database (kotoba yang sudah terjawab ditolak)
    if (!kata) return undefined;
    var streak = (g.streaks[uid] || 0) + (kartu.length === 2 ? 2 : 1);   // 3 kanji = streak +2
    var poin = streak * 2;
    g.solved[kata] = 1;                                // kotoba ini sudah terpakai -> tidak muncul/valid lagi
    g.hands[uid] = tangan;
    g.scores[uid] += poin; g.streaks[uid] = streak;
    while (g.hands[uid].length < KC_KARTU) { var cb = kcAmbilKartu(g, g.hands[uid]); if (!cb) break; g.hands[uid].push(cb); }   // kartu pengganti langsung dibagikan (tidak kembar)
    g.seq++;
    g.last = { seq: g.seq, turnNo: g.turnNo, uid: uid, tipe: 'benar', kata: kata, baca: kcKamus.baca[kata] || '', arti: kcKamus.arti[kata] || '', poin: poin, streak: streak };
    g.passes = 0;
    if (KC_GANTI_KANJI_SETELAH_BENAR) g.kanji = kcKanjiBaru(g, uid);
    if (!kcPastikanPasangan(g, uid)) g.habis = true;
    if (g.habis) r.status = 'selesai';                 // semua kotoba sudah terjawab
    g.sel = [];                                        // pemain TETAP di gilirannya: boleh menjawab lagi sampai menekan PASS
    g.tMulai = now; g.batas = now + KC_GILIRAN_DETIK * 1000;
    return r;
  };
}
function kcFnSalah(uid, teks) {
  return function (r) {
    var g = kcSiapAksi(r, uid, kcNow());
    if (!g) return undefined;
    var denda = Math.min(KC_DENDA_SALAH, g.scores[uid] || 0);      // kurangi poin, tidak sampai minus
    g.scores[uid] = (g.scores[uid] || 0) - denda;
    g.streaks[uid] = 0; g.sel = []; g.seq++;
    g.last = { seq: g.seq, turnNo: g.turnNo, uid: uid, tipe: 'salah', kata: teks || '', denda: denda };
    return r;
  };
}
function kcFnSel(uid, chars) {
  return function (r) {
    var g = kcSiapAksi(r, uid, kcNow());
    if (!g) return undefined;
    g.sel = chars.slice(0, 2);
    return r;
  };
}
function kcFnPass(uid, mode, turnNo) {                 // mode: manual | waktu | bot
  return function (r) {
    var now = kcNow(), g = kcSiapAksi(r, uid, now);
    if (!g) return undefined;
    if (mode !== 'manual') {
      if (g.turnNo !== turnNo) return undefined;
      var bt = g.batas;
      if (mode === 'bot') bt = g.tMulai + 1500;
      else {
        var pa = kcPlayersArr(r).filter(function (x) { return x.id === uid; })[0];
        if (pa && pa.online === false) bt = Math.min(bt, g.tMulai + KC_OFFLINE_DETIK * 1000);
      }
      if (now < bt) return undefined;
    }
    g.streaks[uid] = 0; g.passes++; g.seq++;
    g.last = { seq: g.seq, turnNo: g.turnNo, uid: uid, tipe: mode === 'waktu' ? 'waktu' : 'pass' };
    if (g.passes >= g.order.length) {                  // SEMUA PASS: Random Kanji dibuang, giliran kembali ke Player 1
      g.passes = 0; g.last.semua = true;
      g.kanji = kcKanjiBaru(g, g.order[0]);
      kcSetGiliran(g, g.order[0]);
    } else kcSetGiliran(g, kcGiliranBerikut(g));
    if (g.habis) r.status = 'selesai';
    return r;
  };
}
function kcFnReset(uid) {                             // tukar semua kartu di tangan (maks 3x per giliran)
  return function (r) {
    var g = kcSiapAksi(r, uid, kcNow());
    if (!g || (g.resets || 0) >= KC_RESET_MAKS) return undefined;
    var lama = g.hands[uid] || [], n = lama.length;
    if (!n) return undefined;
    lama.forEach(function (c) { g.usage[c] = Math.max(0, (g.usage[c] || 0) - 1); });   // kartu lama kembali ke deck
    var baru = [];
    for (var i = 0; i < n; i++) { var c = kcAmbilKartu(g, baru, lama); if (c) baru.push(c); }   // kartu baru: tidak kembar & beda dari yang lama
    if (!baru.length) return undefined;
    g.hands[uid] = baru; g.resets = (g.resets || 0) + 1; g.sel = [];
    if (!kcPastikanPasangan(g, uid)) { g.habis = true; r.status = 'selesai'; }
    return r;
  };
}
function kcFnAkhiri() {
  return function (r) {
    if (r.status !== 'main' || !r.game || kcNow() < r.game.akhir) return undefined;
    r.status = 'selesai';
    return r;
  };
}
function kcFnUlang(uid) {
  return function (r) {
    if (r.status !== 'selesai' || r.hostId !== uid) return undefined;
    kcPlayersArr(r).forEach(function (p) { p.ready = false; });
    r.status = 'lobby'; delete r.game;
    return r;
  };
}
function kcFnKeluar(id) {                              // dipakai kedua lapisan data
  return function (r) {
    if (!kcPlayersArr(r).some(function (p) { return p.id === id; })) return undefined;
    kcHapusPemain(r, id);
    var sisa = kcPlayersArr(r);
    if (!sisa.length) return null;                     // kosong -> room dihapus
    if (r.hostId === id) r.hostId = sisa[0].id;
    if (r.status === 'main' && r.game) {
      var g = kcNormG(r.game), ix = g.order.indexOf(id);
      if (ix >= 0) {
        var giliranDia = g.turn === id;
        g.order.splice(ix, 1);
        delete g.hands[id]; delete g.scores[id]; delete g.streaks[id]; delete g.need[id];
        if (g.order.length < 2) { r.status = 'selesai'; }
        else {
          g.passes = 0;
          if (giliranDia) { kcSetGiliran(g, g.order[ix % g.order.length]); if (g.habis) r.status = 'selesai'; }
        }
      }
    }
    return r;
  };
}

/* =====================================================================
   TAMPILAN GAME BOARD (Tahap 8) + interaksi pemain */
var kcAktifCode = '', kcRoom = null, kcSel = [], kcOk = null, kcPesanLokal = null;
var kcSeqTerlihat = 0, kcTurnTerlihat = 0, kcTickId = null, kcTrigNo = -1, kcTrigAt = 0, kcAkhirAt = 0;
var kcSibukAksi = false, kcKonfirmTimer = null;

var kcErrTx = '';
var kcTxJalan = 0;   // jumlah transaksi room yang belum selesai (tulisan set() saat itu akan membatalkannya)
// Semua tulisan ke database lewat sini: batas waktu 10 dtk, dan error ASLI ditampilkan (tidak ditelan diam-diam).
function kcTx(fn) {
  var code = kcState.code;
  kcTxJalan++;
  var asli = kcDb.tx(code, fn);
  var selesaiTx = function () { kcTxJalan = Math.max(0, kcTxJalan - 1); };
  asli.then(selesaiTx, selesaiTx);
  return Promise.race([
    asli,
    new Promise(function (res) { setTimeout(function () { res({ committed: false, error: new Error('timeout') }); }, 10000); })
  ]).then(function (res) {
    var baru = res.error ? kcPesanError(res.error) : '';
    var ubah = baru !== kcErrTx;
    kcErrTx = baru;
    if (ubah && kcRoom && kcRoom.status === 'main' && kcState.code === code) kcRenderGame(kcRoom);
    return res;
  });
}

function kcResetGameLokal() {
  if (kcTickId) { clearInterval(kcTickId); kcTickId = null; }
  kcErrTx = '';
  kcAktifCode = ''; kcRoom = null; kcSel = []; kcOk = null; kcPesanLokal = null;
  kcSeqTerlihat = 0; kcTurnTerlihat = 0; kcTrigNo = -1; kcTrigAt = 0; kcAkhirAt = 0; kcSibukAksi = false;
}
function kcResetPilihan() { kcSel = []; kcOk = null; }

function kcMulaiGame() {
  var code = kcState.code; if (!code || kcState.sibuk) return;
  kcState.sibuk = true;
  kcMuatKamus().then(function () {
    return kcTx(kcFnMulai(kcUid()));
  }).then(function (res) {
    if (res.error) tampilkanCustomAlert('Gagal memulai game', kcPesanError(res.error));
    else if (!res.committed) tampilkanCustomAlert('Belum bisa mulai', 'Pastikan minimal 2 pemain dan semua sudah READY.');
  }).catch(function (e) { tampilkanCustomAlert('Gagal', kcPesanError(e)); })
    .then(function () { kcState.sibuk = false; });
}

function kcFormatWaktu(ms) {
  var d = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(d / 60), s = d % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function kcPemainById(room, id) { return room.players.filter(function (p) { return p.id === id; })[0] || null; }
function kcNamaById(room, id) { var p = kcPemainById(room, id); return p ? p.name : 'Pemain'; }

function kcKursiHtml(p, g, saya, room) {
  var aktif = g.turn === p.id;
  var h = '<div class="kc-kursi' + (p.id === saya ? ' saya' : '') + (aktif ? ' aktif' : '') + (p.online === false ? ' off' : '') + '">';
  h += '<div class="kc-panah">▼</div>';
  h += '<div class="kc-kav">' + kcAvatarHtml(p.avatar) + '</div>';
  h += '<div class="kc-knama">' + kcEsc(p.name) + (p.id === room.hostId ? ' 👑' : '') + '</div>';
  h += '<div class="kc-kskor"><span>' + (g.scores[p.id] || 0) + '</span> <small>poin</small></div>';
  var info = [];
  if ((g.streaks[p.id] || 0) > 0) info.push('🔥' + g.streaks[p.id]);
  if (p.id !== saya) info.push('🃏×' + g.hands[p.id].length);
  if (p.online === false) info.push('⚠ offline');
  h += '<div class="kc-kinfo">' + (info.join(' ') || '&nbsp;') + '</div>';
  h += '</div>';
  return h;
}

function kcHasilHtml(room, g, pop) {
  var L = g.last;
  if (L && L.turnNo !== g.turnNo) {                    // ronde/giliran berikutnya: hasil sebelumnya hilang
    return L.semua ? '<div class="kc-hasil pass">🔄 Semua PASS — Random Kanji diganti baru</div>' : '<div class="kc-hasil kosong">&nbsp;</div>';
  }
  if (!L) return '<div class="kc-hasil kosong">Game dimulai! Giliran pertama diacak: <b>' + kcEsc(kcNamaById(room, g.pertama)) + '</b></div>';
  var n = kcEsc(kcNamaById(room, L.uid)), cls = 'kc-hasil' + (pop ? ' pop' : '');
  if (L.tipe === 'benar') {
    return '<div class="' + cls + ' benar"><div class="kc-h-judul">✓ BENAR — ' + n + '</div><div class="kc-h-kata">' + kcEsc(L.kata) + '</div>' +
      (L.baca ? '<div class="kc-h-baca">' + kcEsc(L.baca) + '</div>' : '') + (L.arti ? '<div class="kc-h-arti">' + kcEsc(L.arti) + '</div>' : '') +
      '<div class="kc-h-poin">+' + L.poin + ' POINT &nbsp;🔥 streak ' + L.streak + '</div></div>';
  }
  var teks = L.tipe === 'salah' ? '✗ Oops, salah!! — ' + n + (L.denda ? ' &nbsp;<b>−' + L.denda + ' POINT</b>' : '')
    : (L.tipe === 'waktu' ? '⏰ ' + n + ' kehabisan waktu → PASS' : '⏭ ' + n + ' PASS');
  if (L.semua) teks += '<br>🔄 Semua PASS — Random Kanji diganti baru';
  return '<div class="' + cls + ' ' + (L.tipe === 'salah' ? 'salah' : 'pass') + '">' + teks + '</div>';
}

function kcRenderGame(room) {
  var body = document.getElementById('kc-game-body');
  if (!body) return;
  kcRoom = room;
  var saya = kcUid();
  if (room.status === 'selesai') { kcRenderVictory(room); return; }
  var g = room.game;
  if (!g) { body._kcKey = ''; body.innerHTML = '<div class="kc-status">Menyiapkan game…</div>'; kcTampil('kc-game-page'); return; }
  kcNormG(g);

  if (kcAktifCode !== room.code) {                    // pertama kali masuk papan
    kcAktifCode = room.code;
    if (kcDb.aktifkanGame) kcDb.aktifkanGame(room.code, saya);
    kcResetPilihan(); kcPesanLokal = null; kcSeqTerlihat = g.seq; kcTurnTerlihat = g.turnNo;
    if (!kcTickId) kcTickId = setInterval(kcTick, 500);
    kcMuatKamus().then(function () { if (kcRoom && kcState.code) kcRenderGame(kcRoom); });
  }
  if (g.turnNo !== kcTurnTerlihat) { kcTurnTerlihat = g.turnNo; kcResetPilihan(); kcPesanLokal = null; }
  var pop = g.seq !== kcSeqTerlihat; kcSeqTerlihat = g.seq;

  var sisaMs = g.akhir - kcNow();
  var giliranSaya = g.turn === saya && kcKamus.siap && sisaMs > 0;
  var urut = room.players.filter(function (p) { return g.order.indexOf(p.id) >= 0; });
  var aku = kcPemainById(room, saya);
  var lawan = urut.filter(function (p) { return p.id !== saya; });
  var tangan = g.hands[saya] || [];

  var h = '<div class="kc-gbar">';
  h += '<button class="kc-gkeluar" id="kc-keluar-btn" onclick="kcKonfirmKeluar()">‹ Keluar</button>';
  h += '<div class="kc-timerbox"><div class="kc-timer" id="kc-timer">⏱ --:--</div><div class="kc-gsisa" id="kc-gsisa"></div></div>';
  h += '<div class="kc-gkode">' + kcEsc(room.code) + '</div></div>';

  h += '<div class="kc-meja"><div class="kc-lawan n' + lawan.length + '">';
  lawan.forEach(function (p) { h += kcKursiHtml(p, g, saya, room); });
  h += '</div><div class="kc-tengah"><div class="kc-rk-label">RANDOM KANJI</div>';
  h += '<div class="kc-rk-kartu">' + kcEsc(g.kanji) + '</div>';

  var susun = '';
  if (giliranSaya && kcSel.length) susun = kcEsc(g.kanji) + ' + ' + kcSel.map(function (i) { return kcEsc(tangan[i]); }).join(' + ');
  else if (g.turn !== saya && g.sel.length) susun = kcEsc(kcNamaById(room, g.turn)) + ' memilih: ' + g.sel.map(kcEsc).join(' ');
  h += '<div class="kc-susun">' + (susun || '&nbsp;') + '</div>';

  var pesan = '', kls = '';
  if (kcPesanLokal && giliranSaya) { pesan = kcPesanLokal.teks; kls = kcPesanLokal.kls; }
  else if (!kcKamus.siap) pesan = 'Memuat data kotoba…';
  else if (sisaMs <= 0) pesan = '⏱ Waktu habis…';
  else if (g.turn === saya && g.last && g.last.tipe === 'benar' && g.last.uid === saya && g.last.turnNo === g.turnNo) pesan = '🎉 Bagus! Cari kata lagi dengan kanji baru, atau tekan PASS untuk mengakhiri giliran.';
  else if (g.turn === saya) pesan = (g.resets || 0) >= KC_RESET_MAKS ? '🔄 Reset habis. Cari kartu yang cocok, atau tekan PASS.' : '👉 Giliranmu! Ketuk kartu untuk digabung dengan ' + g.kanji + ', atau RESET / PASS.';
  else pesan = '⏳ Giliran ' + kcNamaById(room, g.turn) + '…';
  h += '<div class="kc-pesan ' + kls + '">' + pesan + '</div>';
  h += kcHasilHtml(room, g, pop);
  if (kcErrTx) h += '<div class="kc-err">⚠ Gagal menyimpan: ' + kcEsc(kcErrTx) + '</div>';
  if (kcKamus.contoh) h += '<div class="kc-contoh">🧪 Kamus contoh (database kotoba belum terbaca)</div>';
  h += '</div><div class="kc-sayabox">' + (aku ? kcKursiHtml(aku, g, saya, room) : '') + '</div></div>';

  h += '<div class="kc-bawah"><div class="kc-tangan' + (giliranSaya ? '' : ' redup') + '">';
  for (var i = 0; i < KC_KARTU; i++) {
    if (i < tangan.length) h += '<div class="kc-kartu' + (kcSel.indexOf(i) >= 0 ? ' dipilih' : '') + '" onclick="kcPilihKartu(' + i + ')">' + kcEsc(tangan[i]) + '</div>';
    else h += '<div class="kc-kartu kosong">' + (g.need[saya] > 0 ? '＋' : '·') + '</div>';
  }
  h += '</div>';

  h += '<div class="kc-aksi"><div class="kc-deck">🃏 DECK<small>' + (kcKamus.siap ? kcSisaKotoba(g) : '…') + ' kotoba</small></div>';
  if (kcOk && giliranSaya) h += '<button class="kc-btn-ok" onclick="kcAmbilSekarang()">✓ AMBIL ' + kcEsc(kcOk.kata) + '</button>';
  var sisaReset = KC_RESET_MAKS - (g.resets || 0);
  h += '<button class="kc-btn-reset" ' + (giliranSaya && !kcSibukAksi && sisaReset > 0 ? '' : 'disabled') + ' onclick="kcReset()">🔄 RESET <small>(' + Math.max(0, sisaReset) + ')</small></button>';
  h += '<button class="kc-btn-pass" ' + (giliranSaya && !kcSibukAksi ? '' : 'disabled') + ' onclick="kcPass()">⏭ PASS</button></div></div>';

  if (body._kcKey !== h) { body.innerHTML = h; body._kcKey = h; }   // snapshot kembar tidak membongkar tombol (klik tidak hilang)
  kcTampil('kc-game-page');
  kcUpdateWaktu(room, g);
}

function kcBolehAksi() {
  var room = kcRoom; if (!room || !room.game || room.status !== 'main') return false;
  var g = room.game;
  return kcKamus.siap && !kcSibukAksi && g.turn === kcUid() && kcNow() < g.akhir;
}
function kcSinkronSel() {
  var room = kcRoom, g = room.game, t = g.hands[kcUid()] || [];
  var chars = kcSel.map(function (i) { return t[i]; });
  kcTx(kcFnSel(kcUid(), chars));
}

// Ketuk kartu: pilih/batal pilih. Setiap pilihan langsung dicek ke database.
function kcPilihKartu(i) {
  if (!kcBolehAksi()) return;
  var g = kcRoom.game, tangan = g.hands[kcUid()] || [];
  if (i >= tangan.length) return;
  var pos = kcSel.indexOf(i);
  if (pos >= 0) { kcSel.splice(pos, 1); kcOk = null; kcPesanLokal = null; kcSinkronSel(); kcRenderGame(kcRoom); return; }
  if (kcSel.length >= 2) return;
  kcSel.push(i); kcOk = null; kcPesanLokal = null;

  var chars = kcSel.map(function (k) { return tangan[k]; });
  var total = [g.kanji].concat(chars);
  var sisa = tangan.filter(function (_, k) { return kcSel.indexOf(k) < 0; });
  var kata = kcCari(total, g.solved);
  var lanjut = kcBisaLanjut(total, sisa, g.solved);

  if (kata && !lanjut) { kcKirimGerak(chars); return; }            // valid & final -> langsung
  if (kata && lanjut) {                                            // valid tapi bisa lebih panjang -> HINT
    kcOk = { kata: kata, chars: chars };
    kcPesanLokal = { teks: '💡 HINT: Masih bisa dilanjutkan! Pilih kartu lain, atau ambil poin sekarang.', kls: 'hint' };
  } else if (lanjut) {
    kcPesanLokal = { teks: '💡 HINT: Masih bisa dilanjutkan!', kls: 'hint' };
  } else if (kcSudahTerjawab(total, g.solved)) {                   // kotoba benar tapi SUDAH PERNAH terjawab -> tidak dihitung, tanpa hukuman
    kcResetPilihan();
    kcPesanLokal = { teks: '📌 Kotoba ' + total.join('') + ' sudah pernah terjawab. Coba kartu lain!', kls: 'no' };
    kcSinkronSel();
    kcRenderGame(kcRoom);
    return;
  } else {                                                         // jalan buntu -> SALAH
    var teks = total.join('');
    kcResetPilihan();
    kcPesanLokal = { teks: 'Oops, salah!! Poinmu dikurangi ' + KC_DENDA_SALAH + '. Pikir dulu sebelum memilih kartu.', kls: 'no' };
    kcTx(kcFnSalah(kcUid(), teks));
    kcRenderGame(kcRoom);
    return;
  }
  kcSinkronSel();
  kcRenderGame(kcRoom);
}
function kcAmbilSekarang() { if (kcBolehAksi() && kcOk) kcKirimGerak(kcOk.chars); }
function kcKirimGerak(chars) {
  kcSibukAksi = true; kcResetPilihan();
  kcTx(kcFnGerak(kcUid(), chars)).then(function (res) {
    kcSibukAksi = false;
    if (!res.committed && !res.error) kcPesanLokal = { teks: 'Gerakan tidak diterima (giliran berpindah / waktu habis).', kls: 'no' };
    if (kcRoom && kcState.code) kcRenderGame(kcRoom);
  });
}
function kcReset() {
  if (!kcBolehAksi()) return;
  if ((kcRoom.game.resets || 0) >= KC_RESET_MAKS) return;
  kcSibukAksi = true; kcResetPilihan(); kcPesanLokal = null;
  kcTx(kcFnReset(kcUid())).then(function (res) {
    kcSibukAksi = false;
    if (!res.committed && !res.error) kcPesanLokal = { teks: 'Reset tidak bisa dilakukan.', kls: 'no' };
    if (kcRoom && kcState.code) kcRenderGame(kcRoom);
  });
}
function kcPass() {
  if (!kcBolehAksi()) return;
  kcSibukAksi = true; kcResetPilihan();
  kcTx(kcFnPass(kcUid(), 'manual', 0)).then(function () {
    kcSibukAksi = false;
    if (kcRoom && kcState.code) kcRenderGame(kcRoom);
  });
}

// Timer (Tahap 9) + giliran otomatis + akhir game: berjalan di setiap HP, hasilnya divalidasi di transaksi
function kcUpdateWaktu(room, g) {
  var now = kcNow(), sisa = g.akhir - now;
  var el = document.getElementById('kc-timer');
  if (el) { el.textContent = '⏱ ' + kcFormatWaktu(sisa); el.classList.toggle('kritis', sisa <= 60000); }
  var gs = document.getElementById('kc-gsisa');
  if (gs) {
    if (room.status !== 'main' || sisa <= 0) gs.textContent = '';
    else gs.textContent = (g.turn === kcUid() ? 'Giliranmu' : kcNamaById(room, g.turn)) + ' · ' + Math.max(0, Math.ceil((g.batas - now) / 1000)) + ' dtk';
  }
}
function kcTick() {
  var room = kcRoom;
  if (!room || !room.game || !kcState.code) return;
  var g = room.game, now = kcNow(), sisa = g.akhir - now, code = kcState.code;
  kcUpdateWaktu(room, g);
  if (room.status !== 'main') return;

  if (sisa <= 0) {                                    // timer habis -> semua aksi berhenti, hitung pemenang
    if (now - kcAkhirAt > 2000) { kcAkhirAt = now; kcTx(kcFnAkhiri()); }
    return;
  }
  var tur = g.turn, pm = kcPemainById(room, tur);

  var bot = kcDb.mode === 'mock' && String(tur).indexOf('dummy') === 0;
  var batas = g.batas;
  if (pm && pm.online === false) batas = Math.min(batas, g.tMulai + KC_OFFLINE_DETIK * 1000);
  if (bot) batas = g.tMulai + 1500;
  if (now >= batas && (kcTrigNo !== g.turnNo || now - kcTrigAt > 3000)) {
    kcTrigNo = g.turnNo; kcTrigAt = now;
    kcTx(kcFnPass(tur, bot ? 'bot' : 'waktu', g.turnNo));
  }
}

function kcKonfirmKeluar() {
  var b = document.getElementById('kc-keluar-btn');
  if (kcKonfirmTimer) { clearTimeout(kcKonfirmTimer); kcKonfirmTimer = null; kcKeluarRoom(); return; }
  if (b) b.textContent = 'Yakin keluar?';
  kcKonfirmTimer = setTimeout(function () {
    kcKonfirmTimer = null;
    var b2 = document.getElementById('kc-keluar-btn'); if (b2) b2.textContent = '‹ Keluar';
  }, 3000);
}

/* ---------- Victory (Tahap 25) ---------- */
function kcRenderVictory(room) {
  var body = document.getElementById('kc-game-body'), g = room.game;
  if (!body) return;
  if (kcTickId) { clearInterval(kcTickId); kcTickId = null; }
  var saya = kcUid();
  if (!g) { body.innerHTML = '<div class="kc-status">Game selesai.</div>'; kcTampil('kc-game-page'); return; }
  kcNormG(g);
  var daftar = room.players.map(function (p) { return { p: p, skor: g.scores[p.id] || 0 }; });
  daftar.sort(function (a, b) { return b.skor - a.skor; });
  var top = daftar.length ? daftar[0].skor : 0;
  var juara = daftar.filter(function (d) { return d.skor === top; });
  var seri = juara.length > 1;
  var awal = kcNow() < g.akhir;

  var h = '<div class="kc-victory">';
  h += '<div class="kc-v-judul">' + (seri ? '🤝 SERI!' : '🏆 VICTORY!') + '</div>';
  if (g.habis) h += '<div class="kc-v-sub">Semua kotoba sudah terjawab!</div>';
  else if (awal) h += '<div class="kc-v-sub">Game berakhir lebih awal karena pemain lain keluar.</div>';
  h += '<div class="kc-v-juara">';
  juara.forEach(function (d) {
    h += '<div class="kc-v-box' + (d.p.id === saya ? ' saya' : '') + '"><div class="kc-v-av">' + kcAvatarHtml(d.p.avatar) + '</div>' +
      '<div class="kc-v-nama">' + kcEsc(d.p.name) + '</div><div class="kc-v-skor">' + d.skor + ' POINT</div></div>';
  });
  h += '</div>';
  var rank = 0, prev = null, ix = 0, rest = '';
  daftar.forEach(function (d) {
    ix++;
    if (d.skor !== prev) { rank = ix; prev = d.skor; }
    if (d.skor === top) return;
    rest += '<div class="kc-v-baris' + (d.p.id === saya ? ' saya' : '') + '"><span>' + rank + '. ' + kcEsc(d.p.name) + '</span><b>' + d.skor + ' POINT</b></div>';
  });
  if (rest) h += '<div class="kc-v-rank">' + rest + '</div>';
  h += '<div class="kc-v-aksi">';
  if (room.hostId === saya) h += '<button class="kc-big-btn kc-mulai" onclick="kcUlangGame()">🔁 MAIN LAGI</button>';
  else h += '<div class="kc-tunggu-host">Host bisa mengajak main lagi.</div>';
  h += '<button class="kc-big-btn kc-alt" onclick="kcKeluarRoom()">KELUAR</button></div></div>';
  body._kcKey = ''; body.innerHTML = h;
  kcTampil('kc-game-page');
}
function kcUlangGame() { if (kcState.code) kcTx(kcFnUlang(kcUid())).then(function (res) { if (res.error) tampilkanCustomAlert('Gagal', kcPesanError(res.error)); }); }

/* ================== /KANJI CHALLENGE ================== */