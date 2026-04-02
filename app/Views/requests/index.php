<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$statusLabel = static function (string $status): string {
    return match ($status) {
        'pending' => 'Venter',
        'approved' => 'Godkjent',
        'rejected' => 'Avvist',
        'partial' => 'Delvis godkjent',
        'fulfilled' => 'Levert',
        'returned' => 'Returnert',
        default => $status,
    };
};

$canDeleteOwnRequest = static function (string $status): bool {
    return in_array($status, ['pending', 'rejected', 'returned'], true);
};
?>
<h1>Utstyrsforespørsler</h1>

<?php if (! ($canCreateRequest ?? true)): ?>
<div class="card" style="color:#f8fafc;">
    <p style="margin:0;">Logistikk kan se innkommende og mine forespørsler, men kan ikke opprette nye forespørsler.</p>
</div>
<?php endif; ?>

<?php if ($canCreateRequest ?? true): ?>
<div class="grid">
    <div class="card" style="color:#f8fafc;">
        <h3>Ny forespørsel</h3>
        <form method="post" action="/requests/create">
            <?= csrf_field() ?>
            <input type="number" min="1" placeholder="Wannabe ID" value="<?= esc((string) ($currentWannabeId ?? '')) ?>" readonly style="color:#f8fafc;background:#0f172a;opacity:1;cursor:not-allowed;">

            <input id="equipmentSearch" type="text" placeholder="Søk i utstyr (navn, serienummer, lokasjon)" style="color:#f8fafc;">
            <div style="max-height: 320px; overflow:auto; border:1px solid #1f2a44; border-radius:10px; padding:.5rem;">
                <table id="equipmentTable" style="color:#f8fafc;">
                    <tr><th>Velg</th><th>Utstyr</th><th>Serienr</th><th>Lokasjon</th><th>Tilgjengelig</th><th>Antall</th><th>Notat</th></tr>
                    <?php foreach ($equipment as $item): ?>
                        <?php $requestable = ((int) $item->quantity > 0) && ((string) $item->status !== 'maintenance'); ?>
                        <tr class="equipment-row">
                            <td><input type="checkbox" name="items[<?= esc((string) $item->id) ?>][selected]" value="1" <?= $requestable ? '' : 'disabled' ?>></td>
                            <td><?= esc((string) $item->name) ?></td>
                            <td><?= esc((string) $item->serial_number) ?></td>
                            <td><?= esc((string) ($item->location_name ?? '-')) ?></td>
                            <td>
                                <?php if ($requestable): ?>
                                    <span class="badge available">Tilgjengelig (<?= esc((string) $item->quantity) ?>)</span>
                                <?php else: ?>
                                    <span class="badge rejected">Utilgjengelig</span>
                                <?php endif; ?>
                            </td>
                            <td><input type="number" min="1" max="<?= esc((string) max(1, (int) $item->quantity)) ?>" value="1" name="items[<?= esc((string) $item->id) ?>][quantity]" style="color:#f8fafc;" <?= $requestable ? '' : 'disabled' ?>></td>
                            <td><input type="text" name="items[<?= esc((string) $item->id) ?>][note]" placeholder="Valgfritt" style="color:#f8fafc;" <?= $requestable ? '' : 'disabled' ?>></td>
                        </tr>
                    <?php endforeach; ?>
                </table>
            </div>
            <button type="submit">Send forespørsel</button>
        </form>
    </div>
</div>
<?php endif; ?>

<div class="card" style="color:#f8fafc;">
    <h3>Mine forespørsler</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Wannabe ID</th><th>Utstyr</th><th>Status</th><th>Avvik</th><th>Opprettet</th><th>Handling</th></tr>
        <?php foreach ($myRequests as $request): ?>
            <?php $status = (string) $request['status']; ?>
            <tr>
                <td><?= esc((string) $request['id']) ?></td>
                <td><?= esc((string) ($request['wannabe_id'] ?? '-')) ?></td>
                <td><?= esc((string) ($request['items_summary'] ?? '-')) ?></td>
                <td><span class="badge <?= esc($status) ?>"><?= esc($statusLabel($status)) ?></span></td>
                <td>
                    <?php if (! empty($request['change_summary'])): ?>
                        <span class="badge partial">Endret: <?= esc((string) $request['change_summary']) ?></span>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td><?= esc((string) $request['created_at']) ?></td>
                <td>
                    <?php if ($canDeleteOwnRequest($status)): ?>
                        <form method="post" action="/requests/delete/<?= esc((string) $request['id']) ?>" onsubmit="return confirm('Slette denne forespørselen?');">
                            <?= csrf_field() ?>
                            <button type="submit" style="background:#7f1d1d;">Slett</button>
                        </form>
                    <?php else: ?>
                        <span style="color:#94a3b8;">Kan ikke slettes</span>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if ($isLogistics): ?>
