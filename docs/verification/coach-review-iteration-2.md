# Iteration 2: individuell prioritering och mittspel

Datum: 2026-10-24. Fortsättning på [första bedömningen](coach-review.md).

## Resultat och betyg

Målet för iterationen är att närma sig 8/10, särskilt i de två svagaste träningsområdena. Individuell prioritering och mittspel bedöms preliminärt till **8/10 vardera för frontendens träningsdesign** efter ändringarna. Med samma tio lika viktade kriterier som förra gången blir helheten **7,4/10**, från 7,0. Övriga områden får inte högre betyg bara för att dessa två har förbättrats.

Detta är en kvalitativ produktbedömning. Den saknade backenden hindrar fortfarande ett verifierat totalbetyg för desktopappen. Ingen faktisk ratingökning eller optimal tidsanvändning har påvisats.

## Individuell prioritering: 6 → 8

Startsidan föreslår högst tre konkreta uppgifter inom vald tidsbudget och förklarar varför de valdes. Förfallna lokala repetitioner får hög prioritet. Motoridentifierade återkommande teman används för riktade taktikövningar när det finns minst 20 möjligheter och fem partier; mindre underlag leder till granskning av ett exempel. Gränserna är försiktiga produktregler, inte vetenskapligt validerade trösklar.

Mittspelsresultat styr nästa ställning. Fel återkommer; lyckade försök följs av en relaterad men ändrad ställning. Både plan och motspelarens resurs måste stämma för att försöket ska räknas som lyckat. Säkra men felaktiga svar uppmärksammas särskilt. Senare framgång kan ersätta en tidigare felbild i rekommendationerna.

Samma dags upprepningar förlänger inte repetitionsintervallet genom ett högre repetitionssteg. Korta misslyckanden återkommer efter tio minuter, lyckade återkallningar efter ett, tre eller sju dygn. En session använder tre olika ställningar och avslutas tydligt.

Begränsningar: reglerna uppskattar inte faktiskt lärande per minut, tar inte hänsyn till trötthet och samordnar inte automatiskt den befintliga backendplanens uppgifter. Prioritetskortet säger uttryckligen att det kompletterar desktopplanen. I browserläge används lokal träningshistorik och backendberoende uppgifter går inte att starta.

## Mittspel: 6 → 8

Materialet omfattar centralbrytningar, bondekedjor, minoritetsangrepp, isolerad bonde, halvöppna linjer och låst centrum. Varje tema har vägledd träning och relaterade kontrollställningar. Kontrastfall prövar om en tidigare plan behöver ändras när ställningen ändras.

Spelaren skriver en motivering, väljer plan, väljer motspelarens resurs och anger säkerhet innan någon återkoppling visas. Förklaringar behandlar både det valda svaret och det avsedda målet. Fritexten sparas men rättas inte automatiskt. Brädet visas ur den dragande sidans perspektiv.

Första försök på kontrollställningar redovisas separat. Ett senare rätt svar skriver inte över ett första fel, och upprepningar ökar inte antalet olika testade ställningar. Sparfel låser fortsättningen och kan återförsökas utan dubbla poster. Oläsbar historik lämnas orörd.

Begränsningar: kontrollställningarna prövar överföring mellan närbesläktade strukturer, inte generalisering till alla mittspel. Flervalsfrågor ger fortfarande ledtrådar. Nivåerna är redaktionella och inte kalibrerade mot spelares rating. Behövs även fler teman, fria dragval och mänsklig bedömning av resonemang.

## Vad som krävs för 8/10 för helheten

- Återställ backenden och verifiera verklig import, motoranalys, databas, schema och återstart.
- Förbättra diagnosen: skilj kunskapsbrist från räknefel, missad motståndarresurs och tidsnöd med partinära evidens.
- Validera slutspelsdomslut mot den verkliga motorn/tablebasen.
- Följ förstaförsök på nya ställningar och senare partier över tid. Utvärdera om rekommendationerna faktiskt ger bättre resultat per träningsminut.

Betyg ska följa evidens. Det vore missvisande att kalla hela appen verifierad 8/10 enbart för att två delar har förbättrats.

## Verifiering av iterationen

Den slutliga innehållsbanken har 12 ställningar i sex teman, med en grundövning och en kontrastövning per tema. Browserkontrollen verifierade hela kedjan rekommendation → två svar före facit → sparat resultat → ny kontrastställning → personlig rekommendation efter omladdning. [Bild av rekommendationen](personal-priorities.jpg).

Automatiska tester kontrollerar bland annat tidsbudget, små evidensunderlag, anpassning efter resultat, fördröjd repetition, bestående förstaförsök, sparfel och en session med tre olika ställningar. Innehållets startställningar och utvalda konkreta fortsättningar kontrolleras separat med schackregler. Detta bevisar inte att alla strategiska bedömningar är motoroptimala.

Slutkontroll: 113 tester verifierade i 35 testfiler. De 104 testerna utanför innehållsfilen passerade i fullsviten; innehållsfilens nio tester passerade efter att fyra testmatchningar anpassats till schackbibliotekets extra `promoted`-fält. De nio innehållstesterna omfattar 62 lagliga exempel på konkreta fortsättningar samt kontroller av de taktiska och strukturella fakta som används i förklaringarna. ESLint, TypeScript och produktionsbygge är godkända på slutversionen. Motor- och databasintegration är fortfarande inte körd.
