<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$jobKindLabels = [
    'equipment' => 'Utstyrstransport',
    'innkjopsrunde' => 'Innkjøpsrunde',
    'henterunde' => 'Henterunde',
    'people' => 'Persontransport',
];
 $stopLocationOptions = [];
 foreach (($allLocations ?? []) as $location) {
     $address = trim((string) ($location->address ?? ''));
     if ($address === '') {
         continue;
     }

     $stopLocationOptions[] = [
         'name' => (string) ($location->name ?? ''),
         'type' => (string) ($location->type ?? ''),
         'address' => $address,
     ];
 }
?>
<h1>Transport</h1>
<?php if (! ($canManageTransport ?? false) && ($isLogistics ?? false)): ?>
<div class="card">
    <p style="margin:0;">Logistikk kan se innkommende oppdrag, og starte/fullføre når oppdraget er tildelt deg.</p>
</div>
<?php endif; ?>
<?php if ($canRequestTransport ?? false): ?>
<div class="card">
    <h3>Rekvirer persontransport</h3>
    <form method="post" action="/transport/request-people" class="location-pair-form">
        <?= csrf_field() ?>
        <input type="number" min="1" name="people_count" placeholder="Antall personer" required>
        <input type="datetime-local" name="pickup_at" required>
        <select name="from_location_id" data-role="from-location" required>
            <option value="">Fra lokasjon</option>
            <?php foreach ($transportLocations as $location): ?>
                <option value="<?= esc((string) $location->id) ?>"><?= esc((string) $location->name) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="to_location_id" data-role="to-location" required>
            <option value="">Til lokasjon</option>
            <?php foreach ($transportLocations as $location): ?>
                <option value="<?= esc((string) $location->id) ?>"><?= esc((string) $location->name) ?></option>
            <?php endforeach; ?>
        </select>
        <textarea name="description" placeholder="Kommentar (valgfritt)"></textarea>
        <button type="submit">Send forespørsel</button>
    </form>
</div>
<?php endif; ?>

