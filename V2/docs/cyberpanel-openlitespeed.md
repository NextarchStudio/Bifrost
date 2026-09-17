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

## Rewrite-regler

Ta kopi av eksisterende vhost-/rewrite-konfigurasjon før cutover. Legg deretter inn følgende regler under **Websites → List Websites → Manage → Rewrite Rules** for både `tg.legacyh.dev` og `bifrost.tg.no`:

```apache
RewriteEngine On
RewriteRule ^api/(.*)$ http://127.0.0.1:3103/api/$1 [P,L]
RewriteRule ^(health|ready)$ http://127.0.0.1:3103/$1 [P,L]
RewriteRule ^(.*)$ http://127.0.0.1:3102/$1 [P,L]
```

Reglene må stå i denne rekkefølgen. API- og helserutene må treffes før fallback-regelen for Web. Utfør en **Graceful Restart** av OpenLiteSpeed etter lagring.

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

