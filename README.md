# TG Logistics CMS

Internt logistikk-CMS bygget med CodeIgniter 4 for administrasjon av utstyr, lager, transport, samband, kjøretøy og interne arbeidsflyter.

## Oversikt

Prosjektet samler logistikkrelaterte prosesser i ett system. Applikasjonen har blant annet moduler for:

- autentisering med lokal innlogging og OIDC/Keycloak-støtte
- rollebasert tilgangskontroll
- lager og lokasjoner
- utstyr, kategorier og strekkoder
- utlån og retur
- samband og sambandssett
- private utstyrsregistreringer
- kjøretøy og kompetansekrav
- transportoppdrag og persontransportforespørsler
- utstyrsforespørsler med godkjenning
- feedback og varsler
- oppgaver
- adminpanel for brukere og systeminnstillinger

## Teknologi

- PHP 8.2+
- CodeIgniter 4
- MySQL/MariaDB via `MySQLi`
- PHPUnit for tester

## Roller i systemet

Roller i kodebasen inkluderer blant annet:

- `developer`
- `chief`
- `co-chief`
- `transport_ansvarlig`
- `logistikk`
- `skiftleder`
- `sambandsansvarlig`
- `bruker`
- `ingen_tilbakemeldinger`

Tilgang styres videre per modul via `auth`- og `role`-filtre.

## Kom i gang

### 1. Installer avhengigheter

```bash
composer install
```

### 2. Opprett lokal miljøfil

Kopier `env` til `.env` og tilpass verdiene for ditt lokale miljø:

```bash
copy env .env
```

Minstekrav i `.env` er databaseoppsettet:

```dotenv
database.default.hostname = localhost
database.default.database = tg_logistics
database.default.username = root
database.default.password =
database.default.DBDriver = MySQLi
database.default.port = 3306
```

### 3. Kjør migreringer

```bash
php spark migrate
```

### 4. Seed basisdata

Prosjektet har en samlet seeder som legger inn roller, systeminnstillinger, en adminbruker og eksempeldata for lager:

```bash
php spark db:seed DatabaseSeeder
```

Standard adminbruker fra seederen:

- e-post: `admin@tg-logistics.local`
- passord: `ChangeMe1234!`

Endre passordet umiddelbart i lokale eller delte miljøer.

### 5. Start utviklingsserver

```bash
php spark serve
```

Applikasjonen blir normalt tilgjengelig på `http://localhost:8080`.

## Nyttig utviklerinfo

### Tester

```bash
composer test
```

### Base URL og miljø

- applikasjonen bruker `http://localhost/` eller `http://127.0.0.1/` som lokal base URL avhengig av host
- `https://tg.legacyh.dev/` behandles som et kjent hostnavn i appkonfigurasjonen
- standardspråk er `nb`
- standard tidssone er `Europe/Oslo`

### Autentisering og integrasjoner

Miljøfilen har plassholdere for OIDC/Keycloak:

- `auth.keycloak.baseUrl`
- `auth.keycloak.realm`
- `auth.keycloak.clientId`
- `auth.keycloak.clientSecret`
- `auth.keycloak.redirectUri`

Databasen og systeminnstillingene i prosjektet har også støtte for blant annet:

- SMTP-oppsett for e-post
- Google Maps API-nøkkel
- OSRM base URL
- Statens vegvesen-relaterte innstillinger
- crew API/cache-innstillinger

## Prosjektstruktur

De viktigste mappene:

- `app/` applikasjonskode, kontrollere, filtre, migreringer og seedere
- `public/` offentlig webrot
- `system/` CodeIgniter-kjerne
- `writable/` cache, logger, sessions og opplastinger
- `tests/` tester

## Versjonskontroll

Repoet ignorerer blant annet:

- `vendor/`
- `node_modules/`
- `.env`
- runtime-filer under `writable/`
- lokale utviklermapper som `PHP/`

## Sikkerhet

Koden er satt opp med flere grunnleggende tiltak:

- CSRF-filter globalt
- `invalidchars`-filter globalt
- sikre headere etter respons
- autentiserings- og rollefiltre på beskyttede ruter

## Lisens

Prosjektspesifikk kode i dette repoet er proprietær og lisensiert for intern bruk og intern videreutvikling i TG. Se [LICENSE](c:/Users/Mathias/Desktop/TG-Logistics-CMS/LICENSE) for vilkår.

Tredjepartskomponenter, inkludert CodeIgniter og andre avhengigheter, er fortsatt underlagt sine egne lisenser.
