# Bifrost V2

V2 er et TypeScript-monorepo med tre separate applikasjoner:

- `Bifrost-API`: Fastify API mot eksisterende MariaDB
- `Bifrost-Web`: React, Vite og Tailwind CSS
- `Bifrost-Worker`: ETL, synkronisering og bakgrunnsjobber

Delte kontrakter og database-definisjoner ligger under `packages/`.

## Krav

- Node.js 26.9.0+
- npm 12.0.2+
- pnpm 12.4.2+
- MariaDB 10.6+
- PM2 7.0.4+ for produksjonsdrift
- Docker Engine med Compose for valgfritt lokalmiljø

## Installasjon og kvalitetssjekk

```bash
pnpm install
pnpm check
pnpm e2e:install
pnpm e2e
```

`pnpm check` kjører lint, TypeScript-kontroll, API-/domene-tester og produksjonsbuild for hele workspace-et. `pnpm e2e` kjører de faktiske React-flytene i Chromium med et deterministisk API, inkludert lagerflyt, skanner, sidemeny, lokasjonssletting, branding og modalplassering.

Den samme kontrollen kjører i `.github/workflows/v2-ci.yml` ved endringer under `V2/`. Jobben bruker frosset låsefil, kjører produksjonsaudit, lint, typekontroll, bygg, API-/domene-tester og Playwright i Chromium.

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

Kjør deretter alle filene i `database/migrations/` i nummerrekkefølge mot den lokale databasen. Migrering `0003_web_origins.sql` registrerer de to produksjonsdomenene og utviklingsadressen i `bifrost_web_origins`. Migrering `0004_crew_provisioning.sql` oppretter Crew-reglene og e-postbryteren; bryteren er av som standard. Sett OIDC-feltene i `system_settings` til base-URL `http://localhost:8081`, realm `bifrost-local`, client-id `bifrost-web`, client secret `bifrost-local-development-only`, fallback redirect URI `http://127.0.0.1:3000/auth/callback` og `enable_keycloak_login=1`. Kjør deretter `pnpm --filter @bifrost/api migrate:secrets` slik at secret brukes fra kryptert V2-lagring. Kommandoen kopierer bare manglende nøkler og overskriver aldri en hemmelighet som allerede finnes i den krypterte lagringen. `enable_local_login=1` viser i tillegg lokal V1-innlogging som reserve.

Realm-importen oppretter en confidential Authorization Code-klient med PKCE S256 og alle 11 V1-roller, men med vilje ingen brukere eller standardpassord. Den dokumenterte development-secreten gjelder bare lokal Compose. Opprett en lokal testbruker i Keycloak-konsollen, tildel ønskede realm-roller og sett tilsvarende `wannabe_role_name` på Bifrost-rollene som skal mappes. Uten rollemapping får nye OIDC-brukere rollen `bruker`.

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

`VITE_API_TOKEN` er synlig i browser-bundlen og må derfor aldri være en serverhemmelighet. Keycloak client secret og Keycloak-token forlater aldri API-et. Etter server-side kodeutveksling får nettleseren bare en utløpende, ugjennomsiktig Bifrost-økt i en `HttpOnly`, `SameSite=Lax` og produksjonsmessig `Secure` cookie.

I utvikling brukes `VITE_API_URL=http://127.0.0.1:3001`. Produksjonsbygget skal bruke `VITE_API_URL=same-origin`; nettleseren bruker da automatisk domenet siden ble åpnet på, slik at samme statiske build kjører på både `https://tg.legacyh.dev` og `https://bifrost.tg.no`. Dette gjelder også når domenet er proxied gjennom Cloudflare. PM2-produksjonsprofilen bruker `127.0.0.1:3102` for Web og `127.0.0.1:3103` for API etter portkartlegging på målserveren. Reverse proxy sender `/api/`, `/health` og `/ready` til API-porten og øvrige ruter til Web-porten. Cloudflare skal ikke cache HTML eller API-responser; hash-versjonerte filer under `/assets/` kan caches lenge. Se [CyberPanel/OpenLiteSpeed-oppsettet](docs/cyberpanel-openlitespeed.md); et alternativt Nginx-eksempel ligger i [docs/nginx-bifrost.conf.example](docs/nginx-bifrost.conf.example).

