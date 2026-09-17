# Bifrost

Bifrost er Nextarch Studios interne logistikkplattform for utstyr, lager, utlån, kjøretøy, transport, samband, shop, oppgaver og administrasjon.

Repositoryet inneholder både den operative V1-applikasjonen og den nye V2-plattformen. V1 beholdes intakt mens V2 bygges modulvis med full funksjonsparitet og samme MariaDB-datagrunnlag.

## Repositorystruktur

```text
Bifrost/
├── V1/                  # CodeIgniter 4 / PHP – eksisterende produksjonsløsning
├── V2/
│   ├── Bifrost-API/     # Fastify API / TypeScript
│   ├── Bifrost-Web/     # React / TypeScript / Tailwind
│   ├── Bifrost-Worker/  # ETL, synkronisering og bakgrunnsjobber
│   ├── packages/        # Delte kontrakter og databaselag
│   └── database/        # Eksplisitte V2-migreringer
└── ROADMAP.md           # Migreringsplan og akseptansekriterier
```

## Status

- V1 er aktiv og alle funksjoner skal videreføres.
- V1-databasestrukturen er fortsatt system of record.
- V2-fundamentet er opprettet som et pnpm-monorepo.
- Bifrost-API, Bifrost-Web og Bifrost-Worker kjøres som separate PM2-prosesser.
- OIDC/Keycloak er obligatorisk i V2.
- Et separat V2-skjema kan brukes via kontrollerte ETL-/synkroniseringsjobber.
- Dashboard, globalt søk, lager, utstyr, utlån, forespørsler, kjøretøy, profil, transport, samband, Shop, crewtøy, oppgaver, tilbakemeldinger, varsler, administrasjon, V1-kompatibel statistikk og kontrollert crew-reset er implementert i V2-kode; staging-paritet gjenstår.

Se [ROADMAP.md](ROADMAP.md) for plan, arkitektur og leveranserekkefølge.

## Kom i gang med V1

```bash
cd V1
composer install
php spark migrate
php spark serve
```

Kopier `V1/.env.example` til `V1/.env` og fyll inn lokale databaseinnstillinger før oppstart. Se [V1/README.md](V1/README.md) for detaljer.

## Kom i gang med V2

Krav: Node.js 22+, pnpm 11+ og MariaDB 10.6+.

```bash
cd V2
pnpm install
pnpm check
pnpm dev
```

Opprett lokale miljøfiler fra `.env.example` i hver applikasjon:

- API og Worker inneholder kun databaseinnstillinger.
- Web inneholder API-lenke og offentlig klientidentifikator.
- Hemmelige nøkler skal aldri legges i Web-miljøet eller committes.

API-et lytter på port `3001`, Web på port `3000`. Endepunktene `GET /health` og `GET /ready` brukes til driftssjekk.

Se [V2/README.md](V2/README.md) for utvikling, bygg og PM2.

## Produksjon med PM2

Etter installasjon og produksjonsbuild:

```bash
cd V2
pnpm install --frozen-lockfile
pnpm check
pm2 start ecosystem.config.cjs
pm2 save
```

Databasemigreringer kjøres som et eksplisitt deploy-steg. De skal ikke kjøres automatisk ved PM2-restart.

## Roller

V2 beholder de eksisterende rollenavnene:

`developer`, `chief`, `co-chief`, `transport_ansvarlig`, `skiftleder`, `sambandsansvarlig`, `logistikk`, `shop`, `innkjop`, `bruker` og `ingen_tilbakemeldinger`.

## Sikkerhet og data

- Web har aldri direkte databasetilgang.
- API-et håndhever autentisering, autorisasjon, validering og audit.
- Sensitive databaseverdier krypteres med versjonerte nøkler.
- Passord og andre verifiseringshemmeligheter hashes og dekrypteres aldri.
- Lokale filer lagres utenfor Git og skal inngå i backup/restore.
- `.env`, nøkler, logger, opplastinger, dependencies og build-output ignoreres av Git.

## Lisens

Internt prosjekt for Nextarch Studio. Ikke publiser kode, konfigurasjon eller data uten eksplisitt godkjenning.
