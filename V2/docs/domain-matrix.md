# Bifrost domenematrise

Sist verifisert mot `V1/app/Config/Routes.php`, relevante V1-controllere og V2-rutene 17. september 2026.

Denne matrisen er migreringsgrunnlaget for funksjons- og tilgangsparitet. «Alle innloggede» betyr at V1-ruten bare bruker `auth`-filteret; interne controller-/serviceregler kan begrense enkelte handlinger ytterligere. V2 håndhever tilgang i API-et, uavhengig av hvilke knapper Web viser. Rollegruppene ligger sentralt i `packages/contracts`, brukes av både API og Web, og testes uttømmende mot alle 11 autoritative V1-roller i CI.

## Autoritative roller

| Rollenavn | V1-betydning / observert bruk | Beholdes i V2 |
|---|---|---|
| `developer` | Full teknisk/admin-tilgang og eneste rolle for enkelte sensitive innstillinger og feedback-status | Ja |
| `chief` | Ledelse/admin og operativ tilgang | Ja |
| `co-chief` | Ledelse/admin og operativ tilgang | Ja |
| `transport_ansvarlig` | Seedet og vist i admin/statistikk, men ikke brukt i V1-rutefilteret for transport | Ja, avvik må avklares før staging/cutover |
| `skiftleder` | Kjøretøy, lån og utvidet profilinnsyn | Ja |
| `sambandsansvarlig` | Samband og enkelte interne forespørsels-/transportregler | Ja |
| `logistikk` | Utstyr, lager, lån og flere operative områder | Ja |
| `shop` | Shop og crew clothing | Ja |
| `innkjop` | Innkjøp og transport; har ikke tilgang til V1-Shop-rutene | Ja |
| `bruker` | Standardrolle for innlogget bruker | Ja |
| `ingen_tilbakemeldinger` | Negativ rettighet som skjuler/blokkerer feedback-funksjoner og enkelte profilbilder | Ja |

Brukere kan ha flere roller. `ingen_tilbakemeldinger` skal behandles som en eksplisitt blokkering, ikke som en rolle som gir tilgang.

## V1-funksjoner og migreringsstatus

