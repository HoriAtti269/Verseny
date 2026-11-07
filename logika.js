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
    if (!/^[ut]\d+$/.test(o)) return ki;
    oldalEgysegek(cfg, o).forEach(function (u) {
      (egysegAdat(cfg, u).tagok || []).forEach(function (nev, i) {
        ki.push({ id: Math.floor(u / K) + '.' + (u % K) + '.' + i, nev: nev || ('Játékos ' + (i + 1)) });
      });
    });
    return ki;
  }
  function oldalNev(cfg, o) {
    if (!/^[ut]\d+$/.test(o)) return refNev(cfg, o);
    var t = oldalCsapat(cfg, o), cs = cfg.csapatok[t] || {};
    if (o.charAt(0) === 't' || K_(cfg) === 1) return cs.nev || ((t + 1) + '. csapat');
    var u = Number(o.slice(1));
    return (cs.nev || ((t + 1) + '. csapat')) + ' – ' + (egysegAdat(cfg, u).nev || ('Egység ' + (u % K_(cfg) + 1)));
  }
  function oldalRovidNev(cfg, o) {
    if (!/^[ut]\d+$/.test(o) || o.charAt(0) === 't' || K_(cfg) === 1) return oldalNev(cfg, o);
    var u = Number(o.slice(1));
    return egysegAdat(cfg, u).nev || oldalNev(cfg, o);
  }
  function tagNevek(cfg, o) { return oldalTagok(cfg, o).map(function (x) { return x.nev; }).filter(Boolean).join(', '); }

  // ---------------------------------------------------------
  // Menetrend → meccslista
  // ---------------------------------------------------------
  function jatekTar(cfg) { var t = {}; (cfg.jatekok || []).forEach(function (j) { t[j.id] = j; }); return t; }

  // beirasok megadásával a kieséses hivatkozások (K:, W:, L:) feloldódnak valódi oldalakra
  function meccsLista(cfg, beirasok) {
    var lista = [], jt = jatekTar(cfg);
    (cfg.menetrend || []).forEach(function (kor, r) {
      kor.meccsek.forEach(function (m) {
        lista.push({ id: m.id, kor: r + 1, jatek: jt[m.jatek], jatekId: m.jatek, palya: m.palya, oldalak: m.oldalak.slice(), eredeti: m.oldalak,
          egyszerre: kor.tipus === 'egyszerre', kieses: kor.tipus === 'kieses', szakasz: kor.szakasz || null,
          cimke: m.cimke || null, csoport: m.csoport == null ? null : m.csoport });
      });
    });
    if (beirasok && cfg.agrajz) feloldas(cfg, lista, utolsoBeirasok(beirasok));
    return lista;
  }
  function meccsKeres(cfg, id, beirasok) {
    var l = meccsLista(cfg, beirasok);
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function valodiOldal(o) { return typeof o === 'string' && /^[ut]\d+$/.test(o); }
  function meccsKesz(m) { return valodiOldal(m.oldalak[0]) && (m.oldalak.length < 2 || valodiOldal(m.oldalak[1])); }

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
  function ervenyesAdat(jatek, d, kieses) {
    if (kieses) {
      if (!d || typeof d.tovabb !== 'boolean') return false;
      if ((jatek.eredmeny || {}).mod === 'gyd' && d.e !== (d.tovabb ? 'gy' : 'v')) return false;
    }
    return ervenyesAlap(jatek, d);
  }
  function ervenyesAlap(jatek, d) {
    if (!jatek || !d || typeof d !== 'object') return false;
    var e = jatek.eredmeny || {};
    if (jatek.tipus === 'pontgyujto') return e.mod === 'helyezes' ? egeszE(d.sz, 1, Number(e.max) || MAX_JATEKOS) : egeszE(d.sz, 0, Number(e.max) || 0);
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
    if (!meccsKesz(m)) return { allapot: 'ures', fuggo: true };
    var ea = u[oldalKulcs(m.id, a)], eb = u[oldalKulcs(m.id, b)], ad = u[oldalKulcs(m.id, 'admin')];
    var da = ea && ervenyesAdat(j, ea.adat, m.kieses) ? ea.adat : null;
    var db = eb && ervenyesAdat(j, eb.adat, m.kieses) ? eb.adat : null;
    var sz = da && db ? kiertekel(j, da, db) : null;
    if (m.kieses && sz) {
      // kiesésben mindig van továbbjutó: a két beírásnak egyeznie kell, és nem mondhat ellent a számoknak
      var g0 = da.tovabb && !db.tovabb ? 'a' : !da.tovabb && db.tovabb ? 'b' : null;
      if (!g0 || sz.gyoztes === null || (sz.gyoztes !== 'd' && sz.gyoztes !== g0)) sz = { gyoztes: null, folA: 0 };
      else sz = { gyoztes: g0, folA: sz.folA };
    }
    if (ad && ad.adat && (m.kieses ? ['a', 'b'] : ['a', 'b', 'd']).indexOf(ad.adat.gyoztes) >= 0) {
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
  function helyezesPontok(sorok, maxPont, kevesebb) {
    // holtversenyben átlagolt helyezés; 1. = maxPont, utolsó = 0 (csapatversenyben, a régi Kupával egyezően)
    var N = sorok.length, s = sorok.slice().sort(function (x, y) { return kevesebb ? x.ossz - y.ossz : y.ossz - x.ossz; }), p = 0;
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
    if (egyeniE(cfg)) return egyeniAllas(cfg, beirasok);   // egyéni: helyezés-alapú összesítés
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
      if (m.jatek.tipus === 'pontgyujto') { pontSor(cfg, tablak[m.jatekId], m, a); return; }
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

    // Pontgyűjtő játékok (csapatversenyben a helyezési pont átlagolt, a régi Kupával egyezően)
    var ptTar = {};
    Object.keys(tablak).forEach(function (id) {
      var t = pontTablaZar(tablak[id], false);
      if (t.ertek !== 'helyezes' || t.kesz) t.sorok.forEach(function (s) { jovair(s.oldal, s.pont, 0, null); });
      ptTar[id] = t;
    });
    // Minden játéknak saját tábla, a játékok sorrendjében (a párharcé csak tájékoztató)
    var jatekTablak = (cfg.jatekok || []).map(function (j) { return j.tipus === 'pontgyujto' ? ptTar[j.id] : parharcTabla(cfg, j, meccsek, u, false); });

    [egysegek, csapatok].forEach(function (l) { l.forEach(function (x) { x.pont = kerekit(x.pont, 2); x.fol = kerekit(x.fol, 2); delete x.ellen; }); });
    return { K: K, egysegek: rendez(egysegek), csapatok: rendez(csapatok), jatekTablak: jatekTablak };
  }

  // ---------------------------------------------------------
  // Helyezések: sport-sorrend (1., 1., 3.), játékonkénti táblák, egyéni összesítés
  // ---------------------------------------------------------
  function egyeniE(cfg) { return Number((cfg.beallit || {}).meret) === 1; }
  function osszesitesMod(cfg) { return egyeniE(cfg) && (cfg.beallit || {}).osszesites === 'helyezes' ? 'helyezes' : 'pont'; }
  // Pontgyűjtőnél a kisebb-e a jobb: „Kevesebb a jobb”, vagy helyezést írnak be
  function kevesebbJobb(j) { var e = j.eredmeny || {}; return e.mod === 'helyezes' || e.jobb === 'kevesebb'; }
  // A ténylegesen használt érték: ha a kisebb a jobb, csak helyezés szerint számolható
  function ertekMod(j) { return j.tipus === 'pontgyujto' && kevesebbJobb(j) ? 'helyezes' : j.ertek; }
  // Rendezett sorokra helyezést ír; az egyenlők ugyanazt kapják, a következő kimarad
  function sportHely(sorok, egyenlo) {
    sorok.forEach(function (s, i) { s.hely = i > 0 && egyenlo(sorok[i - 1], s) ? sorok[i - 1].hely : i + 1; });
  }
  // Helyezésből pont: 1. = maxPont, utolsó = 0; holtversenyben mindenki a jobb hely pontját kapja
  function helyPont(hely, N, maxPont) { return N > 1 ? kerekit(maxPont * (N - hely) / (N - 1), 1) : maxPont; }

  // Egy pontgyűjtő meccs beírása a játék táblájába
  function pontSor(cfg, tb, m, a) {
    var o = m.oldalak[0];
    tb.ossz++;
    if (!tb.sorok[o]) tb.sorok[o] = { oldal: o, nev: oldalNev(cfg, o), tagok: tagNevek(cfg, o), reszek: [], ossz: 0, pont: 0 };
    if (a.allapot === 'ok') { tb.sorok[o].reszek.push(a.sz); tb.sorok[o].ossz += a.sz; tb.db++; }
  }
  // Pontgyűjtő tábla lezárása: sorrend, helyezés, pont
  function pontTablaZar(tb, egyeni) {
    var j = tb.jatek, mod = ertekMod(j), kev = kevesebbJobb(j), max = Number(j.maxPont) || 12;
    var sorok = Object.keys(tb.sorok).map(function (k) { return tb.sorok[k]; });
    var kesz = tb.ossz > 0 && tb.db === tb.ossz;
    sorok.sort(function (x, y) { return kev ? x.ossz - y.ossz : y.ossz - x.ossz; });
    sportHely(sorok, function (x, y) { return x.ossz === y.ossz; });
    if (mod === 'helyezes') {
      if (kesz) { if (egyeni) sorok.forEach(function (s) { s.pont = helyPont(s.hely, sorok.length, max); }); else helyezesPontok(sorok, max, kev); }
    } else sorok.forEach(function (s) { s.pont = s.ossz; });
    return { jatekId: j.id, nev: j.nev, tipus: 'pontgyujto', ertek: mod, kevesebb: kev, sorok: sorok, kesz: kesz, db: tb.db, ossz: tb.ossz };
  }
  // Párharc-játék saját tabellája (3-1-0, egymás elleni, különbség, szerzett pont) helyezéssel
  function parharcTabla(cfg, j, lista, u, egyeni) {
    var K = K_(cfg), T = (cfg.csapatok || []).length, oldalak = [], i;
    if (hatekonySzint(j, K) === 'csapat') { for (i = 0; i < T; i++) oldalak.push('t' + i); }
    else for (i = 0; i < T * K; i++) oldalak.push('u' + i);
    var t = tabellaSzamol(cfg, lista.filter(function (m) { return m.jatekId === j.id; }), u, oldalak), max = Number(j.maxPont) || 12;
    sportHely(t.sorok, function (x, y) { return x.pont === y.pont && x.mini === y.mini && x.kul === y.kul && x.sz === y.sz; });
    if (egyeni && t.kesz) t.sorok.forEach(function (s) { s.hp = helyPont(s.hely, t.sorok.length, max); });
    return { jatekId: j.id, nev: j.nev, tipus: 'parharc', sorok: t.sorok, kesz: t.kesz, db: t.db, ossz: t.ossz };
  }

  // Egyéni verseny összesítése: minden játékból helyezés lesz (csak a kész játéké számít)
  //  - Pontok: a helyezés pontot ér (pontgyűjtő „Pontok összege” módban a nyers pont), a több nyer
  //  - Helyezési számok: a helyezések összeadódnak, a kevesebb nyer
  function egyeniAllas(cfg, beirasok) {
    var u = utolsoBeirasok(beirasok), lista = meccsLista(cfg), mod = osszesitesMod(cfg), T = (cfg.csapatok || []).length, i;
    var sorok = [];
    for (i = 0; i < T; i++) sorok.push({ id: i, oldal: 'u' + i, nev: oldalNev(cfg, 'u' + i), tagok: tagNevek(cfg, 'u' + i), pont: 0, helyOssz: 0, gy: 0, d: 0, v: 0, fol: 0, buch: 0, jatszott: 0, reszek: [] });
    var tablak = {};
    (cfg.jatekok || []).forEach(function (j) { if (j.tipus === 'pontgyujto') tablak[j.id] = { jatek: j, sorok: {}, db: 0, ossz: 0 }; });
    lista.forEach(function (m) { if (m.jatek && m.jatek.tipus === 'pontgyujto') pontSor(cfg, tablak[m.jatekId], m, meccsAllapot(m, u)); });
    var jatekTablak = (cfg.jatekok || []).map(function (j) { return j.tipus === 'pontgyujto' ? pontTablaZar(tablak[j.id], true) : parharcTabla(cfg, j, lista, u, true); });
    var kesz = 0;
    jatekTablak.forEach(function (t) {
      if (t.kesz) kesz++;
      t.sorok.forEach(function (s) {
        var r = sorok[Number(s.oldal.slice(1))];
        if (!r) return;
        var resz = { jatekId: t.jatekId, nev: t.nev, hely: t.kesz ? s.hely : null, pont: null };
        if (mod === 'helyezes') { if (t.kesz) r.helyOssz += s.hely; }
        else if (t.tipus === 'pontgyujto' && t.ertek !== 'helyezes') { resz.pont = s.ossz; r.pont += s.ossz; }
        else if (t.kesz) { resz.pont = t.tipus === 'parharc' ? s.hp : s.pont; r.pont += resz.pont; }
        r.reszek.push(resz);
      });
    });
    sorok.forEach(function (r) { r.pont = kerekit(r.pont, 2); });
    sorok.sort(function (x, y) { return (mod === 'helyezes' ? x.helyOssz - y.helyOssz : y.pont - x.pont) || String(x.nev).localeCompare(String(y.nev), 'hu'); });
    sportHely(sorok, function (x, y) { return mod === 'helyezes' ? x.helyOssz === y.helyOssz : x.pont === y.pont; });
    return { K: 1, egyeni: true, osszesites: mod, egysegek: sorok, csapatok: sorok, jatekTablak: jatekTablak, keszJatek: kesz };
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
  function korIgenyek(cfg, kor, beirasok) {
    var ki = [], mod = (cfg.beallit || {}).kulonbseg === 'A' ? 'A' : 'B', mm = meretek(cfg);
    var minU = Math.min.apply(null, mm.egyseg), maxU = Math.max.apply(null, mm.egyseg);
    var minT = Math.min.apply(null, mm.csapat), maxT = Math.max.apply(null, mm.csapat);
    meccsLista(cfg, beirasok).forEach(function (m) {
      if (m.kor !== kor || !m.jatek || m.jatek.kiegyenlit === false) return;
      m.oldalak.forEach(function (o) {
        if (!valodiOldal(o)) return;
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
    var ig = korIgenyek(cfg, kor, beirasok).filter(function (x) { return x.oldal === oldal && x.db > 0; })[0];
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
  // Bajnokság egy játékra: tabella, csoportkör, ágrajz
  // ---------------------------------------------------------
  var BETUK = 'ABCDEFGHIJKLMNOP';
  function csoportNev(g) { return BETUK.charAt(g) + ' csoport'; }
  function szakaszNev(slot) {
    return { 2: 'Döntő', 4: 'Elődöntő', 8: 'Negyeddöntő', 16: 'Nyolcaddöntő', 32: 'Tizenhatoddöntő', 64: '1/32-es döntő' }[slot] || (slot + '-as kör');
  }
  // Egyjátékos párharc-verseny-e (erre vonatkozik a tabella-szabály és az ágrajz)
  function bajnoksagE(cfg) {
    var j = (cfg.jatekok || []);
    return j.length === 1 && j[0].tipus === 'parharc' && !j[0].egyszerre;
  }
  function resztvevoOldalak(cfg) {
    var K = K_(cfg), T = (cfg.csapatok || []).length, j = (cfg.jatekok || [])[0], ki = [];
    if (j && hatekonySzint(j, K) === 'csapat') { for (var t = 0; t < T; t++) ki.push('t' + t); }
    else for (var u = 0; u < T * K; u++) ki.push('u' + u);
    return ki;
  }
  // Megnevezés egy még el nem dőlt oldalhoz
  function refNev(cfg, o) {
    if (typeof o !== 'string') return '?';
    var t = o.charAt(0), x = o.slice(2);
    if (t === 'K') return cfg.agrajz && cfg.agrajz.csoportok ? 'a csoportkör után dől el' : 'sorsolás alapján';
    var cim = null;
    (cfg.menetrend || []).forEach(function (k) { k.meccsek.forEach(function (m) { if (m.id === x) cim = m.cimke; }); });
    return (cim || 'előző meccs') + (t === 'W' ? ' győztese' : ' vesztese');
  }
  // Szerzett pontok egy meccsen a játék számaiból (a pontkülönbséghez)
  function szerzettPontok(j, da, db) {
    if (!da || !db) return { a: 0, b: 0 };
    var e = j.eredmeny || {};
    if (e.mod === 'cel' && e.irany === 'le') return { a: Number(e.cel) - da.sz, b: Number(e.cel) - db.sz };
    if (e.mod === 'cel' || e.mod === 'tobb') return { a: da.sz, b: db.sz };
    if (e.mod === 'gyd' && e.szam) return e.szam.jobb === 'kevesebb' ? { a: Number(e.szam.max) - da.sz, b: Number(e.szam.max) - db.sz } : { a: da.sz, b: db.sz };
    return { a: 0, b: 0 };
  }
  // Tabella: pont, majd holtversenyben egymás elleni (körbeverésnél mini-tabella), pontkülönbség, szerzett pont
  function tabellaSzamol(cfg, lista, u, oldalak) {
    var sor = {}, eredm = [], ossz = 0, kesz = 0;
    oldalak.forEach(function (o) { sor[o] = { oldal: o, nev: oldalNev(cfg, o), tagok: tagNevek(cfg, o), pont: 0, gy: 0, d: 0, v: 0, sz: 0, kap: 0, kul: 0, jatszott: 0, mini: 0 }; });
    lista.forEach(function (m) {
      if (!m.jatek || m.jatek.tipus !== 'parharc' || m.oldalak.length !== 2) return;
      var a = m.oldalak[0], b = m.oldalak[1];
      if (!sor[a] || !sor[b]) return;
      ossz++;
      var st = meccsAllapot(m, u);
      if (st.allapot !== 'ok') return;
      kesz++;
      var pa = st.gyoztes === 'a' ? 3 : st.gyoztes === 'd' ? 1 : 0, pb = st.gyoztes === 'b' ? 3 : st.gyoztes === 'd' ? 1 : 0;
      var p = szerzettPontok(m.jatek, st.da, st.db);
      [[a, pa, p.a, p.b], [b, pb, p.b, p.a]].forEach(function (x) {
        var r = sor[x[0]];
        r.pont += x[1]; r.jatszott++; r.sz += x[2]; r.kap += x[3];
        if (x[1] === 3) r.gy++; else if (x[1] === 1) r.d++; else r.v++;
      });
      eredm.push({ a: a, b: b, pa: pa, pb: pb });
    });
    var l = Object.keys(sor).map(function (k) { var r = sor[k]; r.kul = r.sz - r.kap; return r; });
    l.sort(function (x, y) { return y.pont - x.pont; });
    var ki = [], i = 0;
    while (i < l.length) {
      var j2 = i;
      while (j2 + 1 < l.length && l[j2 + 1].pont === l[i].pont) j2++;
      var blokk = l.slice(i, j2 + 1);
      if (blokk.length > 1) {
        var benne = {};
        blokk.forEach(function (x) { benne[x.oldal] = 1; x.mini = 0; });
        eredm.forEach(function (e) { if (benne[e.a] && benne[e.b]) { sor[e.a].mini += e.pa; sor[e.b].mini += e.pb; } });
        blokk.sort(function (x, y) { return (y.mini - x.mini) || (y.kul - x.kul) || (y.sz - x.sz) || String(x.nev).localeCompare(String(y.nev), 'hu'); });
        for (var q = 1; q < blokk.length; q++) if (blokk[q].mini !== blokk[q - 1].mini) blokk[q - 1].egymasEllen = blokk[q].egymasEllen = true;
      }
      ki = ki.concat(blokk);
      i = j2 + 1;
    }
    return { sorok: ki, kesz: ossz > 0 && kesz === ossz, ossz: ossz, db: kesz };
  }

  // Kiemelések: seed (1..Q) → oldal; csoportkörnél csak ha minden csoportmeccs kész
  function seedFelold(cfg, lista, u) {
    var ag = cfg.agrajz;
    if (!ag) return null;
    if (ag.seedek) return ag.seedek;
    var tablak = ag.csoportok.map(function (cs, g) { return tabellaSzamol(cfg, lista.filter(function (m) { return m.csoport === g; }), u, cs); });
    if (!tablak.every(function (t) { return t.kesz; })) return null;
    var G = tablak.length, T = ag.tovabb, B = ag.B, seed = new Array(ag.Q), poz = seedPozicio(B);
    // 1. helyezettek: teljesítmény szerint (pont, különbség, szerzett pont)
    var elsok = tablak.map(function (t, g) { return { r: t.sorok[0], g: g }; });
    elsok.sort(function (x, y) { return (y.r.pont - x.r.pont) || (y.r.kul - x.r.kul) || (y.r.sz - x.r.sz) || (x.g - y.g); });
    var csoportja = {};
    elsok.forEach(function (x, i) { seed[i] = x.r.oldal; csoportja[i + 1] = x.g; });
    // további helyezettek: úgy, hogy az azonos csoportbeliek minél később találkozzanak
    for (var h = 1; h < T; h++) {
      var jeloltek = tablak.map(function (t, g) { return { o: t.sorok[h].oldal, g: g }; });
      var helyek = []; for (var k = 0; k < G; k++) helyek.push(h * G + k + 1);
      var legjobb = null, legjobbP = Infinity;
      permutaciok(jeloltek.length, function (perm) {
        var p = 0;
        perm.forEach(function (ji, hi) {
          var s1 = helyek[hi], g1 = jeloltek[ji].g;
          for (var s2 = 1; s2 < s1; s2++) {
            if (csoportja[s2] !== g1) continue;
            var talal = Math.floor(Math.log(poz[s1] ^ poz[s2]) / Math.LN2) + 1;   // ebben a körben találkozhatnak
            var R = Math.log(B) / Math.LN2;
            p += Math.pow(R - talal + 1, 3);
          }
        });
        if (p < legjobbP) { legjobbP = p; legjobb = perm.slice(); }
      });
      legjobb.forEach(function (ji, hi) { seed[helyek[hi] - 1] = jeloltek[ji].o; csoportja[helyek[hi]] = jeloltek[ji].g; });
    }
    return seed;
  }
  function permutaciok(n, fn) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    if (n > 8) { fn(a); return; }   // nagyon sok csoportnál nincs keresés
    (function rek(k) {
      if (k === n) { fn(a); return; }
      for (var i2 = k; i2 < n; i2++) { var x = a[k]; a[k] = a[i2]; a[i2] = x; rek(k + 1); x = a[k]; a[k] = a[i2]; a[i2] = x; }
    })(0);
  }
  // seed → pozíció (0-tól) a B-s ágrajzban
  function seedSorrend(B) {
    var o = [1];
    while (o.length < B) { var n = o.length * 2, uj = []; o.forEach(function (x) { uj.push(x, n + 1 - x); }); o = uj; }
    return o;
  }
  function seedPozicio(B) { var p = {}; seedSorrend(B).forEach(function (s, i) { p[s] = i; }); return p; }

  function feloldas(cfg, lista, u) {
    var tar = {}, kesz = {}, seedek = null, seedKesz = false;
    lista.forEach(function (m) { tar[m.id] = m; });
    function seedKer() { if (!seedKesz) { seedKesz = true; seedek = seedFelold(cfg, lista, u); } return seedek; }
    function egy(ref) {
      if (valodiOldal(ref)) return ref;
      var t = ref.charAt(0), x = ref.slice(2);
      if (t === 'K') { var sd = seedKer(), s = Number(x); return sd && sd[s - 1] ? sd[s - 1] : ref; }
      var m = tar[x];
      if (!m) return ref;
      felold(m);
      if (!meccsKesz(m)) return ref;
      var a = meccsAllapot(m, u);
      if (a.allapot !== 'ok' || (a.gyoztes !== 'a' && a.gyoztes !== 'b')) return ref;
      var gy = a.gyoztes === 'a' ? m.oldalak[0] : m.oldalak[1], ve = a.gyoztes === 'a' ? m.oldalak[1] : m.oldalak[0];
      return t === 'W' ? gy : ve;
    }
    function felold(m) { if (kesz[m.id]) return; kesz[m.id] = 1; m.oldalak = m.eredeti.map(egy); }
    // a csoportmeccsek oldalai fixek; a kiemelést előbb kell kiszámolni, mint a K: hivatkozásokat
    lista.forEach(function (m) { if (!m.kieses) kesz[m.id] = 1; });
    lista.forEach(felold);
  }

  // Egyjátékos verseny állása: tabellák (körmérkőzés / csoportok) + ágrajz
  function bajnoksagAllas(cfg, beirasok) {
    var u = utolsoBeirasok(beirasok), lista = meccsLista(cfg, beirasok), ag = cfg.agrajz, ki = { tabellak: [], agrajz: null };
    if (!ag) {
      var t0 = tabellaSzamol(cfg, lista, u, resztvevoOldalak(cfg));
      t0.nev = 'Tabella'; ki.tabellak.push(t0);
      return ki;
    }
    if (ag.csoportok) ag.csoportok.forEach(function (cs, g) {
      var t = tabellaSzamol(cfg, lista.filter(function (m) { return m.csoport === g; }), u, cs);
      t.nev = csoportNev(g); t.tovabb = ag.tovabb; ki.tabellak.push(t);
    });
    var szakaszok = [], idx = {};
    function sz(nev) { if (idx[nev] === undefined) { idx[nev] = szakaszok.length; szakaszok.push({ nev: nev, tetelek: [] }); } return szakaszok[idx[nev]]; }
    var seedek = seedFelold(cfg, lista, u);
    (ag.eronyerok || []).forEach(function (e) {
      var s = Number(e.ref.slice(2)), o = seedek && seedek[s - 1] ? seedek[s - 1] : e.ref;
      sz(e.szakasz).tetelek.push({ bye: true, oldal: o, seed: s });
    });
    var dontoM = null, bronz = null;
    lista.forEach(function (m) {
      if (!m.kieses) return;
      var st = meccsKesz(m) ? meccsAllapot(m, u) : { allapot: 'ures', fuggo: true };
      sz(m.szakasz).tetelek.push({ m: m, st: st });
      if (m.cimke === 'Döntő') dontoM = { m: m, st: st };
      if (m.cimke === 'Bronzmeccs') bronz = { m: m, st: st };
    });
    // a tételek sorrendje: a meccsek címkéje szerint (erőnyerők a helyükön)
    var vegeredmeny = [];
    function gyv(x) { return x.st.gyoztes === 'a' ? [x.m.oldalak[0], x.m.oldalak[1]] : [x.m.oldalak[1], x.m.oldalak[0]]; }
    if (dontoM && dontoM.st.allapot === 'ok') {
      var d = gyv(dontoM);
      vegeredmeny.push({ hely: 1, oldal: d[0] }, { hely: 2, oldal: d[1] });
      if (bronz && bronz.st.allapot === 'ok') { var b = gyv(bronz); vegeredmeny.push({ hely: 3, oldal: b[0] }, { hely: 4, oldal: b[1] }); }
      else if (!bronz) {
        lista.forEach(function (m) {
          if (m.kieses && m.szakasz === 'Elődöntő' && meccsKesz(m)) {
            var s2 = meccsAllapot(m, u);
            if (s2.allapot === 'ok') vegeredmeny.push({ hely: 3, oldal: s2.gyoztes === 'a' ? m.oldalak[1] : m.oldalak[0] });
          }
        });
      }
    }
    ki.agrajz = { szakaszok: szakaszok, vegeredmeny: vegeredmeny, csoportKesz: !!seedek };
    return ki;
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
    allomasPerc: allomasPerc, osszIdo: osszIdo, hatraLevo: hatraLevo,
    valodiOldal: valodiOldal, meccsKesz: meccsKesz, csoportNev: csoportNev, szakaszNev: szakaszNev, bajnoksagE: bajnoksagE,
    resztvevoOldalak: resztvevoOldalak, refNev: refNev, szerzettPontok: szerzettPontok, tabellaSzamol: tabellaSzamol,
    seedSorrend: seedSorrend, seedFelold: seedFelold, bajnoksagAllas: bajnoksagAllas,
    egyeniE: egyeniE, osszesitesMod: osszesitesMod, kevesebbJobb: kevesebbJobb, ertekMod: ertekMod, sportHely: sportHely, helyPont: helyPont
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logika;
  else gyoker.Logika = Logika;
})(typeof globalThis !== 'undefined' ? globalThis : this);
