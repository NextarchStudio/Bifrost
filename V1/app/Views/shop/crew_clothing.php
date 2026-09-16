<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$selectedMember = is_array($selectedMember ?? null) ? $selectedMember : null;
$lookupQuery = (string) ($lookupQuery ?? '');
$lookupError = (string) ($lookupError ?? '');
?>
<style>
    .crew-clothing-muted {
        color: #cbd5e1;
    }
    .crew-clothing-meta {
        color: #e2e8f0;
        line-height: 1.7;
    }
    .crew-clothing-meta strong {
        color: #f8fafc;
    }
</style>
<h1>Crewtøy</h1>
<div class="grid">
    <div class="card">
        <h3>Finn crewmedlem</h3>
        <form method="post" action="/shop/crewtoy/search">
            <?= csrf_field() ?>
            <input type="text" name="q" placeholder="Scan badge eller skriv Wannabe ID" value="" autofocus required>
            <button type="submit">Søk opp crewmedlem</button>
        </form>
        <p class="crew-clothing-muted" style="margin:.75rem 0 0;">Hvis crewet ikke finnes fra før, opprettes det automatisk ved oppslag når crew-navn kommer fra crew-API-et.</p>
        <?php if ($lookupError !== ''): ?>
            <p style="margin-top:.85rem;color:#fca5a5;"><?= esc($lookupError) ?></p>
        <?php endif; ?>
    </div>
    <div class="card">
        <h3>Ny vare</h3>
        <form method="post" action="/shop/crewtoy/inventory/save">
            <?= csrf_field() ?>
            <select name="item_type" required>
                <option value="">Velg plaggtype</option>
                <?php foreach (($itemTypeOptions ?? []) as $itemTypeKey => $itemTypeLabel): ?>
                    <option value="<?= esc((string) $itemTypeKey) ?>" <?= old('item_type') === (string) $itemTypeKey ? 'selected' : '' ?>><?= esc((string) $itemTypeLabel) ?></option>
                <?php endforeach; ?>
            </select>
            <select name="size" required>
                <option value="">Velg størrelse</option>
                <?php foreach (($sizeOptions ?? []) as $sizeOption): ?>
                    <option value="<?= esc((string) $sizeOption) ?>" <?= old('size') === (string) $sizeOption ? 'selected' : '' ?>><?= esc((string) $sizeOption) ?></option>
                <?php endforeach; ?>
            </select>
            <input type="number" min="0" name="quantity" placeholder="Antall på lager" value="<?= esc(old('quantity') ?? '0') ?>" required>
            <button type="submit">Opprett vare</button>
        </form>
    </div>
    <div class="card">
        <h3>Crewoversikt</h3>
        <table>
            <tr>
                <th>Crew</th>
                <th>Medlemmer</th>
                <th>T-skjorter</th>
                <th>Gensere</th>
            </tr>
            <?php foreach (($crews ?? []) as $crew): ?>
                <tr>
                    <td><?= esc((string) ($crew['name'] ?? 'Ukjent')) ?></td>
                    <td><?= esc((string) ($crew['members_total'] ?? 0)) ?></td>
                    <td>Utlevert: <?= esc((string) ($crew['tshirt_delivered_total'] ?? 0)) ?></td>
                    <td>Utlevert: <?= esc((string) ($crew['hoodie_delivered_total'] ?? 0)) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
</div>

