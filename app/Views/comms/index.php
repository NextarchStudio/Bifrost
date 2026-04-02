<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Samband</h1>
<style>
    .set-picker {
        max-height: 260px;
        overflow: auto;
        border: 1px solid #1f2a44;
        padding: .5rem;
        border-radius: 10px;
        color: #e2e8f0;
    }
    .set-picker-row {
        display: grid;
        grid-template-columns: 28px minmax(160px, 1fr) 130px 90px;
        gap: .7rem;
        align-items: center;
        padding: .35rem .2rem;
        border-bottom: 1px solid #1f2a44;
    }
    .set-picker-row:last-child {
        border-bottom: 0;
    }
    .set-picker-row input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin: 0 auto;
    }
    .set-picker-meta {
        color: #94a3b8;
        font-size: .9rem;
    }
    .set-picker-row input[type="number"] {
        margin: 0;
        width: 100%;
    }
    .set-edit-row {
        display: none;
    }
    .set-edit-row.is-open {
        display: table-row;
    }
    .loan-adjust-row {
        background: rgba(15, 23, 42, .45);
    }
    .loan-adjust-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: 2fr 1.3fr;
        align-items: start;
    }
    .loan-adjust-items {
        display: grid;
        gap: .75rem;
    }
    .loan-adjust-item {
        display: grid;
        gap: .5rem;
        grid-template-columns: minmax(180px, 1fr) 120px;
        align-items: center;
        padding: .75rem;
        border: 1px solid #1f2a44;
        border-radius: 12px;
    }
    .loan-adjust-item input[type="number"] {
        margin: 0;
        width: 100%;
    }
    .loan-adjust-meta {
        color: #94a3b8;
        font-size: .9rem;
    }
    .loan-adjust-box {
        border: 1px solid #1f2a44;
        border-radius: 12px;
        padding: 1rem;
    }
    .loan-adjust-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
    }
    .loan-adjust-actions button {
        margin: 0;
    }
    @media (max-width: 900px) {
        .loan-adjust-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

<div class="grid">
    <div class="card">
        <h3>Nytt samband / tilbehør</h3>
        <form method="post" action="/samband/item/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Navn" required>
            <select name="type" required>
                <option value="samband">Samband</option>
                <option value="tilbehor">Tilbehør</option>
            </select>
            <input name="serial_number" placeholder="Serienummer (valgfritt)">
            <input type="number" min="1" name="quantity" value="1" placeholder="Antall" required>
            <textarea name="notes" placeholder="Notat (valgfritt)"></textarea>
            <button type="submit">Opprett</button>
        </form>
    </div>

    <div class="card">
        <h3>Opprett sambandssett</h3>
        <form method="post" action="/samband/set/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Navn på sett" required>
            <textarea name="notes" placeholder="Notat (valgfritt)"></textarea>
            <div class="set-picker">
                <?php foreach ($items as $item): ?>
                    <div class="set-picker-row">
                        <input type="checkbox" name="items[<?= esc((string) $item['id']) ?>][selected]" value="1">
                        <span><strong><?= esc((string) $item['name']) ?></strong> <span class="set-picker-meta">(<?= esc((string) $item['type']) ?>)</span></span>
                        <span class="set-picker-meta">tilgjengelig: <?= esc((string) $item['quantity']) ?></span>
                        <input type="number" min="1" value="1" name="items[<?= esc((string) $item['id']) ?>][quantity]">
                    </div>
                <?php endforeach; ?>
            </div>
            <button type="submit">Lagre sett</button>
        </form>
    </div>
</div>

<div class="card">
    <h3>Eksisterende sambandssett</h3>
    <?php if ($sets === []): ?>
        <p style="margin:0;">Ingen sambandssett er opprettet ennå.</p>
    <?php else: ?>
        <table>
            <tr><th>Navn</th><th>Innhold</th><th>Handling</th></tr>
            <?php foreach ($sets as $set): ?>
                <?php
                $selectedItems = [];
                foreach ((array) ($set['items'] ?? []) as $setItem) {
                    $selectedItems[(int) $setItem['item_id']] = (int) $setItem['quantity'];
                }
                ?>
                <tr>
                    <td><?= esc((string) $set['name']) ?></td>
                    <td><?= esc((string) ($set['items_summary'] ?? '-')) ?></td>
                    <td>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                            <button type="button" class="btn btn-primary js-set-toggle" data-target="set-edit-<?= esc((string) $set['id']) ?>" style="margin:0;">Endre</button>
                            <form method="post" action="/samband/set/delete/<?= esc((string) $set['id']) ?>" style="margin:0;">
                                <?= csrf_field() ?>
                                <button type="submit" class="btn btn-danger" style="margin:0;" <?= ((int) ($set['active_loans'] ?? 0) > 0) ? 'disabled title="Kan ikke slettes mens settet er utlånt"' : '' ?>>Slett</button>
                            </form>
                        </div>
                    </td>
                </tr>
                <tr id="set-edit-<?= esc((string) $set['id']) ?>" class="set-edit-row">
                    <td colspan="3">
                        <form method="post" action="/samband/set/update/<?= esc((string) $set['id']) ?>" style="border:1px solid #1f2a44;border-radius:12px;padding:1rem;margin-top:.5rem;">
                            <?= csrf_field() ?>
                            <input name="name" placeholder="Navn på sett" value="<?= esc((string) $set['name']) ?>" required>
                            <textarea name="notes" placeholder="Notat (valgfritt)"><?= esc((string) ($set['notes'] ?? '')) ?></textarea>
                            <div class="set-picker">
                                <?php foreach ($items as $item): ?>
                                    <?php $selectedQuantity = $selectedItems[(int) $item['id']] ?? 1; ?>
                                    <div class="set-picker-row">
                                        <input
                                            type="checkbox"
                                            name="items[<?= esc((string) $item['id']) ?>][selected]"
                                            value="1"
                                            <?= array_key_exists((int) $item['id'], $selectedItems) ? 'checked' : '' ?>>
                                        <span><strong><?= esc((string) $item['name']) ?></strong> <span class="set-picker-meta">(<?= esc((string) $item['type']) ?>)</span></span>
                                        <span class="set-picker-meta">tilgjengelig: <?= esc((string) $item['quantity']) ?></span>
                                        <input type="number" min="1" value="<?= esc((string) $selectedQuantity) ?>" name="items[<?= esc((string) $item['id']) ?>][quantity]">
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <button type="submit">Lagre endringer</button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
        </table>
    <?php endif; ?>
</div>

<div class="grid">
    <div class="card">
        <h3>Registrer samband-lån</h3>
        <form method="post" action="/samband/issue">
            <?= csrf_field() ?>
            <input type="text" name="wannabe_id" data-role="wannabe-id" placeholder="Wannabe ID eller badge-scan" required>
            <div data-role="wannabe-profile" style="margin:-.25rem 0 .9rem;padding:.75rem 1rem;border:1px solid #1f2a44;border-radius:10px;background:rgba(15,23,42,.35);display:none;">
                <div style="color:#e2e8f0;"><strong style="color:#e2e8f0;">Navn:</strong> <span data-role="wannabe-profile-name" style="color:#f8fafc;">-</span></div>
                <div data-role="wannabe-profile-meta" style="margin-top:.25rem;color:#cbd5e1;"></div>
            </div>
            <div data-role="wannabe-profile-message" style="margin:-.25rem 0 .9rem;color:#94a3b8;font-size:.92rem;"></div>
            <select name="loan_type" id="loanType" required>
                <option value="item">Enkeltutstyr</option>
                <option value="set">Sambandssett</option>
            </select>
            <div id="itemLoanFields">
                <select name="item_id">
                    <option value="">Velg utstyr</option>
                    <?php foreach ($items as $item): ?>
                        <option value="<?= esc((string) $item['id']) ?>"><?= esc((string) $item['name']) ?> (tilgjengelig: <?= esc((string) $item['quantity']) ?>)</option>
                    <?php endforeach; ?>
                </select>
                <input type="number" min="1" value="1" name="quantity" placeholder="Antall">
            </div>
            <div id="setLoanFields" style="display:none;">
                <select name="set_id">
                    <option value="">Velg sambandssett</option>
                    <?php foreach ($sets as $set): ?>
                        <option value="<?= esc((string) $set['id']) ?>"><?= esc((string) $set['name']) ?><?= ! empty($set['items_summary']) ? ' - ' . esc((string) $set['items_summary']) : '' ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <textarea name="notes" placeholder="Notat (valgfritt)"></textarea>
            <button type="submit">Registrer lån</button>
        </form>
    </div>

    <div class="card">
        <h3>Samband / tilbehør</h3>
        <table>
            <tr><th>ID</th><th>Navn</th><th>Type</th><th>Serienr</th><th>Antall tilgjengelig</th><th>Status</th></tr>
            <?php foreach ($items as $item): ?>
                <tr>
                    <td><?= esc((string) $item['id']) ?></td>
                    <td><?= esc((string) $item['name']) ?></td>
                    <td><?= esc((string) $item['type']) ?></td>
                    <td><?= esc((string) ($item['serial_number'] ?? '-')) ?></td>
                    <td><?= esc((string) $item['quantity']) ?></td>
                    <td><span class="badge <?= esc((string) $item['status']) ?>"><?= esc((string) $item['status']) ?></span></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
</div>

<div class="card">
    <h3>Aktive samband-lån</h3>
    <?php if ($activeLoans === []): ?>
        <p style="margin:0;">Ingen aktive samband-lån akkurat nå.</p>
    <?php else: ?>
    <div data-live-search-root data-live-search-limit="10">
    <form data-live-search-form onsubmit="return false;" style="margin:0 0 1rem;">
        <input
            type="search"
            data-live-search-input
            placeholder="Søk på wannabe ID, navn eller innhold"
            aria-label="Søk i aktive samband-lån">
    </form>
    <div data-live-search-summary style="margin:-.35rem 0 1rem;color:#94a3b8;font-size:.95rem;"></div>
    <table>
        <tr><th>ID</th><th>Wannabe ID</th><th>Navn</th><th>Type</th><th>Innhold</th><th>Antall ting</th><th>Utstedt</th><th></th></tr>
        <tbody data-live-search-body>
        <?php foreach ($activeLoans as $loan): ?>
            <?php
            $name = trim((string) (($loan['wannabe_name'] ?? '') !== '' ? $loan['wannabe_name'] : (($loan['wannabe_first_name'] ?? '') . ' ' . ($loan['wannabe_last_name'] ?? ''))));
            $loanType = ! empty($loan['set_id']) ? 'Sett: ' . (string) ($loan['set_name'] ?? '-') : 'Enkeltutstyr';
            $searchText = mb_strtolower(trim(implode(' ', [
                (string) $loan['id'],
                (string) $loan['wannabe_id'],
                $name,
                $loanType,
                (string) ($loan['items_summary'] ?? '-'),
                (string) ($loan['total_items'] ?? 0),
                format_norwegian_datetime($loan['issued_at']),
            ])));
            ?>
            <tr data-live-search-row data-search-text="<?= esc($searchText) ?>">
                <td><?= esc((string) $loan['id']) ?></td>
                <td><?= esc((string) $loan['wannabe_id']) ?></td>
                <td><?= esc($name !== '' ? $name : '-') ?></td>
                <td><?= esc($loanType) ?></td>
                <td><?= esc((string) ($loan['items_summary'] ?? '-')) ?></td>
                <td><?= esc((string) ($loan['total_items'] ?? 0)) ?></td>
                <td><?= esc(format_norwegian_datetime($loan['issued_at'])) ?></td>
                <td>
                    <button type="button" class="btn btn-primary js-set-toggle" data-target="loan-adjust-<?= esc((string) $loan['id']) ?>" style="margin:0;">Retur / bytte</button>
                </td>
            </tr>
            <tr id="loan-adjust-<?= esc((string) $loan['id']) ?>" class="set-edit-row loan-adjust-row">
                <td colspan="8">
                    <form method="post" action="/samband/return/<?= esc((string) $loan['id']) ?>" style="margin-top:.5rem;">
                        <?= csrf_field() ?>
                        <div class="loan-adjust-grid">
                            <div class="loan-adjust-box">
                                <h4 style="margin-top:0;">Delretur</h4>
                                <div class="loan-adjust-items">
                                    <?php foreach ((array) ($loan['loan_items'] ?? []) as $loanItem): ?>
                                        <div class="loan-adjust-item">
                                            <div>
                                                <strong><?= esc((string) $loanItem['item_name']) ?></strong>
                                                <div class="loan-adjust-meta">
                                                    <?= esc((string) ($loanItem['item_type'] ?? '')) ?>
                                                    <?= ! empty($loanItem['serial_number']) ? ' - serienr: ' . esc((string) $loanItem['serial_number']) : '' ?>
                                                    <?= ' - utlånt: ' . esc((string) $loanItem['quantity']) ?>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="<?= esc((string) $loanItem['quantity']) ?>"
                                                value="0"
                                                name="return_quantities[<?= esc((string) $loanItem['item_id']) ?>]"
                                                placeholder="Retur">
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>

                            <div class="loan-adjust-box">
                                <h4 style="margin-top:0;">Bytt ut med noe annet</h4>
                                <select name="replacement_item_id">
                                    <option value="">Ingen erstatning</option>
                                    <?php foreach ($items as $item): ?>
                                        <option value="<?= esc((string) $item['id']) ?>" <?= ((int) $item['quantity'] < 1) ? 'disabled' : '' ?>>
                                            <?= esc((string) $item['name']) ?> (tilgjengelig: <?= esc((string) $item['quantity']) ?>)
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <input type="number" min="0" value="0" name="replacement_quantity" placeholder="Antall erstatning">
                                <div class="loan-adjust-meta">Legg inn antall hvis noe skal byttes ut. La stå på 0 hvis du bare skal returnere deler av lånet.</div>
                            </div>
                        </div>

                        <div class="loan-adjust-actions">
                            <button type="submit">Lagre retur / bytte</button>
                        </div>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <p data-live-search-empty style="display:none;margin:1rem 0 0;color:#94a3b8;">Ingen samband-lån matcher søket ditt.</p>
    </div>
    <?php endif; ?>
</div>

<script>
(() => {
    const type = document.getElementById('loanType');
    const itemFields = document.getElementById('itemLoanFields');
    const setFields = document.getElementById('setLoanFields');
    const issueForm = document.querySelector('form[action="/samband/issue"]');
    const activeCommsLoansSearchInput = document.querySelector('[data-live-search-root] [data-live-search-input]');
    const wannabeInput = issueForm?.querySelector('[data-role="wannabe-id"]');
    const wannabeProfileBox = issueForm?.querySelector('[data-role="wannabe-profile"]');
    const wannabeProfileName = issueForm?.querySelector('[data-role="wannabe-profile-name"]');
    const wannabeProfileMeta = issueForm?.querySelector('[data-role="wannabe-profile-meta"]');
    const wannabeProfileMessage = issueForm?.querySelector('[data-role="wannabe-profile-message"]');
    let wannabeLookupTimer = null;
    let activeWannabeLookupController = null;
    let activeCommsSearchLookupController = null;
    let lastWannabeLookupValue = '';

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

    const fetchWannabeProfile = async (wannabeId) => {
        if (wannabeId === '') {
            lastWannabeLookupValue = '';
            clearWannabeProfile('');
            return;
        }

        if (wannabeId === lastWannabeLookupValue) {
            return;
        }

        lastWannabeLookupValue = wannabeId;
        clearWannabeProfile('Slår opp navn...');

        if (activeWannabeLookupController instanceof AbortController) {
            activeWannabeLookupController.abort();
        }
        activeWannabeLookupController = new AbortController();

        try {
            const response = await fetch(`/samband/profile-lookup?q=${encodeURIComponent(wannabeId)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: activeWannabeLookupController.signal,
            });
            const payload = await response.json();

            if (!response.ok || !payload.ok) {
                clearWannabeProfile(payload.message || 'Fant ikke navn for denne brukeren.');
                return;
            }

            if (wannabeInput instanceof HTMLInputElement && String(payload.id || '').trim() !== '') {
                wannabeInput.value = String(payload.id).trim();
                lastWannabeLookupValue = String(payload.id).trim();
            }
            renderWannabeProfile(payload);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }

            clearWannabeProfile('Kunne ikke hente navn akkurat nå.');
        }
    };

    const applyActiveCommsSearchValue = (value) => {
        if (!(activeCommsLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        activeCommsLoansSearchInput.value = value;
        activeCommsLoansSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const lookupActiveCommsLoansByBadge = async (query) => {
        const normalized = String(query || '').trim();
        if (normalized === '' || !(activeCommsLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        if (activeCommsSearchLookupController instanceof AbortController) {
            activeCommsSearchLookupController.abort();
        }
        activeCommsSearchLookupController = new AbortController();

        try {
            const response = await fetch(`/samband/profile-lookup?q=${encodeURIComponent(normalized)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: activeCommsSearchLookupController.signal,
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                return;
            }

            const searchValue = [payload.id, payload.name].filter((value) => String(value || '').trim() !== '').join(' ');
            applyActiveCommsSearchValue(searchValue !== '' ? searchValue : normalized);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }
        }
    };

    if (type && itemFields && setFields) {
        const sync = () => {
            const isSet = type.value === 'set';
            itemFields.style.display = isSet ? 'none' : '';
            setFields.style.display = isSet ? '' : 'none';
        };

        type.addEventListener('change', sync);
        sync();
    }

    if (wannabeInput instanceof HTMLInputElement) {
        wannabeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
        const triggerWannabeLookup = () => {
            if (wannabeLookupTimer !== null) {
                window.clearTimeout(wannabeLookupTimer);
            }

            wannabeLookupTimer = window.setTimeout(() => {
                fetchWannabeProfile(wannabeInput.value.trim());
            }, 250);
        };

        wannabeInput.addEventListener('input', triggerWannabeLookup);
        wannabeInput.addEventListener('change', triggerWannabeLookup);
        triggerWannabeLookup();
    }

    if (activeCommsLoansSearchInput instanceof HTMLInputElement) {
        let activeCommsSearchTimer = null;

        activeCommsLoansSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });

        activeCommsLoansSearchInput.addEventListener('input', () => {
            if (activeCommsSearchTimer) {
                clearTimeout(activeCommsSearchTimer);
            }

            const query = activeCommsLoansSearchInput.value.trim();
            if (query === '' || /^\d+$/.test(query)) {
                return;
            }

            activeCommsSearchTimer = window.setTimeout(() => {
                lookupActiveCommsLoansByBadge(query);
            }, 220);
        });
    }

    document.addEventListener('app:rfid-scan', (event) => {
        if (!(event instanceof CustomEvent) || !(activeCommsLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        const scanned = String(event.detail?.raw || '').trim();
        if (scanned === '') {
            return;
        }

        applyActiveCommsSearchValue(scanned);
        lookupActiveCommsLoansByBadge(scanned);
    });

    document.querySelectorAll('.js-set-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const row = document.getElementById(button.dataset.target || '');
            if (!row) {
                return;
            }

            row.classList.toggle('is-open');
        });
    });
})();
</script>
<?= $this->endSection() ?>
