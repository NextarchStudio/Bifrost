<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$competencyOptions = $competencyOptions ?? [];
$canManageSystemSettings = hasRole('developer');
?>
<style>
    .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
    }
    .settings-card {
        padding: 1rem;
        border: 1px solid #1f2a44;
        border-radius: 12px;
        background: rgba(15, 23, 42, .45);
    }
    .settings-card h4 {
        margin: 0 0 .75rem;
    }
    .settings-card p {
        margin: 0 0 .75rem;
        color: #94a3b8;
        font-size: .95rem;
    }
    .password-field {
        position: relative;
    }
    .password-field input {
        padding-right: 3rem;
    }
    .password-field__toggle {
        position: absolute;
        top: 50%;
        right: .65rem;
        transform: translateY(-50%);
        width: 2rem;
        height: 2rem;
        min-height: 2rem;
        padding: 0;
        border: 0;
        background: transparent !important;
        color: #94a3b8;
    }
</style>
<h1>Administrasjon</h1>
<div class="grid">
    <?php if ($canManageSystemSettings): ?>
    <div class="card">
        <h3>Systeminnstillinger</h3>
        <form method="post" action="/admin/settings">
            <?= csrf_field() ?>
            <div class="settings-grid">
                <div class="settings-card">
                    <h4>Generelt</h4>
                    <p>Navn, logo og hvilke innloggingsmetoder som skal være aktive.</p>
                    <input type="text" name="app_name" placeholder="Navn på løsningen" value="<?= esc((string) ($settings->app_name ?? 'Bifrost')) ?>">
                    <label><input type="checkbox" name="enable_local_login" value="1" <?= (int) $settings->enable_local_login === 1 ? 'checked' : '' ?>> Lokal innlogging</label>
                    <label><input type="checkbox" name="enable_keycloak_login" value="1" <?= (int) $settings->enable_keycloak_login === 1 ? 'checked' : '' ?>> SSO-innlogging</label>
                    <input type="url" name="logo_url" placeholder="Logo URL" value="<?= esc((string) ($settings->logo_url ?? '')) ?>">
                    <input type="url" name="favicon_url" placeholder="Favicon URL" value="<?= esc((string) ($settings->favicon_url ?? '')) ?>">
                </div>
                <div class="settings-card">
                    <h4>Keycloak / SSO</h4>
                    <p>OpenID Connect-innstillinger for ekstern innlogging.</p>
                    <input type="url" name="keycloak_base_url" placeholder="Keycloak base URL" value="<?= esc((string) ($settings->keycloak_base_url ?? '')) ?>">
                    <input type="text" name="keycloak_realm" placeholder="Keycloak realm" value="<?= esc((string) ($settings->keycloak_realm ?? '')) ?>">
                    <input type="text" name="keycloak_client_id" placeholder="Keycloak client ID" value="<?= esc((string) ($settings->keycloak_client_id ?? '')) ?>">
                    <div class="password-field">
                        <input type="password" name="keycloak_client_secret" placeholder="Keycloak client secret (la stå tomt for å beholde eksisterende)" autocomplete="new-password" data-password-input>
                        <button type="button" class="password-field__toggle" data-password-toggle aria-label="Vis passord">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                    <input type="url" name="keycloak_redirect_uri" placeholder="Keycloak redirect URI" value="<?= esc((string) ($settings->keycloak_redirect_uri ?? '')) ?>">
                </div>
                <div class="settings-card">
                    <h4>E-post / SMTP</h4>
                    <p>Brukes til invitasjoner, passordlenker og annen utsending.</p>
                    <input type="email" name="smtp_from_email" placeholder="SMTP fra e-post" value="<?= esc((string) ($settings->smtp_from_email ?? '')) ?>">
                    <input type="text" name="smtp_from_name" placeholder="SMTP fra navn" value="<?= esc((string) ($settings->smtp_from_name ?? '')) ?>">
                    <input type="text" name="smtp_host" placeholder="SMTP host" value="<?= esc((string) ($settings->smtp_host ?? '')) ?>">
                    <input type="number" min="1" name="smtp_port" placeholder="SMTP port" value="<?= esc((string) ($settings->smtp_port ?? '587')) ?>">
                    <input type="text" name="smtp_user" placeholder="SMTP brukernavn" value="<?= esc((string) ($settings->smtp_user ?? '')) ?>">
                    <div class="password-field">
                        <input type="password" name="smtp_pass" placeholder="SMTP passord (la stå tomt for å beholde eksisterende)" autocomplete="new-password" data-password-input>
                        <button type="button" class="password-field__toggle" data-password-toggle aria-label="Vis passord">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                    <select name="smtp_crypto">
                        <option value="" <?= empty($settings->smtp_crypto) ? 'selected' : '' ?>>Ingen kryptering</option>
                        <option value="tls" <?= (string) ($settings->smtp_crypto ?? 'tls') === 'tls' ? 'selected' : '' ?>>TLS</option>
                        <option value="ssl" <?= (string) ($settings->smtp_crypto ?? '') === 'ssl' ? 'selected' : '' ?>>SSL</option>
                    </select>
                </div>
                <div class="settings-card">
                    <h4>Eksterne API-er</h4>
                    <p>Ruting og oppslag mot andre systemer.</p>
                    <input type="text" name="osrm_base_url" placeholder="OSRM base URL, f.eks. http://localhost:5000" value="<?= esc((string) ($settings->osrm_base_url ?? 'http://localhost:5000')) ?>">
                    <input type="text" name="vegvesen_api_key" placeholder="Statens vegvesen API-nøkkel" value="<?= esc((string) ($settings->vegvesen_api_key ?? '')) ?>">
                </div>
                <div class="settings-card">
                    <h4>Crew-oppslag</h4>
                    <p>Oppslag på badge-scan eller Wannabe ID for navn, crew, rolle og bilde.</p>
                    <input type="url" name="crew_api_base_url" placeholder="Crew API base URL" value="<?= esc((string) ($settings->crew_api_base_url ?? 'https://tgbt-idam.gathering.org')) ?>">
                    <input type="text" name="crew_api_profile_endpoint" placeholder="Profil-endepunkt" value="<?= esc((string) ($settings->crew_api_profile_endpoint ?? '/v2/profile/')) ?>">
                    <input type="text" name="crew_api_picture_endpoint" placeholder="Bilde-endepunkt" value="<?= esc((string) ($settings->crew_api_picture_endpoint ?? '/v2/picture/')) ?>">
                    <div class="password-field">
                        <input type="password" name="crew_api_bearer_token" placeholder="Crew API bearer token (la stå tomt for å beholde eksisterende)" autocomplete="new-password" data-password-input>
                        <button type="button" class="password-field__toggle" data-password-toggle aria-label="Vis passord">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                    <p style="margin-top:.75rem;">Cachede crew-oppslag: <strong><?= esc((string) ($crewCacheEntries ?? 0)) ?></strong><br>Cache-år: <strong><?= esc((string) ($settings->crew_cache_year ?? date('Y'))) ?></strong></p>
                    <button
                        type="submit"
                        class="btn btn-danger"
                        formaction="/admin/crew-cache/clear"
                        formmethod="post"
                        onclick="return confirm('Tømme crew-cachen, slette alle brukere unntatt id 2, og nullstille crew-relaterte brukerdata?');"
                    >Tøm crew-cache og brukere</button>
                </div>
            </div>
            <button type="submit">Lagre innstillinger</button>
        </form>
    </div>
    <?php endif; ?>
    <div class="card">
        <h3>Opprett bruker</h3>
        <form method="post" action="/admin/users/create">
            <?= csrf_field() ?>
            <input name="first_name" placeholder="Fornavn" required>
            <input name="last_name" placeholder="Etternavn" required>
            <input name="email" type="email" placeholder="E-post" required>
            <input name="wannabe_id" type="number" placeholder="Wannabe ID">
            <p style="margin:.25rem 0 .75rem;color:#94a3b8;">Passord settes ikke her. Brukeren får en e-post med lenke for å velge passord selv.</p>
            <button type="submit">Opprett bruker og send e-post</button>
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
                <td><?= esc(implode(', ', (array) ($roleDisplayNamesByUser[(int) $user->id] ?? []))) ?></td>
                <td>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                        <a href="/admin/users/inspect/<?= esc((string) $user->id) ?>" class="btn btn-primary">Inspiser</a>
                        <a href="/admin/users/edit/<?= esc((string) $user->id) ?>" class="btn btn-primary">Rediger</a>
                        <form method="post" action="/admin/users/delete/<?= esc((string) $user->id) ?>" onsubmit="return confirm('Slette denne brukeren?');" style="margin:0;">
                            <?= csrf_field() ?>
                            <button type="submit" class="btn btn-danger">Slett</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<div class="card">
    <h3>Roller</h3>
    <form method="post" action="/admin/roles/create">
        <?= csrf_field() ?>
        <input name="name" placeholder="Lokalt rollenavn, f.eks. innkjop" required>
        <input name="display_name" placeholder="Visningsnavn, f.eks. Innkjøp">
        <input name="wannabe_role_name" placeholder="Rollenavn fra Wannabe, f.eks. Innkjøp">
        <button type="submit">Opprett rolle</button>
    </form>
    <hr>
    <table>
        <tr>
            <th>Teknisk navn</th>
            <th>Visningsnavn</th>
            <th>Wannabe-rollenavn</th>
            <th>Lagre</th>
            <th>Slett</th>
        </tr>
        <?php foreach (($roles ?? []) as $role): ?>
            <tr>
                <td>
                    <form method="post" action="/admin/roles/update/<?= esc((string) ($role['id'] ?? 0)) ?>" style="margin:0;">
                        <?= csrf_field() ?>
                        <input name="name" value="<?= esc((string) ($role['name'] ?? '')) ?>" required style="margin:0;">
                </td>
                <td>
                        <input name="display_name" value="<?= esc((string) ($role['display_name'] ?? '')) ?>" placeholder="F.eks. Transport Ansvarlig" style="margin:0;">
                </td>
                <td>
                        <input name="wannabe_role_name" value="<?= esc((string) ($role['wannabe_role_name'] ?? '')) ?>" placeholder="Kan stå tomt" style="margin:0;">
                </td>
                <td>
                        <button type="submit" class="btn btn-primary">Lagre</button>
                    </form>
                </td>
                <td>
                    <form method="post" action="/admin/roles/delete/<?= esc((string) ($role['id'] ?? 0)) ?>" data-confirm-message="Slette denne rollen? Dette fungerer bare hvis rollen ikke er i bruk." style="margin:0;">
                        <?= csrf_field() ?>
                        <button type="submit" class="btn btn-danger">Slett</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<div class="card">
    <h3>Crewtøy crew</h3>
    <form method="post" action="/admin/crew-clothing/crews/create">
        <?= csrf_field() ?>
        <input name="name" placeholder="Crew-navn" required>
        <input type="number" min="0" name="tshirt_max" placeholder="Maks t-skjorter per medlem" value="1" required>
        <input type="number" min="0" name="hoodie_max" placeholder="Maks gensere per medlem" value="1" required>
        <button type="submit">Opprett crew</button>
    </form>
    <hr>
    <table>
        <tr>
            <th>Crew</th>
            <th>Medlemmer</th>
            <th>Maks t-skjorter per medlem</th>
            <th>Maks gensere per medlem</th>
            <th>Lagre</th>
        </tr>
        <?php foreach (($crewClothingCrews ?? []) as $crewClothingCrew): ?>
            <tr>
                <td>
                    <form method="post" action="/admin/crew-clothing/crews/update/<?= esc((string) ($crewClothingCrew['id'] ?? 0)) ?>" style="margin:0;">
                        <?= csrf_field() ?>
                        <input name="name" value="<?= esc((string) ($crewClothingCrew['name'] ?? '')) ?>" required style="margin:0;">
                </td>
                <td><?= esc((string) ($crewClothingCrew['members_total'] ?? 0)) ?></td>
                <td><input type="number" min="0" name="tshirt_max" value="<?= esc((string) ($crewClothingCrew['tshirt_max'] ?? 0)) ?>" required style="margin:0;"></td>
                <td><input type="number" min="0" name="hoodie_max" value="<?= esc((string) ($crewClothingCrew['hoodie_max'] ?? 0)) ?>" required style="margin:0;"></td>
                <td>
                        <button type="submit" class="btn btn-primary">Lagre</button>
                    </form>
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
        <tr><th>Roller</th><td><?= esc(implode(', ', (array) ($inspectedUser['roleDisplayNames'] ?? []))) ?></td></tr>
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
                    <span><?= esc((string) (($role['display_name'] ?? '') !== '' ? $role['display_name'] : $role['name'])) ?></span>
                </label>
            <?php endforeach; ?>
        </div>
        <button type="submit" class="btn btn-primary">Lagre roller</button>
    </form>
    <form method="post" action="/admin/users/competencies/<?= esc((string) $editUser->id) ?>" style="margin-top:.9rem;">
        <?= csrf_field() ?>
        <h4 style="margin:0 0 .75rem;">Sertifikater og kompetanse</h4>
        <?php if (empty($editUser->wannabe_id)): ?>
            <p style="margin:0;color:#94a3b8;">Brukeren må ha Wannabe ID før sertifikater kan lagres.</p>
        <?php else: ?>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;">
                <?php foreach ($competencyOptions as $groupLabel => $options): ?>
                    <div style="padding:.75rem;border:1px solid #1f2a44;border-radius:8px;">
                        <strong><?= esc((string) $groupLabel) ?></strong>
                        <div style="display:flex;flex-direction:column;gap:.45rem;margin-top:.6rem;">
                            <?php foreach ($options as $code => $label): ?>
                                <label style="display:flex;align-items:center;gap:.45rem;">
                                    <input
                                        type="checkbox"
                                        name="competencies[<?= esc((string) $code) ?>]"
                                        value="1"
                                        <?= ! empty($editCompetencies[$code]) ? 'checked' : '' ?>
                                        style="width:auto;margin:0;">
                                    <span><?= esc((string) $label) ?></span>
                                </label>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            <p style="margin:.65rem 0 0;color:#94a3b8;">KDO lagres ikke her. KDO bekreftes per kjøretøy ved utlån.</p>
            <button type="submit" class="btn btn-primary">Lagre sertifikater</button>
        <?php endif; ?>
    </form>
    <form method="post" action="/admin/users/delete/<?= esc((string) $editUser->id) ?>" onsubmit="return confirm('Slette denne brukeren?');" style="margin-top:.9rem;">
        <?= csrf_field() ?>
        <button type="submit" class="btn btn-danger">Slett bruker</button>
    </form>
</div>
<?php endif; ?>
<script>
(() => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const wrapper = button.closest('.password-field');
            const input = wrapper ? wrapper.querySelector('[data-password-input]') : null;
            const icon = button.querySelector('i');
            if (!input) return;

            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.setAttribute('aria-label', reveal ? 'Skjul passord' : 'Vis passord');
            if (icon) {
                icon.className = reveal ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            }
        });
    });
})();
</script>
<?= $this->endSection() ?>