Web starter SSO mot `POST /api/v1/auth/oidc/start`. API-et oppretter state, nonce og PKCE S256 før redirect til Keycloak. Etter callback sender Web bare engangskoden og state til `POST /api/v1/auth/oidc/callback`; API-et validerer flyten og veksler koden server-side med kryptert client secret. Keycloak access- og refresh-token returneres aldri til Web. Den resulterende Bifrost-økten lagres kun som SHA-256-hash i `bifrost_local_sessions`, varer i 12 timer og revokeres ved utlogging. Cookie-baserte mutasjoner krever i tillegg en CORS-beskyttet `X-Bifrost-Request`-header. Lokal innlogging bruker eksisterende Argon2id-hash i V1-tabellen `users` via `POST /api/v1/auth/local`; rått passord lagres aldri. Vellykkede forsøk skrives til både V1-tabellen `login_attempts` og `audit_logs`, mens token og claims aldri lagres i auditdata.

Alle autoritative V1-roller og tilgangsgrupper er definert én gang i `packages/contracts`. API-et håndhever matrisen, Web bruker den samme katalogen til navigasjon, og CI tester alle 11 roller mot hvert tilgangsområde. Den dokumenterte matrisen og åpne stagingavklaringer ligger i [docs/domain-matrix.md](docs/domain-matrix.md).

## Database

V1-tabellene beholdes. Drizzle-definisjonene i `packages/database` mapper mot eksisterende tabellnavn. Nye tekniske tabeller bruker `bifrost_`-prefiks.

Kjør migreringene under `database/migrations/` i nummerrekkefølge mot korrekt database før funksjoner som krever V2-jobbkø, sikker konfigurasjon eller lokal sesjonshåndtering tas i bruk. Ta backup og verifiser restore først.

`bifrost_web_origins` er den autoritative listen for CORS og OIDC callback. Standardlisten er:

- `https://tg.legacyh.dev`
- `https://bifrost.tg.no`
- `http://127.0.0.1:3000`

Listen kan endres av `developer` under Administrasjon → Systeminnstillinger. API-et godtar bare en callback på en aktiv origin i denne tabellen; fallback-feltet i `system_settings` brukes når Web-origin ikke er oppgitt.

Etter tabellmigreringen kan eksisterende V1-hemmeligheter kopieres til kryptert V2-lagring:

```bash
pnpm --filter @bifrost/api migrate:secrets
```

Kommandoen oppretter en lokal master key i `V2/var/secrets/settings.key` og kopierer hemmelighetene til `bifrost_secure_settings`. Nøkkelfilen og databasebackupen må sikres separat. Kommandoen fjerner ikke V1-feltene, fordi V1 må fortsette å fungere under parallell drift.

Crew-/badge-oppslaget leser URL og endepunkt fra V1-tabellen `system_settings`, mens bearer-tokenet leses dekryptert fra `bifrost_secure_settings`. Eksisterende `crew_directory_cache`, årlig cache-nullstilling og brukerens `badge_scan_number` gjenbrukes, slik at V1 og V2 kan kjøre parallelt. Den faktiske Crew-responsen for en Wannabe-ID kan inspiseres uten å skrive data eller vise bearer-tokenet:

```bash
pnpm --filter @bifrost/api build
pnpm --filter @bifrost/api inspect:crew -- 8468
```

Admin → Brukere kan provisjonere en bruker med enten badge eller Wannabe-ID og trykk på Enter. Oppslagstypen velges eksplisitt, slik at numeriske badge-nummer ikke forveksles med Wannabe-ID. API-et henter navn, Wannabe-ID, crew, crewrolle og e-post når tjenesten deler den, krever treff på minst én aktiv regel i `bifrost_crew_provisioning_rules`, oppretter eller synkroniserer brukeren og legger til alle matchende V1-roller. Hvis Crew API mangler e-post, gjenbrukes adressen fra en eksisterende V1-bruker; bare en helt ny bruker må få e-post oppgitt av admin før opprettelsen fullføres. Generelle crewregler og mer spesifikke crewrolle-regler kan kombineres, for eksempel `Arena:Logistikk` → `logistikk` og `Arena:Logistikk` + `Chief` → `chief`. Manuelt tildelte roller fjernes ikke ved synkronisering.

