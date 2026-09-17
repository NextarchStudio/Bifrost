# Cutover-sjekkliste for Bifrost V2

Denne listen er en hard produksjonsport. En tom avkryssing betyr at cutover ikke er godkjent.

## Infrastruktur og domener

- [ ] `tg.legacyh.dev` peker til riktig reverse proxy og viser V2 i avtalt cutover-vindu.
- [ ] `bifrost.tg.no` har gyldig DNS, TLS-kjede og peker til samme V2-installasjon.
- [ ] Produksjonsbygget bruker `VITE_API_URL=same-origin`.
- [ ] Reverse proxy-rutene `/api/`, `/health` og `/ready` går til `127.0.0.1:3103`; øvrige ruter går til `127.0.0.1:3102`.
- [ ] `pnpm smoke` består mot begge HTTPS-domener.

## Database og filer

- [ ] Konsistent backup er tatt, checksum er lagret utenfor serveren og restore er verifisert.
- [ ] Migrering `0001`, `0002`, `0003` og `0004` er kjørt i nummerrekkefølge.
- [ ] `pnpm --filter @bifrost/api migrate:secrets` er kjørt etter backup, og alle konfigurerte V1-hemmeligheter har kryptert V2-kopi.
- [ ] `pnpm --filter @bifrost/api preflight` ender med null feil.
- [ ] `V2/var/secrets/settings.key` og opplastinger inngår i separat, testet backup.
- [ ] V1-tabeller eller V1-hemmelighetskolonner er ikke fjernet.

## Identitet og tilgang

- [ ] Keycloak confidential-klienten har alle tre eksakte redirect URI-er med `/auth/callback` og korrekte Web Origins.
- [ ] Ny/rotert client secret finnes kryptert som `oidc.client_secret`; den ligger ikke i Web, repo, logger eller skjermbilder.
- [ ] Server-side kodeutveksling, PKCE S256, state, nonce, client-id, issuer og token audience er verifisert.
- [ ] SSO-sesjonen bruker `HttpOnly`, `Secure`, `SameSite=Lax`, og mutasjoner uten `X-Bifrost-Request` avvises.
- [ ] Minst én positiv og én negativ test er dokumentert per rolleområde.
- [ ] Lokal reserveinnlogging er eksplisitt besluttet på/av og testet uten å logge passord/token.
- [ ] Crew API-responsen er kontrollert med `inspect:crew -- 8468`, uten at bearer-token eller persondata er lagret i repo/loggutdrag.
- [ ] Aktive Crew-/crewrolle-regler gir forventede V1-roller, og en bruker uten godkjent crew avvises.
- [ ] Velkomst-e-post er eksplisitt besluttet på/av; ved «på» er SMTP, kryptert `smtp.password` når autentisering brukes, Worker-kø og én testmottaker verifisert.

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
