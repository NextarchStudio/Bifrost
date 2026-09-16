<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$competencyRequirementOptions = $competencyRequirementOptions ?? [];
$competencyOverrideOptions = $competencyOverrideOptions ?? [];
$competencyOptions = $competencyOptions ?? [];
$competencyLabel = static fn (string $code): string => $competencyRequirementOptions[$code] ?? mb_strtoupper($code);
?>
<h1>Kjøretøy</h1>

<div class="grid">
    <?php if ($canCreateVehicles ?? false): ?>
    <div class="card">
        <h3>Nytt kjøretøy</h3>
        <form method="post" action="/vehicles/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Navn på kjøretøy" required value="<?= esc(old('name') ?? '') ?>">
            <input name="registration_number" placeholder="Registreringsnummer" required value="<?= esc(old('registration_number') ?? '') ?>">
            <select name="competency_requirement" required>
                <?php foreach ($competencyRequirementOptions as $code => $label): ?>
                    <option value="<?= esc((string) $code) ?>" <?= old('competency_requirement', 'none') === $code ? 'selected' : '' ?>><?= esc((string) $label) ?></option>
                <?php endforeach; ?>
            </select>
            <select name="competency_override_requirement" data-role="competency-override">
                <?php foreach ($competencyOverrideOptions as $code => $label): ?>
                    <option value="<?= esc((string) $code) ?>" <?= old('competency_override_requirement', '') === $code ? 'selected' : '' ?>><?= esc((string) $label) ?></option>
                <?php endforeach; ?>
            </select>
            <label style="display:flex;align-items:center;gap:.45rem;">
                <input type="checkbox" name="vegvesen_exempt" value="1" <?= old('vegvesen_exempt') ? 'checked' : '' ?> style="width:auto;margin:0;">
                <span>Fiktivt regnr / unntatt Statens vegvesen</span>
            </label>
            <select name="odometer_mode" data-role="odometer-mode" required>
                <option value="tracked" <?= old('odometer_mode', 'tracked') === 'tracked' ? 'selected' : '' ?>>Har kilometerstand</option>
                <option value="exempt" <?= old('odometer_mode') === 'exempt' ? 'selected' : '' ?>>Unntatt kilometerstand</option>
            </select>
            <input type="number" min="0" name="current_odometer" data-role="current-odometer" placeholder="Kilometerstand ved registrering" value="<?= esc(old('current_odometer') ?? '') ?>">
            <textarea name="notes" placeholder="Notater"><?= esc(old('notes') ?? '') ?></textarea>
            <button type="submit">Opprett kjøretøy</button>
        </form>
        <div class="modal fade" id="vehicleCompetencyModalIssueCopy" tabindex="-1" aria-hidden="true" data-static-modal hidden>
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" data-role="vehicle-competency-title">Bekreft kompetanse</h5>
                    </div>
                    <div class="modal-body">
                        <p data-role="vehicle-competency-message" style="margin-top:0;"></p>
                        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;">
                            <?php foreach ($competencyOptions as $group => $options): ?>
                                <div class="card" style="margin:0;padding:1rem;">
                                    <strong>
                                        <?php
                                        echo esc(match ($group) {
                                            'kompetansebevis' => 'Kompetansebevis',
                                            'forerkort' => 'Førerkort',
                                            'opplaering' => 'Dokumentert opplæring',
                                            default => ucfirst((string) $group),
                                        });
                                        ?>
                                    </strong>
                                    <div style="display:flex;flex-direction:column;gap:.4rem;margin-top:.6rem;">
                                        <?php foreach ($options as $code => $label): ?>
                                            <label style="display:flex;align-items:center;gap:.45rem;">
                                                <input type="checkbox" value="<?= esc((string) $code) ?>" data-role="competency-checkbox" style="width:auto;margin:0;">
                                                <span><?= esc((string) $label) ?></span>
                                            </label>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <p style="margin:.85rem 0 0;color:#94a3b8;" data-role="vehicle-competency-help">Bekreft at førerkort, kompetansebevis eller dokumentert opplæring er kontrollert før utlån.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-role="vehicle-competency-cancel">Avbryt</button>
                        <button type="button" class="btn btn-primary" data-role="vehicle-competency-confirm">Bekreft og lån ut</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <?php if ($canManageLoans ?? false): ?>
    <div class="card">
        <h3>Lån ut kjøretøy</h3>
        <form method="post" action="/vehicles/issue" data-role="vehicle-issue-form">
            <?= csrf_field() ?>
            <select name="vehicle_id" data-role="vehicle-select" required>
                <option value="">Velg kjøretøy</option>
                <?php foreach ($vehicles as $vehicle): ?>
                    <?php if ((string) ($vehicle->status ?? '') !== 'available') continue; ?>
                    <option value="<?= esc((string) $vehicle->id) ?>" data-competency-requirement="<?= esc((string) ($vehicle->competency_requirement ?? 'none')) ?>" data-competency-override="<?= esc((string) ($vehicle->competency_override_requirement ?? '')) ?>" <?= old('vehicle_id') == $vehicle->id ? 'selected' : '' ?>>
                        <?= esc((string) $vehicle->name) ?> (<?= esc((string) $vehicle->registration_number) ?>)
                    </option>
                <?php endforeach; ?>
            </select>
            <input type="text" name="wannabe_id" data-role="wannabe-id" placeholder="Wannabe ID eller badge-scan" required value="<?= esc(old('wannabe_id') ?? '') ?>">
            <div data-role="wannabe-profile" style="margin:-.25rem 0 .9rem;padding:.75rem 1rem;border:1px solid #1f2a44;border-radius:10px;background:rgba(15,23,42,.35);display:none;">
                <div style="color:#e2e8f0;"><strong style="color:#e2e8f0;">Navn:</strong> <span data-role="wannabe-profile-name" style="color:#f8fafc;">-</span></div>
                <div data-role="wannabe-profile-meta" style="margin-top:.25rem;color:#cbd5e1;"></div>
            </div>
            <div data-role="wannabe-profile-message" style="margin:-.25rem 0 .9rem;color:#94a3b8;font-size:.92rem;"></div>
            <div data-role="competency-hidden-inputs"></div>
            <button type="submit">Registrer utlån</button>
        </form>
        <div class="modal fade" id="vehicleCompetencyModal" tabindex="-1" aria-hidden="true" data-static-modal hidden>
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" data-role="vehicle-competency-title">Bekreft kompetanse</h5>
                    </div>
                    <div class="modal-body">
                        <p data-role="vehicle-competency-message" style="margin-top:0;"></p>
                        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;">
                            <?php foreach ($competencyOptions as $group => $options): ?>
                                <div class="card" style="margin:0;padding:1rem;">
                                    <strong>
                                        <?php
                                        echo esc(match ($group) {
                                            'kompetansebevis' => 'Kompetansebevis',
                                            'forerkort' => 'Førerkort',
                                            'opplaering' => 'Dokumentert opplæring',
                                            default => ucfirst((string) $group),
                                        });
                                        ?>
                                    </strong>
                                    <div style="display:flex;flex-direction:column;gap:.4rem;margin-top:.6rem;">
                                        <?php foreach ($options as $code => $label): ?>
                                            <label style="display:flex;align-items:center;gap:.45rem;">
                                                <input type="checkbox" value="<?= esc((string) $code) ?>" data-role="competency-checkbox" style="width:auto;margin:0;">
                                                <span><?= esc((string) $label) ?></span>
                                            </label>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <p style="margin:.85rem 0 0;color:#94a3b8;" data-role="vehicle-competency-help">Bekreft at førerkort, kompetansebevis eller dokumentert opplæring er kontrollert før utlån.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-role="vehicle-competency-cancel">Avbryt</button>
                        <button type="button" class="btn btn-primary" data-role="vehicle-competency-confirm">Bekreft og lån ut</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<div class="card">
    <h3>Kjøretøyliste</h3>
    <table>
        <tr><th>ID</th><th>Navn</th><th>Regnr</th><th>Kilometerstand</th><th>Max nyttelast</th><th>Krav</th><th>Status</th><th>Utlånt til</th><th>Handling</th></tr>
        <?php foreach ($vehicles as $vehicle): ?>
            <?php
            $name = trim((string) (($vehicle->wannabe_name ?? '') !== '' ? $vehicle->wannabe_name : (($vehicle->wannabe_first_name ?? '') . ' ' . ($vehicle->wannabe_last_name ?? ''))));
            $registrationNumber = (string) $vehicle->registration_number;
            $vegvesenUrl = 'https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/sjekk-kjoretoyopplysninger/?registreringsnummer=' . rawurlencode($registrationNumber);
            ?>
            <tr>
                <td><?= esc((string) $vehicle->id) ?></td>
                <?php $editFormId = 'vehicle-edit-' . (int) $vehicle->id; ?>
                <td>
                    <?php if ($canEditVehicles ?? false): ?>
                        <form id="<?= esc($editFormId) ?>" method="post" action="/vehicles/update/<?= esc((string) $vehicle->id) ?>" style="margin:0;">
                            <?= csrf_field() ?>
                            <input name="name" value="<?= esc((string) $vehicle->name) ?>" required>
                        </form>
                    <?php else: ?>
                        <?= esc((string) $vehicle->name) ?>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ($canEditVehicles ?? false): ?>
                        <?php if ((int) ($vehicle->vegvesen_exempt ?? 0) === 1): ?>
                            <input name="registration_number" value="<?= esc($registrationNumber) ?>" required form="<?= esc($editFormId) ?>">
                        <?php else: ?>
                            <a href="<?= esc($vegvesenUrl) ?>" target="_blank" rel="noopener noreferrer"><?= esc($registrationNumber) ?></a>
                            <input type="hidden" name="registration_number" value="<?= esc($registrationNumber) ?>" form="<?= esc($editFormId) ?>">
                        <?php endif; ?>
                        <label style="display:flex;align-items:center;gap:.45rem;margin-top:.45rem;">
                            <input type="checkbox" name="vegvesen_exempt" value="1" <?= (int) ($vehicle->vegvesen_exempt ?? 0) === 1 ? 'checked' : '' ?> form="<?= esc($editFormId) ?>" style="width:auto;margin:0;">
                            <span>Unntatt Vegvesen</span>
                        </label>
                    <?php else: ?>
                        <?php if ((int) ($vehicle->vegvesen_exempt ?? 0) === 1): ?>
                            <?= esc($registrationNumber) ?>
                        <?php else: ?>
                            <a href="<?= esc($vegvesenUrl) ?>" target="_blank" rel="noopener noreferrer"><?= esc($registrationNumber) ?></a>
                        <?php endif; ?>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ((int) ($vehicle->odometer_exempt ?? 0) === 1): ?>
                        Unntatt
                    <?php elseif ($vehicle->current_odometer !== null): ?>
                        <?= esc((string) $vehicle->current_odometer) ?> km
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ((int) ($vehicle->vegvesen_exempt ?? 0) === 1): ?>
                        Unntatt Vegvesen
                    <?php elseif ($vehicle->max_payload_kg !== null): ?>
                        <?= esc((string) $vehicle->max_payload_kg) ?> kg
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ($canEditVehicles ?? false): ?>
                        <select name="competency_requirement" required form="<?= esc($editFormId) ?>">
                            <?php foreach ($competencyRequirementOptions as $code => $label): ?>
                                <option value="<?= esc((string) $code) ?>" <?= (string) ($vehicle->competency_requirement ?? 'none') === (string) $code ? 'selected' : '' ?>><?= esc((string) $label) ?></option>
                            <?php endforeach; ?>
                        </select>
                        <select name="competency_override_requirement" data-role="competency-override" form="<?= esc($editFormId) ?>" style="margin-top:.45rem;">
                            <?php foreach ($competencyOverrideOptions as $code => $label): ?>
                                <option value="<?= esc((string) $code) ?>" <?= (string) ($vehicle->competency_override_requirement ?? '') === (string) $code ? 'selected' : '' ?>><?= esc((string) $label) ?></option>
                            <?php endforeach; ?>
                        </select>
                    <?php else: ?>
                        <?= esc($competencyLabel((string) ($vehicle->competency_requirement ?? 'none'))) ?>
                        <?php if (! empty($vehicle->competency_override_requirement)): ?>
                            <div style="color:#94a3b8;font-size:.85rem;">Overstyres av <?= esc($competencyLabel((string) $vehicle->competency_override_requirement)) ?></div>
                        <?php endif; ?>
                    <?php endif; ?>
                </td>
                <td><span class="badge <?= esc((string) $vehicle->status) ?>"><?= esc((string) $vehicle->status) ?></span></td>
                <td>
                    <?php if (! empty($vehicle->active_loan_id)): ?>
                        <?= esc((string) $vehicle->active_wannabe_id) ?><?= $name !== '' ? ' - ' . esc($name) : '' ?>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
                <td>
                    <div style="display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;">
                        <?php if (($canManageLoans ?? false) && ! empty($vehicle->active_loan_id)): ?>
                            <form method="post" action="/vehicles/return/<?= esc((string) $vehicle->active_loan_id) ?>" style="margin:0;">
                                <?= csrf_field() ?>
                                <button type="submit" style="margin:0;min-width:100px;">Returner</button>
                            </form>
                        <?php endif; ?>
                        <?php if ($canEditVehicles ?? false): ?>
                            <button type="submit" form="<?= esc($editFormId) ?>" style="margin:0;min-width:90px;">Lagre</button>
                            <form method="post" action="/vehicles/delete/<?= esc((string) $vehicle->id) ?>" style="margin:0;">
                                <?= csrf_field() ?>
                                <button class="btn-danger" type="submit" style="margin:0;min-width:90px;">Slett</button>
                            </form>
                        <?php endif; ?>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<script>