Bare `developer` kan slå velkomst-e-post av eller på under Admin → Systeminnstillinger → SMTP og e-post. Bryteren `crew_provisioning_email_enabled` er av som standard og gjelder bare helt nye brukere opprettet fra Crew-oppslag; eksisterende brukere får ikke ny e-post ved synkronisering. Aktivering avvises til SMTP-avsender, vert og port er satt, og et kryptert `smtp.password` kreves når SMTP-brukernavn brukes. Når bryteren er på, legger API-et en `send_user_welcome_email`-jobb i `bifrost_jobs`, og Bifrost-Worker sender via SMTP-verdiene i `system_settings`. Worker kontrollerer bryteren på nytt før utsendelse og prøver midlertidige feil på nytt uten å lagre SMTP-passord eller Crew-token i jobbdata.

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

Kjerneadministrasjon bruker V1-tabellene `users`, `roles`, `user_roles`, `wannabe_competencies` og `system_settings`, i tillegg til V2-tabellen for Crew-regler. `developer`, `chief` og `co-chief` kan opprette OIDC-klare brukere, provisjonere dem fra Crew API, styre aktiv-status, roller og kompetanser samt administrere lokale roller med de samme beskyttede rollenavnene som V1. De samme tre rollene har statistikk for alle V1-domenene direkte fra eksisterende tabeller. Bare `developer` ser og endrer systeminnstillinger, inkludert databasebryterne for lokal reserveinnlogging og velkomst-e-post; Keycloak kan ikke slås av i V2. Hemmeligheter returneres aldri til Web og nye verdier skrives kun kryptert til `bifrost_secure_settings`; audit inneholder bare hvilke hemmelighetsnøkler som ble endret.

V1-funksjonen «Tøm crew-cache og brukere» er bevart med samme sluttresultat, men er eksplisitt merket som destruktiv crew-reset. Bare `developer` får forhåndsvise eller kjøre den. Web viser antall rader som berøres, krever en eksakt bekreftelsesfrase og en siste dialog; API-et validerer frasen på nytt, blokkerer hvis beskyttet bruker-ID 2 mangler og utfører slettingene i én transaksjon uten `TRUNCATE`. Operasjonen skal aldri brukes som vanlig cachevedlikehold.

Dashboardet er startsiden for alle innloggede og viderefører V1s aktive utstyrs-/sambandsutlån, kjøretøylån, transporter, kjørt distanse og utstyr per lokasjon. Globalt søk er tilgjengelig for `developer`, `chief`, `co-chief` og `logistikk`, med de samme V1-feltene og grensen på 25 utstyrstreff og 25 utlånstreff. Jokertegn i brukerinput escapes før databasesøket.

Strekkodeverktøyet genererer V1-kompatible `.udl`-filer fra enkeltkoder, intervaller eller begge deler. API-et bevarer UTF-8 BOM, CRLF, nullutfylling og rekkefølgebasert duplikatfjerning fra V1. Tilgangen følger logistikkrollene, og hver eksport begrenses til 100 000 unike koder for å beskytte API-prosessen.

## PM2

```bash
pnpm build
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 status
```

Prosessene heter `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker`. Standardprofilen bruker API-port `3001` og Web-port `3000`; produksjonsprofilen bruker henholdsvis `3103` og `3102`, bundet til localhost. Alle tre håndterer `SIGINT` og `SIGTERM` kontrollert ved stopp eller restart fra PM2.

Etter oppstart kan hele kjeden kontrolleres uten å skrive data:

```bash
# Lokal utvikling
pnpm smoke

# Ett av produksjonsdomenene bak reverse proxy
BIFROST_WEB_URL=https://bifrost.tg.no BIFROST_API_URL=https://bifrost.tg.no pnpm smoke
```

Smoke-testen kontrollerer Web, health, readiness/database, origin-spesifikk OIDC callback, confidential OIDC-start med PKCE og CORS for `PUT`, `PATCH` og `DELETE`.

## Viktige regler

- Web snakker kun med API-et.
- Databaseskriving går gjennom API eller kontrollerte Worker-jobber.
- Migreringer kjøres aldri automatisk ved restart.
- Secrets, lokale filer, logger og opplastinger skal ikke committes.
- V1-funksjoner fjernes ikke før paritet og rollback er verifisert.
