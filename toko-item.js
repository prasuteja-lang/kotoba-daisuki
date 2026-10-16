/* =====================================================================
   DAFTAR ITEM TOKO  —  satu-satunya file yang perlu diedit untuk menambah item
   =====================================================================
   CARA MENAMBAH ITEM
   1. Salin satu baris contoh dari bagian "CONTOH" di bawah.
   2. Tempel di dalam daftar TOKO_ITEM (sebelum tanda ]), lalu ubah isinya.
   3. Simpan, unggah file ini (beserta gambar/musiknya) ke GitHub, naikkan nomor di version.json.
   Aturan: tiap item diakhiri koma, id tidak boleh sama dengan item lain, teks ditulis di dalam tanda kutip ' '.
   Item yang salah ketik dilewati otomatis (aplikasi tidak rusak). Akun admin melihat peringatannya di atas halaman Toko.

   KOLOM UNTUK SEMUA JENIS
     id     nama unik tanpa spasi, huruf/angka/-/_ , diawali huruf   (mis. 'bk-naga')
     jenis  'bingkai' | 'gelar' | 'tema' | 'musik'
     nama   nama yang tampil di Toko
     ico    emoji untuk ikon
     ket    keterangan singkat
     harga  harga dalam koin (10 XP = 1 koin). Boleh 0 = gratis.

   KOLOM TAMBAHAN PER JENIS
     bingkai (gambar)  gambar: 'bingkai-naga.png'   PNG transparan, lubang bundar di tengah, satu folder dengan index.html
                       skala:  38                   (opsional) seberapa jauh bingkai keluar dari foto, dalam %. Makin besar = makin lebar
     bingkai (CSS)     tanpa 'gambar'; gayanya ditulis sendiri di index.html sebagai html .mm-avatar.ID { ... } (lihat bk-sakura)
     gelar             gambar: 'icon-scholar.png'   (opsional) ikon gambar PNG, satu folder dengan index.html; tanpa 'gambar' dipakai emoji 'ico'
     tema              latar: 'linear-gradient(135deg,#fbcfe8,#ddd6fe)'   (opsional) latar halaman; bisa juga "url(tema/sakura.jpg) center/cover"
                       atau tanpa 'latar' dan tulis gaya sendiri di index.html sebagai html.ID { ... }  (ID = id item)
     musik             url: 'musik/sakura.mp3'      alamat file mp3 (satu folder dengan index.html atau alamat penuh https://...)

   CONTOH (hapus tanda // di depan lalu ubah isinya)
   // { id: 'bk-ungu',    jenis: 'bingkai', nama: 'Bingkai Ungu',  ico: '💜', ket: 'Bingkai gambar sendiri', harga: 500, gambar: 'bingkai-ungu.png', skala: 35 },
   // { id: 'gl-sensei',   jenis: 'gelar',   nama: 'Murid Teladan', ico: '🎓', ket: 'Gelar spesial',          harga: 150 },
   // { id: 'tm-sakura',   jenis: 'tema',    nama: 'Tema Sakura',   ico: '🌸', ket: 'Latar merah muda',       harga: 400, latar: 'linear-gradient(135deg,#fbcfe8,#ddd6fe)' },
   // { id: 'ms-festival', jenis: 'musik',   nama: 'Musik Festival',ico: '🎶', ket: 'Musik latar bernuansa matsuri', harga: 600, url: 'musik/festival.mp3' },
   ===================================================================== */
