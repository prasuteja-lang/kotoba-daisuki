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
var APP_VERSI = "Versi 2.4.3";
var APP_UPDATE_INTRO = "Sekarang ada Update terbaru, silakan dicek ya minna-san :";
var APP_UPDATE_LIST = [
  'Menu Kanji: Saat HP dimiringkan, aplikasi tidak lagi keluar sendiri ke halaman utama. Kalau lagi seru main Kanji Challenge lalu layar tidak sengaja berputar, kalian otomatis kembali ke room dan permainan yang sedang berjalan.',
  'Menu Kanji: Kanji Challenge kini tidak mengulang kotoba yang sudah terjawab, jadi tiap kotoba hanya bisa dijawab satu kali.',
  'Menu Kanji: Kartu di tangan tidak lagi kembar, dan Random Kanji selalu punya pasangan di kartu kalian supaya poin lebih mudah didapat.',
  'Menu Kanji: Memilih kartu yang salah kini mengurangi 1 poin, jadi pikirkan dulu sebelum menekan kartu ya.'
];

var APP_UPDATE_OUTRO = "Pastikan Versi-nya sesuai Update terbaru ya minna-san, jika belum silakan untuk refresh kembali. Arigatou ne 🙏";

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

// Ikon & warna otomatis dari awalan "Menu Xxx:" pada teks update
function infoUpdateItem(teks) {
  var m = teks.match(/^\s*Menu\s+([A-Za-z]+)\s*:\s*([\s\S]*)$/i);
  var map = {
    kanji:  { ico: '🈴', kls: 'upd-u-kanji' },
    bunpou: { ico: '📗', kls: 'upd-u-bunpou' },
    kotoba: { ico: '📘', kls: 'upd-u-kotoba' }
  };
  if (m) {
    var key = m[1].toLowerCase();
    var info = map[key] || { ico: '✨', kls: 'upd-u-umum' };
    return { tag: m[1], isi: m[2], ico: info.ico, kls: info.kls };
  }
  return { tag: 'Info', isi: teks, ico: '✨', kls: 'upd-u-umum' };
}

function tampilkanUpdateTerbaru() {
  var ver = document.getElementById('mm-versi');
  if (ver) ver.textContent = APP_VERSI;
  document.getElementById('upd-ver').textContent = APP_VERSI;
  document.getElementById('upd-intro').textContent = APP_UPDATE_INTRO;
  document.getElementById('upd-outro').textContent = APP_UPDATE_OUTRO;
  var ol = document.getElementById('upd-list');
  ol.innerHTML = '';
  APP_UPDATE_LIST.forEach(function(teks) {
    var d = infoUpdateItem(teks);
    var li = document.createElement('li');
    li.className = d.kls;

    var ico = document.createElement('div');
    ico.className = 'upd-ico';
    ico.textContent = d.ico;

    var box = document.createElement('div');
    box.className = 'upd-txt';
    var tag = document.createElement('span');
    tag.className = 'upd-tag';
    tag.textContent = d.tag;
    var desc = document.createElement('div');
    desc.className = 'upd-desc';
    desc.textContent = d.isi;
    box.appendChild(tag);
    box.appendChild(desc);

    li.appendChild(ico);
    li.appendChild(box);
    ol.appendChild(li);
  });
  terapkanTema(temaSaatIni());
  document.getElementById('update-modal').classList.remove('modal-hidden');
}
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