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

## Installasjon og kvalitetssjekk

```bash
pnpm install
pnpm check
```

`pnpm check` kjører lint, TypeScript-kontroll, tester og produksjonsbuild for hele workspace-et.

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

## PM2

```bash
pnpm build
pm2 start ecosystem.config.cjs
pm2 status
```

Prosessene heter `bifrost-api`, `bifrost-web` og `bifrost-worker`. API lytter på `3001`, Web på `3000`.

## Viktige regler

- Web snakker kun med API-et.
- Databaseskriving går gjennom API eller kontrollerte Worker-jobber.
- Migreringer kjøres aldri automatisk ved restart.
- Secrets, lokale filer, logger og opplastinger skal ikke committes.
- V1-funksjoner fjernes ikke før paritet og rollback er verifisert.
