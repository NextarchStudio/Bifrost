# Bifrost V2

V2 er et TypeScript-monorepo med tre separate applikasjoner:

- `Bifrost-API`: Fastify API mot eksisterende MariaDB
- `Bifrost-Web`: React, Vite og Tailwind CSS
- `Bifrost-Worker`: ETL, synkronisering og bakgrunnsjobber

Delte kontrakter og database-definisjoner ligger under `packages/`.

## Krav

- Node.js 22+
- pnpm 11+
- MariaDB 10.6+
- PM2 for produksjonsdrift
- Docker Engine med Compose for valgfritt lokalmiljø

## Installasjon og kvalitetssjekk

```bash
pnpm install
pnpm check
```

`pnpm check` kjører lint, TypeScript-kontroll, tester og produksjonsbuild for hele workspace-et.

Den samme kontrollen kjører i `.github/workflows/v2-ci.yml` ved endringer under `V2/`. Jobben bruker frosset låsefil, kjører produksjonsaudit og deretter lint, typekontroll, bygg og tester.

Før stagingstart følges [staging-runbooken](docs/staging-runbook.md). Etter migrering og hemmelighetsflytting kjøres den lesebaserte kontrollen:

```bash
pnpm --filter @bifrost/api preflight
```

## Lokalt utviklingsmiljø

Compose-oppsettet starter en MariaDB 10.11-database på `127.0.0.1:3307` og Keycloak på `http://localhost:8081`. Imagene er versjons- og digestlåst. Databasen og Keycloak-data beholdes i navngitte Docker-volumer når miljøet stoppes.

```powershell
Copy-Item .env.compose.example .env.compose
# Erstatt alle replace-with-verdier i .env.compose
pnpm infra:up
pnpm infra:status
```

Definisjonene kan valideres uten å starte containere, og den samme kontrollen kjører i CI:

```powershell
pnpm infra:validate
```

Opprett V1-skjemaet fra repositoryroten etter at `V1/.env` peker på port `3307` og de samme databaseverdiene:

```powershell
Set-Location V1
php spark migrate
php spark db:seed DatabaseSeeder
Set-Location ../V2
```

Kjør deretter `database/migrations/0001_bifrost_v2_foundation.sql` eksplisitt mot den lokale databasen. Sett OIDC-feltene i `system_settings` til base-URL `http://localhost:8081`, realm `bifrost-local`, client-id `bifrost-web`, redirect URI `http://localhost:3000/`, `enable_keycloak_login=1` og `enable_local_login=0`.

Realm-importen oppretter PKCE-klienten og alle 11 V1-roller, men med vilje ingen brukere eller standardpassord. Opprett en lokal testbruker i Keycloak-konsollen, tildel ønskede realm-roller og sett tilsvarende `wannabe_role_name` på Bifrost-rollene som skal mappes. Uten rollemapping får nye OIDC-brukere rollen `bruker`.

```powershell
pnpm infra:logs
pnpm infra:down
```

`infra:down` sletter ikke volumene. Lokal database- eller realm-reset skal gjøres eksplisitt etter at det er kontrollert at prosjektet `bifrost-v2-local` er riktig mål.

## Miljøfiler

Kopier `.env.example` i API, Web og Worker til `.env` i samme katalog.

API og Worker bruker kun:

```text
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD
DATABASE_SSL
```

Web bruker kun:

```text
VITE_API_URL
VITE_API_TOKEN
```

`VITE_API_TOKEN` er synlig i browser-bundlen og må derfor aldri være en serverhemmelighet. Brukeridentitet og tilgang skal håndheves med OIDC/Keycloak-token i API-et.

## Database

V1-tabellene beholdes. Drizzle-definisjonene i `packages/database` mapper mot eksisterende tabellnavn. Nye tekniske tabeller bruker `bifrost_`-prefiks.

Kjør migreringen i `database/migrations/0001_bifrost_v2_foundation.sql` eksplisitt mot korrekt database før funksjoner som krever V2-jobbkø eller sikker konfigurasjon tas i bruk. Ta backup og verifiser restore først.

