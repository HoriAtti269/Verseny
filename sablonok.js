/* =========================================================
   VERSENYMOTOR – sablonok.js
   Beépített sablonok. A Karácsonyi Kupa a régi rendszer gépileg
   ellenőrzött menetrendjeit használja (6–9 csapat), ha a játékai
   változatlanok.
   ========================================================= */
(function (g) {
  'use strict';

  var KARACSONY_JATEKOK = [
    { id: 'BOW', nev: 'Bowling', tipus: 'pontgyujto', szint: 'csapat', palyak: 2, hanyszor: 2, egyszerre: false,
      eredmeny: { mod: 'szam', max: 300, cimke: 'Hány fát gurított a csapat összesen? (10 frame, Baker)' },
      beiras: 'sajat', ertek: 'helyezes', maxPont: 12, kiegyenlit: true },
    { id: 'BIL', nev: 'Biliárd', tipus: 'parharc', szint: 'egyseg', palyak: 2, hanyszor: 2, egyszerre: false,
      eredmeny: { mod: 'gyd', szam: { cimke: 'Hány SAJÁT golyótok maradt fent?', max: 7, jobb: 'kevesebb' } },
      beiras: 'sajat', kiegyenlit: true },
    { id: 'DARTS', nev: 'Darts', tipus: 'parharc', szint: 'egyseg', palyak: 1, hanyszor: 1, egyszerre: false,
      eredmeny: { mod: 'cel', cel: 301, irany: 'le', cimke: 'Hány pont maradt nálatok? (301, szimpla be/ki)' },
      beiras: 'sajat', kiegyenlit: true },
    { id: 'CSOCSO', nev: 'Csocsó', tipus: 'parharc', szint: 'egyseg', palyak: 1, hanyszor: 1, egyszerre: false,
      eredmeny: { mod: 'cel', cel: 10, irany: 'fel', cimke: 'Hány gólt rúgtatok? (10 gólig)' },
      beiras: 'sajat', kiegyenlit: true },
    { id: 'SHUF', nev: 'Shuffleboard', tipus: 'parharc', szint: 'egyseg', palyak: 1, hanyszor: 1, egyszerre: false,
      eredmeny: { mod: 'tobb', max: 30, skala: 15, cimke: 'Hány pontotok lett? (3 end)' },
      beiras: 'sajat', kiegyenlit: true }
  ];

  var SABLONOK = [
    { id: 'karacsony', nev: 'Karácsonyi Kupa', leiras: '4 fős csapatok párokban · 7 pálya: 2 bowling, 2 biliárd, darts, csocsó, shuffleboard · saját beírás',
      beallit: { jatekosok: 28, meret: 4, maradek: 'nagyobb', bontas: 2, kulonbseg: 'B', osszIdo: 150, valtasPerc: 4 },
      jatekok: KARACSONY_JATEKOK },
    { id: 'kviz', nev: 'Kvízest', leiras: '5 fős csapatok egyben · kvíz, mindenki egyszerre, 6 forduló · versenybíró írja be',
      beallit: { jatekosok: 30, meret: 5, maradek: 'kisebb', bontas: 1, kulonbseg: 'A', osszIdo: 60, valtasPerc: 2 },
      jatekok: [{ id: 'KVIZ', nev: 'Kvíz', tipus: 'pontgyujto', szint: 'egyseg', palyak: 1, hanyszor: 6, egyszerre: true, perc: 8, hol: 'vegen',
        eredmeny: { mod: 'szam', max: 10, cimke: 'Pont ebben a fordulóban' }, beiras: 'biro', ertek: 'osszeg', maxPont: 12, kiegyenlit: false }] },
    { id: 'darts', nev: 'Darts-bajnokság', leiras: 'Egyéni · 2 tábla · mindenki mindenki ellen (8 főnél) · saját beírás',
      beallit: { jatekosok: 8, meret: 1, maradek: 'nagyobb', bontas: 1, kulonbseg: 'B', osszIdo: 120, valtasPerc: 2 },
      jatekok: [{ id: 'DARTS', nev: 'Darts', tipus: 'parharc', szint: 'egyseg', palyak: 2, hanyszor: 7, egyszerre: false,
        eredmeny: { mod: 'cel', cel: 301, irany: 'le', cimke: 'Hány pont maradt nálad? (301)' }, beiras: 'sajat', kiegyenlit: true }] },
    { id: 'ures', nev: 'Üres verseny', leiras: 'Mindent te állítasz be',
      beallit: { jatekosok: 16, meret: 4, maradek: 'nagyobb', bontas: 1, kulonbseg: 'B', osszIdo: 90, valtasPerc: 3 },
      jatekok: [{ id: 'J1', nev: 'Játék 1', tipus: 'parharc', szint: 'egyseg', palyak: 1, hanyszor: 1, egyszerre: false,
        eredmeny: { mod: 'gyd', szam: null }, beiras: 'sajat', kiegyenlit: true }] }
  ];

  // A régi Kupa ellenőrzött menetrendjei (kulcs = csapatszám), régi formátumban
  var KARACSONY_MENETREND = {"6":[{"bowling":[2,4],"meccsek":[{"allomas":"BIL1","a":1,"b":7},{"allomas":"DARTS","a":2,"b":10},{"allomas":"CSOCSO","a":6,"b":11},{"allomas":"SHUF","a":0,"b":3}]},{"bowling":[3,5],"meccsek":[{"allomas":"BIL2","a":2,"b":4},{"allomas":"DARTS","a":0,"b":9},{"allomas":"CSOCSO","a":3,"b":8},{"allomas":"SHUF","a":1,"b":5}]},{"bowling":[1],"meccsek":[{"allomas":"BIL1","a":1,"b":11},{"allomas":"BIL2","a":0,"b":10},{"allomas":"DARTS","a":5,"b":6},{"allomas":"CSOCSO","a":7,"b":9},{"allomas":"SHUF","a":4,"b":8}]},{"bowling":[0,4],"meccsek":[{"allomas":"BIL1","a":3,"b":11},{"allomas":"BIL2","a":4,"b":7},{"allomas":"CSOCSO","a":5,"b":10},{"allomas":"SHUF","a":2,"b":6}]},{"bowling":[2],"meccsek":[{"allomas":"BIL1","a":8,"b":10},{"allomas":"BIL2","a":0,"b":6},{"allomas":"DARTS","a":3,"b":7},{"allomas":"CSOCSO","a":1,"b":2},{"allomas":"SHUF","a":9,"b":11}]},{"bowling":[0,1],"meccsek":[{"allomas":"BIL1","a":6,"b":8},{"allomas":"BIL2","a":5,"b":9},{"allomas":"DARTS","a":4,"b":11},{"allomas":"SHUF","a":7,"b":10}]},{"bowling":[3,5],"meccsek":[{"allomas":"BIL1","a":3,"b":5},{"allomas":"BIL2","a":2,"b":9},{"allomas":"DARTS","a":1,"b":8},{"allomas":"CSOCSO","a":0,"b":4}]}],"7":[{"bowling":[1,4],"meccsek":[{"allomas":"BIL1","a":0,"b":11},{"allomas":"BIL2","a":6,"b":10},{"allomas":"DARTS","a":4,"b":13},{"allomas":"CSOCSO","a":1,"b":5},{"allomas":"SHUF","a":7,"b":12}]},{"bowling":[0,6],"meccsek":[{"allomas":"BIL1","a":4,"b":11},{"allomas":"BIL2","a":8,"b":10},{"allomas":"DARTS","a":2,"b":9},{"allomas":"CSOCSO","a":3,"b":7},{"allomas":"SHUF","a":5,"b":6}]},{"bowling":[3,5],"meccsek":[{"allomas":"BIL1","a":2,"b":13},{"allomas":"BIL2","a":1,"b":9},{"allomas":"DARTS","a":5,"b":12},{"allomas":"CSOCSO","a":0,"b":4},{"allomas":"SHUF","a":3,"b":8}]},{"bowling":[0,1],"meccsek":[{"allomas":"BIL1","a":6,"b":13},{"allomas":"BIL2","a":5,"b":8},{"allomas":"DARTS","a":7,"b":11},{"allomas":"CSOCSO","a":10,"b":12},{"allomas":"SHUF","a":4,"b":9}]},{"bowling":[2,4],"meccsek":[{"allomas":"BIL1","a":1,"b":12},{"allomas":"BIL2","a":0,"b":7},{"allomas":"DARTS","a":3,"b":10},{"allomas":"CSOCSO","a":2,"b":6},{"allomas":"SHUF","a":11,"b":13}]},{"bowling":[3,6],"meccsek":[{"allomas":"BIL1","a":3,"b":4},{"allomas":"BIL2","a":2,"b":5},{"allomas":"DARTS","a":0,"b":8},{"allomas":"CSOCSO","a":9,"b":11},{"allomas":"SHUF","a":1,"b":10}]},{"bowling":[2,5],"meccsek":[{"allomas":"BIL1","a":7,"b":9},{"allomas":"BIL2","a":3,"b":12},{"allomas":"DARTS","a":1,"b":6},{"allomas":"CSOCSO","a":8,"b":13},{"allomas":"SHUF","a":0,"b":2}]}],"8":[{"bowling":[3,5],"meccsek":[{"allomas":"BIL1","a":0,"b":12},{"allomas":"BIL2","a":8,"b":14},{"allomas":"DARTS","a":4,"b":13},{"allomas":"CSOCSO","a":2,"b":9},{"allomas":"SHUF","a":1,"b":5}]},{"bowling":[2,7],"meccsek":[{"allomas":"BIL1","a":1,"b":11},{"allomas":"BIL2","a":6,"b":9},{"allomas":"DARTS","a":0,"b":3},{"allomas":"CSOCSO","a":7,"b":10},{"allomas":"SHUF","a":8,"b":12}]},{"bowling":[3,4],"meccsek":[{"allomas":"BIL1","a":11,"b":15},{"allomas":"BIL2","a":3,"b":4},{"allomas":"DARTS","a":2,"b":14},{"allomas":"CSOCSO","a":1,"b":13},{"allomas":"SHUF","a":0,"b":10}]},{"bowling":[0,6],"meccsek":[{"allomas":"BIL1","a":2,"b":5},{"allomas":"BIL2","a":4,"b":10},{"allomas":"DARTS","a":9,"b":11},{"allomas":"CSOCSO","a":3,"b":15},{"allomas":"SHUF","a":7,"b":14}]},{"bowling":[1,4],"meccsek":[{"allomas":"BIL1","a":5,"b":7},{"allomas":"BIL2","a":0,"b":14},{"allomas":"DARTS","a":10,"b":12},{"allomas":"CSOCSO","a":6,"b":11},{"allomas":"SHUF","a":13,"b":15}]},{"bowling":[0,6],"meccsek":[{"allomas":"BIL1","a":2,"b":7},{"allomas":"BIL2","a":8,"b":10},{"allomas":"DARTS","a":5,"b":15},{"allomas":"CSOCSO","a":4,"b":14},{"allomas":"SHUF","a":3,"b":6}]},{"bowling":[2,7],"meccsek":[{"allomas":"BIL1","a":3,"b":12},{"allomas":"BIL2","a":9,"b":13},{"allomas":"DARTS","a":1,"b":6},{"allomas":"CSOCSO","a":0,"b":8},{"allomas":"SHUF","a":2,"b":11}]},{"bowling":[1,5],"meccsek":[{"allomas":"BIL1","a":1,"b":15},{"allomas":"BIL2","a":6,"b":13},{"allomas":"DARTS","a":7,"b":8},{"allomas":"CSOCSO","a":5,"b":12},{"allomas":"SHUF","a":4,"b":9}]}],"9":[{"bowling":[6,8],"meccsek":[{"allomas":"BIL1","a":0,"b":2},{"allomas":"BIL2","a":1,"b":5},{"allomas":"DARTS","a":4,"b":14},{"allomas":"CSOCSO","a":9,"b":15},{"allomas":"SHUF","a":6,"b":11}]},{"bowling":[4,5],"meccsek":[{"allomas":"BIL1","a":14,"b":16},{"allomas":"BIL2","a":7,"b":15},{"allomas":"DARTS","a":1,"b":12},{"allomas":"CSOCSO","a":4,"b":6},{"allomas":"SHUF","a":3,"b":13}]},{"bowling":[1,8],"meccsek":[{"allomas":"BIL1","a":8,"b":12},{"allomas":"BIL2","a":5,"b":13},{"allomas":"DARTS","a":0,"b":10},{"allomas":"CSOCSO","a":11,"b":14},{"allomas":"SHUF","a":1,"b":7}]},{"bowling":[3,4],"meccsek":[{"allomas":"BIL1","a":3,"b":4},{"allomas":"BIL2","a":11,"b":17},{"allomas":"DARTS","a":5,"b":15},{"allomas":"CSOCSO","a":0,"b":13},{"allomas":"SHUF","a":10,"b":16}]},{"bowling":[1,5],"meccsek":[{"allomas":"BIL1","a":0,"b":14},{"allomas":"BIL2","a":12,"b":16},{"allomas":"DARTS","a":6,"b":8},{"allomas":"CSOCSO","a":1,"b":17},{"allomas":"SHUF","a":4,"b":9}]},{"bowling":[0,2],"meccsek":[{"allomas":"BIL1","a":3,"b":6},{"allomas":"BIL2","a":7,"b":10},{"allomas":"DARTS","a":11,"b":13},{"allomas":"CSOCSO","a":2,"b":8},{"allomas":"SHUF","a":15,"b":17}]},{"bowling":[6,7],"meccsek":[{"allomas":"BIL1","a":1,"b":9},{"allomas":"BIL2","a":8,"b":17},{"allomas":"DARTS","a":7,"b":16},{"allomas":"CSOCSO","a":3,"b":10},{"allomas":"SHUF","a":2,"b":5}]},{"bowling":[0,3],"meccsek":[{"allomas":"BIL1","a":2,"b":15},{"allomas":"BIL2","a":4,"b":11},{"allomas":"DARTS","a":3,"b":9},{"allomas":"CSOCSO","a":5,"b":16},{"allomas":"SHUF","a":12,"b":14}]},{"bowling":[2,7],"meccsek":[{"allomas":"BIL1","a":6,"b":13},{"allomas":"BIL2","a":9,"b":10},{"allomas":"DARTS","a":2,"b":17},{"allomas":"CSOCSO","a":7,"b":12},{"allomas":"SHUF","a":0,"b":8}]}]};

  // A menetrendet befolyásoló mezők változatlanok-e a karácsonyi sablonhoz képest
  function karacsonyiE(V) {
    if (!V || V.sablonId !== 'karacsony') return false;
    var b = V.beallit || {};
    if (Number(b.meret) !== 4 || Number(b.bontas) !== 2) return false;
    var kulcs = function (l) {
      // a sorrend nem számít: az állomások úgyis párhuzamosan futnak
      return JSON.stringify((l || []).map(function (j) { return [j.id, j.tipus, j.szint, Number(j.palyak), Number(j.hanyszor), !!j.egyszerre]; }).sort());
    };
    return kulcs(V.jatekok) === kulcs(KARACSONY_JATEKOK);
  }

  // Régi formátum → új menetrend (azonosítók nélkül; a sorsoló számozza)
  function karacsonyiMenetrend(T) {
    var regi = KARACSONY_MENETREND[String(T)];
    if (!regi) return null;
    return regi.map(function (kor) {
      var meccsek = kor.meccsek.map(function (m) {
        var j = m.allomas === 'BIL1' || m.allomas === 'BIL2' ? 'BIL' : m.allomas;
        return { jatek: j, palya: m.allomas === 'BIL2' ? 1 : 0, oldalak: ['u' + m.a, 'u' + m.b] };
      });
      kor.bowling.forEach(function (t, i) { meccsek.push({ jatek: 'BOW', palya: i, oldalak: ['t' + t] }); });
      return { tipus: 'allomas', meccsek: meccsek };
    });
  }

  var Sablonok = { LISTA: SABLONOK, karacsonyiE: karacsonyiE, karacsonyiMenetrend: karacsonyiMenetrend };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sablonok;
  else g.Sablonok = Sablonok;
})(typeof globalThis !== 'undefined' ? globalThis : this);
