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
                       Ukuran & posisi bingkai OTOMATIS mengikuti foto profil: lubang bundar di PNG diukur sendiri oleh aplikasi.
                       skala / x / y   (opsional) HANYA cadangan bila PNG tidak bisa diukur. Tidak perlu diisi.
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
  { id: 'bk-hiraganahero',  jenis: 'bingkai', nama: 'Bingkai Hiragana Hero', ico: '', ket: 'Kucing berikat kepala di bingkai sakura', harga: 500,  gambar: 'bingkai-hiraganahero.png',  skala: 35 },
  { id: 'bk-scholar',       jenis: 'bingkai', nama: 'Bingkai Scholar',       ico: '', ket: 'Beruang cendekia di bingkai bintang',     harga: 750, gambar: 'bingkai-scholar.png',       skala: 35 },
  { id: 'bk-seitolegend',   jenis: 'bingkai', nama: 'Bingkai Seito Legend',  ico: '', ket: 'Shiba legendaris di bingkai emas',        harga: 900, gambar: 'bingkai-seitolegend.png',   skala: 35 },
  { id: 'bk-kotobacolector',jenis: 'bingkai', nama: 'Bingkai Kotoba Collector', ico: '', ket: 'Kelinci manis di bingkai ungu berbintang', harga: 1500, gambar: 'bingkai-kotobacolector.png', skala: 35 },
  { id: 'bk-naga',          jenis: 'bingkai', nama: 'Bingkai Naga',          ico: '', ket: 'Bingkai langka bergambar naga emas',      harga: 3000, gambar: 'bingkai-naga.png',  skala: 35 },
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
