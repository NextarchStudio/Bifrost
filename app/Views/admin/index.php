<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
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
        <tr><th>Wannabe-ID</th><th>Bruker</th><th>E-post</th><th>Roller</th><th>Handling</th></tr>
        <?php foreach ($users as $user): ?>
            <tr>
                <td><?= esc((string) ($user->wannabe_id ?? '-')) ?></td>
                <td><?= esc((string) $user->name) ?></td>
                <td><?= esc((string) $user->email) ?></td>
                <td>
                    <?= esc(implode(', ', $roleNamesByUser[(int) $user->id] ?? [])) ?>
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
        <tr><th>Roller</th><td><?= esc(implode(', ', $inspectedUser['roleNames'])) ?></td></tr>
    </table>
</div>
<?php endif; ?>

<?php if (! empty($editUser)): ?>
<div class="card">
    <h3>Rediger brukerroller</h3>
    <div style="margin-bottom:.6rem;">
        <strong><?= esc((string) $editUser->name) ?></strong> (<?= esc((string) $editUser->email) ?>)
    </div>
    <form method="post" action="/admin/users/roles/<?= esc((string) $editUser->id) ?>">
        <?= csrf_field() ?>
        <select name="role_ids[]" multiple size="8">
            <?php foreach ($roles as $role): ?>
                <option value="<?= esc((string) $role['id']) ?>" <?= in_array((int) $role['id'], (array) $editRoleIds, true) ? 'selected' : '' ?>>
                    <?= esc((string) $role['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
        <button type="submit" class="btn btn-primary">Lagre roller</button>
    </form>
</div>
<?php endif; ?>
<?= $this->endSection() ?>
