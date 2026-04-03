<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$roleLabel = static function (string $role): string {
    return match ($role) {
        'bruker' => 'Bruker',
        'chief' => 'Chief',
        'co-chief' => 'Co-Chief',
        'developer' => 'Utvikler',
        'logistikk' => 'Logistikk',
        'shop' => 'Shop',
        'innkjop' => 'Innkjøp',
        'sambandsansvarlig' => 'Sambandsansvarlig',
        'skiftleder' => 'Skiftleder',
        'transport_ansvarlig' => 'Transport Ansvarlig',
        'ingen_tilbakemeldinger' => 'Felles Bruker',
        default => $role,
    };
};

$userStats = $userStats ?? [];
$roleStats = $roleStats ?? [];
$feedbackStats = $feedbackStats ?? [];
$equipmentStats = $equipmentStats ?? [];
$commsStats = $commsStats ?? [];
$vehicleStats = $vehicleStats ?? [];
$requestStats = $requestStats ?? [];
$transportStats = $transportStats ?? [];
$taskStats = $taskStats ?? [];
$shopStats = $shopStats ?? [];
$privateEquipmentStats = $privateEquipmentStats ?? [];
$locationStats = $locationStats ?? [];
$warehouseStats = $warehouseStats ?? [];
?>
<style>
    .stats-hero {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }
    .stats-tile {
        padding: 1rem;
        border: 1px solid #1f2a44;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(15, 23, 42, .88), rgba(11, 19, 36, .88));
    }
    .stats-tile__label {
        margin: 0 0 .45rem;
        color: #94a3b8;
        font-size: .82rem;
        text-transform: uppercase;
        letter-spacing: .06em;
    }
    .stats-tile__value {
        margin: 0;
        color: #f8fafc;
        font-size: 2rem;
        font-weight: 800;
        line-height: 1;
    }
    .stats-tile__meta {
        margin-top: .45rem;
        color: #cbd5e1;
        font-size: .9rem;
    }
    .stats-section-title {
        margin: 0 0 .35rem;
    }
    .stats-section-copy {
        margin: 0 0 1rem;
        color: #94a3b8;
    }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
    }
    .stats-list {
        display: grid;
        gap: .6rem;
    }
    .stats-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: .7rem .85rem;
        border: 1px solid #1f2a44;
        border-radius: 10px;
        background: rgba(15, 23, 42, .45);
    }
    .stats-row span {
        color: #cbd5e1;
    }
    .stats-row strong {
        color: #f8fafc;
    }
    .stats-note {
        margin-top: .85rem;
        color: #94a3b8;
        font-size: .9rem;
    }
    .stats-table td:last-child,
    .stats-table th:last-child {
        text-align: right;
    }
    .stats-table td {
        color: #dbe7ff;
    }
</style>

<h1>Statistikk</h1>
<p class="stats-section-copy">Samlet oversikt over brukere, crew-cache, tilbakemeldinger, utstyr og samband.</p>

