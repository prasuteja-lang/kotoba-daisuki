var kanjiMenuData = [];
  var kanjiCurrentList = [];
  var kanjiCurrentIndex = 0;
  var kanjiCurrentLevel = "";
  var kanjiShowingBack = false;

  function bukaKanjiDariMain() {
    document.getElementById('main-menu-page').classList.add('hidden');
    document.getElementById('kanji-main-page').classList.remove('hidden');

    if (kanjiMenuData.length > 0) {
      renderKanjiMenu(kanjiMenuData);
      return;
    }

    var container = document.getElementById('kanji-level-container');
    container.innerHTML = '<div class="kanji-loading">Memuat data kanji...</div>';

    google.script.run
      .withSuccessHandler(function(data) {
        kanjiMenuData = data || [];
        renderKanjiMenu(kanjiMenuData);
      })
      .withFailureHandler(function(err) {
        container.innerHTML = '<div class="kanji-empty">Gagal memuat data: ' + err.message + '</div>';
      })
      .getKanjiMenu();
  }

  function renderKanjiMenu(data) {
    var container = document.getElementById('kanji-level-container');

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="kanji-empty">Belum ada data kanji. Tambahkan sheet "kanji" di Spreadsheet.</div>';
      return;
    }

    var html = "";
    data.forEach(function(levelItem) {
      html += '<div class="kanji-level-header" onclick="bukaKanjiLevel(\'' + escapeJs(levelItem.level) + '\')">';
      html += '  <span>🎖️ TINGKAT ' + escapeHtml(levelItem.level) + '</span>';
      html += '  <span class="kk-arrow">›</span>';
      html += '</div>';
    });

    container.innerHTML = html;
  }

  /* ==================== GAME: KANJI DAISUKI ==================== */
  var kdKanjiPool = [];
  var kdKotobaSet = {};
  var kdPairsByLevel = {};
  var kdBoard = [];
  var kdChain = [];
  var kdScore = 0;
  var kdBoardSize = 15;
  var kdDataLoaded = false;
  var kdLevelPilihan = 'N5';        // level yang sedang aktif dimainkan
  var kdChallengeDitawarkan = false; // supaya popup 250 cuma muncul sekali per sesi main

  function bukaKanjiDaisuki() {
    catatAktivitas('Kanji daisuki Games');
    document.getElementById('kanji-main-page').classList.add('hidden');
    document.getElementById('kanji-daisuki-page').classList.remove('hidden');
    document.getElementById('kd-challenge-overlay').classList.add('hidden');
    kdMuatSkorTertinggi();

    if (kdDataLoaded) {
      kdMulaiGame();
      return;
    }

    var boardEl = document.getElementById('kd-board');
    boardEl.innerHTML = '<div class="kanji-loading">Memuat game...</div>';

    google.script.run
      .withSuccessHandler(function(data) {
        kdKanjiPool = (data && data.kanjiPool) || [];
        kdPairsByLevel = (data && data.pairsByLevel) || {};
        kdKotobaSet = {};
        ((data && data.kotobaSet) || []).forEach(function(w) { kdKotobaSet[w] = true; });
        kdDataLoaded = true;
        kdMulaiGame();
      })
      .withFailureHandler(function(err) {
        boardEl.innerHTML = '<div class="kanji-empty">Gagal memuat data: ' + err.message + '</div>';
      })
      .getKanjiDaisukiData();
  }

  // Ambil kanji acak dari daftar karakter TERTENTU (mis. karakter milik level
  // yang sedang aktif saja). Kalau daftarnya kosong, baru jatuh ke kdKanjiPool
  // global sebagai jalan terakhir supaya papan tidak pernah benar-benar kosong.
  function kdAmbilKanjiAcak(daftarKarakter) {
    var sumber = (daftarKarakter && daftarKarakter.length) ? daftarKarakter : kdKanjiPool;
    if (!sumber.length) return '？';
    return sumber[Math.floor(Math.random() * sumber.length)];
  }

  // Kumpulkan karakter unik yang muncul di sekumpulan kotoba (dipakai untuk
  // membatasi kanji decoy/pengisi supaya tetap satu level dengan papan).
  function kdKarakterDariKataList(daftarKata) {
    var set = {};
    (daftarKata || []).forEach(function(k) {
      if (!k) return;
      for (var i = 0; i < k.length; i++) set[k.charAt(i)] = true;
    });
    return Object.keys(set);
  }

  function kdAcakArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // Level kanji sekarang mengikuti pilihan pemain sendiri (lewat popup
  // tantangan di skor 250), bukan otomatis berdasarkan skor lagi.
  function kdLevelAktifBerdasarkanSkor() {
    return kdLevelPilihan;
  }

  // Membuat sejumlah "jumlahSlot" kanji, terdiri dari pasangan-pasangan 2-kanji
  // yang valid sebanyak mungkin, SEMUANYA murni dari level yang sedang aktif
  // (kdLevelPilihan) -- tidak ada lagi campuran dari level lain sama sekali,
  // termasuk untuk kanji tunggal/decoy pengisi sisa ganjil.
  function kdBuatSetKanjiBerpasangan(jumlahSlot) {
    var jumlahPasang = Math.floor(jumlahSlot / 2);
    var sisaGanjil = jumlahSlot % 2;

    var levelAktif = kdLevelAktifBerdasarkanSkor();
    var poolUtama = (kdPairsByLevel[levelAktif] || []).slice();
    var karakterLevelIni = kdKarakterDariKataList(poolUtama);

    var pool = kdAcakArray(poolUtama);
    var used = {};
    var hasil = [];
    var pasanganTerpakai = 0;

    // Tahap 1: ambil pasangan kata valid TANPA mengulang huruf kanji yang
    // sama, supaya papan lebih bervariasi.
    for (var p = 0; p < pool.length && pasanganTerpakai < jumlahPasang; p++) {
      var kata = pool[p];
      if (!kata || kata.length !== 2) continue;
      var a = kata.charAt(0), b = kata.charAt(1);
      if (a === b || used[a] || used[b]) continue;
      used[a] = true; used[b] = true;
      hasil.push(a, b);
      pasanganTerpakai++;
    }

    // Tahap 2: kalau variasi kata tanpa pengulangan sudah habis tapi jumlah
    // pasangan (mis. 7) belum tercapai, longgarkan aturan huruf-tidak-boleh-
    // berulang - lebih baik ada kata yang tampil >1 kali di papan daripada
    // ada kanji "yatim" yang sengaja tidak berpasangan padahal seharusnya
    // punya pasangan.
    var percobaan = 0;
    while (pasanganTerpakai < jumlahPasang && pool.length > 0 && percobaan < 300) {
      var kata2 = pool[Math.floor(Math.random() * pool.length)];
      if (kata2 && kata2.length === 2 && kata2.charAt(0) !== kata2.charAt(1)) {
        hasil.push(kata2.charAt(0), kata2.charAt(1));
        pasanganTerpakai++;
      }
      percobaan++;
    }

    // Tahap 3 (jarang terjadi, kalau data kata level ini benar-benar kosong):
    // baru jatuh ke kanji acak, tetap dibatasi ke karakter level yang sama.
    while (hasil.length < jumlahPasang * 2) {
      hasil.push(kdAmbilKanjiAcak(karakterLevelIni));
    }

    if (sisaGanjil === 1) {
      var decoy = null;
      for (var t = 0; t < 30; t++) {
        var kandidat = kdAmbilKanjiAcak(karakterLevelIni);
        if (!used[kandidat]) { decoy = kandidat; break; }
      }
      hasil.push(decoy || kdAmbilKanjiAcak(karakterLevelIni));
    }

    return kdAcakArray(hasil);
  }

  function kdMulaiGame() {
    kdScore = 0;
    kdChain = [];
    kdLevelPilihan = 'N5';
    kdChallengeDitawarkan = false;
    document.getElementById('kd-challenge-overlay').classList.add('hidden');
    kdBoard = kdBuatSetKanjiBerpasangan(kdBoardSize);

    kdRenderBoard();
    kdUpdateSkor();
    kdUpdateChainPreview();
  }

  // ===== Skor tertinggi (disimpan per siswa di sheet users, kolom I) =====
  var kdSkorTertinggi = 0;

  function kdTampilkanSkorTertinggi() {
    var el = document.getElementById('kd-skor-tertinggi');
    if (el) el.innerText = kdSkorTertinggi;
  }

  function kdMuatSkorTertinggi() {
    try {
      kdSkorTertinggi = 0;
      kdTampilkanSkorTertinggi();
      if (!studentName) return;
      google.script.run
        .withSuccessHandler(function(v) {
          v = Number(v) || 0;
          if (v > kdSkorTertinggi) kdSkorTertinggi = v;
          kdTampilkanSkorTertinggi();
        })
        .withFailureHandler(function() {})
        .getSkorTertinggi(studentName);
    } catch (e) {
      // gagal memuat rekor tidak boleh menghentikan game
    }
  }

  function kdSimpanSkorTertinggi() {
    try {
      if (!studentName) return;
      google.script.run
        .withFailureHandler(function() {})
        .simpanSkorTertinggi(studentName, kdSkorTertinggi);
    } catch (e) {
      // gagal menyimpan rekor tidak boleh menghentikan game
    }
  }

  function kdUpdateSkor() {
    document.getElementById('kd-skor').innerText = kdScore;
    if (kdScore > kdSkorTertinggi) {   // rekor baru -> tampilkan & simpan
      kdSkorTertinggi = kdScore;
      kdTampilkanSkorTertinggi();
      kdSimpanSkorTertinggi();
    }
  }

  function kdRenderBoard() {
    var boardEl = document.getElementById('kd-board');
    var html = '';
    for (var i = 0; i < kdBoard.length; i++) {
      if (kdBoard[i]) {
        html += '<div class="kd-tile" id="kd-tile-' + i + '" onclick="kdKlikTile(' + i + ')">' + escapeHtml(kdBoard[i]) + '</div>';
      } else {
        html += '<div class="kd-tile kd-tile-kosong" id="kd-tile-' + i + '"></div>';
      }
    }
    boardEl.innerHTML = html;
  }

  function kdUpdateChainPreview(mode) {
    var el = document.getElementById('kd-chain-preview');
    if (!el) return;
    el.classList.remove('kd-chain-active', 'kd-chain-gagal');

    if (mode === 'gagal') {
      el.innerText = '❌ Belum jadi kotoba, coba lagi ya...';
      el.classList.add('kd-chain-gagal');
      return;
    }

    if (kdChain.length === 0) {
      el.innerText = 'Klik kanji untuk mulai merangkai kotoba...';
      return;
    }

    el.innerText = kdChain.map(function(c) { return c.kanji; }).join(' + ');
    el.classList.add('kd-chain-active');
  }

  function kdKlikTile(idx) {
    if (!kdBoard[idx]) return; // slot kosong, abaikan

    var posInChain = -1;
    for (var i = 0; i < kdChain.length; i++) {
      if (kdChain[i].idx === idx) { posInChain = i; break; }
    }

    if (posInChain !== -1) {
      // Hanya bisa membatalkan pilihan TERAKHIR (biar urutan tetap jelas)
      if (posInChain === kdChain.length - 1) {
        kdChain.pop();
        kdUpdateTileVisual(idx, false);
        kdUpdateChainPreview();
        kdEvaluasiChain(); // kartu yang tersisa mungkin perlu diwarnai ulang
      }
      return;
    }

    kdChain.push({ idx: idx, kanji: kdBoard[idx] });
    kdUpdateTileVisual(idx, true); // klik pertama/berikutnya selalu biru dulu
    kdUpdateChainPreview();

    kdEvaluasiChain();
  }

  // Warna kartu terpilih ditentukan di sini:
  // - 1 kartu terpilih  -> tetap biru saja, belum ada yang bisa dievaluasi.
  // - >=2 kartu terpilih:
  //     * kalau rangkaiannya SUDAH PAS jadi kotoba yang valid  -> sukses (hijau, +5, hilang).
  //     * kalau BELUM pas tapi masih mungkin diteruskan jadi kotoba yang
  //       lebih panjang (mis. 2 kartu adalah awalan dari kotoba 3 kartu)
  //       -> oranye, artinya "lanjutkan, masih ada harapan".
  //     * kalau sudah mustahil jadi kotoba apapun -> gagal (merah) & reset.
  function kdEvaluasiChain() {
    // Kurang dari 2 kartu: tidak pernah dievaluasi, kartu tetap biru (bersihkan sisa warna oranye).
    if (kdChain.length < 2) {
      kdChain.forEach(function(c) {
        var el0 = document.getElementById('kd-tile-' + c.idx);
        if (el0) el0.classList.remove('kd-mungkin');
      });
      return;
    }

    var untai = kdChain.map(function(c) { return c.kanji; }).join('');

    if (kdKotobaSet[untai]) {
      kdProsesBerhasil();
      return;
    }

    var masihMungkin = kdAdaKemungkinanLanjutan(untai);

    kdChain.forEach(function(c) {
      var el = document.getElementById('kd-tile-' + c.idx);
      if (!el) return;
      if (masihMungkin) el.classList.add('kd-mungkin');   // ORANYE: masih ada harapan
      else el.classList.remove('kd-mungkin');
    });

    if (!masihMungkin) {
      kdResetChain(true); // mustahil jadi kotoba apapun
      return;
    }

    if (kdChain.length >= 5) {
      kdResetChain(true);
    }
  }

  // ORANYE = rangkaian yang dipilih adalah awalan dari kotoba yang lebih panjang
  // (mis. 2 kartu awalan dari kotoba 3 kartu) DAN kanji sisanya benar-benar masih
  // ada di papan (belum dipilih / belum hilang), jadi masih ada kartu yang bisa dicari.
  function kdAdaKemungkinanLanjutan(untai) {
    var terpilih = {};
    kdChain.forEach(function(c) { terpilih[c.idx] = true; });

    var tersedia = {};
    for (var i = 0; i < kdBoard.length; i++) {
      if (kdBoard[i] && !terpilih[i]) {
        tersedia[kdBoard[i]] = (tersedia[kdBoard[i]] || 0) + 1;
      }
    }

    for (var kata in kdKotobaSet) {
      if (kata.length > untai.length && kata.indexOf(untai) === 0) {
        var sisa = kata.substring(untai.length);
        var butuh = {};
        var cukup = true;
        for (var p = 0; p < sisa.length; p++) {
          var ch = sisa.charAt(p);
          butuh[ch] = (butuh[ch] || 0) + 1;
          if (butuh[ch] > (tersedia[ch] || 0)) { cukup = false; break; }
        }
        if (cukup) return true;
      }
    }
    return false;
  }

  function kdUpdateTileVisual(idx, selected) {
    var el = document.getElementById('kd-tile-' + idx);
    if (!el) return;
    if (selected) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
      el.classList.remove('kd-mungkin');
    }
  }

  function kdResetChain(gagal) {
    var tiles = kdChain.slice();
    kdChain = [];

    if (gagal) kdUpdateChainPreview('gagal');

    tiles.forEach(function(c) {
      var el = document.getElementById('kd-tile-' + c.idx);
      if (!el) return;
      el.classList.remove('kd-mungkin');
      if (gagal) {
        el.classList.add('kd-gagal');
        (function(elx) {
          setTimeout(function() {
            elx.classList.remove('kd-gagal');
            elx.classList.remove('selected');
          }, 450);
        })(el);
      } else {
        el.classList.remove('selected');
      }
    });

    if (gagal) {
      setTimeout(function() { kdUpdateChainPreview(); }, 450);
    } else {
      kdUpdateChainPreview();
    }
  }

  function kdProsesBerhasil() {
    var tiles = kdChain.slice();
    var jumlahKartu = tiles.length;
    kdChain = [];

    // Poin sesuai jumlah kartu yang tersusun
    var poin = 0;
    if (jumlahKartu === 2) poin = 3;
    else if (jumlahKartu >= 3) poin = 10;
    kdScore += poin;

    kdUpdateSkor();
    kdUpdateChainPreview();

    if (kdScore >= 250 && !kdChallengeDitawarkan) {
      kdChallengeDitawarkan = true;
      document.getElementById('kd-challenge-overlay').classList.remove('hidden');
    }

    tiles.forEach(function(c) {
      var el = document.getElementById('kd-tile-' + c.idx);
      if (el) {
        el.classList.remove('kd-mungkin');
        el.classList.add('kd-sukses');
      }
    });

    // Kanji yang berhasil ditautkan akan HILANG (dikosongkan), tidak otomatis diganti kanji baru.
    setTimeout(function() {
      tiles.forEach(function(c) {
        kdBoard[c.idx] = null;
      });
      kdRenderBoard();
    }, 500);
  }

  function kdBatalkanPilihan() {
    kdResetChain(false);
  }

  function kdResetKanji() {
    // Ganti SELURUH papan dengan set kanji berpasangan yang baru (bukan cuma
    // mengisi yang kosong), supaya kanji sisa yang tidak dapat pasangan tidak
    // tersangkut selamanya di papan. Skor tidak direset.
    kdChain = [];
    kdBoard = kdBuatSetKanjiBerpasangan(kdBoardSize);
    kdRenderBoard();
    kdUpdateChainPreview();
  }

  // Pemain pilih "Tetap N5" di popup tantangan skor 250 -> lanjut main
  // seperti biasa, level tidak berubah, popup ditutup.
  function kdPilihTetapN5() {
    document.getElementById('kd-challenge-overlay').classList.add('hidden');
  }

  // Pemain pilih "Tantang N4" -> level aktif berubah ke N4 dan papan
  // langsung diganti seluruhnya supaya kanji N4 mulai muncul.
  function kdPilihTantangN4() {
    kdLevelPilihan = 'N4';
    document.getElementById('kd-challenge-overlay').classList.add('hidden');
    kdResetKanji();
  }

  function kdKeluarGame() {
    document.getElementById('kanji-daisuki-page').classList.add('hidden');
    document.getElementById('kanji-main-page').classList.remove('hidden');
  }
  /* ================== /GAME: KANJI DAISUKI ================== */

  /* ================== REFERENSI KOTOBA ================== */
  var referensiKotobaData = [];
  var referensiKotobaLoaded = false;

  function bukaReferensiKotoba() {
    document.getElementById('kanji-daisuki-page').classList.add('hidden');
    document.getElementById('referensi-kotoba-page').classList.remove('hidden');
    document.getElementById('referensi-search').value = '';

    if (referensiKotobaLoaded) {
      renderReferensiKotoba(referensiKotobaData);
      return;
    }

    var container = document.getElementById('referensi-kotoba-container');
    container.innerHTML = '<div class="kanji-loading">Memuat data kotoba...</div>';

    google.script.run
      .withSuccessHandler(function(data) {
        referensiKotobaData = data || [];
        referensiKotobaLoaded = true;
        renderReferensiKotoba(referensiKotobaData);
      })
      .withFailureHandler(function(err) {
        container.innerHTML = '<div class="kanji-empty">Gagal memuat data: ' + err.message + '</div>';
      })
      .getReferensiKotoba();
  }

  function groupReferensiByLevel(list) {
    var groups = {};
    var order = [];
    list.forEach(function(item) {
      var lvl = item.level || 'Lainnya';
      if (!groups[lvl]) { groups[lvl] = []; order.push(lvl); }
      groups[lvl].push(item);
    });
    return { groups: groups, order: order };
  }

  function renderReferensiKotoba(list) {
    var container = document.getElementById('referensi-kotoba-container');

    if (!list || list.length === 0) {
      container.innerHTML = '<div class="kanji-empty">Tidak ada data kotoba ditemukan.</div>';
      return;
    }

    var g = groupReferensiByLevel(list);
    var html = "";

    g.order.forEach(function(lvl) {
      html += '<div class="referensi-level-label">🎖️ ' + escapeHtml(lvl) + '</div>';
      g.groups[lvl].forEach(function(item) {
        html += '<div class="referensi-item-row">';
        html += '  <div class="referensi-no-badge">' + escapeHtml(item.no) + '</div>';
        html += '  <div class="referensi-item-body">';
        html += '    <div class="referensi-item-top">';
        html += '      <div class="referensi-kotoba">' + escapeHtml(item.kotoba) + '</div>';
        html += '      <input type="checkbox" class="referensi-checkbox" onchange="this.closest(\'.referensi-item-row\').classList.toggle(\'referensi-checked\', this.checked)">';
        html += '    </div>';
        if (item.caraBaca) {
          html += '    <div class="referensi-carabaca-box">' + escapeHtml(item.caraBaca) + '</div>';
        }
        html += '    <div class="referensi-arti">' + escapeHtml(item.arti) + '</div>';
        html += '  </div>';
        html += '</div>';
      });
    });

    container.innerHTML = html;
  }

  function filterReferensiKotoba() {
    var q = document.getElementById('referensi-search').value.trim().toLowerCase();
    if (!q) {
      renderReferensiKotoba(referensiKotobaData);
      return;
    }
    var filtered = referensiKotobaData.filter(function(item) {
      return (item.kotoba && item.kotoba.toLowerCase().indexOf(q) !== -1) ||
             (item.arti && item.arti.toLowerCase().indexOf(q) !== -1);
    });
    renderReferensiKotoba(filtered);
  }

  function kembaliDariReferensiKotoba() {
    document.getElementById('referensi-kotoba-page').classList.add('hidden');
    document.getElementById('kanji-daisuki-page').classList.remove('hidden');
  }
  /* ================== /REFERENSI KOTOBA ================== */

  function bukaKanjiLevel(level) {
    catatAktivitas('Kanji', 'tingkat ' + level, true);
    kanjiCurrentLevel = level;

    document.getElementById('kanji-list-judul').innerText = 'Kanji ' + level;
    document.getElementById('kanji-main-page').classList.add('hidden');
    document.getElementById('kanji-list-page').classList.remove('hidden');

    var container = document.getElementById('kanji-list-container');
    container.innerHTML = '<div class="kanji-loading">Memuat...</div>';

    google.script.run
      .withSuccessHandler(function(data) {
        kanjiCurrentList = data || [];
        renderKanjiList(kanjiCurrentList);
      })
      .withFailureHandler(function(err) {
        container.innerHTML = '<div class="kanji-empty">Gagal memuat data: ' + err.message + '</div>';
      })
      .getKanjiByLevel(level);
  }

  function renderKanjiList(list) {
    var container = document.getElementById('kanji-list-container');

    if (!list || list.length === 0) {
      container.innerHTML = '<div class="kanji-empty">Belum ada kanji di tingkat ini.</div>';
      return;
    }

    var perBagian = 9; // 9 kanji = 3 baris x 3 kolom
    var html = "";

    for (var start = 0; start < list.length; start += perBagian) {
      var bagianKe = Math.floor(start / perBagian) + 1;
      var chunk = list.slice(start, start + perBagian);

      html += '<div class="kanji-bagian-label"><span>Bagian ' + bagianKe + '</span></div>';
      html += '<div class="kanji-grid">';
      chunk.forEach(function(item, localIdx) {
        var globalIdx = start + localIdx;
        html += '<div class="kanji-grid-card" onclick="bukaKanjiDetail(' + globalIdx + ')">';
        html += '  <div class="gc-char">' + escapeHtml(item.kanji) + '</div>';
        html += '  <div class="gc-arti">' + escapeHtml(item.arti) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function bukaKanjiDetail(idx) {
    kanjiCurrentIndex = idx;
    kanjiShowingBack = false;
    kanjiTulisAktif = false;
    document.getElementById('kanji-list-page').classList.add('hidden');
    document.getElementById('kanji-detail-page').classList.remove('hidden');
    tampilkanKanjiDetail();
  }

  function tampilkanKanjiDetail() {
    var item = kanjiCurrentList[kanjiCurrentIndex];
    if (!item) return;

    document.getElementById('kanji-detail-judul').innerText = item.kanji + ' · ' + item.arti;

    var total = kanjiCurrentList.length;
    var nomorTampil = String(kanjiCurrentIndex + 1).padStart(2, '0');
    var totalTampil = String(total).padStart(2, '0');
    document.getElementById('kanji-detail-counter').innerText = nomorTampil + '/' + totalTampil;

    document.getElementById('kanji-nav-prev').disabled = (kanjiCurrentIndex === 0);
    document.getElementById('kanji-nav-next').disabled = (kanjiCurrentIndex === total - 1);

    tampilkanWajahKartu();
  }

  function tampilkanWajahKartu() {
    var item = kanjiCurrentList[kanjiCurrentIndex];
    var wrap = document.getElementById('kanji-flip-wrap');
    if (!item) { wrap.innerHTML = ''; return; }

    // Mode Cara Tulis: kotak jiplak kanji menggantikan kartu
    var tb = document.getElementById('kanji-btn-tulis');
    if (tb) tb.innerHTML = kanjiTulisAktif ? '📖 Kembali ke Kartu' : '✍️ Cara Tulis Kanji';
    wrap.classList.toggle('tulis', kanjiTulisAktif);
    if (!kanjiTulisAktif) ktStop();
    if (kanjiTulisAktif) { wrap.innerHTML = buildTulisPanel(item); ktInit(item); return; }

    if (!kanjiShowingBack) {
      // Sisi depan: gambar dari kolom "Folder Gambar"
      if (item.gambar) {
        wrap.innerHTML = '<img class="kanji-flip-img" src="' + item.gambar + '" alt="Kartu Kanji">';
      } else {
        wrap.innerHTML = '<div class="kanji-flip-empty">Gambar belum tersedia untuk kanji ini.</div>';
      }
    } else {
      // Sisi belakang: panel data (arti, kun/on, kotoba)
      wrap.innerHTML = buildKanjiBackPanel(item);
    }
  }

  function buildKanjiBackPanel(item) {
    var html = '<div class="kanji-back-panel">';
    html += '  <div class="kanji-back-char">' + escapeHtml(item.kanji) + '</div>';
    html += '  <div class="kanji-back-arti">' + escapeHtml(item.arti) + '</div>';

    var yomiParts = [];
    if (item.kunyomi) yomiParts.push('Kun: ' + escapeHtml(item.kunyomi));
    if (item.onyomi) yomiParts.push('On: ' + escapeHtml(item.onyomi));
    if (yomiParts.length) {
      html += '  <div class="kanji-back-yomi">' + yomiParts.join('<br>') + '</div>';
    }

    html += '  <button class="kanji-speak-btn-main" onclick="event.stopPropagation(); bacakanTeks(\'' + escapeJs(item.kanji) + '\')">🔊 Dengarkan</button>';

    html += '  <div class="kanji-back-extra">';
    html += '    <div><b>Radikal:</b> ' + (item.radikal ? escapeHtml(item.radikal) : 'Belum tersedia') + '</div>';
    html += '    <div style="margin-top:4px;"><b>Filosofi:</b> ' + (item.filosofi ? escapeHtml(item.filosofi) : 'Belum tersedia') + '</div>';
    html += '  </div>';

    if (item.kotobaList && item.kotobaList.length) {
      html += '  <div class="kanji-back-kotoba-title">KOTOBA</div>';
      item.kotobaList.forEach(function(k) {
        html += '  <div class="kanji-kotoba-row">';
        html += '    <div class="kanji-kotoba-left">' + escapeHtml(k.kotoba);
        if (k.caraBaca) {
          html += ' <span class="kw-carabaca">（' + escapeHtml(k.caraBaca) + '）</span>';
        }
        html += '      <button class="kanji-speak-btn" onclick="event.stopPropagation(); bacakanTeks(\'' + escapeJs(k.kotoba) + '\')">🔊</button>';
        html += '    </div>';
        html += '    <div class="kanji-kotoba-right">' + escapeHtml(k.arti) + '</div>';
        html += '  </div>';
      });
    } else {
      html += '  <div class="kanji-back-empty">Belum ada contoh kotoba.</div>';
    }

    html += '</div>';
    return html;
  }

  function balikKartuKanji() {
    kanjiTulisAktif = false;
    kanjiShowingBack = !kanjiShowingBack;
    tampilkanWajahKartu();
  }

  function kanjiSebelumnya() {
    if (kanjiCurrentIndex > 0) {
      kanjiCurrentIndex--;
      kanjiShowingBack = false;
      tampilkanKanjiDetail();
    }
  }

  function kanjiBerikutnya() {
    if (kanjiCurrentIndex < kanjiCurrentList.length - 1) {
      kanjiCurrentIndex++;
      kanjiShowingBack = false;
      tampilkanKanjiDetail();
    }
  }

  function kembaliKeKanjiList() {
    document.getElementById('kanji-detail-page').classList.add('hidden');
    document.getElementById('kanji-list-page').classList.remove('hidden');
  }

  function kembaliKeKanjiMain() {
    document.getElementById('kanji-list-page').classList.add('hidden');
    document.getElementById('kanji-main-page').classList.remove('hidden');
  }

  function kembaliKeMainDariKanji() {
    document.getElementById('kanji-main-page').classList.add('hidden');
    document.getElementById('main-menu-page').classList.remove('hidden');
  }

  /* =====================================================================
     CARA TULIS KANJI: siswa menjiplak kanji samar di dalam kotak; hasilnya dinilai
     dengan membandingkan garis tengah goresan siswa dengan garis tengah kanji (toleransi kecil).
     Yang dinilai adalah BENTUK, bukan urutan goresan.
     ===================================================================== */
  var kanjiTulisAktif = false;
  var KT_FONT = "'Noto Sans CJK JP','Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo','MS Gothic',sans-serif";
  var KT_N = 96;        // resolusi penilaian (96x96)
  var KT_R = 5;         // toleransi jarak (±5 dari 96 = ±5% lebar kotak)
  var KT_COV = 0.80;    // minimal bagian kanji yang tertutup goresan siswa
  var KT_PREC = 0.75;   // minimal goresan siswa yang berada di jalur kanji
  var kt = { ch: '', size: 260, dpr: 1, strokes: [], cur: null, gd: null, dr: null, gsk: null, fbTampil: false };
  kt.mode = 'lihat'; kt.tok = 0; kt.timer = null; kt.hw = null; kt.data = null; kt.len = []; kt.n = 0; kt.step = 0;
  kt.auto = true;      // latihan urutan: salah -> otomatis ulang dari awal
  kt.outline = true;   // garis bantu (bentuk samar) pada latihan urutan
  kt.gagal = 0; kt.qLock = false;

  function toggleTulisKanji() {
    kanjiTulisAktif = !kanjiTulisAktif;
    tampilkanWajahKartu();
  }

  function buildTulisPanel(item) {
    var h = '<div class="kt-panel">';
    h += '<div class="kt-title">✍️ Cara Tulis · <b>' + escapeHtml(Array.from(String(item.kanji || ''))[0] || '') + '</b> ' + escapeHtml(item.arti) + '</div>';
    h += '<div class="kt-tabs"><button class="kt-tab" id="kt-tab-lihat" onclick="ktMode(\'lihat\')">👀 Urutan Goresan</button>' +
         '<button class="kt-tab" id="kt-tab-urutan" onclick="ktMode(\'urutan\')">✍️ Latihan Urutan</button>' +
         '<button class="kt-tab" id="kt-tab-jiplak" onclick="ktMode(\'jiplak\')">🖌 Jiplak Bentuk</button></div>';
    h += '<div class="kt-sub" id="kt-sub"></div>';
    h += '<div class="kt-box" id="kt-box" style="display:none"><canvas id="kt-guide"></canvas><canvas id="kt-draw"></canvas></div>';
    h += '<div class="kt-box" id="kt-hwbox"><div id="kt-hw"></div></div>';
    h += '<div class="kt-fb" id="kt-fb"></div>';
    h += '<div class="kt-btns" id="kt-btns"></div>';
    return h + '</div>';
  }

  // Gambar kanji di tengah kanvas n×n (dipakai untuk tampilan samar DAN untuk penilaian, supaya identik)
  function ktGlyphText(ctx, ch, n) {
    try { ctx.lang = 'ja'; } catch (e) {}
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var fs = n * 0.8;
    ctx.font = fs + 'px ' + KT_FONT;
    var m = ctx.measureText(ch);
    if (m.actualBoundingBoxAscent === undefined) {          // browser lama: pusatkan seadanya
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, n / 2, n / 2 + fs * 0.04); return;
    }
    var w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    fs = fs * (n * 0.84) / Math.max(w, h, 1);               // sesuaikan agar kanji pas di kotak
    ctx.font = fs + 'px ' + KT_FONT;
    m = ctx.measureText(ch);
    w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    ctx.fillText(ch, (n - w) / 2 + m.actualBoundingBoxLeft, (n - h) / 2 + m.actualBoundingBoxAscent);
  }

  function ktCanvasMask(gambar, alphaMin) {
    var c = document.createElement('canvas'); c.width = c.height = KT_N;
    var g = c.getContext('2d'); g.fillStyle = '#000'; g.strokeStyle = '#000';
    gambar(g);
    var d = g.getImageData(0, 0, KT_N, KT_N).data, m = new Uint8Array(KT_N * KT_N);
    for (var i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > alphaMin ? 1 : 0;
    return m;
  }

  // Penipisan Zhang-Suen: bentuk tebal -> garis tengah 1 piksel
  function ktThin(src, n) {
    var m = new Uint8Array(src), changed = true, pass = 0;
    function P(x, y) { return (x < 0 || y < 0 || x >= n || y >= n) ? 0 : m[y * n + x]; }
    while (changed && pass < 100) {
      changed = false;
      for (var step = 0; step < 2; step++) {
        var del = [];
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
          if (!m[y * n + x]) continue;
          var p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
          var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          var A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
          del.push(y * n + x);
        }
        if (del.length) { changed = true; for (var q = 0; q < del.length; q++) m[del[q]] = 0; }
      }
      pass++;
    }
    return m;
  }

  // Bandingkan garis tengah kanji (gsk) dengan garis tengah goresan siswa (ssk)
  function ktScore(gsk, ssk, n, r) {
    var offs = [], dx, dy;
    for (dy = -r; dy <= r; dy++) for (dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) offs.push([dx, dy]);
    function dilate(m) {
      var o = new Uint8Array(n * n);
      for (var i = 0; i < m.length; i++) {
        if (!m[i]) continue;
        var x = i % n, y = (i / n) | 0;
        for (var k = 0; k < offs.length; k++) {
          var xx = x + offs[k][0], yy = y + offs[k][1];
          if (xx >= 0 && yy >= 0 && xx < n && yy < n) o[yy * n + xx] = 1;
        }
      }
      return o;
    }
    var dS = dilate(ssk), dG = dilate(gsk), gN = 0, gOk = 0, sN = 0, sOk = 0, miss = [];
    for (var i = 0; i < gsk.length; i++) {
      if (gsk[i]) { gN++; if (dS[i]) gOk++; else miss.push(i); }
      if (ssk[i]) { sN++; if (dG[i]) sOk++; }
    }
    var cov = gN ? gOk / gN : 0, prec = sN ? sOk / sN : 0;
    var f1 = (cov + prec) ? 2 * cov * prec / (cov + prec) : 0;
    return { cov: cov, prec: prec, f1: f1, miss: miss, ok: sN > 0 && cov >= KT_COV && prec >= KT_PREC };
  }

  function ktInit(item) {
    ktStop();
    kt.ch = Array.from(String(item.kanji || ''))[0] || '';
    kt.strokes = []; kt.cur = null; kt.fbTampil = false; kt.gagal = 0;
    kt.gd = document.getElementById('kt-guide'); kt.dr = document.getElementById('kt-draw');
    kt.gsk = ktThin(ktCanvasMask(function (g) { ktGlyphText(g, kt.ch, KT_N); }, 40), KT_N);
    ktLayout();

    var d = kt.dr;
    function pos(e) { var r = d.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    d.onpointerdown = function (e) {
      e.preventDefault();
      try { d.setPointerCapture(e.pointerId); } catch (x) {}
      ktBersihkanUmpanBalik();
      kt.cur = [pos(e)]; kt.strokes.push(kt.cur);
      ktGambarGoresan(d.getContext('2d'), kt.cur, 0);
    };
    d.onpointermove = function (e) {
      if (!kt.cur) return;
      e.preventDefault();
      kt.cur.push(pos(e));
      ktGambarGoresan(d.getContext('2d'), kt.cur, kt.cur.length - 2);
    };
    d.onpointerup = d.onpointercancel = function () { kt.cur = null; };
    ktMode('lihat');
  }

  function ktLayout() {
    var box = document.getElementById('kt-box');
    if (!box || !kt.gd) return;
    kt.size = box.clientWidth || 260;
    kt.dpr = Math.min(window.devicePixelRatio || 1, 3);
    [kt.gd, kt.dr].forEach(function (c) { c.width = c.height = Math.round(kt.size * kt.dpr); });
    ktGambarPanduan(null);
    ktGambarUlang();
  }

  function ktGambarPanduan(miss) {
    var g = kt.gd.getContext('2d');
    g.setTransform(kt.dpr, 0, 0, kt.dpr, 0, 0);
    g.clearRect(0, 0, kt.size, kt.size);
    g.fillStyle = 'rgba(71, 85, 105, 0.22)';           // kanji samar (transparan)
    ktGlyphText(g, kt.ch, kt.size);
    if (miss && miss.length) {                           // tandai bagian yang belum tertutup goresan
      g.fillStyle = 'rgba(220, 38, 38, 0.40)';
      miss.forEach(function (p) {
        g.beginPath();
        g.arc(((p % KT_N) + 0.5) / KT_N * kt.size, (((p / KT_N) | 0) + 0.5) / KT_N * kt.size, kt.size * 0.04, 0, Math.PI * 2);
        g.fill();
      });
    }
  }

  function ktGambarGoresan(g, st, dari) {
    var S = kt.size;
    g.setTransform(kt.dpr, 0, 0, kt.dpr, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = g.fillStyle = '#1e293b'; g.lineWidth = S * 0.045;
    if (st.length === 1) { g.beginPath(); g.arc(st[0][0] * S, st[0][1] * S, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); return; }
    g.beginPath(); g.moveTo(st[dari][0] * S, st[dari][1] * S);
    for (var i = dari + 1; i < st.length; i++) g.lineTo(st[i][0] * S, st[i][1] * S);
    g.stroke();
  }

  function ktGambarUlang() {
    var g = kt.dr.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, kt.dr.width, kt.dr.height);
    kt.strokes.forEach(function (st) { ktGambarGoresan(g, st, 0); });
  }

  function ktFb(teks, kelas) {
    var el = document.getElementById('kt-fb');
    if (el) { el.className = 'kt-fb ' + (kelas || ''); el.textContent = teks || ''; }
  }
  function ktBersihkanUmpanBalik() {
    if (!kt.fbTampil) return;
    kt.fbTampil = false; ktFb('', ''); ktGambarPanduan(null);
  }
  function ktUndo() { kt.strokes.pop(); kt.fbTampil = true; ktBersihkanUmpanBalik(); ktGambarUlang(); }
  function ktClear() { kt.strokes = []; kt.fbTampil = true; ktBersihkanUmpanBalik(); ktGambarUlang(); }

  function ktCek() {
    if (!kt.strokes.length) { ktFb('Tulis kanjinya dulu ya 🙂', 'mid'); return; }
    var sm = ktCanvasMask(function (g) {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2;
      kt.strokes.forEach(function (st) {
        g.beginPath();
        if (st.length === 1) { g.arc(st[0][0] * KT_N, st[0][1] * KT_N, 1, 0, Math.PI * 2); g.fill(); return; }
        g.moveTo(st[0][0] * KT_N, st[0][1] * KT_N);
        for (var i = 1; i < st.length; i++) g.lineTo(st[i][0] * KT_N, st[i][1] * KT_N);
        g.stroke();
      });
    }, 60);
    var s = ktScore(kt.gsk, ktThin(sm, KT_N), KT_N, KT_R), pct = Math.round(s.f1 * 100);
    kt.fbTampil = true;
    if (s.ok) {
      ktGambarPanduan(null);
      ktFb('✅ Benar! Tulisanmu sudah sesuai (' + pct + '%).', 'ok');
      if (typeof questCatatKanji === 'function') questCatatKanji(kt.ch);
    } else if (s.f1 >= 0.55) {
      ktGambarPanduan(s.cov < KT_COV ? s.miss : null);
      ktFb('🔶 Hampir! ' + (s.cov < KT_COV ? 'Bagian merah belum tertutup goresanmu. ' : '') +
           (s.prec < KT_PREC ? 'Ada goresan yang keluar dari bentuk kanji. ' : '') + '(' + pct + '%)', 'mid');
    } else {
      ktGambarPanduan(null);
      ktFb('❌ Belum mirip (' + pct + '%). Ikuti bentuk samar pelan-pelan, lalu coba lagi.', 'no');
    }
  }

  /* =====================================================================
     URUTAN GORESAN + LATIHAN URUTAN
     Data goresan: hanzi-writer-data-jp (turunan AnimCJK), dimuat dari CDN saat dibutuhkan.
     - Tab "Urutan Goresan": animasi per goresan + nomor (digambar sendiri dengan SVG).
     - Tab "Latihan Urutan": pustaka Hanzi Writer mencocokkan goresan siswa dengan urutan yang benar.
       Jika salah (urutan/arah/bentuk), otomatis mengulang dari awal (bisa dimatikan).
     ===================================================================== */
  var KT_DATA_URLS = [
    'https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/',
    'https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@latest/',
    'https://raw.githubusercontent.com/chanind/hanzi-writer-data-jp/master/data/'
  ];
  var KT_LIB_URLS = [
    'https://cdn.jsdelivr.net/npm/hanzi-writer@3/dist/hanzi-writer.min.js',
    'https://unpkg.com/hanzi-writer@3/dist/hanzi-writer.min.js'
  ];
  var ktCache = {};

  function ktEl(id) { return document.getElementById(id); }
  function ktSetBtns(h) { var b = ktEl('kt-btns'); if (b) b.innerHTML = h; }
  function ktSub(t) { var e = ktEl('kt-sub'); if (e) e.textContent = t; }

  function ktStop() {
    kt.tok++;
    if (kt.timer) { clearTimeout(kt.timer); kt.timer = null; }
    kt.hw = null; kt.qLock = false;
  }

  function ktAmbilData(ch, ok, gagal) {
    if (ktCache[ch]) { ok(ktCache[ch]); return; }
    (function coba(i) {
      if (i >= KT_DATA_URLS.length) { gagal(); return; }
      fetch(KT_DATA_URLS[i] + encodeURIComponent(ch) + '.json')
        .then(function (r) { if (!r.ok) throw new Error('x'); return r.json(); })
        .then(function (d) {
          if (!d || !d.strokes || !d.medians || !d.strokes.length) throw new Error('x');
          ktCache[ch] = d; ok(d);
        })
        .catch(function () { coba(i + 1); });
    })(0);
  }

  function ktMuatLib(ok, gagal) {
    if (window.HanziWriter) { ok(); return; }
    var i = 0;
    (function next() {
      if (i >= KT_LIB_URLS.length) { gagal(); return; }
      var sc = document.createElement('script');
      sc.src = KT_LIB_URLS[i++];
      sc.onload = function () { if (window.HanziWriter) ok(); else next(); };
      sc.onerror = function () { next(); };
      document.head.appendChild(sc);
    })();
  }

  function ktMode(m) {
    ktStop();
    kt.mode = m;
    ['lihat', 'urutan', 'jiplak'].forEach(function (k) {
      var t = ktEl('kt-tab-' + k); if (t) t.classList.toggle('on', k === m);
    });
    var jb = ktEl('kt-box'), hb = ktEl('kt-hwbox');
    if (!jb || !hb) return;
    jb.style.display = (m === 'jiplak') ? '' : 'none';
    hb.style.display = (m === 'jiplak') ? 'none' : '';
    ktFb('', '');
    if (m === 'jiplak') {
      ktSub('Ikuti bentuk kanji yang samar dengan jari, lalu tekan Cek.');
      ktSetBtns('<button onclick="ktUndo()">↩ Urungkan</button><button onclick="ktClear()">🗑 Hapus</button><button class="main" onclick="ktCek()">✔ Cek</button>');
      ktLayout();
    } else if (m === 'lihat') {
      ktSub('Perhatikan urutan goresan (nomor merah = urutan, mulai dari titik nomor).');
      ktLihatMulai();
    } else {
      ktSub('Tulis kanji dengan jari sesuai urutan goresan. Jika urutan salah, otomatis mengulang dari awal.');
      ktQuizMulai('');
    }
  }

  /* ---------- Tab 1: animasi urutan goresan ---------- */
  function ktLihatMulai() {
    var tok = kt.tok, hw = ktEl('kt-hw');
    if (!hw) return;
    hw.innerHTML = '';
    ktSetBtns('');
    ktFb('Memuat urutan goresan...', 'mid');
    ktAmbilData(kt.ch, function (d) {
      if (tok !== kt.tok || !ktEl('kt-hw')) return;
      kt.data = d; kt.n = d.strokes.length;
      ktBangunSvg(d);
      ktSetBtns('<button onclick="ktLihatMundur()">◀ Mundur</button><button class="main" onclick="ktLihatPutar()">▶ Putar Ulang</button><button onclick="ktLihatMaju()">Maju ▶</button>');
      ktLihatPutar();
    }, function () {
      if (tok !== kt.tok) return;
      ktFb('Data urutan goresan untuk kanji ini belum bisa dimuat (cek internet, atau datanya belum tersedia). Tab "Jiplak Bentuk" tetap bisa dipakai.', 'no');
    });
  }

  function ktBangunSvg(d) {
    var n = d.strokes.length, defs = '', outline = '', anim = '', nums = '', i;
    for (i = 0; i < n; i++) {
      var md = d.medians[i] || [[0, 0], [0, 0]];
      var pts = md.map(function (q) { return [q[0], q[1]]; });
      if (pts.length < 2) pts.push([pts[0][0] + 1, pts[0][1]]);
      // perpanjang ujung garis tengah sedikit agar seluruh goresan tertutup saat dianimasikan
      var a = pts[0], b = pts[1], z = pts[pts.length - 1], y = pts[pts.length - 2];
      var da = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)) || 1;
      var dz = Math.sqrt(Math.pow(z[0] - y[0], 2) + Math.pow(z[1] - y[1], 2)) || 1;
      var p0 = [a[0] + (a[0] - b[0]) / da * 30, a[1] + (a[1] - b[1]) / da * 30];
      var pz = [z[0] + (z[0] - y[0]) / dz * 30, z[1] + (z[1] - y[1]) / dz * 30];
      var dstr = 'M ' + p0[0] + ' ' + p0[1] + ' ' + pts.map(function (q) { return 'L ' + q[0] + ' ' + q[1]; }).join(' ') + ' L ' + pz[0] + ' ' + pz[1];
      defs += '<clipPath id="ktc' + i + '"><path d="' + d.strokes[i] + '"/></clipPath>';
      outline += '<path d="' + d.strokes[i] + '"/>';
      anim += '<path id="kts' + i + '" d="' + dstr + '" fill="none" stroke="#1e293b" stroke-width="170" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#ktc' + i + ')" style="visibility:hidden"/>';
      // lencana nomor: diletakkan sedikit sebelum titik awal goresan (koordinat layar: y = 900 - y)
      var ux = (b[0] - a[0]) / da, uy = (b[1] - a[1]) / da;
      var bx = Math.max(44, Math.min(980, a[0] - ux * 58)), by = Math.max(44, Math.min(980, 900 - (a[1] - uy * 58)));
      nums += '<g id="ktn' + i + '" style="visibility:hidden"><circle cx="' + bx + '" cy="' + by + '" r="38" fill="#dc2626" stroke="#fff" stroke-width="5"/>' +
              '<text x="' + bx + '" y="' + by + '" fill="#fff" font-size="48" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">' + (i + 1) + '</text></g>';
    }
    ktEl('kt-hw').innerHTML = '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="scale(1,-1) translate(0,-900)"><defs></defs>' + defs + '<g fill="#e2e8f0">' + outline + '</g>' + anim + '</g>' + nums + '</svg>';
    kt.len = [];
    for (i = 0; i < n; i++) {
      var pe = ktEl('kts' + i), L = 1000;
      try { L = pe.getTotalLength(); } catch (e) {}
      pe.style.strokeDasharray = L + ' ' + L; pe.style.strokeDashoffset = L;
      kt.len.push(L);
    }
    kt.step = 0;
  }

  function ktSembunyi(i) {
    var p = ktEl('kts' + i), g = ktEl('ktn' + i);
    if (p) { p.style.transition = 'none'; p.style.strokeDashoffset = kt.len[i]; p.style.visibility = 'hidden'; }
    if (g) g.style.visibility = 'hidden';
  }
  function ktTampilStroke(i, animasi) {
    var p = ktEl('kts' + i), g = ktEl('ktn' + i), dur = 0;
    if (!p) return 0;
    p.style.visibility = 'visible'; if (g) g.style.visibility = 'visible';
    p.style.transition = 'none';
    if (!animasi) { p.style.strokeDashoffset = 0; return 0; }
    p.style.strokeDashoffset = kt.len[i];
    p.getBoundingClientRect();                                  // paksa reflow supaya transisi jalan
    dur = Math.max(450, Math.min(1100, kt.len[i] * 1.1));
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms ease-in-out';
    p.style.strokeDashoffset = 0;
    return dur;
  }
  function ktTampilSampai(k, animTerakhir) {
    var dur = 0;
    for (var i = 0; i < kt.n; i++) {
      if (i < k) { var dd = ktTampilStroke(i, animTerakhir && i === k - 1); if (dd) dur = dd; }
      else ktSembunyi(i);
    }
    kt.step = k;
    if (k > 0) ktFb('Goresan ke-' + k + ' dari ' + kt.n, '');
    return dur;
  }
  function ktLihatPutar() {
    ktStop();
    var tok = kt.tok, k = 0;
    ktTampilSampai(0, false);
    (function lanjut() {
      if (tok !== kt.tok || !ktEl('kts0')) return;
      if (k >= kt.n) { ktFb('✅ Selesai! Total ' + kt.n + ' goresan. Tekan "Putar Ulang" atau coba tab Latihan Urutan.', 'ok'); return; }
      k++;
      var dur = ktTampilSampai(k, true);
      kt.timer = setTimeout(lanjut, dur + 380);
    })();
  }
  function ktLihatMaju() {
    ktStop();
    if (!ktEl('kts0')) return;
    if (kt.step >= kt.n) { ktFb('✅ Semua goresan sudah tampil (' + kt.n + ').', 'ok'); return; }
    ktTampilSampai(kt.step + 1, true);
  }
  function ktLihatMundur() {
    ktStop();
    if (!ktEl('kts0')) return;
    if (kt.step <= 0) { ktFb('Belum ada goresan.', 'mid'); return; }
    ktTampilSampai(kt.step - 1, false);
    if (kt.step === 0) ktFb('Mulai dari goresan ke-1.', '');
  }

  /* ---------- Tab 2: latihan urutan (salah -> ulang otomatis) ---------- */
  function ktBtnQuiz() {
    ktSetBtns('<button class="main" onclick="ktQuizMulai(\'\')">🔁 Ulangi</button>' +
      '<button onclick="ktToggleBantu()">💡 Garis bantu: ' + (kt.outline ? 'ON' : 'OFF') + '</button>' +
      '<button onclick="ktToggleAuto()">⚠️ Ulang otomatis: ' + (kt.auto ? 'ON' : 'OFF') + '</button>');
  }
  function ktToggleBantu() {
    kt.outline = !kt.outline;
    if (kt.hw) { try { if (kt.outline) kt.hw.showOutline(); else kt.hw.hideOutline(); } catch (e) {} }
    ktBtnQuiz();
  }
  function ktToggleAuto() { kt.auto = !kt.auto; ktQuizMulai(''); }

  function ktQuizMulai(pesan) {
    ktStop();
    var tok = kt.tok, hw = ktEl('kt-hw');
    if (!hw) return;
    hw.innerHTML = ''; hw.style.pointerEvents = '';
    ktSetBtns('');
    ktFb('Memuat latihan...', 'mid');
    ktMuatLib(function () {
      if (tok !== kt.tok) return;
      ktAmbilData(kt.ch, function (d) {
        if (tok !== kt.tok || !ktEl('kt-hw')) return;
        var size = (ktEl('kt-hwbox').clientWidth) || 260;
        kt.n = d.strokes.length;
        hw.innerHTML = '';
        kt.hw = HanziWriter.create('kt-hw', kt.ch, {
          width: size, height: size, padding: 12,
          showCharacter: false, showOutline: kt.outline,
          charDataLoader: function (c, onLoad) { onLoad(d); },
          strokeColor: '#1e293b', outlineColor: '#cbd5e1', drawingColor: '#1e293b', highlightColor: '#dc2626',
          drawingWidth: Math.max(10, Math.round(size * 0.045)),
          showHintAfterMisses: kt.auto ? false : 3,
          leniency: 1.4, highlightOnComplete: false
        });
        ktBtnQuiz();
        ktFb((pesan ? pesan + ' ' : '') + 'Tulis goresan ke-1 (dari ' + kt.n + ').', pesan ? 'mid' : '');
        kt.hw.quiz({
          onCorrectStroke: function (sd) {
            if (tok !== kt.tok) return;
            ktFb('✔ Goresan ke-' + (sd.strokeNum + 1) + ' benar' + (sd.strokesRemaining ? ' · lanjut goresan ke-' + (sd.strokeNum + 2) + ' (tinggal ' + sd.strokesRemaining + ')' : ''), 'ok');
          },
          onMistake: function (sd) {
            if (tok !== kt.tok) return;
            if (!kt.auto) { ktFb('❌ Goresan ke-' + (sd.strokeNum + 1) + ' belum tepat (cek urutan, arah, atau bentuk). Coba lagi.', 'no'); return; }
            if (kt.qLock) return;
            kt.qLock = true; kt.gagal++;
            hw.style.pointerEvents = 'none';
            ktFb('❌ Urutan/goresan ke-' + (sd.strokeNum + 1) + ' salah. Ulangi dari awal ya!', 'no');
            kt.timer = setTimeout(function () {
              if (tok !== kt.tok) return;
              ktQuizMulai('Percobaan ke-' + (kt.gagal + 1) + '. Intip dulu di tab "Urutan Goresan" kalau lupa.');
            }, 1400);
          },
          onComplete: function (sm) {
            if (tok !== kt.tok) return;
            ktFb('🎉 Hebat! Urutan goresan benar semua' + (kt.gagal ? ' (setelah ' + kt.gagal + ' kali mengulang).' : '!'), 'ok');
            if (typeof questCatatKanji === 'function') questCatatKanji(kt.ch);
          }
        });
      }, function () {
        if (tok !== kt.tok) return;
        ktFb('Data urutan goresan untuk kanji ini belum bisa dimuat (cek internet, atau datanya belum tersedia).', 'no');
      });
    }, function () {
      if (tok !== kt.tok) return;
      ktFb('Pustaka latihan gagal dimuat. Pastikan internet aktif, lalu buka tab ini lagi.', 'no');
    });
  }

  window.addEventListener('resize', function () { if (kanjiTulisAktif && kt.mode === 'jiplak' && document.getElementById('kt-box')) ktLayout(); });

  function bacakanTeks(teks) {
    bacaJepang(teks);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeJs(str) {
    return String(str || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }