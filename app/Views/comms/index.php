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
    <h3>Registrer samband-lån</h3>
    <form method="post" action="/samband/issue">
        <?= csrf_field() ?>
        <input type="number" min="1" name="wannabe_id" placeholder="Wannabe ID" required>
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
    <h3>Aktive samband-lån</h3>
    <table>
        <tr><th>ID</th><th>Wannabe ID</th><th>Navn</th><th>Type</th><th>Innhold</th><th>Antall ting</th><th>Utstedt</th><th></th></tr>
        <?php foreach ($activeLoans as $loan): ?>
            <?php $name = trim((string) (($loan['wannabe_name'] ?? '') !== '' ? $loan['wannabe_name'] : (($loan['wannabe_first_name'] ?? '') . ' ' . ($loan['wannabe_last_name'] ?? '')))); ?>
            <tr>
                <td><?= esc((string) $loan['id']) ?></td>
                <td><?= esc((string) $loan['wannabe_id']) ?></td>
                <td><?= esc($name !== '' ? $name : '-') ?></td>
                <td><?= esc(! empty($loan['set_id']) ? 'Sett: ' . (string) ($loan['set_name'] ?? '-') : 'Enkeltutstyr') ?></td>
                <td><?= esc((string) ($loan['items_summary'] ?? '-')) ?></td>
                <td><?= esc((string) ($loan['total_items'] ?? 0)) ?></td>
                <td><?= esc((string) $loan['issued_at']) ?></td>
                <td>
                    <form method="post" action="/samband/return/<?= esc((string) $loan['id']) ?>">
                        <?= csrf_field() ?>
                        <button type="submit">Returner</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
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

<script>
(() => {
    const type = document.getElementById('loanType');
    const itemFields = document.getElementById('itemLoanFields');
    const setFields = document.getElementById('setLoanFields');
    if (!type || !itemFields || !setFields) return;

    const sync = () => {
        const isSet = type.value === 'set';
        itemFields.style.display = isSet ? 'none' : '';
        setFields.style.display = isSet ? '' : 'none';
    };

    type.addEventListener('change', sync);
    sync();
})();
</script>
<?= $this->endSection() ?>
