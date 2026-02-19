<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Utlån</h1>
<div class="card">
    <h3>Lån utstyr</h3>
    <form method="post" action="/loans/issue">
        <?= csrf_field() ?>
        <input type="text" name="barcode" placeholder="Strekkode / serienummer" required value="<?= esc(old('barcode') ?? '') ?>">
        <input type="number" min="1" name="wannabe_id" placeholder="Wannabe ID" required value="<?= esc(old('wannabe_id') ?? '') ?>">
        <button type="submit">Registrer lån</button>
    </form>
</div>
<div class="card">
    <h3>Aktive lån</h3>
    <form method="get" action="/loans" style="margin-bottom: .8rem;">
        <input type="text" name="q" placeholder="Søk på wannabe ID eller navn" value="<?= esc((string) ($search ?? '')) ?>">
        <button type="submit">Søk</button>
    </form>
    <table>
        <tr><th>ID</th><th>Utstyr</th><th>Wannabe ID</th><th>Navn</th><th>Antall</th><th>Utstedt</th><th>Status</th><th></th></tr>
        <?php foreach ($activeLoans as $loan): ?>
            <?php
            $name = trim((string) (($loan->wannabe_name ?? '') !== '' ? $loan->wannabe_name : (($loan->wannabe_first_name ?? '') . ' ' . ($loan->wannabe_last_name ?? ''))));
            ?>
            <tr>
                <td><?= esc((string) $loan->id) ?></td>
                <td><?= esc((string) $loan->equipment_name) ?></td>
                <td><?= esc((string) $loan->wannabe_id) ?></td>
                <td><?= esc($name !== '' ? $name : '-') ?></td>
                <td><?= esc((string) ($loan->quantity ?? 1)) ?></td>
                <td><?= esc((string) $loan->issued_at) ?></td>
                <td><span class="badge <?= esc((string) $loan->status) ?>"><?= esc((string) $loan->status) ?></span></td>
                <td>
                    <form method="post" action="/loans/return/<?= esc((string) $loan->id) ?>">
                        <?= csrf_field() ?>
                        <button type="submit">Returner</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
