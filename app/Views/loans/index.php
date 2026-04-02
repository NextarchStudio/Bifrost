<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$oldBarcodes = old('barcodes');
$oldQuantities = old('quantities');

if (! is_array($oldBarcodes)) {
    $singleBarcode = old('barcode');
    $oldBarcodes = $singleBarcode !== null && $singleBarcode !== '' ? [$singleBarcode] : [''];
}

if (! is_array($oldQuantities)) {
    $singleQuantity = old('quantity');
    $oldQuantities = $singleQuantity !== null && $singleQuantity !== '' ? [$singleQuantity] : ['1'];
}

$lineCount = max(1, count($oldBarcodes), count($oldQuantities));
$privateEquipmentRulesJson = json_encode($privateEquipmentRules ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
?>
<h1>Utlån</h1>
<div class="card">
    <h3>Lån utstyr</h3>
    <form method="post" action="/loans/issue">
        <?= csrf_field() ?>
        <input type="text" name="wannabe_id" data-role="wannabe-id" placeholder="Wannabe ID eller badge-scan" required value="<?= esc(old('wannabe_id') ?? '') ?>">
        <div data-role="wannabe-profile" style="margin:-.25rem 0 .9rem;padding:.75rem 1rem;border:1px solid #1f2a44;border-radius:10px;background:rgba(15,23,42,.35);display:none;">
            <div style="color:#e2e8f0;"><strong style="color:#e2e8f0;">Navn:</strong> <span data-role="wannabe-profile-name" style="color:#f8fafc;">-</span></div>
            <div data-role="wannabe-profile-meta" style="margin-top:.25rem;color:#cbd5e1;"></div>
        </div>
        <div data-role="wannabe-profile-message" style="margin:-.25rem 0 .9rem;color:#94a3b8;font-size:.92rem;"></div>

        <div id="loanIssueLines" style="display:flex;flex-direction:column;gap:.75rem;">
            <?php for ($index = 0; $index < $lineCount; $index++): ?>
                <div class="card" data-loan-line style="padding:.85rem;margin:0;">
                    <div style="display:grid;grid-template-columns:minmax(220px, 1fr) minmax(220px, 1fr) 120px auto;gap:.75rem;align-items:start;">
                        <div>
                            <input
                                type="text"
                                data-role="equipment-search"
                                placeholder="Søk på navn på utstyr"
                                autocomplete="off">
                            <select data-role="equipment-select" size="6" style="margin-bottom:0;">
                                <option value="">Velg utstyr</option>
                                <?php foreach (($loanableEquipment ?? []) as $item): ?>
                                    <?php $label = (string) $item->name; ?>
                                    <?php if (! empty($item->serial_number)): ?>
                                        <?php $label .= ' (' . (string) $item->serial_number . ')'; ?>
                                    <?php endif; ?>
                                    <?php if (isset($item->quantity)): ?>
                                        <?php $label .= ' - ' . (string) $item->quantity . ' stk'; ?>
                                    <?php endif; ?>
                                    <option
                                        value="<?= esc((string) ($item->serial_number ?? '')) ?>"
                                        data-name="<?= esc(mb_strtolower((string) $item->name)) ?>"
                                        data-label="<?= esc(mb_strtolower($label)) ?>">
                                        <?= esc($label) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <input type="text" name="barcodes[]" data-role="barcode" placeholder="Strekkode / serienummer" required value="<?= esc((string) ($oldBarcodes[$index] ?? '')) ?>">
                        <input type="number" min="1" name="quantities[]" placeholder="Antall" required value="<?= esc((string) ($oldQuantities[$index] ?? '1')) ?>">
                        <button type="button" class="btn btn-outline-light" data-role="remove-loan-line" style="margin:0;">Fjern</button>
                    </div>
                </div>
            <?php endfor; ?>
        </div>

        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline-light" id="addLoanLine">Legg til flere ting</button>
            <button type="submit">Registrer lån</button>
        </div>
    </form>
</div>

<div class="card" data-live-search-root data-live-search-limit="10">
    <h3>Aktive Lån</h3>
    <form method="get" action="/loans" data-live-search-form style="margin-bottom:.8rem;">
        <input
            type="text"
            name="q"
            data-live-search-input
            placeholder="Søk på wannabe ID, navn eller strekkode"
            value="<?= esc((string) ($search ?? '')) ?>">
    </form>
    <div data-live-search-summary style="margin:-.2rem 0 .8rem;color:#94a3b8;font-size:.92rem;"></div>
    <table>
        <thead>
            <tr><th>Utstyr</th><th>Wannabe ID</th><th>Navn</th><th>Antall</th><th>Status</th><th>Handling</th></tr>
        </thead>
        <tbody data-live-search-body>
        <?php foreach ($activeLoans as $loan): ?>
            <?php $name = trim((string) (($loan->wannabe_name ?? '') !== '' ? $loan->wannabe_name : (($loan->wannabe_first_name ?? '') . ' ' . ($loan->wannabe_last_name ?? '')))); ?>
            <?php $serialNumber = (string) ($loan->serial_number ?? ''); ?>
            <?php
            $searchText = implode(' ', [
                (string) $loan->id,
                (string) $loan->equipment_name,
                $serialNumber,
                (string) $loan->wannabe_id,
                $name,
                (string) ($loan->status ?? ''),
                (string) ($loan->quantity ?? 1),
                (string) ($loan->issued_at ?? ''),
            ]);
            ?>
            <tr
                data-live-search-row
                data-loan-id="<?= esc((string) $loan->id) ?>"
                data-loan-serial="<?= esc($serialNumber) ?>"
                data-search-text="<?= esc(mb_strtolower($searchText)) ?>">
                <td>
                    <strong><?= esc((string) $loan->equipment_name) ?></strong>
                    <div style="margin-top:.2rem;color:#94a3b8;">Strekkode: <?= esc($serialNumber !== '' ? $serialNumber : '-') ?></div>
                </td>
                <td data-loan-wannabe-id><?= esc((string) $loan->wannabe_id) ?></td>
                <td data-loan-name><?= esc($name !== '' ? $name : '-') ?></td>
                <td data-loan-quantity><?= esc((string) ($loan->quantity ?? 1)) ?></td>
                <td><span class="badge <?= esc((string) $loan->status) ?>" data-loan-status><?= esc((string) $loan->status) ?></span></td>
                <td>
                    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:nowrap;">
                        <form method="post" action="/loans/return/<?= esc((string) $loan->id) ?>" data-loan-return-form style="margin:0;">
                            <?= csrf_field() ?>
                            <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:nowrap;">
                                <input type="number" min="1" max="<?= esc((string) max(1, (int) ($loan->quantity ?? 1))) ?>" name="quantity" value="<?= esc((string) max(1, (int) ($loan->quantity ?? 1))) ?>" data-loan-return-quantity style="margin:0;min-width:90px;">
                                <button type="submit">Returner</button>
                            </div>
                        </form>
                        <button
                            type="button"
                            class="btn btn-outline-light"
                            data-loan-info-open
                            data-loan-info-id="<?= esc((string) $loan->id) ?>"
                            data-loan-info-equipment="<?= esc((string) $loan->equipment_name) ?>"
                            data-loan-info-serial="<?= esc($serialNumber !== '' ? $serialNumber : '-') ?>"
                            data-loan-info-wannabe-id="<?= esc((string) $loan->wannabe_id) ?>"
                            data-loan-info-name="<?= esc($name !== '' ? $name : '-') ?>"
                            data-loan-info-quantity="<?= esc((string) ($loan->quantity ?? 1)) ?>"
                            data-loan-info-status="<?= esc((string) $loan->status) ?>"
                            data-loan-info-issued="<?= esc(format_norwegian_datetime($loan->issued_at)) ?>"
                            data-loan-info-returned="<?= esc(format_norwegian_datetime($loan->returned_at ?? null)) ?>"
                            data-loan-info-request-id="<?= esc((string) ($loan->request_id ?? '-')) ?>"
                            style="margin:0;">
                            Info
                        </button>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <p data-live-search-empty style="display:none;margin:.8rem 0 0;color:#94a3b8;">Ingen lån matcher søket ditt.</p>
</div>

<div class="app-confirm" id="loanInfoModal" aria-hidden="true">
    <div class="app-confirm__backdrop" data-loan-info-close></div>
    <div class="app-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="loanInfoTitle" aria-describedby="loanInfoBody">
        <h2 class="app-confirm__title" id="loanInfoTitle">Låneinformasjon</h2>
        <div class="app-confirm__message" id="loanInfoBody">
            <div><strong>ID:</strong> <span data-loan-info-id-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Utstyr:</strong> <span data-loan-info-equipment-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Strekkode:</strong> <span data-loan-info-serial-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Wannabe ID:</strong> <span data-loan-info-wannabe-id-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Navn:</strong> <span data-loan-info-name-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Antall:</strong> <span data-loan-info-quantity-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Status:</strong> <span data-loan-info-status-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Utstedt:</strong> <span data-loan-info-issued-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Returnert:</strong> <span data-loan-info-returned-value>-</span></div>
            <div style="margin-top:.45rem;"><strong>Forespørsel-ID:</strong> <span data-loan-info-request-id-value>-</span></div>
        </div>
        <div class="app-confirm__actions">
            <button type="button" class="btn btn-outline-light" data-loan-info-close>Lukk</button>
        </div>
    </div>
</div>

<div class="app-confirm" id="angelPrivateModal" aria-hidden="true">
    <div class="app-confirm__backdrop" data-angel-private-close></div>
    <div class="app-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="angelPrivateTitle" aria-describedby="angelPrivateBody">
        <h2 class="app-confirm__title" id="angelPrivateTitle">Privat eiendel oppdaget</h2>
        <div class="app-confirm__message" id="angelPrivateBody">
            Dette er en privat eiendel. Gi eiendelen til eier.
        </div>
        <div class="app-confirm__actions">
            <button type="button" class="btn btn-outline-light" data-angel-private-close>Skjønner</button>
        </div>
    </div>
</div>

<div class="app-confirm" id="angelPrivateIssueModal" aria-hidden="true">
    <div class="app-confirm__backdrop" data-angel-private-issue-cancel></div>
    <div class="app-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="angelPrivateIssueTitle" aria-describedby="angelPrivateIssueBody">
        <h2 class="app-confirm__title" id="angelPrivateIssueTitle">Privat eiendel oppdaget</h2>
        <div class="app-confirm__message" id="angelPrivateIssueBody">
            Dette er en privat eiendel. Bekreft at du har blitt spurt før den lånes ut.
        </div>
        <div class="app-confirm__actions">
            <button type="button" class="btn btn-outline-light" data-angel-private-issue-cancel>Avbryt</button>
            <button type="button" class="btn btn-primary" data-angel-private-issue-confirm>Bekreft</button>
        </div>
    </div>
</div>

<script>
(() => {
    const privateEquipmentRules = <?= $privateEquipmentRulesJson ?>;
    const lineContainer = document.getElementById('loanIssueLines');
    const addButton = document.getElementById('addLoanLine');
    const issueForm = document.querySelector('form[action="/loans/issue"]');
    const activeLoansSearchInput = document.querySelector('[data-live-search-root] [data-live-search-input]');
    const wannabeIdInput = issueForm?.querySelector('[data-role="wannabe-id"]');
    const wannabeProfileBox = issueForm?.querySelector('[data-role="wannabe-profile"]');
    const wannabeProfileName = issueForm?.querySelector('[data-role="wannabe-profile-name"]');
    const wannabeProfileMeta = issueForm?.querySelector('[data-role="wannabe-profile-meta"]');
    const wannabeProfileMessage = issueForm?.querySelector('[data-role="wannabe-profile-message"]');
    const angelPrivateModal = document.getElementById('angelPrivateModal');
    const angelPrivateIssueModal = document.getElementById('angelPrivateIssueModal');
    const angelPrivateBody = document.getElementById('angelPrivateBody');
    const angelPrivateIssueBody = document.getElementById('angelPrivateIssueBody');
    let lastAngelPrivateFocusedElement = null;
    let pendingAngelPrivateIssueElement = null;
    let wannabeLookupTimer = null;
    let activeWannabeLookupController = null;
    let activeLoansSearchLookupController = null;
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
            const response = await fetch(`/loans/profile-lookup?q=${encodeURIComponent(wannabeId)}`, {
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

            if (wannabeIdInput instanceof HTMLInputElement && String(payload.id || '').trim() !== '') {
                wannabeIdInput.value = String(payload.id).trim();
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

    const applyActiveLoansSearchValue = (value) => {
        if (!(activeLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        activeLoansSearchInput.value = value;
        activeLoansSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const lookupActiveLoansByBadge = async (query) => {
        const normalized = String(query || '').trim();
        if (normalized === '' || !(activeLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        if (activeLoansSearchLookupController instanceof AbortController) {
            activeLoansSearchLookupController.abort();
        }
        activeLoansSearchLookupController = new AbortController();

        try {
            const response = await fetch(`/loans/profile-lookup?q=${encodeURIComponent(normalized)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: activeLoansSearchLookupController.signal,
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                return;
            }

            const searchValue = [payload.id, payload.name].filter((value) => String(value || '').trim() !== '').join(' ');
            applyActiveLoansSearchValue(searchValue !== '' ? searchValue : normalized);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }
        }
    };

    const privateEquipmentRuleFor = (value) => {
        const normalized = String(value || '').trim().toUpperCase();
        if (normalized === '') {
            return null;
        }

        return privateEquipmentRules.find((rule) => normalized.startsWith(String(rule.prefix || '').toUpperCase())) || null;
    };

    const openAngelPrivateModal = (trigger, message) => {
        if (!(angelPrivateModal instanceof HTMLElement)) {
            return;
        }

        lastAngelPrivateFocusedElement = trigger instanceof HTMLElement ? trigger : null;
        if (angelPrivateBody instanceof HTMLElement) {
            angelPrivateBody.textContent = message || 'Dette er en privat eiendel. Gi eiendelen til eier.';
        }
        angelPrivateModal.classList.add('is-open');
        angelPrivateModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const closeAngelPrivateModal = () => {
        if (!(angelPrivateModal instanceof HTMLElement)) {
            return;
        }

        angelPrivateModal.classList.remove('is-open');
        angelPrivateModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (lastAngelPrivateFocusedElement instanceof HTMLElement) {
            lastAngelPrivateFocusedElement.focus();
        }
    };

    const closeAngelPrivateIssueModal = (shouldRefocus = true) => {
        if (!(angelPrivateIssueModal instanceof HTMLElement)) {
            return;
        }

        angelPrivateIssueModal.classList.remove('is-open');
        angelPrivateIssueModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (shouldRefocus && pendingAngelPrivateIssueElement instanceof HTMLElement) {
            pendingAngelPrivateIssueElement.focus();
        }

        pendingAngelPrivateIssueElement = null;
    };

    const openAngelPrivateIssueModal = (trigger, message) => {
        if (!(angelPrivateIssueModal instanceof HTMLElement)) {
            return;
        }

        pendingAngelPrivateIssueElement = trigger instanceof HTMLElement ? trigger : null;
        if (angelPrivateIssueBody instanceof HTMLElement) {
            angelPrivateIssueBody.textContent = message || 'Dette er en privat eiendel. Bekreft at du har blitt spurt før den lånes ut.';
        }
        angelPrivateIssueModal.classList.add('is-open');
        angelPrivateIssueModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    angelPrivateModal?.querySelectorAll('[data-angel-private-close]').forEach((element) => {
        element.addEventListener('click', closeAngelPrivateModal);
    });
    angelPrivateIssueModal?.querySelectorAll('[data-angel-private-issue-cancel]').forEach((element) => {
        element.addEventListener('click', () => closeAngelPrivateIssueModal());
    });
    angelPrivateIssueModal?.querySelector('[data-angel-private-issue-confirm]')?.addEventListener('click', () => {
        if (pendingAngelPrivateIssueElement instanceof HTMLInputElement) {
            pendingAngelPrivateIssueElement.dataset.issueConfirmed = 'true';
        }
        closeAngelPrivateIssueModal(false);
    });

    if (wannabeIdInput instanceof HTMLInputElement) {
        wannabeIdInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
        const triggerWannabeLookup = () => {
            if (wannabeLookupTimer !== null) {
                window.clearTimeout(wannabeLookupTimer);
            }

            wannabeLookupTimer = window.setTimeout(() => {
                fetchWannabeProfile(wannabeIdInput.value.trim());
            }, 250);
        };

        wannabeIdInput.addEventListener('input', triggerWannabeLookup);
        wannabeIdInput.addEventListener('change', triggerWannabeLookup);
        triggerWannabeLookup();
    }

    if (activeLoansSearchInput instanceof HTMLInputElement) {
        let activeLoansSearchTimer = null;

        activeLoansSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });

        activeLoansSearchInput.addEventListener('input', () => {
            if (activeLoansSearchTimer) {
                clearTimeout(activeLoansSearchTimer);
            }

            const query = activeLoansSearchInput.value.trim();
            if (query === '' || /^\d+$/.test(query)) {
                return;
            }

            activeLoansSearchTimer = window.setTimeout(() => {
                lookupActiveLoansByBadge(query);
            }, 220);
        });
    }

    document.addEventListener('app:rfid-scan', (event) => {
        if (!(event instanceof CustomEvent) || !(activeLoansSearchInput instanceof HTMLInputElement)) {
            return;
        }

        const scanned = String(event.detail?.raw || '').trim();
        if (scanned === '') {
            return;
        }

        applyActiveLoansSearchValue(scanned);
        lookupActiveLoansByBadge(scanned);
    });

    if (lineContainer && addButton) {
        const bindLine = (line) => {
            const searchInput = line.querySelector('[data-role="equipment-search"]');
            const select = line.querySelector('[data-role="equipment-select"]');
            const barcodeInput = line.querySelector('[data-role="barcode"]');
            const removeButton = line.querySelector('[data-role="remove-loan-line"]');

            if (!searchInput || !select || !barcodeInput || !removeButton) {
                return;
            }

            const options = [...select.querySelectorAll('option')].filter((option) => option.value !== '');
            const maybeWarnAngelPrivateIssue = (value, trigger) => {
                const rule = privateEquipmentRuleFor(value);
                if (rule === null) {
                    delete barcodeInput.dataset.issueConfirmed;
                    return;
                }

                if (barcodeInput.dataset.issueConfirmed === 'true') {
                    return;
                }

                openAngelPrivateIssueModal(trigger, String(rule.issue_message || ''));
            };

            const filterOptions = () => {
                const query = searchInput.value.trim().toLowerCase();
                options.forEach((option) => {
                    const name = option.getAttribute('data-name') || '';
                    const label = option.getAttribute('data-label') || '';
                    option.hidden = query !== '' && !name.includes(query) && !label.includes(query);
                });
            };

            searchInput.addEventListener('input', filterOptions);
            barcodeInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                }
            });
            select.addEventListener('change', () => {
                if (select.value) {
                    barcodeInput.value = select.value;
                    delete barcodeInput.dataset.issueConfirmed;
                    maybeWarnAngelPrivateIssue(select.value, barcodeInput);
                }
            });
            barcodeInput.addEventListener('change', () => {
                delete barcodeInput.dataset.issueConfirmed;
                maybeWarnAngelPrivateIssue(barcodeInput.value, barcodeInput);
            });
            barcodeInput.addEventListener('blur', () => {
                maybeWarnAngelPrivateIssue(barcodeInput.value, barcodeInput);
            });
            removeButton.addEventListener('click', () => {
                const lines = lineContainer.querySelectorAll('[data-loan-line]');
                if (lines.length <= 1) {
                    const quantityInput = line.querySelector('input[name="quantities[]"]');
                    searchInput.value = '';
                    select.value = '';
                    barcodeInput.value = '';
                    delete barcodeInput.dataset.issueConfirmed;
                    if (quantityInput) {
                        quantityInput.value = '1';
                    }
                    filterOptions();
                    return;
                }

                line.remove();
            });

            filterOptions();
        };

        const createLine = () => {
            const template = lineContainer.querySelector('[data-loan-line]');
            if (!template) {
                return null;
            }

            const clone = template.cloneNode(true);
            clone.querySelectorAll('input').forEach((input) => {
                input.value = input.name === 'quantities[]' ? '1' : '';
            });
            clone.querySelectorAll('select').forEach((select) => {
                select.value = '';
                [...select.options].forEach((option) => {
                    option.hidden = false;
                });
            });

            return clone;
        };

        lineContainer.querySelectorAll('[data-loan-line]').forEach(bindLine);

        addButton.addEventListener('click', () => {
            const newLine = createLine();
            if (!newLine) {
                return;
            }

            lineContainer.appendChild(newLine);
            bindLine(newLine);
            newLine.querySelector('[data-role="equipment-search"]')?.focus();
        });
    }

    issueForm?.addEventListener('submit', (event) => {
        const unconfirmedAngelPrivateInput = [...issueForm.querySelectorAll('[data-role="barcode"]')].find((input) => {
            if (!(input instanceof HTMLInputElement)) {
                return false;
            }

            return privateEquipmentRuleFor(input.value) !== null && input.dataset.issueConfirmed !== 'true';
        });

        if (unconfirmedAngelPrivateInput instanceof HTMLInputElement) {
            event.preventDefault();
            const rule = privateEquipmentRuleFor(unconfirmedAngelPrivateInput.value);
            openAngelPrivateIssueModal(unconfirmedAngelPrivateInput, String(rule?.issue_message || ''));
        }
    });

    const updateCsrf = (name, hash) => {
        if (!name || !hash) {
            return;
        }

        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
            input.value = hash;
        });
    };

    document.querySelectorAll('[data-loan-return-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const row = form.closest('[data-loan-id]');
            const quantityInput = form.querySelector('[data-loan-return-quantity]');
            if (!(row instanceof HTMLElement) || !(quantityInput instanceof HTMLInputElement)) {
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = true;
            }

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                    credentials: 'same-origin',
                });

                const payload = await response.json();
                updateCsrf(payload.csrfName, payload.csrfHash);

                if (!response.ok || !payload.ok) {
                    window.appShowToast?.({
                        type: 'error',
                        title: 'Feilmelding',
                        message: payload.message || 'Kunne ikke returnere utstyr.',
                        icon: 'fa-circle-exclamation',
                    });
                    return;
                }

                const loan = payload.loan || {};
                const remainingQuantity = Number(loan.remainingQuantity || 0);
                const quantityCell = row.querySelector('[data-loan-quantity]');
                const statusBadge = row.querySelector('[data-loan-status]');
                const serialNumber = String(row.getAttribute('data-loan-serial') || '');

                if (remainingQuantity <= 0) {
                    row.remove();
                } else {
                    if (quantityCell instanceof HTMLElement) {
                        quantityCell.textContent = String(remainingQuantity);
                    }
                    quantityInput.max = String(remainingQuantity);
                    quantityInput.value = String(remainingQuantity);
                    row.setAttribute('data-search-text', [
                        row.children[0]?.textContent || '',
                        row.querySelector('[data-loan-wannabe-id]')?.textContent || '',
                        row.querySelector('[data-loan-name]')?.textContent || '',
                        remainingQuantity,
                        statusBadge instanceof HTMLElement ? statusBadge.textContent || '' : '',
                    ].join(' ').toLowerCase());
                }

                document.dispatchEvent(new CustomEvent('app:live-search-refresh'));

                window.appShowToast?.({
                    type: 'success',
                    title: 'Bekreftelse',
                    message: payload.message || 'Utstyr returnert.',
                    icon: 'fa-circle-check',
                });

                const rule = privateEquipmentRuleFor(serialNumber);
                if (rule !== null) {
                    openAngelPrivateModal(
                        submitButton instanceof HTMLElement ? submitButton : quantityInput,
                        String(rule.return_message || '')
                    );
                }
            } catch (_) {
                window.appShowToast?.({
                    type: 'error',
                    title: 'Feilmelding',
                    message: 'Kunne ikke returnere utstyr akkurat nå.',
                    icon: 'fa-circle-exclamation',
                });
            } finally {
                if (submitButton instanceof HTMLButtonElement) {
                    submitButton.disabled = false;
                }
            }
        });
    });

    const infoModal = document.getElementById('loanInfoModal');
    const infoIdNode = infoModal?.querySelector('[data-loan-info-id-value]');
    const infoEquipmentNode = infoModal?.querySelector('[data-loan-info-equipment-value]');
    const infoSerialNode = infoModal?.querySelector('[data-loan-info-serial-value]');
    const infoWannabeIdNode = infoModal?.querySelector('[data-loan-info-wannabe-id-value]');
    const infoNameNode = infoModal?.querySelector('[data-loan-info-name-value]');
    const infoQuantityNode = infoModal?.querySelector('[data-loan-info-quantity-value]');
    const infoStatusNode = infoModal?.querySelector('[data-loan-info-status-value]');
    const infoIssuedNode = infoModal?.querySelector('[data-loan-info-issued-value]');
    const infoReturnedNode = infoModal?.querySelector('[data-loan-info-returned-value]');
    const infoRequestIdNode = infoModal?.querySelector('[data-loan-info-request-id-value]');
    let lastFocusedElement = null;

    const closeInfoModal = () => {
        if (!(infoModal instanceof HTMLElement)) {
            return;
        }

        infoModal.classList.remove('is-open');
        infoModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        }
    };

    const openInfoModal = (trigger) => {
        if (!(infoModal instanceof HTMLElement)) {
            return;
        }

        lastFocusedElement = trigger;
        if (infoIdNode instanceof HTMLElement) {
            infoIdNode.textContent = trigger.getAttribute('data-loan-info-id') || '-';
        }
        if (infoEquipmentNode instanceof HTMLElement) {
            infoEquipmentNode.textContent = trigger.getAttribute('data-loan-info-equipment') || '-';
        }
        if (infoSerialNode instanceof HTMLElement) {
            infoSerialNode.textContent = trigger.getAttribute('data-loan-info-serial') || '-';
        }
        if (infoWannabeIdNode instanceof HTMLElement) {
            infoWannabeIdNode.textContent = trigger.getAttribute('data-loan-info-wannabe-id') || '-';
        }
        if (infoNameNode instanceof HTMLElement) {
            infoNameNode.textContent = trigger.getAttribute('data-loan-info-name') || '-';
        }
        if (infoQuantityNode instanceof HTMLElement) {
            infoQuantityNode.textContent = trigger.getAttribute('data-loan-info-quantity') || '-';
        }
        if (infoStatusNode instanceof HTMLElement) {
            infoStatusNode.textContent = trigger.getAttribute('data-loan-info-status') || '-';
        }
        if (infoIssuedNode instanceof HTMLElement) {
            infoIssuedNode.textContent = trigger.getAttribute('data-loan-info-issued') || '-';
        }
        if (infoReturnedNode instanceof HTMLElement) {
            infoReturnedNode.textContent = trigger.getAttribute('data-loan-info-returned') || '-';
        }
        if (infoRequestIdNode instanceof HTMLElement) {
            infoRequestIdNode.textContent = trigger.getAttribute('data-loan-info-request-id') || '-';
        }

        infoModal.classList.add('is-open');
        infoModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    document.querySelectorAll('[data-loan-info-open]').forEach((button) => {
        button.addEventListener('click', () => openInfoModal(button));
    });

    infoModal?.querySelectorAll('[data-loan-info-close]').forEach((element) => {
        element.addEventListener('click', closeInfoModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && infoModal?.classList.contains('is-open')) {
            closeInfoModal();
        }
        if (event.key === 'Escape' && angelPrivateModal?.classList.contains('is-open')) {
            closeAngelPrivateModal();
        }
        if (event.key === 'Escape' && angelPrivateIssueModal?.classList.contains('is-open')) {
            closeAngelPrivateIssueModal();
        }
    });
})();
</script>
<?= $this->endSection() ?>
