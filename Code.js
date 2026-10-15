// ===== ALAMAT BACKEND (Google Apps Script Web App) =====
// Tempel URL hasil Deploy di sini (harus berakhiran /exec)
var API_URL = 'https://script.google.com/macros/s/AKfycbyX3EmTsI5MbYy7c1YXxR-N3crRlIj_vR6aruxiMiET1oFZWH_GnUeqMWwNuKqEUJVi/exec';

// Jembatan ke server. Di dalam Google Apps Script dipakai google.script.run asli;
// di luar itu (folder APK) pemanggilan dikirim lewat fetch ke API_URL.
(function() {
  if (typeof google !== 'undefined' && google.script && google.script.run) return;

  function panggilApi(namaFungsi, args) {
    if (!API_URL || API_URL.indexOf('PASTE_') === 0) {
      return Promise.reject(new Error('API_URL belum diisi di Code.js'));
    }
    return fetch(API_URL, {
      method: 'POST',
      // text/plain supaya browser tidak menolak (CORS preflight)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: namaFungsi, args: args }),
      redirect: 'follow'
    })
    .then(function(res) { return res.json(); })
    .then(function(d) {
      if (!d.ok) throw new Error(d.error || 'Server mengembalikan error');
      return d.data;
    });
  }

  function buatRunner(successFn, failureFn) {
    return new Proxy({}, {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(fn) { return buatRunner(fn, failureFn); };
        }
        if (prop === 'withFailureHandler') {
          return function(fn) { return buatRunner(successFn, fn); };
        }
        return function() {
          var args = Array.prototype.slice.call(arguments);
          panggilApi(String(prop), args).then(
            function(data) { if (typeof successFn === 'function') successFn(data); },
            function(err) {
              if (typeof failureFn === 'function') failureFn(err);
              else console.error('[API ' + String(prop) + ']', err.message);
            }
          );
        };
      }
    });
  }

  window.google = { script: { run: buatRunner(null, null) } };
})();

var currentJenis = "kotoba";
var currentMenu = "";
var currentBab = "";
var currentSubBab = "";
var rawData = [];
var customAlertCallback = null;

var memorizedDataByJenis = {
  kotoba: [],
  modul: [],
  irodori: [],
  irodori2: [],
  kaigo: [],
  konstruksi: []
};

var quizQuestions = [];
var currentQuizIndex = 0;
var quizScore = 0;
var isAnswering = false;
var selectedBabForTest = "";
var currentTestMode = "pg";

var studentName = "";
var studentClass = "";
var totalQuizLimitVal = "10";

var timerInterval = null;
var timeRemainingSeconds = 0;
var elapsedSecondsCount = 0;
var testStartTimeTimestamp = 0;
var completionTimeFormatted = "";
var isStopwatchMode = false;

// ===== INFO UPDATE TERBARU (edit bagian ini setiap ada update baru) =====
var APP_VERSI = "Versi 2.4.9";
var APP_UPDATE_INTRO = "Ada pembaruan baru, silakan dicek ya minna-san";
// Format: { ico, tag (FIX/NEW/UPDATE/INFO), judul, isi }. Teks biasa "Menu Xxx: ..." juga masih didukung.
var APP_UPDATE_LIST = [
  'Menu Kanji: Saat HP dimiringkan, aplikasi tidak lagi keluar sendiri ke halaman utama. Kalau lagi seru main Kanji Challenge lalu layar tidak sengaja berputar, kalian otomatis kembali ke room dan permainan yang sedang berjalan.',
  'Menu Kanji: Kanji Challenge kini tidak mengulang kotoba yang sudah terjawab, jadi tiap kotoba hanya bisa dijawab satu kali.',
  'Menu Kanji: Kartu di tangan tidak lagi kembar, dan Random Kanji selalu punya pasangan di kartu kalian supaya poin lebih mudah didapat.',
  'Menu Kanji: Memilih kartu yang salah kini mengurangi 1 poin, jadi pikirkan dulu sebelum menekan kartu ya.'
];

var APP_UPDATE_OUTRO = "Pastikan Versi-nya sesuai Update terbaru ya minna-san, jika belum silakan untuk refresh kembali. Semoga makin seru dan lancar belajarnya, ganbatte ne! Arigatou ne 🙏";

// ===== TEMA TERANG / GELAP =====
function terapkanTema(tema) {
  document.documentElement.classList.toggle('dark', tema === 'dark');
  document.querySelectorAll('.tema-switch button').forEach(function(b) {
    b.classList.toggle('aktif', b.getAttribute('data-tema') === tema);
  });
}
function setTema(tema) {
  try { localStorage.setItem('kotoba_theme', tema); } catch (e) {}
  terapkanTema(tema);
}
function temaSaatIni() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Warna kartu mengikuti tag: FIX hijau, NEW oranye, UPDATE biru, INFO ungu
var UPD_WARNA = { FIX: 'hijau', NEW: 'oranye', UPDATE: 'biru', INFO: 'ungu' };
function infoUpdateItem(it) {
  if (it && typeof it === 'object') {
    var t = String(it.tag || 'INFO').toUpperCase();
    return { ico: it.ico || '✨', tag: t, judul: it.judul || '', isi: it.isi || '', warna: it.warna || UPD_WARNA[t] || 'ungu' };
  }
  var teks = String(it || '');
  var m = teks.match(/^\s*Menu\s+([A-Za-z]+)\s*:\s*([\s\S]*)$/i);
  var ico = { kanji: '🈴', bunpou: '📗', kotoba: '📘', kana: '🔤' };
  if (m) return { ico: ico[m[1].toLowerCase()] || '✨', tag: 'UPDATE', judul: 'Menu ' + m[1], isi: m[2], warna: 'biru' };
  return { ico: '✨', tag: 'INFO', judul: 'Info', isi: teks, warna: 'ungu' };
}

function tampilkanUpdateTerbaru() {
  var ver = document.getElementById('mm-versi');
  if (ver) ver.textContent = APP_VERSI;
  document.getElementById('upd-ver').textContent = APP_VERSI;
  document.getElementById('upd-intro').textContent = APP_UPDATE_INTRO;
  document.getElementById('upd-outro').textContent = APP_UPDATE_OUTRO;
  var lb = document.getElementById('upd2-label');
  if (lb) lb.textContent = 'YANG BARU DI V' + String(APP_VERSI).replace(/^\s*Versi\s*/i, '');
  var box = document.getElementById('upd-list');
  box.innerHTML = '';
  APP_UPDATE_LIST.forEach(function(raw) {
    var d = infoUpdateItem(raw);
    var c = document.createElement('div');
    c.className = 'upd2-card upd2-' + d.warna;
    var ico = document.createElement('div'); ico.className = 'upd2-ico'; ico.textContent = d.ico;
    var tx = document.createElement('div'); tx.className = 'upd2-txt';
    var jd = document.createElement('b'); jd.textContent = d.judul;
    var ds = document.createElement('span'); ds.textContent = d.isi;
    tx.appendChild(jd); tx.appendChild(ds);
    var pill = document.createElement('div'); pill.className = 'upd2-pill'; pill.textContent = d.tag;
    c.appendChild(ico); c.appendChild(tx); c.appendChild(pill);
    box.appendChild(c);
  });
  terapkanTema(temaSaatIni());
  document.getElementById('update-modal').classList.remove('modal-hidden');
}
function unduhDariInfoUpdate() { tutupUpdate(); cekUpdateAplikasi(); }
function tutupUpdate() {
  document.getElementById('update-modal').classList.add('modal-hidden');
}

// ===== PULIHKAN HALAMAN SETELAH LAYAR DIPUTAR / APLIKASI DIMUAT ULANG =====
// Saat HP dimiringkan, WebView di aplikasi bisa memuat ulang halaman sehingga kembali ke Menu Utama.
// Halaman Kanji Challenge yang sedang dibuka dicatat, lalu dibuka lagi bila dimuat ulang dalam 2 menit.
var PULIH_KUNCI = 'kotoba_halaman_terakhir';
var PULIH_BATAS_MS = 120000;
var PULIH_HALAMAN = ['kanji-challenge-page', 'kc-buat-page', 'kc-gabung-page', 'kc-lobby-page', 'kc-game-page'];

function simpanHalamanTerakhir() {
  try {
    if (!localStorage.getItem('kotoba_logged_user')) return;
    var id = '';
    for (var i = 0; i < PULIH_HALAMAN.length; i++) {
      var el = document.getElementById(PULIH_HALAMAN[i]);
      if (el && !el.classList.contains('hidden')) { id = PULIH_HALAMAN[i]; break; }
    }
    if (!id) { localStorage.removeItem(PULIH_KUNCI); return; }
    var kode = (typeof kcState !== 'undefined' && kcState && kcState.code) ? kcState.code : '';
    localStorage.setItem(PULIH_KUNCI, JSON.stringify({ id: id, kode: kode, t: Date.now() }));
  } catch (e) {}
}
function pulihkanHalamanTerakhir() {
  var p = null;
  try { p = JSON.parse(localStorage.getItem(PULIH_KUNCI) || 'null'); } catch (e) {}
  if (!p || !p.id || PULIH_HALAMAN.indexOf(p.id) < 0) return false;
  if (!p.t || Date.now() - p.t > PULIH_BATAS_MS) return false;
  if (typeof kcPulihkan !== 'function') return false;
  try { return !!kcPulihkan(p.id, p.kode); } catch (e) { return false; }
}
setInterval(simpanHalamanTerakhir, 1000);
window.addEventListener('pagehide', simpanHalamanTerakhir);
document.addEventListener('visibilitychange', function() { if (document.hidden) simpanHalamanTerakhir(); });

window.onload = function() {
  terapkanTema(temaSaatIni());
  var savedUser = localStorage.getItem("kotoba_logged_user");
  var savedClass = localStorage.getItem("kotoba_logged_class");

  if (savedUser && savedClass) {
    studentName = savedUser;
    studentClass = savedClass;
    terapkanAturanKelas(studentClass);
    document.getElementById('ask-page').classList.add('hidden');
    document.getElementById('student-identity-page').classList.add('hidden');
    document.getElementById('main-menu-page').classList.remove('hidden');
    if (pulihkanHalamanTerakhir()) {                  // dimuat ulang saat main (mis. layar diputar) -> lanjut di halaman tadi
      var verEl = document.getElementById('mm-versi');
      if (verEl) verEl.textContent = APP_VERSI;
    } else {
      tampilkanUpdateTerbaru();
    }
  } else {
    document.getElementById('ask-page').classList.remove('hidden');
    document.getElementById('student-identity-page').classList.add('hidden');
    document.getElementById('main-menu-page').classList.add('hidden');
  }
};

function jawabHai() {
  document.getElementById('ask-page').classList.add('hidden');
  document.getElementById('student-identity-page').classList.remove('hidden');
}

function kembaliKeAskPage() {
  document.getElementById('student-identity-page').classList.add('hidden');
  document.getElementById('ask-page').classList.remove('hidden');
}

function bukaHalamanRegister() {
  document.getElementById('student-identity-page').classList.add('hidden');
  document.getElementById('register-page').classList.remove('hidden');
}

function kembaliKeLogin() {
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('student-identity-page').classList.remove('hidden');
}

function bukaHalamanUbahPassword() {
  document.getElementById('student-identity-page').classList.add('hidden');
  document.getElementById('ubah-password-page').classList.remove('hidden');
}

function kembaliKeLoginFromUbahPass() {
  document.getElementById('ubah-password-page').classList.add('hidden');
  document.getElementById('student-identity-page').classList.remove('hidden');
}

function terapkanAturanKelas(kelas) {
  perbaruiSapaan();
  var btnKaigo = document.getElementById('btn-menu-kaigo');
  var btnKonstruksi = document.getElementById('btn-menu-konstruksi');
  var btnMakanan = document.getElementById('btn-menu-makanan');

  if (!btnKaigo || !btnKonstruksi || !btnMakanan) return;

  setAktifMenu(btnKaigo);
  setAktifMenu(btnKonstruksi);
  setAktifMenu(btnMakanan);

  if (kelas === 'Joybridge') {
    setNonaktifMenu(btnKaigo, 'Kotoba Kaigo');
    setNonaktifMenu(btnMakanan, 'Kotoba Pengolahan Makanan');
  } else if (kelas === 'Joycare') {
    setNonaktifMenu(btnKonstruksi, 'Kotoba Konstruksi');
    setNonaktifMenu(btnMakanan, 'Kotoba Pengolahan Makanan');
  } else if (kelas === 'Joyserve') {
    setNonaktifMenu(btnKonstruksi, 'Kotoba Konstruksi');
    setNonaktifMenu(btnKaigo, 'Kotoba Kaigo');
  } else if (kelas === 'Joygreen') {
    setNonaktifMenu(btnKonstruksi, 'Kotoba Konstruksi');
    setNonaktifMenu(btnKaigo, 'Kotoba Kaigo');
    setNonaktifMenu(btnMakanan, 'Kotoba Pengolahan Makanan');
  }
}

function setAktifMenu(btnEl) {
  btnEl.classList.remove('btn-disabled');
  btnEl.style.pointerEvents = "auto";
  var sub = btnEl.querySelector('small');
  if (sub && sub.getAttribute('data-asli')) sub.innerText = sub.getAttribute('data-asli');
  var pnl = btnEl.querySelector('.mm-arrow');
  if (pnl) pnl.innerText = '›';
}

function setNonaktifMenu(btnEl, namaMenuAsli) {
  btnEl.classList.add('btn-disabled');
  btnEl.style.pointerEvents = "none";
  var sub = btnEl.querySelector('small');
  if (sub) {
    if (!sub.getAttribute('data-asli')) sub.setAttribute('data-asli', sub.innerText);
    sub.innerText = '🔒 Bukan untuk kelasmu';
  }
  var pnl = btnEl.querySelector('.mm-arrow');
  if (pnl) pnl.innerText = '🔒';
}

// ===== Pencatatan riwayat aktivitas siswa (kolom Log Session di sheet users) =====
function catatAktivitas(awalan, item, gabung) {
  if (!studentName) return;
  try {
    google.script.run
      .withFailureHandler(function() {})
      .logAktivitas(studentName, awalan, item || "", gabung === true);
  } catch (e) {}
}

function simpanIdentitasDanMasuk() {
  var usernameInput = document.getElementById('input-nama');
  var passwordInput = document.getElementById('input-password');

  if (!usernameInput || !passwordInput) return;

  var username = usernameInput.value.trim();
  var password = passwordInput.value.trim();

  if (!username || !password) {
    tampilkanCustomAlert("Perhatian ⚠️", "Mohon isi User name dan Password terlebih dahulu!");
    return;
  }

  google.script.run
    .withSuccessHandler(function(result) {
      if (result.success) {
        var sName = result.user;
        var sKelas = result.kelas || "Joycare";
        studentName = sName;
        studentClass = sKelas;
        localStorage.setItem("kotoba_logged_user", sName);
        localStorage.setItem("kotoba_logged_class", sKelas);
        terapkanAturanKelas(sKelas);
        document.getElementById('student-identity-page').classList.add('hidden');
        document.getElementById('main-menu-page').classList.remove('hidden');
        tampilkanUpdateTerbaru();
      } else {
        tampilkanCustomAlert("Login Gagal ❌", result.message);
      }
    })
    .withFailureHandler(function(err) {
      tampilkanCustomAlert("Error ⚠️", "Terjadi kesalahan koneksi: " + err.message);
    })
    .checkLogin(username, password);
}

function prosesDaftarAkun() {
  var kelas = document.getElementById('reg-kelas').value;
  var nama = document.getElementById('reg-nama').value.trim();
  var password = document.getElementById('reg-password').value.trim();
  var email = document.getElementById('reg-email').value.trim();

  if (!kelas) {
    tampilkanCustomAlert("Perhatian ⚠️", "Mohon pilih Kelas terlebih dahulu!");
    return;
  }
  if (!nama || !password || !email) {
    tampilkanCustomAlert("Perhatian ⚠️", "Mohon isi semua kolom pendaftaran terlebih dahulu!");
    return;
  }

  google.script.run.withSuccessHandler(function(result) {
    if (result.success) {
      studentName = result.user;
      studentClass = result.kelas;
      localStorage.setItem("kotoba_logged_user", studentName);
      localStorage.setItem("kotoba_logged_class", studentClass);
      terapkanAturanKelas(studentClass);
      tampilkanCustomAlert("Berhasil! 🎉", "Akun berhasil dibuat! Selamat datang di aplikasi.", function() {
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('main-menu-page').classList.remove('hidden');
        tampilkanUpdateTerbaru();
      });
    } else {
      tampilkanCustomAlert("Gagal ❌", result.message);
    }
  }).registerUser(nama, password, email, kelas);
}

function prosesUbahPassword() {
  var username = document.getElementById('up-nama').value.trim();
  var oldPass = document.getElementById('up-old-password').value.trim();
  var newPass = document.getElementById('up-new-password').value.trim();

  if (!username || !oldPass || !newPass) {
    tampilkanCustomAlert("Perhatian ⚠️", "Mohon isi User name, Password lama, dan Password baru terlebih dahulu!");
    return;
  }

  google.script.run.withSuccessHandler(function(result) {
    if (result && result.success) {
      tampilkanCustomAlert("Berhasil! 🔒", "Password berhasil diubah di Spreadsheet! Silakan login kembali dengan password baru Anda.", function() {
        document.getElementById('up-nama').value = "";
        document.getElementById('up-old-password').value = "";
        document.getElementById('up-new-password').value = "";
        kembaliKeLoginFromUbahPass();
      });
    } else {
      var errMsg = (result && result.message) ? result.message : "Gagal mengubah password. Periksa kembali username dan password lama Anda.";
      tampilkanCustomAlert("Gagal ❌", errMsg);
    }
  }).withFailureHandler(function(error) {
    tampilkanCustomAlert("Error ⚠️", "Terjadi kesalahan sistem: " + error.message);
  }).changePassword(username, oldPass, newPass);
}

// ===== QUEST HARIAN =====
// Progres disimpan di perangkat per siswa per hari (localStorage), reset otomatis tiap ganti hari.
var QUEST = {
  streak: 0,       // hari berturut-turut menyelesaikan Daily Quest
  selesai: 0,      // kotoba yang sudah dihafal hari ini
  target: 10,      // target kotoba hari ini
  daftar: []
};
var questState = null, questUser = '';
function questTanggal(offsetHari) {
  var d = new Date(); if (offsetHari) d.setDate(d.getDate() + offsetHari);
  var m = d.getMonth() + 1, h = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (h < 10 ? '0' : '') + h;
}
function questKunci() { return 'kotoba_quest|' + studentName; }
function questBaru() { return { tgl: questTanggal(0), hafal: {}, test: 0, bunpou: {}, kanji: {}, streak: 0, lastDone: '' }; }
function questMuat() {
  questUser = studentName;
  var st = null;
  try { st = JSON.parse(localStorage.getItem(questKunci()) || 'null'); } catch (e) {}
  if (!st || typeof st !== 'object') st = questBaru();
  st.hafal = st.hafal || {}; st.bunpou = st.bunpou || {}; st.kanji = st.kanji || {};
  st.test = st.test || 0; st.streak = st.streak || 0; st.lastDone = st.lastDone || '';
  var hariIni = questTanggal(0);
  if (st.tgl !== hariIni) { st.tgl = hariIni; st.hafal = {}; st.test = 0; st.bunpou = {}; st.kanji = {}; }
  // streak putus bila kemarin tidak menyelesaikan quest
  if (st.lastDone !== hariIni && st.lastDone !== questTanggal(-1)) st.streak = 0;
  questState = st;
}
function questSimpan() {
  try { localStorage.setItem(questKunci(), JSON.stringify(questState)); } catch (e) {}
  pencapaianKeServer();
}
// pastikan state milik siswa yang sedang login & tanggalnya hari ini
function questSiap() {
  if (!studentName) return false;
  if (!questState || questUser !== studentName || questState.tgl !== questTanggal(0)) questMuat();
  return true;
}
function questSusunDaftar() {
  var n = Object.keys(questState.hafal).length;
  QUEST.selesai = Math.min(n, QUEST.target);
  QUEST.streak = questState.streak;
  QUEST.daftar = [
    { ico: '📘', judul: 'Hafalkan 10 kotoba', ket: 'Centang kotoba yang sudah kamu hafal', now: Math.min(n, 10), max: 10 },
    { ico: '📝', judul: 'Selesaikan 1 Test Pilihan Ganda', ket: 'Kerjakan test sampai selesai', now: Math.min(questState.test, 1), max: 1 },
    { ico: '📗', judul: 'Pelajari 1 pola Bunpou', ket: 'Buka dan selesaikan satu pola kalimat', now: Math.min(Object.keys(questState.bunpou).length, 1), max: 1 },
    { ico: '✍️', judul: 'Selesaikan 1 Kanji + cara menulisnya', ket: 'Latih urutan goresan atau jiplak kanji sampai benar', now: Math.min(Object.keys(questState.kanji).length, 1), max: 1 }
  ];
}
function questSemuaSelesai() {
  return QUEST.daftar.length > 0 && QUEST.daftar.every(function(q) { return q.now >= q.max; });
}
function questToast(teks) {
  var t = document.getElementById('qst-toast');
  if (!t) { t = document.createElement('div'); t.id = 'qst-toast'; t.className = 'qst-toast'; document.body.appendChild(t); }
  t.textContent = teks;
  setTimeout(function() { t.classList.add('tampil'); }, 20);
  clearTimeout(questToast._t);
  questToast._t = setTimeout(function() { t.classList.remove('tampil'); }, 3600);
}
// dipanggil setiap ada progres; bila semua quest tuntas hari ini -> streak +1 (sekali per hari)
function questCekSelesai() {
  questSusunDaftar();
  var barusSelesai = false;
  if (questSemuaSelesai() && questState.lastDone !== questTanggal(0)) {
    barusSelesai = true;
    questState.streak = (questState.lastDone === questTanggal(-1)) ? questState.streak + 1 : 1;
    questState.lastDone = questTanggal(0);
    questSimpan();
    questToast('🎉 Daily Quest hari ini sudah selesai ya!');
  }
  achCek(true, barusSelesai ? 3800 : 0);
  renderQuest();
}
function questCatatHafal(kotoba, arti, jenis, dicentang) {
  if (!questSiap()) return;
  var key = jenis + '|' + kotoba + '|' + arti;
  if (dicentang) questState.hafal[key] = 1; else delete questState.hafal[key];
  questSimpan(); questCekSelesai();
}
function questCatatTest() {
  if (!questSiap()) return;
  if (achSiap()) { achState.test = (achState.test || 0) + 1; achSimpan(); }
  questState.test = 1; questSimpan(); questCekSelesai();
}
function questCatatBunpou(key) {
  if (!questSiap()) return;
  questState.bunpou[key] = 1; questSimpan(); questCekSelesai();
}
function questCatatKanji(ch) {
  if (!questSiap() || !ch) return;
  if (achSiap()) { achState.kanji[ch] = 1; achSimpan(); }
  questState.kanji[ch] = 1; questSimpan(); questCekSelesai();
}
// ===== ACHIEVEMENT BERTAHAP (jangka panjang) =====
// Level naik otomatis seiring total progres. Level yang sudah didapat tidak turun lagi.
var ACH_TIER = ['🥉 Perunggu', '🥈 Perak', '🥇 Emas', '💎 Platinum', '🔷 Diamond', '👑 Legenda'];
function achHitungHafal() {
  var n = 0;
  Object.keys(memorizedDataByJenis).forEach(function(j) { n += (memorizedDataByJenis[j] || []).length; });
  return n;
}
// SATU SUMBER DATA: dipakai tab Progres (Hari Ini / Belajar / Pencapaian), Profil, dan Achievement.
function hitungProgres() {
  achSiap();
  var s = (typeof questState !== 'undefined' && questState) ? (questState.streak || 0) : 0;
  return {
    hafal:  achHitungHafal(),
    bunpou: (typeof bp !== 'undefined' && bp.done) ? Object.keys(bp.done).length : 0,
    kanji:  achState ? Object.keys(achState.kanji).length : 0,   // kanji berbeda yang berhasil ditulis
    test:   achState ? (achState.test || 0) : 0,
    streak: Math.max(s, achState ? (achState.bestStreak || 0) : 0)
  };
}
var ACH_GRUP = [
  { id: 'hafal',  ico: '📘', nama: 'Penghafal Kotoba', ket: 'Total kotoba yang kamu tandai hafal',
    target: [25, 50, 100, 250, 500, 1000], nilai: function() { return hitungProgres().hafal; } },
  { id: 'bunpou', ico: '📗', nama: 'Pelajar Bunpou', ket: 'Total pola Bunpou yang kamu selesaikan',
    target: [10, 30, 60, 100, 150, 200], nilai: function() { return hitungProgres().bunpou; } },
  { id: 'kanji',  ico: '✍️', nama: 'Pelukis Kanji', ket: 'Total kanji berbeda yang kamu tulis dengan benar',
    target: [10, 30, 60, 100, 200, 300], nilai: function() { return hitungProgres().kanji; } },
  { id: 'test',   ico: '📝', nama: 'Pejuang Test', ket: 'Jumlah Test Pilihan Ganda yang kamu selesaikan',
    target: [5, 15, 30, 60, 100, 200], nilai: function() { return hitungProgres().test; } },
  { id: 'streak', ico: '🔥', nama: 'Api Semangat', ket: 'Streak Daily Quest terpanjangmu (hari)',
    target: [3, 7, 14, 30, 60, 100], nilai: function() { return hitungProgres().streak; } }
];