var TOKO_ITEM = [
  // ---------- BINGKAI ----------
  { id: 'bk-sakura',        jenis: 'bingkai', nama: 'Bingkai Sakura',        ico: '🌸', ket: 'Bingkai merah muda lembut',               harga: 50 },
  { id: 'bk-hiraganahero',  jenis: 'bingkai', nama: 'Bingkai Hiragana Hero', ico: '', ket: 'Kucing berikat kepala di bingkai sakura', harga: 500,  gambar: 'bingkai-hiraganahero.png',  skala: 30 },
  { id: 'bk-scholar',       jenis: 'bingkai', nama: 'Bingkai Scholar',       ico: '', ket: 'Beruang cendekia di bingkai bintang',     harga: 500, gambar: 'bingkai-scholar.png',       skala: 30 },
  { id: 'bk-seitolegend',   jenis: 'bingkai', nama: 'Bingkai Seito Legend',  ico: '', ket: 'Shiba legendaris di bingkai emas',        harga: 1000, gambar: 'bingkai-seitolegend.png',   skala: 30 },
  { id: 'bk-kotobacolector',jenis: 'bingkai', nama: 'Bingkai Kotoba Collector', ico: '', ket: 'Kelinci manis di bingkai ungu berbintang', harga: 1000, gambar: 'bingkai-kotobacolector.png', skala: 30 },
  { id: 'bk-naga',          jenis: 'bingkai', nama: 'Bingkai Naga',          ico: '', ket: 'Bingkai langka bergambar naga emas',      harga: 3000, gambar: 'bingkai-naga.png',  skala: 30 },
  { id: 'bk-kawai',         jenis: 'bingkai', nama: 'Bingkai Kawai',         ico: '', ket: 'Bingkai gambar bertema kawai',            harga: 3000, gambar: 'bingkai-kawai.png', skala: 38 },

  // ---------- GELAR ----------
  { id: 'gl-hiraganahero',  jenis: 'gelar',   nama: 'Hiragana Hero',      ico: '', ket: 'Pahlawan hiragana',                  harga: 300,  gambar: 'icon-hiraganahero.png' },
  { id: 'gl-kotobacolector',jenis: 'gelar',   nama: 'Kotoba Collector',   ico: '', ket: 'Kolektor kosakata sejati',           harga: 400,  gambar: 'icon-kotobacolector.png' },
  { id: 'gl-bunpoumaster',  jenis: 'gelar',   nama: 'Bunpou Master',      ico: '', ket: 'Penguasa tata bahasa',               harga: 800,  gambar: 'icon-bunpoumaster.png' },
  { id: 'gl-chiennokishi',  jenis: 'gelar',   nama: 'Chie no Kishi',      ico: '', ket: 'Ksatria kebijaksanaan',              harga: 2000, gambar: 'icon-chiennokishi.png' }

  // ---------- TEMA ----------
  // (belum ada — lihat CONTOH di atas)

  // ---------- MUSIK ----------
  // (belum ada — lihat CONTOH di atas)
];

/* =====================================================================
   TAMBAHAN OTOMATIS (JANGAN DIHAPUS) — memperbaiki tanpa mengubah kotoba-app.js
   1) Koin/belanja tidak lagi ke-reset saat ganti perangkat: pengiriman data ke server
      ditahan sampai data dari server sudah digabung.
   2) Papan Peringkat menampilkan foto profil (dan bingkai) tiap pelajar.
   Kode ini menunggu kotoba-app.js selesai dimuat, lalu membungkus fungsi yang sudah ada.
   ===================================================================== */