Etter tabellmigreringen kan eksisterende V1-hemmeligheter kopieres til kryptert V2-lagring:

```bash
pnpm --filter @bifrost/api migrate:secrets
```

Kommandoen oppretter en lokal master key i `V2/var/secrets/settings.key` og kopierer hemmelighetene til `bifrost_secure_settings`. Nøkkelfilen og databasebackupen må sikres separat. Kommandoen fjerner ikke V1-feltene, fordi V1 må fortsette å fungere under parallell drift.

Crew-/badge-oppslaget leser URL og endepunkt fra V1-tabellen `system_settings`, mens bearer-tokenet leses dekryptert fra `bifrost_secure_settings`. Eksisterende `crew_directory_cache`, årlig cache-nullstilling og brukerens `badge_scan_number` gjenbrukes, slik at V1 og V2 kan kjøre parallelt.

Regler for privat utstyr leses og administreres direkte i V1-tabellen `private_equipment_prefixes`. V2 krever eksplisitt bekreftelse både i Web og API før utstyr med et registrert prefiks kan lånes ut, og viser eierpåminnelse ved retur.

Utstyrsforespørsler bruker V1-tabellene `equipment_requests` og `equipment_request_items`. Godkjenning, lagerreduksjon og opprettelse av koblede lån utføres i samme databasetransaksjon; siste retur flytter en utlevert forespørsel til `returned`.

Kjøretøymodulen bruker V1-tabellene `vehicles`, `vehicle_loans`, `wannabe_competencies` og `wannabe_vehicle_kdo` direkte. Oppretting, utlån, retur, KDO og førerkort-/kompetansekontroll beholder V1-rollene og audit-sporet. Statens vegvesen-oppslag bruker den krypterte innstillingen `vegvesen.api_key`; API-nøkkelen eksponeres aldri til Web.

Profilmodulen samler aktive utstyrs-, kjøretøy- og sambandlån samt åpne forespørsler fra V1-tabellene. V1-reglene for innsyn i andres profiler og blokkering av profilbilder beholdes. Profilbildet hentes server-side med kryptert crew-token og sendes som en kontrollert bildeproxy; tokenet eksponeres ikke i browseren. Lokal passordendring videreføres ikke fordi Keycloak/OIDC er obligatorisk i V2.

Transportmodulen bruker V1-tabellene `transport_jobs` og `transport_job_stops` direkte. V1-rollene beholdes: ledelse/logistikk oppretter, tildeler, starter og fullfører oppdrag, mens `innkjop` rekvirerer persontransport og ser egne turer. Kjøretøyreservasjon, kompetansekontroll, kilometerstand og audit oppdateres transaksjonelt. Geokoding går via Nominatim fra API-et, og rutelengde beregnes mot `osrm_base_url` i `system_settings`; Web kontakter aldri rutetjenestene direkte.

Sambandsmodulen bruker V1-tabellene `comms_items`, `comms_sets`, `comms_set_items`, `comms_loans` og `comms_loan_items` direkte. Enheter, tilbehør, standardsett, badge-/personoppslag, enkelt- og settutlån, delretur og bytte er tilgjengelig for de samme fem V1-rollene. Beholdning og lånelinjer låses og oppdateres i én transaksjon, slik at mislykkede settutlån eller returer ikke etterlater delvis lagerendring.

Shop-modulen bruker V1-tabellene `shop_categories`, `shop_items` og `shop_movements` direkte. Oppretting, inn-/utsjekk, sletting med historikk, ettårsopprydding, XLSX/XLS/CSV-varetelling og CSV/PDF-eksport er videreført. Import og lagerbevegelser er transaksjonelle, filstørrelsen er begrenset til 10 MB, og eksport krever samme API-autorisasjon som resten av Shop.

