/* =========================================================
   VERSENYMOTOR – app.js  (telefonos felület)
   Nézetek: Kör · Állás · Menetrend · (admin) Vezérlő · Beállítás
   ========================================================= */
(function () {
  'use strict';
  var L = window.Logika, SB = window.Sablonok, SR = window.Sorsolo;
  var API = (window.KUPA_CONFIG || {}).API_URL || '';
  var $app = document.getElementById('app');
  var FRISSITES_MS = 5000, HATTER_FRISSITES_MS = 15000;

  // ---- Állapot ----
  var A = {
    szerver: null, offset: 0, kapcsolat: true,
    kod: tarOlvas('vm_kod'), en: null, kodHibas: false,
    pin: tarOlvas('vm_pin'), admin: false, pinKell: false,
    nezet: 'kor', allasFul: 'csapat', menetrendKor: null, adminKor: null,
    urlap: null, javit: null, kodok: null, hang: false, wakeLock: null, utolsoFazis: {},
    uzenet: null, kuld: false,
    V: null, lepes: 1, szerkJatek: null, sorsolt: null, sorsolasFut: false, sablonok: null,
    pihenVaz: {}, agSzakasz: null
  };

  // ---- Segédek ----
  function tarOlvas(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function tarIr(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function most() { return Date.now() + A.offset; }
  function ido(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); var p = Math.floor(s / 60); s = s % 60; return (p < 10 ? '0' : '') + p + ':' + (s < 10 ? '0' : '') + s; }
  function cfg() { return A.szerver ? A.szerver.config : null; }
  function szamF(x) { return String(x).replace('.', ','); }
  function masol(x) { return JSON.parse(JSON.stringify(x)); }
  function K() { return L.egysegSzam(cfg().beallit); }
  function meccsek() { return L.meccsLista(cfg(), A.szerver.beirasok); }
  function keres(id) { return L.meccsKeres(cfg(), id, A.szerver.beirasok); }
  function utolsok() { return L.utolsoBeirasok(A.szerver.beirasok); }
  function jatek(id) { return L.jatekTar(cfg())[id]; }
  function egysegSzo(beallit) { var K2 = L.egysegSzam(beallit); if (K2 === 1) return Number(beallit.meret) === 1 ? 'játékos' : 'csapat'; return Number(beallit.bontas) === 3 ? 'hármas' : 'pár'; }
  function nevTag(o) {
    var t = L.tagNevek(cfg(), o);
    return '<b>' + esc(L.oldalNev(cfg(), o)) + '</b>' + (t && !(Number(cfg().beallit.meret) === 1) ? '<span class="tagok" style="display:block">' + esc(t) + '</span>' : '');
  }
  function palyaSzoveg(m) { return m.jatek && !m.egyszerre && Number(m.jatek.palyak) > 1 ? ' · ' + (m.palya + 1) + '. pálya' : ''; }
  function sajatCsapat() { return A.en && A.en.tipus === 'u' ? Math.floor(A.en.azon / K()) : null; }
  function sajatOldalE(o) { return A.en && A.en.tipus === 'u' && (o === 'u' + A.en.azon || o === 't' + sajatCsapat()); }

  // ---- Hálózat ----
  function vanApi() { return API && API.indexOf('IDE_JON') !== 0; }
  function lekeres() {
    if (!vanApi()) { render(true); return Promise.resolve(); }
    var t0 = Date.now();
    var url = API + '?action=state' + (A.kod && !A.en && !A.kodHibas ? '&k=' + encodeURIComponent(A.kod) : '');
    return fetch(url).then(function (r) { return r.json(); }).then(function (v) {
      if (!v.ok) throw new Error(v.hiba || 'Szerverhiba');
      A.offset = v.most - (t0 + Date.now()) / 2;
      if (v.en !== undefined) { if (v.en === null) { if (v.config.allapot === 'fut') A.kodHibas = true; } else A.en = v.en; }
      if (A.en && v.config.allapot !== 'fut') A.en = null;   // törlés után a régi kód érvénytelen
      A.szerver = { config: v.config, beirasok: v.beirasok };
      A.kapcsolat = true;
      render(false);
    }).catch(function () { A.kapcsolat = false; render(false); });
  }
  function kuld(body) {
    A.kuld = true; render(true);
    return fetch(API, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (v) { A.kuld = false; if (!v.ok) throw new Error(v.hiba || 'Szerverhiba'); return v; })
      .catch(function (e) { A.kuld = false; A.uzenet = { tipus: 'hiba', szoveg: e.message || 'Nincs kapcsolat' }; render(true); throw e; });
  }
  function siker(sz) { A.uzenet = { tipus: 'ok', szoveg: sz }; setTimeout(function () { if (A.uzenet && A.uzenet.szoveg === sz) { A.uzenet = null; render(false); } }, 2500); }

  // ---- Hang, rezgés, ébren tartás ----
  var audio = null;
  function hangBe() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) {} A.hang = true; ebrenTart(); csipog(880, 0.15, 0); }
  function ebrenTart() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (w) { A.wakeLock = w; w.addEventListener('release', function () { A.wakeLock = null; }); }).catch(function () {});
  }
  function csipog(frek, hossz, kes) {
    if (!audio) return;
    try {
      var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + kes;
      o.frequency.value = frek; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + hossz);
      o.start(t); o.stop(t + hossz + 0.05);
    } catch (e) {}
  }
  function jelez(tipus) {
    if (tipus === 'ket') { csipog(880, 0.2, 0); csipog(880, 0.2, 0.3); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
    else { csipog(660, 0.5, 0); csipog(660, 0.5, 0.7); csipog(440, 0.9, 1.4); if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 800]); }
    var o = document.getElementById('ora'); if (o) { o.classList.remove('villan'); void o.offsetWidth; o.classList.add('villan'); }
  }

  // ---- Óra ----
  function oraAllapot() {
    var c = cfg();
    if (!c || c.allapot !== 'fut' || !c.kor) return null;
    if (!idoMeresE(c.beallit)) return null;   // időmérés kikapcsolva: nincs óra
    var h = L.hatraLevo(c, most()), kor = c.menetrend[c.kor - 1];
    var fazis = c.korLezarva || h <= 0 ? 'lejart' : h <= 120000 ? 'ket' : 'fut';
    var cim = kor.tipus === 'egyszerre' ? (jatek(kor.jatek) || {}).nev + ' · ' + c.kor + '. kör' : (kor.szakasz && kor.szakasz !== 'Csoportkör' ? kor.szakasz + ' · ' : '') + c.kor + '. KÖR / ' + c.menetrend.length;
    var felirat = c.korLezarva ? 'A KÖR VÉGET ÉRT' : c.szunetKezd ? 'SZÜNET' : h <= 0 ? 'LEJÁRT AZ IDŐ' : h <= 120000 ? 'MÉG 2 PERC!' : cim.toUpperCase();
    return { h: h, fazis: fazis, felirat: felirat, arany: Math.max(0, Math.min(1, h / (kor.perc * 60000))), perc: kor.perc };
  }
  function tick() {
    var o = oraAllapot();
    if (!o) return;
    var c = cfg(), kulcs = String(c.kor), elozo = A.utolsoFazis[kulcs];
    if (elozo && elozo !== o.fazis && !c.szunetKezd) { if (o.fazis === 'ket' && elozo === 'fut') jelez('ket'); if (o.fazis === 'lejart') jelez('vege'); }
    A.utolsoFazis[kulcs] = o.fazis;
    var el = document.getElementById('ora');
    if (!el) return;
    el.className = 'ora' + (o.fazis === 'ket' ? ' figyel' : o.fazis === 'lejart' ? ' lejart' : '') + (el.classList.contains('villan') ? ' villan' : '');
    document.getElementById('ora-ido').textContent = ido(o.h);
    document.getElementById('ora-felirat').textContent = o.felirat;
    document.getElementById('ora-csik').style.width = (o.arany * 100) + '%';
  }
  // Időmérés Be/Ki (a régi beállításoknál nincs mező → bekapcsolva)
  function idoMeresE(b) { return !b || b.idomeres !== false; }
  // Óra nélküli kör-sáv: csak a kör sorszáma, visszaszámlálás nélkül
  function korSavHtml() {
    var c = cfg();
    if (!c || c.allapot !== 'fut' || !c.kor || idoMeresE(c.beallit)) return '';
    var kor = c.menetrend[c.kor - 1];
    var cim = kor.tipus === 'egyszerre' ? (jatek(kor.jatek) || {}).nev + ' · ' + c.kor + '. kör' : (kor.szakasz && kor.szakasz !== 'Csoportkör' ? kor.szakasz + ' · ' : '') + c.kor + '. KÖR / ' + c.menetrend.length;
    return '<div class="ora"><span class="ido" style="font-size:40px;text-align:center">' + esc(cim.toUpperCase()) + '</span>' +
      '<span style="font-size:12px;margin-top:4px">a kört a szervező indítja és zárja</span></div>';
  }
  function oraHtml() {
    var o = oraAllapot();
    if (!o) return korSavHtml();
    return '<div id="ora" class="ora"><span id="ora-felirat" class="kicsi" style="color:inherit">' + esc(o.felirat) + '</span>' +
      '<span id="ora-ido" class="ido">' + ido(o.h) + '</span><div class="csik"><div id="ora-csik" style="width:' + (o.arany * 100) + '%"></div></div>' +
      '<span style="font-size:12px;margin-top:4px">' + o.perc + ' perces kör · a szervező indítja</span></div>';
  }

  // ---- Renderelés ----
  function render(kenyszer) {
    var f = document.activeElement;
    if (!kenyszer && f && (f.tagName === 'INPUT' || f.tagName === 'SELECT') && $app.contains(f)) return;
    $app.innerHTML = nezetHtml();
    tick();
    if (A.nezet === 'vezerlo' && A.kodok) qrRajzol();
  }
  function nezetHtml() {
    if (!vanApi()) return '<div class="uzenet hiba">Nincs beállítva a szerver címe a config.js fájlban.</div>';
    if (!A.szerver) return A.kapcsolat ? '<div class="betolt">Betöltés…</div>' : '<div class="uzenet hiba">Nem érem el a szervert. Újrapróbálom…</div>';
    var h = fejHtml();
    if (!A.kapcsolat) h += '<div class="uzenet hiba">Nincs kapcsolat – újrapróbálom…</div>';
    if (A.uzenet) h += '<div class="uzenet ' + A.uzenet.tipus + '" data-akcio="uzenetBe">' + esc(A.uzenet.szoveg) + '</div>';
    if (A.pinKell) return h + pinHtml();
    if (A.urlap) return h + urlapHtml();
    if (A.javit) return h + javitHtml() + menuHtml();
    if (A.nezet === 'allas') h += allasHtml();
    else if (A.nezet === 'menetrend') h += menetrendHtml();
    else if (A.nezet === 'vezerlo' && A.admin) h += vezerloHtml();
    else if (A.nezet === 'beallitas' && A.admin) h += beallitasHtml();
    else if (A.nezet === 'modosit' && A.admin && A.M) h += modositHtml();
    else h += korHtml();
    return h + menuHtml();
  }
  function fejHtml() {
    var c = cfg(), jobb = '';
    if (A.admin) jobb = '<span class="cimke arany">ADMIN</span>';
    else if (A.en && A.en.tipus === 'b' && jatek(A.en.azon)) jobb = '<span class="cimke keret">BÍRÓ · ' + esc(jatek(A.en.azon).nev) + '</span>';
    else if (A.en && A.en.tipus === 'u' && c.csapatok.length) jobb = '<span class="cimke keret">' + esc(L.oldalRovidNev(c, 'u' + A.en.azon)) + '</span>';
    return '<div class="fej"><div class="logo">' + esc((c.nev || 'Versenymotor').toUpperCase()) + '</div>' + jobb + '</div>';
  }
  function menuHtml() {
    var c = cfg(), g = [['kor', 'Kör'], ['allas', 'Állás'], ['menetrend', 'Menetrend']];
    if (A.admin) { g.push(['vezerlo', 'Vezérlő']); if (c.allapot !== 'fut') g.push(['beallitas', 'Beállítás']); }
    return '<nav class="menu"><div>' + g.map(function (x) { return '<button data-akcio="nezet" data-ertek="' + x[0] + '" class="' + (A.nezet === x[0] ? 'akt' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></nav>';
  }
  function allapotCimke(st, m) {
    if (st.allapot === 'ok') return '<span class="cimke ok">' + (st.admin ? '✓ szervező döntött' : m.jatek.tipus === 'pontgyujto' ? '✓ beírva' : '✓ elfogadva') + '</span>';
    if (st.allapot === 'utkozes') return '<span class="cimke hiba">ütközés</span>';
    if (st.allapot === 'felig') return '<span class="cimke var">1/2 beírva</span>';
    return '<span class="cimke ures">' + (st.fuggo ? 'még nem dőlt el' : 'nincs beírva') + '</span>';
  }

  // ---- Eredmény szövegesen ----
  function adatSzoveg(j, d) {
    if (!d) return '–';
    var e = j.eredmeny || {};
    if (j.tipus === 'pontgyujto') return d.sz + (e.mod === 'helyezes' ? '. hely' : ' pont');
    if (e.mod === 'gyd') return { gy: 'nyert', v: 'vesztett', d: 'döntetlen' }[d.e] + (e.szam ? ', ' + d.sz + ' (' + (e.szam.cimke || 'szám') + ')' : '');
    if (e.mod === 'cel') return e.irany === 'le' ? (d.sz === 0 ? 'kiszállt (0)' : d.sz + ' maradt') : d.sz + ' pont';
    if (e.mod === 'tobb') return d.sz + ' pont, ' + (d.kesz ? 'befejezve' : 'lejárt az idő');
    return '';
  }
  // p: kinek a szemszögéből (oldal), vagy semleges
  function osszegzes(m, st, p) {
    var j = m.jatek;
    if (j.tipus === 'pontgyujto') return st.allapot === 'ok' ? st.sz + ((j.eredmeny || {}).mod === 'helyezes' ? '. hely' : ' pont') : '';
    if (!st.da || !st.db) return st.admin ? (st.gyoztes === 'd' ? 'döntetlen' : L.oldalRovidNev(cfg(), m.oldalak[st.gyoztes === 'a' ? 0 : 1]) + ' nyert') : '';
    var fordit = p !== undefined && p === m.oldalak[1], x = fordit ? st.db : st.da, y = fordit ? st.da : st.db, e = j.eredmeny, s;
    if (e.mod === 'gyd') s = e.szam ? x.sz + ' : ' + y.sz : '';
    else if (e.mod === 'cel' && e.irany === 'le') s = 'maradt ' + x.sz + ' : ' + y.sz;
    else s = x.sz + ' : ' + y.sz + (e.mod === 'tobb' && !(x.kesz && y.kesz) ? ' (idő)' : '');
    if (st.allapot === 'ok') {
      var g = st.gyoztes, t;
      if (g === 'd') t = 'döntetlen';
      else if (p === undefined) t = L.oldalRovidNev(cfg(), m.oldalak[g === 'a' ? 0 : 1]) + ' nyert';
      else t = (g === 'a') !== fordit ? 'győzelem' : 'vereség';
      s = s ? s + ' – ' + t : t;
    }
    return s;
  }

  // =========================================================
  // KÖR nézet
  // =========================================================
  function korHtml() { return korTartalom() + (A.admin ? '' : '<button class="gomb" data-akcio="adminBelep" style="align-self:center;background:transparent;color:var(--halvany);text-decoration:underline;font-family:Inter,sans-serif;font-weight:600;font-size:14px">Szervezői belépés</button>'); }
  function korTartalom() {
    var c = cfg(), h = '';
    if (c.allapot !== 'fut') return '<div class="sotet"><h2>A verseny még nem kezdődött el</h2><span class="halv">Amint a szervező elindítja, itt látjátok a köröket.</span></div>';
    if (!A.hang) h += '<button class="gomb masod szeles" data-akcio="hangBe">Hang és ébren tartás bekapcsolása</button>';
    h += c.kor ? oraHtml() : '<div class="sotet"><h2>Hamarosan kezdünk</h2><span class="halv">Az 1. kört a szervező indítja.</span></div>';
    if (A.kodHibas) h += '<div class="uzenet hiba">Ez a kód nem érvényes. Írjátok be újra.</div>';
    var r = c.kor || 1;
    if (A.en && A.en.tipus === 'b') return h + biroKorHtml(r);
    if (A.en && A.en.tipus === 'u') return h + sajatKorHtml(r);
    h += kodBeiroHtml();
    if (c.kor) h += korMeccseiHtml(c.kor, false);
    return h;
  }
  function kodBeiroHtml() {
    return '<div class="sotet"><span class="kicsi">Kód</span><span class="halv" style="font-size:14px">A QR-kódból automatikusan bekerül. Ha nem, írjátok be ide:</span>' +
      '<div class="racs2"><input class="mezo" id="kodmezo" autocapitalize="characters" placeholder="pl. K7QM2X"><button class="gomb fo" data-akcio="kodMent">Belépés</button></div></div>';
  }

  function sajatKorHtml(r) {
    var c = cfg(), k = K(), t = sajatCsapat(), u = utolsok(), h = '';
    h += '<div class="kicsi">' + esc(c.csapatok[t].nev) + ' · ' + (c.kor ? c.kor + '. kör' : 'első kör') + '</div>';
    var lista = meccsek().filter(function (m) { return m.kor === r; }), latott = {};
    var egysegek = [A.en.azon]; for (var x = 0; x < k; x++) if (t * k + x !== A.en.azon) egysegek.push(t * k + x);
    egysegek.forEach(function (uu, i) {
      var m = lista.filter(function (mm) { return mm.oldalak.indexOf('u' + uu) >= 0 || mm.oldalak.indexOf('t' + t) >= 0; })[0];
      if (m && latott[m.id]) return;
      if (m) latott[m.id] = 1;
      var oldal = m ? (m.oldalak.indexOf('u' + uu) >= 0 ? 'u' + uu : 't' + t) : 'u' + uu;
      h += sajatKartya(m, oldal, r, u, i === 0 || oldal.charAt(0) === 't');
    });
    return h;
  }
  function sajatKartya(m, oldal, r, u, sajat) {
    var c = cfg(), cim = oldal.charAt(0) === 't' ? 'AZ EGÉSZ CSAPAT' : (K() > 1 ? L.oldalRovidNev(c, oldal).toUpperCase() + (sajat ? ' (TI)' : ' (CSAPATTÁRS)') : 'TI');
    var tg = L.tagNevek(c, oldal);
    var fej = '<div class="sor"><span class="kicsi">' + esc(cim) + '</span>';
    if (!m) return '<div class="kartya">' + fej + '<span class="cimke ures">' + (L.bajnoksagE(c) && L.agrajzFor(c) ? 'nincs meccs' : 'pihenő') + '</span></div>' + (tg && K() > 1 ? '<span class="tagok">' + esc(tg) + '</span>' : '') + '<div class="cim" style="font-size:20px">' + (L.bajnoksagE(c) && L.agrajzFor(c) ? 'Ebben a körben nem játszotok' : 'Ebben a körben pihentek') + '</div></div>';
    var st = L.meccsAllapot(m, u);
    var h = '<div class="kartya">' + fej + allapotCimke(st, m) + '</div>';
    if (tg && Number(c.beallit.meret) > 1) h += '<span class="tagok">' + esc(tg) + '</span>';
    if (m.cimke || m.csoport != null) h += '<span class="kicsi">' + esc(m.cimke || L.csoportNev(m.csoport)) + '</span>';
    h += '<div class="cim" style="font-size:22px">' + esc(m.jatek.nev + palyaSzoveg(m)) + '</div>';
    if (m.jatek.tipus === 'parharc') h += '<div style="font-size:14px">vs. ' + nevTag(m.oldalak[0] === oldal ? m.oldalak[1] : m.oldalak[0]) + '</div>';
    var oss = osszegzes(m, st, oldal); if (oss) h += '<div style="font-size:15px;font-weight:600">' + esc(oss) + '</div>';
    h += kulonbsegHtml(r, oldal, sajat || oldal.charAt(0) === 't');
    if (m.jatek.beiras === 'biro') h += '<span class="tagok">Ezt a versenybíró írja be.</span>';
    else if (sajat && r <= cfg().kor) h += '<button class="gomb sotetg" data-akcio="beir" data-meccs="' + m.id + '" data-oldal="' + oldal + '">' + (st.allapot === 'ures' || st.allapot === 'felig' && !L.utolsoBeirasok(A.szerver.beirasok)[L.oldalKulcs(m.id, oldal)] ? 'Eredmény beírása' : 'Beírás javítása') + '</button>';
    return h + '</div>';
  }
  // Létszámkülönbség egy oldalra: pihenő-választó (B) vagy plusz (A)
  function kulonbsegHtml(r, oldal, szerk) {
    var c = cfg(), ig = L.korIgenyek(c, r, A.szerver.beirasok).filter(function (x) { return x.oldal === oldal; })[0];
    if (!ig) return '';
    if (ig.plusz) return '<div class="plusz">Kisebb létszám: +' + ig.plusz + ' kör (dobás, gurítás…) jár – ti döntitek el, ki.</div>';
    var v = L.pihenoValasztas(c, A.szerver.beirasok, r, oldal);
    if (!v) return '';
    var nevek = v.jeloltek.filter(function (j) { return v.valasztott.indexOf(j.id) >= 0; }).map(function (j) { return j.nev; });
    if (!szerk || r > c.kor) return '<div class="pihen">' + (nevek.length ? 'Ebben a körben pihen: ' + esc(nevek.join(', ')) : v.db + ' fő pihen – még nincs kiválasztva') + '</div>';
    var kulcs = r + '|' + oldal, vaz = A.pihenVaz[kulcs] || v.valasztott.slice();
    var h = '<div class="pihen" style="display:flex;flex-direction:column;gap:8px"><span>Ki pihen ebben a körben? (' + v.db + ' fő)' + (nevek.length ? ' · most: ' + esc(nevek.join(', ')) : '') + '</span><div class="chipek">';
    v.jeloltek.forEach(function (j) {
      h += '<button class="chip' + (vaz.indexOf(j.id) >= 0 ? ' akt' : '') + '" data-akcio="pihenValaszt" data-kulcs="' + esc(kulcs) + '" data-id="' + esc(j.id) + '" data-db="' + v.db + '"' + (j.tilt ? ' disabled title="Már pihent"' : '') + '>' + esc(j.nev) + '</button>';
    });
    h += '</div>';
    var kesz = vaz.length === v.db && JSON.stringify(vaz.slice().sort()) !== JSON.stringify(v.valasztott.slice().sort());
    if (kesz) h += '<button class="gomb sotetg" data-akcio="pihenMent" data-kor="' + r + '" data-oldal="' + oldal + '">Pihenő mentése</button>';
    return h + '<span style="font-weight:400">Aki már pihent, csak akkor jöhet újra, ha mindenki sorra került.</span></div>';
  }

  function biroKorHtml(r) {
    var c = cfg(), j = jatek(A.en.azon), u = utolsok(), h = '';
    var lista = meccsek().filter(function (m) { return m.kor === r && m.jatekId === j.id; });
    if (!lista.length) {
      var kov = meccsek().filter(function (m) { return m.kor > r && m.jatekId === j.id; })[0];
      return h + '<div class="sotet"><h2>Ebben a körben nincs ' + esc(j.nev) + '</h2><span class="halv">' + (kov ? 'Legközelebb: ' + kov.kor + '. kör' : 'A játék fordulói lementek.') + '</span></div>';
    }
    var db = { ok: 0 }; lista.forEach(function (m) { if (L.meccsAllapot(m, u).allapot === 'ok') db.ok++; });
    h += '<div class="sor"><h2>' + esc(j.nev) + ' · ' + r + '. kör</h2><span class="cimke ' + (db.ok === lista.length ? 'ok' : 'var') + '">' + db.ok + ' / ' + lista.length + '</span></div>';
    h += '<div class="kartya" style="padding:4px 14px;gap:0">';
    lista.forEach(function (m) {
      var st = L.meccsAllapot(m, u), resz = m.oldalak.map(function (o) { return L.oldalNev(c, o); }).join(' – ');
      h += '<div class="meccssor"><div class="bal"><b>' + esc(resz) + '</b><span>' + esc(osszegzes(m, st) || 'még nincs') + '</span></div>' + allapotCimke(st, m) + '</div>';
    });
    h += '</div>';
    if (r <= c.kor) h += '<button class="gomb fo nagy" data-akcio="biroBeir" data-kor="' + r + '">Pontok beírása</button>';
    return h;
  }

  function korMeccseiHtml(r, admin) {
    var u = utolsok(), h = '<div class="kartya" style="padding:4px 14px;gap:0">';
    meccsek().filter(function (m) { return m.kor === r; }).forEach(function (m) {
      var st = L.meccsAllapot(m, u), oss = osszegzes(m, st);
      var resz = m.oldalak.map(function (o) { return L.oldalRovidNev(cfg(), o); }).join(' – ');
      var tg = m.oldalak.map(function (o) { return L.tagNevek(cfg(), o); }).filter(Boolean).join(' · ');
      var nyithato = admin && L.meccsKesz(m);
      h += '<div class="meccssor"' + (nyithato ? ' data-akcio="javit" data-meccs="' + m.id + '" style="cursor:pointer"' : '') + '><div class="bal"><b>' + esc((m.cimke ? m.cimke + ' · ' : m.csoport != null ? L.csoportNev(m.csoport) + ' · ' : '') + m.jatek.nev + palyaSzoveg(m)) + '</b><span>' + esc(resz) + (oss ? ' · ' + esc(oss) : '') + '</span>' +
        (tg && Number(cfg().beallit.meret) > 1 ? '<span class="tagok">' + esc(tg) + '</span>' : '') + '</div>' + allapotCimke(st, m) + '</div>';
    });
    return h + '</div>';
  }

  // =========================================================
  // Beírás űrlap (egy vagy több tétel)
  // =========================================================
  function alapAdat(j) {
    var e = j.eredmeny || {};
    if (j.tipus === 'pontgyujto') return { sz: e.mod === 'helyezes' ? 1 : 0 };
    if (e.mod === 'gyd') return e.szam ? { e: 'gy', sz: 0 } : { e: 'gy' };
    if (e.mod === 'cel') return { sz: e.irany === 'le' ? Number(e.cel) : 0 };
    return { sz: 0, kesz: true };
  }
  function tetel(m, oldal) {
    var meg = utolsok()[L.oldalKulcs(m.id, oldal)];
    return { m: m, oldal: oldal, adat: masol(meg && meg.adat ? meg.adat : alapAdat(m.jatek)) };
  }
  function urlapNyit(tetelek, mod) { A.urlap = { tetelek: tetelek, mod: mod }; A.uzenet = null; lekeres(); }

  function lepteto(t, mezo, ertek, min, max, kis) {
    return '<div class="lepteto' + (kis ? ' kis' : '') + '"><button aria-label="Kevesebb" data-akcio="lep" data-t="' + t + '" data-mezo="' + mezo + '" data-d="-1" data-min="' + min + '" data-max="' + max + '">−</button>' +
      '<span class="ertek">' + ertek + '</span><button aria-label="Több" data-akcio="lep" data-t="' + t + '" data-mezo="' + mezo + '" data-d="1" data-min="' + min + '" data-max="' + max + '">+</button></div>';
  }
  function szamMezo(t, mezo, ertek, max, kis, min) {
    if (max <= 30) return lepteto(t, mezo, ertek, min || 0, max, kis);
    return '<input class="szammezo" inputmode="numeric" data-t="' + t + '" data-szam="' + mezo + '" data-max="' + max + '" value="' + ertek + '"' + (kis ? ' style="height:52px;font-size:28px"' : '') + '>';
  }
  function valaszto(t, mezo, aktualis, opciok) {
    return '<div class="racs' + opciok.length + '">' + opciok.map(function (o) {
      return '<button class="gomb ' + (String(aktualis) === String(o[0]) ? 'valasztva' : 'vilagos') + '" data-akcio="valaszt" data-t="' + t + '" data-mezo="' + mezo + '" data-ertek="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function tetelHtml(te, i, sajatSzem, kis) {
    var j = te.m.jatek, e = j.eredmeny || {}, d = te.adat, h = '';
    if (j.tipus === 'pontgyujto' && e.mod === 'helyezes') return h + '<b>' + esc(e.cimke || 'Hányadik helyen végzett?') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.max), kis, 1);
    if (j.tipus === 'pontgyujto') return h + '<b>' + esc(e.cimke || 'Pont') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.max), kis);
    if (te.m.kieses) {
      var ell = te.m.oldalak[0] === te.oldal ? te.m.oldalak[1] : te.m.oldalak[0];
      h += '<div style="background:var(--var-h);color:#3D2A00;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;border:2px solid var(--arany2)"><b>Ki jutott tovább?</b>' +
        (sajatSzem ? '<span style="font-size:13px">Kiesésben döntetlen nincs. Ha lejárt az idő, döntsétek el a pályán, és jelöljétek.</span>' : '') +
        valaszto(i, 'tovabb', d.tovabb, sajatSzem ? [['true', 'Mi'], ['false', esc(L.oldalRovidNev(cfg(), ell))]] : [['true', 'Továbbjutott'], ['false', 'Kiesett']]) + '</div>';
      if (e.mod === 'gyd') return h + (e.szam ? '<b>' + esc(e.szam.cimke || 'Szám') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.szam.max), kis) : '');
    }
    if (e.mod === 'gyd') {
      h += '<b>' + (sajatSzem ? 'Ki nyert?' : 'Eredmény') + '</b>' + valaszto(i, 'e', d.e, sajatSzem ? [['gy', 'Mi'], ['v', 'Ők'], ['d', 'Döntetlen']] : [['gy', 'Nyert'], ['v', 'Vesztett'], ['d', 'Döntetlen']]);
      if (e.szam) h += '<b>' + esc(e.szam.cimke || 'Szám') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.szam.max), kis);
      return h;
    }
    if (e.mod === 'cel' && e.irany === 'le') {
      return h + '<b>' + esc(e.cimke || 'Maradék') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.cel), kis) +
        '<button class="gomb ' + (d.sz === 0 ? 'valasztva' : 'vilagos') + '" data-akcio="valaszt" data-t="' + i + '" data-mezo="sz" data-ertek="0">Kiszállt (0)</button>';
    }
    if (e.mod === 'cel') return h + '<b>' + esc(e.cimke || 'Pont') + ' – cél: ' + e.cel + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.cel), kis);
    return h + '<b>' + esc(e.cimke || 'Pont') + '</b>' + szamMezo(i, 'sz', d.sz, Number(e.max), kis) + valaszto(i, 'kesz', d.kesz, [['true', 'Befejeztük'], ['false', 'Lejárt az idő']]);
  }
  function urlapHtml() {
    var U = A.urlap, c = cfg(), te0 = U.tetelek[0], m0 = te0.m, h = '';
    h += '<div class="sor"><button class="gomb masod" data-akcio="urlapBe">← Vissza</button><span class="kicsi">' + m0.kor + '. kör</span></div>';
    var egy = U.tetelek.length === 1 && U.mod === 'csapat';
    h += '<div><div class="kicsi">' + (U.mod === 'admin' ? 'SZERVEZŐI JAVÍTÁS' : U.mod === 'biro' ? 'VERSENYBÍRÓ' : '') + '</div><h1>' + esc(m0.jatek.nev + (U.tetelek.length === 1 ? palyaSzoveg(m0) : '')) + '</h1></div>';
    if (egy) {
      if (m0.jatek.tipus === 'parharc') h += '<div class="sotet"><span>' + nevTag(te0.oldal) + '</span><span class="halv">vs.</span><span>' + nevTag(m0.oldalak[0] === te0.oldal ? m0.oldalak[1] : m0.oldalak[0]) + '</span></div>';
      h += '<div class="kartya">' + tetelHtml(te0, 0, true, false) + '</div>';
      if (m0.jatek.tipus === 'parharc') {
        var masik = m0.oldalak[0] === te0.oldal ? m0.oldalak[1] : m0.oldalak[0], me = utolsok()[L.oldalKulcs(m0.id, masik)];
        if (me) {
          var proba = {}; proba[L.oldalKulcs(m0.id, te0.oldal)] = { adat: te0.adat }; proba[L.oldalKulcs(m0.id, masik)] = me;
          var st = L.ervenyesAdat(m0.jatek, te0.adat, m0.kieses) ? L.meccsAllapot(m0, proba) : { allapot: 'x' };
          h += '<div class="sotet"><span class="kicsi">Az ellenfél beírta</span><span>' + esc(adatSzoveg(m0.jatek, me.adat) + (m0.kieses && typeof me.adat.tovabb === 'boolean' ? ' · továbbjutó: ' + L.oldalRovidNev(cfg(), me.adat.tovabb ? masik : te0.oldal) : '')) + '</span>' +
            (st.allapot === 'ok' ? '<span style="color:#8FD3A8;font-weight:600">✓ Egyezik – elfogadva lesz</span>' : '<span style="color:#F2A08F;font-weight:600">Ütközik – a szervező dönt, ha így küldöd</span>') + '</div>';
        } else h += '<div class="uzenet info">Az ellenfél még nem írta be a sajátját.</div>';
      }
    } else {
      h += '<div class="kartya">';
      U.tetelek.forEach(function (te, i) {
        h += '<div class="tetel"><div class="sor-kicsi"><span>' + nevTag(te.oldal) + '</span>' + (te.m.jatek.tipus === 'parharc' && U.tetelek.length > 1 ? '<span class="tagok">' + esc(te.m.jatek.nev + palyaSzoveg(te.m)) + '</span>' : '') + '</div>' + tetelHtml(te, i, false, true) + '</div>';
      });
      h += '</div>';
    }
    h += '<button class="gomb fo nagy" data-akcio="kuldes"' + (A.kuld ? ' disabled' : '') + '>' + (A.kuld ? 'Küldés…' : 'Beküldés') + '</button>';
    return h;
  }

  // =========================================================
  // Admin: meccs javítása
  // =========================================================
  function javitHtml() {
    var m = keres(A.javit), u = utolsok(), st = L.meccsAllapot(m, u), h = '';
    h += '<div class="sor"><button class="gomb masod" data-akcio="javitBe">← Vissza</button><span class="kicsi">' + m.kor + '. kör</span></div>';
    h += '<div class="sor"><h1>' + esc(m.jatek.nev + palyaSzoveg(m)) + '</h1>' + allapotCimke(st, m) + '</div>';
    m.oldalak.forEach(function (o) {
      var e = u[L.oldalKulcs(m.id, o)];
      h += '<div class="kartya"><span>' + nevTag(o) + '</span><span>' + esc(e ? adatSzoveg(m.jatek, e.adat) + (e.forras === 'admin' ? ' (szervező írta)' : e.forras === 'biro' ? ' (bíró írta)' : '') : 'még nincs beírva') + '</span>' +
        '<button class="gomb vilagos" data-akcio="adminUrlap" data-oldal="' + o + '">Adat szerkesztése</button></div>';
      h += kulonbsegHtml(m.kor, o, false);
    });
    if (m.jatek.tipus === 'parharc') {
      var ad = u[L.oldalKulcs(m.id, 'admin')];
      h += '<div class="sotet"><span class="kicsi">Szervezői döntés (felülír mindent)' + (m.kieses ? ' – ki jutott tovább' : '') + '</span>' +
        '<button class="gomb fo" data-akcio="dont" data-ertek="a">' + esc(L.oldalRovidNev(cfg(), m.oldalak[0])) + ' nyert</button>' +
        '<button class="gomb fo" data-akcio="dont" data-ertek="b">' + esc(L.oldalRovidNev(cfg(), m.oldalak[1])) + ' nyert</button>' +
        (m.kieses ? '' : '<button class="gomb masod" data-akcio="dont" data-ertek="d">Döntetlen</button>') +
        (ad ? '<button class="gomb vesz" data-akcio="dont" data-ertek="">Döntés törlése</button>' : '') + '</div>';
    }
    return h;
  }

  // =========================================================
  // Állás
  // =========================================================
  function allasHtml() {
    var c = cfg(), h = '<div class="sor"><h1>Állás</h1><span class="kicsi">' + (c.kor ? c.kor + '. kör' : '') + '</span></div>';
    if (!c.menetrend) return h + '<div class="sotet"><span class="halv">A verseny még nem kezdődött el.</span></div>';
    if (L.bajnoksagE(c)) return h + bajnoksagHtml();
    var a = L.allasSzamol(c, A.szerver.beirasok), egyeni = Number(c.beallit.meret) === 1;
    var fulek = [['csapat', egyeni ? 'Egyéni' : 'Csapat']];
    if (a.K > 1) fulek.push(['egyseg', egysegSzo(c.beallit) === 'pár' ? 'Párok' : 'Hármasok']);
    a.jatekTablak.forEach(function (t) { fulek.push(['j:' + t.jatekId, t.nev]); });
    if (!fulek.some(function (f) { return f[0] === A.allasFul; })) A.allasFul = 'csapat';
    h += '<div class="fulek" style="overflow-x:auto">' + fulek.map(function (f) { return '<button data-akcio="allasFul" data-ertek="' + esc(f[0]) + '" class="' + (A.allasFul === f[0] ? 'akt' : '') + '">' + esc(f[1]) + '</button>'; }).join('') + '</div>';
    var hm = a.egyeni && a.osszesites === 'helyezes';
    if (A.allasFul.indexOf('j:') === 0) {
      var t = a.jatekTablak.filter(function (x) { return 'j:' + x.jatekId === A.allasFul; })[0];
      if (t.ko) return h + koFulHtml(t, a);
      if (t.tipus === 'parharc') return h + parharcFulHtml(t, a);
      var hely = t.ertek === 'helyezes' && !hm, bemod = (jatek(t.jatekId).eredmeny || {}).mod === 'helyezes';
      var gr = 'grid-template-columns:26px minmax(0,1fr) 70px' + (hely ? ' 46px' : '');
      h += '<div class="tabla"><div class="tsor fej2" style="' + gr + '"><span>#</span><span>RÉSZTVEVŐ</span><span class="j">' + (bemod ? 'Σ HELY' : 'ÖSSZ') + '</span>' + (hely ? '<span class="j">P</span>' : '') + '</div>';
      t.sorok.forEach(function (s) {
        h += '<div class="tsor" style="' + gr + '"><span class="hely">' + s.hely + '</span><span class="nev">' + esc(s.nev) + '<small>' + esc((s.reszek.length ? s.reszek.join(' + ') : 'még nincs') + (s.tagok && !egyeni ? ' · ' + s.tagok : '')) + '</small></span>' +
          '<span class="j"><b>' + s.ossz + '</b></span>' + (hely ? '<span class="j">' + (t.kesz ? szamF(s.pont) : '–') + '</span>' : '') + '</div>';
      });
      h += '</div><div class="sotet"><span style="font-size:13px;color:var(--szoveg2)">' + t.db + ' / ' + t.ossz + ' beírva. ' + (t.kevesebb ? 'A kisebb a jobb. ' : '') +
        (hm ? 'A játék végső helyezése az utolsó beírás után kerül az összesítettbe.' :
          hely ? 'A helyezés szerinti 0–' + (jatek(t.jatekId).maxPont || 12) + ' pont az utolsó beírás után kerül az összesítettbe' + (a.K > 1 && jatek(t.jatekId).szint === 'csapat' ? ' (az egységek egyenlően osztoznak)' : '') + '.' : 'A pontok közvetlenül az összesítettbe kerülnek.') + '</span></div>';
      return h;
    }
    if (a.egyeni) {
      // egyéni összesítés: helyezési pontok vagy helyezési számok
      var gr3 = ' style="grid-template-columns:26px minmax(0,1fr) 60px"';
      h += '<div class="tabla"><div class="tsor fej2"' + gr3 + '><span>#</span><span>JÁTÉKOS</span><span class="j">' + (hm ? 'Σ HELY' : 'P') + '</span></div>';
      a.csapatok.forEach(function (x) {
        var resz = (x.ki ? 'kiszállt · ' : '') + x.reszek.map(function (r) { return r.nev + ' ' + (r.hely ? r.hely + '.' : '–') + (!hm && r.pont != null ? ' (' + szamF(r.pont) + ')' : ''); }).join(' · ');
        h += '<div class="tsor' + (x.hely <= 3 ? ' dobogo' : '') + '"' + gr3 + '><span class="hely">' + x.hely + '</span><span class="nev">' + esc(x.nev) + '<small>' + esc(resz) + '</small></span>' +
          '<span class="j"><b>' + (hm ? x.helyOssz : szamF(x.pont)) + '</b></span></div>';
      });
      h += '</div><span class="kicsi" style="text-transform:none">' + (hm ? 'Σ HELY = a kész játékok helyezéseinek összege, a kisebb a jobb' : 'P = a játékok pontjainak összege (zárójelben játékonként)') +
        ' · ' + a.keszJatek + ' / ' + a.jatekTablak.length + ' játék kész · holtversenyben azonos helyezés</span>';
      return h;
    }
    var lista = A.allasFul === 'egyseg' ? a.egysegek : a.csapatok;
    var parharc = (c.jatekok || []).some(function (j) { return j.tipus === 'parharc'; });
    var gr2 = parharc ? '' : ' style="grid-template-columns:26px minmax(0,1fr) 60px"';
    h += '<div class="tabla"><div class="tsor fej2"' + gr2 + '><span>#</span><span>' + (A.allasFul === 'egyseg' ? egysegSzo(c.beallit).toUpperCase() : egyeni ? 'JÁTÉKOS' : 'CSAPAT') + '</span><span class="j">P</span>' + (parharc ? '<span class="j">GY</span><span class="j">FÖL</span>' : '') + '</div>';
    lista.forEach(function (x, i) {
      var dob = i < 3;
      h += '<div class="tsor' + (dob ? ' dobogo' : '') + '"' + gr2 + '><span class="hely">' + (i + 1) + '</span><span class="nev">' + esc(x.nev) +
        (A.allasFul === 'egyseg' ? '<small>' + esc(x.csapatNev + (x.tagok ? ' · ' + x.tagok : '')) + '</small>' : (!egyeni && (x.tagok || x.ki) ? '<small>' + esc((x.ki ? 'kiszállt' + (x.tagok ? ' · ' : '') : '') + x.tagok) + '</small>' : '')) + '</span>' +
        '<span class="j"><b>' + szamF(x.pont) + '</b></span>' + (parharc ? '<span class="j">' + x.gy + '</span><span class="j" style="color:var(--szurke)">' + szamF(x.fol.toFixed(2)) + '</span>' : '') + '</div>';
    });
    h += '</div>';
    if (parharc) h += '<span class="kicsi" style="text-transform:none">P = pont (győzelem 3, döntetlen 1) · GY = győzelem · FÖL = fölény-index · holtversenynél: GY, FÖL, Buchholz</span>';
    return h;
  }
  // Kieséses / csoportkörös játék füle: helyezések, csoportok, ágrajz
  function koFulHtml(t, a) {
    var c = cfg(), ba = L.bajnoksagAllas(c, A.szerver.beirasok, t.jatekId), gr = 'grid-template-columns:30px minmax(0,1fr)', h = '';
    h += '<div class="tabla"><div class="tsor fej2" style="' + gr + '"><span>#</span><span>' + esc(t.nev.toUpperCase()) + ' – HELYEZÉS</span></div>';
    t.sorok.forEach(function (r) {
      var kis = [];
      if (r.tagok && Number(c.beallit.meret) > 1) kis.push(r.tagok);
      if (a.egyeni && a.osszesites !== 'helyezes' && r.hp != null) kis.push('→ ' + szamF(r.hp) + ' pont az összesítésbe');
      h += '<div class="tsor" style="' + gr + '"><span class="hely">' + (r.hely || '–') + '</span><span class="nev">' + esc(r.nev) + (kis.length ? '<small>' + esc(kis.join(' · ')) + '</small>' : '') + '</span></div>';
    });
    h += '</div>';
    ba.tabellak.forEach(function (tb) {
      h += '<div class="sotet" style="gap:4px"><span class="kicsi">' + esc(tb.nev) + (tb.tovabb ? ' · tovább: ' + tb.tovabb : '') + '</span>' + tb.sorok.map(function (r, i) {
        return '<span style="font-size:14px' + (tb.tovabb && i < tb.tovabb ? ';font-weight:700;color:#8FD3A8' : '') + '">' + (i + 1) + '. ' + esc(r.nev) + ' – ' + r.pont + ' p (' + r.gy + '-' + r.d + '-' + r.v + ')</span>';
      }).join('') + '</div>';
    });
    if (ba.agrajz) h += agrajzHtml(ba.agrajz);
    h += '<div class="sotet"><span style="font-size:13px;color:var(--szoveg2)">' + t.db + ' / ' + t.ossz + ' meccs kész. ' +
      (!a.egyeni ? 'Tájékoztató – az összesítettbe a meccspontok (3-1-0) kerülnek.' : a.osszesites === 'helyezes' ? 'A végső helyezés az utolsó meccs után kerül az összesítettbe.' : 'A helyezés szerinti pont az utolsó meccs után kerül az összesítettbe.') + '</span></div>';
    return h;
  }
  // Egy párharc-játék saját tabellája (a játék fülén)
  function parharcFulHtml(t, a) {
    var c = cfg(), gr = 'grid-template-columns:22px minmax(0,1fr) 30px 58px 46px 42px', h = '';
    h += '<div class="tabla"><div class="tsor fej2" style="' + gr + '"><span>#</span><span>' + esc(t.nev.toUpperCase()) + '</span><span class="j">P</span><span class="j">GY-D-V</span><span class="j">KÜL</span><span class="j">SZ</span></div>';
    t.sorok.forEach(function (r) {
      var kis = [];
      if (r.tagok && Number(c.beallit.meret) > 1) kis.push(r.tagok);
      if (a.egyeni && a.osszesites !== 'helyezes' && r.hp != null) kis.push('→ ' + szamF(r.hp) + ' pont az összesítésbe');
      h += '<div class="tsor" style="' + gr + '"><span class="hely">' + r.hely + '</span><span class="nev">' + esc(r.nev) + (kis.length ? '<small>' + esc(kis.join(' · ')) + '</small>' : '') + '</span>' +
        '<span class="j"><b>' + r.pont + '</b></span><span class="j">' + r.gy + '-' + r.d + '-' + r.v + '</span><span class="j">' + (r.kul > 0 ? '+' : '') + r.kul + '</span><span class="j" style="color:var(--szurke)">' + r.sz + '</span></div>';
    });
    h += '</div>';
    if (t.sorok.some(function (r) { return r.egymasEllen; })) h += '<div class="uzenet info">Holtversenyben az egymás elleni eredmény döntött.</div>';
    h += '<div class="sotet"><span style="font-size:13px;color:var(--szoveg2)">' + t.db + ' / ' + t.ossz + ' meccs kész. ' +
      (!a.egyeni ? 'Tájékoztató tabella – az összesítettbe a meccspontok (3-1-0) kerülnek.' : a.osszesites === 'helyezes' ? 'A végső helyezés az utolsó meccs után kerül az összesítettbe.' : 'A helyezés szerinti pont az utolsó meccs után kerül az összesítettbe.') + '</span></div>';
    return h + '<span class="kicsi" style="text-transform:none">P = pont (3-1-0) · KÜL = pontkülönbség · SZ = szerzett pont · holtversenynél: egymás elleni, KÜL, SZ</span>';
  }

  // =========================================================
  // Menetrend
  // =========================================================
  function menetrendHtml() {
    var c = cfg(), h = '<h1>Menetrend</h1>';
    if (!c.menetrend) return h + '<div class="sotet"><span class="halv">A menetrend a sorsolás és a start után jelenik meg.</span></div>';
    var R = c.menetrend.length, lista = meccsek();
    if (A.en && A.en.tipus === 'u') {
      var t = sajatCsapat(), o = 'u' + A.en.azon;
      h += '<div class="kicsi">' + esc(L.oldalNev(c, o)) + '</div><div class="kartya" style="padding:4px 14px;gap:0">';
      for (var r = 1; r <= R; r++) {
        var m = lista.filter(function (x) { return x.kor === r && (x.oldalak.indexOf(o) >= 0 || x.oldalak.indexOf('t' + t) >= 0); })[0];
        var fuggoKor = !m && lista.some(function (x) { return x.kor === r && !L.meccsKesz(x); });
        var szoveg = !m ? (fuggoKor ? 'Kieséses kör – ha továbbjutsz' : L.bajnoksagE(c) && L.agrajzFor(c) ? 'Nem játszol' : 'Pihenő') : m.jatek.tipus === 'parharc' ? 'vs. ' + L.oldalNev(c, m.oldalak[0] === o || m.oldalak[0] === 't' + t ? m.oldalak[1] : m.oldalak[0]) : (m.oldalak[0].charAt(0) === 't' && K() > 1 ? 'Az egész csapat' : '');
        h += '<div class="meccssor"' + (r === c.kor ? ' style="background:var(--var-h);margin:0 -14px;padding:12px 14px"' : '') + '><div class="bal"><b>' + r + '. kör · ' + esc(m ? m.jatek.nev + palyaSzoveg(m) : '—') + '</b><span>' + esc(szoveg) + '</span></div></div>';
      }
      h += '</div>';
    }
    var k = A.menetrendKor || c.kor || 1;
    h += '<div class="kicsi">Teljes menetrend</div>' + korValaszto('menetrendKor', k, R) + korMeccseiHtml(k, false);
    var pihenok = [], U = c.csapatok.length * K();
    for (var u = 0; u < U; u++) {
      var van = lista.some(function (x) { return x.kor === k && (x.oldalak.indexOf('u' + u) >= 0 || x.oldalak.indexOf('t' + Math.floor(u / K())) >= 0); });
      if (!van && L.aktivE(c, 'u' + u)) pihenok.push(L.oldalNev(c, 'u' + u));   // a kiszállók nem pihennek
    }
    if (pihenok.length) h += '<div class="uzenet info">Ebben a körben nem játszik: ' + esc(pihenok.join(', ')) + '</div>';
    return h;
  }
  function korValaszto(akcio, akt, R) {
    var h = '<div class="korvalaszto">';
    for (var i = 1; i <= R; i++) h += '<button data-akcio="' + akcio + '" data-ertek="' + i + '" class="' + (i === akt ? 'akt' : '') + '">' + i + '</button>';
    return h + '</div>';
  }

  // =========================================================
  // Admin: PIN és Vezérlő
  // =========================================================
  function pinHtml() {
    return '<div class="sotet"><h2>Szervezői belépés</h2><input class="mezo" id="pinmezo" type="password" inputmode="numeric" placeholder="PIN">' +
      '<div class="racs2"><button class="gomb masod" data-akcio="pinMegse">Mégse</button><button class="gomb fo" data-akcio="pinBe">Belépés</button></div></div>';
  }
  function vezerloHtml() {
    var c = cfg(), h = '<h1>Vezérlő</h1>';
    if (c.allapot !== 'fut') return h + '<div class="sotet"><span>A verseny még nincs elindítva. Beállítás, sorsolás és Start a <b>Beállítás</b> fülön.</span></div>' + veszelyHtml();
    var R = c.menetrend.length, u = utolsok();
    h += oraHtml();
    if (!c.kor) h += '<button class="gomb fo nagy" data-akcio="kor" data-ertek="kovetkezo">1. kör indítása</button>';
    else {
      // óra nélkül a szünet és a lezárás értelmetlen
      if (idoMeresE(c.beallit)) h += '<div class="racs2">' + (c.szunetKezd ?'<button class="gomb masod" data-akcio="kor" data-ertek="folytat">Folytatás</button>' :
        '<button class="gomb masod" data-akcio="kor" data-ertek="szunet"' + (c.korLezarva ? ' disabled' : '') + '>Szünet</button>') +
        '<button class="gomb vesz" data-akcio="kor" data-ertek="lezar"' + (c.korLezarva ? ' disabled' : '') + '>Kör lezárása</button></div>';
      if (c.kor < R) {
        var hiany = meccsek().filter(function (m) { return m.kor === c.kor && L.meccsAllapot(m, u).allapot !== 'ok'; }).length;
        var fugg = meccsek().some(function (m) { return m.kor === c.kor + 1 && !L.meccsKesz(m); });
        h += fugg ? '<button class="gomb fo nagy" disabled>' + (c.kor + 1) + '. kör – a párosítás még nem dőlt el (' + hiany + ' eredmény hiányzik)</button>'
          : '<button class="gomb fo nagy" data-akcio="kor" data-ertek="kovetkezo">' + (c.kor + 1) + '. kör indítása' + (hiany ? ' (' + hiany + ' eredmény hiányzik)' : '') + '</button>';
      } else h += '<div class="uzenet ok">Ez az utolsó kör. Ha minden beírás kész, a végeredmény az Állás fülön van.</div>';
    }
    var k = A.adminKor || c.kor || 1, db = { ok: 0, felig: 0, ures: 0, utkozes: 0 };
    meccsek().filter(function (m) { return m.kor === k; }).forEach(function (m) { db[L.meccsAllapot(m, u).allapot]++; });
    h += '<div class="racs3"><div class="cimke ok" style="border-radius:12px;padding:10px">' + db.ok + ' elfogadva</div><div class="cimke var" style="border-radius:12px;padding:10px">' +
      (db.felig + db.ures) + ' hiányzik</div><div class="cimke hiba" style="border-radius:12px;padding:10px">' + db.utkozes + ' ütközés</div></div>';
    h += korValaszto('adminKor', k, R) + '<span class="kicsi" style="text-transform:none">Koppints egy meccsre a javításhoz.</span>' + korMeccseiHtml(k, true);
    // pihenők áttekintése
    var ig = L.korIgenyek(c, k, A.szerver.beirasok).filter(function (x) { return x.db > 0; });
    if (ig.length) {
      h += '<div class="sotet"><span class="kicsi">Pihenők ebben a körben</span>';
      ig.forEach(function (x) {
        var v = L.pihenoValasztas(c, A.szerver.beirasok, k, x.oldal), nev = v.jeloltek.filter(function (j) { return v.valasztott.indexOf(j.id) >= 0; }).map(function (j) { return j.nev; });
        h += '<span style="font-size:14px">' + esc(L.oldalNev(c, x.oldal)) + ': ' + (nev.length ? esc(nev.join(', ')) : '<span style="color:var(--hiba-vil)">még nincs kiválasztva</span>') + '</span>';
      });
      h += '</div>';
    }
    h += '<div class="sotet"><span class="kicsi">Linkek és QR-kódok</span>';
    if (!A.kodok) h += '<button class="gomb masod" data-akcio="kodok">Megjelenítés</button>';
    else {
      h += '<div class="qrlista">';
      A.kodok.forEach(function (x, i) {
        var nev = x.tipus === 'b' ? 'Bíró · ' + ((jatek(x.azon) || {}).nev || x.azon) : L.oldalNev(c, 'u' + x.azon);
        var tg = x.tipus === 'u' ? L.tagNevek(c, 'u' + x.azon) : '';
        h += '<div class="qrkartya"><b>' + esc(nev) + '</b>' + (tg ? '<span class="tagok">' + esc(tg) + '</span>' : '') + '<div class="qr" id="qr-' + i + '"></div><span class="kod">' + esc(x.kod) + '</span></div>';
      });
      h += '</div><button class="gomb masod" data-akcio="kodokBe">Elrejtés</button>';
    }
    return h + '</div>' + visszaHtml() + veszelyHtml();
  }
  // Vissza a beállításhoz: Nem = folytatás módosítással, Igen = újrakezdés az elejéről
  function visszaHtml() {
    return '<div class="sotet"><span class="kicsi">Vissza a beállításhoz</span>' +
      '<div class="sor"><span style="font-weight:600">Eredmények törlése</span><button class="gomb ' + (A.eredmTorol ? 'vesz' : 'masod') + '" data-akcio="torlesKapcs">' + (A.eredmTorol ? 'Igen' : 'Nem') + '</button></div>' +
      '<span style="font-size:13px;color:var(--szoveg2)">' + (A.eredmTorol ? 'Újrakezdés az elejéről: az eredmények törlődnek. A nevek, a játékok, a menetrend és a QR-kódok maradnak.' :
        'Folytatás: az eredmények megmaradnak. Neveket és a játékok számait javíthatod, játékot törölhetsz.') + '</span>' +
      '<button class="gomb masod" data-akcio="visszaBeall">Vissza a beállításhoz</button></div>';
  }
  // Futó verseny módosítása (nevek, játékok számai, játék törlése)
  function mmezo(cimke, ut, ertek, szamE) {
    return '<label class="mezocim">' + cimke + '<input class="mezo" data-mod="' + esc(ut) + '"' + (szamE ? ' inputmode="numeric"' : '') + ' value="' + esc(ertek == null ? '' : ertek) + '"></label>';
  }
  function modositHtml() {
    var M2 = A.M, V = A.V, K2 = L.egysegSzam(V.beallit), egyeni = Number(V.beallit.meret) === 1, h = '';
    h += '<div class="sor"><button class="gomb masod" data-akcio="modositBe">← Mégse</button><span class="kicsi">' + (M2.ujra ? 'Újrakezdés' : 'Folytatás') + '</span></div>';
    h += '<h1>Módosítás</h1><div class="uzenet info">' + (M2.ujra ? 'Az eredmények törölve, a verseny az 1. körtől indul. A QR-kódok maradnak.' :
      'Az eredmények megmaradnak, a verseny folytatódik. Játékos cseréjénél csak írd át a nevét.') + '</div>';
    h += mmezo('A VERSENY NEVE', 'nev', V.nev);
    h += '<div class="kicsi">Játékok</div><span style="font-size:13px;color:var(--szoveg2)">Új játék, több kör („hányszor”), pályák, szabályok – minden állítható. A lejátszott és a folyamatban lévő kör marad, a hátralévő köröket a program állítja össze.</span>';
    h += jatekListaHtml(V, K2);
    if (L.bajnoksagE(V) && !A.szerkJatek) h += formatumHtml();
    if (!A.szerkJatek) {
      h += '<div class="kicsi">Az új körök helye (új játék, több kör)</div><div class="chipek">' +
        [['most', 'Most következnek'], ['vegen', 'A végén']].map(function (o) { return '<button class="chip' + (M2.helye === o[0] ? ' akt' : '') + '" data-akcio="helye" data-ertek="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    }
    h += '<div class="kicsi">' + (egyeni ? 'Játékosok' : 'Csapatok') + '</div><span style="font-size:13px;color:var(--szoveg2)">Beszállás és kiszállás menet közben is: az új ' + (egyeni ? 'játékos' : 'csapat') + ' új QR-kódot kap, a többieké marad. A kiszálló eredményei megmaradnak, új meccse nem lesz.</span>';
    var kiGomb = function (c, t) { return '<button class="gomb ' + (c.ki ? 'vilagos' : 'vesz') + '" style="min-height:44px" data-akcio="modKi" data-ertek="' + t + '">' + (c.ki ? 'Visszavesz' : 'Kiszáll') + '</button>'; };
    if (egyeni) {
      h += '<div class="kartya">';
      V.csapatok.forEach(function (c, t) {
        h += '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center"><input class="mezo" aria-label="' + (t + 1) + '. játékos" placeholder="Új játékos neve" data-mod="c.' + t + '.egyeni" value="' + esc(c.nev) + '" maxlength="30"' + (c.ki ? ' style="text-decoration:line-through;opacity:.6"' : '') + '>' + kiGomb(c, t) + '</div>';
      });
      h += '</div><button class="gomb masod" data-akcio="modUj" style="border-style:dashed;color:var(--arany);border-color:var(--arany)">+ Új játékos</button>';
    } else {
      V.csapatok.forEach(function (c, t) {
        h += '<div class="kartya csapatkartya"' + (c.ki ? ' style="opacity:.6"' : '') + '><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end"><label class="mezocim">' + (t + 1) + '. CSAPAT NEVE' + (c.ki ? ' · KISZÁLLT' : '') + '<input class="mezo" data-mod="c.' + t + '.nev" value="' + esc(c.nev) + '" maxlength="30"></label>' + kiGomb(c, t) + '</div><div class="' + (K2 > 1 ? 'racs2' : '') + '">';
        c.egysegek.forEach(function (e, k) {
          h += '<div class="parblokk">';
          if (K2 > 1) h += '<label class="mezocim">' + (k + 1) + '. ' + egysegSzo(V.beallit).toUpperCase() + ' NEVE<input class="mezo" data-mod="c.' + t + '.e' + k + '.nev" value="' + esc(e.nev) + '" maxlength="30"></label>';
          e.tagok.forEach(function (tg, i) { h += '<input class="mezo" aria-label="' + (i + 1) + '. tag" data-mod="c.' + t + '.e' + k + '.t' + i + '" value="' + esc(tg) + '" maxlength="40">'; });
          h += '<div class="racs2"><button class="gomb vilagos" style="min-height:40px" data-akcio="modTag" data-ertek="' + t + '|' + k + '|1"' + (e.tagok.length >= 8 ? ' disabled' : '') + '>+ tag</button><button class="gomb vilagos" style="min-height:40px" data-akcio="modTag" data-ertek="' + t + '|' + k + '|-1"' + (e.tagok.length <= 1 ? ' disabled' : '') + '>− tag</button></div>';
          h += '</div>';
        });
        h += '</div></div>';
      });
      h += '<button class="gomb masod" data-akcio="modUj" style="border-style:dashed;color:var(--arany);border-color:var(--arany)">+ Új csapat</button>';
    }
    h += '<div class="racs2"><button class="gomb masod" data-akcio="modositBe">Mégse</button><button class="gomb fo" data-akcio="modositMent"' + (A.kuld || A.szerkJatek ? ' disabled' : '') + '>Mentés</button></div>';
    if (A.szerkJatek) h += '<span style="font-size:13px;color:var(--szoveg2);text-align:center">Mentés előtt zárd le a játék szerkesztését (Kész).</span>';
    if (M2.ujra) h += '<div class="sotet"><span style="font-size:13px;color:var(--szoveg2)">Létszám is változik? Ehhez új sorsolás és új QR-kódok kellenek.</span>' +
      '<button class="gomb vesz" data-akcio="teljesUjra">Teljes újrabeállítás (új sorsolás)</button></div>';
    return h;
  }
  function modNyit(ujra) {
    var c = cfg();
    // a vázlat az A.V-be kerül, így a beállítás játékszerkesztője változatlanul használható
    A.M = { ujra: ujra, helye: 'vegen' };
    A.V = { nev: c.nev, sablonId: c.sablonId, beallit: masol(c.beallit), jatekok: masol(c.jatekok), csapatok: masol(c.csapatok), formatum: masol(c.formatum || { tipus: 'kor' }) };
    A.szerkJatek = null; A.nezet = 'modosit'; A.javit = null; window.scrollTo(0, 0);
  }
  function modBeir(ut, el) {
    var r = ut.split('.'), V = A.V, v = el.value;
    if (r[0] === 'nev') { V.nev = v; return; }
    var c = V.csapatok[Number(r[1])];
    if (r[2] === 'egyeni') { c.nev = v; c.egysegek[0].tagok[0] = v; return; }
    if (r[2] === 'nev') { c.nev = v; return; }
    var e = c.egysegek[Number(r[2].slice(1))];
    if (r[3] === 'nev') e.nev = v; else e.tagok[Number(r[3].slice(1))] = v;
  }
  function veszelyHtml() {
    return '<div class="sotet" style="border:1px dashed var(--piros)"><span class="kicsi" style="color:var(--hiba-vil)">Veszélyes zóna</span>' +
      '<span style="font-size:13px;color:var(--szoveg2)">Minden törlése: csapatok, menetrend, eredmények, kódok (a mentett sablonok megmaradnak). Teszt után ezzel indulsz tiszta lappal.</span>' +
      '<button class="gomb vesz" data-akcio="torles">Minden törlése</button><button class="gomb masod" data-akcio="kilep">Kilépés az admin módból</button></div>';
  }
  function qrRajzol() {
    if (!window.QRCode) return;
    A.kodok.forEach(function (k, i) {
      var el = document.getElementById('qr-' + i);
      if (el && !el.firstChild) new window.QRCode(el, { text: location.origin + location.pathname + '?k=' + encodeURIComponent(k.kod), width: 130, height: 130, correctLevel: window.QRCode.CorrectLevel.M });
    });
  }

  // =========================================================
  // Egyjátékos bajnokság: tabellák és ágrajz
  // =========================================================
  function bajnoksagHtml() {
    var c = cfg(), a = L.bajnoksagAllas(c, A.szerver.beirasok), fulek = [], h = '';
    a.tabellak.forEach(function (t, i) { fulek.push(['t' + i, L.agrajzFor(c) ? t.nev.replace(' csoport', ' csop.') : 'Tabella']); });
    if (a.agrajz) fulek.push(['ag', 'Ágrajz']);
    if (!fulek.some(function (f) { return f[0] === A.allasFul; })) A.allasFul = a.agrajz && (a.agrajz.csoportKesz || !a.agrajz.csoportos) ? 'ag' : fulek[0][0];
    if (fulek.length > 1) h += '<div class="fulek" style="overflow-x:auto">' + fulek.map(function (f) { return '<button data-akcio="allasFul" data-ertek="' + f[0] + '" class="' + (A.allasFul === f[0] ? 'akt' : '') + '">' + esc(f[1]) + '</button>'; }).join('') + '</div>';
    if (A.allasFul === 'ag') return h + agrajzHtml(a.agrajz);
    var t = a.tabellak[Number(A.allasFul.slice(1))], gr = 'grid-template-columns:22px minmax(0,1fr) 30px 58px 46px 42px';
    h += '<div class="tabla"><div class="tsor fej2" style="' + gr + '"><span>#</span><span>' + esc(t.nev.toUpperCase()) + '</span><span class="j">P</span><span class="j">GY-D-V</span><span class="j">KÜL</span><span class="j">SZ</span></div>';
    t.sorok.forEach(function (r, i) {
      var tov = t.tovabb && i < t.tovabb;
      h += '<div class="tsor" style="' + gr + (tov ? ';background:var(--ok-h);margin:0 -12px;padding-left:12px;padding-right:12px' : '') + '"><span class="hely">' + (i + 1) + '</span><span class="nev">' + esc(r.nev) +
        (r.tagok && Number(c.beallit.meret) > 1 ? '<small>' + esc(r.tagok) + '</small>' : '') + '</span><span class="j"><b>' + r.pont + '</b></span><span class="j">' + r.gy + '-' + r.d + '-' + r.v + '</span>' +
        '<span class="j">' + (r.kul > 0 ? '+' : '') + r.kul + '</span><span class="j" style="color:var(--szurke)">' + r.sz + '</span></div>';
    });
    h += '</div>';
    if (t.sorok.some(function (r) { return r.egymasEllen; })) h += '<div class="uzenet info">Holtversenyben az egymás elleni eredmény döntött.</div>';
    if (t.tovabb) h += '<span class="kicsi" style="text-transform:none;color:#8FD3A8">Zöld = továbbjutó helyen · ' + t.db + ' / ' + t.ossz + ' meccs kész</span>';
    h += '<span class="kicsi" style="text-transform:none">P = pont (3-1-0) · KÜL = pontkülönbség · SZ = szerzett pont · holtversenynél: egymás elleni, KÜL, SZ</span>';
    return h;
  }
  function agrajzHtml(ag) {
    var c = cfg(), h = '';
    if (ag.vegeredmeny.length) {
      h += '<div class="kartya" style="border:2px solid var(--arany)"><span class="kicsi">Végeredmény</span>';
      ag.vegeredmeny.forEach(function (v) { h += '<div class="sor"><span class="cim" style="font-size:' + (v.hely === 1 ? 22 : 17) + 'px">' + v.hely + '. ' + esc(L.oldalNev(c, v.oldal)) + '</span></div>'; });
      h += '</div>';
    }
    if (ag.csoportos && !ag.csoportKesz) h += '<div class="uzenet info">A párosítás a csoportkör végén dől el.</div>';
    if (!ag.szakaszok.length) return h;
    var nevek = ag.szakaszok.map(function (x) { return x.nev; });
    if (nevek.indexOf(A.agSzakasz) < 0) {
      var aktiv = ag.szakaszok.filter(function (x) { return x.tetelek.some(function (t) { return !t.bye && t.st.allapot !== 'ok'; }); })[0];
      A.agSzakasz = (aktiv || ag.szakaszok[ag.szakaszok.length - 1]).nev;
    }
    h += '<div class="chipek">' + nevek.map(function (n) { return '<button class="chip' + (n === A.agSzakasz ? ' akt' : '') + '" data-akcio="agSzakasz" data-ertek="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
    var sz = ag.szakaszok.filter(function (x) { return x.nev === A.agSzakasz; })[0];
    sz.tetelek.forEach(function (t) {
      if (t.bye) {
        h += '<div class="kartya" style="gap:6px"><div class="sor"><span class="kicsi">Erőnyerő</span><span class="cimke ok">✓ tovább</span></div><b>' + esc(L.oldalNev(c, t.oldal)) + '</b><span class="tagok" style="font-style:italic">ebben a körben nincs ellenfele</span></div>';
        return;
      }
      var m = t.m, st = t.st, gy = st.allapot === 'ok' ? (st.gyoztes === 'a' ? 0 : 1) : -1;
      h += '<div class="kartya" style="gap:6px' + (m.kor === c.kor && st.allapot !== 'ok' ? ';border:2px solid var(--arany)' : '') + '"><div class="sor"><span class="kicsi">' + esc(m.cimke + palyaSzoveg(m)) + ' · ' + m.kor + '. kör</span>' + allapotCimke(st, m) + '</div>';
      m.oldalak.forEach(function (o, i) {
        var d = i === 0 ? st.da : st.db;
        h += '<div class="sor" style="' + (gy === i ? 'font-weight:700' : gy >= 0 ? 'color:var(--szurke)' : '') + '"><span>' + esc(L.oldalNev(c, o)) + '</span><span>' + (d ? esc(adatSzoveg(m.jatek, d)) : '') + (gy === i ? ' ✓' : '') + '</span></div>';
      });
      h += '</div>';
    });
    return h;
  }

  // =========================================================
  // Admin: Beállítás (5 lépés)
  // =========================================================
  var LEPESEK = ['Sablon', 'Létszám', 'Játékok', 'Csapatok', 'Sorsolás'];
  function vazBetolt() {
    var c = cfg();
    if (c.jatekok && c.jatekok.length) { A.V = { nev: c.nev, sablonId: c.sablonId, beallit: masol(c.beallit), jatekok: masol(c.jatekok), csapatok: masol(c.csapatok), formatum: masol(c.formatum || { tipus: 'kor' }) }; if (!A.lepes || A.lepes === 1) A.lepes = 2; }
    else { A.V = null; A.lepes = 1; }
    vazMeretez(false);
  }
  function sablonBetolt(s, sajat) {
    A.V = { nev: s.nev || '', sablonId: sajat ? 'sajat' : s.id, beallit: masol(s.beallit), jatekok: masol(s.jatekok), csapatok: [], formatum: masol(s.formatum || { tipus: 'kor' }) };
    A.sorsolt = null; A.lepes = 2; A.sablonNev = null; vazMeretez(true);
  }
  // A csapatok szerkezetét a létszámhoz igazítja (nevek megmaradnak)
  function vazMeretez(ujra) {
    var V = A.V; if (!V) return;
    var be = L.csapatBeosztas(V.beallit.jatekosok, V.beallit.meret, V.beallit.maradek); if (!be) return;
    var K2 = L.egysegSzam(V.beallit), regi = V.csapatok || [];
    var aktualis = regi.map(function (c) { return (c.egysegek || []).reduce(function (s, e) { return s + (e.tagok || []).length; }, 0); });
    var egyezik = !ujra && regi.length === be.csapat && regi.every(function (c) { return (c.egysegek || []).length === K2; }) &&
      aktualis.slice().sort().join() === be.meretek.slice().sort().join();
    if (egyezik) return;
    var tagok = function (c) { var l = []; (c.egysegek || []).forEach(function (e) { (e.tagok || []).forEach(function (t) { l.push(t); }); }); return l; };
    V.csapatok = be.meretek.map(function (m, t) {
      var r = regi[t] || {}, rt = tagok(r);
      return { nev: r.nev || '', egysegek: L.eloszt(m, K2).map(function (us, k) {
        var re = (r.egysegek || [])[k] || {};
        var sajat = rt.splice(0, us); while (sajat.length < us) sajat.push('');
        return { nev: re.nev || '', tagok: sajat };
      }) };
    });
    A.sorsolt = null;
  }
  function vazMent() {
    var V = A.V;
    return kuld({ action: 'beallitas', pin: A.pin, vazlat: V }).then(function () { return lekeres(); });
  }

  function beallitasHtml() {
    if (!A.V && A.lepes !== 1) vazBetolt();
    var h = '<div class="lepesek">' + LEPESEK.map(function (n, i) {
      return '<button data-akcio="lepes" data-ertek="' + (i + 1) + '" class="' + (A.lepes === i + 1 ? 'akt' : A.lepes > i + 1 ? 'kesz' : '') + '"' + (!A.V && i > 0 ? ' disabled' : '') + '>' + (i + 1) + '. ' + n + '</button>';
    }).join('') + '</div>';
    if (A.lepes === 1) return h + lepes1();
    if (A.lepes === 2) return h + lepes2();
    if (A.lepes === 3) return h + lepes3();
    if (A.lepes === 4) return h + lepes4();
    return h + lepes5();
  }
  function tovabbGomb(cimke) {
    return '<div class="racs2"><button class="gomb masod" data-akcio="lepes" data-ertek="' + (A.lepes - 1) + '">← Vissza</button><button class="gomb fo" data-akcio="tovabb">' + (cimke || 'Tovább →') + '</button></div>' +
      '<button class="gomb masod" data-akcio="sablonMent">Mentés saját sablonként</button>';
  }

  function lepes1() {
    var h = '<h1>Miből induljunk?</h1>';
    if (A.V) h += '<button class="opcio akt" data-akcio="lepes" data-ertek="2"><span class="cim" style="font-size:18px">Folytatás: ' + esc(A.V.nev || 'mentett beállítás') + '</span><span class="kicsi">Az eddig beállítottak megmaradnak</span></button>';
    h += '<div class="kicsi">Beépített sablonok</div>';
    SB.LISTA.forEach(function (s) {
      h += '<button class="opcio" data-akcio="sablon" data-ertek="' + s.id + '"><span class="cim" style="font-size:18px">' + esc(s.nev) + '</span><span class="kicsi" style="text-transform:none;font-weight:500">' + esc(s.leiras) + '</span></button>';
    });
    h += '<div class="kicsi">Saját sablonok</div>';
    if (A.sablonok === null) { h += '<span class="halv">Betöltés…</span>'; sablonokLeker(); }
    else if (!A.sablonok.length) h += '<span class="halv" style="font-size:14px">Még nincs. A 2–5. lépésben bármely beállítást elmentheted sablonként.</span>';
    else A.sablonok.forEach(function (s, i) {
      h += '<div class="racs2" style="grid-template-columns:minmax(0,1fr) auto auto"><button class="opcio" data-akcio="sajatSablon" data-ertek="' + i + '"><span class="cim" style="font-size:18px">' + esc(s.nev) + '</span><span class="kicsi" style="text-transform:none;font-weight:500">' +
        esc(s.adat.jatekok.map(function (j) { return j.nev; }).join(', ')) + '</span></button><button class="gomb masod" data-akcio="sablonSzerk" data-ertek="' + i + '">Szerkesztés</button><button class="gomb vesz" data-akcio="sablonTorol" data-ertek="' + i + '" aria-label="Sablon törlése">Törlés</button></div>';
    });
    return h;
  }
  function sablonokLeker() {
    if (A._sabLek) return; A._sabLek = true;
    fetch(API + '?action=sablonok').then(function (r) { return r.json(); }).then(function (v) { A.sablonok = v.ok ? v.sablonok : []; A._sabLek = false; render(true); })
      .catch(function () { A.sablonok = []; A._sabLek = false; render(true); });
  }

  // Minden csapat ÉS minden egység (pár, hármas) egyforma-e – egyéninél mindig igen
  function egyformaE(V) {
    var be = L.csapatBeosztas(V.beallit.jatekosok, V.beallit.meret, V.beallit.maradek);
    if (!be) return false;
    var K2 = L.egysegSzam(V.beallit), us = [];
    be.meretek.forEach(function (m) { us = us.concat(L.eloszt(m, K2)); });
    var egy = function (l) { return l.every(function (x) { return x === l[0]; }); };
    return egy(be.meretek) && egy(us);
  }
  // „Mindenki mindenki ellen”: hány meccs jut egy résztvevőre (a csapattárs nem lehet ellenfél)
  function mindenkiSzam(V, j) {
    var db = csapatDb(V);
    if (!db) return 1;
    var K2 = L.egysegSzam(V.beallit);
    return Math.max(1, L.hatekonySzint(j, K2) === 'csapat' ? db - 1 : (db - 1) * K2);
  }
  // Aktív csapatok (játékosok) száma: a tényleges lista (menet közben is), különben a létszámból
  function csapatDb(V) {
    if (V.csapatok && V.csapatok.length) return V.csapatok.filter(function (c) { return !c.ki; }).length;
    var be = L.csapatBeosztas(V.beallit.jatekosok, V.beallit.meret, V.beallit.maradek);
    return be ? be.csapat : 0;
  }

  function lepes2() {
    var V = A.V, b = V.beallit, n = Number(b.jatekosok), h = '<h1>Létszám és csapatok</h1>';
    h += '<label class="mezocim" style="color:var(--halvany)">A VERSENY NEVE<input class="mezo" data-v="nev" value="' + esc(V.nev) + '" maxlength="40" placeholder="pl. Karácsonyi Kupa"></label>';
    h += '<div class="sotet"><span class="kicsi">Hány játékos van?</span>' + lepteto('v', 'jatekosok', n, L.MIN_JATEKOS, L.MAX_JATEKOS) + '<span class="halv" style="font-size:13px;text-align:center">2–48 fő</span></div>';
    h += '<div class="kicsi">Csapatméret</div><div class="chipek">';
    for (var m = 1; m <= 7; m++) h += '<button class="chip' + (Number(b.meret) === m ? ' akt' : '') + '" data-akcio="vset" data-mezo="meret" data-ertek="' + m + '"' + (m === 1 && n > L.MAX_EGYENI ? ' disabled' : '') + '>' + (m === 1 ? 'Egyéni' : m + ' fő') + '</button>';
    h += '</div>';
    if (Number(b.meret) === 1 && n > L.MAX_EGYENI) h += '<div class="uzenet hiba">Egyéni versenyhez legfeljebb 15 fő lehet.</div>';
    var vv = L.valtozatok(n, b.meret);
    if (Number(b.meret) > 1) {
      if (!vv.kisebb && !vv.nagyobb) h += '<div class="uzenet hiba">Ebből a létszámból nem jön ki legalább 2 csapat.</div>';
      else if (vv.egyforma) h += '<div class="uzenet info">' + vv.kisebb.csapat + ' csapat × ' + b.meret + ' fő – nincs maradék.</div>';
      else {
        var leir = function (x) { if (!x) return 'nem lehetséges'; var db = {}; x.meretek.forEach(function (s) { db[s] = (db[s] || 0) + 1; }); return Object.keys(db).sort(function (a, c) { return c - a; }).map(function (s) { return db[s] + ' × ' + s + ' fő'; }).join('<br>'); };
        h += '<div class="kicsi">A maradék ' + (n % b.meret) + ' fő – válassz</div><div class="racs2">';
        [['kisebb', 'KISEBB CSAPATOK', vv.kisebb], ['nagyobb', 'NAGYOBB CSAPATOK', vv.nagyobb]].forEach(function (o) {
          h += '<button class="opcio' + (b.maradek === o[0] ? ' akt' : '') + '" data-akcio="vset" data-mezo="maradek" data-ertek="' + o[0] + '"' + (o[2] ? '' : ' disabled') + '><span class="kicsi">' + o[1] + '</span><span class="cim" style="font-size:24px">' + (o[2] ? o[2].csapat + ' csapat' : '–') + '</span><span style="font-size:13px">' + leir(o[2]) + '</span></button>';
        });
        h += '</div>';
      }
      var bontasok = [[1, 'Egyben']];
      if (Math.floor(b.meret / 2) >= 2) bontasok.push([2, 'Párokban']);
      if (Math.floor(b.meret / 3) >= 2) bontasok.push([3, 'Hármasokban']);
      if (!bontasok.some(function (x) { return x[0] === Number(b.bontas); })) b.bontas = 1;
      if (bontasok.length > 1) {
        h += '<div class="kicsi">Hogyan játszik a csapat?</div><div class="chipek">' + bontasok.map(function (x) {
          return '<button class="chip' + (Number(b.bontas) === x[0] ? ' akt' : '') + '" data-akcio="vset" data-mezo="bontas" data-ertek="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '</div>';
        if (Number(b.bontas) > 1) h += '<span style="font-size:13px;color:var(--szoveg2)">A csapat ' + L.egysegSzam(b) + ' ' + (Number(b.bontas) === 2 ? 'párra' : 'hármasra') + ' bomlik, külön ranglistával. A maradék tag a meglévő egységeket bővíti.</span>';
      }
    }
    if (Number(b.meret) === 1) {
      // egyéni verseny: hogyan adódnak össze a játékok
      h += '<div class="kicsi">Összesítés</div>';
      [['pont', 'Pontok', 'Minden játék helyezése pontot ér (1. hely = a játéknál megadott pont, utolsó = 0). A több pont nyer.'], ['helyezes', 'Helyezési számok', 'A játékokban elért helyezések összeadódnak. A kisebb összeg nyer.']].forEach(function (o) {
        h += '<button class="opcio' + ((b.osszesites === 'helyezes' ? 'helyezes' : 'pont') === o[0] ? ' akt' : '') + '" data-akcio="vset" data-mezo="osszesites" data-ertek="' + o[0] + '"><span style="font-weight:700">' + o[1] + '</span><span style="font-size:13px">' + o[2] + '</span></button>';
      });
      h += '<span style="font-size:13px;color:var(--szoveg2)">Holtversenyben az egyenlők ugyanazt a helyezést kapják (1., 1., 3.). Egy játék csak akkor számít, ha minden eredménye kész.</span>';
    }
    // egyéninél, és ha minden csapat és egység egyforma, nincs mit kiegyenlíteni
    if (!egyformaE(V)) {
      h += '<div class="kicsi">Létszámkülönbség (ha nem egyformák a csapatok vagy egységek)</div>';
      [['A', 'A) A kisebb dupláz', 'Pl. „+1 dobás jár” – a csapat dönti el, ki dobja.'], ['B', 'B) A nagyobbikból valaki pihen', 'A csapat választja ki; mindenki csak egyszer, amíg mindenki sorra nem került.']].forEach(function (o) {
        h += '<button class="opcio' + (b.kulonbseg === o[0] ? ' akt' : '') + '" data-akcio="vset" data-mezo="kulonbseg" data-ertek="' + o[0] + '"><span style="font-weight:700">' + o[1] + '</span><span style="font-size:13px">' + o[2] + '</span></button>';
      });
    }
    var ido2 = idoMeresE(b);
    h += '<div class="sotet"><div class="sor"><span style="font-weight:600">Időmérés (visszaszámláló óra)</span><button class="gomb ' + (ido2 ? 'fo' : 'masod') + '" data-akcio="vset" data-mezo="idomeres" data-ertek="' + (ido2 ? 'false' : 'true') + '">' + (ido2 ? 'Be' : 'Ki') + '</button></div>';
    if (ido2) h += '<span class="kicsi">Teljes időkeret (perc)</span>' + lepteto('v', 'osszIdo', b.osszIdo, 10, 600) +
      '<span class="kicsi">Váltás körönként (perc)</span>' + lepteto('v', 'valtasPerc', b.valtasPerc, 0, 15) +
      '<span style="font-size:13px;color:var(--szoveg2)">A körök számát és hosszát a Sorsolás számolja ki.</span></div>';
    else h += '<span style="font-size:13px;color:var(--szoveg2)">Nincs óra: a köröket a szervező indítja és lépteti, visszaszámlálás nélkül.</span></div>';
    return h + tovabbGomb();
  }

  function lepes3() {
    var V = A.V, K2 = L.egysegSzam(V.beallit), h = '<h1>Játékok</h1>';
    h += jatekListaHtml(V, K2);
    if (L.bajnoksagE(V) && !A.szerkJatek) h += formatumHtml();
    return h + tovabbGomb();
  }
  // Sorrend-választó (egyéni) + játéklista ↑↓-vel + Új játék – a beállításnál és a futó verseny módosításánál is
  function jatekListaHtml(V, K2) {
    var h = '';
    // egyéni versenynél választható: a program sorsolja a sorrendet, vagy a lista sorrendje szerint mennek egymás után
    if (Number(V.beallit.meret) === 1 && V.jatekok.length > 1 && !A.szerkJatek) {
      h += '<div class="kicsi">A játékok sorrendje</div>';
      [['program', 'A program sorsolja', 'A játékok keverve, párhuzamosan futnak; a kvízfordulókat a program helyezi el.'], ['beirt', 'Ahogy beírtam', 'A játékok egymás után jönnek, a lista sorrendjében (↑↓). Egy játékon belül a párosítást a program csinálja.']].forEach(function (o) {
        h += '<button class="opcio' + ((V.beallit.sorrend === 'beirt' ? 'beirt' : 'program') === o[0] ? ' akt' : '') + '" data-akcio="vset" data-mezo="sorrend" data-ertek="' + o[0] + '"><span style="font-weight:700">' + o[1] + '</span><span style="font-size:13px">' + o[2] + '</span></button>';
      });
    }
    V.jatekok.forEach(function (j, i) {
      if (A.szerkJatek === j.id) { h += jatekSzerk(j, K2); return; }
      var leir = [j.tipus === 'parharc' ? 'párharc' : 'pontgyűjtő', j.egyszerre ? 'mindenki egyszerre, ' + j.hanyszor + ' forduló' : j.palyak + ' pálya, ' + (jatekFormatum(j) ? (jatekFormatum(j).tipus === 'csoport' ? 'csoport + kiesés' : 'kiesés') + (jatekFormatum(j).bronz ? ' + bronz' : '') : j.hanyszor + '×'), K2 > 1 ? (j.szint === 'csapat' ? 'egész csapat' : egysegSzo(V.beallit)) : '', j.beiras === 'biro' ? 'bíró' : 'saját beírás'].filter(Boolean).join(' · ');
      h += '<div style="display:grid;grid-template-columns:minmax(0,1fr) 44px 44px;gap:6px">';
      h += '<button class="opcio" data-akcio="szerk" data-ertek="' + esc(j.id) + '"><span class="sor" style="width:100%"><span style="font-weight:700">' + esc(j.nev) + '</span><span style="color:var(--arany);font-size:13px">Szerk.</span></span><span style="font-size:12px;color:var(--halvany)">' + esc(leir) + '</span></button>';
      h += '<button class="gomb masod" style="padding:0" data-akcio="jatekMozgat" data-ertek="' + i + '|-1" aria-label="Feljebb"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="gomb masod" style="padding:0" data-akcio="jatekMozgat" data-ertek="' + i + '|1" aria-label="Lejjebb"' + (i === V.jatekok.length - 1 ? ' disabled' : '') + '>↓</button></div>';
    });
    h += '<button class="gomb masod" data-akcio="ujJatek" style="border-style:dashed;color:var(--arany);border-color:var(--arany)">+ Új játék</button>';
    return h;
  }
  function formatumHtml() {
    var V = A.V, f = V.formatum = V.formatum || { tipus: 'kor' }, N = L.resztvevoOldalak(V).length, h = '<h2>Formátum</h2>';
    h += '<span style="font-size:13px;color:var(--szoveg2)">Egyjátékos versenynél választható. ' + N + ' résztvevő.</span>';
    [['kor', 'Körmérkőzés', 'Közös tabella, a „hányszor játsszák” szerint'], ['kieses', 'Egyenes kiesés', 'Ágrajz, sorsolt párok, erőnyerőkkel'], ['csoport', 'Csoportkör + kiesés', 'Csoportokban mindenki mindenki ellen, a legjobbak ágrajzba kerülnek']].forEach(function (o) {
      h += '<button class="opcio' + (f.tipus === o[0] ? ' akt' : '') + '" data-akcio="fset" data-mezo="tipus" data-ertek="' + o[0] + '"><span style="font-weight:700">' + o[1] + '</span><span style="font-size:13px">' + o[2] + '</span></button>';
    });
    if (f.tipus === 'kor') return h + '<span style="font-size:13px;color:var(--szoveg2)">Mindenki mindenki ellen: a „hányszor játsszák” legyen ' + (N - 1) + '.</span>';
    h += '<div class="sotet">';
    if (f.tipus === 'csoport') {
      h += '<span class="kicsi">Csoportok száma</span>' + lepteto('f', 'csoportok', f.csoportok, 1, 16) + '<span class="kicsi">Továbbjutó csoportonként</span>' + lepteto('f', 'tovabb', f.tovabb, 1, 8);
    }
    h += '<div class="sor"><span style="font-weight:600">Bronzmeccs a 3. helyért</span><button class="gomb ' + (f.bronz ? 'fo' : 'masod') + '" data-akcio="fset" data-mezo="bronz" data-ertek="' + (f.bronz ? 'false' : 'true') + '">' + (f.bronz ? 'Be' : 'Ki') + '</button></div></div>';
    var t = SR.bajnoksagTerv(N, f);
    if (t.hiba) return h + '<div class="uzenet hiba">' + esc(t.hiba) + '</div>';
    var sor = [];
    if (t.G) { var db = {}; t.meretek.forEach(function (m) { db[m] = (db[m] || 0) + 1; }); sor.push(Object.keys(db).sort(function (a, b) { return b - a; }).map(function (m) { return db[m] + ' csoport × ' + m + ' fő'; }).join(', ') + ' → ' + t.Q + ' továbbjutó'); sor.push('Csoportkör: ' + t.csoportKorok + ' forduló (pályánként szétosztva)'); }
    sor.push('Ágrajz: ' + t.B + '-as, ' + t.koKorok + ' kieséses kör' + (t.eronyerok ? ', ' + t.eronyerok + ' erőnyerő' : ''));
    if (f.bronz && t.B < 4) sor.push('Bronzmeccs ennyi továbbjutónál nincs.');
    return h + '<div class="kartya" style="gap:4px">' + sor.map(function (x) { return '<span style="font-size:14px">' + esc(x) + '</span>'; }).join('') + '</div>';
  }
  function jv(mezo, ertek, cimke, akt) { return '<button class="gomb ' + (akt ? 'valasztva' : 'vilagos') + '" data-akcio="jset" data-mezo="' + mezo + '" data-ertek="' + ertek + '">' + cimke + '</button>'; }
  function jmezo(cimke, ut, ertek, tipus) {
    return '<label class="mezocim">' + cimke + '<input class="mezo" data-jm="' + ut + '"' + (tipus === 'szam' ? ' inputmode="numeric"' : '') + ' value="' + esc(ertek == null ? '' : ertek) + '"></label>';
  }
  var KERDES = 'KÉRDÉS A BEÍRÁSNÁL (NEM KÖTELEZŐ)';
  // Többjátékos versenyben a párharc-játék saját formátuma (egyjátékosnál a verseny formátuma: formatumHtml)
  function jatekFormatum(j) { return A.V.jatekok.length > 1 && j.tipus === 'parharc' && !j.egyszerre && j.formatum && (j.formatum.tipus === 'kieses' || j.formatum.tipus === 'csoport') ? j.formatum : null; }
  function jatekFormatumHtml(j) {
    var f = jatekFormatum(j), h = '<span class="kicsi">FORMÁTUM</span><div class="racs3">' + jv('ftipus', 'kor', 'Körmérkőzés', !f) + jv('ftipus', 'kieses', 'Kiesés', f && f.tipus === 'kieses') + jv('ftipus', 'csoport', 'Csoport + kiesés', f && f.tipus === 'csoport') + '</div>';
    if (!f) return h;
    if (f.tipus === 'csoport') h += '<span class="kicsi">CSOPORTOK SZÁMA</span>' + lepteto('jf', 'csoportok', f.csoportok, 1, 16) + '<span class="kicsi">TOVÁBBJUTÓ CSOPORTONKÉNT</span>' + lepteto('jf', 'tovabb', f.tovabb, 1, 8);
    h += '<div class="sor"><span style="font-weight:600">Bronzmeccs a 3. helyért</span>' + jv('fbronz', f.bronz ? 'false' : 'true', f.bronz ? 'Be' : 'Ki', !!f.bronz) + '</div>';
    var db = csapatDb(A.V), K2 = L.egysegSzam(A.V.beallit);
    var N = L.hatekonySzint(j, K2) === 'csapat' ? db : db * K2, t = SR.bajnoksagTerv(N, f);
    if (t.hiba) return h + '<div class="uzenet hiba">' + esc(t.hiba) + '</div>';
    var sor = [N + ' résztvevő'];
    if (t.G) sor.push(t.G + ' csoport → ' + t.Q + ' továbbjutó');
    sor.push('Ágrajz: ' + t.B + '-as, ' + t.koKorok + ' kieséses kör' + (t.eronyerok ? ', ' + t.eronyerok + ' erőnyerő' : ''));
    return h + '<span class="tagok">' + esc(sor.join(' · ')) + '. A játék külön körökben megy, mert a továbbjutók előre nem ismertek. Helyezés: döntő 1–2., bronz 3–4., a kiesők a körük szerint.</span>';
  }
  function jatekSzerk(j, K2) {
    var e = j.eredmeny || {}, h = '<div class="kartya" style="border:2px solid var(--arany)">';
    h += jmezo('JÁTÉK NEVE', 'nev', j.nev);
    h += '<span class="kicsi">TÍPUS</span><div class="racs2">' + jv('tipus', 'parharc', 'Párharc', j.tipus === 'parharc') + jv('tipus', 'pontgyujto', 'Pontgyűjtő', j.tipus === 'pontgyujto') + '</div>';
    h += '<span class="tagok">' + (j.tipus === 'parharc' ? 'Két fél egymás ellen (darts, csocsó, biliárd).' : 'Mindenki a saját pontját gyűjti (bowling, kvíz, célba dobás).') + '</span>';
    if (K2 > 1) h += '<span class="kicsi">KI JÁTSSZA</span><div class="racs2">' + jv('szint', 'egyseg', 'Az egység (' + egysegSzo(A.V.beallit) + ')', j.szint !== 'csapat') + jv('szint', 'csapat', 'Az egész csapat', j.szint === 'csapat') + '</div>';
    if (j.tipus === 'pontgyujto') h += '<div class="sor"><span style="font-weight:600">Mindenki egyszerre játszik (pl. kvíz)</span>' + jv('egyszerre', j.egyszerre ? 'false' : 'true', j.egyszerre ? 'Be' : 'Ki', j.egyszerre) + '</div>';
    if (j.egyszerre) {
      // időmérés nélkül nincs „Perc / forduló” (a perc a háttérben marad, a szerver kéri)
      h += idoMeresE(A.V.beallit) ? '<div class="racs2">' + jmezo('FORDULÓK', 'hanyszor', j.hanyszor, 'szam') + jmezo('PERC / FORDULÓ', 'perc', j.perc, 'szam') + '</div>' : jmezo('FORDULÓK', 'hanyszor', j.hanyszor, 'szam');
    } else {
      // kieséses / csoportkörös játéknál a meccsek számát az ágrajz adja: nincs „hányszor”
      if (jatekFormatum(j)) h += jmezo('PÁLYÁK SZÁMA', 'palyak', j.palyak, 'szam');
      else {
        h += '<div class="racs2">' + jmezo('PÁLYÁK SZÁMA', 'palyak', j.palyak, 'szam') + jmezo('HÁNYSZOR JÁTSSZÁK', 'hanyszor', j.hanyszor, 'szam') + '</div>';
        if (j.tipus === 'parharc') h += '<button class="gomb vilagos" data-akcio="mindenki">Mindenki mindenki ellen (' + mindenkiSzam(A.V, j) + '×)</button>';
      }
      if (j.tipus === 'parharc' && A.V.jatekok.length > 1) h += jatekFormatumHtml(j);
    }
    h += '<span class="kicsi">MIT ÍRNAK BE</span>';
    var egy = Number(A.V.beallit.meret) === 1, hm = egy && A.V.beallit.osszesites === 'helyezes';
    if (j.tipus === 'pontgyujto') {
      var helyBe = e.mod === 'helyezes', kev = L.kevesebbJobb(j);
      h += '<div class="racs2">' + jv('pmod', 'szam', 'Pontot / számot', !helyBe) + jv('pmod', 'helyezes', 'Helyezést (1., 2., 3. …)', helyBe) + '</div>';
      if (helyBe) h += '<span class="tagok">1-től a résztvevők számáig írható be. Több fordulónál a helyezések összeadódnak, a kisebb összeg a jobb.</span>' + jmezo(KERDES, 'eredmeny.cimke', e.cimke);
      else {
        h += jmezo('LEGNAGYOBB BEÍRHATÓ SZÁM', 'eredmeny.max', e.max, 'szam') + jmezo(KERDES, 'eredmeny.cimke', e.cimke);
        h += '<div class="racs2">' + jv('pjobb', 'tobb', 'Több a jobb', !kev) + jv('pjobb', 'kevesebb', 'Kevesebb a jobb', kev) + '</div>';
      }
      if (hm) h += '<span class="tagok">Az összesítésbe a játék végső helyezése kerül.</span>';
      else {
        h += '<span class="kicsi">MENNYIT ÉR A VERSENYBEN</span>';
        if (kev) h += '<span class="tagok">Ha a kisebb a jobb, csak helyezés szerint számolható: Helyezés → pont.</span>';
        else h += '<div class="racs2">' + jv('ertek', 'osszeg', 'Pontok összege', j.ertek !== 'helyezes') + jv('ertek', 'helyezes', 'Helyezés → pont', j.ertek === 'helyezes') + '</div>';
        if (kev || j.ertek === 'helyezes') h += jmezo('AZ 1. HELYEZETT PONTJA (az utolsó 0)', 'maxPont', j.maxPont || 12, 'szam');
      }
    } else {
      h += '<div class="racs3">' + jv('mod', 'gyd', 'Ki nyert', e.mod === 'gyd') + jv('mod', 'cel', 'Célig', e.mod === 'cel') + jv('mod', 'tobb', 'Több pont', e.mod === 'tobb') + '</div>';
      if (e.mod === 'gyd') {
        h += '<span class="tagok">Győzelem / döntetlen / vereség.</span><div class="sor"><span style="font-weight:600">Plusz szám a holtversenyhez</span>' + jv('gydSzam', e.szam ? 'false' : 'true', e.szam ? 'Be' : 'Ki', !!e.szam) + '</div>';
        if (e.szam) h += '<div class="racs2">' + jmezo('MI A SZÁM', 'eredmeny.szam.cimke', e.szam.cimke) + jmezo('MAX.', 'eredmeny.szam.max', e.szam.max, 'szam') + '</div><div class="racs2">' + jv('jobb', 'kevesebb', 'Kevesebb a jobb', e.szam.jobb === 'kevesebb') + jv('jobb', 'tobb', 'Több a jobb', e.szam.jobb !== 'kevesebb') + '</div>';
      } else if (e.mod === 'cel') {
        h += '<span class="tagok">Aki eléri a célt, nyer. Ha lejár az idő: döntetlen.</span><div class="racs2">' + jv('irany', 'fel', 'Felfelé (gólok)', e.irany !== 'le') + jv('irany', 'le', 'Lefelé (darts 301)', e.irany === 'le') + '</div>';
        h += jmezo(e.irany === 'le' ? 'KEZDŐPONT' : 'CÉL', 'eredmeny.cel', e.cel, 'szam') + jmezo(KERDES, 'eredmeny.cimke', e.cimke);
      } else {
        h += '<span class="tagok">A több pont nyer. Ha lejár az idő: döntetlen.</span>' + jmezo('LEGNAGYOBB BEÍRHATÓ SZÁM', 'eredmeny.max', e.max, 'szam') + jmezo(KERDES, 'eredmeny.cimke', e.cimke);
      }
      // egyéni, többjátékos verseny: a játék saját tabellája szerinti helyezés kerül az összesítésbe
      if (egy && !L.bajnoksagE(A.V)) {
        h += '<span class="kicsi">MENNYIT ÉR A VERSENYBEN</span>';
        if (hm) h += '<span class="tagok">Az összesítésbe a játék saját tabellája szerinti helyezés kerül.</span>';
        else h += '<span class="tagok">A játék saját tabellája szerinti helyezés pontot ér.</span>' + jmezo('AZ 1. HELYEZETT PONTJA (az utolsó 0)', 'maxPont', j.maxPont || 12, 'szam');
      }
    }
    h += '<span class="kicsi">KI ÍRJA BE</span><div class="racs2">' + jv('beiras', 'sajat', 'A résztvevők', j.beiras !== 'biro') + jv('beiras', 'biro', 'Versenybíró', j.beiras === 'biro') + '</div>';
    if (!egyformaE(A.V)) h += '<div class="sor"><span style="font-weight:600">Létszámkülönbség kiegyenlítése</span>' + jv('kiegyenlit', j.kiegyenlit === false ? 'true' : 'false', j.kiegyenlit === false ? 'Ki' : 'Be', j.kiegyenlit !== false) + '</div>';
    h += '<div class="racs2"><button class="gomb vesz" data-akcio="jatekTorol"' + (A.V.jatekok.length < 2 ? ' disabled' : '') + '>Játék törlése</button><button class="gomb sotetg" data-akcio="szerk" data-ertek="">Kész</button></div>';
    return h + '</div>';
  }
  function jatekBeallit(j, mezo, ertek) {
    var e = j.eredmeny = j.eredmeny || {};
    switch (mezo) {
      case 'tipus':
        if (j.tipus === ertek) return;
        j.tipus = ertek;
        if (ertek === 'pontgyujto') { j.eredmeny = { mod: 'szam', max: 100, cimke: '', jobb: 'tobb' }; j.ertek = j.ertek || 'osszeg'; }
        else { j.eredmeny = { mod: 'gyd', szam: null }; j.egyszerre = false; }
        return;
      case 'egyszerre': j.egyszerre = ertek === 'true'; if (j.egyszerre) { j.perc = j.perc || 8; j.hol = j.hol || 'vegen'; } return;
      case 'mod':
        if (e.mod === ertek) return;
        j.eredmeny = ertek === 'cel' ? { mod: 'cel', cel: 10, irany: 'fel', cimke: '' } : ertek === 'tobb' ? { mod: 'tobb', max: 30, cimke: '' } : { mod: 'gyd', szam: null };
        return;
      case 'gydSzam': e.szam = ertek === 'true' ? { cimke: '', max: 10, jobb: 'tobb' } : null; return;
      case 'jobb': if (e.szam) e.szam.jobb = ertek; return;
      case 'pmod': e.mod = ertek === 'helyezes' ? 'helyezes' : 'szam'; if (e.mod === 'szam' && !(Number(e.max) > 0)) e.max = 100; return;
      case 'pjobb': e.jobb = ertek === 'kevesebb' ? 'kevesebb' : 'tobb'; return;
      case 'irany': e.irany = ertek; if (ertek === 'le' && Number(e.cel) < 31) e.cel = 301; return;
      case 'kiegyenlit': j.kiegyenlit = ertek === 'true'; return;
      case 'ftipus': j.formatum = ertek === 'kor' ? { tipus: 'kor' } : { tipus: ertek, bronz: !!(j.formatum || {}).bronz, csoportok: (j.formatum || {}).csoportok || 2, tovabb: (j.formatum || {}).tovabb || 2 }; return;
      case 'fbronz': j.formatum.bronz = ertek === 'true'; return;
      default: j[mezo] = ertek;
    }
  }

  function lepes4() {
    var V = A.V, K2 = L.egysegSzam(V.beallit), egyeni = Number(V.beallit.meret) === 1, h = '<h1>' + (egyeni ? 'Játékosok' : 'Csapatok') + '</h1>';
    if (egyeni) {
      h += '<div class="kartya">';
      V.csapatok.forEach(function (c, t) { h += '<input class="mezo" aria-label="' + (t + 1) + '. játékos" placeholder="' + (t + 1) + '. játékos" data-vaz="' + t + '.egyeni" value="' + esc(c.nev) + '" maxlength="30">'; });
      return h + '</div>' + tovabbGomb();
    }
    V.csapatok.forEach(function (c, t) {
      var db = c.egysegek.reduce(function (s, e) { return s + e.tagok.length; }, 0);
      h += '<div class="kartya csapatkartya"><label class="mezocim">' + (t + 1) + '. CSAPAT NEVE · ' + db + ' FŐ<input class="mezo" data-vaz="' + t + '.nev" value="' + esc(c.nev) + '" maxlength="30"></label><div class="' + (K2 > 1 ? 'racs2' : '') + '">';
      c.egysegek.forEach(function (e, k) {
        h += '<div class="parblokk">';
        if (K2 > 1) h += '<label class="mezocim">' + (k + 1) + '. ' + egysegSzo(V.beallit).toUpperCase() + ' NEVE' + (e.tagok.length !== Number(V.beallit.bontas) ? ' · ' + e.tagok.length + ' FŐ' : '') + '<input class="mezo" data-vaz="' + t + '.e' + k + '.nev" value="' + esc(e.nev) + '" maxlength="30"></label>';
        e.tagok.forEach(function (tg, i) { h += '<input class="mezo" aria-label="' + (i + 1) + '. tag" placeholder="' + (i + 1) + '. tag" data-vaz="' + t + '.e' + k + '.t' + i + '" value="' + esc(tg) + '" maxlength="40">'; });
        h += '</div>';
      });
      h += '</div></div>';
    });
    return h + tovabbGomb();
  }
  function vazBeir(ut, ertek) {
    var r = ut.split('.'), c = A.V.csapatok[Number(r[0])];
    if (r[1] === 'egyeni') { c.nev = ertek; c.egysegek[0].tagok[0] = ertek; return; }
    if (r[1] === 'nev') { c.nev = ertek; return; }
    var e = c.egysegek[Number(r[1].slice(1))];
    if (r[2] === 'nev') e.nev = ertek; else e.tagok[Number(r[2].slice(1))] = ertek;
  }

  function lepes5() {
    var h = '<h1>Sorsolás</h1>', S2 = A.sorsolt;
    if (A.sorsolasFut) return h + '<div class="sotet"><h2>Sorsolás…</h2><span class="halv">A menetrend készül és ellenőrződik (néhány másodperc).</span></div>';
    if (!S2) h += '<div class="sotet"><span>A Sorsolás véletlenszerűen osztja a csapatokat a helyekre, elkészíti a menetrendet, és automatikusan ellenőrzi.</span></div>';
    else if (S2.hiba) h += '<div class="uzenet hiba">' + esc(S2.hiba) + '</div>';
    else {
      var j = S2.jelentes;
      // időmérés nélkül csak a körök száma látszik, idő és időtúllépés nincs
      if (!idoMeresE(A.V.beallit)) h += '<div class="sotet" style="padding:10px"><span class="cim" style="font-size:24px">' + j.korok + '</span><span class="kicsi">kör</span></div>';
      else h += '<div class="racs3"><div class="sotet" style="padding:10px"><span class="cim" style="font-size:24px">' + j.korok + '</span><span class="kicsi">kör</span></div>' +
        '<div class="sotet" style="padding:10px"><span class="cim" style="font-size:24px">' + (S2.menetrend.filter(function (k) { return k.tipus === 'allomas'; })[0] || S2.menetrend[0]).perc + '\'</span><span class="kicsi">játék / kör</span></div>' +
        '<div class="sotet" style="padding:10px"><span class="cim" style="font-size:24px">' + j.osszPerc + '\'</span><span class="kicsi">összesen</span></div></div>';
      if (idoMeresE(A.V.beallit) && j.osszPerc > Number(A.V.beallit.osszIdo) + 2) h += '<div class="uzenet hiba">Az idő több, mint a megadott ' + A.V.beallit.osszIdo + ' perc – növeld az időkeretet, vagy csökkentsd a játékok számát.</div>';
      h += '<div class="kartya"><span class="kicsi">AUTOMATIKUS ELLENŐRZÉS' + (S2.forras === 'sablon' ? ' · a karácsonyi, előre ellenőrzött menetrend' : '') + '</span><div class="ellista">';
      j.hibak.forEach(function (x) { h += '<div><span style="color:var(--hiba);font-weight:800">✗</span><span>' + esc(x) + '</span></div>'; });
      if (!j.hibak.length) (S2.forras === 'bajnoksag' ? ['Csoportokban mindenki mindenki ellen, egyszer', 'Senki nincs egy körben két helyen', 'Az ágrajzban minden továbbjutó pontosan egyszer szerepel', 'Minden pályán egyszerre egy meccs'] :
        ['Mindenki minden játékot a megadott számban játszik', 'Senki nincs egy körben két helyen', 'Egy csapaton belül senki nem játszik egymás ellen', 'Minden pályán egyszerre egy meccs']).forEach(function (x) {
        h += '<div><span style="color:var(--ok);font-weight:800">✓</span><span>' + x + '</span></div>';
      });
      j.figyelmeztetesek.forEach(function (x) { h += '<div><span style="color:var(--var);font-weight:800">!</span><span>' + esc(x) + ' – megengedett, újrasorsolással javulhat</span></div>'; });
      h += '</div></div>';
      if (S2.agrajz && S2.agrajz.csoportok) {
        var vcfg = { beallit: A.V.beallit, jatekok: A.V.jatekok, csapatok: A.V.csapatok };
        h += '<div class="kicsi">Csoportok</div><div class="sotet" style="gap:4px">' + S2.agrajz.csoportok.map(function (cs, g) { return '<span style="font-size:14px"><b>' + L.csoportNev(g) + ':</b> ' + esc(cs.map(function (o) { return L.oldalNev(vcfg, o); }).join(', ')) + '</span>'; }).join('') + '</div>';
      } else h += '<div class="kicsi">Csapatok a sorsolás után</div><div class="sotet" style="gap:4px">' + A.V.csapatok.map(function (c, t) { return '<span style="font-size:14px">' + (t + 1) + '. ' + esc(c.nev || '(név nélkül)') + '</span>'; }).join('') + '</div>';
    }
    var startOk = S2 && !S2.hiba && !S2.jelentes.hibak.length;
    h += '<div class="racs2"><button class="gomb masod" data-akcio="sorsol" style="color:var(--arany);border-color:var(--arany)">' + (S2 ? 'Újrasorsolás' : 'Sorsolás') + '</button><button class="gomb fo" data-akcio="start"' + (startOk ? '' : ' disabled') + '>Start (zárol)</button></div>';
    h += '<button class="gomb masod" data-akcio="sablonMent">Mentés saját sablonként</button>';
    h += '<button class="gomb masod" data-akcio="lepes" data-ertek="4">← Vissza</button>';
    return h;
  }

  // =========================================================
  // Események
  // =========================================================
  var AKCIO = {
    nezet: function (d) { A.nezet = d.ertek; A.javit = null; A.urlap = null; if (d.ertek === 'beallitas' && !A.V) vazBetolt(); else lekeres(); },
    uzenetBe: function () { A.uzenet = null; },
    adminBelep: function () { A.pinKell = true; },
    agSzakasz: function (d) { A.agSzakasz = d.ertek; },
    fset: function (d) {
      var f = A.V.formatum, v = d.ertek === 'true' ? true : d.ertek === 'false' ? false : d.ertek;
      f[d.mezo] = v;
      if (d.mezo === 'tipus' && v === 'csoport') { f.csoportok = f.csoportok || 2; f.tovabb = f.tovabb || 2; }
      A.sorsolt = null;
    },
    hangBe: hangBe,
    allasFul: function (d) { A.allasFul = d.ertek; },
    menetrendKor: function (d) { A.menetrendKor = Number(d.ertek); },
    adminKor: function (d) { A.adminKor = Number(d.ertek); },
    beir: function (d) { urlapNyit([tetel(keres(d.meccs), d.oldal)], 'csapat'); },
    biroBeir: function (d) {
      var l = meccsek().filter(function (m) { return m.kor === Number(d.kor) && m.jatekId === A.en.azon && L.meccsKesz(m); }), t = [];
      l.forEach(function (m) { m.oldalak.forEach(function (o) { t.push(tetel(m, o)); }); });
      urlapNyit(t, 'biro');
    },
    urlapBe: function () { A.urlap = null; },
    lep: function (d) {
      var min = Number(d.min), max = Number(d.max), dd = Number(d.d);
      if (d.t === 'f') { A.V.formatum[d.mezo] = Math.max(min, Math.min(max, (Number(A.V.formatum[d.mezo]) || 0) + dd)); A.sorsolt = null; return; }
      if (d.t === 'jf') { var jj = A.V.jatekok.filter(function (x) { return x.id === A.szerkJatek; })[0]; jj.formatum[d.mezo] = Math.max(min, Math.min(max, (Number(jj.formatum[d.mezo]) || 0) + dd)); A.sorsolt = null; return; }
      if (d.t === 'v') {
        var b = A.V.beallit;
        b[d.mezo] = Math.max(min, Math.min(max, Number(b[d.mezo]) + dd));
        if (d.mezo === 'jatekosok') { if (Number(b.meret) === 1 && b.jatekosok > L.MAX_EGYENI) b.meret = 2; vazMeretez(false); }
        A.sorsolt = null;
        return;
      }
      var te = A.urlap.tetelek[Number(d.t)];
      te.adat[d.mezo] = Math.max(min, Math.min(max, (Number(te.adat[d.mezo]) || 0) + dd));
    },
    valaszt: function (d) {
      var v = d.ertek === 'true' ? true : d.ertek === 'false' ? false : /^\d+$/.test(d.ertek) ? Number(d.ertek) : d.ertek;
      var te = A.urlap.tetelek[Number(d.t)];
      te.adat[d.mezo] = v;
      if (d.mezo === 'tovabb' && (te.m.jatek.eredmeny || {}).mod === 'gyd') te.adat.e = v ? 'gy' : 'v';
    },
    kuldes: function () {
      var U = A.urlap;
      for (var i = 0; i < U.tetelek.length; i++) {
        var t0 = U.tetelek[i];
        if (!L.ervenyesAdat(t0.m.jatek, t0.adat, t0.m.kieses)) {
          A.uzenet = { tipus: 'hiba', szoveg: t0.m.kieses && typeof t0.adat.tovabb !== 'boolean' ? 'Jelöljétek meg, ki jutott tovább.' : 'Hibás érték: ' + L.oldalNev(cfg(), t0.oldal) + ' – nézd át.' };
          return;
        }
      }
      var tl = U.tetelek.map(function (te) { return { meccs: te.m.id, oldal: te.oldal, adat: te.adat }; });
      kuld(U.mod === 'admin' ? { action: 'adminBeir', pin: A.pin, tetelek: tl } : { action: 'beir', k: A.kod, tetelek: tl })
        .then(function () { A.urlap = null; siker('Elküldve ✓'); return lekeres(); });
    },
    pihenValaszt: function (d) {
      var v = A.pihenVaz[d.kulcs], r = d.kulcs.split('|');
      if (!v) { var pv = L.pihenoValasztas(cfg(), A.szerver.beirasok, Number(r[0]), r[1]); v = A.pihenVaz[d.kulcs] = pv ? pv.valasztott.slice() : []; }
      var i = v.indexOf(d.id);
      if (i >= 0) v.splice(i, 1); else { v.push(d.id); while (v.length > Number(d.db)) v.shift(); }
    },
    pihenMent: function (d) {
      var kulcs = d.kor + '|' + d.oldal;
      kuld({ action: 'beir', k: A.kod, tetelek: [{ meccs: L.pihenoKulcs(Number(d.kor)), oldal: d.oldal, adat: { pihen: A.pihenVaz[kulcs] } }] })
        .then(function () { delete A.pihenVaz[kulcs]; siker('Pihenő mentve ✓'); return lekeres(); });
    },
    kodMent: function () {
      var v = (document.getElementById('kodmezo').value || '').trim().toUpperCase();
      if (!v) return;
      A.kod = v; A.en = null; A.kodHibas = false; tarIr('vm_kod', v); lekeres();
    },
    pinBe: function () {
      var v = document.getElementById('pinmezo').value;
      A.pin = v;
      kuld({ action: 'pin', pin: v }).then(function () {
        A.admin = true; A.pinKell = false; tarIr('vm_pin', v);
        A.nezet = cfg().allapot === 'fut' ? 'vezerlo' : 'beallitas'; if (A.nezet === 'beallitas') vazBetolt(); render(true);
      }).catch(function () { A.pin = ''; });
    },
    pinMegse: function () { A.pinKell = false; },
    kilep: function () { A.admin = false; A.pin = ''; tarIr('vm_pin', ''); A.nezet = 'kor'; A.kodok = null; },
    kor: function (d) {
      var c = cfg();
      if (d.ertek === 'kovetkezo' && c.kor && !confirm((c.kor + 1) + '. kör indítása?')) return;
      if (d.ertek === 'lezar' && !confirm('Lezárod a kört? Az óra 0-ra áll.')) return;
      kuld({ action: 'kor', pin: A.pin, cmd: d.ertek }).then(function () { A.adminKor = null; return lekeres(); });
    },
    javit: function (d) { A.javit = d.meccs; },
    torlesKapcs: function () { A.eredmTorol = !A.eredmTorol; },
    visszaBeall: function () {
      if (!A.eredmTorol) { modNyit(false); return; }
      var v = prompt('Az eredmények törlődnek, a verseny az 1. körtől indul. Ha biztos vagy, írd be: TÖRLÉS');
      if (v === null) return;
      kuld({ action: 'ujrakezd', pin: A.pin, megerosites: v.trim().toUpperCase(), teljes: false })
        .then(function () { A.eredmTorol = false; A.utolsoFazis = {}; return lekeres(); }).then(function () { modNyit(true); render(true); }).catch(function () {});   // a hibát a kuld már kiírta
    },
    helye: function (d) { A.M.helye = d.ertek; },
    modKi: function (d) { var c = A.V.csapatok[Number(d.ertek)]; if (c.ki) delete c.ki; else c.ki = true; },
    modUj: function () {
      var K2 = L.egysegSzam(A.V.beallit), egyeni = Number(A.V.beallit.meret) === 1, db = egyeni ? 1 : K2 > 1 ? Number(A.V.beallit.bontas) : Number(A.V.beallit.meret), uj = { nev: '', egysegek: [] };
      for (var k = 0; k < K2; k++) { var tg = []; for (var i = 0; i < db; i++) tg.push(''); uj.egysegek.push({ nev: '', tagok: tg }); }
      A.V.csapatok.push(uj);
    },
    modTag: function (d) {
      var r = d.ertek.split('|'), e = A.V.csapatok[Number(r[0])].egysegek[Number(r[1])];
      if (r[2] === '1') e.tagok.push(''); else if (e.tagok.length > 1) e.tagok.pop();
    },
    modositBe: function () { A.M = null; A.V = null; A.szerkJatek = null; A.nezet = 'vezerlo'; },
    modositMent: function () {
      var c = cfg(), V = A.V, M2 = A.M, van = {}, K2 = L.egysegSzam(V.beallit);
      var ujKod = V.csapatok.reduce(function (n, x, t) { var o = c.csapatok[t]; return n + (!x.ki && (!o || o.ki) ? K2 : 0); }, 0);
      V.jatekok.forEach(function (j) { van[j.id] = 1; });
      var torolt = c.jatekok.filter(function (j) { return !van[j.id]; }).map(function (j) { return j.nev; });
      A.uzenet = { tipus: 'info', szoveg: 'A menetrend készül és ellenőrződik…' }; render(true);
      // előbb friss állapot: közben indulhatott új kör (a lejátszott körök nem változhatnak)
      lekeres().then(function () { setTimeout(function () {
        var f;
        c = cfg();
        try { f = SR.folytatas(c, V, A.szerver.beirasok, { helye: M2.helye, ido: 2500 }); } catch (e) { f = { hiba: 'Sorsolási hiba: ' + e.message }; }
        A.uzenet = null;
        if (!f.hiba && f.jelentes.hibak.length) f.hiba = f.jelentes.hibak[0];
        if (f.hiba) { A.uzenet = { tipus: 'hiba', szoveg: f.hiba }; render(true); return; }
        var sz = (torolt.length ? 'Törlődik: ' + torolt.join(', ') + ' – a meccseivel és az eredményeivel együtt.\n' : '') +
          (f.maradt ? '' : 'A hátralévő körök újrasorsolódnak.\n') +
          (f.extraKorok ? f.extraKorok + ' új kör ' + (M2.helye === 'most' ? 'jön most.' : 'kerül a végére.') + '\n' : '') +
          (ujKod ? ujKod + ' új QR-kód kell (Vezérlő → Linkek és QR-kódok).\n' : '') +
          (f.jelentes.figyelmeztetesek.length ? f.jelentes.figyelmeztetesek.join('\n') + '\n' : '') +
          'A verseny ' + f.menetrend.length + ' körös lesz. Mehet?';
        if (!confirm(sz)) { render(true); return; }
        kuld({ action: 'modosit', pin: A.pin, vazlat: { nev: V.nev, beallit: V.beallit, jatekok: V.jatekok, csapatok: V.csapatok, formatum: V.formatum }, menetrend: f.menetrend, agrajzok: f.agrajzok })
          .then(function () { A.M = null; A.V = null; A.szerkJatek = null; A.nezet = 'vezerlo'; siker('Módosítás mentve ✓'); return lekeres(); }).catch(function () {});
      }, 50); });
    },
    teljesUjra: function () {
      if (!confirm('Új sorsolás és új QR-kódok kellenek – a régi kódok érvénytelenek lesznek. Mehet?')) return;
      kuld({ action: 'ujrakezd', pin: A.pin, megerosites: 'TÖRLÉS', teljes: true })
        .then(function () { A.M = null; A.V = null; A.kodok = null; A.sorsolt = null; A.nezet = 'beallitas'; return lekeres(); })
        .then(function () { A.lepes = 2; vazBetolt(); render(true); }).catch(function () {});
    },
    javitBe: function () { A.javit = null; },
    adminUrlap: function (d) { urlapNyit([tetel(keres(A.javit), d.oldal)], 'admin'); },
    dont: function (d) { kuld({ action: 'adminBeir', pin: A.pin, tetelek: [{ meccs: A.javit, oldal: 'admin', adat: d.ertek ? { gyoztes: d.ertek } : null }] }).then(function () { return lekeres(); }); },
    kodok: function () { kuld({ action: 'kodok', pin: A.pin }).then(function (v) { A.kodok = v.kodok; render(true); }); },
    kodokBe: function () { A.kodok = null; },
    torles: function () {
      var v = prompt('Minden adat törlődik (a saját sablonok maradnak). Ha biztos vagy, írd be: TÖRLÉS');
      if (v === null) return;
      kuld({ action: 'torles', pin: A.pin, megerosites: v.trim().toUpperCase() }).then(function () {
        A.kodok = null; A.V = null; A.en = null; A.sorsolt = null; A.lepes = 1; A.nezet = 'beallitas'; siker('Minden törölve.'); return lekeres();
      });
    },
    // ---- beállítás ----
    lepes: function (d) { var n = Number(d.ertek); if (n < 1) return; if (n > 1 && !A.V) return; A.lepes = n; A.szerkJatek = null; window.scrollTo(0, 0); },
    tovabb: function () {
      if (A.lepes === 2 && !L.csapatBeosztas(A.V.beallit.jatekosok, A.V.beallit.meret, A.V.beallit.maradek)) { A.uzenet = { tipus: 'hiba', szoveg: 'Ebből a létszámból nem jön ki érvényes beosztás.' }; return; }
      vazMent().then(function () { A.lepes++; A.szerkJatek = null; A.uzenet = null; window.scrollTo(0, 0); render(true); });
    },
    sablon: function (d) { sablonBetolt(SB.LISTA.filter(function (s) { return s.id === d.ertek; })[0], false); },
    sajatSablon: function (d) { var s = A.sablonok[Number(d.ertek)]; sablonBetolt({ nev: s.adat.nev || s.nev, beallit: s.adat.beallit, jatekok: s.adat.jatekok, formatum: s.adat.formatum }, true); },
    // sablon szerkesztése: betöltés, és a mentés ugyanezt a nevet ajánlja fel
    sablonSzerk: function (d) { var s = A.sablonok[Number(d.ertek)]; AKCIO.sajatSablon(d); A.sablonNev = s.nev; siker('Szerkesztés: „' + s.nev + '” – a Mentés saját sablonként felülírja'); },
    sablonTorol: function (d) {
      var s = A.sablonok[Number(d.ertek)];
      if (!confirm('Törlöd a(z) „' + s.nev + '” sablont?')) return;
      kuld({ action: 'sablonTorol', pin: A.pin, nev: s.nev }).then(function () { A.sablonok = null; render(true); });
    },
    sablonMent: function () {
      var n = prompt('A sablon neve:', A.sablonNev || A.V.nev || '');
      if (!n) return;
      n = n.trim();
      // azonos név: a szerver előbb jelzi, felülírás csak megerősítés után
      var ment = function (felulir) {
        return kuld({ action: 'sablonMent', pin: A.pin, nev: n, vazlat: A.V, felulir: felulir }).then(function (v) {
          if (v.letezik) { if (confirm('Már van „' + n + '” nevű sablon. Felülírod?')) return ment(true); return; }
          A.sablonok = null; A.sablonNev = n; siker('Sablon mentve ✓');
        });
      };
      ment(false).catch(function () {});
    },
    vset: function (d) {
      var b = A.V.beallit, v = /^\d+$/.test(d.ertek) ? Number(d.ertek) : d.ertek === 'true' ? true : d.ertek === 'false' ? false : d.ertek;
      b[d.mezo] = v;
      if (d.mezo === 'meret') { if (v === 1) b.bontas = 1; else if (Math.floor(v / Number(b.bontas || 1)) < 2) b.bontas = 1; }
      if (['meret', 'maradek', 'bontas'].indexOf(d.mezo) >= 0) vazMeretez(false);
      A.sorsolt = null;
    },
    szerk: function (d) { A.szerkJatek = d.ertek || null; },
    // játék fel/le a listában (= a lejátszás sorrendje „Ahogy beírtam” módban, és az Állás fülek sorrendje)
    jatekMozgat: function (d) {
      var r = d.ertek.split('|'), i = Number(r[0]), c = i + Number(r[1]), l = A.V.jatekok;
      if (c < 0 || c >= l.length) return;
      var x = l[i]; l[i] = l[c]; l[c] = x; A.sorsolt = null;
    },
    mindenki: function () {
      var j = A.V.jatekok.filter(function (x) { return x.id === A.szerkJatek; })[0];
      j.hanyszor = mindenkiSzam(A.V, j); A.sorsolt = null;
    },
    ujJatek: function () {
      var id; do { id = 'J' + Math.floor(Math.random() * 1e6); } while (A.V.jatekok.some(function (j) { return j.id === id; }));
      A.V.jatekok.push({ id: id, nev: 'Új játék', tipus: 'parharc', szint: 'egyseg', palyak: 1, hanyszor: 1, egyszerre: false, eredmeny: { mod: 'gyd', szam: null }, beiras: 'sajat', ertek: 'osszeg', maxPont: 12, kiegyenlit: true });
      A.szerkJatek = id; A.sorsolt = null;
    },
    jatekTorol: function () {
      if (!confirm('Törlöd ezt a játékot?')) return;
      A.V.jatekok = A.V.jatekok.filter(function (j) { return j.id !== A.szerkJatek; }); A.szerkJatek = null; A.sorsolt = null;
    },
    jset: function (d) {
      var j = A.V.jatekok.filter(function (x) { return x.id === A.szerkJatek; })[0];
      jatekBeallit(j, d.mezo, d.ertek); A.sorsolt = null;
    },
    sorsol: function () {
      A.sorsolasFut = true; A.sorsolt = null; render(true);
      setTimeout(function () {
        try {
          A.V.csapatok = SR.csapatSorsolas(A.V.csapatok);
          A.sorsolt = SR.general(A.V, { ido: 3000 });
        } catch (e) { A.sorsolt = { hiba: 'Sorsolási hiba: ' + e.message }; }
        A.sorsolasFut = false; render(true);
        vazMent().catch(function () {});
      }, 50);
    },
    start: function () {
      if (!confirm('START: a csapatok és a menetrend zárolva lesznek, és elkészülnek a kódok. Mehet?')) return;
      vazMent().then(function () { return kuld({ action: 'start', pin: A.pin, menetrend: A.sorsolt.menetrend, agrajz: A.sorsolt.agrajz || null, agrajzok: A.sorsolt.agrajzok || null }); })
        .then(function () { A.nezet = 'vezerlo'; A.V = null; A.sorsolt = null; siker('A verseny elindult. Oszd ki a QR-kódokat, majd indítsd az 1. kört.'); return lekeres(); });
    }
  };

  $app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-akcio]');
    if (!el || el.disabled) return;
    var fn = AKCIO[el.getAttribute('data-akcio')];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset);
    render(true);
  });
  $app.addEventListener('input', function (e) {
    var el = e.target, d = el.dataset;
    if (d.mod && A.M) modBeir(d.mod, el);
    else if (d.vaz) vazBeir(d.vaz, el.value);
    else if (d.v) A.V[d.v] = el.value;
    else if (d.jm) {
      var j = A.V.jatekok.filter(function (x) { return x.id === A.szerkJatek; })[0], ut = d.jm.split('.'), o = j;
      for (var i = 0; i < ut.length - 1; i++) o = o[ut[i]] = o[ut[i]] || {};
      o[ut[ut.length - 1]] = el.getAttribute('inputmode') === 'numeric' ? (parseInt(el.value, 10) || 0) : el.value;
      A.sorsolt = null;
    } else if (d.szam && A.urlap) {
      var n = parseInt(el.value, 10);
      A.urlap.tetelek[Number(d.t)].adat[d.szam] = isNaN(n) ? -1 : n;
    }
  });
  $app.addEventListener('change', function (e) { if (e.target.dataset.szam) render(true); });

  // ---- Indulás ----
  (function () {
    var q = new URLSearchParams(location.search), k = q.get('k');
    if (k) { A.kod = k.trim().toUpperCase(); tarIr('vm_kod', A.kod); }
    if (q.has('admin') && !A.pin) A.pinKell = true;
    if (k || q.has('admin')) history.replaceState(null, '', location.pathname);
    if (A.pin && vanApi()) {
      kuld({ action: 'pin', pin: A.pin }).then(function () { A.admin = true; A.nezet = 'vezerlo'; render(true); })
        .catch(function () { A.pin = ''; tarIr('vm_pin', ''); A.uzenet = null; });
    }
  })();
  lekeres();
  setInterval(tick, 250);
  var utolso = 0;
  setInterval(function () {
    var kell = document.hidden ? HATTER_FRISSITES_MS : FRISSITES_MS;
    if (Date.now() - utolso >= kell && !A.kuld && !A.sorsolasFut) { utolso = Date.now(); lekeres(); }
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { lekeres(); if (A.hang && !A.wakeLock) ebrenTart(); } });
})();