(() => {
    const createForm = document.querySelector('form[action="/vehicles/create"]');
    if (createForm) {
        const mode = createForm.querySelector('[data-role="odometer-mode"]');
        const odometer = createForm.querySelector('[data-role="current-odometer"]');
        const requirement = createForm.querySelector('[name="competency_requirement"]');
        const override = createForm.querySelector('[data-role="competency-override"]');

        if (mode && odometer) {
            const sync = () => {
                const tracked = mode.value !== 'exempt';
                odometer.disabled = !tracked;
                odometer.required = tracked;
                odometer.placeholder = tracked ? 'Kilometerstand ved registrering' : 'Unntatt kilometerstand';
                if (!tracked) {
                    odometer.value = '';
                }
            };

            mode.addEventListener('change', sync);
            sync();
        }

        if (requirement && override) {
            const syncOverride = () => {
                const enabled = requirement.value === 'kdo';
                override.disabled = !enabled;
                override.required = false;
                if (!enabled) {
                    override.value = '';
                }
            };

            requirement.addEventListener('change', syncOverride);
            syncOverride();
        }
    }

    document.querySelectorAll('form[action^="/vehicles/update/"]').forEach((form) => {
        const requirement = form.querySelector('[name="competency_requirement"]');
        const override = form.querySelector('[data-role="competency-override"]');
        if (!requirement || !override) {
            return;
        }

        const syncOverride = () => {
            const enabled = requirement.value === 'kdo';
            override.disabled = !enabled;
            override.required = false;
            if (!enabled) {
                override.value = '';
            }
        };

        requirement.addEventListener('change', syncOverride);
        syncOverride();
    });

    const issueForm = document.querySelector('[data-role="vehicle-issue-form"]');
    const modal = document.getElementById('vehicleCompetencyModal');
    if (!issueForm || !modal) {
        return;
    }

    const vehicleSelect = issueForm.querySelector('[data-role="vehicle-select"]');
    const wannabeInput = issueForm.querySelector('[data-role="wannabe-id"]');
    const wannabeProfileBox = issueForm.querySelector('[data-role="wannabe-profile"]');
    const wannabeProfileName = issueForm.querySelector('[data-role="wannabe-profile-name"]');
    const wannabeProfileMeta = issueForm.querySelector('[data-role="wannabe-profile-meta"]');
    const wannabeProfileMessage = issueForm.querySelector('[data-role="wannabe-profile-message"]');
    const hiddenInputs = issueForm.querySelector('[data-role="competency-hidden-inputs"]');
    const title = modal.querySelector('[data-role="vehicle-competency-title"]');
    const message = modal.querySelector('[data-role="vehicle-competency-message"]');
    const help = modal.querySelector('[data-role="vehicle-competency-help"]');
    const cancelButton = modal.querySelector('[data-role="vehicle-competency-cancel"]');
    const confirmButton = modal.querySelector('[data-role="vehicle-competency-confirm"]');
    const checkboxes = [...modal.querySelectorAll('[data-role="competency-checkbox"]')];
    const requirementLabels = <?= json_encode($competencyRequirementOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}' ?>;
    const requirementMeta = {
        kdo: {
            title: 'Bekreft dokumentert opplæring',
            message: 'Dette kjøretøyet har krav om dokumentert opplæring (KDO). Sjekk dokumentert opplæring før utlån.',
        },
        t1: {
            title: 'Sjekk kompetansebevis',
            message: 'Dette kjøretøyet krever kompetansebevis T1. Sjekk kompetansebevis før utlån.',
        },
        t2: {
            title: 'Sjekk kompetansebevis',
            message: 'Dette kjøretøyet krever kompetansebevis T2. Sjekk kompetansebevis før utlån.',
        },
        t3: {
            title: 'Sjekk kompetansebevis',
            message: 'Dette kjøretøyet krever kompetansebevis T3. Sjekk kompetansebevis før utlån.',
        },
        t4: {
            title: 'Sjekk kompetansebevis',
            message: 'Dette kjøretøyet krever kompetansebevis T4. Sjekk kompetansebevis før utlån.',
        },
        b: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse B. Sjekk førerkort før utlån.',
        },
        be: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse BE. Sjekk førerkort før utlån.',
        },
        c1: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse C1. Sjekk førerkort før utlån.',
        },
        c1e: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse C1E. Sjekk førerkort før utlån.',
        },
        c: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse C. Sjekk førerkort før utlån.',
        },
        ce: {
            title: 'Sjekk førerkort',
            message: 'Dette kjøretøyet krever førerkort klasse CE. Sjekk førerkort før utlån.',
        },
    };

    let pendingRequirement = 'none';
    let bypassSubmit = false;
    let cachedWannabeId = '';
    let cachedProfile = null;
    let crewLookupTimer = null;
    let activeCrewLookupController = null;
    let lastCrewLookupValue = '';
    let keepLoanFormFocusTimer = null;

    const focusWannabeInput = (selectText = false) => {
        if (!(wannabeInput instanceof HTMLInputElement)) {
            return;
        }

        wannabeInput.focus();
        if (selectText) {
            wannabeInput.select();
        }
    };

    const clearWannabeProfile = (message = '') => {
        if (wannabeProfileBox instanceof HTMLElement) {
            wannabeProfileBox.style.display = 'none';
        }
        if (wannabeProfileName instanceof HTMLElement) {
            wannabeProfileName.textContent = '-';
        }
        if (wannabeProfileMeta instanceof HTMLElement) {
            wannabeProfileMeta.textContent = '';
        }
        if (wannabeProfileMessage instanceof HTMLElement) {
            wannabeProfileMessage.textContent = message;
        }
    };

    const renderWannabeProfile = (payload) => {
        if (!(wannabeProfileBox instanceof HTMLElement) || !(wannabeProfileName instanceof HTMLElement) || !(wannabeProfileMeta instanceof HTMLElement)) {
            return;
        }

        const metaParts = [payload.nick, payload.crew, payload.role].filter((value) => String(value || '').trim() !== '');
        wannabeProfileName.textContent = payload.displayName || payload.name || '-';
        wannabeProfileMeta.textContent = metaParts.join(' · ');
        wannabeProfileBox.style.display = 'block';
        if (wannabeProfileMessage instanceof HTMLElement) {
            wannabeProfileMessage.textContent = '';
        }
    };

    const resetHiddenInputs = () => {
        if (hiddenInputs) {
            hiddenInputs.innerHTML = '';
        }
    };

    const selectedCompetencies = () => checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);

    const applyCompetencies = (competencies, kdoForVehicle = false) => {
        checkboxes.forEach((checkbox) => {
            checkbox.checked = checkbox.value === 'kdo' ? !!kdoForVehicle : !!competencies[checkbox.value];
        });
    };

    const openModal = (requirement, profile, overrideRequirement = '') => {
        const meta = requirementMeta[requirement] || {
            title: 'Bekreft kompetanse',
            message: `Dette kjøretøyet krever ${requirementLabels[requirement] || requirement.toUpperCase()}. Sjekk dokumentasjon før utlån.`,
        };
        pendingRequirement = requirement;
        title.textContent = meta.title;
        message.textContent = requirement === 'kdo' && overrideRequirement
            ? `${meta.message} ${requirementLabels[overrideRequirement] || overrideRequirement.toUpperCase()} kan overstyre KDO på dette kjøretøyet.`
            : meta.message;
        help.textContent = requirement === 'kdo'
            ? 'Bekreft at dokumentert opplæring er kontrollert før utlån.'
            : 'Bekreft at førerkort eller kompetansebevis er kontrollert før utlån.';
        applyCompetencies((profile && profile.competencies) || {}, !!(profile && profile.kdo_for_vehicle));
        modal.hidden = false;
        modal.style.display = 'block';
        modal.classList.add('show');
    };

    const closeModal = () => {
        modal.hidden = true;
        modal.style.display = 'none';
        modal.classList.remove('show');
        pendingRequirement = 'none';
    };

    const fetchProfile = async (wannabeId, vehicleId) => {
        if (cachedWannabeId === `${wannabeId}:${vehicleId}` && cachedProfile) {
            return cachedProfile;
        }

        const response = await fetch(`/vehicles/competencies/${encodeURIComponent(wannabeId)}?vehicle_id=${encodeURIComponent(vehicleId)}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!response.ok) {
            throw new Error('Kunne ikke hente kompetanseprofil.');
        }

        cachedProfile = await response.json();
        cachedWannabeId = `${wannabeId}:${vehicleId}`;
        return cachedProfile;
    };

    const fetchCrewProfile = async (wannabeId) => {
        if (wannabeId === '') {
            lastCrewLookupValue = '';
            clearWannabeProfile('');
            return;
        }

        if (wannabeId === lastCrewLookupValue) {
            return;
        }

        lastCrewLookupValue = wannabeId;
        clearWannabeProfile('Slår opp navn...');

        if (activeCrewLookupController instanceof AbortController) {
            activeCrewLookupController.abort();
        }
        activeCrewLookupController = new AbortController();

        try {
            const response = await fetch(`/vehicles/profile-lookup?q=${encodeURIComponent(wannabeId)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: activeCrewLookupController.signal,
            });
            const payload = await response.json();

            if (!response.ok || !payload.ok) {
                clearWannabeProfile(payload.message || 'Fant ikke navn for denne brukeren.');
                return;
            }

            if (wannabeInput instanceof HTMLInputElement && String(payload.id || '').trim() !== '') {
                wannabeInput.value = String(payload.id).trim();
                lastCrewLookupValue = String(payload.id).trim();
            }
            renderWannabeProfile(payload);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }

            clearWannabeProfile('Kunne ikke hente navn akkurat nå.');
        }
    };

    const submitWithBypass = () => {
        bypassSubmit = true;
        issueForm.submit();
    };

    confirmButton?.addEventListener('click', () => {
        const competencies = selectedCompetencies();
        if (!competencies.includes(pendingRequirement)) {
            window.alert(`Du må bekrefte ${requirementLabels[pendingRequirement] || pendingRequirement.toUpperCase()} før utlån.`);
            return;
        }

        resetHiddenInputs();
        if (hiddenInputs) {
            const confirmed = document.createElement('input');
            confirmed.type = 'hidden';
            confirmed.name = 'competency_confirmed';
            confirmed.value = '1';
            hiddenInputs.appendChild(confirmed);

            competencies.forEach((code) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'competencies[]';
                input.value = code;
                hiddenInputs.appendChild(input);
            });
        }

        closeModal();
        submitWithBypass();
    });

    cancelButton?.addEventListener('click', closeModal);

    vehicleSelect?.addEventListener('change', () => {
        if (!(wannabeInput instanceof HTMLInputElement)) {
            return;
        }

        // After picking a vehicle, move focus to the badge/Wannabe field so scanner input
        // lands in the loan form instead of other focusable UI in the header.
        window.setTimeout(() => {
            focusWannabeInput(true);
        }, 0);
    });

    wannabeInput?.addEventListener('input', () => {
        cachedWannabeId = '';
        cachedProfile = null;
        resetHiddenInputs();

        if (crewLookupTimer !== null) {
            window.clearTimeout(crewLookupTimer);
        }
        crewLookupTimer = window.setTimeout(() => {
            fetchCrewProfile((wannabeInput?.value || '').trim());
        }, 250);
    });

    wannabeInput?.addEventListener('change', () => {
        fetchCrewProfile((wannabeInput?.value || '').trim());
    });

    if (wannabeInput instanceof HTMLInputElement) {
        wannabeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
        window.setTimeout(() => {
            if (document.activeElement === document.body || document.activeElement === null) {
                focusWannabeInput();
            }
        }, 0);
        fetchCrewProfile(wannabeInput.value.trim());
    }

    issueForm.addEventListener('pointerdown', () => {
        if (keepLoanFormFocusTimer !== null) {
            window.clearTimeout(keepLoanFormFocusTimer);
        }

        keepLoanFormFocusTimer = window.setTimeout(() => {
            if (!(document.activeElement instanceof HTMLElement) || !issueForm.contains(document.activeElement)) {
                focusWannabeInput();
            }
        }, 0);
    });

    document.addEventListener('app:rfid-scan', (event) => {
        if (!(event instanceof CustomEvent) || !(wannabeInput instanceof HTMLInputElement)) {
            return;
        }

        const scanned = String(event.detail?.raw || '').trim();
        if (scanned === '') {
            return;
        }

        focusWannabeInput();
        wannabeInput.value = scanned;
        fetchCrewProfile(scanned);
    });

    issueForm.addEventListener('submit', async (event) => {
        if (bypassSubmit) {
            bypassSubmit = false;
            return;
        }

        resetHiddenInputs();

        const selectedVehicle = vehicleSelect?.selectedOptions[0];
        const requirement = (selectedVehicle?.getAttribute('data-competency-requirement') || 'none').toLowerCase();
        const overrideRequirement = (selectedVehicle?.getAttribute('data-competency-override') || '').toLowerCase();
        const vehicleId = (selectedVehicle?.value || '').trim();
        const wannabeId = (wannabeInput?.value || '').trim();

        if (requirement === 'none') {
            return;
        }

        event.preventDefault();

        if (wannabeId === '') {
            window.alert('Fyll inn Wannabe ID før utlån.');
            return;
        }
        if (vehicleId === '') {
            window.alert('Velg kjøretøy før utlån.');
            return;
        }

        try {
            const profile = await fetchProfile(wannabeId, vehicleId);
            if (
                (requirement === 'kdo' && (profile?.kdo_for_vehicle || (overrideRequirement && profile?.competencies?.[overrideRequirement])))
                || (requirement !== 'kdo' && profile?.competencies?.[requirement])
            ) {
                submitWithBypass();
                return;
            }

            openModal(requirement, profile || { competencies: {} }, overrideRequirement);
        } catch (error) {
            openModal(requirement, { competencies: {} }, overrideRequirement);
        }
    });
})();
</script>
<?= $this->endSection() ?>
