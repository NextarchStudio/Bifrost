# Staging-runbook for Bifrost V2

Denne runbooken brukes mot en anonymisert kopi av V1-databasen. Den gir ikke tillatelse til å kjøre mot produksjon eller å utføre den destruktive crew-resetten.

## 1. Forutsetninger

- MariaDB 10.6 eller nyere.
- Node.js 26.9.0+, npm 12.0.2+, pnpm 12.4.2+ og PM2 7.0.4+ på stagingserveren.
- En anonymisert databasekopi med samme skjema som aktiv V1.
- Keycloak-klienten må være confidential og ha eksakt redirect URI med `/auth/callback` samt Web Origin for `https://tg.legacyh.dev`, `https://bifrost.tg.no` og `http://127.0.0.1:3000`.
- Dokumentert ansvarlig person for backup, restore og godkjenning.

## 2. Backup og restore-bevis

1. Ta en konsistent databasebackup før V2-migreringen.
2. Beregn og lagre checksum for backupfilen utenfor repositoryet.
3. Restore backupen til en separat kontroll-database.
4. Kontroller tabellantall og et avtalt sett radtall mot kilden.
5. Registrer tidspunkt, varighet, operatør og resultat i endringsloggen.

Fortsett ikke dersom restore ikke er verifisert. Databasefiler og logger med persondata skal ikke committes.

## 3. Konfigurasjon

Opprett `.env` fra eksempelfilene. API og Worker skal bare ha `DATABASE_*`. Web skal bare ha API-lenke og offentlig klientidentifikator. Bruk egne stagingbrukere og minst én representativ bruker for hver eksisterende V1-rolle.

## 4. Installer og bygg

```bash
cd V2
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm check
```

## 5. V2-tabeller og krypterte innstillinger

1. Kjør alle SQL-filene under `database/migrations/` i nummerrekkefølge mot stagingdatabasen. `0003_web_origins.sql` og `0004_crew_provisioning.sql` må være kjørt før ny API-/Worker-versjon startes. `0004` oppretter Crew-reglene og lar velkomst-e-post være av som standard.
2. Bygg API-et og migrer eksisterende hemmeligheter:

```bash
pnpm --filter @bifrost/api build
pnpm --filter @bifrost/api migrate:secrets
```

3. Bekreft at `oidc.client_secret` finnes kryptert i `bifrost_secure_settings`. Sikkerhetskopier `V2/var/secrets/settings.key` til godkjent hemmelighets-/backupområde. Databaseraden kan ikke dekrypteres uten denne filen.
4. Ikke slett V1s gamle hemmelighetskolonner mens V1 og V2 kjører parallelt. Tilgang til stagingdatabasen må derfor begrenses som om disse verdiene fortsatt er plaintext.

## 6. Lesebasert preflight

```bash
pnpm --filter @bifrost/api preflight
```

Preflighten endrer ingen data. Den skal ende med null feil og kontrollerer:

- MariaDB-versjon og aktiv database;
- alle tabeller og kolonner som V2s datalag forventer;
- `system_settings.id=1`, obligatorisk Keycloak og status for databasekontrollert lokal reserveinnlogging;
- alle autoritative V1-roller;
- beskyttet bruker-ID 2;
- V2-tabellen for krypterte innstillinger og lokal 32-byte master key.
- Crew-regeltabellen, e-postbryteren og komplett SMTP-konfigurasjon når utsendelse er aktiv.

Advarsel om manglende krypterte innstillinger må avklares før oppstart. Hemmelige verdier skrives aldri til preflightloggen.

## 7. Start med PM2

```bash
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 status
pm2 logs Bifrost-API --lines 100
pm2 logs Bifrost-Web --lines 100
pm2 logs Bifrost-Worker --lines 100
```

Produksjonsprofilen binder Web til `127.0.0.1:3102` og API til `127.0.0.1:3103`. Kontroller `GET /health`, `GET /ready`, Keycloak-innlogging og at Web bare kommuniserer med API-et.

Kjør deretter smoke-testen mot hvert domene:

```bash
BIFROST_WEB_URL=https://tg.legacyh.dev BIFROST_API_URL=https://tg.legacyh.dev pnpm smoke
BIFROST_WEB_URL=https://bifrost.tg.no BIFROST_API_URL=https://bifrost.tg.no pnpm smoke
```

Begge kommandoene skal ende med seks `PASS`, inkludert confidential OIDC-start. Nettleserbygget skal være bygget med `VITE_API_URL=same-origin`.

## 8. Funksjons- og rolleparitet

Test minst én positiv og én negativ bruker per modul i `domain-matrix.md`. Sammenlign V1 og V2 for:

- dashboardtall og globale søketreff;
- utstyr, lager, paller, utlån og returer;
- forespørsler, kjøretøy, kompetanse/KDO og profiler;
- transport, samband, Shop/import/eksport og crewtøy;
- oppgaver, feedback, vedlegg, varsler, admin og statistikk.

For crew-reset skal bare forhåndsvisningen testes. Ikke skriv bekreftelsesfrasen og ikke kall clear-endepunktet i staging-paritetstesten.

Kontroller deretter integrasjonen uten databaseskriving:

```bash
pnpm --filter @bifrost/api inspect:crew -- 8468
```

Verifiser at responsfeltene for navn, e-post, Wannabe-ID, crew og crewrolle mappes riktig. Test så badge-scan i Admin med én godkjent og én ikke-godkjent bruker. Hvis velkomst-e-post er aktivert av en `developer`, skal bare den helt nye brukeren få e-post; ny synkronisering av samme bruker skal ikke sende på nytt.

## 9. Rollback

1. Stopp V2-prosessene med `pm2 stop Bifrost-API Bifrost-Web Bifrost-Worker`.
2. La V1 fortsette mot den autoritative databasen.
3. Dersom stagingtesten skrev funksjonsdata, restore den verifiserte backupen eller forkast stagingdatabasen.
4. V2-tabellene kan bli stående ved applikasjonsrollback; de brukes ikke av V1. Slett dem bare gjennom en separat, godkjent databaseendring.
5. Bevar master key sammen med backupen så lenge krypterte rader skal kunne leses.

Produksjonscutover krever separat godkjenning etter dokumentert paritet, restore-test, Keycloak-verifisering og avtalt observasjonsperiode.