<div class="card">
    <h3>Varebeholdning</h3>
    <table>
        <tr>
            <th>ID</th>
            <th>Plagg</th>
            <th>Størrelse</th>
            <th>Antall</th>
            <th>Lagre</th>
            <th>Slett</th>
        </tr>
        <?php foreach (($inventory ?? []) as $inventoryRow): ?>
            <tr>
                <td><?= esc((string) ($inventoryRow['id'] ?? 0)) ?></td>
                <td>
                    <form method="post" action="/shop/crewtoy/inventory/update/<?= esc((string) ($inventoryRow['id'] ?? 0)) ?>" style="margin:0;">
                        <?= csrf_field() ?>
                        <select name="item_type" required>
                            <?php foreach (($itemTypeOptions ?? []) as $itemTypeKey => $itemTypeLabel): ?>
                                <option value="<?= esc((string) $itemTypeKey) ?>" <?= (string) ($inventoryRow['item_type'] ?? '') === (string) $itemTypeKey ? 'selected' : '' ?>><?= esc((string) $itemTypeLabel) ?></option>
                            <?php endforeach; ?>
                        </select>
                </td>
                <td>
                        <select name="size" required>
                            <?php foreach (($sizeOptions ?? []) as $sizeOption): ?>
                                <option value="<?= esc((string) $sizeOption) ?>" <?= (string) ($inventoryRow['size'] ?? '') === (string) $sizeOption ? 'selected' : '' ?>><?= esc((string) $sizeOption) ?></option>
                            <?php endforeach; ?>
                        </select>
                </td>
                <td>
                        <input type="number" min="0" name="quantity" value="<?= esc((string) ($inventoryRow['quantity'] ?? 0)) ?>" required>
                </td>
                <td>
                        <button type="submit">Lagre</button>
                    </form>
                </td>
                <td>
                    <form method="post" action="/shop/crewtoy/inventory/delete/<?= esc((string) ($inventoryRow['id'] ?? 0)) ?>" onsubmit="return confirm('Slette denne varelinjen fra crewtøy-lageret?');">
                        <?= csrf_field() ?>
                        <button type="submit" class="btn-danger">Slett vare</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if ($selectedMember !== null): ?>