<div class="stats-hero">
    <article class="stats-tile">
        <p class="stats-tile__label">Brukere</p>
        <p class="stats-tile__value"><?= esc((string) ($userStats['total'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Aktive: <?= esc((string) ($userStats['active'] ?? 0)) ?> | Inaktive: <?= esc((string) ($userStats['inactive'] ?? 0)) ?></div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Cachede Brukere</p>
        <p class="stats-tile__value"><?= esc((string) ($userStats['cached'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Crew-cache med lagrede profiler</div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Tilbakemeldinger</p>
        <p class="stats-tile__value"><?= esc((string) ($feedbackStats['total'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Innmeldt: <?= esc((string) ($feedbackStats['pending'] ?? 0)) ?> | Ferdige: <?= esc((string) ($feedbackStats['completed_total'] ?? 0)) ?></div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Utstyr</p>
        <p class="stats-tile__value"><?= esc((string) ($equipmentStats['total_quantity'] ?? 0)) ?></p>
        <div class="stats-tile__meta"><?= esc((string) ($equipmentStats['total_items'] ?? 0)) ?> registrerte utstyrslinjer</div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Sambandsett</p>
        <p class="stats-tile__value"><?= esc((string) ($commsStats['total_sets'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Sambandsutstyr totalt: <?= esc((string) ($commsStats['total_quantity'] ?? 0)) ?></div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Kjøretøy</p>
        <p class="stats-tile__value"><?= esc((string) ($vehicleStats['total'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Aktive kjøretøylån: <?= esc((string) ($vehicleStats['active_loans'] ?? 0)) ?></div>
    </article>
    <article class="stats-tile">
        <p class="stats-tile__label">Forespørsler</p>
        <p class="stats-tile__value"><?= esc((string) ($requestStats['total'] ?? 0)) ?></p>
        <div class="stats-tile__meta">Totalt antall registrerte forespørsler</div>
    </article>
</div>

<div class="stats-grid">
    <section class="card">
        <h3 class="stats-section-title">Brukerstatistikk</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt antall brukere</span><strong><?= esc((string) ($userStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Aktive brukere</span><strong><?= esc((string) ($userStats['active'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Inaktive brukere</span><strong><?= esc((string) ($userStats['inactive'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Brukere med Wannabe ID</span><strong><?= esc((string) ($userStats['with_wannabe_id'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Brukere med badge-scan</span><strong><?= esc((string) ($userStats['with_badge_scan'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Cachede crew-profiler</span><strong><?= esc((string) ($userStats['cached'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Tilbakemeldinger</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt</span><strong><?= esc((string) ($feedbackStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Innmeldt</span><strong><?= esc((string) ($feedbackStats['pending'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Godkjent</span><strong><?= esc((string) ($feedbackStats['approved'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>På vent</span><strong><?= esc((string) ($feedbackStats['on_hold'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Påbegynt</span><strong><?= esc((string) ($feedbackStats['in_progress'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Implementert</span><strong><?= esc((string) ($feedbackStats['implemented'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Fikset</span><strong><?= esc((string) ($feedbackStats['fixed'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Avvist</span><strong><?= esc((string) ($feedbackStats['rejected'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Trenger databaseendring</span><strong><?= esc((string) ($feedbackStats['needs_database_fix'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Feature-tilbakemeldinger</span><strong><?= esc((string) ($feedbackStats['feature_total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Bug-tilbakemeldinger</span><strong><?= esc((string) ($feedbackStats['bug_total'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Utstyr</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Registrerte utstyrslinjer</span><strong><?= esc((string) ($equipmentStats['total_items'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Totalt antall enheter</span><strong><?= esc((string) ($equipmentStats['total_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Tilgjengelig mengde</span><strong><?= esc((string) ($equipmentStats['available_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Markert som utlånt</span><strong><?= esc((string) ($equipmentStats['loaned_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>På vedlikehold</span><strong><?= esc((string) ($equipmentStats['maintenance_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Aktive utlån</span><strong><?= esc((string) ($equipmentStats['active_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Utlånt mengde nå</span><strong><?= esc((string) ($equipmentStats['loaned_out_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnerte utlån</span><strong><?= esc((string) ($equipmentStats['returned_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnert mengde</span><strong><?= esc((string) ($equipmentStats['returned_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Utlån totalt</span><strong><?= esc((string) ($equipmentStats['loan_events_total'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Samband</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Registrerte sambandslinjer</span><strong><?= esc((string) ($commsStats['total_items'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Totalt antall sambandsenheter</span><strong><?= esc((string) ($commsStats['total_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Tilgjengelig mengde</span><strong><?= esc((string) ($commsStats['available_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Markert som utlånt</span><strong><?= esc((string) ($commsStats['loaned_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Sambandsett</span><strong><?= esc((string) ($commsStats['total_sets'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Aktive sambandsutlån</span><strong><?= esc((string) ($commsStats['active_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Utlånt mengde nå</span><strong><?= esc((string) ($commsStats['loaned_out_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnerte sambandsutlån</span><strong><?= esc((string) ($commsStats['returned_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnert mengde</span><strong><?= esc((string) ($commsStats['returned_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Sambandsutlån totalt</span><strong><?= esc((string) ($commsStats['loan_events_total'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Kjøretøy</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt antall kjøretøy</span><strong><?= esc((string) ($vehicleStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Tilgjengelige kjøretøy</span><strong><?= esc((string) ($vehicleStats['available'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Markert som utlånt</span><strong><?= esc((string) ($vehicleStats['loaned'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>På vedlikehold</span><strong><?= esc((string) ($vehicleStats['maintenance'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Aktive kjøretøylån</span><strong><?= esc((string) ($vehicleStats['active_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnerte kjøretøylån</span><strong><?= esc((string) ($vehicleStats['returned_loans'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Kjøretøylån totalt</span><strong><?= esc((string) ($vehicleStats['loan_events_total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Transporter med tildelt kjøretøy</span><strong><?= esc((string) ($vehicleStats['assigned_transport_jobs'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Forespørsler</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt antall forespørsler</span><strong><?= esc((string) ($requestStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Innmeldt</span><strong><?= esc((string) ($requestStats['pending'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Delvis godkjent</span><strong><?= esc((string) ($requestStats['partial'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Levert ut</span><strong><?= esc((string) ($requestStats['fulfilled'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Returnert</span><strong><?= esc((string) ($requestStats['returned'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Avvist</span><strong><?= esc((string) ($requestStats['rejected'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Forespurte enheter totalt</span><strong><?= esc((string) ($requestStats['requested_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Forespørselslinjer</span><strong><?= esc((string) ($requestStats['request_lines'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Transport</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt antall transporter</span><strong><?= esc((string) ($transportStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Åpne</span><strong><?= esc((string) ($transportStats['open'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Tildelte</span><strong><?= esc((string) ($transportStats['assigned'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Pågår</span><strong><?= esc((string) ($transportStats['in_progress'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Fullførte</span><strong><?= esc((string) ($transportStats['completed'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Persontransport</span><strong><?= esc((string) ($transportStats['people_transport'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Utstyrstransport</span><strong><?= esc((string) ($transportStats['equipment_transport'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Oppgaver</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Totalt antall oppgaver</span><strong><?= esc((string) ($taskStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Ikke startet</span><strong><?= esc((string) ($taskStats['not_started'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Pågår</span><strong><?= esc((string) ($taskStats['in_progress'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Blokkert</span><strong><?= esc((string) ($taskStats['blocked'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Fullført</span><strong><?= esc((string) ($taskStats['completed'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Koblet til transport</span><strong><?= esc((string) ($taskStats['linked_to_transport'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Shop</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Kategorier</span><strong><?= esc((string) ($shopStats['categories'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Produkter</span><strong><?= esc((string) ($shopStats['items'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Total beholdning</span><strong><?= esc((string) ($shopStats['total_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Check-out hendelser</span><strong><?= esc((string) ($shopStats['checkout_count'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Check-out mengde</span><strong><?= esc((string) ($shopStats['checkout_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Check-in hendelser</span><strong><?= esc((string) ($shopStats['checkin_count'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Check-in mengde</span><strong><?= esc((string) ($shopStats['checkin_quantity'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Bevegelser totalt</span><strong><?= esc((string) ($shopStats['movements_total'] ?? 0)) ?></strong></div>
        </div>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Lokasjoner og Lager</h3>
        <div class="stats-list">
            <div class="stats-row"><span>Lokasjoner totalt</span><strong><?= esc((string) ($locationStats['total'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Lokasjoner med adresse</span><strong><?= esc((string) ($locationStats['with_address'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Paller</span><strong><?= esc((string) ($warehouseStats['pallets'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Palleplasser</span><strong><?= esc((string) ($warehouseStats['slots'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Opptatte palleplasser</span><strong><?= esc((string) ($warehouseStats['occupied_slots'] ?? 0)) ?></strong></div>
            <div class="stats-row"><span>Privat utstyr-regler</span><strong><?= esc((string) ($privateEquipmentStats['prefix_rules'] ?? 0)) ?></strong></div>
        </div>
    </section>
</div>

<div class="grid">
    <section class="card">
        <h3 class="stats-section-title">Roller</h3>
        <p class="stats-section-copy">Antall brukere per rolle.</p>
        <table class="stats-table">
            <tr><th>Rolle</th><th>Antall</th></tr>
            <?php foreach ($roleStats as $role): ?>
                <tr>
                    <td><?= esc($roleLabel((string) ($role['name'] ?? ''))) ?></td>
                    <td><?= esc((string) ($role['total'] ?? 0)) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Utstyr per kategori</h3>
        <p class="stats-section-copy">Sortert etter størst total mengde.</p>
        <table class="stats-table">
            <tr><th>Kategori</th><th>Rader</th><th>Mengde</th></tr>
            <?php foreach (($equipmentStats['categories'] ?? []) as $category): ?>
                <tr>
                    <td><?= esc((string) ($category['name'] ?? 'Ukjent')) ?></td>
                    <td><?= esc((string) ($category['rows'] ?? 0)) ?></td>
                    <td><?= esc((string) ($category['quantity'] ?? 0)) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Samband per type</h3>
        <p class="stats-section-copy">Sortert etter størst total mengde.</p>
        <table class="stats-table">
            <tr><th>Type</th><th>Rader</th><th>Mengde</th></tr>
            <?php foreach (($commsStats['types'] ?? []) as $type): ?>
                <tr>
                    <td><?= esc((string) ($type['name'] ?? 'Ukjent')) ?></td>
                    <td><?= esc((string) ($type['rows'] ?? 0)) ?></td>
                    <td><?= esc((string) ($type['quantity'] ?? 0)) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
        <p class="stats-note">Utstyr og samband viser både antall registrerte linjer og summerte mengder, siden én rad kan representere flere enheter.</p>
    </section>

    <section class="card">
        <h3 class="stats-section-title">Lokasjoner per type</h3>
        <p class="stats-section-copy">Fordeling av registrerte lokasjoner.</p>
        <table class="stats-table">
            <tr><th>Type</th><th>Antall</th></tr>
            <?php foreach (($locationStats['types'] ?? []) as $type): ?>
                <tr>
                    <td><?= esc((string) ($type['name'] ?? 'Ukjent')) ?></td>
                    <td><?= esc((string) ($type['total'] ?? 0)) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </section>
</div>
<?= $this->endSection() ?>
