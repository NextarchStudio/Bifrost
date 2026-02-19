<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1><?= ! empty($isOwnProfile) ? 'Min profil' : 'Profil' ?></h1>

<div class="grid">
    <div class="card">
        <h3>Brukerinfo</h3>
        <table>
            <tr><th>Navn</th><td><?= esc((string) $user->name) ?></td></tr>
            <tr><th>Fornavn</th><td><?= esc((string) $user->first_name) ?></td></tr>
            <tr><th>Etternavn</th><td><?= esc((string) $user->last_name) ?></td></tr>
            <tr><th>E-post</th><td><?= esc((string) $user->email) ?></td></tr>
            <tr><th>Wannabe-ID</th><td><?= esc((string) ($user->wannabe_id ?? '-')) ?></td></tr>
            <tr><th>Roller</th><td><?= esc(implode(', ', (array) ($roles ?? []))) ?></td></tr>
        </table>
    </div>

    <?php if (! empty($isOwnProfile)): ?>
    <div class="card">
        <h3>Endre passord</h3>
        <form method="post" action="/profile/password">
            <?= csrf_field() ?>
            <input type="password" name="current_password" placeholder="Nåværende passord">
            <input type="password" name="new_password" placeholder="Nytt passord (min 10 tegn)" required>
            <input type="password" name="new_password_confirm" placeholder="Bekreft nytt passord" required>
            <button type="submit" class="btn btn-primary">Oppdater passord</button>
        </form>
    </div>
    <?php endif; ?>
</div>

<div class="card">
    <h3><?= ! empty($isOwnProfile) ? 'Mine aktive utlån' : 'Aktive utlån' ?></h3>
    <table>
        <tr><th>ID</th><th>Utstyr</th><th>Serienummer</th><th>Antall</th><th>Status</th><th>Utstedt</th></tr>
        <?php foreach ($loans as $loan): ?>
            <?php if ((string) $loan->status !== 'active'): continue; endif; ?>
            <tr>
                <td><?= esc((string) $loan->id) ?></td>
                <td><?= esc((string) $loan->equipment_name) ?></td>
                <td><?= esc((string) ($loan->serial_number ?? '-')) ?></td>
                <td><?= esc((string) ($loan->quantity ?? 1)) ?></td>
                <td><span class="badge <?= esc((string) $loan->status) ?>"><?= esc((string) $loan->status) ?></span></td>
                <td><?= esc((string) $loan->issued_at) ?></td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<div class="card">
    <h3><?= ! empty($isOwnProfile) ? 'Mine aktive samband-lån' : 'Aktive samband-lån' ?></h3>
    <table>
        <tr><th>ID</th><th>Type</th><th>Innhold</th><th>Antall ting</th><th>Utstedt</th></tr>
        <?php foreach (($commsLoans ?? []) as $loan): ?>
            <tr>
                <td><?= esc((string) $loan['id']) ?></td>
                <td><?= esc(! empty($loan['set_id']) ? 'Sett: ' . (string) ($loan['set_name'] ?? '-') : 'Enkeltutstyr') ?></td>
                <td><?= esc((string) ($loan['items_summary'] ?? '-')) ?></td>
                <td><?= esc((string) ($loan['total_items'] ?? 0)) ?></td>
                <td><?= esc((string) $loan['issued_at']) ?></td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if (! empty($canViewRequests)): ?>
    <div class="card">
        <h3><?= ! empty($isOwnProfile) ? 'Mine forespørsler' : 'Brukerens forespørsler' ?></h3>
        <table>
            <tr><th>ID</th><th>Utstyr</th><th>Status</th><th>Opprettet</th></tr>
            <?php foreach ($requests as $request): ?>
                <tr>
                    <td><?= esc((string) $request['id']) ?></td>
                    <td><?= esc((string) ($request['items_summary'] ?? '-')) ?></td>
                    <td><span class="badge <?= esc((string) $request['status']) ?>"><?= esc((string) $request['status']) ?></span></td>
                    <td><?= esc((string) $request['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
<?php endif; ?>
<?= $this->endSection() ?>
