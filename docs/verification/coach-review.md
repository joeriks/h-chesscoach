# Chess Coach – kritisk bedömning efter iteration

Datum: 2026-10-24. Senare ändringar och uppdaterade delbetyg finns i [iteration 2](coach-review-iteration-2.md).

## Slutsats och avgränsning

Den granskade frontendens träningsdesign bedöms nu preliminärt till **7,0/10**, jämfört med den ursprungliga helhetsbedömningen 4/10. Det är en expertbedömning av funktionerna och de testade flödena, inte ett uppmätt resultat på spelares schackstyrka. Ett verifierat totalbetyg för desktopappen kan inte sättas: denna kopia saknar Rust-backenden, och motor, databas och träningsplanering har därför inte kunnat testas tillsammans i den verkliga appen. Användaren har uttryckligen bett oss fortsätta utan den.

Skalan: 0 = saknas, 4 = stora brister, 7 = användbar coaching med tydliga begränsningar, 10 = mycket stark och empiriskt validerad träning. Punkterna väger lika. Runtime och verklig inlärning är separata verifieringskrav, inte poäng som antas vara godkända.

| Bedömningspunkt               | Nu /10 | Grund och kvarvarande brist                                                                                                                                                                     |
| ----------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnos från egna partier     |      6 | Kritiska ögonblick och mönster synliggörs. Små underlag märks som osäkra. Motorbaserad felklassificering behöver fortfarande skilja kunskapsbrist från exempelvis tidsnöd.                      |
| Individuell prioritering      |      6 | Egna misstag kan bli övningar och återkomma. Ingen verifierad modell väljer ännu den träning som ger störst förbättring per minut.                                                              |
| Förklaringar och återkoppling |      7 | Motiv, planer, motspelarens svar och egna slutsatser blir explicita. Taktikförklaringar är fortfarande ofta generella snarare än ställningsspecifika.                                           |
| Aktivt tänkande före facit    |      8 | Partigenomgång kräver reflektion före motorfacit; strategifrågor kräver motivering. Självskattning och fritext bedöms inte automatiskt som korrekta.                                            |
| Taktik och egna misstag       |      8 | Lagliga varianter, stegvisa ledtrådar, fullare partivarianter och ärlig alternativhantering. Motorjämförelsen är en uppskattning och kräver verkligt integrationstest.                          |
| Öppningsträning               |      7 | Förklaringen ligger kvar tills spelaren går vidare. Repertoaravvikelse beskrivs inte som automatiskt dåligt schack. Behöver fler plan- och övergångsövningar.                                   |
| Mittspel och planer           |      6 | Sex lagliga, vägledda planställningar med motspelarens idéer och återkoppling. Materialet är för litet och för lätt att memorera för en komplett kurs.                                          |
| Slutspel                      |      7 | Lagliga damledtrådar, tydligare opposition, val av underpromotion och krav på alla lektionsställningar. Frontenden kan inte själv intyga remi eller vinst; backendens domslut måste verifieras. |
| Repetition och sparande       |      8 | Lokala försök och återbesök, senarelagd repetition, sparfel med återförsök, ingen falsk fullföljning vid hoppade uppgifter. Backendlagringen är ännu inte integrationstestad.                   |
| Uppföljning av lärande        |      7 | Återkallning efter minst ett dygn skiljs från repetition samma dag. Senare egna partier kan jämföras med en fryst baslinje. Måtten bevisar varken kausal effekt eller ratingökning.             |

## Viktiga ändringar

- Reflektion före analysfacit, även när spelaren byter ställning. Kritiska ögonblick kan väljas direkt.
- Egna alternativa drag sparas för jämförelse. En separat motorkontroll kan jämföra referens och kandidat; utan tillförlitligt svar förblir draget obedömt. Ett godkänt enstaka drag räknas inte som full övningsbehärskning.
- Sparfel blockerar fortsatt flöde tills ett försök kan sparas. Återförsök undviker att avsiktligt skicka samma redan bekräftade försök igen.
- Slutspelslektioner kräver alla ställningar, och promotion kräver ett uttryckligt pjäsval.
- Ny mittspelsträning samt försiktigare statistik utan obelagda populationsjämförelser.
- Browserläget förklarar vilka funktioner som kräver desktopappen och erbjuder den fristående mittspelsträningen.

## Verifiering

Alla 94 tester i 31 testfiler passerade vid slutkontrollen. Automatiska frontendtester täcker bland annat sparfel, återförsök, hoppade uppgifter, lokal repetition, reflektion, slutspelsprogression, promotion och jämförelse av senare partier. TypeScript, produktionsbygge, ESLint och formatering kontrolleras separat. Motorgränssnittet testas med simulerade händelser, inklusive fördröjda och gamla svar; detta ersätter inte ett riktigt motortest.

Innehållskontrollen verifierar 357 lagliga drag i 17 repertoarlinjer, 11 slutspelsrötter mot cachade bedömningar samt två korrigerade damledtrådar. Cachade bedömningar är inte en livekontroll mot tablebase.

Mittspelsflödet har också körts i browser: motivering, svar, låst första svar och förklaring. Bild: [middlegame-feedback.jpg](middlegame-feedback.jpg).

## Nästa krav för ett verifierat totalbetyg

1. Återställ den matchande backenden och kör hela flödet: import → analys → eget misstag → övning → sparande → återbesök → träningsplan. Starta om appen och kontrollera att resultaten finns kvar.
2. Kontrollera motorns poängperspektiv, sökdjup, samtidiga förfrågningar och avbrott med riktiga vit- och svartställningar. Granska även goda alternativ som inte står först i motorvarianten.
3. Testa slutspelsdomslut, remiregler och underpromotion mot den verkliga motorn/tablebasen.
4. Utöka mittspel och förklaringar. Lägg in nya ställningar med samma idé för att skilja förståelse från igenkänning.
5. Följ riktiga spelare över tid. Förregistrera jämförbara tidskontroller, minst en baslinjeperiod och senare partier; mät återkommande fel per 100 bedömda drag, tidsåtgång och överföring till nya ställningar. Ett bättre testresultat ensamt visar inte förbättrat matchspel.

Bedömningen ska sänkas om integrationstesterna fallerar. Målet 7/10 får inte ersätta verifiering.
