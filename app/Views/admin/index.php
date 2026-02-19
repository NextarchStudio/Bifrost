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
        'sambandsansvarlig' => 'Sambandsansvarlig',
        'skiftleder' => 'Skiftleder',
        'transport_ansvarlig' => 'Transport Ansvarlig',
        default => $role,
    };
};
?>
<h1>Administrasjon</h1>
<div class="grid">
    <div class="card">
        <h3>Systeminnstillinger</h3>
        <form method="post" action="/admin/settings">
            <?= csrf_field() ?>
            <label><input type="checkbox" name="enable_local_login" value="1" <?= (int) $settings->enable_local_login === 1 ? 'checked' : '' ?>> Lokal innlogging</label>
            <label><input type="checkbox" name="enable_discord_login" value="1" <?= (int) $settings->enable_discord_login === 1 ? 'checked' : '' ?>> Discord-innlogging</label>
            <label><input type="checkbox" name="enable_keycloak_login" value="1" <?= (int) $settings->enable_keycloak_login === 1 ? 'checked' : '' ?>> Keycloak-innlogging</label>
            <button type="submit">Lagre innstillinger</button>
        </form>
    </div>
    <div class="card">
        <h3>Opprett bruker</h3>
        <form method="post" action="/admin/users/create">
            <?= csrf_field() ?>
            <input name="first_name" placeholder="Fornavn" required>
            <input name="last_name" placeholder="Etternavn" required>
            <input name="email" type="email" placeholder="E-post" required>
            <input name="wannabe_id" type="number" placeholder="Wannabe ID">
            <input name="password" type="password" placeholder="Passord (min 10)">
            <button type="submit">Opprett bruker</button>
        </form>
    </div>
</div>
<div class="card">
    <h3>Brukere og roller</h3>
    <table>
        <tr><th>Wannabe-ID</th><th>Bruker</th><th>E-post</th><th>Status</th><th>Roller</th><th>Handling</th></tr>
        <?php foreach ($users as $user): ?>
            <tr>
                <td><?= esc((string) ($user->wannabe_id ?? '-')) ?></td>
                <td><?= esc((string) $user->name) ?></td>
                <td><?= esc((string) $user->email) ?></td>
                <td>
                    <?php if ((int) ($user->active ?? 1) === 1): ?>
                        <span class="badge active">Aktiv</span>
                    <?php else: ?>
                        <span class="badge rejected">Inaktiv</span>
                    <?php endif; ?>
                </td>
                <td>
                    <?= esc(implode(', ', array_map($roleLabel, (array) ($roleNamesByUser[(int) $user->id] ?? [])))) ?>
                </td>
                <td>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                        <a href="/admin/users/inspect/<?= esc((string) $user->id) ?>" class="btn btn-primary">Inspiser</a>
                        <a href="/admin/users/edit/<?= esc((string) $user->id) ?>" class="btn btn-primary">Rediger</a>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if (! empty($inspectedUser)): ?>
<div class="card">
    <h3>Inspiser bruker</h3>
    <table>
        <tr><th>Wannabe-ID</th><td><?= esc((string) ($inspectedUser['user']->wannabe_id ?? '-')) ?></td></tr>
        <tr><th>Bruker</th><td><?= esc((string) $inspectedUser['user']->name) ?></td></tr>
        <tr><th>E-post</th><td><?= esc((string) $inspectedUser['user']->email) ?></td></tr>
        <tr><th>Status</th><td><?= (int) ($inspectedUser['user']->active ?? 1) === 1 ? 'Aktiv' : 'Inaktiv' ?></td></tr>
        <tr><th>Roller</th><td><?= esc(implode(', ', array_map($roleLabel, (array) $inspectedUser['roleNames']))) ?></td></tr>
    </table>
</div>
<?php endif; ?>

<?php if (! empty($editUser)): ?>
<div class="card">
    <h3>Rediger brukerroller</h3>
    <div style="margin-bottom:.6rem;">
        <strong><?= esc((string) $editUser->name) ?></strong> (<?= esc((string) $editUser->email) ?>)
    </div>
    <form method="post" action="/admin/users/active/<?= esc((string) $editUser->id) ?>" style="margin-bottom:.9rem;">
        <?= csrf_field() ?>
        <input type="hidden" name="active" value="0">
        <label style="display:flex;align-items:center;gap:.45rem;padding:.35rem .45rem;border:1px solid #1f2a44;border-radius:8px;max-width:240px;">
            <input type="checkbox" name="active" value="1" <?= (int) ($editUser->active ?? 1) === 1 ? 'checked' : '' ?> style="width:auto;margin:0;">
            <span>Bruker er aktiv</span>
        </label>
        <button type="submit" class="btn btn-primary">Lagre brukerstatus</button>
    </form>
    <form method="post" action="/admin/users/roles/<?= esc((string) $editUser->id) ?>">
        <?= csrf_field() ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.45rem .8rem;">
            <?php foreach ($roles as $role): ?>
                <label style="display:flex;align-items:center;gap:.45rem;padding:.35rem .45rem;border:1px solid #1f2a44;border-radius:8px;">
                    <input
                        type="checkbox"
                        name="role_ids[]"
                        value="<?= esc((string) $role['id']) ?>"
                        <?= in_array((int) $role['id'], (array) $editRoleIds, true) ? 'checked' : '' ?>
                        style="width:auto;margin:0;">
                    <span><?= esc($roleLabel((string) $role['name'])) ?></span>
                </label>
            <?php endforeach; ?>
        </div>
        <button type="submit" class="btn btn-primary">Lagre roller</button>
    </form>
</div>
<?php endif; ?>
<?= $this->endSection() ?>