<div class="card" style="color:#f8fafc;">
    <h3>Innkommende forespørsler (logistikk)</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Bruker</th><th>Wannabe ID</th><th>Utstyr</th><th>Status</th><th>Handling</th></tr>
        <?php foreach ($allRequests as $request): ?>
            <tr>
                <td><?= esc((string) $request['id']) ?></td>
                <td><?= esc((string) $request['requester_name']) ?></td>
                <td><?= esc((string) ($request['wannabe_id'] ?? '-')) ?></td>
                <td><?= esc((string) ($request['items_summary'] ?? '-')) ?></td>
                <td><span class="badge <?= esc((string) $request['status']) ?>"><?= esc($statusLabel((string) $request['status'])) ?></span></td>
                <td>
                    <?php if (! ($canManageRequests ?? false)): ?>
                        <span style="color:#94a3b8;">Kun visning</span>
                    <?php elseif ((string) $request['status'] === 'approved'): ?>
                        <form method="post" action="/requests/status/<?= esc((string) $request['id']) ?>">
                            <?= csrf_field() ?>
                            <input type="hidden" name="status" value="fulfilled">
                            <button type="submit">Levert</button>
                        </form>

                        <form method="post" action="/requests/delete/<?= esc((string) $request['id']) ?>" style="margin-top:.6rem;" onsubmit="return confirm('Slette denne forespørselen? Dette er bare mulig hvis ingen aktive utlån er knyttet til den.');">
                            <?= csrf_field() ?>
                            <button type="submit" style="background:#7f1d1d;">Slett</button>
                        </form>
                    <?php else: ?>
                        <form method="post" action="/requests/status/<?= esc((string) $request['id']) ?>">
                            <?= csrf_field() ?>
                            <select name="status" required>
                                <option value="pending">Venter</option>
                                <option value="rejected">Avvist</option>
                                <option value="fulfilled">Levert</option>
                            </select>
                            <button type="submit">Oppdater</button>
                        </form>

                        <form method="post" action="/requests/status/<?= esc((string) $request['id']) ?>" style="margin-top:.6rem;">
                            <?= csrf_field() ?>
                            <input type="hidden" name="status" value="approved">
                            <button type="submit">Godkjenn alle linjer</button>
                        </form>

                        <form method="post" action="/requests/approve/<?= esc((string) $request['id']) ?>" style="margin-top:.6rem;">
                            <?= csrf_field() ?>
                            <div style="font-size:.85rem;margin-bottom:.4rem;">Sett godkjent antall per linje (0 betyr ikke godkjent)</div>
                            <?php foreach ($request['items'] as $item): ?>
                                <div style="border:1px solid #1f2a44;border-radius:8px;padding:.45rem;margin-bottom:.4rem;">
                                    <div><strong><?= esc((string) $item['equipment_name']) ?></strong> (<?= esc((string) $item['serial_number']) ?>)</div>
                                    <div style="font-size:.8rem;color:#94a3b8;">Forespurt antall: <?= esc((string) $item['quantity']) ?> | Godkjent antall: <?= esc((string) $item['approved_quantity']) ?></div>
                                    <div style="font-size:.8rem;color:#94a3b8;">Tilgjengelig på lager: <?= esc((string) $item['equipment_quantity']) ?> | Lagerstatus: <?= esc((string) $item['equipment_status']) ?> | Linjestatus: <?= esc($statusLabel((string) $item['item_status'])) ?></div>
                                    <label style="display:inline-block;margin-right:.8rem;">
                                        Godkjent antall:
                                        <input type="number"
                                               min="0"
                                               max="<?= esc((string) $item['quantity']) ?>"
                                               value="<?= esc((string) $item['approved_quantity']) ?>"
                                               name="approved_quantities[<?= esc((string) $item['id']) ?>]"
                                               style="width:92px;display:inline-block;margin-left:.35rem;">
                                    </label>
                                    <label style="display:inline-block;">
                                        <input type="checkbox" name="rejected_items[]" value="<?= esc((string) $item['id']) ?>"> Avvis
                                    </label>
                                </div>
                            <?php endforeach; ?>
                            <button type="submit">Behandle linjer</button>
                        </form>

                        <form method="post" action="/requests/delete/<?= esc((string) $request['id']) ?>" style="margin-top:.6rem;" onsubmit="return confirm('Slette denne forespørselen? Dette er bare mulig hvis ingen aktive utlån er knyttet til den.');">
                            <?= csrf_field() ?>
                            <button type="submit" style="background:#7f1d1d;">Slett</button>
                        </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>

<script>
(() => {
    const searchInput = document.getElementById('equipmentSearch');
    const rows = document.querySelectorAll('#equipmentTable .equipment-row');
    if (!searchInput || !rows.length) return;
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        rows.forEach((row) => {
            const txt = row.innerText.toLowerCase();
            row.style.display = txt.includes(q) ? '' : 'none';
        });
    });
})();
</script>
<?= $this->endSection() ?>