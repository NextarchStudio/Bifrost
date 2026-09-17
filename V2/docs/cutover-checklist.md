# Cutover-sjekkliste for Bifrost V2

Denne listen er en hard produksjonsport. En tom avkryssing betyr at cutover ikke er godkjent.

## Infrastruktur og domener

- [ ] `tg.legacyh.dev` peker til riktig reverse proxy og viser V2 i avtalt cutover-vindu.
- [ ] `bifrost.tg.no` har gyldig DNS, TLS-kjede og peker til samme V2-installasjon.
- [ ] Produksjonsbygget bruker `VITE_API_URL=same-origin`.
- [ ] Nginx-rutene `/api/`, `/health` og `/ready` går til `127.0.0.1:3001`; øvrige ruter går til `127.0.0.1:3000`.
- [ ] `pnpm smoke` består mot begge HTTPS-domener.

## Database og filer

- [ ] Konsistent backup er tatt, checksum er lagret utenfor serveren og restore er verifisert.
- [ ] Migrering `0001`, `0002` og `0003` er kjørt i nummerrekkefølge.
- [ ] `pnpm --filter @bifrost/api migrate:secrets` er kjørt etter backup, og alle konfigurerte V1-hemmeligheter har kryptert V2-kopi.
- [ ] `pnpm --filter @bifrost/api preflight` ender med null feil.
- [ ] `V2/var/secrets/settings.key` og opplastinger inngår i separat, testet backup.
- [ ] V1-tabeller eller V1-hemmelighetskolonner er ikke fjernet.

## Identitet og tilgang

- [ ] Keycloak har alle tre Web Origins og redirect URI-er med `/auth/callback`.
- [ ] PKCE S256, client-id, issuer og token audience er verifisert.
- [ ] Minst én positiv og én negativ test er dokumentert per rolleområde.
- [ ] Lokal reserveinnlogging er eksplisitt besluttet på/av og testet uten å logge passord/token.

## Funksjonsparitet

- [ ] Dashboardtall og globale søketreff er sammenlignet med V1.
- [ ] Utstyr → palle → flytt → inspeksjon og utlån → retur er godkjent.
- [ ] Lokasjon, kjøretøy, samband, oppgave, forespørsel og feedback kan endres/slettes innenfor V1-reglene.
- [ ] Transport, Shop-import/eksport og crewtøy er verifisert med representative anonymiserte data.
- [ ] Crew-reset er bare forhåndsvist; destruktiv kjøring er ikke brukt som paritetstest.

## Drift og rollback

- [ ] `Bifrost-API`, `Bifrost-Web` og `Bifrost-Worker` er `online` i PM2 og starter etter reboot.
- [ ] Loggrotasjon, diskplass, databasebackup og readiness-varsling er aktivt overvåket.
- [ ] Ansvarlig operatør, cutover-tidspunkt, observasjonsperiode og rollback-beslutning er registrert.
- [ ] Rollback til V1 er prøvd eller simulert, og krever ikke reversering av V1-data.
