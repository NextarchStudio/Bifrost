<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Transport</h1>
<div class="card">
    <h3>Rekvirer persontransport</h3>
    <form method="post" action="/transport/request-people" class="location-pair-form">
        <?= csrf_field() ?>
        <input type="number" min="1" name="people_count" placeholder="Antall personer" required>
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

<?php if ($isLogistics): ?>
<div class="card">
    <h3>Opprett utstyrstransport (logistikk)</h3>
    <form method="post" action="/transport/create" class="location-pair-form">
        <?= csrf_field() ?>
        <textarea name="description" placeholder="Beskrivelse" required></textarea>
        <select name="from_location_id" data-role="from-location" required>
            <option value="">Fra lokasjon</option>
            <?php foreach ($nonTransportLocations as $location): ?>
                <option value="<?= esc((string) $location->id) ?>"><?= esc((string) $location->name) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="to_location_id" data-role="to-location" required>
            <option value="">Til lokasjon</option>
            <?php foreach ($nonTransportLocations as $location): ?>
                <option value="<?= esc((string) $location->id) ?>"><?= esc((string) $location->name) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="equipment_id">
            <option value="">Valgfritt utstyr</option>
            <?php foreach ($equipment as $item): ?>
                <option value="<?= esc((string) $item->id) ?>"><?= esc((string) $item->name) ?></option>
            <?php endforeach; ?>
        </select>
        <button type="submit">Opprett oppdrag</button>
    </form>
</div>
<?php endif; ?>

<div class="card">
    <h3><?= $isLogistics ? 'Aktive oppdrag (logistikk)' : 'Mine transportforespørsler' ?></h3>
    <table>
        <tr><th>ID</th><th>Type</th><th>Fra</th><th>Til</th><th>Antall personer</th><th>Utstyr</th><th>Status</th><?php if ($isLogistics): ?><th>Handling</th><?php endif; ?></tr>
        <?php foreach ($jobs as $job): ?>
            <tr>
                <td><?= esc((string) $job->id) ?></td>
                <td><?= esc((string) ((string) $job->transport_type === 'people' ? 'Persontransport' : 'Utstyrstransport')) ?></td>
                <td><?= esc((string) $job->from_name) ?></td>
                <td><?= esc((string) $job->to_name) ?></td>
                <td><?= esc((string) ($job->people_count ?? '-')) ?></td>
                <td><?= esc((string) ($job->equipment_name ?? '-')) ?></td>
                <td><span class="badge <?= esc((string) $job->status) ?>"><?= esc((string) $job->status) ?></span></td>
                <?php if ($isLogistics): ?>
                    <td>
                        <?php if ((string) $job->status === 'open'): ?>
                            <form method="post" action="/transport/assign/<?= esc((string) $job->id) ?>">
                                <?= csrf_field() ?>
                                <select name="assigned_user_id" required>
                                    <?php foreach ($users as $user): ?>
                                        <option value="<?= esc((string) $user->id) ?>"><?= esc((string) $user->name) ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <button type="submit">Tildel</button>
                            </form>
                        <?php elseif ((string) $job->status === 'assigned'): ?>
                            <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                                <form method="get" action="/transport/inspect/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <button type="submit" class="btn btn-primary">Inspiser</button>
                                </form>
                                <form method="post" action="/transport/status/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="in_progress">
                                    <button type="submit" class="btn btn-success">Begynn</button>
                                </form>
                            </div>
                        <?php elseif ((string) $job->status === 'in_progress'): ?>
                            <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                                <form method="get" action="/transport/inspect/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <button type="submit" class="btn btn-primary">Inspiser</button>
                                </form>
                                <form method="post" action="/transport/status/<?= esc((string) $job->id) ?>" style="margin:0;">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="completed">
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
<?php if (! empty($inspection)): ?>
<div class="card">
    <h3>Inspiser oppdrag #<?= esc((string) $inspection->id) ?></h3>
    <table>
        <tr><th>Type</th><td><?= esc((string) ((string) $inspection->transport_type === 'people' ? 'Persontransport' : 'Utstyrstransport')) ?></td></tr>
        <tr><th>Status</th><td><span class="badge <?= esc((string) $inspection->status) ?>"><?= esc((string) $inspection->status) ?></span></td></tr>
        <tr><th>Fra lokasjon</th><td><?= esc((string) $inspection->from_name) ?> (<?= esc((string) $inspection->from_type) ?>)</td></tr>
        <tr><th>Til lokasjon</th><td><?= esc((string) $inspection->to_name) ?> (<?= esc((string) $inspection->to_type) ?>)</td></tr>
        <tr><th>Antall personer</th><td><?= esc((string) ($inspection->people_count ?? '-')) ?></td></tr>
        <tr><th>Utstyr</th><td><?= esc((string) ($inspection->equipment_name ?? '-')) ?><?= ! empty($inspection->equipment_serial) ? ' (' . esc((string) $inspection->equipment_serial) . ')' : '' ?></td></tr>
        <tr><th>Forespurt av</th><td><?= esc((string) ($inspection->requester_name ?? '-')) ?></td></tr>
        <tr><th>Tildelt til</th><td><?= esc((string) ($inspection->assigned_name ?? '-')) ?></td></tr>
        <tr><th>Beskrivelse</th><td><?= esc((string) $inspection->description) ?></td></tr>
        <tr><th>Opprettet</th><td><?= esc((string) $inspection->created_at) ?></td></tr>
    </table>
</div>
<?php endif; ?>
<script>
(() => {
    const syncPair = (form) => {
        const from = form.querySelector('[data-role="from-location"]');
        const to = form.querySelector('[data-role="to-location"]');
        if (!from || !to) return;

        const apply = () => {
            const fromValue = from.value;
            const toValue = to.value;

            [...to.options].forEach((opt) => {
                if (!opt.value) return;
                opt.disabled = opt.value === fromValue;
            });
            [...from.options].forEach((opt) => {
                if (!opt.value) return;
                opt.disabled = opt.value === toValue;
            });

            if (fromValue && to.value === fromValue) {
                to.value = '';
            }
            if (toValue && from.value === toValue) {
                from.value = '';
            }
        };

        from.addEventListener('change', apply);
        to.addEventListener('change', apply);
        apply();
    };

    document.querySelectorAll('.location-pair-form').forEach(syncPair);
})();
</script>
<?= $this->endSection() ?>