| Domene | V1-tilgang på rutenivå | Viktige V1-regler | V2-status |
|---|---|---|---|
| Innlogging og profil | Alle innloggede; utvidet innsyn følger V1-rollene | Obligatorisk Keycloak/OIDC som hovedmetode, databasekontrollert lokal V1-innlogging som reserve, egen profil, autorisert innsyn i andres lån/forespørsler og blokkering av profilbilde for sperrede roller | OIDC, lokal Argon2id-innlogging, hash-lagrede V2-sesjoner, audit/ratebegrensning, brukerprovisjonering, profilside, aktive lån/forespørsler og sikker bildeproxy levert |
| Dashboard | Alle innloggede | Operativ oversikt og varsler | API og Web levert med V1-felter og tilgangstester; staging-paritet gjenstår |
| Globalt søk | `developer`, `chief`, `co-chief`, `logistikk` | Søk på tvers av utstyr, serienummer, lokasjon, palle, plass og Wannabe-ID | API og Web levert med søkeresultatgrense, escaping og tilgangstester; staging-paritet gjenstår |
| Utstyr | `developer`, `chief`, `co-chief`, `logistikk` | Opprett/merge på serienummer, rediger, antall, status, flytt og slettingsvern | API og Web levert |
| Utstyrskategorier | `developer`, `chief`, `co-chief`, `logistikk` | Kategori i bruk kan ikke slettes | API og Web levert |
| Lokasjoner | `developer`, `chief`, `co-chief`, `logistikk` | Paller og aktive transportoppdrag blokkerer sletting; historikk arkiveres | API og Web levert |
| Lager, paller og palleplasser | `developer`, `chief`, `co-chief`, `logistikk` | Ingen paller på Transport-lokasjon, unik QR i tjenestelaget, slot 1 for strekkodeflyt, utstyr blokkerer sletting | API og Web levert |
| Strekkodeeksport | `developer`, `chief`, `co-chief`, `logistikk` | Generering av enkeltkoder og nullutfylte intervaller som V1-kompatibel UDL-fil | API og Web levert med format-, grense- og tilgangstester |
| Privat utstyr | `developer`, `chief`, `co-chief`, `logistikk` | Opprett/slett, prefikstreff, utlånsbekreftelse og returpåminnelse | API og Web levert; bekreftelsen håndheves også i API-et |
| Utstyrslån og retur | `developer`, `chief`, `co-chief`, `logistikk` | Profiloppslag, antall, lagerkonsistens, utstedelse og retur | Transaksjonelt API og Web for utstedelse/delretur/full retur, person-/badge-oppslag og privat-utstyrsvarsler levert |
| Kjøretøy og kjøretøylån | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk` | Oppretting og lån for alle fem roller; redigering/sletting bare uten `logistikk`; kompetansebevis/førerkort per Wannabe-ID, KDO per kjøretøy, odometer og Vegvesen-nyttelast | API og Web levert; utlån/retur og kompetanseoppdatering er transaksjonell, Vegvesen-nøkkelen leses kryptert |
| Utstyrsforespørsler | Alle innloggede; status/godkjenning: `developer`, `chief`, `co-chief`, `logistikk` | Vanlige brukere kan opprette; ledelse/logistikk og `sambandsansvarlig` blokkeres fra vanlig opprettingsflyt; delvis godkjenning, lagerreservasjon, koblede lån og statusmaskin | API og Web levert; godkjenning/lager/lån kjøres atomisk |
| Samband | `developer`, `chief`, `co-chief`, `logistikk`, `sambandsansvarlig` | Enheter og tilbehør, sett, badge-/profiloppslag, enkelt- og settutlån, delretur og bytte | API og Web levert; lagerendring, lånelinjer, retur og bytte kjøres atomisk |
| Transport | `developer`, `chief`, `co-chief`, `logistikk`, `innkjop` | Ledelse/logistikk administrerer oppdrag; `innkjop` rekvirerer persontransport og ser egne turer. Utstyrs-, innkjøps- og henterunder har stopp/ruteestimat, kjøretøyreservasjon, kompetansestyrt tildeling, kilometerteller, inspeksjon og historikk | API og Web levert; statusoverganger og kjøretøyoppdatering er transaksjonelle, staging-paritet gjenstår |
| Shop og crew clothing | `developer`, `chief`, `co-chief`, `logistikk`, `shop`; crewadministrasjon bare `developer`, `chief`, `co-chief` | Varer/kategorier, checkout/checkin, sletting av varehistorikk, ettårsopprydding, XLSX/XLS/CSV-import, CSV/PDF-eksport, crewtøylager, badge-/Wannabe-oppslag, størrelser og utleveringsstatus | API og Web levert; lager/import er transaksjonelt, 10 MB filgrense og autorisert eksport er håndhevet; staging-paritet gjenstår |
| Oppgaver | Alle innloggede; oppretting/full oversikt: `developer`, `chief`, `co-chief`, `logistikk` | Alle ser og oppdaterer egne oppgaver; lederrollene oppretter, tildeler, ser alt og kan koble til aktive transportoppdrag | API og Web levert; oppretting/status har audit og transaksjon, staging-paritet gjenstår |
| Feedback og varsler | Feedback: alle innloggede uten `ingen_tilbakemeldinger`; samlet innsyn: `developer`, `logistikk`; status: `developer`; varsler: alle innloggede | Egen ventende innmelding kan slettes; bildevedlegg bare på bugs, maks 5 MB, og kan åpnes av eier/`developer`/`logistikk`; V1s tre nyeste globale `fixed`/`added`-varsler beholdes | API og Web levert med lokal V1/V2-filstøtte, audit og tilgangstester; staging-paritet gjenstår |
| Admin og statistikk | `developer`, `chief`, `co-chief`; systeminnstillinger, e-postbryter og destruktiv crew-reset: `developer` | Brukere, badge-provisjonering fra Crew API, crew-/crewrolle-regler til eksisterende V1-roller, valgfri Worker-basert velkomst-e-post, aktiv-status, kompetanser, krypterte systeminnstillinger, alle V1-statistikkgrupper og V1s crew-/brukerreset er levert | API/Web levert med audit og tilgangstester; Crew-match er eksakt og legger til roller uten å fjerne manuelle roller; reset krever forhåndsvisning, eksakt frase og bevart bruker-ID 2; staging-paritet gjenstår |

## Implementert V2-tilgang

| API-område | Tillatte roller | Skriveoperasjoner med audit | Positive/negative rutetester |
|---|---|---|---|
| `/api/v1/auth/oidc/start`, `/api/v1/auth/oidc/callback` | Offentlig start/callback med aktivt, godkjent Web-origin; confidential secret brukes kun server-side | PKCE/state/nonce, tokenvalidering, audit og hash-lagret `HttpOnly` Bifrost-sesjon | Ja |
| `/api/v1/auth/local`, `/api/v1/auth/logout` | Lokal innlogging når DB-bryteren er aktiv; Keycloak forblir obligatorisk | Innloggingsforsøk, audit og hash-lagret/revokert sesjon | Ja |
| `/api/v1/me` | Alle med gyldig bearer-token eller Bifrost-sesjonscookie | Ikke relevant | Ja |
| `/api/v1/equipment*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/equipment-categories*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/locations*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/pallets*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/loans*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/equipment-requests*` | Alle innloggede for egne forespørsler; behandling: `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/crew/lookup` | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk`, `sambandsansvarlig` | Cacheoppdatering ved eksternt treff; `skiftleder` trenger oppslaget i kjøretøylån og `sambandsansvarlig` i sambandsutlån | Ja |
| `/api/v1/private-equipment*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/vehicles*`, `/api/v1/vehicle-loans*` | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk`; endring/sletting uten `logistikk`; kompetanseadmin uten `skiftleder` og `logistikk` | Ja | Ja |
| `/api/v1/profiles*` | Egen profil: alle innloggede; andres lån: `developer`, `chief`, `co-chief`, `skiftleder`, `sambandsansvarlig`, `logistikk`; andres forespørsler uten `logistikk` | Kun lesing | Ja |
| `/api/v1/transport*` | Administrasjon: `developer`, `chief`, `co-chief`, `logistikk`; persontransport og egne turer: `innkjop` | Ja; opprettelse/reservasjon, tildeling, start og fullføring har audit og transaksjoner | Ja |
| `/api/v1/comms*` | `developer`, `chief`, `co-chief`, `logistikk`, `sambandsansvarlig` | Ja; sett, lagerreduksjon, utlån, delretur og bytte har audit og transaksjoner | Ja |
| `/api/v1/shop*`, `/api/v1/crew-clothing*` | Operativt: `developer`, `chief`, `co-chief`, `logistikk`, `shop`; crewadministrasjon: `developer`, `chief`, `co-chief` | Ja; varebevegelser, import, historikksletting, crew, medlem, utlevering og crewtøylager har audit/transaksjoner i tråd med V1 | Ja |
| `/api/v1/tasks*` | Egen liste/status: alle innloggede; oppretting/full oversikt: `developer`, `chief`, `co-chief`, `logistikk` | Ja; oppretting og statusendring har audit og transaksjoner | Ja |
| `/api/v1/feedback*` | Innmelding/eget innsyn: alle uten `ingen_tilbakemeldinger`; alt innsyn/vedlegg: `developer`, `logistikk`; status: `developer`; varsler: alle innloggede | Ja; oppretting, status og sletting har audit; vedlegg har type-, størrelses- og tilgangskontroll | Ja |
| `/api/v1/admin*` | Bruker-/rolle-/Crew-regeladmin og statistikk: `developer`, `chief`, `co-chief`; systeminnstillinger, e-postbryter og crew-reset: `developer` | Ja; badge-provisjonering, Crew-regler, bruker, rolle, aktiv-status, kompetanser, innstillinger og reset har audit; e-post sendes via kø uten hemmeligheter i payload; statistikk/preview er lesebasert; hemmeligheter krypteres og eksponeres ikke | Ja |
| `/api/v1/dashboard` | Alle innloggede | Lesebasert V1-oppsummering | Ja |
| `/api/v1/search` | `developer`, `chief`, `co-chief`, `logistikk` | Lesebasert; input begrenses og LIKE-jokertegn escapes | Ja |
| `/api/v1/barcodes/export` | `developer`, `chief`, `co-chief`, `logistikk` | Genererer fil i minnet; ingen databaseskriving | Ja |

API-et bruker én felles bearer/cookie- og rollekontroll for lokale og SSO-utstedte, hash-lagrede Bifrost-sesjoner. Keycloak-token brukes bare inne i API-et under confidential callback og eksponeres ikke til Web. Cookie-baserte mutasjoner krever CSRF-header. Manglende token gir `401`, manglende rolle gir `403`, og manglende OIDC-konfigurasjon beholdes som `503` med kode `OIDC_NOT_CONFIGURED`. Policytesten evaluerer hver av de 11 V1-rollene mot alle tilgangsområder og låser de negative reglene; rutetestene verifiserer i tillegg autentisering og kritiske positive/negative API-flyter.

## Åpne verifikasjonspunkter

1. Bekreft om `transport_ansvarlig` faktisk skal ha tilgang til transport. Rollen finnes, men V1-rutene gir den ikke tilgang.
2. V1-rutefilteret gir ikke `innkjop` Shop-tilgang; V2 følger rutenivået. Bekreft dette med representative stagingbrukere før cutover.
3. Bekreft at V1s crewtøyutlevering fortsatt bare skal registrere status og ikke automatisk trekke fra `crew_clothing_inventory`.
4. Test matrisen mot representative brukere med kombinasjoner av flere roller.
5. Ikke fjern eller gi nytt navn til eksisterende roller før V1/V2-paritet er godkjent.
