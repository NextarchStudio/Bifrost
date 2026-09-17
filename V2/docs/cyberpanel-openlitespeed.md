# CyberPanel og OpenLiteSpeed

Bifrost kjøres av PM2 bak eksisterende CyberPanel-vhost. Produksjonsprofilen binder bare mot localhost:

- Bifrost-Web: `127.0.0.1:3102`
- Bifrost-API: `127.0.0.1:3103`
- Bifrost-Worker: ingen HTTP-port

## Før oppstart

Kontroller at portene fortsatt er ledige rett før PM2 startes:

```bash
ss -H -ltnp 'sport = :3102 or sport = :3103'
```

Kommandoen skal ikke gi noen linjer før Bifrost startes.

## Vhost-proxy

Ta kopi av eksisterende vhost-konfigurasjon før cutover. Legg følgende blokker på toppnivå i vhost-konfigurasjonen for både `tg.legacyh.dev` og `bifrost.tg.no`. De skal ikke plasseres inne i den eksisterende `rewrite`-blokken:

```text
extprocessor bifrost_web {
  type                    proxy
  address                 127.0.0.1:3102
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

extprocessor bifrost_api {
  type                    proxy
  address                 127.0.0.1:3103
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context /api/ {
  type                    proxy
  handler                 bifrost_api
  addDefaultCharset       off
}

context /health {
  type                    proxy
  handler                 bifrost_api
  addDefaultCharset       off
}

context /ready {
  type                    proxy
  handler                 bifrost_api
  addDefaultCharset       off
}

context / {
  type                    proxy
  handler                 bifrost_web
  addDefaultCharset       off
}
```

Den eksisterende ACME-konteksten beholdes urørt. OpenLiteSpeed velger den mest spesifikke konteksten, slik at `/api/`, `/health`, `/ready` og `/.well-known/acme-challenge` ikke havner i Web-fallbacken. Utfør en **Graceful Restart** etter lagring og kontroller konfigurasjonsloggen før cutover.

`Bifrost-Worker` har ingen HTTP-port og skal derfor ikke ha `extprocessor` eller `context`. `http://127.0.0.1:3000` er utviklingsmiljøet og skal ikke registreres som en offentlig CyberPanel-vhost.

## Kontroll

Kontroller først PM2-backendene direkte:

```bash
curl -fsS http://127.0.0.1:3102/ >/dev/null
curl -fsS http://127.0.0.1:3103/health
curl -fsS http://127.0.0.1:3103/ready
```

Kontroller deretter vhosten:

```bash
curl -fsS https://tg.legacyh.dev/ >/dev/null
curl -fsS https://tg.legacyh.dev/health
curl -fsS https://tg.legacyh.dev/ready
```

Gjenta kontrollen for `https://bifrost.tg.no` etter at DNS og TLS er aktivt.

## Cloudflare

Begge produksjonsdomenene kan stå med proxystatus **Proxied** (oransje sky). Bruk SSL/TLS-modus **Full (strict)**, slik at Cloudflare validerer sertifikatet i CyberPanel/OpenLiteSpeed og aldri sender trafikk ukryptert til origin.

Cloudflare skal respektere cache-headerne fra Bifrost-Web:

- HTML og klientruter returneres med `Cache-Control: no-cache`.
- Hash-versjonerte filer under `/assets/` returneres med `Cache-Control: public, max-age=31536000, immutable`.
- API-et returnerer `Cache-Control: no-store` for `/api/*`, `/health` og `/ready`. Legg i tillegg inn en Cache Rule med **Bypass cache** for disse rutene dersom sonen har andre regler som kan overstyre origin-headerne.
- Ikke aktiver «Cache Everything» for hele domenet.

Cloudflare beholder original `Host`, og Bifrost-Web bruker samme origin som nettleseren. Derfor kreves det ikke et eget Web-bygg eller en hardkodet API-adresse per domene. Begge HTTPS-originene må fortsatt være aktive i `bifrost_web_origins`.

Origin bør begrense offentlig HTTP/HTTPS-trafikk til Cloudflares publiserte IP-nett. Hvis origin også kan nås direkte, må klient-IP-headere fra Cloudflare ikke brukes som et sikkerhetsanker før denne begrensningen er på plass.
