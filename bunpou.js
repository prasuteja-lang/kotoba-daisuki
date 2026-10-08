var bp = { data: [], view: 'buku', buku: '', bab: '', list: [], idx: 0, step: 0, done: {}, q: [], qi: 0, skor: 0, choukai: null, rekap: null, rkSel: 0, rkGrup: [], rkShow: [], furi: false, kw: null, kt: null, kzState: 'idle', kc: {}, kzPend: {}, rkAuto: {}, ck: {}, ckData: {}, ckSpd: {}, ckList: [] };
  var BP_PART = ['は','が','を','に','で','の','も','と','へ','か','から','まで','や','よ','ね'];

  function bpEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function bpAcak(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function bpBody() { return document.getElementById('bp-body'); }
  function bpJudul(t) { document.getElementById('bp-title').textContent = t; }

  function bukaBunpouDariMain() {
    bpRkSiapkan();   // mulai memuat kamus furigana di latar belakang sejak menu Bunpou dibuka
    document.getElementById('main-menu-page').classList.add('hidden');
    document.getElementById('bunpou-page').classList.remove('hidden');
    bp.view = 'buku';
    if (bp.data.length) { bpRender(); return; }
    bpBody().innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">Memuat materi Bunpou...</div>';
    google.script.run
      .withSuccessHandler(function (d) { bp.data = d || []; bpRender(); })
      .withFailureHandler(function (e) { bpBody().innerHTML = '<div style="color:#dc2626;text-align:center;padding:20px;">Gagal memuat: ' + bpEsc(e.message) + '</div>'; })
      .getBunpou();
  }

  function bpBack() {
    if (bp.view === 'choukai') bp.view = 'pola';
    else if (bp.view === 'belajar') bp.view = 'pola';
    else if (bp.view === 'pola') bp.view = 'bab';
    else if (bp.view === 'bab') bp.view = 'buku';
    else if (bp.view === 'rekap') bp.view = 'buku';
    else { document.getElementById('bunpou-page').classList.add('hidden'); document.getElementById('main-menu-page').classList.remove('hidden'); return; }
    bpRender();
  }

  function bpRender() {
    var h = '';
    document.getElementById('bunpou-page').classList.toggle('rk-aktif', bp.view === 'rekap');
    if (bp.view !== 'choukai') bpCkStop();
    if (bp.view === 'buku') {
      bpJudul('📗 Bunpou');
      ['Irodori 1', 'Irodori 2'].forEach(function (b) {
        var n = bp.data.filter(function (r) { return r.buku === b; }).length;
        h += '<div class="bp-item" onclick="bpPilihBuku(\'' + b + '\')"><span>📗 ' + b + '<small>' + n + ' pola</small></span><span>›</span></div>';
      });
      if (!bp.data.length) h = '<div style="text-align:center;color:#6b7280;padding:20px;">Belum ada data. Isi sheet "Bunpou" di Spreadsheet.</div>';
      h += '<hr class="bp-sep">' +
        '<div class="bp-item rekap" onclick="bpBukaRekap()"><span>📋 Rekap Bunpou Lainnya<small>Pola dikelompokkan per jenis perubahan</small></span><span>›</span></div>';
    } else if (bp.view === 'rekap') {
      bpRenderRekap(); return;
    } else if (bp.view === 'bab') {
      bpJudul(bp.buku);
      var babs = [], seen = {};
      bp.data.forEach(function (r) { if (r.buku === bp.buku && !seen[r.bab]) { seen[r.bab] = 1; babs.push(r.bab); } });
      babs.forEach(function (b) {
        var rs = bp.data.filter(function (r) { return r.buku === bp.buku && r.bab === b; });
        var ok = rs.filter(function (r) { return bp.done[bpKey(r)]; }).length;
        h += '<div class="bp-item" onclick="bpPilihBab(\'' + b + '\')"><span>' + bpEsc(b) + '<small>' + ok + '/' + rs.length + ' pola selesai</small></span><span>' + (ok === rs.length ? '⭐' : '›') + '</span></div>';
      });
      if (!babs.length) h = '<div style="text-align:center;color:#6b7280;padding:20px;">Belum ada materi untuk ' + bp.buku + '.</div>';
    } else if (bp.view === 'pola') {
      bpJudul(bp.bab);
      bp.list.forEach(function (r, i) {
        h += '<div class="bp-item" onclick="bpMulai(' + i + ')"><span>' + bpEsc(r.judul) + '<small>' + bpEsc(r.rumus) + '</small></span><span>' + (bp.done[bpKey(r)] ? '⭐' : '›') + '</span></div>';
      });
      h += '<div class="bp-item choukai" onclick="bpBukaChoukai()"><span>🎧 Choukai<small>Latihan mendengarkan ' + bpEsc(bp.bab) + '</small></span><span>›</span></div>';
    } else if (bp.view === 'choukai') {
      bpRenderChoukai(); return;
    } else {
      bpRenderBelajar(); return;
    }
    bpBody().innerHTML = h;
    window.scrollTo(0, 0);
  }

  function bpKey(r) { return r.buku + '|' + r.bab + '|' + r.judul; }
  function bpPilihBuku(b) { bp.buku = b; bp.view = 'bab'; bpRender(); }
  function bpPilihBab(b) {
    bp.bab = b; bp.view = 'pola';
    bp.list = bp.data.filter(function (r) { return r.buku === bp.buku && r.bab === b; });
    if (typeof catatAktivitas === 'function') catatAktivitas('Bunpou', bp.buku + ' ' + b, true);
    bpRender();
  }
  function bpBukaChoukai() {
    bp.view = 'choukai';
    if (typeof catatAktivitas === 'function') catatAktivitas('Bunpou', bp.buku + ' ' + bp.bab + ' (choukai)', true);
    if (bp.choukai) { bpRender(); return; }
    bpJudul('🎧 Choukai · ' + bp.bab);
    bpBody().innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">Memuat materi Choukai...</div>';
    google.script.run
      .withSuccessHandler(function (d) { bp.choukai = d || []; if (bp.view === 'choukai') bpRender(); })
      .withFailureHandler(function (e) { bpBody().innerHTML = '<div style="color:#dc2626;text-align:center;padding:20px;">Gagal memuat: ' + bpEsc(e.message) + '</div>'; })
      .getChoukai();
  }
  function bpNormBab(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function bpRenderChoukai() {
    bpJudul('🎧 Choukai · ' + bp.bab);
    var list = (bp.choukai || []).filter(function (r) {
      return r.buku === bp.buku && bpNormBab(r.bab) === bpNormBab(bp.bab);
    });
    if (!list.length) {
      bpBody().innerHTML = '<div class="bp-box" style="text-align:center;padding:30px 14px;"><div style="font-size:40px;margin-bottom:8px;">🎧</div>' +
        '<div style="font-weight:700;color:#1d4ed8;font-size:16px;">Materi Choukai ' + bpEsc(bp.bab) + '</div>' +
        '<div style="color:#6b7280;margin-top:6px;">Belum ada materi. Isi sheet "Choukai" di Spreadsheet.</div></div>';
      return;
    }
    var h = '';
    bpCkStop(); bp.ckList = list;
    list.forEach(function (r, i) {
      h += '<div class="bp-box">' +
        '<div style="font-weight:700;color:#1d4ed8;margin-bottom:8px;">🎧 Choukai ' + bpEsc(r.no || (i + 1)) + '</div>';
      if (r.fileId) {
        h += '<div class="ck-player">' +
             '<button class="ck-play" id="ck-p' + i + '" onclick="bpCkPlay(' + i + ')">▶</button>' +
             '<div class="ck-bar" onclick="bpCkSeek(event,' + i + ')"><div class="ck-fill" id="ck-f' + i + '"></div></div>' +
             '<span class="ck-time" id="ck-t' + i + '">0:00</span>' +
             '<button class="ck-spd" id="ck-s' + i + '" onclick="bpCkSpeed(' + i + ')">1x</button></div>';
      } else if (r.link) {
        h += '<a href="' + bpEsc(r.link) + '" target="_blank" style="color:#2563eb;">Buka audio</a>';
      } else {
        h += '<div class="bp-imgerr">Audio belum tersedia</div>';
      }
      if (r.materi) {
        h += '<div class="bp-nav"><button style="background:#3b82f6" onclick="bpToggleTeks(' + i + ')" id="bp-tb' + i + '">Lihat Teks</button></div>' +
             '<div id="bp-tx' + i + '" style="display:none;margin-top:10px;font-size:16px;line-height:1.8;color:#111827;">' +
             bpEsc(r.materi).replace(/\n/g, '<br>') + '</div>';
      }
      h += '</div>';
    });
    bpBody().innerHTML = h;
    window.scrollTo(0, 0);
  }
  function bpCkFmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function bpCkStop() { for (var k in bp.ck) { try { bp.ck[k].pause(); } catch (e) {} } bp.ck = {}; }
  function bpCkEl(id) { return document.getElementById(id); }
  function bpCkPlay(i) {
    var r = bp.ckList[i], btn = bpCkEl('ck-p' + i), a = bp.ck[i];
    if (!r || !btn) return;
    for (var k in bp.ck) { if (String(k) !== String(i)) bp.ck[k].pause(); }
    if (a) { if (a.paused) a.play().catch(function () {}); else a.pause(); return; }
    function mulai(url) {
      var au = new Audio(url); bp.ck[i] = au; au.playbackRate = bp.ckSpd[i] || 1;
      au.addEventListener('loadedmetadata', function () { var t = bpCkEl('ck-t' + i); if (t) t.textContent = '0:00 / ' + bpCkFmt(au.duration); });
      au.addEventListener('timeupdate', function () {
        var f = bpCkEl('ck-f' + i), t = bpCkEl('ck-t' + i);
        if (f && au.duration) f.style.width = (au.currentTime / au.duration * 100) + '%';
        if (t) t.textContent = bpCkFmt(au.currentTime) + ' / ' + bpCkFmt(au.duration);
      });
      au.addEventListener('play', function () { var p = bpCkEl('ck-p' + i); if (p) p.textContent = '⏸'; });
      au.addEventListener('pause', function () { var p = bpCkEl('ck-p' + i); if (p) p.textContent = '▶'; });
      au.addEventListener('ended', function () { var f = bpCkEl('ck-f' + i); if (f) f.style.width = '0%'; });
      btn.textContent = '▶';
      au.play().catch(function () {});   // bila diblokir browser, ketuk ▶ sekali lagi (data sudah tersimpan)
    }
    if (bp.ckData[r.fileId]) { mulai(bp.ckData[r.fileId]); return; }
    btn.textContent = '…';
    google.script.run
      .withSuccessHandler(function (d) { bp.ckData[r.fileId] = 'data:' + d.mime + ';base64,' + d.data; mulai(bp.ckData[r.fileId]); })
      .withFailureHandler(function (e) { btn.textContent = '▶'; var t = bpCkEl('ck-t' + i); if (t) { t.textContent = 'Gagal'; t.title = e && e.message ? e.message : ''; } console.error(e); })
      .getChoukaiAudio(r.fileId);
  }
  function bpCkSeek(ev, i) {
    var a = bp.ck[i]; if (!a || !a.duration) return;
    var rc = ev.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(1, Math.max(0, (ev.clientX - rc.left) / rc.width)) * a.duration;
  }
  function bpCkSpeed(i) {
    var urut = [1, 0.75, 0.5], now = bp.ckSpd[i] || 1;
    var nx = urut[(urut.indexOf(now) + 1) % urut.length];
    bp.ckSpd[i] = nx;
    var s = bpCkEl('ck-s' + i); if (s) s.textContent = nx + 'x';
    if (bp.ck[i]) bp.ck[i].playbackRate = nx;
  }
  function bpToggleTeks(i) {
    var el = document.getElementById('bp-tx' + i), bt = document.getElementById('bp-tb' + i);
    var buka = el.style.display === 'none';
    el.style.display = buka ? 'block' : 'none';
    bt.textContent = buka ? 'Sembunyikan Teks' : 'Lihat Teks';
  }
  /* ===== Rekap Bunpou Lainnya ===== */
  var RK_EMOJI = [
    [/kamus/, '📖'], [/masu|sopan/, '🌸'], [/nai|negatif/, '🚫'], [/\bte\b|te-?form|bentuk te/, '🔗'],
    [/\bta\b|lampau/, '⏪'], [/pasif/, '🔄'], [/kausatif|shieki/, '👆'], [/potensial/, '💪'],
    [/kondisional|\bba\b|tara|nara/, '🔀'], [/perintah|imperatif/, '📣'], [/larangan/, '⛔'],
    [/volisional|ajakan|\bou\b/, '🙌'], [/sifat|keiyou|adjektiva/, '🎨'], [/benda|meishi/, '📦']
  ];
  function bpRkEmoji(nama) {
    var s = String(nama || '').toLowerCase();
    for (var i = 0; i < RK_EMOJI.length; i++) if (RK_EMOJI[i][0].test(s)) return RK_EMOJI[i][1];
    return '📗';
  }

  function bpBukaRekap() {
    bp.view = 'rekap';
    if (typeof catatAktivitas === 'function') catatAktivitas('Bunpou', 'Rekap Bunpou Lainnya', true);
    if (bp.rekap) { bpRender(); return; }
    bpJudul('📋 Rekap Bunpou');
    bpBody().innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">Memuat rekap Bunpou...</div>';
    google.script.run
      .withSuccessHandler(function (d) { bp.rekap = d || []; bp.rkSel = 0; if (bp.view === 'rekap') bpRender(); })
      .withFailureHandler(function (e) { bpBody().innerHTML = '<div style="color:#dc2626;text-align:center;padding:20px;">Gagal memuat: ' + bpEsc(e.message) + '</div>'; })
      .getRekapBunpou();
  }

  function bpRenderRekap() {
    bpJudul('📋 Rekap Bunpou');
    var data = bp.rekap || [];
    if (!data.length) {
      bpBody().innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">Belum ada data. Isi sheet "Rekap Bunpou" di Spreadsheet.</div>';
      return;
    }
    // kelompokkan per jenis perubahan (urutan kemunculan di sheet)
    bp.rkGrup = [];
    var idx = {};
    data.forEach(function (r) {
      if (idx[r.ubah] === undefined) { idx[r.ubah] = bp.rkGrup.length; bp.rkGrup.push({ nama: r.ubah, isi: [] }); }
      bp.rkGrup[idx[r.ubah]].isi.push(r);
    });
    if (bp.rkSel >= bp.rkGrup.length) bp.rkSel = 0;
    var h = '<div class="rk-sticky"><div class="rk-tools"><div class="rk-furi' + (bp.furi ? ' on' : '') + '" id="rk-furi" onclick="bpRkFuri()">' + bpRkFuriLabel() + '</div></div>' +
            '<div class="rk-chips" id="rk-chips">';
    bp.rkGrup.forEach(function (g, i) {
      h += '<div class="rk-chip' + (i === bp.rkSel ? ' on' : '') + '" id="rk-c' + i + '" onclick="bpRkPilih(' + i + ')">' +
           bpRkEmoji(g.nama) + ' ' + bpEsc(g.nama) + ' <small>' + g.isi.length + '</small></div>';
    });
    h += '</div></div><div id="rk-list"></div>';
    bpBody().innerHTML = h;
    bpRkIsi();
    bpRkUkurHeader();
    window.scrollTo(0, 0);
  }

  function bpRkUkurHeader() {
    var pg = document.getElementById('bunpou-page'), hd = pg && pg.querySelector('.page-header');
    if (hd) pg.style.setProperty('--bp-hh', hd.offsetHeight + 'px');
  }
  window.addEventListener('resize', function () { if (bp.view === 'rekap') bpRkUkurHeader(); });

  function bpRkPilih(i) {
    if (i === bp.rkSel) return;
    var lama = document.getElementById('rk-c' + bp.rkSel), baru = document.getElementById('rk-c' + i);
    if (lama) lama.classList.remove('on');
    if (baru) { baru.classList.add('on'); if (baru.scrollIntoView) baru.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    bp.rkSel = i;
    if (typeof catatAktivitas === 'function') catatAktivitas('Bunpou', 'Rekap ' + bp.rkGrup[i].nama, true);
    bpRkIsi();
    window.scrollTo(0, 0);
  }

  function bpRkIsi() {
    var g = bp.rkGrup[bp.rkSel], h = '', materiTerakhir = null;
    bp.rkShow = g.isi;
    if (bp.furi && bp.kzState === 'loading') h += '<div class="rk-hint">Memuat kamus furigana di latar belakang... kalimat tetap bisa dibaca, furigana muncul begitu siap.</div>';
    else if (bp.furi && bp.kzState === 'error') h += '<div class="rk-hint err">Furigana otomatis gagal dimuat. Pastikan internet aktif, lalu matikan dan nyalakan lagi tombol Furigana.</div>';
    g.isi.forEach(function (r, i) {
      if (r.materi && r.materi !== materiTerakhir) { h += '<div class="rk-group">' + bpEsc(r.materi) + '</div>'; materiTerakhir = r.materi; }
      h += '<div class="rk-card"><div class="rk-top">' + (r.no ? '<span class="rk-no">' + bpEsc(r.no) + '</span>' : '') +
           '<span class="rk-bp">' + bpEsc(r.bunpou) + '</span></div>';
      if (r.arti) h += '<div class="rk-arti">' + bpEsc(r.arti) + '</div>';
      if (r.contoh) {
        var furi = bp.furi ? bpRkFuriHtml(r) : '';
        h += '<div class="rk-ex"><div style="flex:1"><div class="jp' + (furi ? ' furi' : '') + '">' + (furi || bpEsc(r.contoh)) + '</div>' +
             (r.artiContoh ? '<div class="id">' + bpEsc(r.artiContoh) + '</div>' : '') + '</div>' +
             '<button class="bp-say" onclick="event.stopPropagation();bpRkSay(' + i + ')">🔊</button></div>';
      }
      h += '</div>';
    });
    document.getElementById('rk-list').innerHTML = h;
  }

  /* --- Furigana: cocokkan cara baca (hiragana) ke tiap kelompok kanji, hasilnya <ruby> --- */
  var RK_KANJI = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF々〆]/;
  var RK_SKIP = /[、。，．,.!?！？「」『』（）()・：:；;～~…＋+＝=\-]/g;
  function bpRkKana(s, buangTanda) {
    s = String(s || '').replace(/\s+/g, '').replace(/[\u30A1-\u30F6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
    return buangTanda ? s.replace(RK_SKIP, '') : s;
  }

  function bpRkAlign(segs, i, R, pos) {          // -> array bacaan per kelompok kanji, atau null
    if (i >= segs.length) return pos === R.length ? [] : null;
    var s = segs[i];
    if (!s.k) {
      if (!s.m) return bpRkAlign(segs, i + 1, R, pos);
      if (R.substr(pos, s.m.length) !== s.m) return null;
      return bpRkAlign(segs, i + 1, R, pos + s.m.length);
    }
    var j = i + 1; while (j < segs.length && !segs[j].k && !segs[j].m) j++;     // lewati tanda baca
    var ends = [], p;
    if (j >= segs.length) { if (pos < R.length) ends.push(R.length); }
    else if (segs[j].k) {           // dua kelompok kanji tanpa pemisah di bacaan: urutkan dari panjang baca yang paling wajar (±2 kana per kanji)
      for (p = pos + 1; p < R.length; p++) ends.push(p);
      var ideal = pos + 2 * s.t.length;
      ends.sort(function (a, b) { return Math.abs(a - ideal) - Math.abs(b - ideal); });
    }
    else { for (p = R.indexOf(segs[j].m, pos + 1); p !== -1; p = R.indexOf(segs[j].m, p + 1)) ends.push(p); }
    for (var e = 0; e < ends.length; e++) {
      var rest = bpRkAlign(segs, i + 1, R, ends[e]);
      if (rest) return [R.slice(pos, ends[e])].concat(rest);
    }
    return null;
  }

  // Pecah kalimat jadi kelompok kanji / bukan kanji, lalu cocokkan dengan bacaan -> HTML <ruby>, atau null bila gagal
  function bpRkRuby(kalimat, baca) {
    var segs = [], buf = '', kj = null, k, c;
    for (k = 0; k < kalimat.length; k++) {
      c = kalimat.charAt(k);
      var isK = RK_KANJI.test(c);
      if (kj === null || kj !== isK) { if (buf) segs.push({ k: kj, t: buf }); buf = ''; kj = isK; }
      buf += c;
    }
    if (buf) segs.push({ k: kj, t: buf });
    var R, rd = null;
    for (var mode = 0; mode < 2 && !rd; mode++) {       // 0: tanda baca ikut dicocokkan, 1: tanda baca diabaikan
      segs.forEach(function (s) { if (!s.k) s.m = bpRkKana(s.t, mode === 1); });
      R = bpRkKana(baca, mode === 1);
      rd = R ? bpRkAlign(segs, 0, R, 0) : null;
    }
    if (!rd) return null;
    var n = 0;
    return segs.map(function (s) { return s.k ? '<ruby>' + bpEsc(s.t) + '<rt>' + bpEsc(rd[n++]) + '</rt></ruby>' : bpEsc(s.t); }).join('');
  }

  // Dari kolom "Furigana Contoh" (bila diisi di sheet)
  function bpRkJp(kalimat, baca) {
    return bpRkRuby(kalimat, baca) || (bpEsc(kalimat) + '<div class="rk-yomi">' + bpEsc(baca) + '</div>');
  }

  /* --- Furigana OTOMATIS: kamus kuromoji dimuat di Web Worker (latar belakang) sejak menu Bunpou dibuka --- */
  var KZ_SRC = [
    { js: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js', dic: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' },
    { js: 'https://unpkg.com/kuromoji@0.1.2/build/kuromoji.js', dic: 'https://unpkg.com/kuromoji@0.1.2/dict/' }
  ];
  var KZ_WORKER =
    "var S=null,tk=null;function init(i){if(i>=S.length){postMessage({t:'err'});return}" +
    "try{if(!self.kuromoji)importScripts(S[i].js);kuromoji.builder({dicPath:S[i].dic}).build(function(e,t){if(e||!t){init(i+1);return}tk=t;postMessage({t:'ready'})})}catch(x){init(i+1)}}" +
    "onmessage=function(e){var m=e.data;if(m.t==='init'){S=m.src;init(0)}else if(m.t==='tok'){var o=m.items.map(function(s){try{return tk.tokenize(s).map(function(x){return [x.surface_form,x.reading]})}catch(x){return null}});postMessage({t:'res',items:m.items,out:o})}};";

  function bpRkUpdTombol() { var b = document.getElementById('rk-furi'); if (b) b.textContent = bpRkFuriLabel(); }
  function bpRkRefresh() {
    bpRkUpdTombol();
    if (bp.view === 'rekap' && document.getElementById('rk-list')) bpRkIsi();
  }
  function bpRkSiap() { bp.kzState = 'ready'; bpRkMinta(); bpRkRefresh(); }
  function bpRkGagal() {
    bp.kzState = 'error';
    if (bp.kw) { try { bp.kw.terminate(); } catch (e) {} bp.kw = null; }
    bpRkRefresh();
  }

  function bpRkSiapkan() {
    if (bp.kzState === 'loading' || bp.kzState === 'ready') return;
    bp.kzState = 'loading'; bpRkUpdTombol();
    try {
      bp.kw = new Worker(URL.createObjectURL(new Blob([KZ_WORKER], { type: 'application/javascript' })));
      bp.kw.onmessage = function (e) {
        var m = e.data;
        if (m.t === 'ready') bpRkSiap();
        else if (m.t === 'err') bpRkGagal();
        else if (m.t === 'res') {
          m.items.forEach(function (x, i) { delete bp.kzPend[x]; if (m.out[i]) bp.kc[x] = m.out[i]; });
          bpRkRefresh();
        }
      };
      bp.kw.onerror = function () { if (bp.kzState === 'loading') { bp.kw = null; bpRkMuatUtama(0); } };
      bp.kw.postMessage({ t: 'init', src: KZ_SRC });
    } catch (e) { bp.kw = null; bpRkMuatUtama(0); }
  }

  function bpRkMuatUtama(i) {      // cadangan bila Web Worker tidak didukung: muat di halaman utama
    if (i >= KZ_SRC.length) { bpRkGagal(); return; }
    function berikut() { bpRkMuatUtama(i + 1); }
    function bangun() {
      try {
        kuromoji.builder({ dicPath: KZ_SRC[i].dic }).build(function (err, t) {
          if (err || !t) { berikut(); return; }
          bp.kt = t; bpRkSiap();
        });
      } catch (e) { berikut(); }
    }
    if (window.kuromoji) { bangun(); return; }
    var s = document.createElement('script');
    s.src = KZ_SRC[i].js; s.onload = bangun; s.onerror = berikut;
    document.head.appendChild(s);
  }

  // minta bacaan untuk semua kalimat contoh yang belum punya (sekali jalan, bukan per chip)
  function bpRkMinta() {
    if (bp.kzState !== 'ready' || !bp.rekap) return;
    var items = [], seen = {};
    bp.rekap.forEach(function (r) {
      var k = r.contoh;
      if (k && !r.furi && !bp.kc[k] && !bp.kzPend[k] && !seen[k]) { seen[k] = 1; items.push(k); }
    });
    if (!items.length) return;
    if (bp.kw) { items.forEach(function (k) { bp.kzPend[k] = 1; }); bp.kw.postMessage({ t: 'tok', items: items }); return; }
    if (bp.kt) {
      items.forEach(function (k) {
        try { bp.kc[k] = bp.kt.tokenize(k).map(function (y) { return [y.surface_form, y.reading]; }); } catch (e) {}
      });
      bpRkRefresh();
    }
  }

  function bpRkAuto(kalimat) {
    var toks = bp.kc[kalimat];
    if (!toks) return '';
    if (bp.rkAuto[kalimat] !== undefined) return bp.rkAuto[kalimat];
    var out = '';
    toks.forEach(function (t) {
      var s = t[0], baca = (t[1] && t[1] !== '*') ? t[1] : '';
      if (!RK_KANJI.test(s) || !baca) { out += bpEsc(s); return; }
      if (s.indexOf('日本') === 0) baca = baca.replace(/^ニッポン/, 'ニホン');      // buku pelajaran memakai にほん
      out += bpRkRuby(s, baca) || ('<ruby>' + bpEsc(s) + '<rt>' + bpEsc(bpRkKana(baca)) + '</rt></ruby>');
    });
    bp.rkAuto[kalimat] = out;
    return out;
  }

  // Prioritas: kolom "Furigana Contoh" di sheet (bila ada) -> furigana otomatis -> kosong (tampil kanji saja)
  function bpRkFuriHtml(r) {
    if (r.furi) return bpRkJp(r.contoh, r.furi);
    if (bp.kzState === 'ready') return bpRkAuto(r.contoh);
    return '';
  }

  function bpRkFuriLabel() {
    return 'Furigana : ' + (bp.furi ? 'On' : 'Off') + (bp.furi && bp.kzState === 'loading' ? ' …' : '');
  }

  function bpRkFuri() {
    bp.furi = !bp.furi;
    var b = document.getElementById('rk-furi');
    if (b) b.classList.toggle('on', bp.furi);
    if (bp.furi) {
      if (bp.kzState === 'error') bp.kzState = 'idle';      // coba lagi
      bpRkSiapkan(); bpRkMinta();
    }
    bpRkUpdTombol();
    bpRkIsi();
  }

  function bpRkSay(i) {
    var r = bp.rkShow[i]; if (!r || !r.contoh) return;
    bacaJepang(r.contoh);
  }

  function bpMulai(i) { bp.idx = i; bp.step = 0; bp.view = 'belajar'; bpRenderBelajar(); }

  function bpRumusHtml(t) {
    return String(t).split(/\s+/).map(function (w) {
      return BP_PART.indexOf(w) > -1 ? '<span class="bp-part">' + bpEsc(w) + '</span>' : bpEsc(w);
    }).join(' ');
  }

  function bpSay(i) {
    var c = bp.list[bp.idx].contoh[i]; if (!c) return;
    bacaJepang(c.jp);
  }

  function bpRenderBelajar() {
    var r = bp.list[bp.idx], h = '';
    bpJudul(r.judul);
    h += '<div class="bp-dots">';
    for (var s = 0; s < 4; s++) h += '<div class="bp-dot' + (s <= bp.step ? ' on' : '') + '"></div>';
    h += '</div>';

    if (bp.step === 0) {
      h += '<div class="bp-rumus">' + bpRumusHtml(r.rumus) + '</div>';
      var adaPartikel = String(r.rumus).split(/\s+/).some(function (w) { return BP_PART.indexOf(w) > -1; });
      var ket = r.ket || (adaPartikel ? 'Kata berwarna merah adalah partikel, penentu arti kalimat.' : 'Perhatikan susunan pola ini, lalu lanjut ke penjelasannya.');
      h += '<div class="bp-box"><b>Lihat polanya dulu.</b> ' + bpEsc(ket).replace(/\n/g, '<br>') + '</div>';
    } else if (bp.step === 1) {
      h += '<div class="bp-box">💡 ' + bpEsc(r.penjelasan).replace(/\n/g, '<br>') + '</div>';
      (r.gambar || []).forEach(function (g) {
        h += '<img class="bp-img" loading="lazy" src="' + bpEsc(g) + '" onerror="this.outerHTML=\'<div class=bp-imgerr>Gambar tidak bisa dimuat</div>\'">';
      });
      if (r.tips) h += '<div class="bp-box bp-tip">✨ <b>Trik:</b> ' + bpEsc(r.tips) + '</div>';
      if (r.salah) h += '<div class="bp-box bp-warn">⚠️ <b>Salah kaprah:</b> ' + bpEsc(r.salah) + '</div>';
    } else if (bp.step === 2) {
      h += '<div style="text-align:center;font-size:12px;color:#6b7280;margin-bottom:8px;">Ketuk 🔊 untuk mendengar kalimatnya</div>';
      r.contoh.forEach(function (c, i) {
        h += '<div class="bp-box bp-ex"><div style="flex:1"><div class="jp">' + bpEsc(c.jp) + '</div>' + (c.id ? '<div class="id">' + bpEsc(c.id) + '</div>' : '') + '</div>';
        h += '<button class="bp-say" onclick="event.stopPropagation();bpSay(' + i + ')">🔊</button></div>';
      });
    } else {
      bpBuatQuiz(r); bpRenderQuiz(); return;
    }

    h += '<div class="bp-nav">';
    if (bp.step > 0) h += '<button style="background:#94a3b8" onclick="bp.step--;bpRenderBelajar()">‹ Kembali</button>';
    h += '<button style="background:#10b981" onclick="bp.step++;bpRenderBelajar()">' + (bp.step === 2 ? 'Uji Aku ✍️' : 'Lanjut ›') + '</button></div>';
    bpBody().innerHTML = h;
    window.scrollTo(0, 0);
  }

  /* ===== Latihan ===== */
  function bpBuatQuiz(r) {
    bp.q = []; bp.qi = 0; bp.skor = 0;
    var T = r.tes, adaTes = !!(T && (T.t1 || T.t2 || T.t3));

    // (a) Susun kalimat lama dari Contoh 1: hanya dipakai bila belum ada data Tes baru
    if (!adaTes) {
      var c1 = r.contoh[0];
      if (c1) {
        var w = c1.jp.split(/\s+/);
        if (w.length >= 3) bp.q.push({ t: 'susun', w: w, acak: bpAcak(w), pilih: [] });
      }
    }

    // (b) Pilihan ganda lama: kolom Latihan 1, Latihan 2, ...
    r.latihan.forEach(function (l, li) {
      var p = l.split('|').map(function (x) { return x.trim(); });
      if (p.length < 3) return;
      var salah = p[2].split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x && x !== p[1]; });
      salah = bpAcak(salah).slice(0, 3);
      if (BP_PART.indexOf(p[1]) > -1) {
        bpAcak(BP_PART).forEach(function (x) {
          if (salah.length < 3 && x !== p[1] && salah.indexOf(x) === -1) salah.push(x);
        });
      }
      bp.q.push({ t: 'pilih', k: p[0], j: p[1], h: (r.hira && r.hira[li]) || '', opsi: bpAcak([p[1]].concat(salah)), sudah: false });
    });

    // (c) Tes baru dari sheet: Tes 1 (ketik), Tes 2 (susun), Tes 3 (cari kesalahan)
    if (adaTes) {
      if (T.t1) bp.q.push({ t: 'ketik', k: T.t1.soal, j: T.t1.jawab, arti: T.t1.arti, sudah: false });
      if (T.t2) bp.q.push({ t: 'susun', w: T.t2.benar, acak: bpAcak(T.t2.benar.concat(T.t2.pengecoh)), pilih: [], arti: T.t2.arti, tes: true });
      if (T.t3) bp.q.push({ t: 'cari', tok: T.t3.tokens, idx: T.t3.idx, fix: T.t3.perbaikan, benar: T.t3.benar, arti: T.t3.arti, sudah: false });
    }
  }

  function bpKosong(s) { return bpEsc(s).replace(/[＿_]{2,}/g, '<span class="bp-blank">＿＿</span>'); }
  function bpNorm(s) { return String(s || '').replace(/\s+/g, '').replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
  function bpIngat() {
    var r = bp.list[bp.idx], h = '<div class="bp-cat">Ingat: ' + bpEsc(r.rumus) + '</div>';
    if (r.catatan) h += '<div class="bp-cat">' + bpEsc(r.catatan) + '</div>';
    return h;
  }

  function bpRenderQuiz() {
    var r = bp.list[bp.idx], q = bp.q[bp.qi], h = '';
    if (!q) { bpHasil(); return; }
    h += '<div class="bp-dots"><div class="bp-dot on"></div><div class="bp-dot on"></div><div class="bp-dot on"></div><div class="bp-dot on"></div></div>';
    h += '<div style="text-align:center;font-size:12px;color:#6b7280;margin-bottom:6px;">Soal ' + (bp.qi + 1) + ' dari ' + bp.q.length + '</div>';
    if (q.t === 'ketik') {
      h += '<div class="bp-box" style="text-align:center;font-size:20px;font-weight:600;">' + bpKosong(q.k) + (q.arti ? '<div style="font-size:13px;font-weight:500;color:#059669;margin-top:6px;">' + bpEsc(q.arti) + '</div>' : '') + '</div>';
      h += '<div class="bp-inwrap"><input id="bp-inp" class="bp-input" type="text" placeholder="Ketik jawabannya" autocomplete="off" autocapitalize="off" onkeydown="if(event.key===\'Enter\')bpCekKetik()"></div>';
      h += '<div class="bp-nav"><button style="background:#10b981" onclick="bpCekKetik()">Cek ✔️</button></div>';
    } else if (q.t === 'cari') {
      h += '<div class="bp-box" style="text-align:center;">Ketuk bagian kalimat yang <b>salah</b>.' + (q.arti ? '<div style="color:#059669;margin-top:4px;">Arti: ' + bpEsc(q.arti) + '</div>' : '') + '</div>';
      h += '<div class="bp-chips" id="bp-tok">';
      q.tok.forEach(function (x, i) { h += '<span class="bp-chip tk" id="bp-t' + i + '" onclick="bpCari(' + i + ')">' + bpEsc(x) + '</span>'; });
      h += '</div>';
    } else if (q.t === 'pilih') {
      h += '<div class="bp-box" style="text-align:center;font-size:18px;font-weight:600;">' + bpKosong(q.k) + (q.h ? '<div class="bp-hira">' + bpKosong(q.h) + '</div>' : '') + '</div>';
      h += '<div class="bp-grid">';
      q.opsi.forEach(function (o, i) { h += '<button class="bp-opt menu-btn" id="bp-o' + i + '" onclick="bpJawab(' + i + ')">' + bpEsc(o) + '</button>'; });
      h += '</div>';
    } else {
      h += '<div class="bp-box" style="text-align:center;">Susun menjadi kalimat yang benar:' + (q.arti ? '<div style="color:#059669;margin-top:4px;">' + bpEsc(q.arti) + '</div>' : '') + (q.tes ? '<div style="font-size:12px;color:#6b7280;margin-top:4px;">Ada kepingan pengecoh.</div>' : '') + '</div>';
      h += '<div class="bp-chips ans" id="bp-ans">';
      q.pilih.forEach(function (x, i) { h += '<span class="bp-chip" onclick="bpLepas(' + i + ')">' + bpEsc(x) + '</span>'; });
      h += '</div><div class="bp-chips">';
      q.acak.forEach(function (x, i) { h += '<span class="bp-chip" style="' + (q.dipakai && q.dipakai[i] ? 'opacity:.25;pointer-events:none;' : '') + '" onclick="bpPasang(' + i + ')">' + bpEsc(x) + '</span>'; });
      h += '</div><div class="bp-nav"><button style="background:#94a3b8" onclick="bpResetSusun()">Reset ↺</button><button style="background:#3b82f6" onclick="bpCekSusun()">Cek ✔️</button></div>';
    }
    h += '<div id="bp-fb" class="bp-fb"></div><div id="bp-next" class="bp-nav"></div>';
    bpBody().innerHTML = h;
  }

  function bpLanjutBtn() {
    document.getElementById('bp-next').innerHTML = '<button style="background:#10b981" onclick="bp.qi++;bpRenderQuiz()">' + (bp.qi + 1 >= bp.q.length ? 'Lihat Hasil 🎉' : 'Soal berikutnya ›') + '</button>';
  }

  function bpJawab(i) {
    var q = bp.q[bp.qi]; if (q.sudah) return; q.sudah = true;
    var benar = q.opsi[i] === q.j;
    if (benar) bp.skor++;
    q.opsi.forEach(function (o, k) { var el = document.getElementById('bp-o' + k); if (o === q.j) el.classList.add('ok'); else if (k === i) el.classList.add('no'); });
    var fb = document.getElementById('bp-fb');
    fb.style.color = benar ? '#059669' : '#dc2626';
    fb.innerHTML = benar ? '✅ Benar!' : '❌ Jawaban yang benar: ' + bpEsc(q.j) + bpIngat();
    bpLanjutBtn();
  }

  function bpPasang(i) { var q = bp.q[bp.qi]; q.dipakai = q.dipakai || {}; q.dipakai[i] = true; q.pilih.push(q.acak[i]); q.urut = (q.urut || []); q.urut.push(i); bpRenderQuiz(); }
  function bpLepas(i) { var q = bp.q[bp.qi]; var idx = q.urut.splice(i, 1)[0]; q.pilih.splice(i, 1); q.dipakai[idx] = false; bpRenderQuiz(); }
  function bpResetSusun() {
    var q = bp.q[bp.qi];
    if (q.sudah) return;
    q.pilih = []; q.urut = []; q.dipakai = {};
    bpRenderQuiz();
  }
  function bpCekSusun() {
    var q = bp.q[bp.qi]; if (q.sudah) return;
    if (!q.tes && q.pilih.length < q.w.length) { document.getElementById('bp-fb').innerHTML = 'Susun semua kata dulu ya 🙂'; return; }
    if (q.tes && q.pilih.length === 0) { document.getElementById('bp-fb').innerHTML = 'Susun kata dulu ya 🙂'; return; }
    q.sudah = true;
    var sp = q.tes ? '' : ' ';
    var benar = q.pilih.join('|') === q.w.join('|');
    if (benar) bp.skor++;
    var fb = document.getElementById('bp-fb');
    fb.style.color = benar ? '#059669' : '#dc2626';
    fb.innerHTML = benar ? '✅ Benar!' + (q.tes ? bpIngat() : '') : '❌ Urutan yang benar:<div style="font-size:17px;margin-top:4px;">' + bpEsc(q.w.join(sp)) + '</div>' + (q.tes ? bpIngat() : '');
    bpLanjutBtn();
  }

  function bpCekKetik() {
    var q = bp.q[bp.qi]; if (q.sudah) return;
    var inp = document.getElementById('bp-inp'), fb = document.getElementById('bp-fb');
    var v = bpNorm(inp.value);
    if (!v) { fb.style.color = '#dc2626'; fb.innerHTML = 'Ketik jawabannya dulu ya 🙂'; return; }
    q.sudah = true; inp.disabled = true;
    var benar = q.j.some(function (a) { return bpNorm(a) === v; });
    if (benar) bp.skor++;
    fb.style.color = benar ? '#059669' : '#dc2626';
    fb.innerHTML = (benar ? '✅ Benar!' : '❌ Jawaban yang benar: ' + bpEsc(q.j.join(' / '))) + bpIngat();
    bpLanjutBtn();
  }

  function bpCari(i) {
    var q = bp.q[bp.qi]; if (q.sudah) return; q.sudah = true;
    var benar = i === q.idx;
    if (benar) bp.skor++;
    document.getElementById('bp-t' + q.idx).classList.add('ok');
    if (!benar) document.getElementById('bp-t' + i).classList.add('no');
    var fb = document.getElementById('bp-fb');
    fb.style.color = benar ? '#059669' : '#dc2626';
    fb.innerHTML = (benar ? '✅ Benar!' : '❌ Bukan itu.') + '<div style="font-size:16px;margin-top:4px;">' + bpEsc(q.tok[q.idx]) + ' → ' + bpEsc(q.fix) + '</div><div style="font-weight:500;font-size:15px;margin-top:2px;">' + bpEsc(q.benar) + '</div>' + bpIngat();
    bpLanjutBtn();
  }

  function bpHasil() {
    var r = bp.list[bp.idx], total = bp.q.length, lulus = total === 0 || bp.skor / total >= 0.6;
    if (lulus) {
      bp.done[bpKey(r)] = true;
      if (typeof questCatatBunpou === 'function') questCatatBunpou(bpKey(r));
      try { google.script.run.withFailureHandler(function () {}).simpanBunpouSelesai(studentName, JSON.stringify(Object.keys(bp.done))); } catch (e) {}
    }
    bpBody().innerHTML =
      '<div class="bp-box" style="text-align:center;"><div style="font-size:42px;">' + (lulus ? '🎉' : '💪') + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:#065f46;">Skor: ' + bp.skor + ' / ' + total + '</div>' +
      '<div style="color:#6b7280;margin-top:6px;">' + (lulus ? 'Pola ini selesai ⭐' : 'Sedikit lagi! Baca ulang penjelasannya lalu coba lagi.') + '</div></div>' +
      '<div class="bp-nav"><button style="background:#94a3b8" onclick="bpMulai(bp.idx)">Ulangi ↺</button>' +
      '<button style="background:#10b981" onclick="bp.view=\'pola\';bpRender()">Daftar Pola ›</button></div>';
  }