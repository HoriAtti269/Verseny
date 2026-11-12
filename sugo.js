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
      ['jatekosok', 'Hány játékos van?', 'Az összes résztvevő, 2–48 fő. Ebből számolja a program a csapatokat. Minden ilyen szám a − és + gombbal léptethető, vagy a számra bökve kézzel is beírható.'],
      ['meret', 'Csapatméret', 'Hány fős egy csapat. Egyéni: mindenki magáért játszik, legfeljebb 15 fő.'],
      ['maradek', 'A maradék', 'Akkor jelenik meg, ha a létszám nem osztható a csapatmérettel. Kisebb csapatok: több csapat, néhány kisebb létszámú. Nagyobb csapatok: kevesebb csapat, néhány nagyobb. A gombon látszik, mi jön ki.'],
      ['bontas', 'Hogyan játszik a csapat?', 'Egyben: a csapat mindig együtt játszik. Párokban / Hármasokban: a csapat kisebb egységekre bomlik. Ezek külön meccseket játszanak, és külön ranglistájuk is van.'],
      ['osszesites', 'Összesítés', 'Csak egyéni versenynél. Pontok: minden játék helyezése pontot ér, a több pont nyer. Helyezési számok: a helyezések összeadódnak, a kisebb összeg nyer. Holtversenyben azonos a helyezés.'],
      ['kulonbseg', 'Létszámkülönbség', 'Csak eltérő méretű csapatoknál vagy egységeknél látszik. A) A kisebb csapat plusz próbálkozást kap. B) A nagyobbikból körönként valaki pihen, és mindenki sorra kerül.'],
      ['idomeres', 'Időmérés', 'Be: visszaszámláló óra, időkeret, Szünet és Kör lezárása. Ki: nincs óra, a köröket az Admin lépteti, a Sorsolás csak a körök számát mutatja.'],
      ['kor_vege', 'Kör vége', 'Mi történjen, ha a kör (vagy a saját tempós rész) minden eredménye beérkezett. Ki: megy tovább az óra. Gombra: az óra megáll, minden telefonon „A KÖR VÉGET ÉRT” látszik, a következő kört az Admin indítja. Magától: a következő kör a beállított várakozás után magától indul; az Admin a „Várjunk” gombbal megállíthatja. Magától soha nem indul hiányos vagy ütköző eredménynél, szünetben és az utolsó kör után. Menet közben az Idő és befejezés panelen állítható.'],
      ['kor_vege_mp', 'Várakozás a következő kör előtt', 'Magától módban ennyi idő telik el az utolsó eredmény és a következő kör indulása között: 5 másodperc és 10 perc között, perc : másodperc alakban. Alapból 15 másodperc.'],
      ['osszIdo', 'Teljes időkeret (perc)', 'Ennyi idő van az egész versenyre. A Sorsolás ebből számolja a körök hosszát (egy kör legalább 1 perc), és jelzi, ha nem fér bele. Verseny közben a Vezérlő „Idő és befejezés” részén állítható.'],
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
      ['bronz', 'Bronzmeccs a 3. helyért', 'Be: a két elődöntő-vesztes megmérkőzik. Ki: mindketten 3. helyezettek. 4-nél kevesebb továbbjutónál nincs bronzmeccs.'],
      ['haladas', 'Haladás', 'Kieséses és csoportkörös résznél választható. Saját tempó: nincs kör és nincs Admin-indítás – ha egy meccs mindkét fele ráér, mehet; a játékosok az „Indulunk” gombbal indítják a meccs óráját, a program az első szabad pályát írja ki. Körönként: az Admin indítja a köröket, mint a többi játéknál. Új formátumnál alapból Saját tempó; a korábban mentett versenyek és sablonok Körönként maradnak.']
    ]],
    ['Játék szerkesztése', [
      ['j_nev', 'Játék neve', 'Ez látszik a menetrendben, a beírásnál és az Állás fülén.'],
      ['j_tipus', 'Típus', 'Párharc: két fél egymás ellen. Pontgyűjtő: mindenki a saját pontját gyűjti. Típusváltáskor a beírás beállításai alaphelyzetbe állnak.'],
      ['j_szint', 'Ki játssza', 'Az egység (pár, hármas) vagy az egész csapat. Csak párokban vagy hármasokban játszó csapatnál látszik.'],
      ['j_egyszerre', 'Mindenki egyszerre játszik', 'Pontgyűjtőnél: egyszerre játszik mindenki, pl. egy kvíz. Külön fordulókban megy.'],
      ['j_fordulok', 'Fordulók', 'Hány fordulót játszanak ebből a játékból.'],
      ['j_perc', 'Perc / forduló', 'Egy forduló hossza percben. Csak bekapcsolt időmérésnél látszik.'],
      ['j_mp', 'És másodperc', 'A perchez adódik: 0 perc és 30 másodperc egy 30 másodperces villámforduló. Egy forduló legalább 10 másodperc.'],
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
      ['en_vagyok', 'Ez vagyok én', 'Ha az Admin maga is játszik: a saját nevénél megnyomva ezen a telefonon a Kör fülön a saját meccse is látszik, és be tudja írni az eredményét, mint bárki más. Az Admin-fülek megmaradnak. Ugyanez történik, ha az Admin a saját QR-kódját olvassa be. „Mégsem én”: megszünteti.'],
      ['tempo', 'Saját tempós rész', 'A kieséses / csoportkörös rész körök nélkül megy. Az Admin elindítja a részt, onnan a játékosok indítják a meccseiket. Most játszik: pálya és hátralévő idő. Mehet: mindkét fél ráér, van szabad pálya – az Admin is elindíthatja (Indít). Vár: megmutatja, mire. Egy meccsre koppintva az Admin javíthat vagy dönthet. A rész akkor ér véget, ha az utolsó meccse is kész; utána indítható a következő kör.'],
      ['eredm_torles', 'Eredmények törlése + Vissza a beállításhoz', 'Nem: folytatás módosítással, az eredmények maradnak. Igen: újrakezdés az 1. körtől, miután az Admin beírja a „TÖRLÉS” szót.'],
      ['minden_torles', 'Minden törlése', 'Csapatok, menetrend, eredmények és kódok törlődnek, a saját sablonok maradnak. Teszt után ezzel indul tiszta lappal az Admin.'],
      ['kilepes', 'Kilépés az admin módból', 'Ezen a telefonon törli a PIN-t, és visszavált nézői módba.']
    ]],
    ['Vezérlő – Idő és befejezés', [
      ['ido_panel', 'Idő és befejezés', 'Futó verseny közben itt állítja az Admin az órát, a körök hosszát, és itt fejezheti be előbb a versenyt. A Megnyit gombbal nyílik.'],
      ['tempo_ido', 'A futó meccsek ideje', 'Saját tempós részben minden éppen futó meccs órájához hozzáad vagy elvesz egy percet.'],
      ['tempo_hossz', 'A meccsek hossza', 'Saját tempós részben a még el nem indult meccsek hossza. A már futó meccsek órája nem változik.'],
      ['tempo_vege', 'Befejezés (saját tempó)', 'Befejezés most: új meccs nem indul, a futó meccsek befejeződnek, a többi kimarad. Befejezés időre: a megadott idő letelte után nem indul új meccs. Utána indítható a következő rész, vagy lezárható a verseny. „Mégis folytatjuk”: visszavonja.'],
      ['ido_kapcs', 'Időmérés Be/Ki (menet közben)', 'Az Admin verseny közben is be- vagy kikapcsolhatja a visszaszámláló órát. Kikapcsolva a köröket az Admin lépteti.'],
      ['ido_most', 'A mostani kör ideje', '− 1 perc / + 1 perc: ennyivel változik a hátralévő idő. Beállít: pontosan ennyi legyen hátra (perc : mp). A lejárt vagy lezárt kört újra megnyitja. Minden telefonon azonnal frissül.'],
      ['ido_korok', 'A hátralévő körök hossza', 'A még el nem kezdett körök hossza (perc : mp). A körök közösen állíthatók, a „mindenki egyszerre” játékok fordulói játékonként. A mostani kört nem érinti.'],
      ['ido_vege', 'Befejezés időre', 'Az Admin megadja, mikorra legyen vége (óra:perc), vagy hány perc múlva. A program a hátralévő köröket arányosan rövidíti vagy nyújtja, és megmutatja az új körhosszt. Ha nem fér bele, megírja, hány kört kell elhagyni.'],
      ['ido_valt', 'Váltás a körök között (perc)', 'Ennyi szünettel számol a „Befejezés időre” két kör között. Az Alkalmaz ezt is elmenti.'],
      ['ido_elhagy', 'Körök elhagyása a végéről', 'Az utolsó körök kimaradnak a versenyből, a lejátszott körök és az eredmények maradnak. A kieséses és csoportkörös körök nem hagyhatók el: azokat le kell játszani, vagy a kör indítása után az Admin döntéssel lezárni.'],
      ['befejez', 'Verseny befejezése most', 'A mostani kör lesz az utolsó, minden elhagyható hátralévő kör kimarad. A végeredmény a lejátszott meccsekből számolódik. Ha mégis folytatnád: a Módosításnál a játék „hányszor” számát megemelve új körök adhatók.']
    ]],
    ['Vezérlő – Lezárás és mentés', [
      ['lezaras', 'Verseny lezárása', 'Ha vége a versenynek. A beírás és a körléptetés leáll, elérhetők a mentések, és a végeredmény a Korábbi versenyek közé kerül. A program jelzi, ha még van hátralévő kör vagy hiányzó eredmény. Visszanyitható.'],
      ['mentes', 'Mentés (PDF)', 'Teljes mentés: végeredmény, minden játék tabellája és minden meccs. Statisztika: legtöbb győzelem, veretlenek, legnagyobb különbségű meccs, legjobb eredmények. A PDF letöltődik, és a Google Drive „Versenymotor mentések” mappájába is bekerül. A játékosok a saját eredménylapjukat a Kör képernyőn töltik le.'],
      ['mentes_jatek', 'Mentés játékonként', 'Egy játék tabellája és meccsei külön lapon, a verseny nevével a fejlécben.'],
      ['oklevel', 'Oklevelek', 'Az első három helyezett kap oklevelet, fekvő A4-es lapon, „Szervező bizottság” aláírással. Csapatversenynél választható: csapatonként egy (a tagok névsorával), vagy minden tagnak saját.'],
      ['megosztas', 'Megosztható végeredmény', 'Ezzel a linkkel bárki megnézheti a végeredményt és a játékok tabelláit, PIN és kód nélkül. Csak olvasható. A verseny törlése után is működik, amíg az Admin a Korábbi versenyek közül nem törli.'],
      ['visszanyit', 'Verseny visszanyitása', 'A lezárás visszavonása: újra lehet beírni és kört indítani. A következő lezárás frissíti a mentett végeredményt.'],
      ['korabbi', 'Korábbi versenyek', 'A lezárt versenyek mentett végeredménye, a „Minden törlése” után is megmarad. Megnyitás: a végeredmény új lapon. Link másolása: megosztható link. Törlés: a mentett végeredmény és a linkje megszűnik.']
    ]],
    ['Meccs javítása', [
      ['adat_szerk', 'Adat szerkesztése', 'Az Admin átírhatja az egyik fél beírását.'],
      ['admin_dontes', 'Admin döntés', 'Az Admin döntése felülír minden beírást, és a kártyákon is ez látszik: nyert / vesztett / döntetlen (Admin döntés). A „Döntés törlése” visszaadja a döntést a beírásoknak.']
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
    ['Széles nézet (laptop, fekvő iPad)', [
      ['szeles', 'Széles nézet Be/Ki', 'Admin módban, legalább 1000 képpont széles képernyőn (laptop, fekvő iPad) a program több hasábban mutat mindent: bal oldalon a menü, a Vezérlő három hasábban, a meccs javítása oldalpanelben, a Menetrend rácsban, az Állás tabellái egymás mellett. Ki: ezen a gépen is a telefonos nézet látszik. Telefonon, álló iPaden és a játékosoknál mindig a telefonos nézet van. A beállítás ezen a gépen marad meg. Ha az Admin beállította, hogy ő is játszik („Ez vagyok én”), a menü alján a „Te is játszol” doboz mutatja a mostani játékát.'],
      ['sz_menetrend', 'Menetrend-rács', 'Egy sor egy kör, egy oszlop egy játék egy pályája. ✓ = elfogadott eredmény, ½ = csak az egyik fél írta be, ! = ütközés (az Admin dönt). A futó kör sora ki van emelve. Egy meccsre kattintva jobb oldalon nyílik a javítás, a kör nevére kattintva a Vezérlő azt a kört mutatja. Az utolsó oszlop: ki nem játszik abban a körben.'],
      ['nyomtatas', 'Nyomtatás', 'A böngésző nyomtatását nyitja meg. A QR-kódoknál csak a kódok kerülnek a lapra (egy lapon több, szétvágható), a Menetrendnél csak a rács. A nyomtatás párbeszédablakában PDF-be is menthető.']
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
