# Bifrost V2 – roadmap

## 1. Mål

Bygge Bifrost som en moderne PM2-drevet applikasjon med:

- Node.js + TypeScript som backend/API
- React + TypeScript som frontend
- Tailwind CSS for designsystem og responsivt grensesnitt
- V1-databasestrukturen beholdes som kompatibilitetsgrunnlag
- Et separat V2-skjema kan innføres for normalisert/read-model data via ETL og synkronisering
- PM2 for produksjonsprosess, restart, logging og deploy
- Paritetsvis migrering fra V1 uten å miste data eller arbeidsflyter

V1 er i dag en CodeIgniter 4-applikasjon med PHP 8.2+, MariaDB, server-renderte views, rollebasert tilgang, CSRF/input-validering og audit-logg. Alle V1-funksjoner er i aktiv bruk og skal videreføres. V2 skal ikke starte med en full “big bang”-omskriving.

## 1.1 Fastlåste beslutninger

- Produktet deles i `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker`.
- Web snakker kun med API-et. Web skal ikke koble direkte til databasen.
- Web-miljøet inneholder kun API-lenke og nødvendig klientkonfigurasjon.
- API-miljøet inneholder databaseinnstillinger og teknisk runtime-konfigurasjon. Produkt-, rolle-, OIDC-, integrasjons- og systeminnstillinger lagres i database.
- OIDC/Keycloak er obligatorisk.
- Eksisterende V1-tabeller og relasjoner beholdes. Et nytt V2-skjema er tillatt via dokumentert ETL/synkronisering.
- Filer kan lagres lokalt på serveren med metadata, tilgangskontroll og backup.
- PM2 kjører API, Web og Worker.
- Sensitive verdier krypteres; passord og verifiseringsverdier hashes og skal aldri dekrypteres.

## 1.2 Implementeringsstatus per 17. september 2026

| Område | Status | Levert |
|---|---|---|
| Fase 0 – baseline | Pågår | V1 er bevart under `V1/` og en første rute-/rollematrise ligger i `V2/docs/domain-matrix.md`. Detaljvalidering per handling, anonymisert staging-database og restore-test gjenstår. |
| Fase 1 – fundament | Nær ferdig | pnpm-monorepo, strict TypeScript, Fastify, React/Vite/Tailwind, Drizzle, health/readiness, PM2-oppsett og samlet kvalitetssjekk er på plass. CI og lokal databasecontainer gjenstår. |
| Fase 2 – identitet | Pågår | Obligatorisk Keycloak/OIDC med PKCE, JWT/JWKS-validering, automatisk V1-brukerprovisjonering og eksisterende roller er på plass. Audit av innlogging og full tilgangsmatrise gjenstår. |
| Fase 3 – lager og utstyr | Nær ferdig | Utstyr, kategoriadministrasjon, lokasjoner, paller, palleplasser, strekkodeflyt, inspeksjon, flytting, slettingsvern, audit og nytt React-design er implementert. Playwright og paritetstest mot representativ V1-database gjenstår. |
| Fase 4 – utlån og forespørsler | Implementert, ikke staging-verifisert | Transaksjonelt flerlinje-utlån, retur, person-/badge-oppslag, private-utstyrsregler, utstyrsforespørsler, kjøretøy, kompetanse/KDO, kjøretøylån og profiloversikt er implementert i API og Web. Paritetstest mot anonymiserte stagingdata gjenstår. |
| Fase 5 – transport, samband og shop | Implementert, ikke staging-verifisert | Transport, samband, Shop og crewtøy er implementert i API og Web, inkludert ruteestimat, kjørebok, sambandssett, utlån, varelager, badgeoppslag, utlevering og XLSX/XLS/CSV-/PDF-flyt. Paritetstest mot anonymiserte stagingdata gjenstår. |
| Fase 6–7 | Ikke startet | Øvrig admin, rapportering, produksjonssetting og kontrollert V1-avvikling følger etter fase 5. |

Teknisk fundament kjører som `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker`. V1-tabellene brukes direkte. Nye tekniske tabeller for kryptert konfigurasjon og jobbkø har `bifrost_`-prefiks. Hele V2 kan verifiseres med `pnpm check`.

### Neste leveranseporter

1. Utvid positive og negative tilgangstester for hver implementerte modul.
2. Kjør V2 mot en anonymisert kopi av eksisterende database og dokumenter V1/V2-avvik.
3. Legg til Playwright-flyt for opprett utstyr → opprett palle → flytt → inspiser.
4. Verifiser Keycloak-klient, redirect URI, roller og token-claims i staging.
5. Paritetstest fase 4 og 5 mot anonymiserte data, inkludert Shop-import/eksport og crewtøyutlevering.
6. Fortsett med fase 6: oppgaver, feedback/varsler og deretter admin/statistikk.