var achState = null, achUser = '';
function achKunci() { return 'kotoba_ach|' + studentName; }
function achSiap() {
  if (!studentName) return false;
  if (!achState || achUser !== studentName) {
    achUser = studentName;
    var st = null;
    try { st = JSON.parse(localStorage.getItem(achKunci()) || 'null'); } catch (e) {}
    if (!st || typeof st !== 'object') st = {};
    st.kanji = st.kanji || {}; st.tier = st.tier || {};
    st.test = st.test || 0; st.bestStreak = st.bestStreak || 0;
    achState = st;
  }
  return true;
}
function achSimpan() {
  try { localStorage.setItem(achKunci(), JSON.stringify(achState)); } catch (e) {}
  pencapaianKeServer();
}
function achTierDari(g, n) {
  var t = 0;
  g.target.forEach(function(x, i) { if (n >= x) t = i + 1; });
  return t;
}
// toast=true: beri tahu bila ada level baru. Pencatatan pertama dilakukan diam-diam.
function achCek(toast, tunda) {
  if (!achSiap()) return;
  var baru = [], ubah = false;
  var s = (typeof questState !== 'undefined' && questState) ? (questState.streak || 0) : 0;
  if (s > achState.bestStreak) { achState.bestStreak = s; ubah = true; }
  ACH_GRUP.forEach(function(g) {
    var t = achTierDari(g, g.nilai());
    var lama = achState.tier[g.id];
    if (lama === undefined) { achState.tier[g.id] = t; ubah = true; }
    else if (t > lama) { achState.tier[g.id] = t; ubah = true; baru.push(g.ico + ' ' + g.nama + ' ' + ACH_TIER[t - 1]); }
  });
  if (ubah) achSimpan();
  if (toast && baru.length) {
    setTimeout(function() { questToast('🏆 Achievement baru! ' + baru.join(' & ')); }, tunda || 0);
  }
}
function achCard(ico, judul, lv, ket, pr, angka, selesai, terkunci, dots) {
  var item = elDiv('qst-item' + (selesai ? ' selesai' : '') + (terkunci ? ' terkunci' : ''));
  item.appendChild(elDiv('qst-ico', ico));
  var body = elDiv('qst-body');
  body.appendChild(elDiv('qst-judul', judul));
  if (lv) body.appendChild(elDiv('ach-lv', lv));
  body.appendChild(elDiv('qst-ket', ket));
  var bar = elDiv('qst-prog'); var isi = document.createElement('i'); isi.style.width = pr + '%'; bar.appendChild(isi);
  body.appendChild(bar);
  if (dots) {
    var d = elDiv('ach-dots');
    for (var i = 0; i < dots.total; i++) { var p = document.createElement('i'); if (i < dots.on) p.className = 'on'; d.appendChild(p); }
    body.appendChild(d);
  }
  item.appendChild(body);
  item.appendChild(elDiv('qst-angka', angka));
  return item;
}
// level yang sedang dipegang (tidak pernah turun)
function achLevelSekarang(g) {
  return Math.max(achTierDari(g, g.nilai()), (achState && achState.tier[g.id]) || 0);
}
function renderHero() {
  var el = document.getElementById('pg-hero');
  if (!el) return;
  el.innerHTML = '';
  var st = (typeof QUEST !== 'undefined' && QUEST.streak) ? QUEST.streak : 0;
  var a = elDiv('pg-chip', st > 0 ? '🔥 ' + st + ' hari beruntun' : '🔥 Mulai streak-mu!');
  el.appendChild(a);
  if (!achSiap()) return;
  var jenis = Object.keys(NAMA_JENIS_KOTOBA), jumlah = 0, total = jenis.length;
  ACH_GRUP.forEach(function(g) { jumlah += achLevelSekarang(g); total += g.target.length; });
  jenis.forEach(function(k) { if (lencanaKotoba[k]) jumlah++; });
  el.appendChild(elDiv('pg-chip b', '🏆 ' + jumlah + '/' + total + ' lencana'));
}
// Sub-tab BELAJAR: angka progres + level berikutnya (data sama dengan Pencapaian)
function renderBelajarLevel() {
  var pane = document.getElementById('pg-belajar-level');
  if (!pane) return;
  pane.innerHTML = '';
  if (!achSiap()) { pane.appendChild(elDiv('qst-kosong', 'Silakan login dulu untuk melihat progres belajar.')); return; }
  achCek(false);
  pane.appendChild(elDiv('ach-label', 'PROGRES & LEVEL'));
  ACH_GRUP.forEach(function(g) {
    var tier = achLevelSekarang(g);
    var n = Math.max(g.nilai(), tier > 0 ? g.target[tier - 1] : 0);
    var maks = tier >= g.target.length;
    var tujuan = maks ? g.target[g.target.length - 1] : g.target[tier];
    var pr = maks ? 100 : Math.min(100, Math.round(n / tujuan * 100));
    var lv = tier > 0 ? (ACH_TIER[tier - 1] + ' · Level ' + tier + '/' + g.target.length) : '🔒 Belum ada level';
    var ket = maks ? g.ket : g.ket + ' · target: ' + ACH_TIER[tier];
    pane.appendChild(achCard(g.ico, g.nama, lv, ket, pr, maks ? '✅ Maks' : (n + '/' + tujuan), maks, tier === 0, { total: g.target.length, on: tier }));
  });
}
// Sub-tab PENCAPAIAN: koleksi lencana dari level di atas + Bintang Kotoba
function renderCapai() {
  var pane = document.getElementById('pg-pane-capai');
  if (!pane) return;
  pane.innerHTML = '';
  if (!achSiap()) { pane.appendChild(elDiv('qst-kosong', 'Silakan login dulu untuk melihat pencapaian.')); return; }
  achCek(false);
  pane.appendChild(elDiv('ach-label', 'LENCANA LEVEL'));
  ACH_GRUP.forEach(function(g) {
    var tier = achLevelSekarang(g);
    var item = elDiv('qst-item' + (tier >= g.target.length ? ' selesai' : '') + (tier === 0 ? ' terkunci' : ''));
    item.appendChild(elDiv('qst-ico', g.ico));
    var body = elDiv('qst-body');
    body.appendChild(elDiv('qst-judul', g.nama));
    body.appendChild(elDiv('qst-ket', tier > 0 ? ACH_TIER[tier - 1] : '🔒 Belum ada lencana'));
    var m = elDiv('pg-medals');
    g.target.forEach(function(t, i) {
      var d = elDiv('pg-medal' + (i < tier ? '' : ' off'), ACH_TIER[i].split(' ')[0]);
      var s = document.createElement('small'); s.textContent = t; d.appendChild(s);
      m.appendChild(d);
    });
    body.appendChild(m);
    item.appendChild(body);
    pane.appendChild(item);
  });
  pane.appendChild(elDiv('ach-label', 'BINTANG KOTOBA'));
  var semuaJenis = Object.keys(NAMA_JENIS_KOTOBA), jumlah = 0;
  var grid = elDiv('pg-stars');
  semuaJenis.forEach(function(j) {
    var ada = !!lencanaKotoba[j];
    if (ada) jumlah++;
    var c = elDiv('pg-star ' + (ada ? 'on' : 'off'));
    c.appendChild(elDiv('', '⭐'));
    c.firstChild.style.fontSize = '22px';
    c.appendChild(document.createTextNode(NAMA_JENIS_KOTOBA[j]));
    grid.appendChild(c);
  });
  pane.appendChild(grid);
  var semua = jumlah >= semuaJenis.length;
  pane.appendChild(achCard('🌟', 'Kolektor Bintang', '', 'Tuntaskan Test Pilihan Ganda (semua bab · semua soal) tiap jenis kotoba', Math.round(jumlah / semuaJenis.length * 100), semua ? '✅ Selesai' : (jumlah + '/' + semuaJenis.length), semua, jumlah === 0, null));
}

// ===== Sinkron Daily Quest (streak) & Achievement ke server, agar tidak hilang saat ganti perangkat =====
var capaiTimer = null;
function pencapaianKeServer() {
  if (!studentName || typeof google === 'undefined') return;
  clearTimeout(capaiTimer);
  var nama = studentName;
  capaiTimer = setTimeout(function() {
    if (nama !== studentName || !achState || !questState) return;
    var data = {
      kanji: Object.keys(achState.kanji || {}),
      test: achState.test || 0,
      bestStreak: achState.bestStreak || 0,
      streak: questState.streak || 0,
      lastDone: questState.lastDone || ''
    };
    try { google.script.run.withFailureHandler(function() {}).simpanPencapaian(nama, JSON.stringify(data)); } catch (e) {}
  }, 1500);
}
// Gabungkan data server ke data perangkat (ambil yang terbesar / terbaru; tidak ada yang berkurang)
function gabungPencapaian(c) {
  if (!questSiap() || !achSiap()) return;
  c = (c && typeof c === 'object') ? c : {};
  (c.kanji || []).forEach(function(ch) { if (ch) achState.kanji[ch] = 1; });
  achState.test = Math.max(achState.test || 0, Number(c.test) || 0);
  achState.bestStreak = Math.max(achState.bestStreak || 0, Number(c.bestStreak) || 0, Number(c.streak) || 0);
  var ld = String(c.lastDone || '');
  if (ld && ld > (questState.lastDone || '')) { questState.lastDone = ld; questState.streak = Number(c.streak) || 0; }
  if (questState.lastDone && questState.lastDone !== questTanggal(0) && questState.lastDone !== questTanggal(-1)) questState.streak = 0;
  achSimpan(); questSimpan();   // sekaligus mengirim data gabungan ke server
}

function setQuestData(d) {
  d = d || {};
  Object.keys(d).forEach(function(k) { QUEST[k] = d[k]; });
  renderQuest();
}
function renderQuest() {
  var s = document.getElementById('mq-streak');
  if (!s) return;
  if (questSiap()) questSusunDaftar();
  var semua = questSemuaSelesai();
  s.textContent = QUEST.streak > 0 ? '🔥 ' + QUEST.streak + ' Hari Berturut-turut!' : '🔥 Mulai streak-mu hari ini!';
  renderProfil();
  renderHero();
  var wrap = document.getElementById('mq-target-wrap');
  if (semua) wrap.innerHTML = '<b id="mq-target">✅ Daily Quest hari ini sudah selesai ya!</b>';
  else wrap.innerHTML = 'Target Hari Ini: <b id="mq-target">' + QUEST.selesai + '/' + QUEST.target + ' Kata</b>';
  var persen = semua ? 100 : (QUEST.target > 0 ? Math.min(100, Math.round(QUEST.selesai / QUEST.target * 100)) : 0);
  document.getElementById('mq-bar').style.width = persen + '%';

  var msg = document.getElementById('qst-selesai-msg'), note = document.getElementById('qst-note');
  if (msg) msg.classList.toggle('hidden', !semua);
  if (note) note.classList.toggle('hidden', semua);

  var box = document.getElementById('qst-list');
  if (!box) return;
  box.innerHTML = '';
  QUEST.daftar.forEach(function(q) {
    var pr = q.max > 0 ? Math.min(100, Math.round(q.now / q.max * 100)) : 0;
    var item = document.createElement('div');
    item.className = 'qst-item' + (q.now >= q.max ? ' selesai' : '');
    var ico = document.createElement('div'); ico.className = 'qst-ico'; ico.textContent = q.ico;
    var body = document.createElement('div'); body.className = 'qst-body';
    var j = document.createElement('div'); j.className = 'qst-judul'; j.textContent = q.judul;
    var k = document.createElement('div'); k.className = 'qst-ket'; k.textContent = q.ket;
    var bar = document.createElement('div'); bar.className = 'qst-prog';
    var isi = document.createElement('i'); isi.style.width = pr + '%'; bar.appendChild(isi);
    body.appendChild(j); body.appendChild(k); body.appendChild(bar);
    var ang = document.createElement('div'); ang.className = 'qst-angka';
    ang.textContent = q.now >= q.max ? '✅ Selesai' : (q.now + '/' + q.max);
    item.appendChild(ico); item.appendChild(body); item.appendChild(ang);
    box.appendChild(item);
  });
}
// ===== TAB PROGRES: Hari Ini (Daily Quest) | Belajar (statistik + level) | Pencapaian (lencana) =====
var progTabAktif = 'hari';
function progTab(nama) {
  if (['hari', 'belajar', 'capai'].indexOf(nama) === -1) nama = 'hari';
  progTabAktif = nama;
  ['hari', 'belajar', 'capai'].forEach(function(t) {
    var tb = document.getElementById('pg-tab-' + t), pn = document.getElementById('pg-pane-' + t);
    if (tb) tb.classList.toggle('aktif', t === nama);
    if (pn) pn.classList.toggle('hidden', t !== nama);
  });
  renderHero();
  if (nama === 'hari') renderQuest();
  else if (nama === 'belajar') { renderBelajarLevel(); bukaRiwayat(); }
  else renderCapai();
}
function bukaProgres() { progTab(progTabAktif); }
// banner Quest di Home -> langsung ke Progres > Hari Ini
function bukaQuest() { progTabAktif = 'hari'; pindahTab('statistik'); }

// ===== MENU BAR BAWAH (Home, Profile, Statistik, Pesan, Setting) =====
var tabAktif = 'home';
var TAB_NAMA = ['home', 'profile', 'statistik', 'pesan', 'setting'];
function pindahTab(nama) {
  if (TAB_NAMA.indexOf(nama) === -1) nama = 'home';
  tabAktif = nama;
  TAB_NAMA.forEach(function(t) {
    var pane = document.getElementById('tab-' + t);
    if (pane) pane.classList.toggle('hidden', t !== nama);
    var btn = document.getElementById(t === 'pesan' ? 'mm-bell' : 'bn-' + t);
    if (btn) btn.classList.toggle('aktif', t === nama);
  });
  if (nama === 'profile') renderProfil();
  else if (nama === 'statistik') bukaProgres();
  else if (nama === 'pesan') bukaNotif();
  else if (nama === 'setting') { var v = document.getElementById('mm-versi'); if (v) v.textContent = APP_VERSI; terapkanTema(temaSaatIni()); }
  window.scrollTo(0, 0);
}
function renderProfil() {
  var n = document.getElementById('pf-nama'); if (!n) return;
  n.textContent = studentName || '-';
  document.getElementById('pf-kelas').textContent = studentClass ? '🎓 Kelas ' + studentClass : '-';
  var st = (typeof QUEST !== 'undefined' && QUEST.streak) ? QUEST.streak : 0;
  document.getElementById('pf-streak').textContent = st > 0 ? '🔥 ' + st + ' Hari Berturut-turut!' : '🔥 Mulai streak-mu hari ini!';
}

// ===== Sapaan di Menu Utama =====
// Salam sesuai jam di perangkat (diperbarui otomatis)
//  05:00-11:00 -> おはようございます | 11:01-18:00 -> こんにちは | 18:01-04:59 -> こんばんは
function perbaruiSalam() {
  var el = document.getElementById('mm-hai');
  if (!el) return;
  var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), teks;
  if (m >= 300 && m <= 660) teks = 'おはようございます 🌅';
  else if (m >= 661 && m <= 1080) teks = 'こんにちは ☀️';
  else teks = 'こんばんは 🌙';
  if (el.textContent !== teks) el.textContent = teks;
}
perbaruiSalam();
setInterval(perbaruiSalam, 15000);
document.addEventListener('visibilitychange', function() { if (!document.hidden) perbaruiSalam(); });

function perbaruiSapaan() {
  var el = document.getElementById('mm-nama');
  if (el) el.textContent = studentName || 'Selamat datang';
  perbaruiSalam();
  setBadgeNotif(0);
  perbaruiNotif();
  muatProgress();
  renderQuest();
  pindahTab('home');
}

// ===== LENCANA / BINTANG KOTOBA =====
var lencanaKotoba = {};
var NAMA_JENIS_KOTOBA = { modul:'N5 (Modul)', irodori:'Irodori 1', irodori2:'Irodori 2', kaigo:'Kaigo', konstruksi:'Konstruksi', kotoba:'Pengolahan Makanan' };
function kunciLencanaLokal() { return 'kotoba_lencana|' + studentName; }
function muatLencanaLokal() {
  try {
    var arr = JSON.parse(localStorage.getItem(kunciLencanaLokal()) || '[]');
    (arr || []).forEach(function(j) { lencanaKotoba[j] = true; });
  } catch (e) {}
  perbaruiLencana();
}
function perbaruiLencana() {
  document.querySelectorAll('.mm-lencana').forEach(function(el) {
    el.classList.toggle('aktif', !!lencanaKotoba[el.getAttribute('data-jenis')]);
  });
}
// true bila lencana baru didapat (belum pernah)
function beriLencanaKotoba(jenis) {
  var baru = !lencanaKotoba[jenis];
  lencanaKotoba[jenis] = true;
  try { localStorage.setItem(kunciLencanaLokal(), JSON.stringify(Object.keys(lencanaKotoba))); } catch (e) {}
  perbaruiLencana();
  if (studentName) {
    google.script.run.withFailureHandler(function() {}).simpanLencanaKotoba(studentName, jenis);
  }
  return baru;
}

// ===== FOTO PROFIL / AVATAR =====
var avatarId = '';
var daftarAvatarCache = null;
function urlAvatar(id, lebar) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (lebar || 200); }
function kunciAvatarLokal() { return 'kotoba_avatar|' + studentName; }
function tampilkanAvatar() {
  [['mm-avatar-img', 'mm-avatar-emoji', 200], ['pf-avatar-img', 'pf-avatar-emoji', 300]].forEach(function(p) {
    var img = document.getElementById(p[0]);
    var emo = document.getElementById(p[1]);
    if (!img || !emo) return;
    if (avatarId) {
      img.onerror = function() { img.classList.add('hidden'); emo.classList.remove('hidden'); };
      img.onload = function() { img.classList.remove('hidden'); emo.classList.add('hidden'); };
      img.src = urlAvatar(avatarId, p[2]);
    } else {
      img.removeAttribute('src');
      img.classList.add('hidden');
      emo.classList.remove('hidden');
    }
  });
}
function muatAvatarLokal() {
  try { avatarId = localStorage.getItem(kunciAvatarLokal()) || ''; } catch (e) { avatarId = ''; }
  tampilkanAvatar();
}
function bukaAvatar() {
  document.getElementById('avatar-modal').classList.remove('modal-hidden');
  var status = document.getElementById('av-status');
  if (daftarAvatarCache) { renderAvatarGrid(); return; }
  document.getElementById('av-grid').innerHTML = '';
  status.textContent = 'Memuat avatar...';
  google.script.run
    .withSuccessHandler(function(list) {
      daftarAvatarCache = list || [];
      renderAvatarGrid();
    })
    .withFailureHandler(function() {
      status.textContent = 'Gagal memuat avatar. Coba lagi nanti.';
    })
    .getDaftarAvatar();
}
function renderAvatarGrid() {
  var grid = document.getElementById('av-grid');
  var status = document.getElementById('av-status');
  grid.innerHTML = '';
  if (!daftarAvatarCache || !daftarAvatarCache.length) {
    status.textContent = 'Belum ada avatar yang tersedia.';
    return;
  }
  status.textContent = daftarAvatarCache.length + ' avatar';
  var gagalAvatar = 0;
  daftarAvatarCache.forEach(function(a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'av-item' + (a.id === avatarId ? ' aktif' : '');
    b.title = a.nama;
    var im = document.createElement('img');
    im.loading = 'lazy';
    im.alt = '';
    im.src = urlAvatar(a.id, 200);
    im.onerror = function() {
      if (!b._coba) {                       // coba sekali lagi (thumbnail baru kadang belum siap)
        b._coba = 1;
        setTimeout(function() { im.src = urlAvatar(a.id, 200) + '&r=' + Date.now(); }, 1500);
        return;
      }
      b.style.display = 'none';
      gagalAvatar++;
      status.textContent = gagalAvatar + ' avatar belum bisa ditampilkan (cek pengaturan berbagi file di Drive).';
    };
    b.appendChild(im);
    b.onclick = function() { pilihAvatar(a.id); };
    grid.appendChild(b);
  });
}
function pilihAvatar(id) {
  avatarId = id;
  try { localStorage.setItem(kunciAvatarLokal(), id); } catch (e) {}
  tampilkanAvatar();
  renderAvatarGrid();
  if (studentName) {
    google.script.run.withFailureHandler(function() {}).simpanAvatar(studentName, id);
  }
  setTimeout(tutupAvatar, 350);
}
function tutupAvatar() {
  document.getElementById('avatar-modal').classList.add('modal-hidden');
}

// ===== Riwayat Belajar: simpan & pulihkan progres =====
var progressUser = '';
var hafalTimer = {};
function simpanHafalKeServer(jenis) {
  if (!studentName || !jenis) return;
  clearTimeout(hafalTimer[jenis]);
  hafalTimer[jenis] = setTimeout(function() {
    var ringkas = (memorizedDataByJenis[jenis] || []).map(function(x) { return [x.kotoba, x.arti]; });
    google.script.run.withFailureHandler(function() {}).simpanHafal(studentName, jenis, JSON.stringify(ringkas));
  }, 700);
}
function muatProgress() {
  if (!studentName || progressUser === studentName) return;
  var nama = studentName;
  progressUser = nama;
  muatLencanaLokal();
  muatAvatarLokal();
  google.script.run
    .withSuccessHandler(function(r) {
      if (!r || nama !== studentName) return;
      if (r.avatar) {
        avatarId = r.avatar;
        try { localStorage.setItem(kunciAvatarLokal(), avatarId); } catch (e) {}
        tampilkanAvatar();
      }
      (r.lencana || []).forEach(function(j) { lencanaKotoba[j] = true; });
      try { localStorage.setItem(kunciLencanaLokal(), JSON.stringify(Object.keys(lencanaKotoba))); } catch (e) {}
      perbaruiLencana();
      Object.keys(r.hafal || {}).forEach(function(j) {
        if (!memorizedDataByJenis[j]) memorizedDataByJenis[j] = [];
        var lokal = memorizedDataByJenis[j];
        (r.hafal[j] || []).forEach(function(p) {
          var ada = lokal.some(function(s) { return s.kotoba === p[0] && s.arti === p[1]; });
          if (!ada) lokal.push({ kotoba: p[0], kanji: p[0], arti: p[1], artinya: p[1] });
        });
      });
      if (typeof bp !== 'undefined') {
        (r.bunpouDone || []).forEach(function(k) { bp.done[k] = true; });
      }
      gabungPencapaian(r.capai);
      achCek(false);
      renderQuest();
    })
    .withFailureHandler(function() { progressUser = ''; })
    .getRiwayatBelajar(nama);
}
function resetProgressLokal() {
  progressUser = '';
  questState = null; questUser = '';
  achState = null; achUser = '';
  lencanaKotoba = {};
  perbaruiLencana();
  avatarId = '';
  tampilkanAvatar();
  Object.keys(memorizedDataByJenis).forEach(function(j) { memorizedDataByJenis[j] = []; });
  if (typeof bp !== 'undefined') { bp.done = {}; }
}

