<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Lager</h1>
<div class="grid">
    <div class="card">
        <h3>Ny palle</h3>
        <form method="post" action="/warehouse/pallet/create">
            <?= csrf_field() ?>
            <select name="location_id" required>
                <?php foreach ($palletLocations as $location): ?>
                    <option value="<?= esc((string) $location->id) ?>"><?= esc((string) $location->name) ?></option>
                <?php endforeach; ?>
            </select>
            <input name="qr_code" placeholder="Strekkode fra palle" required>
            <input name="pallet_number" placeholder="Palle nummer" required>
            <button type="submit" class="btn btn-primary">Opprett palle</button>
        </form>
    </div>
    <div class="card">
        <h3>Legg til på palle</h3>
        <form method="post" action="/warehouse/pallet/add-equipment">
            <?= csrf_field() ?>
            <input name="pallet_qr_code" placeholder="Strekkode fra palle" required>
            <input name="equipment_barcode" placeholder="Strekkode fra utstyr" required>
            <button type="submit" class="btn btn-primary">Legg til</button>
        </form>
    </div>
</div>
<div class="card">
    <h3>Lokasjoner og paller</h3>
    <table style="color:#f8fafc;">
        <tr><th>Lokasjoner</th><th>Paller</th></tr>
        <tr>
            <td>
                <?php foreach ($locations as $location): ?>
                    <div><?= esc((string) $location->name) ?> (<?= esc((string) $location->type) ?>)</div>
                <?php endforeach; ?>
            </td>
            <td>
                <?php foreach ($pallets as $pallet): ?>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;border-bottom:1px solid #22314f;padding:.45rem 0;">
                        <span><?= esc((string) $pallet->name) ?> - <?= esc((string) $pallet->location_name) ?></span>
                        <span style="display:flex;gap:.45rem;">
                            <form method="post" action="/warehouse/pallet/move/<?= esc((string) $pallet->id) ?>" style="margin:0;display:flex;gap:.35rem;">
                                <?= csrf_field() ?>
                                <select name="location_id" required style="min-width:150px;margin:0;">
                                    <?php foreach ($palletLocations as $location): ?>
                                        <option value="<?= esc((string) $location->id) ?>" <?= (int) $location->id === (int) $pallet->location_id ? 'selected' : '' ?>>
                                            <?= esc((string) $location->name) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <button class="btn btn-primary" type="submit">Flytt</button>
                            </form>
                            <form method="get" action="/warehouse/pallet/inspect/<?= esc((string) $pallet->id) ?>" style="margin:0;">
                                <button class="btn btn-primary" type="submit">Inspiser</button>
                            </form>
                            <form method="post" action="/warehouse/pallet/delete/<?= esc((string) $pallet->id) ?>" onsubmit="return confirm('Slette palle <?= esc((string) $pallet->name) ?>?');" style="margin:0;">
                                <?= csrf_field() ?>
                                <button class="btn btn-primary" type="submit">Slett</button>
                            </form>
                        </span>
                    </div>
                <?php endforeach; ?>
            </td>
        </tr>
    </table>
</div>

<?php if (! empty($inspection)): ?>
<div class="card">
    <h3>Inspeksjon av palle: <?= esc((string) $inspection['pallet']->name) ?></h3>
    <div style="margin-bottom:.7rem;color:#cbd5e1;">
        Lokasjon: <strong><?= esc((string) $inspection['pallet']->location_name) ?></strong>
    </div>
    <table style="color:#f8fafc;">
        <tr><th>Utstyr</th><th>Serienummer</th><th>Antall</th><th>Utstyr-status</th></tr>
        <?php foreach ($inspection['rows'] as $row): ?>
            <?php if (empty($row->equipment_id)): continue; endif; ?>
            <tr>
                <td><?= esc((string) ($row->equipment_name ?? '-')) ?></td>
                <td><?= esc((string) ($row->serial_number ?? '-')) ?></td>
                <td><?= esc((string) (($row->quantity ?? null) !== null ? $row->quantity : '-')) ?></td>
                <td>
                    <?php if (! empty($row->equipment_status)): ?>
                        <span class="badge <?= esc((string) $row->equipment_status) ?>"><?= esc((string) $row->equipment_status) ?></span>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>
<?= $this->endSection() ?>