(function () {
  var coba = 0;
  function pasang() {
    if (typeof pencapaianKeServer !== 'function' || typeof gabungPencapaian !== 'function' || typeof renderPeringkat !== 'function') {
      if (coba++ < 150) setTimeout(pasang, 100);
      return;
    }
    if (window.__kotobaTambahan) return;
    window.__kotobaTambahan = true;

    /* ---- 1) tahan pengiriman sebelum data server digabung ---- */
    var siap = {}, mulai = {};
    var kirimAsli = pencapaianKeServer;
    pencapaianKeServer = function () {
      if (!studentName) return;
      if (!siap[studentName]) {
        if (!mulai[studentName]) mulai[studentName] = Date.now();
        if (Date.now() - mulai[studentName] < 45000) return;   // server tak merespons >45 dtk: kirim saja (server menggabungkan, aman)
      }
      return kirimAsli.apply(this, arguments);
    };
    var gabungAsli = gabungPencapaian;
    gabungPencapaian = function () {
      if (studentName) siap[studentName] = true;
      return gabungAsli.apply(this, arguments);
    };

    /* ---- 2) foto profil di Papan Peringkat ---- */
    var av = {};   // namaHurufKecil -> { a: idAvatar, b: idBingkai }
    function foto(el, r) {
      var k = String(r.nama).toLowerCase(), m = av[k] || {};
      var aku = String(studentName || '').toLowerCase() === k;
      var id = aku ? ((typeof avatarId !== 'undefined' && avatarId) || r.avatar || m.a || '') : (r.avatar || m.a || '');
      var bk = m.b || '';
      if (aku && typeof achState !== 'undefined' && achState && achState.pakai && achState.pakai.bingkai && achState.beli && achState.beli[achState.pakai.bingkai] != null) bk = achState.pakai.bingkai;
      if (/^[A-Za-z][A-Za-z0-9_\-]*$/.test(bk)) el.classList.add(bk);
      if (!id || typeof urlAvatar !== 'function') return;
      el.textContent = '';
      var im = document.createElement('img');
      im.alt = ''; im.loading = 'lazy';
      im.onerror = function () { el.textContent = '😺'; };
      im.src = urlAvatar(id, 100);
      el.appendChild(im);
    }
    function hias() {
      var pane = document.getElementById('pg-pane-peringkat');
      if (!pane || typeof lbState === 'undefined' || !lbState || !lbState.data) return;
      var top = lbState.data.top || [], rows = pane.querySelectorAll('.lb-row'), perlu = [];
      for (var i = 0; i < top.length && i < rows.length; i++) {
        var r = top[i], k = String(r.nama).toLowerCase(), el = rows[i].querySelector('.lb-av');
        if (!el) {
          el = document.createElement('div'); el.className = 'lb-av'; el.textContent = '😺';
          var rank = rows[i].querySelector('.lb-rank');
          if (rank) rank.insertAdjacentElement('afterend', el); else rows[i].insertBefore(el, rows[i].firstChild);
        }
        foto(el, r);
        if (!av[k]) { av[k] = {}; perlu.push(r.nama); }
      }
      if (!perlu.length) return;
      try {
        google.script.run
          .withSuccessHandler(function (m) {
            Object.keys(m || {}).forEach(function (n) { av[n] = m[n]; });
            renderPeringkat();
          })
          .withFailureHandler(function () { perlu.forEach(function (n) { delete av[String(n).toLowerCase()]; }); })
          .getAvatarPeringkat(perlu);
      } catch (e) {}
    }
    var rAsli = renderPeringkat;
    renderPeringkat = function () {
      var hasil = rAsli.apply(this, arguments);
      try { hias(); } catch (e) {}
      return hasil;
    };

    /* ---- 3) ukuran foto + bingkai bergambar di Menu Utama ----
       UKURAN_MENU_UTAMA: 1 = ukuran asli, 0.8 = 80%, 0.7 = 70% (ubah angka ini untuk memperbesar/memperkecil).
       Hanya berlaku di Menu Utama; tab Profil dan Toko tidak berubah. */
    var UKURAN_MENU_UTAMA = 0.78;
    try {
      var z = UKURAN_MENU_UTAMA, css = '';
      (typeof TOKO_ITEM !== 'undefined' ? TOKO_ITEM : []).forEach(function (it) {
        if (it.jenis !== 'bingkai' || !it.gambar || !/^[A-Za-z][A-Za-z0-9_\-]*$/.test(it.id)) return;
        var sk = Number(it.skala) > 0 ? Number(it.skala) : 38;
        var keluar = 58 * sk / 100;                       // bagian bingkai yang keluar dari foto (px, ukuran asli)
        var m = Math.round((keluar + 10 / z) * 10) / 10;  // jarak kiri: bingkai tidak terpotong tepi layar (+10px lega)
        var s2 = Math.round((keluar * z + 2) * 10) / 10;  // jarak teks sapaan dari foto
        css += 'html .mm-head .mm-avatar.' + it.id + ' { zoom:' + z + '; margin-left:' + m + 'px !important; }' +
               'html .mm-head:has(.mm-avatar.' + it.id + ') .mm-sapa { margin-left:' + s2 + 'px; }';
      });
      if (css) {
        var st = document.createElement('style'); st.id = 'ukuran-menu-utama'; st.textContent = css;
        document.head.appendChild(st);
      }
    } catch (e) {}
  }
  pasang();
})();
