/* =========================================================
   VERSENYMOTOR – sorsolo.js
   Menetrend-generátor (a böngészőben fut, a Sorsolás gombra)
   + tőle független ellenőrző.
   Bemenet (V): { beallit, jatekok, csapatok:[…], sablonId }
   ========================================================= */
(function (g) {
  'use strict';
  var L = g.Logika || (typeof require !== 'undefined' ? require('./logika.js') : null);
  var S = g.Sablonok || (typeof require !== 'undefined' ? require('./sablonok.js') : null);

  function veletlen(seed) {
    // determinisztikus, ha seed van (teszthez); különben Math.random
    if (seed == null) return Math.random;
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function kever(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function most() { return Date.now(); }

  // ---------------------------------------------------------
  // A feladat leírása
  // ---------------------------------------------------------
  function feladat(V) {
    var K = L.egysegSzam(V.beallit), T = V.csapatok.length, U = T * K;
    var allomas = [], egyszerre = [];
    (V.jatekok || []).forEach(function (j) {
      var lev = L.hatekonySzint(j, K);
      var d = { j: j, id: j.id, parharc: j.tipus === 'parharc', csapat: lev === 'csapat', h: Math.max(0, Number(j.hanyszor) || 0) };
      // résztvevőnkénti kvóta (verseny közbeni újrasorsolásnál eltérhet); alapból mindenki h-szor
      var kv = V.kvota && V.kvota[j.id], db = lev === 'csapat' ? T : T * K;
      d.hk = [];
      for (var x = 0; x < db; x++) d.hk.push(kv && typeof kv === 'object' ? Math.max(0, Number(kv[(lev === 'csapat' ? 't' : 'u') + x]) || 0) : d.h);
      if (kv != null && typeof kv !== 'object') d.h = Math.max(0, Number(kv) || 0);   // egyszerre-játék: fordulók száma
      if (kv && typeof kv === 'object') d.h = Math.max.apply(null, d.hk.concat([0]));
      d.ossz = d.hk.reduce(function (a, b) { return a + b; }, 0);
      if (j.egyszerre && j.tipus === 'pontgyujto') egyszerre.push(d);
      else { d.palyak = Math.max(1, Number(j.palyak) || 1); d.kap = d.palyak * (d.parharc ? 2 : 1); allomas.push(d); }
    });
    var nT = 0, nU = 0;
    allomas.forEach(function (d) { if (d.csapat) nT += d.h; else nU += d.h; });
    // a legterheltebb egység: a csapatjátékai + a saját egységjátékai
    var R = 0;
    for (var u0 = 0; u0 < U && allomas.length; u0++) {
      var ter = 0;
      allomas.forEach(function (d) { ter += d.csapat ? d.hk[Math.floor(u0 / K)] : d.hk[u0]; });
      R = Math.max(R, ter);
    }
    allomas.forEach(function (d) { if (d.ossz) R = Math.max(R, Math.ceil(d.ossz / d.kap)); });
    return { K: K, T: T, U: U, allomas: allomas, egyszerre: egyszerre, nT: nT, nU: nU, Rmin: R, elozmeny: V.elozmeny || [] };
  }

  // ---------------------------------------------------------
  // 1. fázis: ki mikor mit játszik (szimulált hűtés)
  // ---------------------------------------------------------
  function idobeosztas(F, R, rnd, hatarido) {
    var K = F.K, T = F.T, U = F.U, G = F.allomas.length, A = F.allomas;
    var tp = [], up = [], r, t, u, gi;
    // csapatonkénti (tlT) és egységenkénti (ulU) játéklista a kvóták szerint
    var tlT = [], ulU = [], vanT = false;
    for (t = 0; t < T; t++) { tlT.push([]); A.forEach(function (d, g2) { if (d.csapat) for (var k = 0; k < d.hk[t]; k++) tlT[t].push(g2); }); if (tlT[t].length) vanT = true; }
    for (u = 0; u < U; u++) { ulU.push([]); A.forEach(function (d, g2) { if (!d.csapat) for (var k = 0; k < d.hk[u]; k++) ulU[u].push(g2); }); }
    var cs = function (x) { return Math.floor(x / K); };

    // ---- kezdőállapot: véletlen ----
    for (t = 0; t < T; t++) {
      var sor = []; for (r = 0; r < R; r++) sor.push(-1);
      var korok = kever(Array.apply(null, { length: R }).map(function (_, x) { return x; }), rnd).slice(0, tlT[t].length);
      var jl = kever(tlT[t].slice(), rnd);
      korok.forEach(function (kr, x) { sor[kr] = jl[x]; });
      tp.push(sor);
      for (var k = 0; k < K; k++) {
        var us = sor.map(function (v) { return v >= 0 ? -2 : -1; });
        var szabad = []; for (r = 0; r < R; r++) if (us[r] === -1) szabad.push(r);
        kever(szabad, rnd);
        kever(ulU[t * K + k].slice(), rnd).forEach(function (g2, x) { us[szabad[x]] = g2; });
        up.push(us);
      }
    }

    // ---- számlálók: cnt[r][g] oldalak száma, tcnt[r][g][t] egy csapat egységei párharcban ----
    var cnt = [], tcnt = [];
    for (r = 0; r < R; r++) {
      cnt.push(new Int32Array(G)); var tr = [];
      for (gi = 0; gi < G; gi++) tr.push(new Int32Array(T));
      tcnt.push(tr);
    }
    function be(u2, r2, v) { if (v >= 0) { cnt[r2][v]++; if (A[v].parharc) tcnt[r2][v][cs(u2)]++; } }
    function ki(u2, r2, v) { if (v >= 0) { cnt[r2][v]--; if (A[v].parharc) tcnt[r2][v][cs(u2)]--; } }
    for (u = 0; u < U; u++) for (r = 0; r < R; r++) be(u, r, up[u][r]);
    for (t = 0; t < T; t++) for (r = 0; r < R; r++) if (tp[t][r] >= 0) cnt[r][tp[t][r]]++;

    function kemeny(r2) {
      var c = 0;
      for (var g2 = 0; g2 < G; g2++) {
        var d = A[g2], n = cnt[r2][g2];
        if (n > d.kap) c += n - d.kap;
        if (d.parharc) {
          if (n % 2) c += 1;
          if (!d.csapat && n) { var mx = 0, tc = tcnt[r2][g2]; for (var x = 0; x < T; x++) if (tc[x] > mx) mx = tc[x]; if (2 * mx > n) c += 2 * mx - n; }
        }
      }
      return c;
    }
    function puhaPar(r2) {
      if (r2 < 0 || r2 >= R - 1) return 0;
      var c = 0, x;
      for (x = 0; x < U; x++) { var a = up[x][r2], b = up[x][r2 + 1]; if (a === -1 && b === -1) c += 1; else if (a >= 0 && a === b) c += 0.2; }
      for (x = 0; x < T; x++) if (tp[x][r2] >= 0 && tp[x][r2 + 1] >= 0) c += 1;
      return c;
    }
    function puhaKor(r2) {
      if (K < 2) return 0;
      var c = 0;
      for (var x = 0; x < T; x++) {
        var mind = true;
        for (var k2 = 0; k2 < K; k2++) if (up[x * K + k2][r2] !== -1) { mind = false; break; }
        if (mind) c += 0.5;
      }
      return c;
    }
    var WS = 0.02;   // puha súly a kemény mellett
    function koltseg(a, b) {
      var c = 0, par = {};
      [a, b].forEach(function (x) { c += kemeny(x) + WS * puhaKor(x); par[x - 1] = 1; par[x] = 1; });
      Object.keys(par).forEach(function (p) { c += WS * puhaPar(Number(p)); });
      return c;
    }
    var kem = [], kemOssz = 0, puhaOssz = 0;
    for (r = 0; r < R; r++) { kem.push(kemeny(r)); kemOssz += kem[r]; puhaOssz += puhaKor(r) + puhaPar(r); }
    var aktualis = kemOssz + WS * puhaOssz;

    function alkalmazU(u2, a, b) { var x = up[u2][a], y = up[u2][b]; ki(u2, a, x); ki(u2, b, y); up[u2][a] = y; up[u2][b] = x; be(u2, a, y); be(u2, b, x); }
    function alkalmazT(t2, a, b) {
      var ta = tp[t2][a], tb = tp[t2][b];
      if (tb === -1) {
        for (var k2 = 0; k2 < K; k2++) { var x = t2 * K + k2, vb = up[x][b]; ki(x, b, vb); up[x][a] = vb; be(x, a, vb); up[x][b] = -2; }
      } else if (ta === -1) {
        for (var k3 = 0; k3 < K; k3++) { var y = t2 * K + k3, va = up[y][a]; ki(y, a, va); up[y][b] = va; be(y, b, va); up[y][a] = -2; }
      }
      if (ta >= 0) cnt[a][ta]--; if (tb >= 0) cnt[b][tb]--;
      tp[t2][a] = tb; tp[t2][b] = ta;
      if (tb >= 0) cnt[a][tb]++; if (ta >= 0) cnt[b][ta]++;
    }

    var legjobb = Infinity, legjobbAll = null;
    function ment() { legjobbAll = { tp: tp.map(function (x) { return x.slice(); }), up: up.map(function (x) { return x.slice(); }), kem: kemOssz }; }
    legjobb = aktualis; ment();
    var T0 = 0.6, hom = T0, iter = 0, utolsoJavulas = 0;
    var korLista = Array.apply(null, { length: R }).map(function (_, x) { return x; });

    while (true) {
      iter++;
      if ((iter & 511) === 0 && most() > hatarido) break;
      if (kemOssz === 0 && aktualis < 1e-9) break;
      if (legjobbAll && legjobbAll.kem === 0 && iter - utolsoJavulas > 20000) break;   // szabályos, és már nem javul
      hom = Math.max(0.01, hom * 0.9998);
      if (iter - utolsoJavulas > 30000) { hom = T0; utolsoJavulas = iter; }   // újramelegítés
      var r1, r2, mozg = null;
      if (kemOssz > 0 && rnd() < 0.85) {
        // ---- célzott lépés egy sértett körből ----
        do { r1 = Math.floor(rnd() * R); } while (kem[r1] === 0);
        var gondok = [];
        for (gi = 0; gi < G; gi++) {
          var d0 = A[gi], n0 = cnt[r1][gi];
          if (n0 > d0.kap || (d0.parharc && n0 % 2)) gondok.push(gi);
          else if (d0.parharc && !d0.csapat && n0) { var mx0 = 0; for (t = 0; t < T; t++) mx0 = Math.max(mx0, tcnt[r1][gi][t]); if (2 * mx0 > n0) gondok.push(gi); }
        }
        if (!gondok.length) continue;
        gi = gondok[Math.floor(rnd() * gondok.length)];
        var dg = A[gi];
        var cel = korLista.filter(function (x) { return x !== r1 && cnt[x][gi] < dg.kap; });
        if (dg.csapat) {
          var csl = []; for (t = 0; t < T; t++) if (tp[t][r1] === gi) csl.push(t);
          if (!csl.length) continue;
          t = csl[Math.floor(rnd() * csl.length)];
          var cel2 = cel.filter(function (x) { return tp[t][x] !== gi; });
          r2 = cel2.length && rnd() < 0.8 ? cel2[Math.floor(rnd() * cel2.length)] : Math.floor(rnd() * R);
          if (r2 === r1 || tp[t][r2] === gi) continue;
          mozg = { t: t };
        } else {
          var ul2 = [];
          for (u = 0; u < U; u++) if (up[u][r1] === gi) ul2.push(u);
          if (!ul2.length) continue;
          u = ul2[Math.floor(rnd() * ul2.length)];
          var cel3 = cel.filter(function (x) { return up[u][x] !== -2 && up[u][x] !== gi; });
          r2 = cel3.length && rnd() < 0.8 ? cel3[Math.floor(rnd() * cel3.length)] : Math.floor(rnd() * R);
          if (r2 === r1 || up[u][r2] === -2 || up[u][r2] === gi) continue;
          mozg = { u: u };
        }
      } else {
        r1 = Math.floor(rnd() * R); r2 = Math.floor(rnd() * R);
        if (r1 === r2) continue;
        if (vanT && rnd() < 0.3) {
          t = Math.floor(rnd() * T);
          if (tp[t][r1] < 0 && tp[t][r2] < 0) continue;
          if (tp[t][r1] === tp[t][r2]) continue;
          mozg = { t: t };
        } else {
          u = Math.floor(rnd() * U);
          if (up[u][r1] === -2 || up[u][r2] === -2 || up[u][r1] === up[u][r2]) continue;
          mozg = { u: u };
        }
      }
      var elotte = koltseg(r1, r2);
      if (mozg.u !== undefined) alkalmazU(mozg.u, r1, r2); else alkalmazT(mozg.t, r1, r2);
      var k1 = kemeny(r1), k2 = kemeny(r2);
      var utana = koltseg(r1, r2), delta = utana - elotte;
      var ujKem = kemOssz - kem[r1] - kem[r2] + k1 + k2;
      // ha már szabályos, szabályosat nem rontunk el
      var ok = (legjobbAll && legjobbAll.kem === 0 && ujKem > 0) ? false : (delta <= 0 || rnd() < Math.exp(-delta / hom));
      if (ok) {
        aktualis += delta; kemOssz = ujKem; kem[r1] = k1; kem[r2] = k2;
        if (aktualis < legjobb - 1e-9) { legjobb = aktualis; ment(); utolsoJavulas = iter; }
      } else {
        if (mozg.u !== undefined) alkalmazU(mozg.u, r1, r2); else alkalmazT(mozg.t, r2, r1);
      }
    }
    tp = legjobbAll.tp; up = legjobbAll.up;
    var hard = legjobbAll.kem;
    return { tp: tp, up: up, kemeny: hard, puha: (legjobb - hard) / WS };
  }

  // ---------------------------------------------------------
  // 2. fázis: párosítás körönként (ki kivel), legkevesebb ismétléssel
  // ---------------------------------------------------------
  function parositas(F, R, beo, rnd) {
    var K = F.K, cs = function (o) { var i = Number(o.slice(1)); return o.charAt(0) === 't' ? i : Math.floor(i / K); };
    var talal = {}, egysegCsapat = {}, csapatCsapat = {};
    function ck(a, b) { return Math.min(cs(a), cs(b)) + '|' + Math.max(cs(a), cs(b)); }
    function valt(p, d) {
      var a = p[0], b = p[1];
      talal[a + '|' + b] = (talal[a + '|' + b] || 0) + d; talal[b + '|' + a] = (talal[b + '|' + a] || 0) + d;
      csapatCsapat[ck(a, b)] = (csapatCsapat[ck(a, b)] || 0) + d;
      if (a.charAt(0) === 'u' && K > 1) {
        egysegCsapat[a + '>' + cs(b)] = (egysegCsapat[a + '>' + cs(b)] || 0) + d;
        egysegCsapat[b + '>' + cs(a)] = (egysegCsapat[b + '>' + cs(a)] || 0) + d;
      }
    }
    (F.elozmeny || []).forEach(function (p) { valt(p, 1); });   // verseny közben: a már lejátszott párosítások
    function suly(x, y) {
      if (cs(x) === cs(y)) return Infinity;
      var w = 10 * (talal[x + '|' + y] || 0) + (csapatCsapat[ck(x, y)] || 0);
      if (x.charAt(0) === 'u' && K > 1) w += 3 * ((egysegCsapat[x + '>' + cs(y)] || 0) + (egysegCsapat[y + '>' + cs(x)] || 0));
      return w + rnd() * 0.01;
    }
    function legjobbParok(l) {
      var n = l.length;
      if (n > 16) { // nagy: mohó
        var maradt = kever(l.slice(), rnd), parok = [];
        while (maradt.length) {
          var a = maradt.shift(), bi = -1, bw = Infinity;
          maradt.forEach(function (b, i) { var w = suly(a, b); if (w < bw) { bw = w; bi = i; } });
          if (bi < 0) return null;
          parok.push([a, maradt.splice(bi, 1)[0]]);
        }
        return parok;
      }
      var M = 1 << n, f = new Float64Array(M).fill(Infinity), lep = new Int32Array(M).fill(-1), sw = [];
      for (var x = 0; x < n; x++) { sw.push([]); for (var y = 0; y < n; y++) sw[x].push(x < y ? suly(l[x], l[y]) : 0); }
      f[0] = 0;
      for (var mask = 1; mask < M; mask++) {
        if (bitDb(mask) % 2) continue;
        var i = 0; while (!(mask & (1 << i))) i++;
        for (var j = i + 1; j < n; j++) if (mask & (1 << j)) {
          var v = f[mask & ~(1 << i) & ~(1 << j)] + sw[i][j];
          if (v < f[mask]) { f[mask] = v; lep[mask] = j; }
        }
      }
      if (!isFinite(f[M - 1])) return null;
      var out = [], m2 = M - 1;
      while (m2) { var i2 = 0; while (!(m2 & (1 << i2))) i2++; var j2 = lep[m2]; out.push([l[i2], l[j2]]); m2 &= ~(1 << i2) & ~(1 << j2); }
      return out;
    }
    // tételek: körönként és játékonként az oldalak
    var tetelek = [], egyeb = [];
    for (var r = 0; r < R; r++) {
      egyeb.push([]);
      F.allomas.forEach(function (d, gi) {
        var oldalak = [];
        if (d.csapat) { for (var t = 0; t < F.T; t++) if (beo.tp[t][r] === gi) oldalak.push('t' + t); }
        else for (var u = 0; u < F.U; u++) if (beo.up[u][r] === gi) oldalak.push('u' + u);
        if (oldalak.length) tetelek.push({ r: r, d: d, oldalak: oldalak, parok: null });
      });
    }
    var hibas = false;
    // első menet sorban, utána 3 javító kör: minden tételt a többi ismeretében újrapárosítunk
    for (var menet = 0; menet < 4 && !hibas; menet++) {
      tetelek.forEach(function (te) {
        if (!te.d.parharc || hibas) return;
        if (te.parok) te.parok.forEach(function (p) { valt(p, -1); });
        var p2 = legjobbParok(te.oldalak);
        if (!p2) { hibas = true; return; }
        te.parok = p2; p2.forEach(function (p) { valt(p, 1); });
      });
    }
    if (hibas) return { korok: [], buntetes: 1000 };
    var buntetes = 0;
    Object.keys(talal).forEach(function (k) { if (talal[k] > 1) buntetes += 5 * (talal[k] - 1); });      // kétszer számolva → 10 / ismétlés
    Object.keys(egysegCsapat).forEach(function (k) { if (egysegCsapat[k] > 1) buntetes += 3 * (egysegCsapat[k] - 1); });
    var korok = [];
    for (r = 0; r < R; r++) korok.push({ tipus: 'allomas', meccsek: [] });
    tetelek.forEach(function (te) {
      var palyak = kever(Array.apply(null, { length: te.d.palyak }).map(function (_, x) { return x; }), rnd);
      if (!te.d.parharc) { kever(te.oldalak.slice(), rnd).forEach(function (o, x) { korok[te.r].meccsek.push({ jatek: te.d.id, palya: palyak[x], oldalak: [o] }); }); return; }
      te.parok.forEach(function (p, x) { korok[te.r].meccsek.push({ jatek: te.d.id, palya: palyak[x], oldalak: rnd() < 0.5 ? [p[0], p[1]] : [p[1], p[0]] }); });
    });
    return { korok: korok, buntetes: buntetes };
  }
  function bitDb(x) { var c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

  // ---------------------------------------------------------
  // Egyszerre-játékok (kvíz) fordulói és a végső sorrend
  // ---------------------------------------------------------
  function osszerak(V, F, allomasKorok) {
    var elejen = [], vegen = [], kozben = [];
    F.egyszerre.forEach(function (d) {
      for (var k = 0; k < d.h; k++) {
        var meccsek = [];
        if (d.csapat) { for (var t = 0; t < F.T; t++) meccsek.push({ jatek: d.id, palya: null, oldalak: ['t' + t] }); }
        else for (var u = 0; u < F.U; u++) meccsek.push({ jatek: d.id, palya: null, oldalak: ['u' + u] });
        meccsek = meccsek.filter(function (m) { return L.aktivE(V, m.oldalak[0]); });   // a kiszállók nélkül
        var kor = { tipus: 'egyszerre', jatek: d.id, perc: Math.max(10 / 60, Number(d.j.perc) || 5), meccsek: meccsek };   // legalább 10 mp
        // a fordulók helyét a program dönti el: egyenletesen a körök között (a régi „Közben”)
        kozben.push(kor);
      }
    });
    var allPerc = L.allomasPerc(V.beallit, V.jatekok, allomasKorok.length);
    var ak = allomasKorok.map(function (k) { return { tipus: 'allomas', perc: allPerc, meccsek: k.meccsek }; });
    var kozepe = ak.slice();
    if (kozben.length) {
      var n = kozben.length, ossz = [];
      var hely = []; for (var i = 1; i <= n; i++) hely.push(Math.round(i * ak.length / (n + 1)));
      var ki = 0;
      for (var a = 0; a <= ak.length; a++) {
        while (ki < n && hely[ki] === a) ossz.push(kozben[ki++]);
        if (a < ak.length) ossz.push(ak[a]);
      }
      while (ki < n) ossz.push(kozben[ki++]);
      kozepe = ossz;
    }
    var vegso = elejen.concat(kozepe, vegen);
    vegso.forEach(function (kor, r) {
      kor.meccsek.forEach(function (m) {
        m.id = (r + 1) + '-' + m.jatek + '-' + (kor.tipus === 'egyszerre' ? m.oldalak[0] : m.palya);
      });
    });
    return vegso;
  }

  // ---------------------------------------------------------
  // Fő belépési pont
  // ---------------------------------------------------------
  // vissza: { menetrend, jelentes, forras:'sablon'|'generalt' } vagy { hiba }
  function general(V, opciok) {
    opciok = opciok || {};
    if (V.formatum && V.formatum.tipus && V.formatum.tipus !== 'kor' && L.bajnoksagE(V)) return generalBajnoksag(V, opciok);
    // többjátékos verseny, játékonkénti formátummal (kiesés / csoportkör + kiesés)
    if (!L.bajnoksagE(V) && (V.jatekok || []).some(formatumosE)) return generalFormatummal(V, opciok);
    var rnd = veletlen(opciok.seed), ido = opciok.ido || 3000;
    var F = feladat(V);
    if (F.T < 2) return { hiba: 'Legalább 2 csapat (játékos) kell.' };
    if (!F.allomas.length && !F.egyszerre.length) return { hiba: 'Nincs egy játék sem.' };
    for (var i = 0; i < F.allomas.length; i++) {
      var d = F.allomas[i];
      if (d.h < 1) return { hiba: d.j.nev + ': legalább 1-szer kell játszani.' };
      if (d.parharc && d.csapat && F.T < 2) return { hiba: d.j.nev + ': legalább 2 csapat kell.' };
      if (V.kvota && V.kvota[d.id] && d.parharc && d.ossz % 2) return { hiba: d.j.nev + ': a hátralévő meccsek száma (' + d.ossz + ' résztvevő-meccs) páratlan, így valakinek kimaradna egy meccs. Változtass a „hányszor” mezőn.' };
      if (!(V.kvota && V.kvota[d.id]) && d.parharc && ((d.csapat ? F.T : F.U) * d.h) % 2) {
        return { hiba: d.j.nev + ': ' + (d.csapat ? F.T : F.U) + ' résztvevő × ' + d.h + ' meccs páratlan szám, így valakinek kimaradna egy meccs. Írj páros számot a „hányszor” mezőbe (' + (d.h - 1 || 2) + ' vagy ' + (d.h + 1) + ').' };
      }
    }
    if (F.Rmin > 150) return { hiba: 'Túl sok kör jönne ki (' + F.Rmin + '). Adj hozzá pályát, vagy csökkentsd, hányszor játsszák.' };

    // „Ahogy beírtam” (csak egyéni): a játékok egymás után, a lista sorrendjében
    if (sorbanE(V)) return generalSorban(V, opciok);

    // Karácsonyi sablon: a régi, gépileg ellenőrzött menetrend (verseny közbeni újrasorsolásnál nem)
    if (!V.kvota && S && S.karacsonyiE(V) && S.karacsonyiMenetrend(F.T)) {
      var mr = osszerak(V, F, S.karacsonyiMenetrend(F.T));
      return { menetrend: mr, jelentes: ellenor(V, mr), forras: 'sablon' };
    }

    var legjobb = null, start = most(), R;
    if (F.allomas.length) {
      for (R = F.Rmin; R <= F.Rmin + 4 && !legjobb; R++) {
        // a legkevesebb körre jut a legtöbb idő; ha nem megy, eggyel több körrel próbáljuk
        var veg = R === F.Rmin ? start + ido * 0.85 : most() + ido * 0.3;
        while (most() < veg) {
          var beo = idobeosztas(F, R, rnd, veg);
          if (beo.kemeny > 0) continue;
          var par = parositas(F, R, beo, rnd);
          if (par.buntetes >= 1000) continue;
          var pont = par.buntetes + beo.puha;
          if (!legjobb || pont < legjobb.pont) legjobb = { pont: pont, korok: par.korok };
          if (pont < 0.5 || most() > start + ido * 0.7) break;
        }
      }
      if (!legjobb) return { hiba: 'Nem találtam szabályos menetrendet. Próbáld újra, vagy adj hozzá pályát.' };
    }
    var menetrend = osszerak(V, F, legjobb ? legjobb.korok : []);
    return { menetrend: menetrend, jelentes: ellenor(V, menetrend), forras: 'generalt' };
  }

  // ---------------------------------------------------------
  // „Ahogy beírtam”: játékonként külön blokk, a lista sorrendjében
  // ---------------------------------------------------------
  function sorbanE(V) { return Number((V.beallit || {}).meret) === 1 && V.beallit.sorrend === 'beirt' && (V.jatekok || []).length > 1; }
  function generalSorban(V, opciok) {
    var ido = opciok.ido || 3000, n = V.jatekok.length, K = L.egysegSzam(V.beallit), T = V.csapatok.length, korok = [], allomasDb = 0;
    for (var i = 0; i < n; i++) {
      var j = V.jatekok[i];
      if (j.egyszerre) {
        var fordulo = V.kvota && V.kvota[j.id] != null ? Number(V.kvota[j.id]) || 0 : Number(j.hanyszor) || 0;   // kvóta: verseny közben
        for (var k = 0; k < fordulo; k++) {
          var meccsek = [], csap = L.hatekonySzint(j, K) === 'csapat';
          for (var x = 0; x < (csap ? T : T * K); x++) if (L.aktivE(V, (csap ? 't' : 'u') + x)) meccsek.push({ jatek: j.id, palya: null, oldalak: [(csap ? 't' : 'u') + x] });
          korok.push({ tipus: 'egyszerre', jatek: j.id, perc: Math.max(10 / 60, Number(j.perc) || 5), meccsek: meccsek });
        }
        continue;
      }
      // egy játék menetrendje a meglévő sorsolóval (a többi játék nélkül)
      var Vj = { beallit: Object.assign({}, V.beallit, { sorrend: 'program' }), jatekok: [j], csapatok: V.csapatok, sablonId: '', formatum: { tipus: 'kor' } };
      if (V.kvota) { Vj.kvota = {}; Vj.kvota[j.id] = V.kvota[j.id]; Vj.elozmeny = V.elozmeny; }
      var g = general(Vj, { ido: Math.max(500, Math.floor(ido / n)), seed: opciok.seed == null ? null : opciok.seed + i });
      if (g.hiba) return { hiba: g.hiba };
      g.menetrend.forEach(function (kor) {
        korok.push({ tipus: 'allomas', meccsek: kor.meccsek.map(function (m) { return { jatek: m.jatek, palya: m.palya, oldalak: m.oldalak }; }) });
        allomasDb++;
      });
    }
    var perc = L.allomasPerc(V.beallit, V.jatekok, allomasDb);
    korok.forEach(function (kor, r) {
      if (kor.tipus === 'allomas') kor.perc = perc;
      kor.meccsek.forEach(function (m) { m.id = (r + 1) + '-' + m.jatek + '-' + (kor.tipus === 'egyszerre' ? m.oldalak[0] : m.palya); });
    });
    return { menetrend: korok, jelentes: ellenor(V, korok), forras: 'sorban' };
  }

  // ---------------------------------------------------------
  // Független ellenőrző
  // ---------------------------------------------------------
  // vissza: { hibak:[szöveg], figyelmeztetesek:[szöveg], korok, allomasKorok, pihenoMin, pihenoMax, osszPerc }
  function ellenor(V, mr) {
    var K = L.egysegSzam(V.beallit), T = V.csapatok.length, U = T * K, hibak = [], figy = [];
    var jt = {}; (V.jatekok || []).forEach(function (j) { jt[j.id] = j; });
    var cs = function (o) { var i = Number(o.slice(1)); return o.charAt(0) === 't' ? i : Math.floor(i / K); };
    var egysegek = function (o) { var i = Number(o.slice(1)); if (o.charAt(0) === 'u') return [i]; var l = []; for (var k = 0; k < K; k++) l.push(i * K + k); return l; };
    var oldalOk = function (o) { var i = Number(o.slice(1)); return /^[ut]\d+$/.test(o) && (o.charAt(0) === 'u' ? i < U : i < T); };
    var kvota = {}, ids = {}, parok = {}, egysCs = {}, pihen = [], egymasUtanPihen = 0, egymasUtanCsapat = 0;
    var elozoAktiv = new Array(U).fill(true), elozoCsapatJatek = new Array(T).fill(null);
    for (var u0 = 0; u0 < U; u0++) pihen.push(0);
    var allomasKorok = 0, egyszerreDb = {};
    if (!Array.isArray(mr) || !mr.length) hibak.push('Üres menetrend.');
    (mr || []).forEach(function (kor, r) {
      var foglalt = new Array(U).fill(0), palyaFog = {};
      if (!(kor.perc > 0)) hibak.push((r + 1) + '. kör: hiányzó játékidő.');
      if (kor.tipus === 'egyszerre') {
        var j0 = jt[kor.jatek];
        if (!j0 || !j0.egyszerre) { hibak.push((r + 1) + '. kör: ismeretlen egyszerre-játék.'); return; }
        egyszerreDb[kor.jatek] = (egyszerreDb[kor.jatek] || 0) + 1;
        var szint = L.hatekonySzint(j0, K), vart = 0, latott = {};
        for (var x0 = 0; x0 < (szint === 'csapat' ? T : U); x0++) if (L.aktivE(V, (szint === 'csapat' ? 't' : 'u') + x0)) vart++;   // a kiszállók nem játszanak
        kor.meccsek.forEach(function (m) {
          var o = m.oldalak && m.oldalak[0];
          if (ids[m.id]) hibak.push('Ismétlődő azonosító: ' + m.id); ids[m.id] = 1;
          if (!o || !oldalOk(o) || (o.charAt(0) === 't') !== (szint === 'csapat') || m.oldalak.length !== 1) { hibak.push((r + 1) + '. kör: hibás résztvevő.'); return; }
          if (latott[o]) hibak.push((r + 1) + '. kör: ' + o + ' kétszer.'); latott[o] = 1;
        });
        if (Object.keys(latott).length !== vart) hibak.push((r + 1) + '. kör: nem játszik mindenki.');
        return;
      }
      allomasKorok++;
      var csapatJatek = new Array(T).fill(null);
      kor.meccsek.forEach(function (m) {
        var j = jt[m.jatek];
        if (ids[m.id]) hibak.push('Ismétlődő azonosító: ' + m.id); ids[m.id] = 1;
        if (!j || j.egyszerre) { hibak.push((r + 1) + '. kör: ismeretlen játék (' + m.jatek + ').'); return; }
        var szint = L.hatekonySzint(j, K), vartDb = j.tipus === 'parharc' ? 2 : 1;
        if (!Array.isArray(m.oldalak) || m.oldalak.length !== vartDb || !m.oldalak.every(oldalOk)) { hibak.push((r + 1) + '. kör, ' + j.nev + ': hibás oldalak.'); return; }
        if (!m.oldalak.every(function (o) { return (o.charAt(0) === 't') === (szint === 'csapat'); })) { hibak.push((r + 1) + '. kör, ' + j.nev + ': rossz szint.'); return; }
        var pk = m.jatek + '#' + m.palya;
        if (!(m.palya >= 0 && m.palya < Number(j.palyak))) hibak.push((r + 1) + '. kör, ' + j.nev + ': nem létező pálya.');
        if (palyaFog[pk]) hibak.push((r + 1) + '. kör, ' + j.nev + ': egy pályán két meccs.'); palyaFog[pk] = 1;
        if (vartDb === 2 && cs(m.oldalak[0]) === cs(m.oldalak[1])) hibak.push((r + 1) + '. kör, ' + j.nev + ': egy csapaton belüli meccs.');
        m.oldalak.forEach(function (o) {
          egysegek(o).forEach(function (u) { foglalt[u]++; });
          var kk = m.jatek + '|' + o; kvota[kk] = (kvota[kk] || 0) + 1;
          if (o.charAt(0) === 't') csapatJatek[cs(o)] = m.jatek;
        });
        if (vartDb === 2) {
          var a = m.oldalak[0], b = m.oldalak[1], k1 = a < b ? a + '|' + b : b + '|' + a;
          parok[k1] = (parok[k1] || 0) + 1;
          if (a.charAt(0) === 'u' && K > 1) {
            egysCs[a + '>' + cs(b)] = (egysCs[a + '>' + cs(b)] || 0) + 1;
            egysCs[b + '>' + cs(a)] = (egysCs[b + '>' + cs(a)] || 0) + 1;
          }
        }
      });
      for (var u = 0; u < U; u++) {
        if (foglalt[u] > 1) hibak.push((r + 1) + '. kör: valaki egyszerre két helyen van.');
        if (!foglalt[u]) { pihen[u]++; if (!elozoAktiv[u]) egymasUtanPihen++; }
        elozoAktiv[u] = foglalt[u] > 0;
      }
      for (var t = 0; t < T; t++) {
        if (csapatJatek[t] && csapatJatek[t] === elozoCsapatJatek[t]) egymasUtanCsapat++;
        elozoCsapatJatek[t] = csapatJatek[t];
      }
    });
    // kvóták
    (V.jatekok || []).forEach(function (j) {
      var h = Number(j.hanyszor) || 0, kv = V.kvota && V.kvota[j.id];   // kvóta: verseny közbeni újrasorsolás
      if (j.egyszerre) { if (kv != null) h = Number(kv) || 0; if ((egyszerreDb[j.id] || 0) !== h) hibak.push(j.nev + ': ' + h + ' forduló helyett ' + (egyszerreDb[j.id] || 0) + '.'); return; }
      var szint = L.hatekonySzint(j, K), db = szint === 'csapat' ? T : U, rossz = 0, pre = szint === 'csapat' ? 't' : 'u';
      for (var i = 0; i < db; i++) if ((kvota[j.id + '|' + pre + i] || 0) !== (kv ? Number(kv[pre + i]) || 0 : h)) rossz++;
      if (rossz) hibak.push(j.nev + ': ' + rossz + ' résztvevő nem ' + (kv ? 'a hátralévő számban' : h + '-szer') + ' játszik.');
    });
    var ism = 0; Object.keys(parok).forEach(function (k) { if (parok[k] > 1) ism += parok[k] - 1; });
    var ismCs = 0; Object.keys(egysCs).forEach(function (k) { if (egysCs[k] > 1) ismCs += egysCs[k] - 1; });
    if (ism) figy.push(ism + ' ismétlődő ellenfél (ugyanaz a két fél többször)');
    if (ismCs) figy.push(ismCs + ' esetben ugyanazzal az ellenfél-csapattal többször');
    if (egymasUtanPihen) figy.push(egymasUtanPihen + ' egymás utáni pihenő');
    if (egymasUtanCsapat) figy.push(egymasUtanCsapat + ' esetben ugyanaz a csapatjáték két körben egymás után');
    var pMin = U ? Math.min.apply(null, pihen) : 0, pMax = U ? Math.max.apply(null, pihen) : 0;
    if (pMax - pMin > 1) figy.push('egyenetlen pihenő (' + pMin + '–' + pMax + ' kör)');
    var osszPerc = (mr || []).reduce(function (s, k) { return s + (k.perc || 0) + (Number(V.beallit.valtasPerc) || 0); }, 0);
    return { hibak: hibak, figyelmeztetesek: figy, korok: (mr || []).length, allomasKorok: allomasKorok, pihenoMin: pMin, pihenoMax: pMax, osszPerc: osszPerc };
  }


  // ---------------------------------------------------------
  // Bajnokság egy játékra: csoportkör + egyenes kiesés
  // ---------------------------------------------------------
  function kettoHatvany(n) { var b = 1; while (b < n) b *= 2; return b; }
  // körmérkőzés körökre bontva (körforgó módszer); páratlan létszámnál körönként egy pihen
  function korbeVer(resztvevok) {
    var l = resztvevok.slice(); if (l.length % 2) l.push(null);
    var n = l.length, korok = [];
    for (var r = 0; r < n - 1; r++) {
      var parok = [];
      for (var i = 0; i < n / 2; i++) { var a = l[i], b = l[n - 1 - i]; if (a && b) parok.push(r % 2 ? [b, a] : [a, b]); }
      korok.push(parok);
      l = [l[0]].concat([l[n - 1]], l.slice(1, n - 1));
    }
    return korok;
  }
  function darabol(lista, db) { var ki = []; for (var i = 0; i < lista.length; i += db) ki.push(lista.slice(i, i + db)); return ki; }

  // Csoportok száma, létszámok, továbbjutók, ágrajz mérete – a beállító képernyőnek is
  function bajnoksagTerv(N, f) {
    var t = { N: N, hiba: null };
    if (f.tipus === 'csoport') {
      var G = Number(f.csoportok) || 1, tov = Number(f.tovabb) || 1;
      if (G < 1 || N < 2 * G) { t.hiba = 'Csoportonként legalább 2 fő kell (' + N + ' fő → legfeljebb ' + Math.floor(N / 2) + ' csoport).'; return t; }
      t.meretek = L.eloszt(N, G);
      if (Math.min.apply(null, t.meretek) <= tov) { t.hiba = 'Minden csoportban több játékos kell, mint ahány továbbjut.'; return t; }
      t.G = G; t.tovabb = tov; t.Q = G * tov;
      t.csoportKorok = Math.max.apply(null, t.meretek.map(function (m) { return m % 2 ? m : m - 1; }));
    } else t.Q = N;
    if (t.Q < 2) { t.hiba = 'Legalább 2 továbbjutó kell az ágrajzhoz.'; return t; }
    t.B = kettoHatvany(t.Q); t.eronyerok = t.B - t.Q; t.koKorok = Math.log(t.B) / Math.LN2;
    return t;
  }

  function generalBajnoksag(V, opciok) {
    var rnd = veletlen(opciok.seed), j = V.jatekok[0], f = V.formatum, palyak = Math.max(1, Number(j.palyak) || 1);
    var cfgSzeru = { beallit: V.beallit, jatekok: V.jatekok, csapatok: V.csapatok };
    // kiemelési sorrend: megadva (menet közbeni formátumváltásnál az eddigi tabella), különben sorsolt
    var S = opciok.seedek ? opciok.seedek.filter(function (o) { return L.aktivE(cfgSzeru, o); }) : kever(L.resztvevoOldalak(cfgSzeru), rnd), N = S.length;
    var terv = bajnoksagTerv(N, f);
    if (terv.hiba) return { hiba: terv.hiba };
    var korok = [], ag = { tipus: f.tipus, bronz: !!f.bronz, csoportok: null, tovabb: null, seedek: null, Q: terv.Q, B: terv.B, eronyerok: [] };
    if (f.tipus === 'csoport') {
      var cs = []; for (var g = 0; g < terv.G; g++) cs.push([]);
      S.forEach(function (o, i) { cs[i % terv.G].push(o); });
      var logikai = [];
      cs.forEach(function (tagok, g2) {
        korbeVer(tagok).forEach(function (parok, r) { (logikai[r] = logikai[r] || []).push.apply(logikai[r], parok.map(function (p) { return { oldalak: p, csoport: g2 }; })); });
      });
      logikai.forEach(function (lst) {
        darabol(lst, palyak).forEach(function (ch) {
          korok.push({ tipus: 'allomas', szakasz: 'Csoportkör', meccsek: ch.map(function (m, i) { return { jatek: j.id, palya: i, oldalak: m.oldalak, csoport: m.csoport }; }) });
        });
      });
      ag.csoportok = cs; ag.tovabb = terv.tovabb;
    } else ag.seedek = S.slice();

    // ágrajz: a pozíciók a kiemelési sorrendből; a Q-nál nagyobb kiemelés = erőnyerő hely
    var helyek = L.seedSorrend(terv.B).map(function (s) { return s <= terv.Q ? { ref: 'K:' + s } : null; });
    var szakaszok = [];
    while (helyek.length > 1) {
      var nev = L.szakaszNev(helyek.length), meccsek = [], kov = [];
      for (var i = 0; i < helyek.length; i += 2) {
        var a = helyek[i], b = helyek[i + 1];
        if (a && b) { var m = { jatek: j.id, ok: [a, b], cimke: nev + ' ' + (meccsek.length + 1) }; meccsek.push(m); kov.push({ meccs: m, t: 'W' }); }
        else { var tv = a || b; ag.eronyerok.push({ szakasz: nev, ref: tv.ref }); kov.push(tv); }
      }
      if (helyek.length === 2) meccsek[0].cimke = 'Döntő';
      szakaszok.push({ nev: nev, meccsek: meccsek });
      helyek = kov;
    }
    // bronzmeccs: csak ha mindkét elődöntő valódi meccs
    if (ag.bronz) {
      var elo = szakaszok.filter(function (x) { return x.nev === 'Elődöntő'; })[0];
      if (elo && elo.meccsek.length === 2) {
        szakaszok[szakaszok.length - 1].meccsek.unshift({ jatek: j.id, ok: [{ meccs: elo.meccsek[0], t: 'L' }, { meccs: elo.meccsek[1], t: 'L' }], cimke: 'Bronzmeccs' });
      } else ag.bronz = false;
    }
    szakaszok.forEach(function (sz) {
      darabol(sz.meccsek, palyak).forEach(function (ch) {
        korok.push({ tipus: 'kieses', szakasz: sz.nev, meccsek: ch.map(function (m, i) { m.palya = i; return m; }) });
      });
    });
    // azonosítók és hivatkozások
    var perc = L.allomasPerc(V.beallit, V.jatekok, korok.length);
    korok.forEach(function (kor, r) {
      kor.perc = perc;
      kor.meccsek.forEach(function (m) { m.id = (r + 1) + '-' + j.id + '-' + m.palya; });
    });
    korok.forEach(function (kor) {
      kor.meccsek = kor.meccsek.map(function (m) {
        var o = { id: m.id, jatek: m.jatek, palya: m.palya, oldalak: m.oldalak || m.ok.map(function (x) { return x.ref ? x.ref : x.t + ':' + x.meccs.id; }) };
        if (m.cimke) o.cimke = m.cimke;
        if (m.csoport != null) o.csoport = m.csoport;
        return o;
      });
    });
    return { menetrend: korok, agrajz: ag, terv: terv, jelentes: ellenorBajnoksag(V, korok, ag), forras: 'bajnoksag' };
  }

  // Független ellenőrző a bajnokság-menetrendre
  function ellenorBajnoksag(V, mr, ag) {
    var hibak = [], figy = [], j = V.jatekok[0], palyak = Number(j.palyak) || 1, ids = {}, korSzama = {};
    var cfgSzeru = { beallit: V.beallit, jatekok: V.jatekok, csapatok: V.csapatok };
    var osszes = L.resztvevoOldalak(cfgSzeru), ervenyes = {};
    osszes.forEach(function (o) { ervenyes[o] = 1; });
    var talalkozo = {}, csoportja = {}, kRef = {}, wRef = {}, lRef = {}, dontoDb = 0;
    if (ag.csoportok) {
      var latott = {};
      ag.csoportok.forEach(function (cs, g) { cs.forEach(function (o) { if (latott[o] || !ervenyes[o]) hibak.push('Hibás csoportbeosztás (' + o + ').'); latott[o] = 1; csoportja[o] = g; }); });
      if (Object.keys(latott).length !== osszes.length) hibak.push('Nem mindenki van csoportban.');
    } else if (!ag.seedek || ag.seedek.length !== osszes.length || ag.seedek.some(function (o) { return !ervenyes[o]; })) hibak.push('Hibás kiemelési lista.');
    (mr || []).forEach(function (kor, r) {
      var foglalt = {}, pf = {};
      if (!(kor.perc > 0)) hibak.push((r + 1) + '. kör: hiányzó idő.');
      kor.meccsek.forEach(function (m) {
        if (ids[m.id]) hibak.push('Ismétlődő azonosító: ' + m.id);
        ids[m.id] = 1; korSzama[m.id] = r;
        if (m.jatek !== j.id) hibak.push('Idegen játék.');
        if (!(m.palya >= 0 && m.palya < palyak) || pf[m.palya]) hibak.push((r + 1) + '. kör: hibás vagy dupla pálya.');
        pf[m.palya] = 1;
        if (!Array.isArray(m.oldalak) || m.oldalak.length !== 2) { hibak.push('Hibás oldalak.'); return; }
        if (kor.tipus === 'kieses') {
          if (m.cimke === 'Döntő') dontoDb++;
          m.oldalak.forEach(function (o) {
            var t = o.charAt(0), x = o.slice(2);
            if (t === 'K') { var s = Number(x); if (!(s >= 1 && s <= ag.Q) || kRef[s]) hibak.push('Hibás kiemelési hivatkozás: ' + o); kRef[s] = 1; }
            else if (t === 'W' || t === 'L') {
              if (!(x in korSzama) || korSzama[x] >= r) hibak.push('Hivatkozás későbbi meccsre: ' + o);
              var tar = t === 'W' ? wRef : lRef;
              if (tar[x]) hibak.push('Kétszer hivatkozott meccs: ' + o); tar[x] = 1;
            } else hibak.push('Ismeretlen hivatkozás: ' + o);
          });
        } else {
          var a = m.oldalak[0], b = m.oldalak[1];
          if (!ervenyes[a] || !ervenyes[b] || a === b) { hibak.push((r + 1) + '. kör: hibás csoportmeccs.'); return; }
          if (foglalt[a] || foglalt[b]) hibak.push((r + 1) + '. kör: valaki két helyen.');
          foglalt[a] = foglalt[b] = 1;
          if (ag.csoportok && (csoportja[a] !== m.csoport || csoportja[b] !== m.csoport)) hibak.push('Csoporton kívüli meccs.');
          var k = a < b ? a + '|' + b : b + '|' + a; talalkozo[k] = (talalkozo[k] || 0) + 1;
        }
      });
    });
    if (ag.csoportok) ag.csoportok.forEach(function (cs) {
      for (var i = 0; i < cs.length; i++) for (var q = i + 1; q < cs.length; q++) {
        var k = cs[i] < cs[q] ? cs[i] + '|' + cs[q] : cs[q] + '|' + cs[i];
        if (talalkozo[k] !== 1) hibak.push('Csoportmeccs hiányzik vagy ismétlődik: ' + k);
      }
    });
    // az erőnyerő kiemelt a következő szakasz meccsén szerepel K: hivatkozással
    (ag.eronyerok || []).forEach(function (e) { var s = Number(e.ref.slice(2)); if (!kRef[s]) hibak.push('Az erőnyerő (' + s + '. kiemelt) nem szerepel a következő körben.'); });
    for (var s2 = 1; s2 <= ag.Q; s2++) if (!kRef[s2]) hibak.push(s2 + '. kiemelt kimaradt az ágrajzból.');
    if (dontoDb !== 1) hibak.push('Pontosan egy döntő kell.');
    var osszPerc = (mr || []).reduce(function (sum, k) { return sum + (k.perc || 0) + (Number(V.beallit.valtasPerc) || 0); }, 0);
    if (ag.eronyerok && ag.eronyerok.length) figy.push(ag.eronyerok.length + ' erőnyerő (az első kieséses körből automatikusan továbbjut)');
    return { hibak: hibak, figyelmeztetesek: figy, korok: (mr || []).length, osszPerc: osszPerc, allomasKorok: (mr || []).length, pihenoMin: 0, pihenoMax: 0 };
  }

  // Csapatok véletlen sorrendbe (sorsolás)
  function csapatSorsolas(csapatok, rnd) { return kever(csapatok.slice(), rnd || Math.random); }

  // ---------------------------------------------------------
  // Játékonkénti formátum többjátékos versenyben
  // A kieséses / csoportkörös játék külön körökben megy (a továbbjutók előre nem ismertek,
  // így más játékkal egy körben valaki két helyre kerülhetne). Program-sorrendnél a körmérkőzéses
  // játékok után jönnek a lista sorrendjében, „Ahogy beírtam”-nál a lista szerinti helyükön.
  // ---------------------------------------------------------
  function formatumosE(j) { return j.tipus === 'parharc' && !j.egyszerre && !!j.formatum && (j.formatum.tipus === 'kieses' || j.formatum.tipus === 'csoport'); }
  function formatumBlokk(V, j, opciok, mag) {
    var g = generalBajnoksag({ beallit: V.beallit, jatekok: [j], csapatok: V.csapatok, formatum: j.formatum }, { seed: opciok.seed == null ? null : opciok.seed + mag, seedek: opciok.seedek && opciok.seedek[j.id] });
    if (g.hiba) return { hiba: j.nev + ': ' + g.hiba };
    return g;
  }
  // körök átszámozása (az azonosító a kör sorszámával kezdődik), a W:/L: hivatkozásokkal együtt
  function atszamoz(korok, kezdo) {
    var atnev = {};
    korok.forEach(function (k, x) { k.meccsek.forEach(function (m) { var uid = (kezdo + x + 1) + m.id.slice(m.id.indexOf('-')); if (uid !== m.id) atnev[m.id] = uid; m.id = uid; }); });
    korok.forEach(function (k) { k.meccsek.forEach(function (m) { m.oldalak = m.oldalak.map(function (o) { return /^[WL]:/.test(o) && atnev[o.slice(2)] ? o.charAt(0) + ':' + atnev[o.slice(2)] : o; }); }); });
    return atnev;
  }
  function generalFormatummal(V, opciok) {
    var korJ = V.jatekok.filter(function (j) { return !formatumosE(j); }), hibak = [], figy = [], agrajzok = {};
    var alap = korJ.length ? general(Object.assign({}, V, { jatekok: korJ, formatum: { tipus: 'kor' } }), opciok) : { menetrend: [], jelentes: { hibak: [], figyelmeztetesek: [] } };
    if (alap.hiba) return alap;
    hibak = hibak.concat(alap.jelentes.hibak); figy = figy.concat(alap.jelentes.figyelmeztetesek);
    var refPerc = (alap.menetrend.filter(function (k) { return k.tipus === 'allomas'; })[0] || {}).perc;
    var blokk = {};
    for (var i = 0; i < V.jatekok.length; i++) {
      var j = V.jatekok[i];
      if (!formatumosE(j)) continue;
      var g = formatumBlokk(V, j, opciok, 100 + i);
      if (g.hiba) return g;
      hibak = hibak.concat(g.jelentes.hibak); figy = figy.concat(g.jelentes.figyelmeztetesek);
      agrajzok[j.id] = g.agrajz;
      blokk[j.id] = g.menetrend.map(function (k) { if (refPerc) k.perc = refPerc; return k; });
    }
    var korok = [];
    if (sorbanE(V)) V.jatekok.forEach(function (j) { korok = korok.concat(blokk[j.id] || alap.menetrend.filter(function (k) { return k.meccsek.length && k.meccsek[0].jatek === j.id; })); });
    else { korok = alap.menetrend.slice(); V.jatekok.forEach(function (j) { if (blokk[j.id]) korok = korok.concat(blokk[j.id]); }); }
    atszamoz(korok, 0);
    // az ágrajz kezdő köre (a játék első köre)
    Object.keys(agrajzok).forEach(function (id) { agrajzok[id].kezd = 1 + korok.findIndex(function (k) { return k.meccsek.some(function (m) { return m.jatek === id; }); }); });
    var osszPerc = korok.reduce(function (sum, k) { return sum + (k.perc || 0) + (Number(V.beallit.valtasPerc) || 0); }, 0);
    return { menetrend: korok, agrajzok: agrajzok, forras: 'generalt',
      jelentes: { hibak: hibak, figyelmeztetesek: figy, korok: korok.length, allomasKorok: korok.filter(function (k) { return k.tipus !== 'egyszerre'; }).length, osszPerc: osszPerc, pihenoMin: 0, pihenoMax: 0 } };
  }

  // ---------------------------------------------------------
  // Verseny közbeni módosítás: a lejátszott körök és a folyamatban lévő kör maradnak,
  // a hátralévő köröket a program az új beállítás szerint állítja össze.
  //  - ami a régi tervből még hátravan („maradék”) és ami új („extra”: új játék, több kör)
  //  - helye: 'most' = az extra jön előbb, 'vegen' = a maradék után
  // vissza: { menetrend, jelentes, ujKorok } vagy { hiba }
  // ---------------------------------------------------------
  function folytatas(regi, V, beirasok, opciok) {
    opciok = opciok || {};
    var kor = Number(regi.kor) || 0, K = L.egysegSzam(V.beallit), T = V.csapatok.length, i;
    var masol = function (x) { return JSON.parse(JSON.stringify(x)); };
    var szint = function (j) { return L.hatekonySzint(j, K); };
    // egyjátékos bajnokságnál a formátum a verseny szintjén van: itt a játékra tesszük
    V = Object.assign({}, V, { jatekok: V.jatekok.map(function (j) {
      var n = masol(j);
      if (V.jatekok.length === 1 && !n.formatum && V.formatum && V.formatum.tipus !== 'kor' && n.tipus === 'parharc' && !n.egyszerre) n.formatum = masol(V.formatum);
      return n;
    }) });
    var rj = L.jatekTar(regi), uj = {};
    V.jatekok.forEach(function (j) { uj[j.id] = j; });
    // a régi ágrajzok (a régi egyjátékos is)
    var regiAg = function (id) { return (regi.agrajzok && regi.agrajzok[id]) || (regi.agrajz && regi.jatekok[0] && regi.jatekok[0].id === id ? regi.agrajz : null); };
    var fmtUj = {}, fmtRegi = {}, fmtMarad = {}, fmtUjra = {};
    // létszámváltozás (új csapat / játékos, kiszállás): minden hátralévő újra összeáll
    var letszamValt = (regi.csapatok || []).length !== V.csapatok.length || V.csapatok.some(function (c, t) { return !!c.ki !== !!((regi.csapatok[t] || {}).ki); });
    V.jatekok.forEach(function (j) {
      var ra = regiAg(j.id), f = j.formatum || {};
      fmtUj[j.id] = formatumosE(j); fmtRegi[j.id] = !!ra;
      if (fmtUj[j.id]) {
        var r1 = rj[j.id];
        fmtMarad[j.id] = !letszamValt && !!ra && ra.tipus === f.tipus && (f.tipus !== 'csoport' || (Number(ra.csoportok ? ra.csoportok.length : 0) === Number(f.csoportok) && Number(ra.tovabb) === Number(f.tovabb))) && r1 && Number(r1.palyak) === Number(j.palyak);
        fmtUjra[j.id] = !fmtMarad[j.id];
      }
    });
    // a lejátszott és a folyamatban lévő kör: a törölt játékok meccsei nélkül, a kiesés feloldott résztvevőivel
    var felold = {};
    L.meccsLista(regi, beirasok).forEach(function (m) { felold[m.id] = m.oldalak; });
    var fagyott = masol((regi.menetrend || []).slice(0, kor)).map(function (k) {
      k.meccsek = k.meccsek.filter(function (m) { return uj[m.jatek]; }).map(function (m) {
        m.oldalak = (felold[m.id] || m.oldalak).slice();
        if (fmtUjra[m.jatek] || (fmtRegi[m.jatek] && !fmtUj[m.jatek])) delete m.csoport;   // a régi csoportbeosztás már nem él
        return m;
      });
      if (k.tipus === 'egyszerre' && !uj[k.jatek]) { k.tipus = 'allomas'; delete k.jatek; }
      return k;
    });
    var cnt = {}, egyDb = {}, elozmeny = [];
    fagyott.forEach(function (k) {
      if (k.tipus === 'egyszerre') egyDb[k.jatek] = (egyDb[k.jatek] || 0) + 1;
      k.meccsek.forEach(function (m) {
        cnt[m.jatek] = cnt[m.jatek] || {};
        if (k.tipus !== 'egyszerre') m.oldalak.forEach(function (o) { cnt[m.jatek][o] = (cnt[m.jatek][o] || 0) + 1; });
        if (m.oldalak.length === 2 && L.valodiOldal(m.oldalak[0]) && L.valodiOldal(m.oldalak[1])) elozmeny.push(m.oldalak.slice());
      });
    });
    // lejátszott játék típusa, szintje nem változhat (a régi eredmények értelmetlenek lennének)
    for (i = 0; i < V.jatekok.length; i++) {
      var j = V.jatekok[i], r0 = rj[j.id];
      if (!r0 || !cnt[j.id]) continue;
      if (r0.tipus !== j.tipus || szint(r0) !== szint(j) || !!r0.egyszerre !== !!j.egyszerre)
        return { hiba: j.nev + ': már van lejátszott meccse, ezért a típusa és a szintje nem változhat. Vegyél fel helyette új játékot.' };
    }
    // a régi terv hátralévő része: törölt játékok és az újra felépülő kieséses játékok nélkül
    var jatekE = function (k) { return k.tipus === 'egyszerre' ? k.jatek : (k.meccsek[0] || {}).jatek; };
    var regiJovo = masol((regi.menetrend || []).slice(kor)).map(function (k) {
      k.meccsek = k.meccsek.filter(function (m) { return uj[m.jatek] && !fmtUjra[m.jatek] && !(fmtRegi[m.jatek] && !fmtUj[m.jatek]); });
      return k;
    }).filter(function (k) { return k.meccsek.length && (k.tipus !== 'egyszerre' || uj[k.jatek]); });
    // bronzmeccs be/ki egy megmaradó ágrajzban
    var agrajzok = {};
    V.jatekok.forEach(function (j) {
      if (!fmtMarad[j.id]) return;
      var ag = masol(regiAg(j.id)); ag.kezd = ag.kezd || 1; agrajzok[j.id] = ag;
      var kell = !!(j.formatum || {}).bronz;
      if (kell === !!ag.bronz) return;
      ag.bronz = kell;
      var bronzKor = regiJovo.findIndex(function (k) { return k.meccsek.some(function (m) { return m.jatek === j.id && m.cimke === 'Bronzmeccs'; }); });
      if (!kell) { if (bronzKor >= 0) regiJovo[bronzKor].meccsek = regiJovo[bronzKor].meccsek.filter(function (m) { return !(m.jatek === j.id && m.cimke === 'Bronzmeccs'); }); return; }
      var elo = (regi.menetrend || []).reduce(function (l, k, r) { return r + 1 >= ag.kezd ? l.concat(k.meccsek.filter(function (m) { return m.jatek === j.id && k.szakasz === 'Elődöntő'; })) : l; }, []);
      if (elo.length !== 2) { ag.bronz = false; return; }
      var dontoKor = regiJovo.findIndex(function (k) { return k.meccsek.some(function (m) { return m.jatek === j.id && m.cimke === 'Döntő'; }); });
      var perc = (regiJovo[dontoKor] || regiJovo[0] || (regi.menetrend || [])[0] || {}).perc || 10;
      regiJovo.splice(Math.max(0, dontoKor), 0, { tipus: 'kieses', szakasz: 'Döntő', perc: perc, meccsek: [{ id: '0-' + j.id + '-0', jatek: j.id, palya: 0, oldalak: ['L:' + elo[0].id, 'L:' + elo[1].id], cimke: 'Bronzmeccs' }] });
    });
    regiJovo = regiJovo.filter(function (k) { return k.meccsek.length; });
    var jovo = {}, jovoEgy = {};
    regiJovo.forEach(function (k) {
      if (k.tipus === 'egyszerre') { jovoEgy[k.jatek] = (jovoEgy[k.jatek] || 0) + 1; return; }
      k.meccsek.forEach(function (m) { if (fmtUj[m.jatek]) return; jovo[m.jatek] = jovo[m.jatek] || {}; m.oldalak.forEach(function (o) { jovo[m.jatek][o] = (jovo[m.jatek][o] || 0) + 1; }); });
    });
    // körmérkőzéses játékok: marad-e a régi terv (nincs szerkezeti változás, sehol nem csökken a hátralévő szám)
    var rb = regi.beallit || {}, sorrendValt = (rb.sorrend || 'program') !== (V.beallit.sorrend || 'program') ||
      (V.beallit.sorrend === 'beirt' && regi.jatekok.map(function (x) { return x.id; }).filter(function (id) { return uj[id]; }).join() !== V.jatekok.filter(function (x) { return rj[x.id]; }).map(function (x) { return x.id; }).join());
    var marad = !sorrendValt && !letszamValt, maradek = {}, extra = {}, vanExtra = false, parFigy = [];
    V.jatekok.forEach(function (j) {
      if (fmtUj[j.id]) return;
      var r1 = rj[j.id], H = Math.max(0, Number(j.hanyszor) || 0);
      if (r1 && (Number(r1.palyak) !== Number(j.palyak) || r1.tipus !== j.tipus || szint(r1) !== szint(j) || !!r1.egyszerre !== !!j.egyszerre || (j.egyszerre && Number(r1.perc) !== Number(j.perc)))) marad = false;
      // idő előtt rövidített verseny (vagy éppen most rövidül): az elhagyott meccsek maguktól nem jönnek vissza,
      // a hátralévő = ami a tervben még benne van (+ amennyivel az Admin a „hányszort” azóta megemelte)
      var rov = (!!regi.rovidit || !!opciok.elhagy) && !letszamValt && !!r1, regiH = r1 ? Math.max(0, Number(r1.hanyszor) || 0) : 0;
      if (j.egyszerre) {
        var hatra = Math.max(0, H - (egyDb[j.id] || 0)), jv = jovoEgy[j.id] || 0;
        if (rov) hatra = H >= regiH ? jv + (H - regiH) : Math.min(jv, hatra);
        if (hatra < jv) marad = false;
        maradek[j.id] = Math.min(jv, hatra); extra[j.id] = hatra - maradek[j.id];
        if (letszamValt) { maradek[j.id] += extra[j.id]; extra[j.id] = 0; }
        if (extra[j.id]) vanExtra = true;
        return;
      }
      var cs2 = szint(j) === 'csapat', db = cs2 ? T : T * K;
      maradek[j.id] = {}; extra[j.id] = {};
      // „mindenki mindenki ellen” (hányszor = az aktív ellenfelek száma): a hátralévő = a még le nem játszott aktív ellenfelek
      var aktT = V.csapatok.filter(function (c) { return !c.ki; }).length, rr = j.tipus === 'parharc' && H === (cs2 ? aktT - 1 : (aktT - 1) * K);
      var volt = {}, csp = function (q) { return cs2 ? Number(q.slice(1)) : Math.floor(Number(q.slice(1)) / K); };
      if (rr) fagyott.forEach(function (k) { k.meccsek.forEach(function (m) { if (m.jatek === j.id && m.oldalak.length === 2) { volt[m.oldalak[0] + '|' + m.oldalak[1]] = 1; volt[m.oldalak[1] + '|' + m.oldalak[0]] = 1; } }); });
      for (var x = 0; x < db; x++) {
        var o = (cs2 ? 't' : 'u') + x, h2 = L.aktivE(V, o) ? Math.max(0, H - ((cnt[j.id] || {})[o] || 0)) : 0, jv2 = (jovo[j.id] || {})[o] || 0;
        if (rr && L.aktivE(V, o)) { h2 = 0; for (var y = 0; y < db; y++) { var p2 = (cs2 ? 't' : 'u') + y; if (y !== x && L.aktivE(V, p2) && csp(p2) !== csp(o) && !volt[o + '|' + p2]) h2++; } }
        if (rov) h2 = !L.aktivE(V, o) ? 0 : H >= regiH ? jv2 + (H - regiH) : Math.min(jv2, h2);
        if (h2 < jv2) marad = false;
        maradek[j.id][o] = Math.min(jv2, h2); extra[j.id][o] = h2 - maradek[j.id][o];
        // létszámváltozásnál egy blokk: az új játékosnak a régiekkel kell játszania
        if (letszamValt) { maradek[j.id][o] += extra[j.id][o]; extra[j.id][o] = 0; }
        if (extra[j.id][o]) vanExtra = true;
      }
      // páratlan hátralévő meccsszám (pl. valaki kiszállt, akivel már játszott valaki): ezen a „hányszor” nem segít,
      // ezért a legkevesebb meccset kapó aktív résztvevő egy plusz meccset kap – ez a mentés előtti összegzésben látszik
      if (j.tipus === 'parharc' && !rov) {
        var ossz = 0, leg = null;
        Object.keys(maradek[j.id]).forEach(function (q) {
          var n2 = maradek[j.id][q] + extra[j.id][q]; ossz += n2;
          if (!L.aktivE(V, q)) return;
          var tel = n2 + ((cnt[j.id] || {})[q] || 0);
          if (!leg || tel < leg.tel) leg = { o: q, tel: tel };
        });
        if (ossz % 2 && leg) {
          if (letszamValt) maradek[j.id][leg.o]++; else { extra[j.id][leg.o]++; vanExtra = true; }
          parFigy.push(j.nev + ': ' + L.oldalNev(V, leg.o) + ' egy plusz meccset kap, hogy kijöjjön a párosítás');
        }
      }
    });
    // a körhossz a hátralévő körökből jön (az Admin menet közben átállíthatta), ha nincs ilyen, az eddigiekből
    var refPerc = ((regi.menetrend || []).slice(kor).filter(function (k) { return k.tipus !== 'egyszerre'; })[0] || {}).perc ||
      ((regi.menetrend || []).filter(function (k) { return k.tipus === 'allomas'; })[0] || {}).perc || L.allomasPerc(V.beallit, V.jatekok, 1);
    var hibak = [], figy = parFigy;
    function blokk(kv, elozo, mag) {
      var jl = V.jatekok.filter(function (j) { if (fmtUj[j.id]) return false; var q = kv[j.id]; return j.egyszerre ? q > 0 : Object.keys(q).some(function (o) { return q[o] > 0; }); });
      if (!jl.length) return [];
      var Vb = { nev: V.nev, beallit: V.beallit, jatekok: jl, csapatok: V.csapatok, sablonId: '', formatum: { tipus: 'kor' }, kvota: {}, elozmeny: elozo };
      jl.forEach(function (j) { Vb.kvota[j.id] = kv[j.id]; });
      var g = general(Vb, { ido: opciok.ido || 2500, seed: opciok.seed == null ? null : opciok.seed + mag });
      if (g.hiba) throw new Error(g.hiba);
      hibak = hibak.concat(g.jelentes.hibak); figy = figy.concat(g.jelentes.figyelmeztetesek);
      return g.menetrend.map(function (k) { if (k.tipus === 'allomas') k.perc = refPerc; return k; });
    }
    // kieséses / csoportkörös játék új ágrajza: a kiemelés az eddigi meccsei szerinti tabella
    var u = L.utolsoBeirasok(beirasok), lejatszott = L.meccsLista(regi, beirasok).filter(function (m) { return m.kor <= kor; });
    function ujAgrajz(j, mag) {
      var lev = szint(j) === 'csapat', oldalak = [];
      for (var x = 0; x < (lev ? T : T * K); x++) oldalak.push((lev ? 't' : 'u') + x);
      var sajat = lejatszott.filter(function (m) { return m.jatekId === j.id && m.jatek && m.jatek.tipus === 'parharc' && L.meccsKesz(m); });
      var seedek = sajat.length ? L.tabellaSzamol(regi, sajat, u, oldalak).sorok.map(function (r) { return r.oldal; }) : null;
      var sd = {}; if (seedek) sd[j.id] = seedek;
      var g = formatumBlokk(V, j, { seed: opciok.seed, seedek: sd }, 200 + mag);
      if (g.hiba) throw new Error(g.hiba);
      hibak = hibak.concat(g.jelentes.hibak); figy = figy.concat(g.jelentes.figyelmeztetesek);
      agrajzok[j.id] = g.agrajz;
      return g.menetrend.map(function (k) { k.perc = refPerc; return k; });
    }
    var parjai = function (l) { var p = []; l.forEach(function (k) { k.meccsek.forEach(function (m) { if (m.oldalak.length === 2 && L.valodiOldal(m.oldalak[0])) p.push(m.oldalak.slice()); }); }); return p; };
    var mB, eB, fB = [];
    try {
      // maradék: változatlan körmérkőzéses terv (a megmaradó kieséses körökkel együtt, eredeti sorrendben), vagy újrasorsolva
      mB = marad ? regiJovo : blokk(maradek, elozmeny, 1).concat(regiJovo.filter(function (k) { return fmtUj[jatekE(k)]; }));
      eB = vanExtra ? blokk(extra, elozmeny.concat(opciok.helye === 'most' ? [] : parjai(mB)), 2) : [];
      V.jatekok.forEach(function (j, x) { if (fmtUjra[j.id]) fB = fB.concat(ujAgrajz(j, x)); });
    } catch (e) { return { hiba: e.message }; }
    var ujResz = eB.concat(fB), jovoUj = opciok.helye === 'most' ? ujResz.concat(mB) : mB.concat(ujResz);
    // idő előtti befejezés: a végéről ennyi kör kimarad; a kieséses / csoportkörös játék körei maradnak (azokat az Admin dönti el)
    var elhagyva = 0;
    for (var e2 = jovoUj.length - 1; e2 >= 0 && elhagyva < (Number(opciok.elhagy) || 0); e2--) {
      if (!fmtUj[jatekE(jovoUj[e2])]) { jovoUj.splice(e2, 1); elhagyva++; }
    }
    atszamoz(jovoUj, kor);
    // az új és a még el nem kezdett ágrajzok kezdő köre (a körök eltolódhattak: játék törlése, új körök, elhagyott körök)
    V.jatekok.forEach(function (j) {
      if (!agrajzok[j.id] || (!fmtUjra[j.id] && Number(agrajzok[j.id].kezd) <= kor)) return;
      var x = jovoUj.findIndex(function (k) { return k.meccsek.some(function (m) { return m.jatek === j.id; }); });
      if (x >= 0 || fmtUjra[j.id]) agrajzok[j.id].kezd = kor + x + 1;
    });
    return { menetrend: fagyott.concat(jovoUj), agrajzok: agrajzok, jelentes: { hibak: hibak, figyelmeztetesek: figy }, ujKorok: jovoUj.length,
      maradt: marad && !fB.length, extraKorok: ujResz.length, elhagyva: elhagyva, rovidit: elhagyva > 0 || (!!regi.rovidit && !letszamValt) };
  }

  var Sorsolo = { feladat: feladat, general: general, ellenor: ellenor, csapatSorsolas: csapatSorsolas, folytatas: folytatas,
    bajnoksagTerv: bajnoksagTerv, generalBajnoksag: generalBajnoksag, ellenorBajnoksag: ellenorBajnoksag, korbeVer: korbeVer };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sorsolo;
  else g.Sorsolo = Sorsolo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