<div class="card">
    <h3>Valgt crewmedlem</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-bottom:1rem;">
        <div class="crew-clothing-meta">
            <strong>Navn:</strong> <?= esc((string) ($selectedMember['name'] ?? '-')) ?><br>
            <strong>Nickname:</strong> <?= esc((string) (($selectedMember['nickname'] ?? '') !== '' ? $selectedMember['nickname'] : '-')) ?><br>
            <strong>Wannabe ID:</strong> <?= esc((string) (($selectedMember['wannabe_id'] ?? '') !== '' ? $selectedMember['wannabe_id'] : '-')) ?><br>
            <strong>Badge-scan:</strong> <?= esc((string) (($selectedMember['badge_scan_number'] ?? '') !== '' ? $selectedMember['badge_scan_number'] : '-')) ?>
        </div>
        <div class="crew-clothing-meta">
            <strong>Crew:</strong> <?= esc((string) (($selectedMember['crew_name'] ?? '') !== '' ? $selectedMember['crew_name'] : 'Ikke satt')) ?><br>
            <strong>T-skjorte:</strong>
            <?php if ((int) ($selectedMember['tshirt_delivered'] ?? 0) === 1): ?>
                <span class="badge active">Utlevert</span>
            <?php else: ?>
                <span class="badge rejected">Ikke utlevert</span>
            <?php endif; ?>
            <br>
            <strong>Genser:</strong>
            <?php if ((int) ($selectedMember['hoodie_delivered'] ?? 0) === 1): ?>
                <span class="badge active">Utlevert</span>
            <?php else: ?>
                <span class="badge rejected">Ikke utlevert</span>
            <?php endif; ?>
        </div>
    </div>

    <form method="post" action="/shop/crewtoy/member/<?= esc((string) ($selectedMember['id'] ?? 0)) ?>/update">
        <?= csrf_field() ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem;">
            <select name="crew_id">
                <option value="">Ingen crew valgt</option>
                <?php foreach (($crews ?? []) as $crew): ?>
                    <option value="<?= esc((string) ($crew['id'] ?? 0)) ?>" <?= (int) ($selectedMember['crew_id'] ?? 0) === (int) ($crew['id'] ?? 0) ? 'selected' : '' ?>>
                        <?= esc((string) ($crew['name'] ?? '')) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <select name="tshirt_size">
                <option value="">Velg t-skjorte størrelse</option>
                <?php foreach (($sizeOptions ?? []) as $sizeOption): ?>
                    <option value="<?= esc((string) $sizeOption) ?>" <?= (string) ($selectedMember['tshirt_size'] ?? '') === (string) $sizeOption ? 'selected' : '' ?>>
                        <?= esc((string) $sizeOption) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <select name="hoodie_size">
                <option value="">Velg genser størrelse</option>
                <?php foreach (($sizeOptions ?? []) as $sizeOption): ?>
                    <option value="<?= esc((string) $sizeOption) ?>" <?= (string) ($selectedMember['hoodie_size'] ?? '') === (string) $sizeOption ? 'selected' : '' ?>>
                        <?= esc((string) $sizeOption) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <button type="submit">Lagre størrelser og crew</button>
    </form>

    <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem;">
        <form method="post" action="/shop/crewtoy/member/<?= esc((string) ($selectedMember['id'] ?? 0)) ?>/deliver/hoodie">
            <?= csrf_field() ?>
            <input type="hidden" name="delivered" value="<?= (int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 ? '0' : '1' ?>">
            <button type="submit" class="<?= (int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 ? 'btn btn-outline-light' : '' ?>">
                <?= (int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 ? 'G Ikke utlevert' : 'G Utlevert' ?>
            </button>
        </form>
        <form method="post" action="/shop/crewtoy/member/<?= esc((string) ($selectedMember['id'] ?? 0)) ?>/deliver/tshirt">
            <?= csrf_field() ?>
            <input type="hidden" name="delivered" value="<?= (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1 ? '0' : '1' ?>">
            <button type="submit" class="<?= (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1 ? 'btn btn-outline-light' : '' ?>">
                <?= (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1 ? 'T Ikke utlevert' : 'T Utlevert' ?>
            </button>
        </form>
        <form method="post" action="/shop/crewtoy/member/<?= esc((string) ($selectedMember['id'] ?? 0)) ?>/deliver-both">
            <?= csrf_field() ?>
            <input type="hidden" name="delivered" value="<?= ((int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 && (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1) ? '0' : '1' ?>">
            <button type="submit" class="<?= ((int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 && (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1) ? 'btn btn-outline-light' : '' ?>">
                <?= ((int) ($selectedMember['hoodie_delivered'] ?? 0) === 1 && (int) ($selectedMember['tshirt_delivered'] ?? 0) === 1) ? 'GT Ikke utlevert' : 'GT Utlevert' ?>
            </button>
        </form>
    </div>
</div>
<?php endif; ?>

<div class="card">
    <h3>Crewmedlemmer</h3>
    <table>
        <tr>
            <th>Navn</th>
            <th>Crew</th>
            <th>Wannabe ID</th>
            <th>T-skjorte</th>
            <th>Genser</th>
            <th>Status</th>
        </tr>
        <?php foreach (($members ?? []) as $member): ?>
            <tr>
                <td><?= esc((string) ($member['name'] ?? '-')) ?></td>
                <td><?= esc((string) (($member['crew_name'] ?? '') !== '' ? $member['crew_name'] : '-')) ?></td>
                <td><?= esc((string) (($member['wannabe_id'] ?? '') !== '' ? $member['wannabe_id'] : '-')) ?></td>
                <td><?= esc((string) (($member['tshirt_size'] ?? '') !== '' ? $member['tshirt_size'] : '-')) ?></td>
                <td><?= esc((string) (($member['hoodie_size'] ?? '') !== '' ? $member['hoodie_size'] : '-')) ?></td>
                <td>
                    T-skjorte:
                    <?= (int) ($member['tshirt_delivered'] ?? 0) === 1 ? 'Utlevert' : 'Ikke utlevert' ?>
                    <br>
                    Genser:
                    <?= (int) ($member['hoodie_delivered'] ?? 0) === 1 ? 'Utlevert' : 'Ikke utlevert' ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