## 2. Omfanget i V1

Følgende områder må dekkes i V2:

1. Innlogging, passord-reset, OIDC/Keycloak og sesjon/token-håndtering
2. Dashboard og globalt søk
3. Brukere, profiler, roller, rettigheter og admin
4. Utstyr, kategorier, privat utstyr og strekkoder
5. Lokasjoner, paller, palleplasser og lagerinspeksjon
6. Utlån/retur av utstyr og kjøretøy
7. Utstyrsforespørsler og godkjenning/delvis godkjenning
8. Samband og sambandsett
9. Transportforespørsler og transportoppdrag
10. Shop/forbruksmateriell, crew clothing og import/eksport
11. Oppgaver, feedback, varsler og vedlegg
12. Audit-logg, systeminnstillinger og statistikk

V1-rutene i `V1/app/Config/Routes.php` og modellene/migreringene under `V1/app` er den funksjonelle kilden til sannhet. Før utvikling bør dette kompletteres med en verifisert domenematrise basert på faktiske brukere og data.

## 3. Foreslått målarkitektur

```text
Browser
  └─ React SPA (Vite, TypeScript, Tailwind)
       └─ typed API client (OpenAPI/kontrakter)
            └─ Node.js API (Fastify eller NestJS)
                 ├─ domain modules
                 ├─ auth/RBAC
                 ├─ validation
                 ├─ audit/events
                 └─ MariaDB
```

### Anbefalt stack

- Monorepo med `apps/api`, `apps/web` og `packages/*`
- Node.js LTS og pnpm
- Fastify for et lett, modulært API, eller NestJS dersom teamet ønsker mer opinionert struktur
- Prisma eller Drizzle som database-lag; velg én før første migrering
- Zod for validering og delte typer
- OpenAPI som eksplisitt API-kontrakt
- React Router, TanStack Query og React Hook Form
- Tailwind CSS med egne tokens for farger, spacing, typografi og states
- Vitest + Testing Library + Playwright
- ESLint, Prettier og strict TypeScript

Det viktigste valget er ikke rammeverket, men at domenelogikk ikke legges direkte i React-komponenter eller ukontrollerte route handlers.

## 4. Prinsipper for migreringen

- V1 skal være kjørbar og lesbar som fallback til V2 har nådd paritet.
- Ikke endre eksisterende database-tabeller uten backup, migreringsplan og rollback.
- Stabiliser domenet før UI-polering: identitet, statusmaskiner, tilgang og audit først.
- API-et skal returnere konsistente feil, pagination, filtrering og valideringsmeldinger.
- Alle skriveoperasjoner skal ha autorisasjon, validering og audit-spor.
- Migrer én vertikal modul av gangen: database/API/UI/test/observability.
- Ingen sletting av V1-funksjoner før brukere har godkjent paritet og det finnes rollback.

## 5. Faser

### Fase 0 – avklaringer og baseline

**Leveranser**

- Inventar over tabeller, relasjoner, seedere, roller, ruter og integrasjoner
- Domenematrise: modul, brukerrolle, lese/skrive, kritiske regler og V1-rute
- Liste over uklarheter og ubrukte/dupliserte funksjoner
- Testdata og anonymisert staging-database
- Baseline for kritiske V1-flyt: login, utstyr, lager, utlån, transport og forespørsel

**Akseptanse**

- Teamet kan svare på hva som må ha 100 % paritet, og hva som kan forbedres i V2.
- Det finnes backup/restore-test og en dokumentert rollback-prosedyre.

### Fase 1 – teknisk fundament

**Leveranser**

- Monorepo, TypeScript strict, lint, formattering og CI
- API med health/readiness-endepunkter og strukturert logging
- React-shell med routing, layout, loading/error/empty states
- MariaDB-tilkobling, migreringer og lokal Docker Compose
- Konfigurasjon via miljøvariabler med validering ved oppstart
- PM2 ecosystem-fil for API og web-serving

**Akseptanse**

- `pnpm lint`, `pnpm test`, `pnpm build` og smoke-test kjører i CI.
- API kan startes/restartes av PM2 og rapporterer feil uten å lekke secrets.

### Fase 2 – identitet og tilgang

**Leveranser**

