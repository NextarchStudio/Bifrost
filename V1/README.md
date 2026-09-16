# Bifrost V1

Den eksisterende Bifrost-applikasjonen, bygget med PHP 8.2+, CodeIgniter 4 og MariaDB 10.6+. V1 er aktiv mens V2 utvikles og er funksjonell referanse for migreringen.

## Lokal oppstart

```bash
composer install
```

Kopier `.env.example` til `.env`, fyll inn databaseinnstillingene og kjør:

```bash
php spark migrate
php spark db:seed DatabaseSeeder
php spark serve
```

Standard lokal adresse er `http://localhost:8080`.

## Funksjoner

V1 dekker blant annet innlogging/OIDC, RBAC, utstyr, lager og paller, utlån, forespørsler, kjøretøy, transport, samband, shop, crew clothing, strekkoder, oppgaver, feedback, varsler, profiler, administrasjon, statistikk og audit.

Alle funksjoner regnes som aktive og skal videreføres i V2.

## Roller

`developer`, `chief`, `co-chief`, `transport_ansvarlig`, `skiftleder`, `sambandsansvarlig`, `logistikk`, `shop`, `innkjop`, `bruker` og `ingen_tilbakemeldinger`.

## Runtime-data

Innhold i `writable/cache`, `writable/debugbar`, `writable/logs`, `writable/session` og `writable/uploads` skal ikke versjoneres. Katalogenes `index.html`-filer beholdes som placeholders.

## Lisens

Bifrost er proprietær programvare eid av Nextarch Studio og omfattes av repositoryets rotlisens. Lisenser for tredjepartskomponenter ligger under `THIRD_PARTY_LICENSES` og i de relevante avhengighetene.
