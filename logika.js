/* =========================================================
   VERSENYMOTOR – logika.js
   Tiszta számoló függvények: létszám, eredmények, állás, pihenő, óra.
   Ugyanez a fájl fut a böngészőben ÉS az Apps Scriptben (Logika.gs néven),
   így a szerver és a telefon ugyanazzal a szabállyal ellenőriz.
   ========================================================= */
(function (gyoker) {
  'use strict';

  var MIN_JATEKOS = 2, MAX_JATEKOS = 48, MAX_EGYENI = 15;

  function egeszE(v, min, max) { return typeof v === 'number' && Math.floor(v) === v && v >= min && v <= max; }
  function vag(x) { return Math.max(-1, Math.min(1, x)); }
  function kerekit(x, jegy) { var h = Math.pow(10, jegy); return Math.round(x * h) / h; }

  // ---------------------------------------------------------
  // Létszám → csapatok
  // ---------------------------------------------------------
  // Egyenletes elosztás: a méretek legfeljebb 1-gyel térnek el, a nagyobbak elöl
  function eloszt(n, db) {
    var ki = [], alap = Math.floor(n / db), tobb = n % db;
    for (var i = 0; i < db; i++) ki.push(alap + (i < tobb ? 1 : 0));
    return ki;
  }

  // vissza: { csapat, meretek:[...] } vagy null
  function csapatBeosztas(n, meret, maradek) {
    n = Math.floor(Number(n) || 0); meret = Math.floor(Number(meret) || 0);
    if (n < MIN_JATEKOS || n > MAX_JATEKOS || meret < 1 || meret > 7) return null;
    if (meret === 1) return n <= MAX_EGYENI ? { csapat: n, meretek: eloszt(n, n) } : null;
    var T = maradek === 'kisebb' ? Math.ceil(n / meret) : Math.floor(n / meret);
    if (T < 2) return null;
    return { csapat: T, meretek: eloszt(n, T) };
  }

  // A két lehetőség a beállító képernyőhöz
  function valtozatok(n, meret) {
    var k = csapatBeosztas(n, meret, 'kisebb'), g = csapatBeosztas(n, meret, 'nagyobb');
    return { kisebb: k, nagyobb: g, egyforma: !!(k && g && k.csapat === g.csapat) };
  }

  // Hány egységre (párra, hármasra) bomlik egy csapat
  function egysegSzam(beallit) {
    var m = Number(beallit.meret), b = Number(beallit.bontas) || 1;
    if (m <= 1 || b <= 1) return 1;
    return Math.max(1, Math.floor(m / b));
  }

  function hatekonySzint(jatek, K) { return K === 1 ? 'egyseg' : (jatek.szint === 'csapat' ? 'csapat' : 'egyseg'); }

  // ---------------------------------------------------------
  // Oldalak (ki játszik): 'u5' = 5. egység, 't2' = 2. csapat
  // ---------------------------------------------------------
  function K_(cfg) { return egysegSzam(cfg.beallit); }
  function oldalCsapat(cfg, o) { var i = Number(o.slice(1)); return o.charAt(0) === 't' ? i : Math.floor(i / K_(cfg)); }
  function oldalEgysegek(cfg, o) {
    var i = Number(o.slice(1)), K = K_(cfg), ki = [];
    if (o.charAt(0) === 'u') return [i];
    for (var k = 0; k < K; k++) ki.push(i * K + k);
    return ki;
  }
  function egysegAdat(cfg, u) {
    var K = K_(cfg), cs = cfg.csapatok[Math.floor(u / K)] || { egysegek: [] };
    return cs.egysegek[u % K] || { nev: '', tagok: [] };
  }
  // Személyek: azonosító 'csapat.egység.sorszám'
  function oldalTagok(cfg, o) {
    var K = K_(cfg), ki = [];
    oldalEgysegek(cfg, o).forEach(function (u) {
      (egysegAdat(cfg, u).tagok || []).forEach(function (nev, i) {
        ki.push({ id: Math.floor(u / K) + '.' + (u % K) + '.' + i, nev: nev || ('Játékos ' + (i + 1)) });
      });
    });
    return ki;
  }
  function oldalNev(cfg, o) {
    var t = oldalCsapat(cfg, o), cs = cfg.csapatok[t] || {};
    if (o.charAt(0) === 't' || K_(cfg) === 1) return cs.nev || ((t + 1) + '. csapat');
    var u = Number(o.slice(1));
    return (cs.nev || ((t + 1) + '. csapat')) + ' – ' + (egysegAdat(cfg, u).nev || ('Egység ' + (u % K_(cfg) + 1)));
  }
  function oldalRovidNev(cfg, o) {
    if (o.charAt(0) === 't' || K_(cfg) === 1) return oldalNev(cfg, o);
    var u = Number(o.slice(1));
    return egysegAdat(cfg, u).nev || oldalNev(cfg, o);
  }
  function tagNevek(cfg, o) { return oldalTagok(cfg, o).map(function (x) { return x.nev; }).filter(Boolean).join(', '); }

  // ---------------------------------------------------------
  // Menetrend → meccslista
  // ---------------------------------------------------------
  function jatekTar(cfg) { var t = {}; (cfg.jatekok || []).forEach(function (j) { t[j.id] = j; }); return t; }

  function meccsLista(cfg) {
    var lista = [], jt = jatekTar(cfg);
    (cfg.menetrend || []).forEach(function (kor, r) {
      kor.meccsek.forEach(function (m) {
        lista.push({ id: m.id, kor: r + 1, jatek: jt[m.jatek], jatekId: m.jatek, palya: m.palya, oldalak: m.oldalak, egyszerre: kor.tipus === 'egyszerre' });
      });
    });
    return lista;
  }
  function meccsKeres(cfg, id) {
    var l = meccsLista(cfg);
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function oldalKulcs(meccs, oldal) { return meccs + '|' + oldal; }
  function utolsoBeirasok(beirasok) {
    var t = {};
    (beirasok || []).forEach(function (b) {
      var k = oldalKulcs(b.meccs, b.oldal);
      if (!t[k] || Number(b.ido) >= Number(t[k].ido)) t[k] = b;
    });
    Object.keys(t).forEach(function (k) { if (t[k].adat == null) delete t[k]; });
    return t;
  }

  // ---------------------------------------------------------
  // Eredmények
  // ---------------------------------------------------------
  function ervenyesAdat(jatek, d) {
    if (!jatek || !d || typeof d !== 'object') return false;
    var e = jatek.eredmeny || {};
    if (jatek.tipus === 'pontgyujto') return egeszE(d.sz, 0, Number(e.max) || 0);
    switch (e.mod) {
      case 'gyd': return ['gy', 'v', 'd'].indexOf(d.e) >= 0 && (!e.szam || egeszE(d.sz, 0, Number(e.szam.max) || 0));
      case 'cel': return egeszE(d.sz, 0, Number(e.cel) || 0);
      case 'tobb': return egeszE(d.sz, 0, Number(e.max) || 0) && typeof d.kesz === 'boolean';
    }
    return false;
  }

  // vissza: { gyoztes: 'a'|'b'|'d'|null(=ütközés), folA }
  function kiertekel(jatek, da, db) {
    var e = jatek.eredmeny || {};
    if (e.mod === 'gyd') {
      var g = da.e === 'gy' && db.e === 'v' ? 'a' : da.e === 'v' && db.e === 'gy' ? 'b' : da.e === 'd' && db.e === 'd' ? 'd' : null;
      if (!g) return { gyoztes: null, folA: 0 };
      var f = 0;
      if (e.szam) f = vag((e.szam.jobb === 'kevesebb' ? db.sz - da.sz : da.sz - db.sz) / (Number(e.szam.max) || 1));
      return { gyoztes: g, folA: f };
    }
    if (e.mod === 'cel') {
      var cel = Number(e.cel);
      if (e.irany === 'le') {
        if (da.sz === 0 && db.sz === 0) return { gyoztes: null, folA: 0 };
        return { gyoztes: da.sz === 0 ? 'a' : db.sz === 0 ? 'b' : 'd', folA: vag((db.sz - da.sz) / cel) };
      }
      if (da.sz === cel && db.sz === cel) return { gyoztes: null, folA: 0 };
      return { gyoztes: da.sz === cel ? 'a' : db.sz === cel ? 'b' : 'd', folA: vag((da.sz - db.sz) / cel) };
    }
    if (e.mod === 'tobb') {
      if (da.kesz !== db.kesz) return { gyoztes: null, folA: 0 };
      var ft = vag((da.sz - db.sz) / (Number(e.skala) || Number(e.max) || 1));
      if (!da.kesz) return { gyoztes: 'd', folA: ft };
      return { gyoztes: da.sz > db.sz ? 'a' : da.sz < db.sz ? 'b' : 'd', folA: ft };
    }
    return { gyoztes: null, folA: 0 };
  }

  // allapot: 'ures' | 'felig' | 'ok' | 'utkozes'
  function meccsAllapot(m, u) {
    var j = m.jatek;
    if (j.tipus === 'pontgyujto') {
      var e1 = u[oldalKulcs(m.id, m.oldalak[0])];
      return e1 && ervenyesAdat(j, e1.adat) ? { allapot: 'ok', sz: e1.adat.sz, forras: e1.forras } : { allapot: 'ures' };
    }
    var a = m.oldalak[0], b = m.oldalak[1];
    var ea = u[oldalKulcs(m.id, a)], eb = u[oldalKulcs(m.id, b)], ad = u[oldalKulcs(m.id, 'admin')];
    var da = ea && ervenyesAdat(j, ea.adat) ? ea.adat : null;
    var db = eb && ervenyesAdat(j, eb.adat) ? eb.adat : null;
    var sz = da && db ? kiertekel(j, da, db) : null;
    if (ad && ad.adat && ['a', 'b', 'd'].indexOf(ad.adat.gyoztes) >= 0) {
      var g = ad.adat.gyoztes, irany = g === 'a' ? 1 : g === 'b' ? -1 : 0, folA = 0;
      if (sz && (irany === 0 || sz.folA * irany > 0)) folA = sz.folA;
      return { allapot: 'ok', admin: true, gyoztes: g, folA: folA, da: da, db: db };
    }
    if (!da && !db) return { allapot: 'ures' };
    if (!da || !db) return { allapot: 'felig', da: da, db: db };
    if (sz.gyoztes === null) return { allapot: 'utkozes', da: da, db: db };
    return { allapot: 'ok', gyoztes: sz.gyoztes, folA: sz.folA, da: da, db: db };
  }

  // ---------------------------------------------------------
  // Állás
  // ---------------------------------------------------------
  function rendez(lista) {
    return lista.sort(function (x, y) {
      return (y.pont - x.pont) || (y.gy - x.gy) || (y.fol - x.fol) || (y.buch - x.buch) || String(x.nev).localeCompare(String(y.nev), 'hu');
    });
  }
  function helyezesPontok(sorok, maxPont) {
    // holtversenyben átlagolt helyezés; 1. = maxPont, utolsó = 0
    var N = sorok.length, s = sorok.slice().sort(function (x, y) { return y.ossz - x.ossz; }), p = 0;
    while (p < N) {
      var v = p;
      while (v + 1 < N && s[v + 1].ossz === s[p].ossz) v++;
      var hely = (p + v) / 2 + 1;
      var pont = N > 1 ? kerekit(maxPont * (N - hely) / (N - 1), 1) : maxPont;
      for (var j = p; j <= v; j++) s[j].pont = pont;
      p = v + 1;
    }
  }

  function allasSzamol(cfg, beirasok) {
    var K = K_(cfg), T = (cfg.csapatok || []).length, U = T * K;
    var u = utolsoBeirasok(beirasok), meccsek = meccsLista(cfg);
    var egysegek = [], csapatok = [], i;
    function uj(nev, extra) { var o = { nev: nev, pont: 0, gy: 0, d: 0, v: 0, fol: 0, buch: 0, jatszott: 0, ellen: [] }; for (var k in extra) o[k] = extra[k]; return o; }
    for (i = 0; i < U; i++) egysegek.push(uj(oldalRovidNev(cfg, 'u' + i), { id: i, oldal: 'u' + i, csapatNev: (cfg.csapatok[Math.floor(i / K)] || {}).nev, tagok: tagNevek(cfg, 'u' + i) }));
    for (i = 0; i < T; i++) csapatok.push(uj(cfg.csapatok[i].nev, { id: i, oldal: 't' + i, tagok: tagNevek(cfg, 't' + i) }));

    // Egy oldal pontjainak jóváírása: egység-szintnél egység + csapat, csapat-szintnél csapat + egységenként 1/K
    function jovair(o, pont, fol, eredm) {
      var t = oldalCsapat(cfg, o), us = oldalEgysegek(cfg, o), arany = o.charAt(0) === 't' ? 1 / K : 1;
      var celok = [[csapatok[t], 1]];
      us.forEach(function (x) { celok.push([egysegek[x], arany]); });
      celok.forEach(function (c) {
        c[0].pont += pont * c[1]; c[0].fol += fol * c[1];
        if (eredm) { c[0].jatszott++; c[0][eredm]++; }
      });
    }

    var tablak = {};
    (cfg.jatekok || []).forEach(function (j) { if (j.tipus === 'pontgyujto') tablak[j.id] = { jatek: j, sorok: {}, db: 0, ossz: 0 }; });

    meccsek.forEach(function (m) {
      if (!m.jatek) return;
      var a = meccsAllapot(m, u);
      if (m.jatek.tipus === 'pontgyujto') {
        var tb = tablak[m.jatekId], o = m.oldalak[0];
        tb.ossz++;
        if (!tb.sorok[o]) tb.sorok[o] = { oldal: o, nev: oldalNev(cfg, o), tagok: tagNevek(cfg, o), reszek: [], ossz: 0, pont: 0 };
        if (a.allapot === 'ok') { tb.sorok[o].reszek.push(a.sz); tb.sorok[o].ossz += a.sz; tb.db++; }
        return;
      }
      if (a.allapot !== 'ok') return;
      var oa = m.oldalak[0], ob = m.oldalak[1];
      var pa = a.gyoztes === 'a' ? 3 : a.gyoztes === 'd' ? 1 : 0, pb = a.gyoztes === 'b' ? 3 : a.gyoztes === 'd' ? 1 : 0;
      jovair(oa, pa, a.folA, pa === 3 ? 'gy' : pa === 1 ? 'd' : 'v');
      jovair(ob, pb, -a.folA, pb === 3 ? 'gy' : pb === 1 ? 'd' : 'v');
      // Buchholz-ellenfelek
      if (oa.charAt(0) === 'u') { egysegek[Number(oa.slice(1))].ellen.push(Number(ob.slice(1))); egysegek[Number(ob.slice(1))].ellen.push(Number(oa.slice(1))); }
      csapatok[oldalCsapat(cfg, oa)].ellen.push(oldalCsapat(cfg, ob));
      csapatok[oldalCsapat(cfg, ob)].ellen.push(oldalCsapat(cfg, oa));
    });

    // Buchholz a párharc-pontokból (pontgyűjtő pontok előtt)
    egysegek.forEach(function (x) { x.buch = x.ellen.reduce(function (s, q) { return s + egysegek[q].pont; }, 0); });
    csapatok.forEach(function (x) { x.buch = x.ellen.reduce(function (s, q) { return s + csapatok[q].pont; }, 0); });

    // Pontgyűjtő játékok
    var jatekTablak = [];
    Object.keys(tablak).forEach(function (id) {
      var tb = tablak[id], j = tb.jatek;
      var sorok = Object.keys(tb.sorok).map(function (k) { return tb.sorok[k]; });
      var kesz = tb.ossz > 0 && tb.db === tb.ossz;
      if (j.ertek === 'helyezes') {
        if (kesz) helyezesPontok(sorok, Number(j.maxPont) || 12);
      } else sorok.forEach(function (s) { s.pont = s.ossz; });
      if (j.ertek !== 'helyezes' || kesz) sorok.forEach(function (s) { jovair(s.oldal, s.pont, 0, null); });
      sorok.sort(function (x, y) { return y.ossz - x.ossz; });
      jatekTablak.push({ jatekId: id, nev: j.nev, ertek: j.ertek, sorok: sorok, kesz: kesz, db: tb.db, ossz: tb.ossz });
    });

    [egysegek, csapatok].forEach(function (l) { l.forEach(function (x) { x.pont = kerekit(x.pont, 2); x.fol = kerekit(x.fol, 2); delete x.ellen; }); });
    return { K: K, egysegek: rendez(egysegek), csapatok: rendez(csapatok), jatekTablak: jatekTablak };
  }

  // ---------------------------------------------------------
  // Létszámkülönbség: pihenő (B) és plusz kör (A)
  // ---------------------------------------------------------
  function meretek(cfg) {
    var K = K_(cfg), T = cfg.csapatok.length, um = [], tm = [];
    for (var t = 0; t < T; t++) {
      var s = 0;
      for (var k = 0; k < K; k++) { var n = ((cfg.csapatok[t].egysegek[k] || {}).tagok || []).length; um.push(n); s += n; }
      tm.push(s);
    }
    return { egyseg: um, csapat: tm };
  }

  // Egy kör igényei: [{ oldal, meccs, db (ennyi pihen), plusz (ennyi plusz kör jár) }]
  function korIgenyek(cfg, kor) {
    var ki = [], mod = (cfg.beallit || {}).kulonbseg === 'A' ? 'A' : 'B', mm = meretek(cfg);
    var minU = Math.min.apply(null, mm.egyseg), maxU = Math.max.apply(null, mm.egyseg);
    var minT = Math.min.apply(null, mm.csapat), maxT = Math.max.apply(null, mm.csapat);
    meccsLista(cfg).forEach(function (m) {
      if (m.kor !== kor || !m.jatek || m.jatek.kiegyenlit === false) return;
      m.oldalak.forEach(function (o) {
        var n = o.charAt(0) === 'u' ? mm.egyseg[Number(o.slice(1))] : mm.csapat[Number(o.slice(1))];
        var mn = o.charAt(0) === 'u' ? minU : minT, mx = o.charAt(0) === 'u' ? maxU : maxT;
        if (mod === 'B' && n > mn) ki.push({ oldal: o, meccs: m.id, db: n - mn, plusz: 0 });
        if (mod === 'A' && n < mx) ki.push({ oldal: o, meccs: m.id, db: 0, plusz: mx - n });
      });
    });
    return ki;
  }

  function pihenoKulcs(kor) { return 'P' + kor; }

  // Ki hányszor pihent már (a megadott kör kivételével)
  function pihenoSzamlalo(cfg, beirasok, kivetelKor) {
    var u = utolsoBeirasok(beirasok), sz = {};
    Object.keys(u).forEach(function (k) {
      var b = u[k];
      if (String(b.meccs).charAt(0) !== 'P' || b.meccs === pihenoKulcs(kivetelKor)) return;
      ((b.adat && b.adat.pihen) || []).forEach(function (id) { sz[id] = (sz[id] || 0) + 1; });
    });
    return sz;
  }

  // Egy oldal pihenő-választása egy körben
  function pihenoValasztas(cfg, beirasok, kor, oldal) {
    var ig = korIgenyek(cfg, kor).filter(function (x) { return x.oldal === oldal && x.db > 0; })[0];
    if (!ig) return null;
    var sz = pihenoSzamlalo(cfg, beirasok, kor);
    var jeloltek = oldalTagok(cfg, oldal).map(function (t) { return { id: t.id, nev: t.nev, szam: sz[t.id] || 0 }; });
    // Küszöb: a legkevesebbet pihentek közül kell választani; ha kevesen vannak, a következő szint is jöhet
    var szintek = jeloltek.map(function (j) { return j.szam; }).sort(function (a, b) { return a - b; });
    var kuszob = szintek[Math.min(ig.db, szintek.length) - 1];
    jeloltek.forEach(function (j) { j.tilt = j.szam > kuszob; });
    var u = utolsoBeirasok(beirasok)[oldalKulcs(pihenoKulcs(kor), oldal)];
    return { db: ig.db, jeloltek: jeloltek, valasztott: (u && u.adat && u.adat.pihen) || [] };
  }

  // Hibaszöveg vagy null
  function pihenoEllenor(cfg, beirasok, kor, oldal, lista) {
    var v = pihenoValasztas(cfg, beirasok, kor, oldal);
    if (!v) return 'Ebben a körben nálatok nincs pihenő.';
    if (!Array.isArray(lista) || lista.length !== v.db) return 'Pontosan ' + v.db + ' főt kell kiválasztani.';
    var seen = {};
    for (var i = 0; i < lista.length; i++) {
      var j = v.jeloltek.filter(function (x) { return x.id === lista[i]; })[0];
      if (!j || seen[lista[i]]) return 'Hibás választás.';
      if (j.tilt) return j.nev + ' már pihent – most más következik.';
      seen[lista[i]] = 1;
    }
    return null;
  }

  // ---------------------------------------------------------
  // Idő
  // ---------------------------------------------------------
  // Állomás-körök játékideje a teljes időkeretből (perc)
  function allomasPerc(beallit, jatekok, allomasKorok) {
    var valt = Number(beallit.valtasPerc) || 0, egyszerre = 0;
    (jatekok || []).forEach(function (j) { if (j.egyszerre) egyszerre += (Number(j.hanyszor) || 0) * ((Number(j.perc) || 0) + valt); });
    if (!allomasKorok) return 0;
    return Math.max(3, Math.floor((Number(beallit.osszIdo) - egyszerre) / allomasKorok) - valt);
  }
  function osszIdo(cfg) {
    var valt = Number((cfg.beallit || {}).valtasPerc) || 0;
    return (cfg.menetrend || []).reduce(function (s, k) { return s + k.perc + valt; }, 0);
  }

  function hatraLevo(cfg, most) {
    if (!cfg || !cfg.kor || cfg.korStart == null || !cfg.menetrend) return null;
    if (cfg.korLezarva) return 0;
    var perc = cfg.menetrend[cfg.kor - 1].perc;
    var ref = cfg.szunetKezd ? cfg.szunetKezd : most;
    return perc * 60000 - (ref - cfg.korStart);
  }

  var Logika = {
    MIN_JATEKOS: MIN_JATEKOS, MAX_JATEKOS: MAX_JATEKOS, MAX_EGYENI: MAX_EGYENI,
    eloszt: eloszt, csapatBeosztas: csapatBeosztas, valtozatok: valtozatok, egysegSzam: egysegSzam, hatekonySzint: hatekonySzint,
    oldalCsapat: oldalCsapat, oldalEgysegek: oldalEgysegek, oldalTagok: oldalTagok, oldalNev: oldalNev, oldalRovidNev: oldalRovidNev, tagNevek: tagNevek,
    jatekTar: jatekTar, meccsLista: meccsLista, meccsKeres: meccsKeres, oldalKulcs: oldalKulcs, utolsoBeirasok: utolsoBeirasok,
    ervenyesAdat: ervenyesAdat, kiertekel: kiertekel, meccsAllapot: meccsAllapot, allasSzamol: allasSzamol,
    meretek: meretek, korIgenyek: korIgenyek, pihenoKulcs: pihenoKulcs, pihenoSzamlalo: pihenoSzamlalo,
    pihenoValasztas: pihenoValasztas, pihenoEllenor: pihenoEllenor,
    allomasPerc: allomasPerc, osszIdo: osszIdo, hatraLevo: hatraLevo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logika;
  else gyoker.Logika = Logika;
})(typeof globalThis !== 'undefined' ? globalThis : this);