Crewtøy bruker V1-tabellene `crew_clothing_crews`, `crew_clothing_members` og `crew_clothing_inventory`. Badge-/Wannabe-oppslag, automatisk crewoppretting, størrelser, utlevering av T-skjorte/genser og crewtøylager er levert. De fem V1-Shop-rollene har operativ tilgang; bare `developer`, `chief` og `co-chief` kan endre crew og maksgrenser, slik V1-adminrutene krever. Utleveringsstatus reduserer ikke crewtøylageret automatisk fordi V1 heller ikke kobler disse operasjonene.

Oppgavemodulen bruker V1-tabellen `tasks` og beholder V1s eierregler. Alle innloggede kan se og endre status på egne oppgaver. `developer`, `chief`, `co-chief` og `logistikk` kan i tillegg opprette og tildele oppgaver, se alle oppgaver og koble dem til aktive transportoppdrag. Oppretting og statusendring har audit og kjøres transaksjonelt.

Tilbakemeldinger og varsler bruker V1-tabellene `feedback_entries`, `feedback_notifications` og `feedback_notification_reads`. Alle innloggede uten `ingen_tilbakemeldinger` kan melde inn bugs/features, se egne åpne innmeldinger og slette egne ventende innmeldinger. `developer` og `logistikk` ser alle åpne innmeldinger, mens bare `developer` kan endre status. Nye vedlegg lagres under `V2/var/uploads/feedback` og speiles til `V1/writable/uploads/feedback`, slik at begge versjoner kan åpne dem under parallell drift; API-et leser fra begge områdene. Vedlegg er begrenset til validerte JPG/PNG/WEBP/GIF-filer på 5 MB, og alle filnedlastinger har eier-/rollekontroll. Det globale varselet beholder V1-flyten med de tre nyeste `fixed`/`added`-hendelsene og markering som lest.

Kjerneadministrasjon bruker V1-tabellene `users`, `roles`, `user_roles`, `wannabe_competencies` og `system_settings`. `developer`, `chief` og `co-chief` kan opprette OIDC-klare brukere, styre aktiv-status, roller og kompetanser samt administrere lokale roller med de samme beskyttede rollenavnene som V1. De samme tre rollene har statistikk for alle V1-domenene direkte fra eksisterende tabeller. Bare `developer` ser og endrer systeminnstillinger. Hemmeligheter returneres aldri til Web og nye verdier skrives kun kryptert til `bifrost_secure_settings`; audit inneholder bare hvilke hemmelighetsnøkler som ble endret. Lokal passordinvitasjon videreføres ikke fordi Keycloak/OIDC er obligatorisk, og V2 tvinger lokal innlogging av.

V1-funksjonen «Tøm crew-cache og brukere» er bevart med samme sluttresultat, men er eksplisitt merket som destruktiv crew-reset. Bare `developer` får forhåndsvise eller kjøre den. Web viser antall rader som berøres, krever en eksakt bekreftelsesfrase og en siste dialog; API-et validerer frasen på nytt, blokkerer hvis beskyttet bruker-ID 2 mangler og utfører slettingene i én transaksjon uten `TRUNCATE`. Operasjonen skal aldri brukes som vanlig cachevedlikehold.

Dashboardet er startsiden for alle innloggede og viderefører V1s aktive utstyrs-/sambandsutlån, kjøretøylån, transporter, kjørt distanse og utstyr per lokasjon. Globalt søk er tilgjengelig for `developer`, `chief`, `co-chief` og `logistikk`, med de samme V1-feltene og grensen på 25 utstyrstreff og 25 utlånstreff. Jokertegn i brukerinput escapes før databasesøket.

## PM2

```bash
pnpm build
pm2 start ecosystem.config.cjs
pm2 status
```

Prosessene heter `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker`. API lytter på `3001`, Web på `3000`. Alle tre håndterer `SIGINT` og `SIGTERM` kontrollert ved stopp eller restart fra PM2.

## Viktige regler

- Web snakker kun med API-et.
- Databaseskriving går gjennom API eller kontrollerte Worker-jobber.
- Migreringer kjøres aldri automatisk ved restart.
- Secrets, lokale filer, logger og opplastinger skal ikke committes.
- V1-funksjoner fjernes ikke før paritet og rollback er verifisert.
