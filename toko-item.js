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
     gelar             tidak ada kolom tambahan
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
  { id: 'bk-sakura',  jenis: 'bingkai', nama: 'Bingkai Sakura',  ico: '🌸', ket: 'Bingkai merah muda lembut',          harga: 50 },
  { id: 'bk-emas',    jenis: 'bingkai', nama: 'Bingkai Emas',    ico: '🟡', ket: 'Bingkai emas berkilau',              harga: 100 },
  { id: 'bk-api',     jenis: 'bingkai', nama: 'Bingkai Api',     ico: '🔥', ket: 'Bingkai oranye membara',             harga: 150 },
  { id: 'bk-pelangi', jenis: 'bingkai', nama: 'Bingkai Pelangi', ico: '🌈', ket: 'Bingkai warna-warni animasi',        harga: 250 },
  { id: 'bk-naga',    jenis: 'bingkai', nama: 'Bingkai Naga',    ico: '🐉', ket: 'Bingkai langka bergambar naga emas', harga: 3000, gambar: 'bingkai-naga.png', skala: 38 },

  // ---------- GELAR ----------
  { id: 'gl-pemula',  jenis: 'gelar',   nama: 'Pelajar Rajin',   ico: '📘', ket: 'Gelar untuk pelajar tekun',          harga: 40 },
  { id: 'gl-samurai', jenis: 'gelar',   nama: 'Samurai Kotoba',  ico: '⚔️', ket: 'Gelar penakluk kosakata',            harga: 120 },
  { id: 'gl-ninja',   jenis: 'gelar',   nama: 'Ninja Kanji',     ico: '🥷', ket: 'Gelar penguasa kanji',               harga: 200 }

  // ---------- TEMA ----------
  // (belum ada — lihat CONTOH di atas)

  // ---------- MUSIK ----------
  // (belum ada — lihat CONTOH di atas)
];
