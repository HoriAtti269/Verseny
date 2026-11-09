/* =========================================================
   VERSENYMOTOR – sugo.js
   A „?” súgók és a teljes Súgó oldal szövegei – egy helyen.
   Új admin mező = új sor ide (és a teljes leírásba is).
   ========================================================= */
(function (g) {
  'use strict';

  // csoportok a Súgó oldal sorrendjében; egy tétel: [kulcs, cím, szöveg]
  var CSOPORTOK = [
    ['Beállítás – 1. Sablon', [
      ['folytatas', 'Folytatás', 'A legutóbb mentett beállítás töltődik be. Minden megmarad, amit az Admin eddig beállított.'],
      ['beepitett', 'Beépített sablonok', 'Kész kiindulópontok. A Karácsonyi Kupa a régi, ellenőrzött menetrenddel jön. A többi csak a játékokat és a beállításokat tölti be, utána az Admin mindent módosíthat.'],
      ['sajat', 'Saját sablonok', 'Az Admin által mentett beállítások. Szerkesztés: betölti, és a mentés ugyanezt a nevet ajánlja fel. Törlés: végleg eltávolítja.']
    ]],
    ['Beállítás – 2. Létszám', [
      ['verseny_nev', 'A verseny neve', 'Ez látszik minden képernyő tetején. Az Admin futó verseny közben is átírhatja.'],
      ['jatekosok', 'Hány játékos van?', 'Az összes résztvevő, 2–48 fő. Ebből számolja a program a csapatokat.'],
      ['meret', 'Csapatméret', 'Hány fős egy csapat. Egyéni: mindenki magáért játszik, legfeljebb 15 fő.'],
      ['maradek', 'A maradék', 'Akkor jelenik meg, ha a létszám nem osztható a csapatmérettel. Kisebb csapatok: több csapat, néhány kisebb létszámú. Nagyobb csapatok: kevesebb csapat, néhány nagyobb. A gombon látszik, mi jön ki.'],
      ['bontas', 'Hogyan játszik a csapat?', 'Egyben: a csapat mindig együtt játszik. Párokban / Hármasokban: a csapat kisebb egységekre bomlik. Ezek külön meccseket játszanak, és külön ranglistájuk is van.'],
      ['osszesites', 'Összesítés', 'Csak egyéni versenynél. Pontok: minden játék helyezése pontot ér, a több pont nyer. Helyezési számok: a helyezések összeadódnak, a kisebb összeg nyer. Holtversenyben azonos a helyezés.'],
      ['kulonbseg', 'Létszámkülönbség', 'Csak eltérő méretű csapatoknál vagy egységeknél látszik. A) A kisebb csapat plusz próbálkozást kap. B) A nagyobbikból körönként valaki pihen, és mindenki sorra kerül.'],
      ['idomeres', 'Időmérés', 'Be: visszaszámláló óra, időkeret, Szünet és Kör lezárása. Ki: nincs óra, a köröket az Admin lépteti, a Sorsolás csak a körök számát mutatja.'],
      ['osszIdo', 'Teljes időkeret (perc)', 'Ennyi idő van az egész versenyre. A Sorsolás ebből számolja a körök hosszát, és jelzi, ha nem fér bele.'],
      ['valtasPerc', 'Váltás körönként (perc)', 'Ennyi időt hagy a program két kör között (pályacsere, beírás). Beleszámít az időkeretbe.'],
      ['sablon_ment', 'Mentés saját sablonként', 'A mostani beállítás bekerül a Saját sablonok közé. Betöltéskor a nevek üresen indulnak. Azonos névnél a program rákérdez a felülírásra.']
    ]],
    ['Beállítás – 3. Játékok', [
      ['sorrend', 'A játékok sorrendje', 'Csak egyéni versenynél. A program sorsolja: a játékok keverve, párhuzamosan mennek. Ahogy beírtam: a játékok egymás után jönnek, abban a sorrendben, ahogy az Admin a listában felsorolta.'],
      ['jatek_lista', 'Játéklista', 'Egy játékra bökve az Admin megnyitja a szerkesztést. A ↑↓ a sorrendet állítja: ez az Állás füleinek sorrendje, és „Ahogy beírtam” módban a lejátszásé is.'],
      ['uj_jatek', '+ Új játék', 'Új játékot tesz a lista végére (párharc, 1 pálya, 1×), és megnyitja szerkesztésre.'],
      ['formatum', 'Formátum (egyjátékos verseny)', 'Körmérkőzés: közös tabella. Egyenes kiesés: ágrajz, erőnyerőkkel. Csoportkör + kiesés: csoportokban mindenki mindenki ellen, a legjobbak ágrajzba kerülnek.'],
      ['csoportok', 'Csoportok száma', 'Hány csoportra osztja a program a résztvevőket.'],
      ['tovabb', 'Továbbjutó csoportonként', 'Hányan jutnak tovább csoportonként az ágrajzba.'],
      ['bronz', 'Bronzmeccs a 3. helyért', 'Be: a két elődöntő-vesztes megmérkőzik. Ki: mindketten 3. helyezettek. 4-nél kevesebb továbbjutónál nincs bronzmeccs.']
    ]],
    ['Játék szerkesztése', [
      ['j_nev', 'Játék neve', 'Ez látszik a menetrendben, a beírásnál és az Állás fülén.'],
      ['j_tipus', 'Típus', 'Párharc: két fél egymás ellen. Pontgyűjtő: mindenki a saját pontját gyűjti. Típusváltáskor a beírás beállításai alaphelyzetbe állnak.'],
      ['j_szint', 'Ki játssza', 'Az egység (pár, hármas) vagy az egész csapat. Csak párokban vagy hármasokban játszó csapatnál látszik.'],
      ['j_egyszerre', 'Mindenki egyszerre játszik', 'Pontgyűjtőnél: egyszerre játszik mindenki, pl. egy kvíz. Külön fordulókban megy.'],
      ['j_fordulok', 'Fordulók', 'Hány fordulót játszanak ebből a játékból.'],
      ['j_perc', 'Perc / forduló', 'Egy forduló hossza. Csak bekapcsolt időmérésnél látszik.'],
      ['j_palyak', 'Pályák száma', 'Hány helyen (tábla, asztal) mehet egyszerre a játék. Több pálya: több meccs fér egy körbe.'],
      ['j_hanyszor', 'Hányszor játsszák', 'Hány meccset játszik ebből egy résztvevő.'],
      ['mindenki', 'Mindenki mindenki ellen (N×)', 'Úgy állítja be a „hányszort”, hogy mindenki mindenkivel egyszer játsszon. A csapattárs nem lehet ellenfél.'],
      ['j_formatum', 'Formátum (játékonként)', 'Csak erre a játékra szól: Körmérkőzés, Kiesés vagy Csoport + kiesés. Külön körökben megy. Helyezés: döntő 1–2., bronz 3–4., a kiesők a körük szerint.'],
      ['pg_mit', 'Mit írnak be (pontgyűjtő)', 'Pontot / számot: a beírt szám számít. Helyezést: 1-től a résztvevők számáig, a kisebb a jobb.'],
      ['ph_mit', 'Mit írnak be (párharc)', 'Ki nyert: győzelem, döntetlen vagy vereség. Célig: aki eléri a célt, nyer. Több pont: a több pont nyer. Az utóbbi kettőnél lejárt időnél döntetlen.'],
      ['max', 'Legnagyobb beírható szám', 'Ennél nagyobbat a telefon nem enged beírni, így véd az elírás ellen.'],
      ['kerdes', 'Kérdés a beírásnál', 'Ez a szöveg jelenik meg a beíró képernyőn, pl. „Hány bábut döntöttetek?”. Ha az Admin üresen hagyja, a program alapszövege jön.'],
      ['pjobb', 'Több a jobb / Kevesebb a jobb', 'Kevesebb a jobb pl. időnél vagy dobásszámnál.'],
      ['ertek', 'Mennyit ér a versenyben', 'Pontok összege: a beírt pontok egyenesen az összesítésbe kerülnek. Helyezés → pont: a játékbeli helyezés szerint jár pont.'],
      ['maxPont', 'Az 1. helyezett pontja', 'Ennyit kap a játék győztese. A többiek a helyezésük szerint kevesebbet kapnak, az utolsó 0-t.'],
      ['plusz_szam', 'Plusz szám a holtversenyhez', 'A „Ki nyert” mellé egy számot is beírnak (pl. maradék golyó). Holtversenynél ez is számít.'],
      ['szam_mi', 'Mi a szám / Max. / Több–kevesebb a jobb', 'A plusz szám neve a beírásnál, a legnagyobb értéke, és hogy a több vagy a kevesebb a jobb.'],
      ['irany', 'Irány (Célig)', 'Felfelé: 0-ról a célig, pl. gólok. Lefelé: a kezdőpontról 0-ig, pl. darts 301, ahol a 0 a kiszállás.'],
      ['cel', 'Cél / Kezdőpont', 'A célszám (felfelé) vagy a kezdőpont (lefelé).'],
      ['beiras', 'Ki írja be', 'A résztvevők: mindkét fél beírja. Ha egyezik, elfogadva; ha eltér, ütközés, és az Admin dönt. Versenybíró: a bíró a saját QR-kódjával írja be az egész kört.'],
      ['kiegyenlit', 'Létszámkülönbség kiegyenlítése', 'Ki: ennél a játéknál nincs A/B kiegyenlítés. Csak eltérő méretű csapatoknál látszik.'],
      ['jatek_torles', 'Játék törlése / Kész', 'Törlés: a játék kikerül a listából (legalább egy marad). Kész: bezárja a szerkesztést.']
    ]],
    ['Beállítás – 4. Csapatok', [
      ['nevek', 'Csapat, egység és tag nevei', 'Az Állásban, a menetrendben és a QR-kártyákon látszanak. Az Admin futó verseny közben is átírhatja őket.'],
      ['jatekosnevek', 'Játékosok (egyéni)', 'A játékosok nevei. Az Admin futó verseny közben is átírhatja őket.']
    ]],
    ['Beállítás – 5. Sorsolás', [
      ['sorsolas', 'Sorsolás / Újrasorsolás', 'Véletlenszerűen osztja a csapatokat a helyekre, elkészíti a menetrendet és ellenőrzi. Az Admin a Startig bármennyiszer újrasorsolhat.'],
      ['ellenorzes', 'Automatikus ellenőrzés', '✓ rendben. ✗ hiba: amíg van, a Start nem indítható. ! figyelmeztetés: megengedett, de újrasorsolással javulhat.'],
      ['start', 'Start (zárol)', 'Zárolja a csapatokat és a menetrendet, és elkészülnek a QR-kódok. Utána az Admin a Vezérlőből indítja az 1. kört.']
    ]],
    ['Vezérlő', [
      ['kor_inditas', 'N. kör indítása', 'Az Admin indítja a következő kört és az órát. A program jelzi, ha eredmény hiányzik, de a kör így is indítható. Kieséses körnél csak akkor indul, ha a párosítás eldőlt.'],
      ['szunet', 'Szünet / Folytatás', 'Az Admin megállítja, majd továbbengedi az órát.'],
      ['kor_lezaras', 'Kör lezárása', 'Az óra 0-ra áll, a kör véget ér. Az eredmények utána is beírhatók.'],
      ['allapotok', 'Elfogadva / hiányzik / ütközés', 'A kiválasztott kör meccsei. A számokkal választható a kör. Egy meccsre bökve az Admin javíthatja az eredményt.'],
      ['pihenok', 'Pihenők ebben a körben', 'B módban itt látszik, ki pihen. Ha még nincs kiválasztva, pirossal jelzi.'],
      ['qr', 'Linkek és QR-kódok', 'Csapatonként vagy egységenként egy kód, plusz a bírói kódok. Ezzel lépnek be a résztvevők.'],
      ['eredm_torles', 'Eredmények törlése + Vissza a beállításhoz', 'Nem: folytatás módosítással, az eredmények maradnak. Igen: újrakezdés az 1. körtől, miután az Admin beírja a „TÖRLÉS” szót.'],
      ['minden_torles', 'Minden törlése', 'Csapatok, menetrend, eredmények és kódok törlődnek, a saját sablonok maradnak. Teszt után ezzel indul tiszta lappal az Admin.'],
      ['kilepes', 'Kilépés az admin módból', 'Ezen a telefonon törli a PIN-t, és visszavált nézői módba.']
    ]],
    ['Meccs javítása', [
      ['adat_szerk', 'Adat szerkesztése', 'Az Admin átírhatja az egyik fél beírását.'],
      ['admin_dontes', 'Admin döntés', 'Az Admin döntése felülír minden beírást. A „Döntés törlése” visszaadja a döntést a beírásoknak.']
    ]],
    ['Módosítás (futó verseny)', [
      ['mod_jatekok', 'Játékok menet közben', 'Az Admin mindent állíthat. Kivétel: egy már lejátszott játék típusa és szintje. A lejátszott és a folyamatban lévő kör marad.'],
      ['helye', 'Az új körök helye', 'Most következnek: az új körök a folyamatban lévő után jönnek. A végén: a menetrend végére kerülnek.'],
      ['kiszall', 'Kiszáll / Visszavesz', 'A kiszálló eredményei maradnak, de új meccse nem lesz, és a kódja megszűnik. Visszavételkor új kódot kap.'],
      ['uj_resztvevo', '+ Új játékos / + Új csapat', 'A lista végére kerül, és csak ő kap új QR-kódot. A hátralévő körök újrasorsolódnak.'],
      ['tag_pm', '+ tag / − tag', 'Egy egység tagjainak száma. Tagcserénél elég a nevet átírni.'],
      ['mod_mentes', 'Mentés', 'Előbb összegzést mutat: mi törlődik, hány új kör és hány új kód lesz. Ment, ha az Admin jóváhagyja.'],
      ['teljes_ujra', 'Teljes újrabeállítás', 'Csak az Igen ágon látszik. Új sorsolás és új QR-kódok jönnek, a régi kódok érvénytelenek lesznek. A nevek és a játékok maradnak.']
    ]],
    ['Súgó', [
      ['sugo_be', 'Súgó Be/Ki', 'Ki: eltűnnek a „?” jelek. A teljes súgó oldal továbbra is elérhető.']
    ]]
  ];

  // kulcs → { cim, sz }
  var T = {};
  CSOPORTOK.forEach(function (cs) { cs[1].forEach(function (t) { T[t[0]] = { cim: t[1], sz: t[2] }; }); });

  var Sugo = { CSOPORTOK: CSOPORTOK, T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sugo;
  else g.Sugo = Sugo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