- Login/logout, passord-reset og OIDC/Keycloak der det kreves
- Brukerprofil og session/refresh-strategi
- RBAC som beholder alle eksisterende V1-roller og navn: `developer`, `chief`, `co-chief`, `transport_ansvarlig`, `skiftleder`, `sambandsansvarlig`, `logistikk`, `shop`, `innkjop`, `bruker` og `ingen_tilbakemeldinger`.
- Backend-guards og frontend route guards
- Audit for innlogging, rolleendringer og sensitive skriveoperasjoner

**Akseptanse**

- En bruker kan aldri få tilgang kun ved å skjule en knapp i klienten.
- Tilgangsmatrise er testet med minst én positiv og negativ test per kritisk modul.

### Fase 3 – første vertikale migrering: lager og utstyr

**Leveranser**

- Utstyr, kategorier, lokasjoner, paller og palleplasser
- Strekkodeflyt og inspeksjon
- Lagerstatus, antall, flytting og sletting med samme forretningsregler som V1
- React-tabeller med søk, filter, pagination og tydelige mutasjonsstatusser
- API-tester og Playwright-flyt for opprett → flytt → inspiser

**Akseptanse**

- V2 og V1 viser samme beholdning for et definert testdatasett.
- Samtidige eller ugyldige flyttinger gir deterministisk feilmelding og ingen delvis oppdatering.

### Fase 4 – utlån, kjøretøy og forespørsler

**Leveranser**

- Utstyrslån og retur
- Kjøretøy, kompetanseprofil og kjøretøylån
- Utstyrsforespørsler med status, godkjenning og delvis godkjenning
- Profilvisning av egne lån og forespørsler
- Varsler knyttet til statusendringer

**Akseptanse**

- Lagerbeholdning, aktive lån og retur er konsistente på tvers av modulene.
- Statusoverganger håndheves på backend og er dekket av tester.

### Fase 5 – transport, samband, shop og crew clothing

**Status:** Implementert i kode, men ikke verifisert mot anonymisert staging-database. Transport, samband, Shop, crew clothing og import/eksport er levert i API og Web med V1-tabeller og roller.

**Leveranser**

- Transportforespørsel, opprettelse, tildeling, status og inspeksjon
- Sambandsutstyr og sett med utlån/retur
- Shop, kategorier, checkout/checkin og crew clothing
- Excel/PDF-import og eksport med eksplisitt filvalidering og størrelse-/typegrenser

**Akseptanse**

- Importerte data valideres før commit og feilrader kan forklares.
- Vedlegg og eksport har tilgangskontroll og audit-spor.

### Fase 6 – oppgaver, feedback, admin og rapportering

**Leveranser**

- Oppgaver og status
- Feedback, vedlegg og notifications
- Admin for brukere, roller, innstillinger og crew-cache
- Statistikk og dashboard
- Globalt søk med tydelige tilgangsgrenser

**Akseptanse**

- Admin-funksjoner er utilgjengelige for ikke-autoriserte roller både i API og UI.
- Dashboard og statistikk har definert datagrunnlag og tids-/ytelsesgrenser.

### Fase 7 – produksjonssetting og V1-avvikling

**Leveranser**

- Staging med realistisk anonymisert kopi
- Migrerings-/cutover-runbook og verifisert restore
- Observability: PM2 logs, app metrics, error tracking, database health og backup-varsling
- Canary eller modulvis trafikkflytting
- Brukerakseptanse og opplæring
- Dokumentert avvikling av V1 først etter godkjent stabilitetsperiode

**Akseptanse**

- Definert SLA/SLO for oppetid, API-responstid og backup/restore.
- Rollback til V1 er mulig under cutover-vinduet.

## 6. Repository- og deploystruktur

```text
V1/                    # Eksisterende CodeIgniter-applikasjon og V1-migreringer
V2/
  Bifrost-API/         # Fastify API mot eksisterende MariaDB
  Bifrost-Web/         # React SPA og separat statisk Node-server
  Bifrost-Worker/      # ETL, synkronisering og bakgrunnsjobber
  packages/
    contracts/         # Delte API-typer og konstanter
    database/          # Drizzle-kartlegging av V1 og V2-tabeller
    security/          # Kryptering og nøkkelhåndtering
  database/migrations/ # Eksplisitte V2-migreringer
  ecosystem.config.cjs # PM2-konfigurasjon for alle tre prosesser
```

PM2 bør kjøre API-et som egen prosess. Frontend bør bygges statisk og serveres av Nginx eller en tilsvarende edge-server; dersom Node serverer frontend, skal det være en separat PM2-prosess. Ikke bruk PM2 som database-, migrerings- eller backupmekanisme.

Eksempel på produksjonsprosesser:

- `bifrost-api`: Node API, cluster/fork etter lastprofil
- `bifrost-web`: statisk server ved behov
- `bifrost-worker`: ETL/synkronisering, varsler, filjobber og andre bakgrunnsjobber

