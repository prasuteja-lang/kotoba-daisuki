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
     jenis  'bingkai' | 'gelar' | 'tema' | 'kartu' | 'musik'
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
     kartu             gambar: 'kartu-temahutan.jpg'   latar kartu di tab Profil; gambar ideal 800 x 1200 px (rasio 2:3), satu folder dengan index.html
                       ATAU latar: 'linear-gradient(135deg,#fbcfe8,#f9a8d4)'   (pakai salah satu saja)
                       gelap: true   (opsional) isi bila gambar/gradasinya gelap, supaya nama di kartu berwarna putih
     musik             url: 'musik/sakura.mp3'      alamat file mp3 (satu folder dengan index.html atau alamat penuh https://...)

   CONTOH (hapus tanda // di depan lalu ubah isinya)
   // { id: 'bk-ungu',    jenis: 'bingkai', nama: 'Bingkai Ungu',  ico: '💜', ket: 'Bingkai gambar sendiri', harga: 500, gambar: 'bingkai-ungu.png', skala: 35 },
   // { id: 'gl-sensei',   jenis: 'gelar',   nama: 'Murid Teladan', ico: '🎓', ket: 'Gelar spesial',          harga: 150 },
   // { id: 'tm-sakura',   jenis: 'tema',    nama: 'Tema Sakura',   ico: '🌸', ket: 'Latar merah muda',       harga: 400, latar: 'linear-gradient(135deg,#fbcfe8,#ddd6fe)' },
   // { id: 'kt-sakura',    jenis: 'kartu',   nama: 'Kartu Sakura',  ico: '🌸', ket: 'Latar kartu profil',       harga: 2000, gambar: 'kartu-temasakura.jpg' },
   // { id: 'ms-festival', jenis: 'musik',   nama: 'Musik Festival',ico: '🎶', ket: 'Musik latar bernuansa matsuri', harga: 600, url: 'musik/festival.mp3' },
   ===================================================================== */
var TOKO_ITEM = [
  // ---------- BINGKAI ----------
  { id: 'bk-sakura',        jenis: 'bingkai', nama: 'Sakura',        ico: '🌸', ket: 'Bingkai merah muda lembut',               harga: 50 },
  { id: 'bk-hiraganahero',  jenis: 'bingkai', nama: 'Hiragana Hero', ico: '', ket: 'Kucing berikat kepala di bingkai sakura', harga: 150,  gambar: 'bingkai-hiraganahero.png',  skala: 35 },
  { id: 'bk-scholar',       jenis: 'bingkai', nama: 'Scholar',       ico: '', ket: 'Beruang cendekia di bingkai bintang',     harga: 150, gambar: 'bingkai-scholar.png',       skala: 35 },
  { id: 'bk-seitolegend',   jenis: 'bingkai', nama: 'Seito Legend',  ico: '', ket: 'Shiba legendaris di bingkai emas',        harga: 250, gambar: 'bingkai-seitolegend.png',   skala: 35 },
  { id: 'bk-kotobacolector',jenis: 'bingkai', nama: 'Kotoba Collector', ico: '', ket: 'Kelinci manis di bingkai ungu berbintang', harga: 250, gambar: 'bingkai-kotobacolector.png', skala: 35 },
  { id: 'bk-naga',          jenis: 'bingkai', nama: 'Naga Emas',          ico: '', ket: 'Bingkai langka bergambar naga emas',      harga: 1000, gambar: 'bingkai-naga.png',  skala: 33 },
  { id: 'bk-kawai',         jenis: 'bingkai', nama: 'Kawai',         ico: '', ket: 'Bingkai gambar bertema kawai',            harga: 1000, gambar: 'bingkai-kawai.png', skala: 38 },
  { id: 'bk-sparklingneko', jenis: 'bingkai', nama: 'Sparkling Neko', ico: '', ket: 'Bingkai animasi neko, sakura, dan torii', harga: 1500, gambar: 'bingkai-spraklingneko.gif', skala: 35 },

  // ---------- GELAR ----------
  { id: 'gl-hiraganahero',  jenis: 'gelar',   nama: 'Hiragana Hero',      ico: '', ket: 'Pahlawan hiragana',                  harga: 200,  gambar: 'icon-hiraganahero.png' },
  { id: 'gl-kotobacolector',jenis: 'gelar',   nama: 'Kotoba Collector',   ico: '', ket: 'Kolektor kosakata sejati',           harga: 200,  gambar: 'icon-kotobacolector.png' },
  { id: 'gl-bunpoumaster',  jenis: 'gelar',   nama: 'Bunpou Master',      ico: '', ket: 'Penguasa tata bahasa',               harga: 300,  gambar: 'icon-bunpoumaster.png' },
  { id: 'gl-chiennokishi',  jenis: 'gelar',   nama: 'Chie no Kishi',      ico: '', ket: 'Ksatria kebijaksanaan',              harga: 500, gambar: 'icon-chiennokishi.png' },

  //  // ---------- TEMA KARTU PROFIL ----------
  { id: 'kt-futuristik', jenis: 'kartu', nama: 'Kota Futuristik', ico: '', ket: 'Latar kartu profil kota masa depan',  harga: 1000, gambar: 'kartu-temafuturistik.gif',  gelap: true },
  { id: 'kt-hutan',      jenis: 'kartu', nama: 'Hutan & Air Terjun', ico: '', ket: 'Latar kartu profil hutan asri',    harga: 1500, gambar: 'kartu-temahutan.gif',     gelap: true },
  { id: 'kt-samurai',    jenis: 'kartu', nama: 'Samurai Senja',   ico: '', ket: 'Latar kartu profil samurai di torii', harga: 1500, gambar: 'kartu-temasamurai.gif',   gelap: true },
  { id: 'kt-shinto',     jenis: 'kartu', nama: 'Kuil Shinto',     ico: '', ket: 'Latar kartu profil kuil di hutan',    harga: 1500, gambar: 'kartu-temashinto.gif',    gelap: true },
  
   // ---------- TEMA ----------
  // (belum ada — lihat CONTOH di atas)

  // ---------- MUSIK ----------
  { id: 'ms-yuuyake', jenis: 'musik',   nama: '夕焼けプレイリスト',ico: '🎶', ket: 'Musik latar nuansa melodi sore', harga: 500, url: '夕焼けプレイリスト.mp3' },
];
