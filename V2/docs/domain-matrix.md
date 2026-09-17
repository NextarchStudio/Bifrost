# Bifrost domenematrise

Sist verifisert mot `V1/app/Config/Routes.php`, relevante V1-controllere og V2-rutene 17. september 2026.

Denne matrisen er migreringsgrunnlaget for funksjons- og tilgangsparitet. «Alle innloggede» betyr at V1-ruten bare bruker `auth`-filteret; interne controller-/serviceregler kan begrense enkelte handlinger ytterligere. V2 skal håndheve tilgang i API-et, uavhengig av hvilke knapper Web viser.

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
| `innkjop` | Shop og transport | Ja |
| `bruker` | Standardrolle for innlogget bruker | Ja |
| `ingen_tilbakemeldinger` | Negativ rettighet som skjuler/blokkerer feedback-funksjoner og enkelte profilbilder | Ja |

Brukere kan ha flere roller. `ingen_tilbakemeldinger` skal behandles som en eksplisitt blokkering, ikke som en rolle som gir tilgang.

## V1-funksjoner og migreringsstatus

| Domene | V1-tilgang på rutenivå | Viktige V1-regler | V2-status |
|---|---|---|---|
| OIDC og profil | Alle innloggede; utvidet innsyn følger V1-rollene | Keycloak/OIDC, egen profil, autorisert innsyn i andres lån/forespørsler og blokkering av profilbilde for sperrede roller; lokal V1-passordflyt erstattes av obligatorisk Keycloak | OIDC, tokenvalidering, brukerprovisjonering, profilside, aktive utstyrs-/kjøretøy-/sambandlån, forespørsler og sikker bildeproxy levert |
| Dashboard | Alle innloggede | Operativ oversikt og varsler | Ikke startet |
| Globalt søk | `developer`, `chief`, `co-chief`, `logistikk` | Søk på tvers av utstyr, serienummer, lokasjon, palle, plass og Wannabe-ID | Ikke startet |
| Utstyr | `developer`, `chief`, `co-chief`, `logistikk` | Opprett/merge på serienummer, rediger, antall, status, flytt og slettingsvern | API og Web levert |
| Utstyrskategorier | `developer`, `chief`, `co-chief`, `logistikk` | Kategori i bruk kan ikke slettes | API og Web levert |
| Lokasjoner | `developer`, `chief`, `co-chief`, `logistikk` | Paller og aktive transportoppdrag blokkerer sletting; historikk arkiveres | API og Web levert |
| Lager, paller og palleplasser | `developer`, `chief`, `co-chief`, `logistikk` | Ingen paller på Transport-lokasjon, unik QR i tjenestelaget, slot 1 for strekkodeflyt, utstyr blokkerer sletting | API og Web levert |
| Strekkodeeksport | `developer`, `chief`, `co-chief`, `logistikk` | Generering/eksport av strekkoder | Ikke startet |
| Privat utstyr | `developer`, `chief`, `co-chief`, `logistikk` | Opprett/slett, prefikstreff, utlånsbekreftelse og returpåminnelse | API og Web levert; bekreftelsen håndheves også i API-et |
| Utstyrslån og retur | `developer`, `chief`, `co-chief`, `logistikk` | Profiloppslag, antall, lagerkonsistens, utstedelse og retur | Transaksjonelt API og Web for utstedelse/delretur/full retur, person-/badge-oppslag og privat-utstyrsvarsler levert |
| Kjøretøy og kjøretøylån | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk` | Oppretting og lån for alle fem roller; redigering/sletting bare uten `logistikk`; kompetansebevis/førerkort per Wannabe-ID, KDO per kjøretøy, odometer og Vegvesen-nyttelast | API og Web levert; utlån/retur og kompetanseoppdatering er transaksjonell, Vegvesen-nøkkelen leses kryptert |
| Utstyrsforespørsler | Alle innloggede; status/godkjenning: `developer`, `chief`, `co-chief`, `logistikk` | Vanlige brukere kan opprette; ledelse/logistikk og `sambandsansvarlig` blokkeres fra vanlig opprettingsflyt; delvis godkjenning, lagerreservasjon, koblede lån og statusmaskin | API og Web levert; godkjenning/lager/lån kjøres atomisk |
| Samband | `developer`, `chief`, `co-chief`, `logistikk`, `sambandsansvarlig` | Enheter, sett, profiloppslag, utlån og retur | Ikke startet |
| Transport | `developer`, `chief`, `co-chief`, `logistikk`, `innkjop` | Ledelse/logistikk administrerer oppdrag; `innkjop` rekvirerer persontransport og ser egne turer. Utstyrs-, innkjøps- og henterunder har stopp/ruteestimat, kjøretøyreservasjon, kompetansestyrt tildeling, kilometerteller, inspeksjon og historikk | API og Web levert; statusoverganger og kjøretøyoppdatering er transaksjonelle, staging-paritet gjenstår |
| Shop og crew clothing | `developer`, `chief`, `co-chief`, `logistikk`, `shop`; `innkjop` vises også i V1-navigasjonen | Varer/kategorier, checkout/checkin, clothing-utlevering, Excel/PDF import/eksport | Ikke startet |
| Oppgaver | Alle innloggede | Opprett og statusoppdatering med interne eier-/tilgangsregler | Ikke startet |
| Feedback og varsler | Alle innloggede; status: `developer` | `ingen_tilbakemeldinger` blokkerer feedback/varsler; vedlegg og sletting har egne regler | Ikke startet |
| Admin og statistikk | `developer`, `chief`, `co-chief`; systeminnstillinger/cache: `developer` | Brukere, roller, aktiv-status, kompetanser, systeminnstillinger, crew-cache og statistikk | Ikke startet |

## Implementert V2-tilgang

| API-område | Tillatte roller | Skriveoperasjoner med audit | Positive/negative rutetester |
|---|---|---|---|
| `/api/v1/me` | Alle med gyldig Keycloak-token | Ikke relevant | Ja |
| `/api/v1/equipment*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/equipment-categories*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/locations*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/pallets*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/loans*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/equipment-requests*` | Alle innloggede for egne forespørsler; behandling: `developer`, `chief`, `co-chief`, `logistikk` | Ja | Ja |
| `/api/v1/crew/lookup` | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk` | Cacheoppdatering ved eksternt treff; `skiftleder` trenger oppslaget i kjøretøylån | Ja |
| `/api/v1/private-equipment*` | `developer`, `chief`, `co-chief`, `logistikk` | Ja | Delvis |
| `/api/v1/vehicles*`, `/api/v1/vehicle-loans*` | `developer`, `chief`, `co-chief`, `skiftleder`, `logistikk`; endring/sletting uten `logistikk`; kompetanseadmin uten `skiftleder` og `logistikk` | Ja | Ja |
| `/api/v1/profiles*` | Egen profil: alle innloggede; andres lån: `developer`, `chief`, `co-chief`, `skiftleder`, `sambandsansvarlig`, `logistikk`; andres forespørsler uten `logistikk` | Kun lesing | Ja |
| `/api/v1/transport*` | Administrasjon: `developer`, `chief`, `co-chief`, `logistikk`; persontransport og egne turer: `innkjop` | Ja; opprettelse/reservasjon, tildeling, start og fullføring har audit og transaksjoner | Ja |

API-et bruker én felles Bearer-token- og rollekontroll. Manglende token gir `401`, manglende rolle gir `403`, og manglende OIDC-konfigurasjon beholdes som `503` med kode `OIDC_NOT_CONFIGURED`.

## Åpne verifikasjonspunkter

1. Bekreft om `transport_ansvarlig` faktisk skal ha tilgang til transport. Rollen finnes, men V1-rutene gir den ikke tilgang.
2. Bekreft om `innkjop` skal ha full shop-tilgang eller bare navigasjons-/transporttilgang; V1-rutefilter og navigasjon er ikke helt like.
3. Kartlegg controller- og servicenivåregler per handling før samband, shop og øvrige gjenstående moduler implementeres.
4. Test matrisen mot representative brukere med kombinasjoner av flere roller.
5. Ikke fjern eller gi nytt navn til eksisterende roller før V1/V2-paritet er godkjent.