<?php if ($canCreateTransportJobs ?? false): ?>
<div class="card">
    <h3>Opprett transportoppdrag (logistikk)</h3>
    <form method="post" action="/transport/create" class="location-pair-form" data-role="transport-create-form">
        <?= csrf_field() ?>
        <select name="job_kind" data-role="job-kind" required>
            <option value="">Velg type oppdrag</option>
            <option value="equipment">Utstyrstransport</option>
            <option value="innkjopsrunde">Innkjøpsrunde</option>
            <option value="henterunde">Henterunde</option>
        </select>
        <select name="vehicle_id" required>
            <option value="">Velg kjøretøy</option>
            <?php foreach ($vehicles as $vehicle): ?>
                <option value="<?= esc((string) $vehicle->id) ?>">
                    <?= esc((string) $vehicle->name) ?> (<?= esc((string) $vehicle->registration_number) ?>)<?= (string) ($vehicle->status ?? '') === 'loaned' ? ' - utlånt' : '' ?>
                </option>
            <?php endforeach; ?>
        </select>
        <select name="requester_user_id" data-role="requester-user">
            <option value="">Velg registrert bruker (valgfritt)</option>
            <?php foreach ($users as $user): ?>
                <option value="<?= esc((string) $user->id) ?>" data-wannabe-id="<?= esc((string) ($user->wannabe_id ?? '')) ?>">
                    <?= esc((string) $user->name) ?><?= ! empty($user->wannabe_id) ? ' (Wannabe ' . esc((string) $user->wannabe_id) . ')' : '' ?>
                </option>
            <?php endforeach; ?>
        </select>
        <input type="number" min="1" name="requester_wannabe_id" data-role="requester-wannabe" placeholder="Eller skriv inn valgfri wannabe id">

        <div data-kind-visible="equipment,innkjopsrunde,henterunde">
            <select name="from_location_id" data-role="from-location" required>
                <option value="">Start / fra lokasjon</option>
                <?php foreach ($allLocations as $location): ?>
                    <option value="<?= esc((string) $location->id) ?>" data-location-type="<?= esc(mb_strtolower((string) ($location->type ?? ''))) ?>">
                        <?= esc((string) $location->name) ?> (<?= esc((string) $location->type) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div data-kind-visible="equipment,innkjopsrunde,henterunde">
            <select name="to_location_id" data-role="to-location" required>
                <option value="">Slutt / til lokasjon</option>
                <?php foreach ($allLocations as $location): ?>
                    <option value="<?= esc((string) $location->id) ?>" data-location-type="<?= esc(mb_strtolower((string) ($location->type ?? ''))) ?>">
                        <?= esc((string) $location->name) ?> (<?= esc((string) $location->type) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="card" style="margin:0;" data-kind-visible="innkjopsrunde,henterunde" hidden>
            <h3 style="margin-top:0;">Stopp</h3>
            <div data-role="stops-container">
                <div class="transport-stop" data-stop-item>
                    <select name="stops[0][location_hint]" data-role="stop-location-select">
                        <option value="">Velg lokasjon med adresse (valgfritt)</option>
                        <?php foreach ($stopLocationOptions as $locationOption): ?>
                            <option value="<?= esc($locationOption['address']) ?>" data-address="<?= esc($locationOption['address']) ?>">
                                <?= esc($locationOption['name']) ?><?= $locationOption['type'] !== '' ? ' (' . esc($locationOption['type']) . ')' : '' ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <input type="text" name="stops[0][address]" placeholder="Stopp 1: Adresse">
                    <textarea name="stops[0][notes]" placeholder="Notat for stopp 1"></textarea>
                </div>
            </div>
            <button type="button" class="btn btn-secondary" data-role="add-stop">Legg til stopp</button>
        </div>

        <textarea name="description" placeholder="Beskrivelse av oppdraget" required></textarea>
        <button type="submit">Opprett oppdrag</button>
    </form>
</div>
<?php endif; ?>

<div class="card">
    <h3><?= $isLogistics ? 'Aktive oppdrag (logistikk)' : 'Mine transportforespørsler' ?></h3>
    <table>
        <tr><th>ID</th><th>Type</th><th>For</th><th>Fra</th><th>Til</th><th>Stopp</th><th>Hentetid</th><th>Antall personer</th><th>Kjøretøy</th><th>Km</th><th>Status</th><?php if ($isLogistics): ?><th>Handling</th><?php endif; ?></tr>
        <?php foreach ($jobs as $job): ?>
            <?php
            $jobKind = (string) ($job->job_kind ?? ($job->transport_type ?? 'equipment'));
            $jobLabel = $jobKindLabels[$jobKind] ?? ucfirst($jobKind);
            $requesterLabel = '-';
            if (! empty($job->requester_name)) {
                $requesterLabel = (string) $job->requester_name;
                if (! empty($job->requester_wannabe_id)) {
                    $requesterLabel .= ' (Wannabe ' . (string) $job->requester_wannabe_id . ')';
                }
            } elseif (! empty($job->requester_wannabe_id)) {
                $requesterLabel = 'Wannabe ' . (string) $job->requester_wannabe_id;
            }
            ?>
            <tr>
                <td><?= esc((string) $job->id) ?></td>
                <td><?= esc($jobLabel) ?></td>
                <td><?= esc($requesterLabel) ?></td>
                <td><?= esc((string) $job->from_name) ?></td>
                <td><?= esc((string) $job->to_name) ?></td>
                <td><?= esc((string) ($job->stops_summary !== '' ? $job->stops_summary : '-')) ?></td>
                <td><?= esc((string) ($job->pickup_at ?? '-')) ?></td>
                <td><?= esc((string) ($job->people_count ?? '-')) ?></td>
                <td>
                    <?php if (! empty($job->vehicle_name)): ?>
                        <?= esc((string) $job->vehicle_name) ?> (<?= esc((string) ($job->vehicle_registration_number ?? '-')) ?>)
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ((int) ($job->vehicle_odometer_exempt ?? 0) === 1): ?>
                        Unntatt
                    <?php elseif ($job->distance_km !== null && $job->estimated_distance_km !== null): ?>
                        <?= esc((string) $job->distance_km) ?> / <?= esc((string) $job->estimated_distance_km) ?> km
                        <?php if ($job->distance_deviation_km !== null && (int) $job->distance_deviation_km > 0): ?>
                            <div style="color:#ff6b6b;font-weight:700;">+<?= esc((string) $job->distance_deviation_km) ?> km avvik</div>
                        <?php elseif ($job->distance_deviation_km !== null): ?>
                            <div style="color:#7bd88f;"><?= esc((string) $job->distance_deviation_km) ?> km avvik</div>
                        <?php endif; ?>
                    <?php elseif ($job->estimated_distance_km !== null): ?>
                        Estimat: <?= esc((string) $job->estimated_distance_km) ?> km
                    <?php elseif ($job->distance_km !== null): ?>
                        <?= esc((string) $job->distance_km) ?> km
                    <?php elseif ($job->start_odometer !== null): ?>
                        Start: <?= esc((string) $job->start_odometer) ?>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td><span class="badge <?= esc((string) $job->status) ?>"><?= esc((string) $job->status) ?></span></td>
                <?php if ($isLogistics): ?>
                    <td>
                        <?php if (($canManageTransport ?? false) && (string) $job->status === 'open'): ?>
                            <form method="post" action="/transport/assign/<?= esc((string) $job->id) ?>">
                                <?= csrf_field() ?>
                                <select name="assigned_user_id" required>
                                    <?php $eligibleUsers = $eligibleAssigneesByJob[(int) $job->id] ?? []; ?>
                                    <?php foreach ($eligibleUsers as $user): ?>
                                        <option value="<?= esc((string) $user->id) ?>"><?= esc((string) $user->name) ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <button type="submit" <?= $eligibleUsers === [] ? 'disabled' : '' ?>>Tildel</button>
                            </form>
                            <?php if ($eligibleUsers === []): ?>
                                <div style="margin-top:.4rem;color:#94a3b8;">Ingen brukere har riktig førerkort eller kompetanse for dette oppdraget.</div>
                            <?php endif; ?>
                        <?php elseif ((string) $job->status === 'assigned' && (($canManageTransport ?? false) || (int) ($job->assigned_user_id ?? 0) === (int) ($currentUserId ?? 0))): ?>
                            <div style="display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;">
                                <form method="get" action="/transport/inspect/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <button type="submit" class="btn btn-primary">Inspiser</button>
                                </form>
                                <form method="post" action="/transport/status/<?= esc((string) $job->id) ?>" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:0;">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="in_progress">
                                    <?php if (empty($job->assigned_vehicle_id)): ?>
                                        <select name="vehicle_id" data-role="start-vehicle-select" required>
                                            <option value="">Velg kjøretøy</option>
                                            <?php foreach ($vehicles as $vehicle): ?>
                                                <option value="<?= esc((string) $vehicle->id) ?>" data-odometer-exempt="<?= esc((string) ($vehicle->odometer_exempt ?? 0)) ?>" data-current-odometer="<?= esc((string) max(0, (int) ($vehicle->current_odometer ?? 0))) ?>">
                                                    <?= esc((string) $vehicle->name) ?> (<?= esc((string) $vehicle->registration_number) ?>)
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                    <?php endif; ?>
                                    <?php if ((int) ($job->vehicle_odometer_exempt ?? 0) !== 1 || empty($job->assigned_vehicle_id)): ?>
                                        <input type="number" min="0" name="start_odometer" data-role="start-odometer" value="<?= esc((string) max(0, (int) ($job->vehicle_current_odometer ?? 0))) ?>" placeholder="Kilometerstand naa" <?= empty($job->assigned_vehicle_id) ? '' : 'required' ?> style="min-width:170px;">
                                    <?php endif; ?>
                                    <button type="submit" class="btn btn-success">Begynn</button>
                                </form>
                            </div>
                        <?php elseif ((string) $job->status === 'in_progress' && (($canManageTransport ?? false) || (int) ($job->assigned_user_id ?? 0) === (int) ($currentUserId ?? 0))): ?>
                            <div style="display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;">
                                <form method="get" action="/transport/inspect/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <button type="submit" class="btn btn-primary">Inspiser</button>
                                </form>
                                <form method="post" action="/transport/status/<?= esc((string) $job->id) ?>" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:0;">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="completed">
                                    <?php if ((int) ($job->vehicle_odometer_exempt ?? 0) !== 1): ?>
                                        <?php $suggestedEndOdometer = max(0, (int) ($job->start_odometer ?? 0)) + max(0, (int) ($job->estimated_distance_km ?? 0)); ?>
                                        <input type="number" min="<?= esc((string) max(0, (int) ($job->start_odometer ?? 0))) ?>" name="end_odometer" data-role="end-odometer" data-suggested-end="<?= esc((string) $suggestedEndOdometer) ?>" value="<?= esc((string) $suggestedEndOdometer) ?>" placeholder="Kilometerstand ved parkering" required style="min-width:190px;">
                                    <?php endif; ?>
                                    <button type="submit" class="btn btn-success">Ferdig</button>
                                </form>
                            </div>
                        <?php else: ?>
                            -
                        <?php endif; ?>
                    </td>
                <?php endif; ?>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php if (! empty($completedJobs)): ?>
<div class="card">
    <h3>Avsluttede turer</h3>
    <table>
        <tr><th>ID</th><th>Type</th><th>For</th><th>Kjørt av</th><th>Fra</th><th>Til</th><th>Stopp</th><th>Kjøretøy</th><th>Km</th><th>Avvik</th><th>Fullført</th></tr>
        <?php foreach ($completedJobs as $job): ?>
            <?php
            $jobKind = (string) ($job->job_kind ?? ($job->transport_type ?? 'equipment'));
            $jobLabel = $jobKindLabels[$jobKind] ?? ucfirst($jobKind);
            $requesterLabel = '-';
            if (! empty($job->requester_name)) {
                $requesterLabel = (string) $job->requester_name;
                if (! empty($job->requester_wannabe_id)) {
                    $requesterLabel .= ' (Wannabe ' . (string) $job->requester_wannabe_id . ')';
                }
            } elseif (! empty($job->requester_wannabe_id)) {
                $requesterLabel = 'Wannabe ' . (string) $job->requester_wannabe_id;
            }
            ?>
            <tr>
                <td><?= esc((string) $job->id) ?></td>
                <td><?= esc($jobLabel) ?></td>
                <td><?= esc($requesterLabel) ?></td>
                <td><?= esc((string) ($job->assigned_name ?? '-')) ?></td>
                <td><?= esc((string) $job->from_name) ?></td>
                <td><?= esc((string) $job->to_name) ?></td>
                <td><?= esc((string) ($job->stops_summary !== '' ? $job->stops_summary : '-')) ?></td>
                <td>
                    <?php if (! empty($job->vehicle_name)): ?>
                        <?= esc((string) $job->vehicle_name) ?> (<?= esc((string) ($job->vehicle_registration_number ?? '-')) ?>)
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ((int) ($job->vehicle_odometer_exempt ?? 0) === 1): ?>
                        Unntatt
                    <?php elseif ($job->distance_km !== null): ?>
                        <?= esc((string) $job->distance_km) ?> km
                    <?php elseif ($job->estimated_distance_km !== null): ?>
                        Estimat: <?= esc((string) $job->estimated_distance_km) ?> km
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ((int) ($job->vehicle_odometer_exempt ?? 0) === 1): ?>
                        Unntatt
                    <?php elseif ($job->distance_deviation_km !== null): ?>
                        <span style="color:<?= (int) $job->distance_deviation_km > 0 ? '#ff6b6b' : '#7bd88f' ?>;font-weight:700;">
                            <?= esc((string) $job->distance_deviation_km) ?> km
                        </span>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td><?= esc((string) ($job->updated_at ?? $job->created_at ?? '-')) ?></td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>
<?php if (! empty($inspection)): ?>
<div class="card">
    <?php
    $inspectionKind = (string) ($inspection->job_kind ?? ($inspection->transport_type ?? 'equipment'));
    $inspectionLabel = $jobKindLabels[$inspectionKind] ?? ucfirst($inspectionKind);
    $inspectionRequester = '-';
    if (! empty($inspection->requester_name)) {
        $inspectionRequester = (string) $inspection->requester_name;
        if (! empty($inspection->requester_wannabe_id)) {
            $inspectionRequester .= ' (Wannabe ' . (string) $inspection->requester_wannabe_id . ')';
        }
    } elseif (! empty($inspection->requester_wannabe_id)) {
        $inspectionRequester = 'Wannabe ' . (string) $inspection->requester_wannabe_id;
    }
    ?>
    <h3>Inspiser oppdrag #<?= esc((string) $inspection->id) ?></h3>
    <table>
        <tr><th>Type</th><td><?= esc($inspectionLabel) ?></td></tr>
        <tr><th>Status</th><td><span class="badge <?= esc((string) $inspection->status) ?>"><?= esc((string) $inspection->status) ?></span></td></tr>
        <tr><th>Fra lokasjon</th><td><?= esc((string) $inspection->from_name) ?> (<?= esc((string) $inspection->from_type) ?>)</td></tr>
        <tr><th>Til lokasjon</th><td><?= esc((string) $inspection->to_name) ?> (<?= esc((string) $inspection->to_type) ?>)</td></tr>
        <tr><th>Stopp</th><td>
            <?php if (! empty($inspection->stops)): ?>
                <?php foreach ($inspection->stops as $stop): ?>
                    <div><strong>Stopp <?= esc((string) $stop->stop_number) ?>:</strong> <?= esc((string) $stop->address) ?><?= ! empty($stop->notes) ? ' - ' . esc((string) $stop->notes) : '' ?></div>
                <?php endforeach; ?>
            <?php else: ?>
                -
            <?php endif; ?>
        </td></tr>
        <tr><th>Hentetid</th><td><?= esc((string) ($inspection->pickup_at ?? '-')) ?></td></tr>
        <tr><th>Antall personer</th><td><?= esc((string) ($inspection->people_count ?? '-')) ?></td></tr>
        <tr><th>Kjøretøy</th><td><?= ! empty($inspection->vehicle_name) ? esc((string) $inspection->vehicle_name) . ' (' . esc((string) ($inspection->vehicle_registration_number ?? '-')) . ')' : '-' ?></td></tr>
        <tr><th>Estimert distanse</th><td><?= $inspection->estimated_distance_km !== null ? esc((string) $inspection->estimated_distance_km) . ' km' : '-' ?></td></tr>
        <tr><th>Kilometerstand ved start</th><td><?= (int) ($inspection->vehicle_odometer_exempt ?? 0) === 1 ? 'Unntatt' : esc((string) ($inspection->start_odometer ?? '-')) ?></td></tr>
        <tr><th>Kilometerstand ved parkering</th><td><?= (int) ($inspection->vehicle_odometer_exempt ?? 0) === 1 ? 'Unntatt' : esc((string) ($inspection->end_odometer ?? '-')) ?></td></tr>
        <tr><th>Kjørt distanse</th><td><?= (int) ($inspection->vehicle_odometer_exempt ?? 0) === 1 ? 'Unntatt' : ($inspection->distance_km !== null ? esc((string) $inspection->distance_km) . ' km' : '-') ?></td></tr>
        <tr><th>Avvik</th><td>
            <?php if ((int) ($inspection->vehicle_odometer_exempt ?? 0) === 1): ?>
                Unntatt
            <?php elseif ($inspection->distance_deviation_km !== null): ?>
                <span style="color:<?= (int) $inspection->distance_deviation_km > 0 ? '#ff6b6b' : '#7bd88f' ?>;font-weight:700;">
                    <?= esc((string) $inspection->distance_deviation_km) ?> km
                </span>
            <?php else: ?>
                -
            <?php endif; ?>
        </td></tr>
        <tr><th>Bestilt for</th><td><?= esc($inspectionRequester) ?></td></tr>
        <tr><th>Tildelt til</th><td><?= esc((string) ($inspection->assigned_name ?? '-')) ?></td></tr>
        <tr><th>Beskrivelse</th><td><?= esc((string) $inspection->description) ?></td></tr>
        <tr><th>Opprettet</th><td><?= esc((string) $inspection->created_at) ?></td></tr>
    </table>
</div>
<?php endif; ?>
<script>
(() => {
    const stopLocationOptions = <?= json_encode($stopLocationOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]' ?>;

    const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const stopLocationSelectMarkup = (index) => {
        const options = stopLocationOptions.map((location) => {
            const label = location.type ? `${location.name} (${location.type})` : location.name;
            return `<option value="${escapeHtml(location.address)}" data-address="${escapeHtml(location.address)}">${escapeHtml(label)}</option>`;
        }).join('');

        return `<select name="stops[${index}][location_hint]" data-role="stop-location-select"><option value="">Velg lokasjon med adresse (valgfritt)</option>${options}</select>`;
    };

    const bindStopLocationSelect = (stopItem) => {
        const select = stopItem.querySelector('[data-role="stop-location-select"]');
        const addressInput = stopItem.querySelector('input[name$="[address]"]');

        if (!select || !addressInput || select.dataset.bound === '1') {
            return;
        }

        select.dataset.bound = '1';
        select.addEventListener('change', () => {
            const selected = select.selectedOptions[0];
            const address = selected ? (selected.getAttribute('data-address') || '') : '';
            if (address !== '') {
                addressInput.value = address;
            }
        });
    };

    const syncPair = (form) => {
        const from = form.querySelector('[data-role="from-location"]');
        const to = form.querySelector('[data-role="to-location"]');
        if (!from || !to) return;
        const jobKind = form.querySelector('[data-role="job-kind"]');

        const apply = () => {
            const fromValue = from.value;
            const toValue = to.value;
            const selectedKind = jobKind instanceof HTMLSelectElement ? jobKind.value : '';
            const allowSameLocation = ['innkjopsrunde', 'henterunde'].includes(selectedKind);

            [...to.options].forEach((opt) => {
                if (!opt.value) return;
                opt.disabled = !allowSameLocation && opt.value === fromValue;
            });
            [...from.options].forEach((opt) => {
                if (!opt.value) return;
                opt.disabled = !allowSameLocation && opt.value === toValue;
            });

            if (!allowSameLocation && fromValue && to.value === fromValue) {
                to.value = '';
            }
            if (!allowSameLocation && toValue && from.value === toValue) {
                from.value = '';
            }
        };

        from.addEventListener('change', apply);
        to.addEventListener('change', apply);
        jobKind?.addEventListener('change', apply);
        apply();
    };

    document.querySelectorAll('.location-pair-form').forEach(syncPair);

    document.querySelectorAll('form[action="/transport/create"]').forEach((form) => {
        const userSelect = form.querySelector('[data-role="requester-user"]');
        const wannabeInput = form.querySelector('[data-role="requester-wannabe"]');
        const jobKind = form.querySelector('[data-role="job-kind"]');
        const fromSelect = form.querySelector('[name="from_location_id"]');
        const toSelect = form.querySelector('[name="to_location_id"]');
        const stopsSection = form.querySelector('[data-kind-visible="innkjopsrunde,henterunde"]');
        const stopsContainer = form.querySelector('[data-role="stops-container"]');
        const addStopButton = form.querySelector('[data-role="add-stop"]');

        if (userSelect && wannabeInput) {
            userSelect.addEventListener('change', () => {
                const selected = userSelect.selectedOptions[0];
                const wannabeId = selected ? (selected.getAttribute('data-wannabe-id') || '') : '';
                if (wannabeId) {
                    wannabeInput.value = wannabeId;
                }
            });
        }

        const syncCreateForm = () => {
            const kind = jobKind ? jobKind.value : '';
            form.querySelectorAll('[data-kind-visible]').forEach((el) => {
                const visibleKinds = (el.getAttribute('data-kind-visible') || '').split(',');
                const visible = kind !== '' && visibleKinds.includes(kind);
                el.hidden = !visible;
            });

            const restrictToTransportAndWarehouse = kind === 'innkjopsrunde' || kind === 'henterunde';
            [fromSelect, toSelect].forEach((select) => {
                if (!select) return;
                [...select.options].forEach((opt) => {
                    if (!opt.value) return;
                    const type = (opt.getAttribute('data-location-type') || '').toLowerCase();
                    opt.hidden = restrictToTransportAndWarehouse && !['transport', 'lager'].includes(type);
                    opt.disabled = restrictToTransportAndWarehouse && !['transport', 'lager'].includes(type);
                });
                if (select.selectedOptions[0] && select.selectedOptions[0].disabled) {
                    select.value = '';
                }
            });

            if (stopsSection) {
                const stopInputs = stopsSection.querySelectorAll('input, textarea');
                stopInputs.forEach((field) => {
                    field.disabled = !['innkjopsrunde', 'henterunde'].includes(kind);
                });
                stopsSection.querySelectorAll('[data-role="stop-location-select"]').forEach((field) => {
                    field.disabled = !['innkjopsrunde', 'henterunde'].includes(kind);
                });
            }
        };

        if (addStopButton && stopsContainer) {
            addStopButton.addEventListener('click', () => {
                const index = stopsContainer.querySelectorAll('[data-stop-item]').length;
                const wrapper = document.createElement('div');
                wrapper.className = 'transport-stop';
                wrapper.setAttribute('data-stop-item', '');
                wrapper.innerHTML =
                    stopLocationSelectMarkup(index) +
                    '<input type="text" name="stops[' + index + '][address]" placeholder="Stopp ' + (index + 1) + ': Adresse">' +
                    '<textarea name="stops[' + index + '][notes]" placeholder="Notat for stopp ' + (index + 1) + '"></textarea>';
                stopsContainer.appendChild(wrapper);
                bindStopLocationSelect(wrapper);
                syncCreateForm();
            });
        }

        stopsContainer?.querySelectorAll('[data-stop-item]').forEach(bindStopLocationSelect);

        if (jobKind) {
            jobKind.addEventListener('change', syncCreateForm);
        }
        syncCreateForm();
    });

    document.querySelectorAll('form[action^="/transport/status/"]').forEach((form) => {
        const vehicleSelect = form.querySelector('[data-role="start-vehicle-select"]');
        const odometerInput = form.querySelector('[data-role="start-odometer"]');
        const endOdometerInput = form.querySelector('[data-role="end-odometer"]');

        if (odometerInput) {
            const syncOdometer = () => {
                const selected = vehicleSelect ? vehicleSelect.selectedOptions[0] : null;
                const exempt = selected ? selected.getAttribute('data-odometer-exempt') === '1' : false;
                const currentOdometer = selected ? (selected.getAttribute('data-current-odometer') || '0') : (odometerInput.value || '0');

                odometerInput.disabled = exempt;
                odometerInput.required = !exempt;
                odometerInput.hidden = exempt;
                if (exempt) {
                    odometerInput.value = '';
                } else if (vehicleSelect) {
                    odometerInput.value = currentOdometer;
                }
            };

            if (vehicleSelect) {
                vehicleSelect.addEventListener('change', syncOdometer);
            }
            syncOdometer();
        }

        if (endOdometerInput) {
            form.addEventListener('submit', () => {
                const suggested = parseInt(endOdometerInput.getAttribute('data-suggested-end') || '', 10);
                const actual = parseInt(endOdometerInput.value || '', 10);

                if (!Number.isFinite(suggested) || !Number.isFinite(actual) || suggested === actual) {
                    delete form.dataset.confirmMessage;
                    return;
                }

                const diff = actual - suggested;
                const direction = diff > 0 ? 'hoyere' : 'lavere';
                form.dataset.confirmMessage = 'Foreslaatt kilometerstand ved parkering er ' + suggested + ' km, men du har skrevet inn ' + actual + ' km. Dette er ' + Math.abs(diff) + ' km ' + direction + '. Bekrefter du avviket?';
            });
        }
    });
})();
</script>
<?= $this->endSection() ?>
