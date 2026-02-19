# TG Logistics CMS

Internt logistikk-CMS bygget med **CodeIgniter 4** for håndtering av utstyr, lager, utlån, forespørsler og transport.

## Teknologi

- PHP 8.2+ (anbefalt)
- CodeIgniter 4.7.0
- MariaDB 10.6+
- utf8mb4 / utf8mb4_unicode_ci

## Hovedfunksjoner

- Innlogging (lokal + provider-støtte i kodebasen)
- RBAC (roller og tilgangskontroll)
- Lagerstyring:
  - lokasjoner
  - paller
  - legg utstyr på palle via strekkode
  - inspeksjon av palle
- Utstyr:
  - oppretting og liste
  - flytting til palle via strekkode
  - lagerstatus og antall
- Utlån:
  - utlån/retur
  - aktive lån
- Forespørsler:
  - utstyrsforespørsler
  - delvis godkjenning
  - kobling mot utlån/lager
- Transport:
  - persontransport-forespørsler
  - utstyrstransport
  - tildel/begynn/ferdig
  - inspeksjon av oppdrag
- Profil:
  - se egne lån/forespørsler
  - endre passord

## Roller

- developer
- chief
- co-chief
- transport_ansvarlig
- skiftleder
- bruker

## Kom i gang

1. Klon repoet
2. Installer avhengigheter:

```bash
composer install
```

3. Opprett `.env` (kopier fra `env`/`.env.example` hvis tilgjengelig) og sett database:
   - `database.default.hostname`
   - `database.default.database`
   - `database.default.username`
   - `database.default.password`
   - `database.default.DBDriver = MySQLi`

4. Kjør migreringer:

```bash
php spark migrate
```

5. Seed data (hvis prosjektet har seedere):

```bash
php spark db:seed
```

6. Start server:

```bash
php spark serve
```

Åpne deretter:

- `http://localhost:8080` (hvis `spark serve`)
- eller lokal XAMPP-host etter ditt oppsett.

## Viktig for versjonskontroll

`.gitignore` er satt opp til å ignorere blant annet:

- `AdminTemplate/`
- `vendor/`
- `node_modules/`
- runtime-filer i `writable/`

## Sikkerhet

- CSRF aktivert
- rollebasert tilgang
- validering av input
- audit-logging for sentrale write-operasjoner

## Lisens

Internt prosjekt. Legg til lisensfil ved behov før offentlig distribusjon.