Database-migreringer skal kjøres som et eksplisitt deploy-steg, ikke automatisk av hver app-restart.

### Database- og synkroniseringsmodell

V1-skjemaet er system of record inntil annet er besluttet. API-et skal først kunne lese/skrive eksisterende tabeller uten å endre semantikken. Et eventuelt V2-skjema skal ha mapping mot V1-ID-er, idempotente ETL-jobber, watermark/versjonsfelt, konfliktstrategi, feiltabell og checksum-/antallskontroller. Worker håndterer planlagte og manuelle synkroniseringsjobber.

### Konfigurasjon og databeskyttelse

Web bruker kun API-lenke og klientkonfigurasjon. Hemmelige API-nøkler skal ikke bygges inn i browser-bundlen; Keycloak-token brukes mot API-et. API får database- og tekniske runtime-hemmeligheter fra env/secret store. OIDC-endepunkter, client-id, systeminnstillinger, integrasjonsnøkler, feature flags og rollemetadata leses fra DB.

Kryptering skal bruke versjonerte nøkler og støtte key rotation. Hashing skal bruke en moderne password/KDF-algoritme. Krypteringsnøkler skal aldri lagres sammen med ciphertext.

## 7. Ikke-funksjonelle krav

- Sikkerhet: httpOnly cookies eller kortlivede tokens, CSRF-strategi, rate limiting, secure headers, input/output-validering og secrets utenfor repo.
- Data: transaksjoner for lån, retur, lagerflytting og godkjenning; UTC internt og eksplisitt lokal visning.
- Tilgjengelighet: tastaturnavigasjon, fokusmarkering, lesbare kontraster og tydelige feil.
- Ytelse: server-side pagination/filtering, indekser basert på målt bruk, ingen store tabeller lastet fullt i browser.
- Drift: structured JSON logs, correlation/request-id, health checks, backup og restore-test.
- Kvalitet: unit-tester for regler, API-integrasjonstester, komponenttester og Playwright for kritiske brukerflyter.

## 8. Første arbeids-sprint

1. Bekreft målarkitektur og velg Fastify/NestJS samt Prisma/Drizzle.
2. Lag `docs/domain-matrix.md` fra V1-ruter, controllere, modeller og migrations.
3. Tell og kategoriser tabeller; dokumenter tabeller som ikke skal videreføres.
4. Opprett monorepo og CI med lint, typecheck, test og build.
5. Lag lokal MariaDB/Docker Compose og read-only V1-tilkobling for sammenligning.
6. Implementer health endpoint, config-validering og PM2 ecosystem-konfigurasjon.
7. Skriv API-kontrakt for auth + read-only equipment/list før første UI-side.

## 9. Avklarte beslutninger og åpne driftspunkter

**Avklart**

- V2 bruker eksisterende MariaDB/V1-tabeller direkte. Nye skjema/tabeller kan innføres for tekniske behov og dokumentert ETL/synkronisering.
- OIDC/Keycloak er obligatorisk. Lokal V1-innlogging videreføres ikke som innloggingsmetode i V2.
- Alle V1-funksjoner er aktive og skal videreføres.
- Filer kan lagres lokalt med metadata, tilgangskontroll og backup.
- Eksisterende V1-roller og rollenavn er autoritative og beholdes.
- PM2 kjører `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker`.

**Må avklares før staging/cutover**

- Produksjonsserver, operativsystem, TLS/reverse proxy og domener.
- Keycloak realm/client, redirect URI, claim-mapping og ansvar for drift av Keycloak.
- Tilgang til anonymisert staging-database samt godkjent backup- og restore-test.
- Lengde og ansvarsvakter for parallell V1/V2-drift før V1 kan stenges.

## 10. Definition of Done for hver modul

- Domeneregler og tilgangsmatrise er dokumentert.
- API-kontrakt, validering og feilformat er på plass.
- Migrering/lesing er testet mot representativt datasett.
- UI har loading, error, empty og success states.
- Kritiske flows har automatiserte tester.
- Audit-logg og observability er implementert.
- V1/V2-paritet er kontrollert og eventuelle avvik er akseptert.
- Runbook og rollback-notat er oppdatert.

## 11. Foreslått leveranserekkefølge

```text
Baseline → Fundament → Auth/RBAC → Lager/utstyr → Utlån/forespørsler
         → Transport/samband/shop → Admin/rapportering
         → Parallelldrift → Cutover → Avvikling av V1
```

Dette gir en gradvis vei til V2, reduserer risikoen ved datamigrering og gjør det mulig å levere verdi før hele V1 er skrevet om.