// ===== Detail Belajar (dari server): kotoba per jenis, Bunpou per bab, skor game Kanji Daisuki =====
function bukaRiwayat() {
  var box = document.getElementById('riwayat-isi');
  if (!box) return;
  box.innerHTML = '<div class="notif-kosong">Memuat detail...</div>';
  google.script.run
    .withSuccessHandler(function(r) {
      r = r || {};
      var esc = function(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      var baris = '';
      Object.keys(NAMA_JENIS_KOTOBA).forEach(function(j) {
        var n = (memorizedDataByJenis[j] || []).length;
        if (n) baris += '<div class="rw-baris"><span>📘 ' + esc(NAMA_JENIS_KOTOBA[j]) + '</span><b>' + n + '</b></div>';
      });
      var h = '<div class="ach-label">KOTOBA DIHAFAL PER JENIS</div>' +
              (baris || '<div class="notif-kosong">Belum ada kotoba yang dihafal.</div>') +
              '<div class="ach-label">GAME</div>' +
              '<div class="rw-baris"><span>🎮 Skor tertinggi Kanji Daisuki</span><b>' + (r.kanji || 0) + '</b></div>' +
              '<div class="ach-label">BUNPOU PER BAB</div>' +
              '<div class="rw-bunpou">';
      var babs = r.bunpouBab || [];
      var rk = r.bunpouRingkas || [];
      if (rk.length) {
        h += rk.map(function(b) {
          var tuntas = b.selesai >= b.total;
          return '<div style="margin-top:8px;"><b>' + esc(b.buku + ' ' + b.bab) + '</b> — ' + b.selesai + '/' + b.total + ' pola' + (tuntas ? ' (Selesai ✅)' : '') +
                 '<ul>' + b.judul.map(function(x) { return '<li>' + esc(x) + ' ⭐</li>'; }).join('') + '</ul></div>';
        }).join('');
      } else if (babs.length) {
        h += '<ul>' + babs.map(function(b) { return '<li>' + esc(b) + ' (Selesai)</li>'; }).join('') + '</ul>';
      } else {
        h += '<div style="color:#64748b;">Belum ada pola yang selesai.</div>';
      }
      h += '</div>';
      box.innerHTML = h;
    })
    .withFailureHandler(function() {
      box.innerHTML = '<div class="notif-kosong">Gagal memuat detail belajar.</div>';
    })
    .getRiwayatBelajar(studentName);
}
function tutupRiwayat() { pindahTab('home'); }

// ===== Notifikasi balasan Sensei (lonceng) =====
function setBadgeNotif(n) {
  var b = document.getElementById('notif-badge'), bell = document.getElementById('mm-bell');
  if (!b || !bell) return;
  if (n > 0) { b.textContent = n > 9 ? '9+' : String(n); b.classList.remove('hidden'); bell.classList.add('ada'); }
  else { b.classList.add('hidden'); bell.classList.remove('ada'); }
}
function perbaruiNotif() {
  if (!studentName) return;
  try {
    google.script.run
      .withSuccessHandler(function(r) {
        if (!r) return;
        if (tabAktif === 'pesan' && (r.jumlah || 0) > 0) { bukaNotif(); return; }
        setBadgeNotif(r.jumlah || 0);
      })
      .withFailureHandler(function() {})
      .getNotifikasi(studentName);
  } catch (e) {}
}
function bukaNotif() {
  var box = document.getElementById('notif-list');
  if (!box) return;
  box.innerHTML = '<div class="notif-kosong">Memuat...</div>';
  google.script.run
    .withSuccessHandler(function(r) {
      renderNotif(r);
      if (r && r.jumlah > 0) {
        setBadgeNotif(0);
        google.script.run.withFailureHandler(function() {}).tandaiNotifDibaca(studentName);
      }
    })
    .withFailureHandler(function() {
      box.innerHTML = '<div class="notif-kosong">Gagal memuat notifikasi.</div>';
    })
    .getNotifikasi(studentName);
}
function tutupNotif() { pindahTab('home'); }
function fmtTglChat(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  if (!m) return s || '';
  var bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return parseInt(m[3], 10) + ' ' + bln[parseInt(m[2], 10) - 1] + ' ' + m[1];
}
function elDiv(cls, teks) {
  var d = document.createElement('div');
  d.className = cls;
  if (teks !== undefined) d.textContent = teks;
  return d;
}
function renderNotif(r) {
  var box = document.getElementById('notif-list');
  box.innerHTML = '';
  if (!r || !r.daftar || !r.daftar.length) {
    box.className = 'notif-list';
    box.appendChild(elDiv('notif-kosong', 'Belum ada balasan dari Sensei.'));
    return;
  }
  box.className = 'notif-list chat';
  var pembatas = null;
  r.daftar.forEach(function(g) {
    var chip = elDiv('chat-tgl');
    var sp = document.createElement('span');
    sp.textContent = fmtTglChat(g.tgl);
    chip.appendChild(sp);
    box.appendChild(chip);
    var sebelumnya = '';
    g.pesan.forEach(function(p) {
      if (p.baru && !pembatas) {
        pembatas = elDiv('chat-baru');
        var sb = document.createElement('span');
        sb.textContent = 'Pesan baru';
        pembatas.appendChild(sb);
        box.appendChild(pembatas);
      }
      var b = elDiv('bub ' + (p.dari === 'saya' ? 'me' : 'sen'));
      if (p.dari === 'sensei' && sebelumnya !== 'sensei') b.appendChild(elDiv('bub-nama', 'Sensei'));
      b.appendChild(elDiv('bub-teks', p.teks));
      if (p.jam) b.appendChild(elDiv('bub-jam', p.jam));
      box.appendChild(b);
      sebelumnya = p.dari;
    });
  });
  // seperti WhatsApp: lompat ke "Pesan baru", jika tidak ada ke pesan terakhir
  box.scrollTop = pembatas ? Math.max(0, pembatas.offsetTop - 8) : box.scrollHeight;
}

// ===== Saran & Masukan (disimpan ke sheet users kolom J) =====
function bukaMasukan() {
  document.getElementById('masukan-teks').value = '';
  hitungMasukan();
  document.getElementById('masukan-modal').classList.remove('modal-hidden');
}
function tutupMasukan() {
  document.getElementById('masukan-modal').classList.add('modal-hidden');
}
function hitungMasukan() {
  var n = document.getElementById('masukan-teks').value.length;
  document.getElementById('masukan-hitung').textContent = n + ' / 1000';
}
function kirimMasukan() {
  var teks = document.getElementById('masukan-teks').value.trim();
  if (!teks) {
    tampilkanCustomAlert("Perhatian ⚠️", "Masukan masih kosong. Silakan tulis dulu.");
    return;
  }
  var btn = document.getElementById('masukan-kirim');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  function pulihkan() { btn.disabled = false; btn.textContent = 'Kirim'; }
  google.script.run
    .withSuccessHandler(function() {
      pulihkan();
      tutupMasukan();
      tampilkanCustomAlert("Terima kasih! 🙏", "Masukan Anda sudah terkirim.");
    })
    .withFailureHandler(function(err) {
      pulihkan();
      tampilkanCustomAlert("Gagal ❌", (err && err.message) ? err.message : "Masukan belum terkirim. Coba lagi.");
    })
    .simpanMasukan(studentName, teks);
}

function bukaModalLogout() {
  document.getElementById('custom-logout-modal').classList.remove('modal-hidden');
}

function tutupModalLogout() {
  document.getElementById('custom-logout-modal').classList.add('modal-hidden');
}

function prosesLogout() {
  simpanProgresTest();
  testBerjalan = false;
  tutupModalLogout();
  localStorage.removeItem("kotoba_logged_user");
  localStorage.removeItem("kotoba_logged_class");
  resetProgressLokal();
  document.getElementById('main-menu-page').classList.add('hidden');
  document.getElementById('menu-page').classList.add('hidden');
  ['kanji-main-page', 'kanji-list-page', 'kanji-detail-page'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.getElementById('input-nama').value = "";
  document.getElementById('input-password').value = "";
  document.getElementById('student-identity-page').classList.remove('hidden');
}

// ===== UPDATE APLIKASI (.apk) =====
// Alamat version.json di hosting GitHub Pages (satu folder dengan index.html).
var URL_VERSI_APK = 'https://prasuteja-lang.github.io/kotoba-daisuki/version.json';
var apkInfoTerbaru = null;
// URL Web App Apps Script yang membaca folder Google Drive berisi APK (lihat update-drive.gs). Kosong = pakai version.json lama.
var URL_UPDATE_DRIVE = 'https://script.google.com/macros/s/AKfycbxlH1WrIaYy3gopjfkzjayPoCIRLm2y38DGybpKosRgMZb25MHMshFI-Ui-FqNtmLO8/exec';
var KUNCI_APK_TERPASANG = 'kotoba_apk_terpasang';

// Versi APK yang terpasang, dibaca lewat jembatan Android (AppInfo). null = tidak bisa dibaca.
function versiApkTerpasang() {
  try {
    if (window.AppInfo && AppInfo.versionCode) {
      var kode = Number(AppInfo.versionCode());
      if (kode > 0) return { code: kode, name: String(AppInfo.versionName()) };
    }
  } catch (e) {}
  return null;
}

function tampilUpdateApp(judul, pesan, bisaUnduh) {
  document.getElementById('ua-title').innerText = judul;
  document.getElementById('ua-msg').innerText = pesan;
  document.getElementById('ua-unduh').classList.toggle('hidden', !bisaUnduh);
  document.getElementById('update-app-modal').classList.remove('modal-hidden');
}

function tutupUpdateApp() {
  document.getElementById('update-app-modal').classList.add('modal-hidden');
}

function formatTanggalApk(n) {
  var s = String(n);
  return s.length === 8 ? s.slice(6, 8) + '-' + s.slice(4, 6) + '-' + s.slice(0, 4) : '';
}
function cekUpdateDrive() {
  apkInfoTerbaru = null;
  tampilUpdateApp('Update Aplikasi', 'Memeriksa versi terbaru...', false);
  fetch(URL_UPDATE_DRIVE + (URL_UPDATE_DRIVE.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(res) {
      if (!res || !res.ok) throw new Error((res && res.pesan) || 'respon tidak valid');
      var f = res.terbaru;
      if (!f) {
        tampilUpdateApp('Update Aplikasi', 'Belum ada file APK di folder update.', false);
        return;
      }
      var pen = { id: f.id, nama: f.nama, tanggal: f.tanggal || 0, diubah: f.diubah || 0 };
      var lama = null;
      try { lama = JSON.parse(localStorage.getItem(KUNCI_APK_TERPASANG) || 'null'); } catch (e) {}
      var sudahTerbaru = lama && lama.id === pen.id && lama.diubah === pen.diubah;      // file yang sama dan tidak diganti
      if (sudahTerbaru) {
        tampilUpdateApp('Sudah Terbaru ✅', 'Versi Aplikasi sudah terbaru!\n(' + pen.nama + ')', false);
        return;
      }
      apkInfoTerbaru = {
        apkUrl: 'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(pen.id) + '&export=download&confirm=t',
        versionName: pen.tanggal ? formatTanggalApk(pen.tanggal) : pen.nama,
        penanda: pen
      };
      unduhApkTerbaru();                                                                    // ada file lebih baru -> unduh otomatis
    })
    .catch(function() {
      tampilUpdateApp('Gagal Memeriksa',
        'Tidak bisa membaca folder update. Periksa internet kamu lalu coba lagi.', false);
    });
}

function cekUpdateAplikasi() {
  if (URL_UPDATE_DRIVE) { cekUpdateDrive(); return; }
  apkInfoTerbaru = null;
  tampilUpdateApp('Update Aplikasi', 'Memeriksa versi terbaru...', false);

  fetch(URL_VERSI_APK + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(info) {
      apkInfoTerbaru = info;
      var pasang = versiApkTerpasang();
      var catatan = info.catatan ? '\n\n' + info.catatan : '';

      if (!pasang) {
        tampilUpdateApp('Update Aplikasi',
          'Versi terbaru: ' + info.versionName + '\nVersi di HP ini tidak bisa dibaca otomatis. Unduh versi terbaru lalu pasang.' + catatan, true);
      } else if (Number(info.versionCode) > pasang.code) {
        // Ada versi baru -> langsung unduh otomatis
        unduhApkTerbaru();
      } else {
        tampilUpdateApp('Sudah Terbaru ✅',
          'Aplikasi kamu sudah versi terbaru (' + pasang.name + ').', false);
      }
    })
    .catch(function() {
      tampilUpdateApp('Gagal Memeriksa',
        'Tidak bisa terhubung ke server update. Periksa internet kamu lalu coba lagi.', false);
    });
}

function unduhApkTerbaru() {
  if (!apkInfoTerbaru || !apkInfoTerbaru.apkUrl) return;
  var url = String(apkInfoTerbaru.apkUrl);
  if (!/^https:\/\//.test(url)) return;
  if (apkInfoTerbaru.penanda) {                                  // catat file yang diunduh agar pengecekan berikutnya tahu sudah terbaru
    try { localStorage.setItem(KUNCI_APK_TERPASANG, JSON.stringify(apkInfoTerbaru.penanda)); } catch (e) {}
  }

  // Cara 1: unduh langsung lewat Android (muncul di notifikasi)
  var jalan = false;
  try { if (window.AppInfo && AppInfo.unduhApk) jalan = AppInfo.unduhApk(url); } catch (e) {}
  if (jalan) {
    tampilUpdateApp('Mengunduh Update ⬇️',
      'Versi baru ' + (apkInfoTerbaru.versionName || '') + ' sedang diunduh.\n\nLihat notifikasi di bagian atas HP. Setelah selesai, ketuk notifikasinya lalu pilih "Pasang / Install".', false);
    return;
  }

  // Cara 2 (cadangan): buka link di browser HP
  if (window.AppInfo && AppInfo.bukaLink) AppInfo.bukaLink(url);
  else window.open(url, '_blank');
  tutupUpdateApp();
}

function tampilkanCustomAlert(title, message, callback) {
  document.getElementById('c-alert-title').innerText = title;
  document.getElementById('c-alert-msg').innerText = message;
  customAlertCallback = callback || null;
  document.getElementById('custom-alert-modal').classList.remove('modal-hidden');
}

function tutupCustomAlert() {
  document.getElementById('custom-alert-modal').classList.add('modal-hidden');
  if (typeof customAlertCallback === 'function') {
    var cb = customAlertCallback;
    customAlertCallback = null;
    cb();
  }
}

function bukaMenuKotoba(jenis, kategori) {
  currentJenis = jenis;
  currentMenu = kategori;
  document.getElementById('judul-menu-terpilih').innerText = kategori;

  if (!memorizedDataByJenis[currentJenis]) {
    memorizedDataByJenis[currentJenis] = [];
  }

  var container = document.getElementById('bab-container');
  container.innerHTML = "";
  container.setAttribute('data-jenis', currentJenis);

  var totalBab = 3;
  if (jenis === 'irodori' || jenis === 'irodori2') {
    totalBab = 18;
  } else if (jenis === 'modul') {
    totalBab = 15;
  } else if (jenis === 'konstruksi') {
    totalBab = 7;
  } else if (jenis === 'kaigo') {
    totalBab = 19;
  }

  for (var i = 1; i <= totalBab; i++) {
    var babName = "Bab " + i;
    container.innerHTML += '<button class="btn-bab" onclick="pilihBab(\'' + babName + '\')"><span class="bb-no">' + i + '</span><span class=\"bb-lb\">Bab</span></button>';
  }
  container.innerHTML += '<button class="btn-bab btn-bab-all" onclick="pilihBab(\'Semua bab\')"><span class="bb-no">📚</span><span>Semua Bab</span></button>';

  document.getElementById('menu-page').classList.add('hidden');
  document.getElementById('bab-page').classList.remove('hidden');
}

// ===== Navigasi Menu Utama <-> Submenu Kotoba/Kanji =====
function bukaKotobaDariMain() {
  document.getElementById('main-menu-page').classList.add('hidden');
  document.getElementById('menu-page').classList.remove('hidden');
}

function kembaliKeMenuUtama() {
  document.getElementById('menu-page').classList.add('hidden');
  document.getElementById('main-menu-page').classList.remove('hidden');
}

function bukaMenuTest() {
  simpanProgresTest();
  testBerjalan = false;
  stopTimer();
  document.getElementById('judul-test-menu').innerText = "TEST - " + currentMenu;
  var container = document.getElementById('test-bab-container');
  container.innerHTML = "";
  container.setAttribute('data-jenis', currentJenis);

  var totalBab = 3;
  if (currentJenis === 'irodori' || currentJenis === 'irodori2') {
    totalBab = 18;
  } else if (currentJenis === 'modul') {
    totalBab = 15;
  } else if (currentJenis === 'konstruksi') {
    totalBab = 7;
  } else if (currentJenis === 'kaigo') {
    totalBab = 19;
  }

  for (var i = 1; i <= totalBab; i++) {
    var babName = "Bab " + i;
    container.innerHTML += '<button class="btn-bab" onclick="mulaiTest(\'' + babName + '\')"><span class="bb-no">' + i + '</span><span class=\"bb-lb\">Bab</span></button>';
  }
  container.innerHTML += '<button class="btn-bab btn-bab-all" onclick="mulaiTest(\'Semua bab\')"><span class="bb-no">📚</span><span>Semua Bab</span></button>';

  document.getElementById('data-page').classList.add('hidden');
  document.getElementById('bab-page').classList.add('hidden');
  document.getElementById('quiz-page').classList.add('hidden');
  document.getElementById('write-quiz-page').classList.add('hidden');
  document.getElementById('joyquiz-page').classList.add('hidden');
  document.getElementById('select-test-type-page').classList.add('hidden');
  document.getElementById('test-bab-page').classList.remove('hidden');
}

// [DIPERBAIKI]: Tombol TEST KOTOBA dari halaman daftar kotoba langsung menuju ke pemilihan mode test untuk bab aktif
function bukaMenuTestDariBab() {
  simpanProgresTest();
  testBerjalan = false;
  stopTimer();
  selectedBabForTest = currentBab;
  // Jumlah soal test mengikuti pilihan dropdown "Jumlah Kotoba" di halaman daftar kotoba
  var limitSelectEl = document.getElementById('limitSelect');
  totalQuizLimitVal = limitSelectEl ? limitSelectEl.value : "Semua";

  document.getElementById('data-page').classList.add('hidden');
  document.getElementById('quiz-page').classList.add('hidden');
  document.getElementById('write-quiz-page').classList.add('hidden');
  document.getElementById('joyquiz-page').classList.add('hidden');

  document.getElementById('judul-mode-test').innerText = "Mode Test - " + selectedBabForTest;

  var btnModeDokkai = document.getElementById('btn-mode-dokkai');
  if (btnModeDokkai) {
    if (currentJenis === 'irodori' || currentJenis === 'irodori2') {
      btnModeDokkai.style.display = "flex";
    } else {
      btnModeDokkai.style.display = "none";
    }
  }

  document.getElementById('select-test-type-page').classList.remove('hidden');
  perbaruiInfoProgres();
}

function kembaliDariTestBab() {
  document.getElementById('test-bab-page').classList.add('hidden');
  document.getElementById('data-page').classList.remove('hidden');
}

function mulaiTest(bab) {
  selectedBabForTest = bab;
  totalQuizLimitVal = document.getElementById('quizLimitSelect') ? document.getElementById('quizLimitSelect').value : "10";
  document.getElementById('test-bab-page').classList.add('hidden');

  document.getElementById('judul-mode-test').innerText = "Mode Test - " + selectedBabForTest;

  var btnModeDokkai = document.getElementById('btn-mode-dokkai');
  if (btnModeDokkai) {
    if (currentJenis === 'irodori' || currentJenis === 'irodori2') {
      btnModeDokkai.style.display = "flex";
    } else {
      btnModeDokkai.style.display = "none";
    }
  }

  document.getElementById('select-test-type-page').classList.remove('hidden');
  perbaruiInfoProgres();
}

function kembaliDariModeTest() {
  document.getElementById('select-test-type-page').classList.add('hidden');
  document.getElementById('data-page').classList.remove('hidden');
}

// ===== SIMPAN & LANJUTKAN PROGRES TEST (Pilihan Ganda & Tulis) =====
var testBerjalan = false;      // true selama test pg/tulis sedang dikerjakan
var testNextIndex = 0;         // nomor soal berikutnya yang belum dijawab
var resetProgresCtx = null;

function kunciProgres(mode) {
  return 'kotoba_prog|' + studentName + '|' + currentJenis + '|' + selectedBabForTest + '|' + mode + '|' + totalQuizLimitVal;
}
function bacaProgres(mode) {
  try {
    var raw = localStorage.getItem(kunciProgres(mode));
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (!d || !d.q || !d.q.length || d.i <= 0 || d.i >= d.q.length) return null;
    return d;
  } catch (e) { return null; }
}
function simpanProgresTest() {
  if (!testBerjalan || !quizQuestions.length) return;
  if (testNextIndex <= 0) return; // belum ada soal yang dijawab
  var data = {
    q: quizQuestions, i: testNextIndex, s: quizScore,
    sw: isStopwatchMode, el: elapsedSecondsCount, rem: timeRemainingSeconds,
    tot: Math.floor((Date.now() - testStartTimeTimestamp) / 1000)
  };
  try { localStorage.setItem(kunciProgres(currentTestMode), JSON.stringify(data)); } catch (e) {}
}
function hapusProgresTest(mode) {
  try { localStorage.removeItem(kunciProgres(mode || currentTestMode)); } catch (e) {}
}
function perbaruiInfoProgres() {
  [['pg', 'Pilih jawaban yang paling tepat'], ['tulis', 'Ketik cara baca dengan hiragana']].forEach(function(m) {
    var d = bacaProgres(m[0]);
    var info = document.getElementById('prog-info-' + m[0]);
    if (!info) return;
    if (d) {
      info.textContent = 'Lanjut dari soal ' + (d.i + 1) + ' / ' + d.q.length;
      info.classList.add('prog-info');
    } else {
      info.textContent = m[1];
      info.classList.remove('prog-info');
    }
  });
}
function konfirmasiResetProgres(mode, dariSoal) {
  resetProgresCtx = { mode: mode, dariSoal: dariSoal };
  document.getElementById('reset-progres-msg').innerText = dariSoal
    ? 'Test akan diulang dari soal pertama dengan soal baru dan skor kembali ke 0. Lanjutkan?'
    : 'Progres test sebelumnya akan dihapus dan kamu mulai lagi dari awal. Lanjutkan?';
  document.getElementById('reset-progres-modal').classList.remove('modal-hidden');
}
function tutupResetProgres() {
  document.getElementById('reset-progres-modal').classList.add('modal-hidden');
  resetProgresCtx = null;
}
function prosesResetProgres() {
  var c = resetProgresCtx;
  document.getElementById('reset-progres-modal').classList.add('modal-hidden');
  resetProgresCtx = null;
  if (!c) return;
  hapusProgresTest(c.mode);
  perbaruiInfoProgres();
  if (c.dariSoal) {
    stopTimer();
    testBerjalan = false;
    lanjutkanTest(c.mode);
  }
}
// simpan juga saat aplikasi ditutup / pindah tab
document.addEventListener('visibilitychange', function() { if (document.hidden) simpanProgresTest(); });
window.addEventListener('pagehide', simpanProgresTest);

function lanjutkanTest(mode) {
  catatAktivitas('Test kotoba', ({pg:'Test pilihan ganda', tulis:'Test Tulis kotoba', joyquiz:'JoyFlash'})[mode] || mode, true);
  currentTestMode = mode;
  document.getElementById('select-test-type-page').classList.add('hidden');

  var timerEl = document.getElementById('quiz-timer');
  if (timerEl) {
    if (currentTestMode === 'pg') {
      timerEl.classList.remove('hidden');
    } else {
      timerEl.classList.add('hidden');
    }
  }

  if (currentTestMode === 'pg') {
    document.getElementById('quiz-page').classList.remove('hidden');
    document.getElementById('quiz-reading').innerText = "Memuat...";
    document.getElementById('quiz-meaning').innerText = "Menyiapkan soal...";
    document.getElementById('quiz-options-container').innerHTML = "";

    var simpanan = bacaProgres('pg');
    if (simpanan) {
      quizQuestions = simpanan.q;
      currentQuizIndex = simpanan.i;
      testNextIndex = simpanan.i;
      quizScore = simpanan.s;
      mulaiTimerLanjutan(simpanan);
      testBerjalan = true;
      tampilkanSoalQuiz();
      return;
    }

    google.script.run.withSuccessHandler(function(data) {
      if (!data || data.length === 0) {
        tampilkanCustomAlert("Informasi ℹ️", "Tidak ada data soal untuk bab ini.");
        document.getElementById('select-test-type-page').classList.remove('hidden');
        perbaruiInfoProgres();
        return;
      }
      quizQuestions = data;
      currentQuizIndex = 0;
      testNextIndex = 0;
      quizScore = 0;
      setupTimerAndStart(totalQuizLimitVal, quizQuestions.length);
      testBerjalan = true;
      tampilkanSoalQuiz();
    }).getQuizData(currentJenis, selectedBabForTest, totalQuizLimitVal);

  } else if (currentTestMode === 'joyquiz') {
    document.getElementById('joyquiz-page').classList.remove('hidden');
    document.getElementById('fc-kanji').innerText = "Memuat...";
    document.getElementById('fc-answer-container').classList.add('hidden');

    google.script.run.withSuccessHandler(function(data) {
      if (!data || data.length === 0) {
        tampilkanCustomAlert("Informasi ℹ️", "Tidak ada data kotoba untuk bab ini.");
        document.getElementById('select-test-type-page').classList.remove('hidden');
        return;
      }
      flashcardQuestions = data.sort(function() { return 0.5 - Math.random(); });
      var limitNum = (totalQuizLimitVal === 'Semua') ? flashcardQuestions.length : parseInt(totalQuizLimitVal, 10);
      flashcardQuestions = flashcardQuestions.slice(0, limitNum);

      currentFcIndex = 0;
      tampilkanFlashcard();
    }).getKotoba(currentJenis, selectedBabForTest, "Semua");

  } else {
    document.getElementById('write-quiz-page').classList.remove('hidden');
    document.getElementById('write-kanji').innerText = "Memuat...";
    document.getElementById('write-meaning').innerText = "";

    var simpananT = bacaProgres('tulis');
    if (simpananT) {
      quizQuestions = simpananT.q;
      currentQuizIndex = simpananT.i;
      testNextIndex = simpananT.i;
      quizScore = simpananT.s;
      mulaiTimerLanjutan(simpananT);
      testBerjalan = true;
      tampilkanSoalTulis();
      return;
    }

    google.script.run.withSuccessHandler(function(data) {
      if (!data || data.length === 0) {
        tampilkanCustomAlert("Informasi ℹ️", "Tidak ada data soal untuk bab ini.");
        document.getElementById('select-test-type-page').classList.remove('hidden');
        perbaruiInfoProgres();
        return;
      }
      quizQuestions = data.sort(function() { return 0.5 - Math.random(); });
      var limitNum = (totalQuizLimitVal === 'Semua') ? quizQuestions.length : parseInt(totalQuizLimitVal, 10);
      quizQuestions = quizQuestions.slice(0, limitNum);

      currentQuizIndex = 0;
      testNextIndex = 0;
      quizScore = 0;
      setupTimerAndStart(totalQuizLimitVal, quizQuestions.length);
      testBerjalan = true;
      tampilkanSoalTulis();
    }).withFailureHandler(function(err) {
      tampilkanCustomAlert("Error ⚠️", "Gagal memuat soal: " + err.message);
      document.getElementById('select-test-type-page').classList.remove('hidden');
    }).getTulisKotoba(currentJenis, selectedBabForTest);
  }
}

var flashcardQuestions = [];
var currentFcIndex = 0;
var isAnswerRevealed = false;

function tampilkanFlashcard() {
  if (flashcardQuestions.length === 0) return;

  var q = flashcardQuestions[currentFcIndex];
  document.getElementById('joyquiz-progress').innerText = "Kartu " + (currentFcIndex + 1) + " / " + flashcardQuestions.length;

  document.getElementById('fc-kanji').innerText = q.kotoba;
  document.getElementById('fc-baca').innerText = "" + q.carabaca;
  document.getElementById('fc-arti').innerText = "" + q.arti;

  isAnswerRevealed = false;
  document.getElementById('fc-answer-container').classList.add('hidden');
}

function flipFlashcard() {
  var ansContainer = document.getElementById('fc-answer-container');
  if (isAnswerRevealed) {
    ansContainer.classList.add('hidden');
    isAnswerRevealed = false;
  } else {
    ansContainer.classList.remove('hidden');
    isAnswerRevealed = true;
  }
}

function lanjutkanFlashcard(arah) {
  currentFcIndex += arah;
  if (currentFcIndex < 0) {
    currentFcIndex = 0;
  } else if (currentFcIndex >= flashcardQuestions.length) {
    tampilkanCustomAlert("Selesai! 🎉", "Kamu telah menyelesaikan semua JoyFlash untuk bab ini.", function() {
      document.getElementById('joyquiz-page').classList.add('hidden');
      document.getElementById('data-page').classList.remove('hidden');
    });
    return;
  }
  tampilkanFlashcard();
}

function setupTimerAndStart(limitVal, actualLength) {
  testStartTimeTimestamp = Date.now();

  if (limitVal === "Semua") {
    isStopwatchMode = true;
    elapsedSecondsCount = 0;
  } else {
    isStopwatchMode = false;
    var minutesMap = { "10": 3, "20": 5, "30": 10, "50": 20, "100": 30 };
    var allocatedMins = minutesMap[limitVal] || 3;
    timeRemainingSeconds = allocatedMins * 60;
  }

  startTimerEngine();
}

function mulaiTimerLanjutan(d) {
  isStopwatchMode = !!d.sw;
  elapsedSecondsCount = d.el || 0;
  timeRemainingSeconds = d.rem || 0;
  if (!isStopwatchMode && timeRemainingSeconds <= 0) timeRemainingSeconds = 60;
  testStartTimeTimestamp = Date.now() - ((d.tot || 0) * 1000);
  startTimerEngine();
}

function startTimerEngine() {
  stopTimer();
  updateTimerDisplay();

  timerInterval = setInterval(function() {
    if (isStopwatchMode) {
      elapsedSecondsCount++;
      updateTimerDisplay();
    } else {
      timeRemainingSeconds--;
      updateTimerDisplay();

      if (timeRemainingSeconds <= 0) {
        stopTimer();
        handleTimeOut();
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  var timerElId = (currentTestMode === 'pg') ? 'quiz-timer' : 'write-timer';
  var el = document.getElementById(timerElId);
  if (!el) return;

  if (isStopwatchMode) {
    var mins = Math.floor(elapsedSecondsCount / 60);
    var secs = elapsedSecondsCount % 60;
    var formattedTime = (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
    el.innerText = "⏱️ " + formattedTime + " (Maju)";
  } else {
    var mins = Math.floor(timeRemainingSeconds / 60);
    var secs = timeRemainingSeconds % 60;
    var formattedTime = (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
    el.innerText = "⏱️ " + formattedTime;
  }
}

function calculateCompletionTime() {
  if (isStopwatchMode) {
    var mins = Math.floor(elapsedSecondsCount / 60);
    var secs = elapsedSecondsCount % 60;
    if (mins > 0) {
      completionTimeFormatted = mins + " menit " + secs + " detik";
    } else {
      completionTimeFormatted = secs + " detik";
    }
  } else {
    var elapsedMilliseconds = Date.now() - testStartTimeTimestamp;
    var totalElapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    var mins = Math.floor(totalElapsedSeconds / 60);
    var secs = totalElapsedSeconds % 60;

    if (mins > 0) {
      completionTimeFormatted = mins + " menit " + secs + " detik";
    } else {
      completionTimeFormatted = secs + " detik";
    }
  }
}

function handleTimeOut() {
  calculateCompletionTime();
  isAnswering = true;

  if (currentTestMode === 'pg') {
    var allButtons = document.querySelectorAll('.btn-option');
    var q = quizQuestions[currentQuizIndex];
    allButtons.forEach(function(b) {
      if (b.innerText === q.kunci) {
        b.classList.add('correct');
      } else {
        b.classList.add('wrong');
      }
    });
  } else {
    var inputField = document.getElementById('user-write-input');
    inputField.style.borderColor = "#ef4444";
    inputField.style.backgroundColor = "#fef2f2";
  }

  setTimeout(function() {
    if (currentTestMode === 'tulis') {
      var inputField = document.getElementById('user-write-input');
      inputField.style.borderColor = "#cbd5e1";
      inputField.style.backgroundColor = "#ffffff";
    }

    currentQuizIndex++;
    selesaikanTestOtomatis();
  }, 1000);
}

function getRankTitle(score) {
  if (score >= 96) return "Immortal 👑";
  if (score >= 81) return "Glory 🔥";
  if (score >= 61) return "Honor ⚡";
  if (score >= 41) return "Legend 🎯";
  if (score >= 21) return "Epic 🛡️";
  return "Warrior 🌱";
}

function selesaikanTestOtomatis() {
  stopTimer();
  calculateCompletionTime();
  testBerjalan = false;
  hapusProgresTest(currentTestMode);

  var jenisTestNama = (currentTestMode === 'pg') ? "Test Pilihan Ganda" : ((currentTestMode === 'joyquiz') ? "JoyQuiz" : "Test Tulis Kotoba");

  var totalSoal = quizQuestions.length;
  var jumlahBenar = Math.round(quizScore / 10);
  var jumlahSalah = totalSoal - jumlahBenar;
  if (jumlahSalah < 0) jumlahSalah = 0;

  // Test Tulis Kotoba tidak bisa lanjut kalau salah, jadi baris Benar/Salah tidak ditampilkan
  var barisBenarSalah = (currentTestMode === 'tulis') ? "" : "✅ Benar: " + jumlahBenar + " | ❌ Salah: " + jumlahSalah + "\n";

  var keteranganJenisTest = currentMenu + ", " + selectedBabForTest + " (" + jenisTestNama + ")";
  var rankUnik = getRankTitle(quizScore);

  // Quest harian: Test Pilihan Ganda dikerjakan sampai semua soal terjawab
  if (currentTestMode === 'pg' && totalSoal > 0 && currentQuizIndex >= totalSoal) questCatatTest();

  // Bintang: seluruh kotoba satu jenis sudah dijawab di Test Pilihan Ganda (Semua bab + Semua soal)
  var teksLencana = "";
  if (currentTestMode === 'pg' && selectedBabForTest === 'Semua bab' && totalQuizLimitVal === 'Semua' &&
      totalSoal > 0 && currentQuizIndex >= totalSoal) {
    var lencanaBaru = beriLencanaKotoba(currentJenis);
    var namaJenisL = NAMA_JENIS_KOTOBA[currentJenis] || currentMenu;
    teksLencana = lencanaBaru
      ? "\n\n⭐ SELAMAT! Kamu mendapat Bintang untuk Kotoba " + namaJenisL + " karena menuntaskan seluruh " + totalSoal + " kotoba!"
      : "\n\n⭐ Bintang Kotoba " + namaJenisL + " sudah kamu miliki.";
  }

  document.getElementById('quiz-page').classList.add('hidden');
  document.getElementById('write-quiz-page').classList.add('hidden');

  tampilkanCustomAlert("Test Selesai! 🎉",
    "User: " + studentName + "\n" +
    "Kelas: " + studentClass + "\n" +
    "Test: " + keteranganJenisTest + "\n" +
    "Jumlah Soal: " + totalSoal + " Soal\n" +
    barisBenarSalah +
    "Waktu Pengerjaan: " + completionTimeFormatted + "\n" +
    "Skor Akhir: " + quizScore + "\n\n" +
    "Your Rank: " + rankUnik + teksLencana,
    function() {
      document.getElementById('data-page').classList.remove('hidden');
    }
  );
}

function tampilkanSoalQuiz() {
  isAnswering = false;
  var q = quizQuestions[currentQuizIndex];

  document.getElementById('quiz-progress').innerText = "Soal " + (currentQuizIndex + 1) + " / " + quizQuestions.length;

  if (q.type === 0) {
    document.getElementById('quiz-reading').innerText = q.kotoba;
    document.getElementById('quiz-meaning').innerText = q.carabaca;
  } else {
    document.getElementById('quiz-reading').innerText = q.arti;
    document.getElementById('quiz-meaning').innerText = "Apa bahasa Jepang/kanji dari kata di atas?";
  }

  var optionsContainer = document.getElementById('quiz-options-container');
  optionsContainer.innerHTML = "";

  q.pilihan.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.className = 'btn-option';
    btn.innerText = opt;
    btn.onclick = function() { cekJawaban(opt, q.kunci, btn); };
    optionsContainer.appendChild(btn);
  });
}

function cekJawaban(pilihanUser, kunci, btnElement) {
  if (isAnswering) return;
  isAnswering = true;

  var allButtons = document.querySelectorAll('.btn-option');
  allButtons.forEach(function(b) {
    if (b.innerText === kunci) {
      b.classList.add('correct');
    }
  });

  if (pilihanUser === kunci) {
    quizScore += 10;
  } else {
    btnElement.classList.add('wrong');
  }
  testNextIndex = currentQuizIndex + 1;
  simpanProgresTest();

  setTimeout(function() {
    currentQuizIndex++;
    if (currentQuizIndex < quizQuestions.length) {
      tampilkanSoalQuiz();
    } else {
      selesaikanTestOtomatis();
    }
  }, 1200);
}

var tulisSudahSalah = false;  // true kalau soal yang sedang tampil sudah pernah dijawab salah
var tulisMenunggu = false;    // true saat jeda pindah soal (mencegah Enter/klik ganda)

function resetIndikatorTulis() {
  var f = document.getElementById('user-write-input');
  if (f) f.classList.remove('tulis-benar', 'tulis-salah');
}

function tampilkanSoalTulis() {
  var q = quizQuestions[currentQuizIndex];
  document.getElementById('write-progress').innerText = "Soal " + (currentQuizIndex + 1) + " / " + quizQuestions.length;

  document.getElementById('write-kanji').innerText = q.kotoba;
  document.getElementById('write-meaning').innerText = "" + q.arti;

  tulisSudahSalah = false;
  tulisMenunggu = false;

  var inputField = document.getElementById('user-write-input');
  inputField.value = "";
  resetIndikatorTulis();
  // Warna merah hilang begitu siswa mulai mengetik ulang
  inputField.oninput = function() { if (!tulisMenunggu) resetIndikatorTulis(); };
  inputField.focus();
}

function handleWriteKeydown(event) {
  if (event.key === "Enter") {
    cekJawabanTulis();
  }
}

function cekJawabanTulis() {
  if (tulisMenunggu) return;

  var inputField = document.getElementById('user-write-input');
  var userAns = inputField.value.trim().toLowerCase();
  if (userAns === "") { inputField.focus(); return; }

  var q = quizQuestions[currentQuizIndex];
  var correctAns = String(q.carabaca).trim().toLowerCase();

  if (userAns === correctAns) {
    // BENAR: hijau, lalu lanjut ke soal berikutnya
    tulisMenunggu = true;
    if (!tulisSudahSalah) quizScore += 10;   // poin hanya kalau benar di percobaan pertama
    testNextIndex = currentQuizIndex + 1;

    inputField.classList.remove('tulis-salah');
    inputField.classList.add('tulis-benar');

    setTimeout(function() {
      resetIndikatorTulis();
      currentQuizIndex++;
      if (currentQuizIndex < quizQuestions.length) {
        tampilkanSoalTulis();
      } else {
        selesaikanTestOtomatis();
      }
    }, 600);
    simpanProgresTest();

  } else {
    // SALAH: merah, TIDAK lanjut. Siswa harus memperbaiki jawabannya.
    tulisSudahSalah = true;
    inputField.classList.remove('tulis-benar', 'tulis-salah');
    void inputField.offsetWidth;             // supaya animasi getar muncul lagi
    inputField.classList.add('tulis-salah');
    inputField.focus();
    inputField.select();
  }
}

function pilihBab(bab) {
  currentBab = bab;
  currentSubBab = "";

  if (currentJenis === 'konstruksi' && (bab === 'Bab 5' || bab === 'Bab 6')) {
    document.getElementById('bab-page').classList.add('hidden');
    document.getElementById('sub-bab-page').classList.remove('hidden');
    document.getElementById('judul-sub-bab').innerText = currentMenu + " - " + bab;

    var subContainer = document.getElementById('sub-bab-container');
    subContainer.innerHTML = "";
    subContainer.setAttribute('data-jenis', currentJenis);

    var subCategories = [];
    if (bab === 'Bab 5') {
      subCategories = ['土木', '建築', 'ライフライン'];
    } else if (bab === 'Bab 6') {
      subCategories = ['土木', '建築'];
    }

    subCategories.forEach(function(sub) {
      var targetParam = bab + " - " + sub;
      subContainer.innerHTML += '<button class="btn-bab" onclick="pilihSubBab(\'' + targetParam + '\', \'' + sub + '\')"><span class="bb-no">📂</span><span>' + sub + '</span></button>';
    });
  } else {
    muatDataKotoba(currentBab);
  }
}

function pilihSubBab(targetParam, subName) {
  currentSubBab = subName;
  document.getElementById('sub-bab-page').classList.add('hidden');
  muatDataKotoba(targetParam);
}

function kembaliDariSubBab() {
  document.getElementById('sub-bab-page').classList.add('hidden');
  document.getElementById('bab-page').classList.remove('hidden');
}

function muatDataKotoba(targetBabName) {
  catatAktivitas('Kotoba', currentMenu + ' ' + targetBabName);
  document.getElementById('bab-page').classList.add('hidden');
  document.getElementById('data-page').classList.remove('hidden');
  document.getElementById('judul-bab').innerText = currentMenu + " - " + targetBabName;
  
  var loadingEl = document.getElementById('loading');
  var listEl = document.getElementById('kotoba-list');
  
  loadingEl.classList.remove('hidden');
  listEl.innerHTML = "";

  google.script.run.withSuccessHandler(function(data) {
    loadingEl.classList.add('hidden');
    rawData = data || [];
    renderData();
    updateHafalCount();
  }).getKotoba(currentJenis, targetBabName, "Semua");
}

function renderData() {
  var listEl = document.getElementById('kotoba-list');
  listEl.innerHTML = "";

  var savedList = memorizedDataByJenis[currentJenis] || [];

  var unselectedData = rawData.filter(function(item) {
    return !savedList.some(function(saved) {
      return saved.kotoba === item.kotoba && saved.arti === item.arti;
    });
  });

  var limitVal = document.getElementById('limitSelect').value;
  var limitNum = (limitVal === 'Semua') ? unselectedData.length : parseInt(limitVal, 10);
  var displayedData = unselectedData.slice(0, limitNum);

  if (displayedData.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">Hebat! Semua kotoba dalam daftar ini sudah dihafal 🎉</div>';
    return;
  }

  displayedData.forEach(function(item) {
    var itemDiv = document.createElement('div');
    itemDiv.className = 'kotoba-item';
    itemDiv.innerHTML = 
      '<div class="kotoba-no">' + item.no + '</div>' +
      '<div class="kotoba-details">' +
        '<div class="row-kanji">' + item.kotoba + '</div>' +
        '<div class="row-baca">' + item.carabaca + '</div>' +
        '<div class="row-arti">' + item.arti + '</div>' +
      '</div>' +
      '<div class="kotoba-action">' +
        '<input type="checkbox" onchange="toggleHafal(this, \'' + encodeURIComponent(JSON.stringify(item)) + '\')">' +
      '</div>';
    listEl.appendChild(itemDiv);
  });
}

function toggleHafal(checkbox, encodedItem) {
  var item = JSON.parse(decodeURIComponent(encodedItem));
  if (!memorizedDataByJenis[currentJenis]) {
    memorizedDataByJenis[currentJenis] = [];
  }

  var list = memorizedDataByJenis[currentJenis];
  var index = list.findIndex(function(saved) {
    return saved.kotoba === item.kotoba && saved.arti === item.arti;
  });

  if (checkbox.checked) {
    if (index === -1) list.push(item);
  } else {
    if (index !== -1) list.splice(index, 1);
  }
  
  updateHafalCount();
  simpanHafalKeServer(currentJenis);
  questCatatHafal(item.kotoba, item.arti, currentJenis, checkbox.checked);
  renderData();   // kotoba kembali muncul di daftar asalnya

  // Bila di-uncheck dari popup "Kotoba yang Sudah Dihafal": baris hilang dari popup
  var dalamPopup = checkbox.closest ? checkbox.closest('#hafal-list') : null;
  if (dalamPopup && !checkbox.checked) {
    var baris = checkbox.closest('.kotoba-item');
    if (baris) baris.classList.add('keluar');
    setTimeout(renderModalHafal, 200);
  }
}

function updateHafalCount() {
  var list = memorizedDataByJenis[currentJenis] || [];
  document.getElementById('count-hafal').innerText = list.length;
}

function renderModalHafal() {
  var list = memorizedDataByJenis[currentJenis] || [];
  var hafalListEl = document.getElementById('hafal-list');
  hafalListEl.innerHTML = "";

  if (list.length === 0) {
    hafalListEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">Belum ada kotoba yang ditandai hafal.</div>';
    return;
  }
  list.forEach(function(item, idx) {
    var itemDiv = document.createElement('div');
    itemDiv.className = 'kotoba-item';
    itemDiv.innerHTML = 
      '<div class="kotoba-no">' + (idx + 1) + '</div>' +
      '<div class="kotoba-details">' +
        '<div class="row-kanji">' + item.kotoba + '</div>' +
        '<div class="row-baca">' + item.carabaca + '</div>' +
        '<div class="row-arti">' + item.arti + '</div>' +
      '</div>' +
      '<div class="kotoba-action">' +
        '<input type="checkbox" checked onchange="toggleHafal(this, \'' + encodeURIComponent(JSON.stringify(item)) + '\')">' +
      '</div>';
    hafalListEl.appendChild(itemDiv);
  });
}

function bukaModalHafal() {
  renderModalHafal();
  document.getElementById('modal-hafal').classList.remove('modal-hidden');
}

function tutupModalHafal() {
  document.getElementById('modal-hafal').classList.add('modal-hidden');
  renderData();
}

function kembaliKeBab() {
  document.getElementById('data-page').classList.add('hidden');
  document.getElementById('bab-page').classList.remove('hidden');
}

function kembaliKeMenu() {
  document.getElementById('bab-page').classList.add('hidden');
  document.getElementById('menu-page').classList.remove('hidden');
}

function kembaliKeMenuDariData() {
  document.getElementById('data-page').classList.add('hidden');
  document.getElementById('bab-page').classList.add('hidden');
  document.getElementById('menu-page').classList.remove('hidden');
}

function bukaDokkaiDariTest() {
  catatAktivitas('Test kotoba', 'Dokkai', true);
  currentBab = selectedBabForTest;
  document.getElementById('select-test-type-page').classList.add('hidden');
  document.getElementById('dokkai-page').classList.remove('hidden');
  document.getElementById('judul-dokkai').innerText = "Dokkai - " + currentMenu + " (" + currentBab + ")";
  
  var loadingEl = document.getElementById('loading-dokkai');
  var contentEl = document.getElementById('dokkai-content');
  
  loadingEl.classList.remove('hidden');
  contentEl.innerHTML = "";

  google.script.run.withSuccessHandler(function(data) {
    loadingEl.classList.add('hidden');
    if (!data || data.length === 0) {
      contentEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">Teks Dokkai untuk bab ini belum tersedia.</div>';
      return;
    }

    var html = "";
    data.forEach(function(item) {
      html += '<div style="margin-bottom: 14px;">';
      if (item.judul) {
        html += '<div style="font-weight: 700; font-size: 16px; color: #1e293b; margin-bottom: 6px;">' + item.judul + '</div>';
      }
      html += '<div style="font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">' + item.teks + '</div>';
      html += '</div>';
    });
    contentEl.innerHTML = html;
  }).withFailureHandler(function(err) {
    loadingEl.classList.add('hidden');
    contentEl.innerHTML = '<div style="text-align:center; color:#dc2626; padding:20px;">Gagal memuat Dokkai: ' + err.message + '</div>';
  }).getDokkai(currentJenis, currentBab);
}

function kembaliDariDokkai() {
  document.getElementById('dokkai-page').classList.add('hidden');
  document.getElementById('select-test-type-page').classList.remove('hidden');
}

// ===== Toggle lihat/sembunyikan password =====
(function () {
  var ICON_MATA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_MATA_CORET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function pasangToggle(input) {
    if (input.parentNode.classList.contains('pw-wrap')) return;

    var wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.setAttribute('aria-label', 'Tampilkan password');
    btn.innerHTML = ICON_MATA;
    wrap.appendChild(btn);

    btn.addEventListener('click', function () {
      var tampil = input.type === 'password';
      input.type = tampil ? 'text' : 'password';
      btn.innerHTML = tampil ? ICON_MATA_CORET : ICON_MATA;
      btn.setAttribute('aria-label', tampil ? 'Sembunyikan password' : 'Tampilkan password');
    });
  }

  document.querySelectorAll('input[type="password"]').forEach(pasangToggle);
})();

// ===== Segarkan notifikasi otomatis selama Menu Utama terbuka =====
(function () {
  var el = document.getElementById('main-menu-page'), terakhir = 0;
  function cek() {
    if (!el || el.classList.contains('hidden') || !studentName || document.hidden) return;
    var t = Date.now();
    if (t - terakhir < 20000) return;   // jangan terlalu sering
    terakhir = t;
    perbaruiNotif();
  }
  if (el && window.MutationObserver) {
    new MutationObserver(cek).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('visibilitychange', cek);
  setInterval(cek, 60000);
})();

/* =====================================================================
   FITUR BARU (tahap 1: tampilan) — Kana, Ujian JFT/JLPT, Hiburan
   Muat SETELAH Code.js (memakai tampilkanCustomAlert).
   Data di sini masih contoh/statis. Tahap berikutnya tinggal diganti
   dengan google.script.run.getXxx() seperti modul Kanji/Bunpou.
   ===================================================================== */

/* ---------- navigasi umum ---------- */
function fbEl(id) { return document.getElementById(id); }

function fbBuka(id) {
  fbEl('main-menu-page').classList.add('hidden');
  fbEl(id).classList.remove('hidden');
  window.scrollTo(0, 0);
}
function kembaliKeMainDariFitur(id) {
  fbEl(id).classList.add('hidden');
  fbEl('main-menu-page').classList.remove('hidden');
  window.scrollTo(0, 0);
}
function fbSegera(judul, pesan) {
  var teks = pesan || 'Fitur ini sedang disiapkan. Nantikan di update berikutnya ya, minna-san!';
  if (typeof tampilkanCustomAlert === 'function') tampilkanCustomAlert(judul || 'Segera hadir 🚧', teks);
  else alert((judul || 'Segera hadir') + '\n' + teks);
}
function fbSetAktif(wadahId, kunci, atribut) {
  var w = fbEl(wadahId); if (!w) return;
  var kids = w.children;
  for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('on', kids[i].getAttribute(atribut) === kunci);
}

/* =====================================================================
   KANA
   ===================================================================== */
var KANA_DASAR = [
  [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o']],
  [['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko']],
  [['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so']],
  [['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to']],
  [['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no']],
  [['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho']],
  [['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo']],
  [['や','ya'],null,['ゆ','yu'],null,['よ','yo']],
  [['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro']],
  [['わ','wa'],null,null,null,['を','wo']],
  [['ん','n'],null,null,null,null]
];
var KANA_DAKUTEN = [
  [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']],
  [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']],
  [['だ','da'],['ぢ','ji'],['づ','zu'],['で','de'],['ど','do']],
  [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']],
  [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']]
];
var KANA_KOMBINASI = [
  [['きゃ','kya'],['きゅ','kyu'],['きょ','kyo']],
  [['しゃ','sha'],['しゅ','shu'],['しょ','sho']],
  [['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho']],
  [['にゃ','nya'],['にゅ','nyu'],['にょ','nyo']],
  [['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo']],
  [['みゃ','mya'],['みゅ','myu'],['みょ','myo']],
  [['りゃ','rya'],['りゅ','ryu'],['りょ','ryo']],
  [['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo']],
  [['じゃ','ja'],['じゅ','ju'],['じょ','jo']],
  [['びゃ','bya'],['びゅ','byu'],['びょ','byo']],
  [['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']]
];
var kanaState = { aksara: 'hira', bagian: 'dasar' };

// hiragana -> katakana: geser kode karakter sebesar 0x60
function kanaKeKata(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    out += (c >= 0x3041 && c <= 0x3096) ? String.fromCharCode(c + 0x60) : s.charAt(i);
  }
  return out;
}
/* ---- data contoh kotoba dari sheet "Gana" (lewat getKana di Code.gs) ---- */
var kanaContoh = {};            // huruf (NFC) -> [{kotoba, bacaKotoba, arti, kategori}]
var kanaMuat = 'belum';         // belum | memuat | ok | gagal
var kanaDaftar = [];            // huruf yang sedang tampil, untuk tombol sebelumnya/berikutnya
var kanaIdx = -1;
var kanaGalat = '';

function kanaKeHira(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    out += (c >= 0x30A1 && c <= 0x30F6) ? String.fromCharCode(c - 0x60) : s.charAt(i);
  }
  return out;
}
// kunci pencarian: NFC + selalu hiragana, jadi Katakana ikut menemukan contoh kotoba
function kanaNorm(s) { s = String(s || '').trim(); return s.normalize ? s.normalize('NFC') : s; }


/* ---- contoh kotoba bawaan (dipakai bila sheet "Gana" kosong / server gagal) ---- */
var KANA_BAWAAN = {
'あ':'あめ|ame|hujan;あさ|asa|pagi','い':'いぬ|inu|anjing;いえ|ie|rumah','う':'うみ|umi|laut;うた|uta|lagu',
'え':'えき|eki|stasiun;えんぴつ|enpitsu|pensil','お':'おかね|okane|uang;おちゃ|ocha|teh',
'か':'かさ|kasa|payung;かわ|kawa|sungai','き':'き|ki|pohon;きもの|kimono|kimono','く':'くつ|kutsu|sepatu;くるま|kuruma|mobil',
'け':'けさ|kesa|pagi ini;けむり|kemuri|asap','こ':'こども|kodomo|anak;こえ|koe|suara',
'さ':'さかな|sakana|ikan;さくら|sakura|bunga sakura','し':'しお|shio|garam;しごと|shigoto|pekerjaan',
'す':'すし|sushi|sushi;すいか|suika|semangka','せ':'せんせい|sensei|guru;せかい|sekai|dunia','そ':'そら|sora|langit;そば|soba|mi soba',
'た':'たまご|tamago|telur;たべもの|tabemono|makanan','ち':'ちち|chichi|ayah (saya);ちかてつ|chikatetsu|kereta bawah tanah',
'つ':'つき|tsuki|bulan;つくえ|tsukue|meja','て':'てがみ|tegami|surat;てんき|tenki|cuaca','と':'とり|tori|burung;ともだち|tomodachi|teman',
'な':'なつ|natsu|musim panas;なまえ|namae|nama','に':'にく|niku|daging;にほん|Nihon|Jepang','ぬ':'ぬの|nuno|kain;ぬりえ|nurie|buku mewarnai',
'ね':'ねこ|neko|kucing;ねつ|netsu|demam','の':'のり|nori|rumput laut;のみもの|nomimono|minuman','は':'はな|hana|bunga;はし|hashi|sumpit',
'ひ':'ひと|hito|orang;ひこうき|hikōki|pesawat','ふ':'ふゆ|fuyu|musim dingin;ふね|fune|kapal','へ':'へや|heya|kamar;へび|hebi|ular',
'ほ':'ほん|hon|buku;ほし|hoshi|bintang','ま':'まど|mado|jendela;まち|machi|kota','み':'みず|mizu|air;みみ|mimi|telinga',
'む':'むし|mushi|serangga;むら|mura|desa','め':'め|me|mata;めがね|megane|kacamata','も':'もも|momo|persik;もり|mori|hutan',
'や':'やま|yama|gunung;やさい|yasai|sayur','ゆ':'ゆき|yuki|salju;ゆめ|yume|mimpi','よ':'よる|yoru|malam;よむ|yomu|membaca',
'ら':'らくだ|rakuda|unta;らいねん|rainen|tahun depan','り':'りんご|ringo|apel;りす|risu|tupai','る':'るす|rusu|tidak di rumah;ふるい|furui|tua/lama',
'れ':'れきし|rekishi|sejarah;れいぞうこ|reizōko|kulkas','ろ':'ろく|roku|enam;ろうそく|rōsoku|lilin','わ':'わたし|watashi|saya;わらい|warai|tawa',
'を':'ほんを よむ|hon o yomu|membaca buku;みずを のむ|mizu o nomu|minum air','ん':'ほん|hon|buku;ぱん|pan|roti',
'が':'がっこう|gakkō|sekolah;がいこく|gaikoku|luar negeri','ぎ':'ぎんこう|ginkō|bank;ぎゅうにゅう|gyūnyū|susu',
'ぐ':'ぐうぜん|gūzen|kebetulan;ぐみ|gumi|permen karet','げ':'げんき|genki|sehat;げつようび|getsuyōbi|hari Senin',
'ご':'ごはん|gohan|nasi/makan;ごご|gogo|siang-sore','ざ':'ざっし|zasshi|majalah;ざいりょう|zairyō|bahan',
'じ':'じかん|jikan|waktu;じてんしゃ|jitensha|sepeda','ず':'みずうみ|mizuumi|danau;ずぼん|zubon|celana',
'ぜ':'かぜ|kaze|angin/masuk angin;ぜんぶ|zenbu|semuanya','ぞ':'ぞう|zō|gajah;かぞく|kazoku|keluarga',
'だ':'だれ|dare|siapa;だいがく|daigaku|universitas','ぢ':'はなぢ|hanaji|mimisan;ちぢむ|chijimu|menyusut',
'づ':'つづく|tsuzuku|berlanjut;こづつみ|kozutsumi|paket kecil','で':'でんしゃ|densha|kereta listrik;でぐち|deguchi|pintu keluar',
'ど':'どこ|doko|di mana;どうぶつ|dōbutsu|hewan','ば':'ばなな|banana|pisang;ばしょ|basho|tempat',
'び':'びょういん|byōin|rumah sakit;びじゅつ|bijutsu|seni rupa','ぶ':'ぶた|buta|babi;ぶんがく|bungaku|sastra',
'べ':'べんきょう|benkyō|belajar;べんとう|bentō|bekal makan','ぼ':'ぼうし|bōshi|topi;ぼく|boku|aku (laki-laki)',
'ぱ':'ぱん|pan|roti;ぱそこん|pasokon|komputer pribadi','ぴ':'えんぴつ|enpitsu|pensil;ぴかぴか|pikapika|berkilau',
'ぷ':'ぷりん|purin|puding;ぷーる|pūru|kolam renang','ぺ':'ぺん|pen|pena;ぺらぺら|perapera|lancar (bahasa)',
'ぽ':'さんぽ|sanpo|jalan-jalan;ぽけっと|poketto|saku',
'きゃ':'きゃく|kyaku|tamu;きゃべつ|kyabetsu|kol','きゅ':'きゅうり|kyūri|mentimun;きゅうこう|kyūkō|kereta ekspres',
'きょ':'きょう|kyō|hari ini;きょうしつ|kyōshitsu|ruang kelas','しゃ':'しゃしん|shashin|foto;しゃかい|shakai|masyarakat',
'しゅ':'しゅくだい|shukudai|PR;しゅみ|shumi|hobi','しょ':'しょくじ|shokuji|makan;しょうがっこう|shōgakkō|sekolah dasar',
'ちゃ':'おちゃ|ocha|teh;ちゃいろ|chairo|cokelat','ちゅ':'ちゅうごく|Chūgoku|Tiongkok;ちゅうしゃ|chūsha|parkir',
'ちょ':'ちょっと|chotto|sebentar;ちょきん|chokin|tabungan','にゃ':'こんにゃく|konnyaku|konnyaku;にゃあ|nyā|meong',
'にゅ':'にゅうがく|nyūgaku|masuk sekolah;ぎゅうにゅう|gyūnyū|susu','にょ':'にょうぼう|nyōbō|istri (akrab)',
'ひゃ':'ひゃく|hyaku|seratus;ひゃっかじてん|hyakkajiten|ensiklopedia','ひゅ':'ひゅうが|Hyūga|nama daerah di Miyazaki',
'ひょ':'ひょうげん|hyōgen|ungkapan;ひょう|hyō|macan tutul','みゃ':'みゃく|myaku|denyut nadi;みゃくはく|myakuhaku|denyut',
'みゅ':'ミュージック|myūjikku|musik;ミュージカル|myūjikaru|musikal','みょ':'みょうじ|myōji|nama keluarga;みょうにち|myōnichi|besok (formal)',
'りゃ':'りゃくご|ryakugo|singkatan;りゃくす|ryakusu|menyingkat','りゅ':'りゅう|ryū|naga;りゅうがくせい|ryūgakusei|pelajar asing',
'りょ':'りょうり|ryōri|masakan;りょこう|ryokō|wisata','ぎゃ':'ぎゃく|gyaku|kebalikan;ぎゃくてん|gyakuten|berbalik keadaan',
'ぎゅ':'ぎゅうにゅう|gyūnyū|susu;ぎゅうにく|gyūniku|daging sapi','ぎょ':'ぎょうざ|gyōza|pangsit;ぎょうじ|gyōji|acara',
'じゃ':'じゃがいも|jagaimo|kentang;じゃま|jama|gangguan','じゅ':'じゅぎょう|jugyō|pelajaran;じゅうしょ|jūsho|alamat',
'じょ':'じょうず|jōzu|mahir;じょせい|josei|wanita','びゃ':'さんびゃく|sanbyaku|tiga ratus;びゃくだん|byakudan|cendana',
'びゅ':'インタビュー|intabyū|wawancara;レビュー|rebyū|ulasan','びょ':'びょういん|byōin|rumah sakit;びょうき|byōki|sakit',
'ぴゃ':'はっぴゃく|happyaku|delapan ratus;ろっぴゃく|roppyaku|enam ratus','ぴゅ':'コンピューター|konpyūtā|komputer;ぴゅあ|pyua|murni',
'ぴょ':'はっぴょう|happyō|pengumuman;ぴょんぴょん|pyonpyon|melompat-lompat'
};
function kanaContohDari(k) {
  var key = kanaNorm(k);
  var l = kanaContoh[key];
  if (l && l.length) return l;
  // cadangan bila sheet belum termuat: hanya kata asli sesuai aksara
  var s = KANA_BAWAAN[kanaKeHira(key)]; if (!s) return [];
  var kata = kanaState.aksara === 'kata';
  var hasil = [];
  s.split(';').forEach(function (t) {
    var p = t.split('|');
    var punyaHira = /[\u3041-\u3096]/.test(p[0]);
    if (kata && punyaHira) return;      // mode Katakana: jangan tampilkan tulisan Hiragana
    hasil.push({ kotoba: p[0], bacaKotoba: p[1], arti: p[2], kategori: '' });
  });
  return hasil;
}

function kanaMuatData() {
  if (kanaMuat === 'ok' || kanaMuat === 'memuat') return;
  kanaMuat = 'memuat';
  google.script.run
    .withSuccessHandler(function (rows) {
      var peta = {};
      (rows || []).forEach(function (r) {
        var k = kanaNorm(r.huruf); if (!k) return;
        if (!r.kotoba) return;
        (peta[k] = peta[k] || []).push({ kotoba: r.kotoba, bacaKotoba: r.bacaKotoba, arti: r.arti, kategori: r.kategori });
      });
      kanaContoh = peta; kanaMuat = 'ok';
      kanaRender();
      if (kanaIdx >= 0 && !fbEl('kana-sheet').classList.contains('hidden')) kanaIsiSheet();
    })
    .withFailureHandler(function (err) {
      kanaMuat = 'gagal';
      kanaGalat = (err && err.message) ? String(err.message) : String(err || '');
      if (kanaIdx >= 0 && !fbEl('kana-sheet').classList.contains('hidden')) kanaIsiSheet();
    })
    .getKana();
}

function bukaKanaDariMain() { fbBuka('kana-page'); kanaRender(); if (kanaMuat === 'gagal') kanaMuat = 'belum'; kanaMuatData(); }
function kanaPilihAksara(a) { kanaState.aksara = a; kanaRender(); }
function kanaPilihBagian(b) { kanaState.bagian = b; kanaRender(); }

function kanaRender() {
  fbSetAktif('kana-seg-aksara', kanaState.aksara, 'data-k');
  fbSetAktif('kana-seg-bagian', kanaState.bagian, 'data-k');
  var baris = kanaState.bagian === 'dakuten' ? KANA_DAKUTEN : (kanaState.bagian === 'kombinasi' ? KANA_KOMBINASI : KANA_DASAR);
  var kata = kanaState.aksara === 'kata';
  var h = '';
  var stat = kanaStatBaca(), nLemah = 0;
  kanaDaftar = [];
  for (var r = 0; r < baris.length; r++) {
    for (var c = 0; c < baris[r].length; c++) {
      var sel = baris[r][c];
      if (!sel) { h += '<div class="kn-cell kosong"><span class="kn-kana">あ</span><span class="kn-romaji">a</span></div>'; continue; }
      var k = kata ? kanaKeKata(sel[0]) : sel[0];
      var i = kanaDaftar.push({ k: k, r: sel[1] }) - 1;
      var ada = kanaContohDari(k).length ? ' ada' : '';
      if (kanaLemah(k, stat)) { ada += ' lemah'; nLemah++; }
      h += '<div class="kn-cell' + ada + '" role="button" onclick="kanaBuka(' + i + ')"><span class="kn-kana">' + k + '</span><span class="kn-romaji">' + sel[1] + '</span></div>';
    }
  }
  var g = fbEl('kana-grid');
  g.className = 'kn-grid' + (kanaState.bagian === 'kombinasi' ? ' c3' : '');
  g.innerHTML = h;
  var inf = fbEl('kl-lemah-info');
  if (inf) inf.innerHTML = nLemah ? '<span class="kl-titik"></span> ' + nLemah + ' huruf di tabel ini masih sering salah. Latih lagi lewat menu di bawah.' : '';
}

/* ---- lembar contoh kotoba (muncul dari bawah) ---- */
function kanaBuka(i) {
  if (i < 0 || i >= kanaDaftar.length) return;
  kanaIdx = i;
  fbEl('kana-sheet').classList.remove('hidden');
  kanaIsiSheet();
}
function kanaTutup(ev) {
  if (ev && ev.target && ev.target.id !== 'kana-sheet' && ev.target.id !== 'ks-tutup') return;
  fbEl('kana-sheet').classList.add('hidden');
  kanaIdx = -1;
}
function kanaGeser(arah) {
  var n = kanaIdx + arah;
  if (n < 0 || n >= kanaDaftar.length) return;
  kanaIdx = n; kanaIsiSheet();
}
function kanaIsiSheet() {
  var d = kanaDaftar[kanaIdx]; if (!d) return;
  var kk = fbEl('ks-kana'); kk.textContent = d.k; kk.classList.toggle('dua', d.k.length > 1);
  fbEl('ks-romaji').textContent = d.r;
  fbEl('ks-prev').classList.toggle('mati', kanaIdx === 0);
  fbEl('ks-next').classList.toggle('mati', kanaIdx === kanaDaftar.length - 1);

  var list = kanaContohDari(d.k);
  var h = '';
  if (list.length) {
    h += '<div class="fb-judul-kecil" style="margin-top:0;">Contoh kotoba</div>';
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      h += '<div class="ks-contoh">' +
        '<div class="ks-kotoba">' + kanaEsc(x.kotoba) + '</div>' +
        '<div class="ks-info">' + (x.bacaKotoba ? '<span>' + kanaEsc(x.bacaKotoba) + '</span>' : '') +
        (x.arti ? '<b>' + kanaEsc(x.arti) + '</b>' : '') + '</div></div>';
    }
  } else if (kanaMuat === 'memuat' || kanaMuat === 'belum') {
    h = '<div class="fb-info">Memuat contoh kotoba...</div>';
  } else if (kanaMuat === 'gagal') {
    h = '<div class="fb-info">Contoh kotoba belum bisa dimuat. Periksa koneksi, lalu <b style="text-decoration:underline;cursor:pointer" onclick="kanaMuat=\'belum\';kanaMuatData();kanaIsiSheet();">coba lagi</b>.' + (kanaGalat ? '<br><small>' + kanaEsc(kanaGalat) + '</small>' : '') + '</div>';
  } else {
    h = '<div class="fb-info">Belum ada contoh kotoba untuk huruf ini.</div>';
  }
  fbEl('ks-isi').innerHTML = h;
}
function kanaEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* =====================================================================
   KANA — LATIHAN: Tebak huruf & Tulis kana
   - Huruf yang salah diulang lagi beberapa soal kemudian (maks. 2x) dalam sesi yang sama.
   - Riwayat benar/salah per huruf disimpan di perangkat; huruf yang sering salah
     diberi titik merah di tabel dan bisa dilatih khusus.
   ===================================================================== */
var KANA_MIRIP = ['さち', 'ぬめね', 'れわね', 'はほま', 'るろ', 'いり', 'こに', 'あお', 'きさ', 'うえ', 'すむ', 'のめ', 'たな', 'ぷぶふ',
                  'シツソン', 'クケタ', 'ウワフ', 'アマ', 'コユ', 'チテナ', 'ヌス', 'ノメ', 'ラフ', 'ホボ', 'マヤ', 'ミニ'];
var kanaLat = {
  jenis: 'tebak', tahap: 'setup',
  set: { aksara: 'hira', cakupan: 'dasar', jumlah: 10, modeTebak: 'kana2romaji', modeTulis: 'jiplak', lemah: false },
  antrian: [], i: 0, unik: 0, benar: 0, salah: 0, pertama: {},
  opsi: [], jawab: null, goresan: [], cek: null, petunjuk: false, w: 300, dpr: 1, token: 0
};

function kanaStatKunci() { return 'kotoba_kana_stat|' + studentName; }
function kanaStatBaca() {
  var d = null;
  try { d = JSON.parse(localStorage.getItem(kanaStatKunci()) || 'null'); } catch (e) {}
  return (d && typeof d === 'object') ? d : {};
}
function kanaStatCatat(k, benar) {
  var d = kanaStatBaca(), x = d[k] || [0, 0];
  x[benar ? 0 : 1]++; d[k] = x;
  try { localStorage.setItem(kanaStatKunci(), JSON.stringify(d)); } catch (e) {}
}
function kanaLemah(k, d) {
  var x = (d || kanaStatBaca())[k];
  return !!x && x[1] >= 1 && x[1] / (x[0] + x[1]) >= 0.3;
}

// semua huruf untuk satu aksara + cakupan
function kanaSemua(aksara, cakupan) {
  var tab = cakupan === 'dakuten' ? KANA_DAKUTEN : (cakupan === 'kombinasi' ? KANA_KOMBINASI : KANA_DASAR), out = [];
  tab.forEach(function (baris, bi) {
    baris.forEach(function (sel) {
      if (!sel) return;
      out.push({ k: aksara === 'kata' ? kanaKeKata(sel[0]) : sel[0], r: sel[1], g: cakupan, baris: bi, ulang: 0 });
    });
  });
  return out;
}
function kanaPoolLatihan() {
  var st = kanaLat.set;
  var aks = st.aksara === 'campur' ? ['hira', 'kata'] : [st.aksara];
  var cak = st.cakupan === 'semua' ? ['dasar', 'dakuten', 'kombinasi'] : [st.cakupan];
  var out = [];
  aks.forEach(function (a) { cak.forEach(function (c) { out = out.concat(kanaSemua(a, c)); }); });
  return out;
}

/* ---------- halaman & pengaturan ---------- */
function kanaBukaLatihan(jenis) {
  var l = kanaLat;
  l.jenis = jenis; l.tahap = 'setup';
  l.set.aksara = kanaState.aksara; l.set.cakupan = kanaState.bagian; l.set.lemah = false;
  fbEl('kana-page').classList.add('hidden');
  fbEl('kana-latih-page').classList.remove('hidden');
  fbEl('kl-judul').textContent = jenis === 'tebak' ? '読 Tebak huruf' : '書 Tulis kana';
  window.scrollTo(0, 0);
  kanaLatRender();
}
function kanaLatKeluar() {
  kanaLat.tahap = 'setup'; kanaLat.token++;
  fbEl('kana-latih-page').classList.add('hidden');
  fbEl('kana-page').classList.remove('hidden');
  kanaRender();
  window.scrollTo(0, 0);
}
function kanaLatSet(kunci, nilai) { kanaLat.set[kunci] = nilai; kanaLatRender(); }

function kanaLatChips(kunci, daftar) {
  var h = '<div class="kl-chips">';
  daftar.forEach(function (d) {
    var on = kanaLat.set[kunci] === d[0];
    var v = typeof d[0] === 'number' ? d[0] : "'" + d[0] + "'";
    h += '<span class="kl-chip' + (on ? ' on' : '') + '" role="button" onclick="kanaLatSet(\'' + kunci + '\',' + v + ')">' + d[1] + '</span>';
  });
  return h + '</div>';
}

function kanaLatRender() {
  var l = kanaLat;
  if (l.tahap === 'setup') kanaLatRenderSetup();
  else if (l.tahap === 'hasil') kanaLatRenderHasil();
  else if (l.jenis === 'tebak') kanaLatRenderTebak();
  else kanaLatRenderTulis();
}

function kanaLatRenderSetup() {
  var l = kanaLat, st = l.set, tebak = l.jenis === 'tebak';
  var stat = kanaStatBaca();
  var pool = kanaPoolLatihan();
  var nLemah = pool.filter(function (x) { return kanaLemah(x.k, stat); }).length;
  var h = '<div class="fb-info"><b>' + (tebak ? 'Tebak huruf' : 'Tulis kana') + '</b><br>' +
    (tebak ? 'Lihat huruf lalu pilih cara bacanya, atau sebaliknya. Pilihan jawaban sengaja dibuat mirip supaya ingatanmu terasah.'
           : 'Tulis kana dengan jarimu. Huruf yang salah akan muncul lagi beberapa soal kemudian.') + '</div>';
  h += '<div class="kl-set-jdl">Aksara</div>' + kanaLatChips('aksara', [['hira', 'Hiragana'], ['kata', 'Katakana'], ['campur', 'Campur']]);
  h += '<div class="kl-set-jdl">Cakupan</div>' + kanaLatChips('cakupan', [['dasar', 'Dasar'], ['dakuten', 'Dakuten'], ['kombinasi', 'Kombinasi'], ['semua', 'Semua']]);
  h += '<div class="kl-set-jdl">Mode</div>' + (tebak
    ? kanaLatChips('modeTebak', [['kana2romaji', 'Huruf → bacaan'], ['romaji2kana', 'Bacaan → huruf']])
    : kanaLatChips('modeTulis', [['jiplak', 'Jiplak (ada contoh)'], ['ingatan', 'Dari ingatan']]));
  h += '<div class="kl-set-jdl">Jumlah huruf</div>' + kanaLatChips('jumlah', [[10, '10'], [20, '20'], [0, 'Semua (' + pool.length + ')']]);
  h += '<div class="kl-set-jdl">Fokus</div><div class="kl-chips"><span class="kl-chip' + (st.lemah ? ' on' : '') + (nLemah ? '' : ' mati') + '" role="button" onclick="' +
    (nLemah ? "kanaLatSet('lemah'," + (!st.lemah) + ')' : '') + '">🎯 Hanya huruf yang sering salah (' + nLemah + ')</span></div>';
  h += '<div class="uj-aksi"><button class="uj-btn lebar" onclick="kanaLatMulai()">Mulai ▶</button></div>';
  fbEl('kl-isi').innerHTML = h;
}

function kanaLatMulai(daftarKhusus) {
  var l = kanaLat, st = l.set, stat = kanaStatBaca();
  var pool;
  if (daftarKhusus) pool = daftarKhusus;
  else {
    pool = kanaPoolLatihan();
    if (st.lemah) pool = pool.filter(function (x) { return kanaLemah(x.k, stat); });
  }
  if (!pool.length) { fbSegera('Belum ada huruf', 'Tidak ada huruf untuk dilatih dengan pengaturan ini.'); return; }
  pool = ujianAcak(pool.slice());
  if (!daftarKhusus && st.jumlah > 0) pool = pool.slice(0, st.jumlah);
  l.antrian = pool.map(function (x) { return { k: x.k, r: x.r, g: x.g, baris: x.baris, ulang: 0 }; });
  l.i = 0; l.unik = l.antrian.length; l.benar = 0; l.salah = 0; l.pertama = {};
  l.tahap = 'soal';
  kanaLatSiapSoal();
  kanaLatRender(); window.scrollTo(0, 0);
}

function kanaLatSiapSoal() {
  var l = kanaLat;
  l.token++; l.jawab = null; l.goresan = []; l.cek = null; l.petunjuk = false;
  l.opsi = (l.jenis === 'tebak' && l.antrian[l.i]) ? kanaOpsiTebak(l.antrian[l.i]) : [];
}
function kanaLatLanjut() {
  var l = kanaLat;
  l.i++;
  if (l.i >= l.antrian.length) { l.tahap = 'hasil'; l.token++; kanaLatRender(); window.scrollTo(0, 0); return; }
  kanaLatSiapSoal();
  kanaLatRender(); window.scrollTo(0, 0);
}

/* catat satu percobaan; huruf salah dijadwalkan muncul lagi */
function kanaLatCatat(it, benar) {
  var l = kanaLat;
  if (l.pertama[it.k] === undefined) l.pertama[it.k] = benar;
  kanaStatCatat(it.k, benar);
  if (benar) { l.benar++; return; }
  l.salah++;
  if (it.ulang < 2) {
    var pos = Math.min(l.antrian.length, l.i + 4);
    l.antrian.splice(pos, 0, { k: it.k, r: it.r, g: it.g, baris: it.baris, ulang: it.ulang + 1 });
  }
}

function kanaLatTop(l) {
  var n = l.antrian.length;
  return '<div class="uj-top"><button class="uj-btn kecil" onclick="kanaLatKeluar()">‹ Keluar</button>' +
    '<span class="uj-no">Soal ' + (l.i + 1) + ' / ' + n + '</span><span class="uj-skor">✔ ' + l.benar + '</span></div>' +
    '<div class="uj-bar"><i style="width:' + Math.round(l.i / n * 100) + '%"></i></div>';
}

/* ---------- TEBAK HURUF ---------- */
function kanaOpsiTebak(it) {
  var kata = it.k.charCodeAt(0) >= 0x30A1;
  var komb = it.g === 'kombinasi';
  var semua = komb ? kanaSemua(kata ? 'kata' : 'hira', 'kombinasi')
                   : kanaSemua(kata ? 'kata' : 'hira', 'dasar').concat(kanaSemua(kata ? 'kata' : 'hira', 'dakuten'));
  var seen = {}; seen[it.r] = 1;
  var pri = [];
  function tambah(arr) {
    ujianAcak(arr.slice()).forEach(function (x) {
      if (x.k === it.k || seen[x.r]) return;
      seen[x.r] = 1; pri.push(x);
    });
  }
  var mirip = [];
  KANA_MIRIP.forEach(function (grup) {
    if (grup.indexOf(it.k) < 0) return;
    semua.forEach(function (x) { if (grup.indexOf(x.k) >= 0) mirip.push(x); });
  });
  tambah(mirip);
  tambah(semua.filter(function (x) { return x.g === it.g && x.baris === it.baris; }));
  tambah(semua.filter(function (x) { return x.r.charAt(0) === it.r.charAt(0); }));
  tambah(semua);
  return ujianAcak([it].concat(pri.slice(0, 3)));
}

function kanaLatRenderTebak() {
  var l = kanaLat, it = l.antrian[l.i], rev = l.set.modeTebak === 'romaji2kana', sudah = l.jawab !== null;
  var h = kanaLatTop(l);
  h += '<div class="kl-kartu"><div class="kl-minta">' + (rev ? 'Pilih huruf untuk bunyi' : 'Apa cara bacanya?') + '</div>' +
    (rev ? '<div class="kl-besar">' + kanaEsc(it.r) + '</div>' : '<div class="kl-besar jp' + (it.k.length > 1 ? ' dua' : '') + '">' + kanaEsc(it.k) + '</div>') + '</div>';
  h += '<div class="kl-opsi">';
  l.opsi.forEach(function (o, n) {
    var kls = 'kl-op' + (rev ? ' jp' : '');
    if (sudah) {
      if (o.k === it.k) kls += ' benar';
      else if (n === l.jawab) kls += ' salah';
      else kls += ' pudar';
    }
    h += '<button class="' + kls + '"' + (sudah ? ' disabled' : '') + ' onclick="kanaLatJawabTebak(' + n + ')">' + kanaEsc(rev ? o.k : o.r) + '</button>';
  });
  h += '</div>';
  if (sudah) {
    var benar = l.opsi[l.jawab].k === it.k;
    h += '<div class="uj-bahas ' + (benar ? 'ok' : 'no') + '"><b>' + (benar ? 'Benar! ✅' : 'Kurang tepat') + '</b>' +
      '<div>' + kanaEsc(it.k) + ' dibaca <b style="display:inline">' + kanaEsc(it.r) + '</b>' + (benar ? '' : '. Huruf ini akan muncul lagi sebentar lagi.') + '</div></div>';
    if (!benar) h += '<div class="uj-aksi"><button class="uj-btn lebar" onclick="kanaLatLanjut()">Lanjut ›</button></div>';
  }
  fbEl('kl-isi').innerHTML = h;
}
function kanaLatJawabTebak(n) {
  var l = kanaLat; if (l.jawab !== null) return;
  var it = l.antrian[l.i];
  l.jawab = n;
  var benar = l.opsi[n].k === it.k;
  kanaLatCatat(it, benar);
  if (!benar) { try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {} }
  kanaLatRender();
  if (benar) {
    var t = l.token;
    setTimeout(function () { if (kanaLat.token === t && kanaLat.tahap === 'soal') kanaLatLanjut(); }, 700);
  }
}

/* ---------- HASIL (dipakai kedua latihan) ---------- */
function kanaLatRenderHasil() {
  var l = kanaLat, salahList = [], benar = 0;
  Object.keys(l.pertama).forEach(function (k) { if (l.pertama[k]) benar++; else salahList.push(k); });
  var n = l.unik, persen = n ? Math.round(benar / n * 100) : 0;
  var pesan = persen >= 90 ? 'Sugoi! Ingatanmu tajam 🎉' : persen >= 70 ? 'Bagus! Sedikit lagi hafal 💪' : 'Terus berlatih, huruf yang salah akan makin dikenal 🙏';
  var h = '<div class="uj-hasil"><div class="uj-hasil-bintang">' + (persen === 100 ? '🌟' : '⭐') + '</div>' +
    '<div class="uj-hasil-judul">Latihan selesai!</div>' +
    '<div class="uj-hasil-skor">' + benar + ' / ' + n + '</div>' +
    '<div class="uj-hasil-persen">' + persen + '% benar pada percobaan pertama</div>' +
    '<div class="uj-hasil-pesan">' + pesan + '</div></div>';
  if (salahList.length) {
    h += '<div class="fb-judul-kecil">Huruf yang perlu diulang</div><div class="kl-salah">';
    salahList.forEach(function (k) {
      var it = l.antrian.filter(function (x) { return x.k === k; })[0];
      h += '<div class="kl-ubin"><span class="jp">' + kanaEsc(k) + '</span><small>' + kanaEsc(it ? it.r : '') + '</small></div>';
    });
    h += '</div>';
  }
  h += '<div class="uj-aksi">' +
    (salahList.length ? '<button class="uj-btn" onclick="kanaLatUlangSalah()">Latih yang salah</button>' : '') +
    '<button class="uj-btn' + (salahList.length ? ' kecil' : '') + '" onclick="kanaLatMulai()">Main lagi</button>' +
    '<button class="uj-btn kecil" onclick="kanaLatKeluar()">Selesai</button></div>';
  fbEl('kl-isi').innerHTML = h;
}
function kanaLatUlangSalah() {
  var l = kanaLat, daftar = [];
  Object.keys(l.pertama).forEach(function (k) {
    if (l.pertama[k]) return;
    var it = l.antrian.filter(function (x) { return x.k === k; })[0];
    if (it) daftar.push({ k: it.k, r: it.r, g: it.g, baris: it.baris });
  });
  kanaLatMulai(daftar);
}

/* ---------- TULIS KANA ---------- */
function kanaFontJp() {
  var f = '';
  try { f = getComputedStyle(document.documentElement).getPropertyValue('--jp'); } catch (e) {}
  return (f && f.trim()) || "'Noto Sans JP', sans-serif";
}
function kanaGambarHuruf(ctx, ukuran, teks, warna) {
  var px = ukuran * (teks.length > 1 ? 0.46 : 0.72);
  ctx.save();
  ctx.font = '700 ' + px + 'px ' + kanaFontJp();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = warna;
  ctx.fillText(teks, ukuran / 2, ukuran / 2 + ukuran * 0.04);
  ctx.restore();
}

function kanaLatRenderTulis() {
  var l = kanaLat, it = l.antrian[l.i], jiplak = l.set.modeTulis === 'jiplak', cek = l.cek;
  var h = kanaLatTop(l);
  h += '<div class="kl-kartu kecil"><div class="kl-minta">' + (jiplak ? 'Jiplak huruf ini' : 'Tulis huruf untuk bunyi') + '</div>' +
    (jiplak ? '<div class="kl-besar jp' + (it.k.length > 1 ? ' dua' : '') + ' sedang">' + kanaEsc(it.k) + '</div><div class="kl-bacaan">' + kanaEsc(it.r) + '</div>'
            : '<div class="kl-besar sedang">' + kanaEsc(it.r) + '</div>') + '</div>';
  h += '<div class="kl-kanvas-wrap"><canvas id="kl-kanvas"></canvas></div>';
  if (!cek) {
    h += '<div class="kl-alat">' +
      '<button class="uj-btn kecil" onclick="kanaTulisHapus()">🗑 Hapus</button>' +
      (jiplak ? '' : '<button class="uj-btn kecil" onclick="kanaTulisPetunjuk()">' + (l.petunjuk ? '🙈 Sembunyikan contoh' : '👁 Lihat contoh') + '</button>') +
      '<button class="uj-btn" onclick="kanaTulisCek()">Cek ✓</button></div>';
    h += '<div id="kl-pesan" class="kl-pesan"></div>';
  } else {
    var p = Math.round(cek.skor * 100);
    var ket = cek.skor >= 0.7 ? 'Bagus! Tulisanmu mirip contoh 👍' : cek.skor >= 0.5 ? 'Lumayan, masih bisa dirapikan' : 'Belum mirip, perhatikan bentuk dan arah goresannya';
    h += '<div class="uj-bahas ' + (cek.skor >= 0.5 ? 'ok' : 'no') + '"><b>Kemiripan perkiraan: ' + p + '%</b><div>' + ket +
      '. Hijau = bentuk yang benar, ungu = tulisanmu. Penilaian ini hanya perkiraan, jadi putuskan sendiri ya.</div></div>';
    h += '<div class="kl-alat"><button class="uj-btn kecil" onclick="kanaTulisHapus()">↺ Tulis ulang</button></div>';
    h += '<div class="kl-alat"><button class="uj-btn' + (cek.skor >= 0.5 ? '' : ' kecil') + '" onclick="kanaTulisNilai(true)">✓ Sudah benar</button>' +
      '<button class="uj-btn' + (cek.skor >= 0.5 ? ' kecil' : '') + '" onclick="kanaTulisNilai(false)">✗ Perlu latihan</button></div>';
  }
  fbEl('kl-isi').innerHTML = h;
  kanaKanvasSiap();
}

function kanaKanvasSiap() {
  var l = kanaLat, cv = fbEl('kl-kanvas'); if (!cv) return;
  var w = Math.floor(cv.getBoundingClientRect().width) || 300, dpr = window.devicePixelRatio || 1;
  l.w = w; l.dpr = dpr;
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
  var aktif = null;
  function titik(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  cv.onpointerdown = function (e) {
    if (l.cek) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    aktif = [titik(e)]; l.goresan.push(aktif);
    kanaKanvasGambar();
  };
  cv.onpointermove = function (e) {
    if (!aktif) return;
    e.preventDefault();
    aktif.push(titik(e));
    kanaKanvasGambar();
  };
  var selesai = function () { aktif = null; };
  cv.onpointerup = selesai; cv.onpointercancel = selesai; cv.onpointerleave = selesai;
  kanaKanvasGambar();
}

function kanaKanvasGambar() {
  var l = kanaLat, cv = fbEl('kl-kanvas'); if (!cv) return;
  var it = l.antrian[l.i]; if (!it) return;
  var ctx = cv.getContext('2d'), w = l.w, gelap = document.documentElement.classList.contains('dark');
  ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = gelap ? '#0f172a' : '#ffffff'; ctx.fillRect(0, 0, w, w);
  // garis bantu (silang) seperti buku latihan menulis
  ctx.save();
  ctx.strokeStyle = gelap ? 'rgba(148,163,184,.35)' : 'rgba(100,116,139,.3)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(w / 2, 6); ctx.lineTo(w / 2, w - 6); ctx.moveTo(6, w / 2); ctx.lineTo(w - 6, w / 2); ctx.stroke();
  ctx.restore();
  var jiplak = l.set.modeTulis === 'jiplak';
  if (l.cek) kanaGambarHuruf(ctx, w, it.k, 'rgba(34,197,94,.45)');
  else if (jiplak || l.petunjuk) kanaGambarHuruf(ctx, w, it.k, gelap ? 'rgba(148,163,184,.4)' : 'rgba(100,116,139,.32)');
  ctx.strokeStyle = gelap ? '#c4b5fd' : '#7c3aed';
  ctx.lineWidth = w * 0.045; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  l.goresan.forEach(function (g) {
    ctx.beginPath();
    if (g.length === 1) { ctx.moveTo(g[0][0], g[0][1]); ctx.lineTo(g[0][0] + 0.01, g[0][1]); }
    else { ctx.moveTo(g[0][0], g[0][1]); for (var p = 1; p < g.length; p++) ctx.lineTo(g[p][0], g[p][1]); }
    ctx.stroke();
  });
}

function kanaTulisHapus() {
  var l = kanaLat;
  l.goresan = []; l.cek = null;
  kanaLatRender();
}
function kanaTulisPetunjuk() {
  var l = kanaLat;
  l.petunjuk = !l.petunjuk;
  kanaLatRender();
}

/* Kemiripan perkiraan: bandingkan tulisan dengan huruf di font (64x64, toleransi geser) */
function kanaTulisSkor() {
  var l = kanaLat, it = l.antrian[l.i], N = 64, w = l.w;
  function kanvas() { var c = document.createElement('canvas'); c.width = c.height = N; return c; }
  var cu = kanvas(), xu = cu.getContext('2d');
  xu.strokeStyle = '#000'; xu.lineWidth = Math.max(2, w * 0.045 * N / w); xu.lineCap = 'round'; xu.lineJoin = 'round';
  l.goresan.forEach(function (g) {
    xu.beginPath();
    if (g.length === 1) { xu.moveTo(g[0][0] * N / w, g[0][1] * N / w); xu.lineTo(g[0][0] * N / w + 0.01, g[0][1] * N / w); }
    else { xu.moveTo(g[0][0] * N / w, g[0][1] * N / w); for (var p = 1; p < g.length; p++) xu.lineTo(g[p][0] * N / w, g[p][1] * N / w); }
    xu.stroke();
  });
  var cg = kanvas(), xg = cg.getContext('2d');
  kanaGambarHuruf(xg, N, it.k, '#000');
  function topeng(x) {
    var d = x.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N);
    for (var i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] > 60 ? 1 : 0;
    return m;
  }
  function lebarkan(m, r) {
    var o = new Uint8Array(N * N);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (!m[y * N + x]) continue;
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < N && xx >= 0 && xx < N) o[yy * N + xx] = 1;
      }
    }
    return o;
  }
  var U = topeng(xu), G = topeng(xg), Ud = lebarkan(U, 4), Gd = lebarkan(G, 4);
  var nu = 0, ng = 0, hu = 0, hg = 0;
  for (var i = 0; i < N * N; i++) {
    if (U[i]) { nu++; if (Gd[i]) hu++; }
    if (G[i]) { ng++; if (Ud[i]) hg++; }
  }
  if (!nu || !ng) return 0;
  var pre = hu / nu, rec = hg / ng;
  return (pre + rec) ? 2 * pre * rec / (pre + rec) : 0;
}
function kanaTulisCek() {
  var l = kanaLat;
  var ada = l.goresan.some(function (g) { return g.length > 0; });
  if (!ada) { var p = fbEl('kl-pesan'); if (p) p.textContent = 'Tulis hurufnya dulu ya.'; return; }
  l.cek = { skor: kanaTulisSkor() };
  kanaLatRender();
}
function kanaTulisNilai(benar) {
  var l = kanaLat, it = l.antrian[l.i]; if (!l.cek) return;
  kanaLatCatat(it, benar);
  kanaLatLanjut();
}

/* =====================================================================
   UJIAN (JFT-Basic & JLPT)
   - Soal diambil dari spreadsheet "Fitur Tambahan aplikasi" (sheet JFT & JLPT)
     lewat getUjian(tipe, level) di server (lihat Ujian.gs): sheet JFT dan satu
     sheet per level JLPT (N5-N1). Hanya sheet yang dibuka yang dimuat, dan
     dimuat ulang setiap dibuka, jadi perubahan di spreadsheet ikut tersinkron.
   - Alur: pilih JFT/JLPT (+level) -> pilih bagian -> pilih paket -> kerjakan.
   ===================================================================== */
var ujianState = { tab: 'jft', level: 'N5', bagian: null, riwayat: false };
var ujianData = { cache: {}, status: {}, pesan: {} };   // per kunci: 'jft' atau 'jlpt:N5'
var ujianKuis = null;    // { list, i, skor, jawab, judul }
var ujianGrup = [];      // kelompok bagian untuk tampilan saat ini
var ujianPaket = [];     // kelompok paket untuk bagian yang dipilih

function ujianIkonBagian(nama) {
  var n = String(nama || '').toLowerCase();
  if (/moji|goi|kosakata|vocab|script/.test(n)) return '字';
  if (/bunpou|tata bahasa|grammar/.test(n)) return '文';
  if (/dokkai|membaca|reading/.test(n)) return '読';
  if (/choukai|dengar|listening/.test(n)) return '聴';
  if (/percakapan|conversation|ungkapan|expression/.test(n)) return '話';
  return '題';
}
function ujianBersih(t) { return String(t == null ? '' : t).replace(/\s*\[cite:[^\]]*\]/gi, '').trim(); }
function ujianNl(t) { return kanaEsc(ujianBersih(t)).replace(/\r?\n/g, '<br>'); }

function ujianKunci() { return ujianState.tab === 'jlpt' ? 'jlpt:' + ujianState.level : 'jft'; }

function bukaUjianDariMain(tab) {
  ujianState.tab = (tab === 'jlpt') ? 'jlpt' : 'jft';
  ujianState.bagian = null;
  ujianState.riwayat = false;
  ujianKuis = null;
  fbBuka('ujian-page');
  ujianMuat();        // selalu ambil data terbaru dari spreadsheet
  ujianRender();
}
function ujianPilihTab(t) { ujianState.riwayat = false; ujianState.tab = t; ujianState.bagian = null; ujianKuis = null; ujianMuat(); ujianRender(); }
function ujianPilihLevel(l) { ujianState.riwayat = false; ujianState.level = l; ujianState.bagian = null; ujianKuis = null; ujianMuat(); ujianRender(); }

function ujianMuat() {
  var kunci = ujianKunci();
  if (ujianData.status[kunci] === 'memuat') return;
  var punyaData = ujianData.status[kunci] === 'siap';
  if (!punyaData) ujianData.status[kunci] = 'memuat';
  var tipe = ujianState.tab, level = ujianState.level;
  google.script.run
    .withSuccessHandler(function (d) {
      ujianData.cache[kunci] = (d && d.soal) || [];
      ujianData.status[kunci] = 'siap';
      if (!ujianKuis && kunci === ujianKunci()) ujianRender();   // jangan ganggu soal yang sedang dikerjakan
    })
    .withFailureHandler(function (err) {
      if (punyaData) return;            // pakai data lama kalau gagal menyegarkan
      ujianData.pesan[kunci] = (err && err.message) ? err.message : String(err || '');
      ujianData.status[kunci] = 'gagal';
      if (kunci === ujianKunci()) ujianRender();
    })
    .getUjian(tipe, level);
}

function ujianSoalAktif() {
  var arr = ujianData.cache[ujianKunci()] || [];
  if (ujianState.tab === 'jlpt') arr = arr.filter(function (r) { return !r.level || String(r.level).toUpperCase().replace(/\s/g, '') === ujianState.level; });
  return arr;
}
function ujianKelompok(arr, kunci) {
  var urut = [], peta = {};
  arr.forEach(function (r) {
    var k = String(r[kunci] || '').trim() || '(Tanpa ' + kunci + ')';
    if (!peta[k]) { peta[k] = []; urut.push(k); }
    peta[k].push(r);
  });
  return urut.map(function (k) { return { nama: k, soal: peta[k] }; });
}

/* ---------- Skor & riwayat (tersimpan di perangkat, per akun) ---------- */
function ujianKunciSimpan() { return 'kotoba_ujian|' + studentName; }
function ujianMuatSkor() {
  var d = null;
  try { d = JSON.parse(localStorage.getItem(ujianKunciSimpan()) || 'null'); } catch (e) {}
  if (!d || typeof d !== 'object') d = {};
  d.best = d.best || {}; d.log = d.log || [];
  return d;
}
function ujianSimpanSkor(d) {
  try { localStorage.setItem(ujianKunciSimpan(), JSON.stringify(d)); } catch (e) {}
}
function ujianKunciLatihan(bagian, paket) { return ujianKunci() + '|' + bagian + '|' + paket; }
function ujianNamaTab() { return ujianState.tab === 'jlpt' ? 'JLPT ' + ujianState.level : 'JFT-Basic'; }
function ujianChipSkor(b) {
  if (!b) return '';
  var sempurna = b.s >= b.n && b.n > 0;
  return '<span class="uj-chip' + (sempurna ? ' emas' : '') + '">' + (sempurna ? '🌟' : '⭐') + ' ' + b.s + '/' + b.n + '</span>';
}
function ujianTanggal(t) {
  try { return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
}

/* Catat hasil saat latihan selesai: skor tertinggi per latihan + riwayat. */
function ujianCatatHasil() {
  var k = ujianKuis; if (!k || k.tercatat) return;
  k.tercatat = true;
  var d = ujianMuatSkor(), n = k.list.length;
  var lama = d.best[k.kunciSkor];
  k.rekorLama = lama || null;
  k.rekorBaru = !lama || (k.skor / n) > (lama.s / (lama.n || 1));
  var best = (k.rekorBaru || !lama) ? { s: k.skor, n: n } : { s: lama.s, n: lama.n };
  best.t = Date.now();
  best.main = (lama && lama.main ? lama.main : 0) + 1;
  d.best[k.kunciSkor] = best;
  d.log.unshift({ j: k.judul, l: k.labelTab, s: k.skor, n: n, t: Date.now() });
  if (d.log.length > 60) d.log.length = 60;
  ujianSimpanSkor(d);
  k.best = best;
}

function ujianBaris(ico, judul, ket, onclick, tanda) {
  return '<div class="fb-row" role="button" onclick="' + onclick + '"><span class="fb-ico">' + ico + '</span>' +
    '<span class="fb-txt"><b>' + kanaEsc(judul) + '</b><small>' + kanaEsc(ket) + '</small></span>' +
    (tanda || '<span class="fb-soon">Segera</span>') + '</div>';
}
var UJIAN_PANAH = '<span class="fb-go">›</span>';

function ujianRender() {
  fbSetAktif('ujian-seg', ujianState.tab, 'data-k');
  var jlpt = ujianState.tab === 'jlpt';
  var fokus = !!ujianKuis;                        // saat mengerjakan soal: sembunyikan tab & level
  fbEl('ujian-seg').classList.toggle('hidden', fokus);
  fbEl('ujian-level').classList.toggle('hidden', !jlpt || fokus);
  if (jlpt) fbSetAktif('ujian-level', ujianState.level, 'data-k');
  var wadah = fbEl('ujian-isi');
  var nama = jlpt ? ('JLPT ' + ujianState.level) : 'JFT-Basic';

  if (ujianKuis) { ujianRenderKuis(); return; }
  if (ujianState.riwayat) { ujianRenderRiwayat(); return; }

  var stat = ujianData.status[ujianKunci()];
  if (!stat || stat === 'memuat') {
    wadah.innerHTML = '<div class="fb-info">Memuat soal dari server…</div>'; return;
  }
  if (stat === 'gagal') {
    wadah.innerHTML = '<div class="fb-info"><b>Soal gagal dimuat</b><br>' + kanaEsc(ujianData.pesan[ujianKunci()] || 'Periksa koneksi internet kamu.') + '</div>' +
      '<div class="uj-aksi"><button class="uj-btn" onclick="ujianData.status[ujianKunci()]=\'\';ujianMuat();ujianRender()">Coba lagi</button></div>';
    return;
  }

  var arr = ujianSoalAktif();
  var skor = ujianMuatSkor();
  var h = '<div class="fb-info"><b>' + nama + '</b><br>' +
    (jlpt ? 'Latihan soal per bagian sesuai level yang dipilih.' : 'Latihan soal untuk ujian bahasa Jepang dasar, tersusun per bagian ujian.') + '</div>';

  if (ujianState.bagian === null) {
    ujianGrup = ujianKelompok(arr, 'bagian');
    h += '<div class="fb-judul-kecil">Latihan per bagian</div>';
    if (!ujianGrup.length) {
      h += '<div class="fb-info">Soal untuk ' + nama + ' belum tersedia.</div>';
    }
    for (var i = 0; i < ujianGrup.length; i++) {
      var g = ujianGrup[i];
      var pk = ujianKelompok(g.soal, 'paket'), selesai = 0;
      pk.forEach(function (p) { if (skor.best[ujianKunciLatihan(g.nama, p.nama)]) selesai++; });
      h += ujianBaris(ujianIkonBagian(g.nama), g.nama,
        g.soal.length + ' soal · ' + pk.length + ' paket' + (ujianMenitBagian(g.nama) ? ' · ' + ujianMenitBagian(g.nama) + ' menit/paket' : '') + (selesai ? ' · ⭐ ' + selesai + ' selesai' : ''),
        'ujianPilihBagian(' + i + ')', UJIAN_PANAH);
    }
    h += '<div class="fb-judul-kecil">Lainnya</div>';
    h += ujianBaris('時', 'Simulasi ujian lengkap', 'Semua bagian dengan batas waktu seperti ujian asli', "fbSegera('Simulasi " + nama + "')");
    h += ujianBaris('歴', 'Riwayat skor', (skor.log.length ? skor.log.length + ' latihan tercatat' : 'Belum ada latihan yang selesai'), 'ujianBukaRiwayat()', UJIAN_PANAH);
  } else {
    var gb = ujianGrup[ujianState.bagian];
    if (!gb) { ujianState.bagian = null; ujianRender(); return; }
    ujianPaket = ujianKelompok(gb.soal, 'paket');
    h += '<div class="uj-aksi kiri"><button class="uj-btn kecil" onclick="ujianKembaliDaftar()">‹ Semua bagian</button></div>';
    h += '<div class="fb-judul-kecil">' + kanaEsc(gb.nama) + ' — pilih paket</div>';
    var mntB = ujianMenitBagian(gb.nama);
    h += ujianBaris('全', 'Semua paket', gb.soal.length + ' soal' + (mntB ? ' · ' + (mntB * ujianPaket.length) + ' menit' : ''), 'ujianMulai(-1)',
      ujianChipSkor(skor.best[ujianKunciLatihan(gb.nama, '*')]) + UJIAN_PANAH);
    for (var j = 0; j < ujianPaket.length; j++) {
      h += ujianBaris(String(j + 1), ujianPaket[j].nama, ujianPaket[j].soal.length + ' soal' + (mntB ? ' · ' + mntB + ' menit' : ''), 'ujianMulai(' + j + ')',
        ujianChipSkor(skor.best[ujianKunciLatihan(gb.nama, ujianPaket[j].nama)]) + UJIAN_PANAH);
    }
  }
  wadah.innerHTML = h;
}

function ujianPilihBagian(i) { ujianState.bagian = i; ujianRender(); window.scrollTo(0, 0); }
function ujianKembaliDaftar() { ujianState.bagian = null; ujianRender(); }

function ujianBukaRiwayat() { ujianState.riwayat = true; ujianRender(); window.scrollTo(0, 0); }
function ujianTutupRiwayat() { ujianState.riwayat = false; ujianRender(); }
function ujianRenderRiwayat() {
  var d = ujianMuatSkor(), h = '';
  h += '<div class="uj-aksi kiri"><button class="uj-btn kecil" onclick="ujianTutupRiwayat()">‹ Kembali</button></div>';
  h += '<div class="fb-judul-kecil">Riwayat skor</div>';
  if (!d.log.length) {
    h += '<div class="fb-info">Belum ada latihan yang selesai. Kerjakan satu paket sampai habis, nanti skornya tercatat di sini.</div>';
  }
  d.log.forEach(function (r) {
    var sempurna = r.s >= r.n && r.n > 0;
    h += '<div class="fb-row"><span class="fb-ico">' + (sempurna ? '🌟' : '⭐') + '</span>' +
      '<span class="fb-txt"><b>' + kanaEsc(r.j) + '</b><small>' + kanaEsc(r.l) + ' · ' + ujianTanggal(r.t) + '</small></span>' +
      ujianChipSkor({ s: r.s, n: r.n }) + '</div>';
  });
  fbEl('ujian-isi').innerHTML = h;
}

function ujianAcak(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
/* Urutan opsi diacak per soal; hanya opsi yang terisi yang dipakai. */
function ujianSiapAcak(k) {
  k.acak = k.list.map(function (s) {
    var idx = [];
    for (var i = 0; i < 4; i++) if (String((s.opsi && s.opsi[i]) || '').trim()) idx.push(i);
    return ujianAcak(idx);
  });
}

/* ---------- Waktu pengerjaan (menit per paket) ---------- */
var UJIAN_WAKTU = [ { re: /moji|goi/i, menit: 25 }, { re: /bunpou/i, menit: 35 } ];
function ujianMenitBagian(nama) {
  for (var i = 0; i < UJIAN_WAKTU.length; i++) if (UJIAN_WAKTU[i].re.test(String(nama || ''))) return UJIAN_WAKTU[i].menit;
  return 0;   // bagian lain: tanpa batas waktu
}
function ujianFmtWaktu(d) {
  d = Math.max(0, Math.round(d));
  var m = Math.floor(d / 60), sc = d % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sc < 10 ? '0' : '') + sc;
}

function ujianBuatKuis(list, judul, labelTab, kunciSkor, detik) {
  var k = {
    list: list, i: 0, skor: 0, tercatat: false, judul: judul, labelTab: labelTab, kunciSkor: kunciSkor,
    jawaban: list.map(function () { return null; }),     // posisi opsi yang dipilih (null = belum)
    ragu: list.map(function () { return false; }),
    konfirmasi: '', selesai: false, tinjau: null,
    detik: detik || 0, mulai: Date.now(), berakhir: detik ? Date.now() + detik * 1000 : 0
  };
  ujianSiapAcak(k);
  return k;
}
function ujianTimerMulai(k) {
  if (!k.berakhir) return;
  var t = setInterval(function () {
    if (ujianKuis !== k || k.selesai) { clearInterval(t); return; }
    var sisa = Math.ceil((k.berakhir - Date.now()) / 1000);
    var el = document.getElementById('uj-timer');
    if (el) { el.textContent = '⏱ ' + ujianFmtWaktu(sisa); el.classList.toggle('habis', sisa <= 60); }
    if (sisa <= 0) { clearInterval(t); ujianSelesai(true); }
  }, 1000);
}

function ujianMulai(idxPaket) {
  var gb = ujianGrup[ujianState.bagian]; if (!gb) return;
  var list = (idxPaket < 0) ? gb.soal : ujianPaket[idxPaket].soal;
  if (!list || !list.length) { fbSegera('Belum ada soal', 'Paket ini belum berisi soal.'); return; }
  var menit = ujianMenitBagian(gb.nama);
  var detik = menit ? menit * 60 * (idxPaket < 0 ? ujianPaket.length : 1) : 0;
  ujianKuis = ujianBuatKuis(list,
    gb.nama + (idxPaket < 0 ? ' · Semua paket' : ' · ' + ujianPaket[idxPaket].nama),
    ujianNamaTab(), ujianKunciLatihan(gb.nama, idxPaket < 0 ? '*' : ujianPaket[idxPaket].nama), detik);
  ujianTimerMulai(ujianKuis);
  ujianRender(); window.scrollTo(0, 0);
}
function ujianKeluarKuis() { ujianKuis = null; ujianRender(); window.scrollTo(0, 0); }

function ujianKunciAsli(s) { return 'ABCD'.indexOf(String(s.jawaban || '').trim().toUpperCase().charAt(0)); }

/* ---------- Furigana (otomatis di perangkat, bisa dimatikan) ----------
   - Hasil disimpan di perangkat (localStorage) supaya soal yang sama tidak diproses lagi.
   - Bagian Moji/Goi/Kosakata menguji bacaan & penulisan kanji, jadi furigana TIDAK diberikan
     pada kata di dalam 「」 dan pada pilihan jawaban (supaya jawaban tidak terbongkar). */
var UJIAN_FURI_BAWAAN = true;              // nyala otomatis saat pertama kali
var UJIAN_FURI_KUNCI = 'kotoba_furigana_on';
var UJIAN_FURI_CACHE = 'kotoba_furigana_cache';
var UJIAN_FURI_PER_PANGGILAN = 14;
var ujianFuri = { siap: false, on: true, cache: {}, memuat: false, galat: '', gagal: {} };

function ujianFuriInit() {
  if (ujianFuri.siap) return;
  ujianFuri.siap = true;
  var v = null;
  try { v = localStorage.getItem(UJIAN_FURI_KUNCI); } catch (e) {}
  ujianFuri.on = (v === null) ? UJIAN_FURI_BAWAAN : (v === '1');
  try { ujianFuri.cache = JSON.parse(localStorage.getItem(UJIAN_FURI_CACHE) || '{}') || {}; } catch (e) { ujianFuri.cache = {}; }
}
function ujianFuriSimpan() {
  var kunci = Object.keys(ujianFuri.cache);
  if (kunci.length > 2500) { kunci.slice(0, 800).forEach(function (k) { delete ujianFuri.cache[k]; }); }
  try { localStorage.setItem(UJIAN_FURI_CACHE, JSON.stringify(ujianFuri.cache)); } catch (e) {}
}
function ujianHash(t) {
  var h = 5381;
  for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '.' + t.length;
}
var UJIAN_RE_KANJI = /[\u4e00-\u9fff\u3005]/;
function ujianModeMoji(s) { return /moji|goi|kosakata|vocab|script/i.test(String((s && s.bagian) || '')); }

/* Daftar teks yang perlu furigana untuk satu soal */
function ujianFuriTeks(s) {
  var arr = [];
  if (s.soal) arr.push(s.soal);
  if (s.teks) arr.push(s.teks);
  if (s.dokkaiTeks) arr.push(s.dokkaiTeks);
  if (!ujianModeMoji(s) && s.opsi) s.opsi.forEach(function (o) { if (o) arr.push(o); });
  return arr.map(ujianBersih).filter(function (t) { return t && t.length <= 400 && UJIAN_RE_KANJI.test(t); });
}

/* Ubah teks menjadi HTML; sisipkan <ruby> bila furigana tersedia */
function ujianTeksFuri(t, lindungiKurung) {
  var bersih = ujianBersih(t);
  var html = kanaEsc(bersih);
  if (ujianFuri.on) {
    var an = ujianFuri.cache[ujianHash(bersih)];
    if (an) {
      var x = kanaEsc(an);
      if (lindungiKurung) x = x.replace(/「[^」]*」/g, function (m) { return m.replace(/\[[^\]]*\]/g, ''); });
      html = x.replace(/([\u4e00-\u9fff\u3005\u3006\u30f6]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
    }
  }
  return html.replace(/\r?\n/g, '<br>');
}

/* ---------- Mesin furigana di perangkat (Kuromoji, gratis, tanpa server/AI) ----------
   Kamus (+-17 MB) diunduh sekali dari CDN lalu disimpan oleh browser/WebView. Berjalan di Web Worker
   supaya layar tidak macet. Hasil berformat  漢字[かんじ]  sama seperti sebelumnya, jadi tampilan
   <ruby> dan cache localStorage tidak berubah. */
var UJIAN_KURO_SUMBER = [
  { js: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js', dic: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' },
  { js: 'https://unpkg.com/kuromoji@0.1.2/build/kuromoji.js', dic: 'https://unpkg.com/kuromoji@0.1.2/dict/' }
];
var UJIAN_RE_KAN = /[\u4e00-\u9fff\u3400-\u4dbf\u3005\u3006\u30f6]/;
var UJIAN_RE_KANRUN = /[\u4e00-\u9fff\u3400-\u4dbf\u3005\u3006\u30f6]+|[^\u4e00-\u9fff\u3400-\u4dbf\u3005\u3006\u30f6]+/g;
var ujianKuro = { status: 'idle', worker: null, tk: null, antre: [], cb: {}, no: 0 };

function ujianKata2Hira(t) {
  return String(t).replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
}

/* Satu token Kuromoji -> teks berbracket. Okurigana di awal/akhir dikeluarkan dari kurung. */
function ujianRubyTeks(sf, rd) {
  var pre = '', suf = '';
  while (sf.length > 1 && rd.length > 1 && !UJIAN_RE_KAN.test(sf.charAt(sf.length - 1)) && sf.charAt(sf.length - 1) === rd.charAt(rd.length - 1)) {
    suf = sf.charAt(sf.length - 1) + suf; sf = sf.slice(0, -1); rd = rd.slice(0, -1);
  }
  while (sf.length > 1 && rd.length > 1 && !UJIAN_RE_KAN.test(sf.charAt(0)) && sf.charAt(0) === rd.charAt(0)) {
    pre += sf.charAt(0); sf = sf.slice(1); rd = rd.slice(1);
  }
  var runs = sf.match(UJIAN_RE_KANRUN) || [sf];
  if (runs.length === 1) return pre + sf + '[' + rd + ']' + suf;
  // kanji + kana di tengah (mis. 引き出): sejajarkan memakai kana sebagai patokan
  var pola = '^' + runs.map(function (r) {
    return UJIAN_RE_KAN.test(r.charAt(0)) ? '(.+?)' : ujianKata2Hira(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('') + '$';
  var m = rd.match(new RegExp(pola));
  if (!m) return pre + sf + suf;                 // tidak bisa disejajarkan: tanpa furigana
  var g = 1;
  return pre + runs.map(function (r) { return UJIAN_RE_KAN.test(r.charAt(0)) ? r + '[' + m[g++] + ']' : r; }).join('') + suf;
}
function ujianFuriDariToken(toks) {
  return toks.map(function (t) {
    var sf = t[0], rd = t[1];
    if (!UJIAN_RE_KAN.test(sf) || !rd || rd === '*') return sf;
    return ujianRubyTeks(sf, ujianKata2Hira(rd));
  }).join('');
}

function ujianKuroSelesai(ok) {
  ujianKuro.status = ok ? 'ready' : 'fail';
  var a = ujianKuro.antre; ujianKuro.antre = [];
  a.forEach(function (x) { ujianKuroToken(x.items, x.cb); });
}
function ujianKuroMulai() {
  if (ujianKuro.status === 'loading' || ujianKuro.status === 'ready') return;
  ujianKuro.status = 'loading';
  var src = "var S=null,tk=null;function init(i){if(i>=S.length){postMessage({t:'err'});return}" +
    "try{if(!self.kuromoji)importScripts(S[i].js);kuromoji.builder({dicPath:S[i].dic}).build(function(e,t){if(e||!t){init(i+1);return}tk=t;postMessage({t:'ready'})})}catch(x){init(i+1)}}" +
    "onmessage=function(e){var m=e.data;if(m.t==='init'){S=m.src;init(0)}else if(m.t==='tok'){var o=m.items.map(function(s){try{return tk.tokenize(s).map(function(x){return [x.surface_form,x.reading]})}catch(x){return null}});postMessage({t:'res',id:m.id,out:o})}};";
  try {
    var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    ujianKuro.worker = w;
    w.onmessage = function (e) {
      var m = e.data;
      if (m.t === 'ready') ujianKuroSelesai(true);
      else if (m.t === 'err') ujianKuroSelesai(false);
      else if (m.t === 'res') { var cb = ujianKuro.cb[m.id]; delete ujianKuro.cb[m.id]; if (cb) cb(m.out); }
    };
    w.onerror = function () { ujianKuro.worker = null; ujianKuroMuatBiasa(0); };   // Worker tidak didukung
    w.postMessage({ t: 'init', src: UJIAN_KURO_SUMBER });
  } catch (e) { ujianKuro.worker = null; ujianKuroMuatBiasa(0); }
}
function ujianKuroMuatBiasa(i) {   // cadangan: jalan di thread utama
  if (i >= UJIAN_KURO_SUMBER.length) { ujianKuroSelesai(false); return; }
  var sc = document.createElement('script');
  sc.src = UJIAN_KURO_SUMBER[i].js;
  sc.onload = function () {
    try {
      kuromoji.builder({ dicPath: UJIAN_KURO_SUMBER[i].dic }).build(function (err, t) {
        if (err || !t) { ujianKuroMuatBiasa(i + 1); return; }
        ujianKuro.tk = t; ujianKuroSelesai(true);
      });
    } catch (e) { ujianKuroMuatBiasa(i + 1); }
  };
  sc.onerror = function () { ujianKuroMuatBiasa(i + 1); };
  document.head.appendChild(sc);
}
/* cb(hasil, galat): hasil = array token per teks (atau null bila gagal) */
function ujianKuroToken(items, cb) {
  if (ujianKuro.status === 'fail') { cb(null, 'Kamus furigana gagal dimuat. Periksa koneksi internet lalu aktifkan ulang tombol Furigana.'); return; }
  if (ujianKuro.status !== 'ready') { ujianKuro.antre.push({ items: items, cb: cb }); return; }
  if (ujianKuro.worker) {
    var id = ++ujianKuro.no;
    ujianKuro.cb[id] = function (out) { cb(out, ''); };
    ujianKuro.worker.postMessage({ t: 'tok', id: id, items: items });
  } else if (ujianKuro.tk) {
    cb(items.map(function (s) {
      try { return ujianKuro.tk.tokenize(s).map(function (x) { return [x.surface_form, x.reading]; }); } catch (e) { return null; }
    }), '');
  }
}

function ujianToggleFuri() {
  ujianFuriInit();
  ujianFuri.on = !ujianFuri.on;
  try { localStorage.setItem(UJIAN_FURI_KUNCI, ujianFuri.on ? '1' : '0'); } catch (e) {}
  ujianFuri.galat = ''; ujianFuri.gagal = {};
  if (ujianFuri.on && ujianKuro.status === 'fail') ujianKuro.status = 'idle';   // coba muat ulang kamus
  if (ujianKuis) ujianRenderKuis();
}

/* Pastikan furigana untuk 8 soal ke depan sudah ada; dibuat langsung di perangkat */
function ujianFuriPastikan() {
  ujianFuriInit();
  var k = ujianKuis;
  if (!ujianFuri.on || !k || ujianFuri.memuat || ujianFuri.galat) return;
  var perlu = [], lihat = {};
  for (var q = k.i; q < Math.min(k.list.length, k.i + 8); q++) {
    ujianFuriTeks(k.list[q]).forEach(function (t) {
      var h = ujianHash(t);
      if (!lihat[h] && !ujianFuri.cache[h] && !ujianFuri.gagal[h]) { lihat[h] = 1; perlu.push(t); }
    });
  }
  if (!perlu.length) return;
  ujianFuri.memuat = true;
  ujianKuroMulai();
  ujianKuroToken(perlu, function (hasil, galat) {
    if (galat) {
      ujianFuri.galat = galat;
    } else {
      perlu.forEach(function (t, n) {
        var a = hasil && hasil[n] ? ujianFuriDariToken(hasil[n]) : '';
        if (a && a.replace(/\[[^\]]*\]/g, '') === t) ujianFuri.cache[ujianHash(t)] = a;
        else ujianFuri.gagal[ujianHash(t)] = true;
      });
      ujianFuriSimpan();
    }
    ujianFuri.memuat = false;
    if (ujianKuis && ujianFuri.on) {
      if (ujianKuis.i < ujianKuis.list.length) ujianRenderKuis();
      ujianFuriPastikan();
    }
  });
}

function ujianFuriAlat() {
  ujianFuriInit();
  var info = '';
  if (ujianFuri.on) {
    if (ujianFuri.galat) info = '<span class="uj-furi-info err">Furigana belum tersedia: ' + kanaEsc(ujianFuri.galat) + '</span>';
    else if (ujianFuri.memuat) info = '<span class="uj-furi-info">⏳ ' + (ujianKuro.status === 'ready' ? 'memuat furigana…' : 'menyiapkan kamus furigana (hanya saat pertama kali)…') + '</span>';
  }
  return '<div class="uj-alat"><button class="uj-furi-btn' + (ujianFuri.on ? ' on' : '') + '" onclick="ujianToggleFuri()">' +
    '<span class="uj-furi-ico">ふ</span> Furigana <b>' + (ujianFuri.on ? 'ON' : 'OFF') + '</b></button>' + info + '</div>';
}

/* Kartu soal + pilihan jawaban. tinjau=true: tampilan koreksi (benar/salah + pembahasan) */
function ujianBlokSoal(k, idx, tinjau) {
  var n = k.list.length, s = k.list[idx], urut = k.acak[idx];
  var posBenar = urut.indexOf(ujianKunciAsli(s));
  var pilih = k.jawaban[idx];
  var h = '<div class="uj-kartu">';
  var noDk = '';
  if (s.dokkai) {
    var anggota = [], posDk = 0;
    for (var q = 0; q < n; q++) if (k.list[q].dokkai === s.dokkai) { if (q === idx) posDk = anggota.length; anggota.push(q); }
    noDk = '<span class="uj-dokkai-no">Pertanyaan ' + (posDk + 1) + ' dari ' + anggota.length + '</span>';
  }
  if (s.mondai || noDk) h += '<div class="uj-tagbaris">' + (s.mondai ? '<span class="uj-tag">' + kanaEsc(s.mondai) + '</span>' : '') + noDk + '</div>';
  if (s.dokkai) {
    if (s.dokkaiAudio) h += '<audio class="uj-audio" controls preload="none" src="' + kanaEsc(s.dokkaiAudio) + '"></audio>';
    if (s.dokkaiGambar) h += '<img class="uj-dokkai-img" src="' + kanaEsc(s.dokkaiGambar) + '" alt="Teks Dokkai" onclick="this.classList.toggle(\'zoom\')" onerror="this.style.display=\'none\'">';
    if (s.dokkaiTeks) h += '<div class="uj-teks">' + ujianTeksFuri(s.dokkaiTeks, false) + '</div>';
  }
  if (s.audio) h += '<audio class="uj-audio" controls preload="none" src="' + kanaEsc(s.audio) + '"></audio>';
  if (s.gambar) h += '<img class="uj-gambar" src="' + kanaEsc(s.gambar) + '" alt="" onerror="this.style.display=\'none\'">';
  if (s.teks) h += '<div class="uj-teks">' + ujianTeksFuri(s.teks, false) + '</div>';
  if (s.soal) h += '<div class="uj-soal">' + ujianTeksFuri(s.soal, ujianModeMoji(s)) + '</div>';
  else if (s.dokkai) h += '<div class="uj-soal-dokkai">Pilih jawaban yang paling tepat' + (s.no ? ' (No. ' + kanaEsc(s.no) + ')' : '') + '</div>';
  h += '</div><div class="uj-opsi">';
  for (var p = 0; p < urut.length; p++) {
    var kls = 'uj-op';
    if (tinjau) {
      if (p === posBenar) kls += ' benar';
      else if (p === pilih) kls += ' salah';
      else kls += ' pudar';
    } else if (p === pilih) kls += ' pilih';
    h += '<button class="' + kls + '"' + (tinjau ? ' disabled' : ' onclick="ujianPilihJawab(' + p + ')"') + '>' +
      '<span class="uj-huruf">' + 'ABCD'.charAt(p) + '</span><span class="uj-teks-op">' + (ujianModeMoji(s) ? kanaEsc(ujianBersih(s.opsi[urut[p]])) : ujianTeksFuri(s.opsi[urut[p]], false)) + '</span></button>';
  }
  h += '</div>';
  if (tinjau) {
    var benar = posBenar >= 0 && pilih === posBenar;
    h += '<div class="uj-bahas ' + (benar ? 'ok' : 'no') + '">' +
      '<b>' + (posBenar < 0 ? 'Kunci jawaban belum diisi' : (benar ? 'Benar! ✅' : (pilih === null ? 'Tidak dijawab. ' : 'Kurang tepat. ') + 'Jawaban benar: ' + 'ABCD'.charAt(posBenar))) + '</b>' +
      (s.pembahasan ? '<div>' + ujianNl(s.pembahasan) + '</div>' : '') + '</div>';
  }
  return h;
}

function ujianHitung(k) {
  var j = 0, r = 0;
  for (var i = 0; i < k.list.length; i++) { if (k.jawaban[i] !== null) j++; if (k.ragu[i]) r++; }
  return { jawab: j, belum: k.list.length - j, ragu: r };
}

function ujianGridNav(k) {
  var n = k.list.length, g = '';
  for (var i = 0; i < n; i++) {
    g += '<button class="uj-nv' + (k.jawaban[i] !== null ? ' dj' : '') + (k.ragu[i] ? ' rg' : '') + (i === k.i ? ' now' : '') +
      '" onclick="ujianKe(' + i + ')">' + (i + 1) + '</button>';
  }
  return '<div class="uj-nav"><div class="uj-nav-judul">Navigasi soal</div><div class="uj-nav-grid">' + g + '</div>' +
    '<div class="uj-nav-ket"><span><i class="sd"></i>Sudah dijawab</span><span><i class="rg"></i>Ragu-ragu</span><span><i class="bl"></i>Belum</span></div>' +
    '<div class="uj-aksi kanan"><button class="uj-btn kirim" onclick="ujianMintaKonfirmasi(\'kirim\')">Selesai &amp; kirim jawaban</button></div></div>';
}

function ujianPanelKonfirmasi(k) {
  if (!k.konfirmasi) return '';
  var c = ujianHitung(k), isi, ya, label;
  if (k.konfirmasi === 'keluar') {
    isi = 'Keluar dari latihan? Jawaban yang sudah dipilih tidak akan disimpan.'; ya = 'ujianKeluarKuis()'; label = 'Ya, keluar';
  } else {
    isi = (c.belum ? c.belum + ' soal belum dijawab' : 'Semua soal sudah dijawab') + (c.ragu ? ', ' + c.ragu + ' soal ditandai ragu-ragu' : '') + '. Kirim jawaban sekarang?';
    ya = 'ujianSelesai(false)'; label = 'Ya, kirim';
  }
  return '<div class="uj-konfirm"><div>' + isi + '</div><div class="uj-aksi"><button class="uj-btn" onclick="' + ya + '">' + label + '</button>' +
    '<button class="uj-btn kecil" onclick="ujianBatalKonfirmasi()">Kembali</button></div></div>';
}

function ujianRenderKuis() {
  var k = ujianKuis, wadah = fbEl('ujian-isi'), n = k.list.length;
  if (k.selesai) { ujianRenderHasil(); return; }
  var c = ujianHitung(k);
  var ada = !!k.berakhir;
  var sisa = ada ? Math.max(0, Math.ceil((k.berakhir - Date.now()) / 1000)) : 0;
  var h = '<div class="uj-top"><button class="uj-btn kecil" onclick="ujianMintaKonfirmasi(\'keluar\')">‹ Keluar</button>' +
    '<span class="uj-no">Soal ' + (k.i + 1) + ' / ' + n + '</span>' +
    (ada ? '<span id="uj-timer" class="uj-waktu' + (sisa <= 60 ? ' habis' : '') + '">⏱ ' + ujianFmtWaktu(sisa) + '</span>'
         : '<span class="uj-skor">' + c.jawab + '/' + n + '</span>') + '</div>';
  h += ujianPanelKonfirmasi(k);
  h += ujianFuriAlat();
  h += '<div class="uj-bar"><i style="width:' + Math.round(c.jawab / n * 100) + '%"></i></div>';
  h += '<div class="uj-judul">' + kanaEsc(k.judul) + (ada ? ' · waktu ' + Math.round(k.detik / 60) + ' menit' : '') + '</div>';
  h += ujianBlokSoal(k, k.i, false);
  h += '<div class="uj-navsoal"><button class="uj-btn kecil"' + (k.i <= 0 ? ' disabled' : '') + ' onclick="ujianKe(' + (k.i - 1) + ')">‹ Sebelumnya</button>' +
    '<button class="uj-ragu' + (k.ragu[k.i] ? ' on' : '') + '" onclick="ujianToggleRagu()">🚩 Ragu-ragu</button>' +
    '<button class="uj-btn kecil"' + (k.i >= n - 1 ? ' disabled' : '') + ' onclick="ujianKe(' + (k.i + 1) + ')">Berikutnya ›</button></div>';
  h += ujianGridNav(k);
  wadah.innerHTML = h;
  setTimeout(ujianFuriPastikan, 0);
}

function ujianPilihJawab(p) {
  var k = ujianKuis; if (!k || k.selesai) return;
  k.jawaban[k.i] = (k.jawaban[k.i] === p) ? null : p;      // ketuk lagi = batal pilih
  var y = window.pageYOffset;
  ujianRenderKuis();
  window.scrollTo(0, y);
}
function ujianToggleRagu() {
  var k = ujianKuis; if (!k || k.selesai) return;
  k.ragu[k.i] = !k.ragu[k.i];
  var y = window.pageYOffset;
  ujianRenderKuis();
  window.scrollTo(0, y);
}
function ujianKe(i) {
  var k = ujianKuis; if (!k || k.selesai) return;
  if (i < 0 || i >= k.list.length) return;
  k.i = i; k.konfirmasi = '';
  ujianRenderKuis(); window.scrollTo(0, 0);
}
function ujianMintaKonfirmasi(jenis) {
  var k = ujianKuis; if (!k || k.selesai) return;
  k.konfirmasi = jenis;
  ujianRenderKuis(); window.scrollTo(0, 0);
}
function ujianBatalKonfirmasi() {
  var k = ujianKuis; if (!k) return;
  k.konfirmasi = '';
  ujianRenderKuis();
}

/* Kirim jawaban: nilai dihitung di sini (otomatis=true bila waktu habis) */
function ujianSelesai(otomatis) {
  var k = ujianKuis; if (!k || k.selesai) return;
  var skor = 0;
  k.list.forEach(function (s, i) {
    var pos = k.acak[i].indexOf(ujianKunciAsli(s));
    if (k.jawaban[i] !== null && k.jawaban[i] === pos) skor++;
  });
  k.skor = skor; k.selesai = true; k.otomatis = !!otomatis; k.konfirmasi = ''; k.tinjau = null;
  k.terpakai = Math.round((Date.now() - k.mulai) / 1000);
  if (k.detik && k.terpakai > k.detik) k.terpakai = k.detik;
  ujianRender(); window.scrollTo(0, 0);
}

function ujianStatusSoal(k, i) {
  var pos = k.acak[i].indexOf(ujianKunciAsli(k.list[i]));
  if (k.jawaban[i] === null) return 'ks';
  return (pos >= 0 && k.jawaban[i] === pos) ? 'bn' : 'sl';
}
function ujianTinjau(i) {
  var k = ujianKuis; if (!k || !k.selesai) return;
  k.tinjau = i; k.i = i;
  ujianRenderHasil();
  setTimeout(function () {
    var e = document.getElementById('uj-tinjau');
    if (e && e.scrollIntoView) { try { e.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (x) {} }
  }, 40);
  setTimeout(ujianFuriPastikan, 0);
}

function ujianRenderHasil() {
  var k = ujianKuis, n = k.list.length;
  ujianCatatHasil();
  var kosong = 0, g = '';
  for (var i = 0; i < n; i++) {
    var st = ujianStatusSoal(k, i);
    if (st === 'ks') kosong++;
    g += '<button class="uj-nv ' + st + (i === k.tinjau ? ' now' : '') + '" onclick="ujianTinjau(' + i + ')">' + (i + 1) + '</button>';
  }
  var salah = n - k.skor - kosong;
  var persen = Math.round(k.skor / n * 100);
  var pesan = persen >= 80 ? 'Sugoi! Hampir sempurna 🎉' : persen >= 60 ? 'Bagus! Terus berlatih ya 💪' : 'Jangan menyerah, coba ulangi lagi ya 🙏';
  var sempurna = k.skor >= n;
  var rekor = k.rekorBaru ? (k.rekorLama ? 'Rekor baru! Sebelumnya ' + k.rekorLama.s + '/' + k.rekorLama.n + ' 🏆' : 'Skor pertamamu tersimpan ✨')
                          : 'Skor tertinggi: ' + k.best.s + '/' + k.best.n + ' 🏆';
  var h =
    '<div class="uj-hasil"><div class="uj-hasil-bintang">' + (sempurna ? '🌟' : '⭐') + '</div>' +
    '<div class="uj-hasil-judul">' + (k.otomatis ? 'Waktu habis, jawaban dikirim otomatis ⏰' : 'Latihan selesai!') + '</div>' +
    '<div class="uj-hasil-skor">' + k.skor + ' / ' + n + '</div>' +
    '<div class="uj-hasil-persen">' + persen + '%</div>' +
    '<div class="uj-hasil-rinci"><span>✅ Benar ' + k.skor + '</span><span>❌ Salah ' + salah + '</span><span>➖ Kosong ' + kosong + '</span>' +
      (k.terpakai != null ? '<span>⏱ ' + ujianFmtWaktu(k.terpakai) + '</span>' : '') + '</div>' +
    '<div class="uj-hasil-pesan">' + pesan + '</div>' +
    '<div class="uj-hasil-rekor">' + rekor + '</div>' +
    '<div class="uj-judul">' + kanaEsc(k.judul) + '</div></div>' +
    '<div class="uj-aksi"><button class="uj-btn" onclick="ujianUlangi()">Ulangi</button> ' +
    '<button class="uj-btn kecil" onclick="ujianKeluarKuis()">Kembali ke daftar</button></div>' +
    '<div class="uj-nav"><div class="uj-nav-judul">Tinjau jawaban <small>(ketuk nomor soal)</small></div><div class="uj-nav-grid">' + g + '</div>' +
    '<div class="uj-nav-ket"><span><i class="bn"></i>Benar</span><span><i class="sl"></i>Salah</span><span><i class="ks"></i>Kosong</span></div></div>';
  if (k.tinjau !== null) {
    h += '<div id="uj-tinjau" class="uj-tinjau-judul">Soal ' + (k.tinjau + 1) + ' dari ' + n + '</div>' + ujianBlokSoal(k, k.tinjau, true);
  }
  fbEl('ujian-isi').innerHTML = h;
}
function ujianUlangi() {
  var k = ujianKuis; if (!k) return;
  ujianKuis = ujianBuatKuis(k.list, k.judul, k.labelTab, k.kunciSkor, k.detik);
  ujianTimerMulai(ujianKuis);
  ujianRender(); window.scrollTo(0, 0);
}

/* =====================================================================
   HIBURAN (Video / Musik / Berita)
   - Video & Musik: daftar diambil dari sheet "Hiburan" (lewat getHiburan() di server),
     diputar langsung di dalam aplikasi. Hanya menampilkan video.
   ===================================================================== */
var hiburanState = { tab: 'video', level: 'Semua' };
var hiburanServer = { video: [], musik: [], berita: [] };   // isi dari spreadsheet
var hiburanPesan = '';                                       // pesan error terakhir dari server
var hiburanStatus = 'belum';                                 // belum | memuat | siap | gagal
var HB_WARNA = [['#f472b6','#db2777'],['#fb923c','#ea580c'],['#a78bfa','#7c3aed'],['#38bdf8','#2563eb'],['#34d399','#059669']];
var HB_IKON = { video: '🎬', musik: '🎵', berita: '📰' };

/* item bawaan: tanpa url = contoh tampilan, hanya muncul bila tab masih kosong */
var HIBURAN_CONTOH = {
  video: [
    { judul: 'Percakapan di stasiun kereta', lv: 'N5' },
    { judul: 'Belanja di minimarket', lv: 'N5' },
    { judul: 'Memesan makanan di restoran', lv: 'N4' },
    { judul: 'Wawancara kerja sederhana', lv: 'N3' }
  ],
  musik: [
    { judul: 'Lagu anak untuk hafal angka', lv: 'N5' },
    { judul: 'Lagu musim semi dan hanami', lv: 'N4' },
    { judul: 'Lagu pop pelan, lirik mudah', lv: 'N3' }
  ],
  berita: [
    { judul: 'NHK News Web Easy (berita berfurigana)', lv: 'N4', url: 'https://www3.nhk.or.jp/news/easy/', bawaan: true },
    { judul: 'Cuaca hari ini (berfurigana)', lv: 'N5' },
    { judul: 'Kereta baru mulai beroperasi', lv: 'N3' }
  ]
};
var HIBURAN_KETERANGAN = {
  video: 'Tonton video pendek, lalu cek kosakata dan artinya.',
  musik: 'Dengarkan lagu sambil mengikuti lirik dan artinya.',
  berita: 'Baca berita mudah dengan furigana, lengkap dengan audio.'
};

function hbEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function hbYtId(url) {
  var m = String(url || '').trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

var HIBURAN_TAMPIL = false;   // false = menu Hiburan disembunyikan sementara; ubah ke true untuk membuka lagi
function bukaHiburanDariMain(tab) {
  if (!HIBURAN_TAMPIL) return;
  fbBuka('hiburan-page');
  hiburanState.tab = HIBURAN_CONTOH[tab] ? tab : 'video';
  hiburanState.level = 'Semua';
  hiburanMuat();
}
function hiburanMuat() {
  hiburanStatus = 'memuat';
  hiburanRender();
  google.script.run
    .withSuccessHandler(function (rows) {
      var s = { video: [], musik: [], berita: [] };
      (rows || []).forEach(function (r) {
        var k = (r.kategori === 'musik' || r.kategori === 'berita') ? r.kategori : 'video';
        s[k].push({ judul: r.judul, lv: r.level || '-', url: r.url, yt: hbYtId(r.url), durasi: r.durasi, no: r.no });
      });
      hiburanServer = s;
      hiburanStatus = 'siap';
      hiburanRender();
    })
    .withFailureHandler(function (err) {
      hiburanPesan = (err && err.message) ? err.message : String(err || '');
      hiburanStatus = 'gagal';
      hiburanRender();
    })
    .getHiburan();
}
function hiburanPilihTab(t) { hiburanState.tab = t; hiburanRender(); }
function hiburanPilihLevel(l) { hiburanState.level = l; hiburanRender(); }

function hiburanRender() {
  fbSetAktif('hiburan-seg', hiburanState.tab, 'data-k');
  fbSetAktif('hiburan-level', hiburanState.level, 'data-k');
  var tab = hiburanState.tab;
  var simpan = hiburanServer[tab] || [];
  var punyaSendiri = simpan.length > 0;
  var sumber = [];
  var i;
  for (i = 0; i < simpan.length; i++) sumber.push({ d: simpan[i], idx: i, milik: true });
  var contoh = HIBURAN_CONTOH[tab];
  if (hiburanStatus === 'siap') {
    for (i = 0; i < contoh.length; i++) {
      if (contoh[i].bawaan || !punyaSendiri) sumber.push({ d: contoh[i], idx: i, milik: false });
    }
  }
  var data = sumber.filter(function (x) {
    return hiburanState.level === 'Semua' || x.d.lv === hiburanState.level;
  });

  var h = '<div class="fb-info">' + HIBURAN_KETERANGAN[tab] + '</div>';
  if (hiburanStatus === 'memuat') {
    h += '<div class="fb-info">Memuat daftar…</div>';
  } else if (hiburanStatus === 'gagal') {
    h += '<div class="fb-info">Daftar belum bisa dimuat. ' + (hiburanPesan ? '<br><small>Penyebab: ' + hbEsc(hiburanPesan) + '</small><br>' : 'Periksa koneksi internet. ') + '<b role="button" onclick="hiburanMuat()" style="text-decoration:underline;cursor:pointer">Coba lagi</b></div>';
  } else if (!data.length) {
    h += '<div class="fb-info">Belum ada konten untuk level ' + hiburanState.level + '. Coba pilih level lain.</div>';
  }
  for (i = 0; i < data.length; i++) {
    var x = data[i], d = x.d, w = HB_WARNA[(x.idx + i) % HB_WARNA.length];
    var aksi, bg = '', isi = HB_IKON[tab], tag = '';
    if (x.milik) {
      aksi = "hiburanBuka(" + x.idx + ")";
      if (d.yt) { bg = ' background-image:url(https://img.youtube.com/vi/' + hbEsc(d.yt) + '/mqdefault.jpg);'; isi = '<span class="hb-play">▶</span>'; }
    } else if (d.url) {
      aksi = "window.open('" + d.url + "','_blank','noopener')";
      tag = 'Rekomendasi';
    } else {
      aksi = "fbSegera('Contoh tampilan 🚧','Ini baru contoh tampilan. Konten sungguhan akan ditambahkan oleh sensei.')";
      tag = 'Contoh';
    }
    h += '<div class="hb-item" role="button" onclick="' + aksi + '">' +
      '<div class="hb-thumb" style="--t1:' + w[0] + ';--t2:' + w[1] + ';' + bg + '">' + isi + '</div>' +
      '<div class="hb-body"><b>' + hbEsc(d.judul) + '</b><div class="hb-meta"><span class="hb-lv">' + hbEsc(d.lv) + '</span>' +
      (d.durasi ? '<span>⏱ ' + hbEsc(d.durasi) + '</span>' : '') +
      (tag ? '<span>' + tag + '</span>' : (d.yt ? '<span>YouTube</span>' : '<span>Link</span>')) + '</div></div></div>';
  }
  fbEl('hiburan-isi').innerHTML = h;
}

/* ---------- putar / buka ---------- */
function hiburanBuka(idx) {
  var tab = hiburanState.tab, d = (hiburanServer[tab] || [])[idx];
  if (!d) return;
  if (!d.yt) { window.open(d.url, '_blank', 'noopener'); return; }
  if (d.no) { hblBuka(d); return; }   // punya NO di sheet -> Mode Belajar
  fbEl('hb-player-judul').textContent = d.judul;
  fbEl('hb-player-frame').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(d.yt) +
    '?rel=0&playsinline=1" title="Pemutar video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  fbEl('hb-player-yt').href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(d.yt);
  fbEl('hb-player-modal').classList.remove('modal-hidden');
}
function hiburanTutupPlayer() {
  fbEl('hb-player-frame').innerHTML = '';   // hentikan video
  fbEl('hb-player-modal').classList.add('modal-hidden');
}
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (!fbEl('hb-player-modal').classList.contains('modal-hidden')) hiburanTutupPlayer();
});



/* =====================================================================
   HIBURAN — MODE BELAJAR (video YouTube + subtitle sinkron + Tanya AI)
   Data: getSubtitle(no) dari server. Pemutar: YouTube IFrame API.
   Bila IFrame API gagal dimuat, otomatis jatuh ke pemutar biasa tanpa sinkron.
   ===================================================================== */
var hbl = {
  aktif: false, d: null, lines: [], idx: -1,
  player: null, siap: false, fallback: false, state: -1,
  timer: null, readyTimer: null,
  loop: false, speedIdx: 0, seeking: false, durasi: 0, sentuh: 0,
  ai: false, aiIdx: -1, aiToken: 0, token: 0,
  opsi: { furi: true, romaji: true, arti: true, fokus: true }
};
var HBL_KUNCI_OPSI = 'kotoba_hbl_opsi';
var HBL_KECEPATAN = [1, 0.75, 0.5];
var hblApiMenunggu = [], hblApiMemuat = false;

function hblBacaOpsi() {
  try {
    var o = JSON.parse(localStorage.getItem(HBL_KUNCI_OPSI) || 'null');
    if (o && typeof o === 'object') {
      ['furi', 'romaji', 'arti', 'fokus'].forEach(function (k) { if (typeof o[k] === 'boolean') hbl.opsi[k] = o[k]; });
      var si = HBL_KECEPATAN.indexOf(Number(o.speed));
      hbl.speedIdx = si >= 0 ? si : 0;
    }
  } catch (e) {}
}
function hblSimpanOpsi() {
  try {
    var o = {}; for (var k in hbl.opsi) o[k] = hbl.opsi[k];
    o.speed = HBL_KECEPATAN[hbl.speedIdx];
    localStorage.setItem(HBL_KUNCI_OPSI, JSON.stringify(o));
  } catch (e) {}
}

function hblFmt(t) {
  t = Math.max(0, Math.floor(Number(t) || 0));
  var m = Math.floor(t / 60), s = t % 60;
  if (m >= 60) { var h = Math.floor(m / 60); m = m % 60; return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ---------- buka / tutup ---------- */
function hblBuka(d) {
  if (!d || !d.yt) return;
  hblBersihkanPlayer();
  hbl.token++;
  var token = hbl.token;
  hbl.d = d; hbl.lines = []; hbl.idx = -1; hbl.loop = false;
  hbl.siap = false; hbl.fallback = false; hbl.durasi = 0; hbl.state = -1; hbl.seeking = false;
  hbl.ai = false; hbl.sentuh = 0;
  hblBacaOpsi();

  fbEl('hiburan-page').classList.add('hidden');
  fbEl('hbl-page').classList.remove('hidden');
  document.body.classList.add('hbl-buka');
  hbl.aktif = true;

  fbEl('hbl-judul').textContent = d.judul || '';
  hblTampilPesan('');
  fbEl('hbl-list').className = 'hbl-list';
  fbEl('hbl-list').innerHTML = '<div class="hbl-kosong">Memuat subtitle…</div>';
  fbEl('hbl-t-now').textContent = '0:00';
  fbEl('hbl-t-all').textContent = '0:00';
  fbEl('hbl-seek').value = 0;
  hblRenderOpsi();
  hblRenderKontrol();
  catatAktivitas('Hiburan', d.judul || '');

  hblMuatSubtitle(token);
  hblBuatPlayer(token);
  hbl.timer = setInterval(hblTick, 200);
}

function hblBersihkanPlayer() {
  if (hbl.timer) { clearInterval(hbl.timer); hbl.timer = null; }
  if (hbl.readyTimer) { clearTimeout(hbl.readyTimer); hbl.readyTimer = null; }
  if (hbl.player) { try { hbl.player.destroy(); } catch (e) {} hbl.player = null; }
  var w = fbEl('hbl-yt-wrap'); if (w) w.innerHTML = '';
}

function hblTutup() {
  hblAiTutup();
  hblBersihkanPlayer();
  hbl.aktif = false;
  hbl.token++;
  fbEl('hbl-page').classList.add('hidden');
  document.body.classList.remove('hbl-buka');
  fbEl('hiburan-page').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function hblTampilPesan(html) {
  var el = fbEl('hbl-pesan');
  el.innerHTML = html || '';
  el.classList.toggle('hidden', !html);
}

/* ---------- subtitle ---------- */
function hblMuatSubtitle(token) {
  var d = hbl.d;
  if (!d.no) { hblTerimaSubtitle({ lines: [], pesan: 'Video ini belum punya nomor (kolom NO di sheet Hiburan), jadi subtitle belum bisa dimuat.' }); return; }
  google.script.run
    .withSuccessHandler(function (r) { if (token === hbl.token && hbl.aktif) hblTerimaSubtitle(r || {}); })
    .withFailureHandler(function (err) {
      if (token !== hbl.token || !hbl.aktif) return;
      var pesan = (err && err.message) ? String(err.message) : '';
      fbEl('hbl-list').innerHTML = '<div class="hbl-kosong">Subtitle belum bisa dimuat.' + (pesan ? '<br><small>' + hbEsc(pesan) + '</small>' : '') +
        '<br><b role="button" style="text-decoration:underline;cursor:pointer" onclick="hblMuatSubtitle(hbl.token)">Coba lagi</b></div>';
    })
    .getSubtitle(d.no);
}

function hblTerimaSubtitle(r) {
  var arr = Array.isArray(r.lines) ? r.lines : [];
  hbl.lines = arr.filter(function (l) { return l && typeof l.mulai === 'number' && !isNaN(l.mulai) && l.tokens && l.tokens.length; });
  hbl.ai = !!r.ai;
  hblRenderList(r.pesan);
  hblRenderKontrol();
}

function hblHtmlBaris(l, i) {
  var h = '<div class="hbl-baris' + (hbl.ai ? ' ada-ai' : '') + '" id="hbl-b' + i + '" role="button" onclick="hblKeBaris(' + i + ')">';
  h += '<div class="hbl-jp">';
  for (var k = 0; k < l.tokens.length; k++) {
    var t = l.tokens[k];
    h += '<span class="hbl-w"><i class="f">' + (t.f ? hbEsc(t.f) : '&nbsp;') + '</i><b class="t">' + hbEsc(t.t) +
         '</b><i class="r">' + (t.r ? hbEsc(t.r) : '&nbsp;') + '</i></span>';
  }
  h += '</div>';
  if (l.furiBaris) h += '<div class="hbl-fl">' + hbEsc(l.furiBaris) + '</div>';
  if (l.romajiBaris) h += '<div class="hbl-rl">' + hbEsc(l.romajiBaris) + '</div>';
  if (l.arti) h += '<div class="hbl-id">' + hbEsc(l.arti) + '</div>';
  if (hbl.ai) h += '<span class="hbl-ai-btn" role="button" aria-label="Jelaskan kalimat ini" onclick="event.stopPropagation();hblAiBuka(' + i + ')">&#10024;</span>';
  return h + '</div>';
}

function hblRenderList(pesan) {
  var el = fbEl('hbl-list');
  if (!hbl.lines.length) {
    el.className = 'hbl-list';
    el.innerHTML = '<div class="hbl-kosong">' + hbEsc(pesan || 'Subtitle untuk video ini belum tersedia.') +
      '<br>Video tetap bisa diputar.</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < hbl.lines.length; i++) h += hblHtmlBaris(hbl.lines[i], i);
  el.innerHTML = h;
  hblTerapkanOpsi();
  hbl.idx = -1;
  el.scrollTop = 0;
}

/* ---------- opsi tampilan ---------- */
var HBL_OPSI_DAFTAR = [['furi', 'Furigana'], ['romaji', 'Romaji'], ['arti', 'Terjemahan'], ['fokus', 'Fokus']];
function hblRenderOpsi() {
  var h = '';
  HBL_OPSI_DAFTAR.forEach(function (o) {
    h += '<div class="hbl-chip' + (hbl.opsi[o[0]] ? ' on' : '') + '" role="button" onclick="hblToggleOpsi(\'' + o[0] + '\')">' + o[1] + '</div>';
  });
  fbEl('hbl-opsi').innerHTML = h;
}
function hblTerapkanOpsi() {
  var el = fbEl('hbl-list'); if (!el) return;
  var k = 'hbl-list' + (hbl.opsi.furi ? '' : ' no-furi') + (hbl.opsi.romaji ? '' : ' no-romaji') +
          (hbl.opsi.arti ? '' : ' no-arti') + (hbl.opsi.fokus ? ' fokus' : '');
  el.className = k;
}
function hblToggleOpsi(k) {
  if (!(k in hbl.opsi)) return;
  hbl.opsi[k] = !hbl.opsi[k];
  hblSimpanOpsi(); hblRenderOpsi(); hblTerapkanOpsi();
}

/* ---------- pemutar YouTube ---------- */
function hblMuatApiYT(cb) {
  if (window.YT && window.YT.Player) { cb(true); return; }
  hblApiMenunggu.push(cb);
  if (hblApiMemuat) return;
  hblApiMemuat = true;
  var sebelumnya = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    try { if (typeof sebelumnya === 'function') sebelumnya(); } catch (e) {}
    var q = hblApiMenunggu; hblApiMenunggu = [];
    q.forEach(function (f) { try { f(true); } catch (e) {} });
  };
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  s.onerror = function () {
    hblApiMemuat = false;
    var q = hblApiMenunggu; hblApiMenunggu = [];
    q.forEach(function (f) { try { f(false); } catch (e) {} });
  };
  document.head.appendChild(s);
  setTimeout(function () {                      // batas waktu: dianggap gagal
    if (window.YT && window.YT.Player) return;
    hblApiMemuat = false;
    var q = hblApiMenunggu; hblApiMenunggu = [];
    q.forEach(function (f) { try { f(false); } catch (e) {} });
  }, 9000);
}

function hblBuatPlayer(token) {
  fbEl('hbl-yt-wrap').innerHTML = '<div id="hbl-yt"></div>';
  hblMuatApiYT(function (ok) {
    if (token !== hbl.token || !hbl.aktif || hbl.player || hbl.fallback) return;
    if (!ok) { hblFallback(); return; }
    try {
      var vars = { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, cc_load_policy: 0, fs: 1, enablejsapi: 1 };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      hbl.player = new YT.Player('hbl-yt', {
        host: 'https://www.youtube-nocookie.com',
        videoId: hbl.d.yt,
        playerVars: vars,
        events: {
          onReady: function () { if (token === hbl.token) hblPlayerSiap(); },
          onStateChange: function (e) { if (token === hbl.token) hblStatePlayer(e && e.data); },
          onError: function (e) { if (token === hbl.token) hblErrorPlayer(e && e.data); }
        }
      });
      hbl.readyTimer = setTimeout(function () {   // onReady tidak datang: pakai pemutar biasa
        if (token === hbl.token && hbl.aktif && !hbl.siap) hblFallback();
      }, 12000);
    } catch (e) { hblFallback(); }
  });
}

function hblPlayerSiap() {
  if (hbl.readyTimer) { clearTimeout(hbl.readyTimer); hbl.readyTimer = null; }
  hbl.siap = true;
  try { hbl.player.setPlaybackRate(HBL_KECEPATAN[hbl.speedIdx]); } catch (e) {}
  try { hbl.durasi = hbl.player.getDuration() || 0; } catch (e) {}
  hblRenderKontrol();
}

function hblStatePlayer(s) {
  hbl.state = s;
  if (s === 1 || s === 5) {
    try { var dur = hbl.player.getDuration(); if (dur) hbl.durasi = dur; } catch (e) {}
    if (s === 1) { try { hbl.player.setPlaybackRate(HBL_KECEPATAN[hbl.speedIdx]); } catch (e) {} }
  }
  hblRenderKontrol();
}

function hblErrorPlayer(kode) {
  var yt = 'https://www.youtube.com/watch?v=' + encodeURIComponent(hbl.d.yt);
  hblTampilPesan('Video ini tidak bisa diputar di dalam aplikasi' + (kode ? ' (kode ' + kode + ')' : '') +
    '. Pemilik video mungkin membatasi pemutaran. <a href="' + yt + '" target="_blank" rel="noopener">Buka di YouTube ↗</a>');
}

function hblFallback() {
  if (hbl.fallback) return;
  hbl.fallback = true;
  if (hbl.readyTimer) { clearTimeout(hbl.readyTimer); hbl.readyTimer = null; }
  if (hbl.player) { try { hbl.player.destroy(); } catch (e) {} hbl.player = null; }
  hbl.siap = false;
  fbEl('hbl-yt-wrap').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(hbl.d.yt) +
    '?rel=0&playsinline=1" title="Pemutar video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  hblTampilPesan('Sinkronisasi subtitle otomatis tidak tersedia di perangkat ini. Video tetap bisa diputar dan subtitle bisa dibaca manual.');
  hblRenderKontrol();
}

/* ---------- sinkronisasi ---------- */
function hblCariBaris(t) {
  var L = hbl.lines, lo = 0, hi = L.length - 1, r = -1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    if (L[mid].mulai <= t + 0.05) { r = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (r >= 0 && t >= L[r].selesai + 4) return -1;      // jeda panjang (instrumen): tidak ada kalimat aktif
  return r;
}

function hblTick() {
  if (!hbl.aktif || !hbl.siap || !hbl.player) return;
  var t;
  try { t = hbl.player.getCurrentTime(); } catch (e) { return; }
  if (typeof t !== 'number' || isNaN(t)) return;
  if (!hbl.durasi) { try { hbl.durasi = hbl.player.getDuration() || 0; } catch (e) {} }

  if (hbl.loop && hbl.idx >= 0 && hbl.lines[hbl.idx]) {
    var cur = hbl.lines[hbl.idx];
    if (t >= cur.selesai - 0.05 || t < cur.mulai - 0.8) {
      try { hbl.player.seekTo(cur.mulai, true); } catch (e) {}
      return;
    }
  } else if (hbl.lines.length) {
    var i = hblCariBaris(t);
    if (i !== hbl.idx) hblAktifkan(i);
  }
  if (!hbl.seeking) {
    var sk = fbEl('hbl-seek');
    if (hbl.durasi && Number(sk.max) !== Math.floor(hbl.durasi)) sk.max = Math.floor(hbl.durasi);
    sk.value = Math.floor(t);
    fbEl('hbl-t-now').textContent = hblFmt(t);
    fbEl('hbl-t-all').textContent = hblFmt(hbl.durasi);
  }
}

function hblAktifkan(i) {
  var lama = fbEl('hbl-b' + hbl.idx);
  if (lama) lama.classList.remove('aktif');
  hbl.idx = i;
  var baru = i >= 0 ? fbEl('hbl-b' + i) : null;
  if (baru) { baru.classList.add('aktif'); hblGulir(i); }
}

function hblGulir(i) {
  var list = fbEl('hbl-list'), el = fbEl('hbl-b' + i);
  if (!list || !el) return;
  if (Date.now() - hbl.sentuh < 3500) return;          // pengguna sedang menggulir sendiri
  var target = Math.max(0, el.offsetTop - (list.clientHeight - el.offsetHeight) / 2);
  try { list.scrollTo({ top: target, behavior: 'smooth' }); } catch (e) { list.scrollTop = target; }
}

/* ---------- kontrol ---------- */
function hblRenderKontrol() {
  var sinkron = hbl.siap && !hbl.fallback;
  var play = fbEl('hbl-b-play');
  play.innerHTML = (hbl.state === 1) ? '&#9208;' : '&#9654;';
  ['hbl-b-prev', 'hbl-b-next', 'hbl-b-loop', 'hbl-b-play', 'hbl-b-speed'].forEach(function (id) {
    fbEl(id).classList.toggle('mati', !sinkron);
  });
  fbEl('hbl-b-loop').classList.toggle('on', !!hbl.loop);
  fbEl('hbl-b-speed').innerHTML = HBL_KECEPATAN[hbl.speedIdx] + '&times;';
  fbEl('hbl-seek').disabled = !sinkron;
}

function hblSeekKe(t) {
  if (!hbl.player || !hbl.siap) return;
  try { hbl.player.seekTo(Math.max(0, t), true); } catch (e) {}
}
function hblKeBaris(i) {
  var l = hbl.lines[i];
  if (!l || !hbl.siap || hbl.fallback) return;
  hblAktifkan(i);
  hblSeekKe(l.mulai);
  try { hbl.player.playVideo(); } catch (e) {}
}
function hblPlayPause() {
  if (!hbl.siap || !hbl.player) return;
  try { if (hbl.state === 1) hbl.player.pauseVideo(); else hbl.player.playVideo(); } catch (e) {}
}
function hblLompat(arah) {
  if (!hbl.siap || !hbl.lines.length) return;
  var i = hbl.idx;
  if (i < 0) { try { i = hblCariBaris(hbl.player.getCurrentTime()); } catch (e) { i = -1; } }
  var n = arah > 0 ? Math.min(hbl.lines.length - 1, i + 1) : Math.max(0, i - 1);
  hblKeBaris(n);
}
function hblToggleLoop() {
  if (!hbl.siap) return;
  if (!hbl.loop && hbl.idx < 0) {
    if (typeof questToast === 'function') questToast('Putar dulu sampai muncul kalimat, lalu aktifkan ulang');
    return;
  }
  hbl.loop = !hbl.loop;
  hblRenderKontrol();
}
function hblGantiKecepatan() {
  if (!hbl.siap) return;
  hbl.speedIdx = (hbl.speedIdx + 1) % HBL_KECEPATAN.length;
  try { hbl.player.setPlaybackRate(HBL_KECEPATAN[hbl.speedIdx]); } catch (e) {}
  hblSimpanOpsi(); hblRenderKontrol();
}
function hblSeekInput(v) {
  hbl.seeking = true;
  fbEl('hbl-t-now').textContent = hblFmt(v);
}
function hblSeekSelesai(v) {
  hbl.loop = false;
  hblSeekKe(Number(v));
  hbl.seeking = false;
  hblRenderKontrol();
}

/* ---------- Tanya AI ---------- */
function hblAiBuka(i) {
  var l = hbl.lines[i];
  if (!l) return;
  try { if (hbl.player && hbl.state === 1) hbl.player.pauseVideo(); } catch (e) {}
  hbl.aiIdx = i;
  fbEl('hbl-ai-kalimat').textContent = l.jp + (l.arti ? '\n' + l.arti : '');
  fbEl('hbl-ai-tanya').value = '';
  fbEl('hbl-ai').classList.remove('hidden');
  hblAiPanggil('');
}
function hblAiTutup() {
  hbl.aiToken++;
  var el = fbEl('hbl-ai'); if (el) el.classList.add('hidden');
}
function hblAiKirim() {
  var t = fbEl('hbl-ai-tanya').value.trim();
  hblAiPanggil(t);
}
function hblAiPanggil(tanya) {
  var l = hbl.lines[hbl.aiIdx];
  if (!l) return;
  var token = ++hbl.aiToken;
  var isi = fbEl('hbl-ai-isi'), btn = fbEl('hbl-ai-kirim');
  isi.innerHTML = '<div class="hbl-ai-load">Sensei AI sedang menyusun penjelasan…</div>';
  btn.classList.add('mati');
  google.script.run
    .withSuccessHandler(function (r) {
      if (token !== hbl.aiToken) return;
      btn.classList.remove('mati');
      isi.innerHTML = hblFormatAi(r && r.teks);
      isi.scrollTop = 0;
    })
    .withFailureHandler(function (err) {
      if (token !== hbl.aiToken) return;
      btn.classList.remove('mati');
      var pesan = (err && err.message) ? String(err.message).replace(/^Error:\s*/, '') : 'Terjadi kesalahan. Coba lagi.';
      isi.innerHTML = '<div class="hbl-ai-err">' + hbEsc(pesan) + '</div>';
    })
    .tanyaAI(studentName, l.jp, l.arti || '', (hbl.d && hbl.d.judul) || '', tanya || '');
}
function hblFormatAi(teks) {
  teks = String(teks || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  var out = '';
  teks.split(/\r?\n/).forEach(function (ln) {
    ln = ln.trim();
    if (!ln) return;
    if (/^(Terjemahan|Kosakata|Tata Bahasa|Catatan|Jawaban)\s*:?$/i.test(ln)) {
      out += '<div class="hbl-ai-h">' + hbEsc(ln.replace(/:\s*$/, '')) + '</div>';
    } else {
      out += '<div class="hbl-ai-p">' + hbEsc(ln.replace(/^[-*]\s+/, '• ')) + '</div>';
    }
  });
  return out || '<div class="hbl-ai-err">Jawaban kosong. Coba lagi.</div>';
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || !hbl.aktif) return;
  if (!fbEl('hbl-ai').classList.contains('hidden')) hblAiTutup(); else hblTutup();
});
