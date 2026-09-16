<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Privat Utstyr</h1>

<div class="grid">
    <div class="card">
        <h3>Ny privat utstyr-regel</h3>
        <form method="post" action="/privat-utstyr/create">
            <?= csrf_field() ?>
            <input type="text" name="owner_name" placeholder="Navn på eier" required value="<?= esc(old('owner_name') ?? '') ?>">
            <input type="text" name="barcode_prefix" placeholder="Hva strekkoden starter på, f.eks. ANGEL-PRIVAT-" required value="<?= esc(old('barcode_prefix') ?? '') ?>">
            <button type="submit">Lagre regel</button>
        </form>
    </div>
</div>

<div class="card">
    <h3>Private utstyr-regler</h3>
    <table>
        <thead>
            <tr><th>Eier</th><th>Strekkode starter på</th><th>Laveste strekkode</th><th>Høyeste strekkode</th><th>Antall treff</th><th>Handling</th></tr>
        </thead>
        <tbody>
        <?php foreach (($prefixes ?? []) as $prefix): ?>
            <?php $items = (array) ($prefix['equipment_items'] ?? []); ?>
            <tr>
                <td><?= esc((string) ($prefix['owner_name'] ?? '-')) ?></td>
                <td><?= esc((string) ($prefix['barcode_prefix'] ?? '-')) ?></td>
                <td><?= esc((string) (($prefix['lowest_serial'] ?? '') !== '' ? $prefix['lowest_serial'] : '-')) ?></td>
                <td><?= esc((string) (($prefix['highest_serial'] ?? '') !== '' ? $prefix['highest_serial'] : '-')) ?></td>
                <td><?= esc((string) ($prefix['equipment_count'] ?? 0)) ?></td>
                <td>
                    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                        <button
                            type="button"
                            class="btn btn-outline-light"
                            data-private-equipment-info
                            data-owner-name="<?= esc((string) ($prefix['owner_name'] ?? '-')) ?>"
                            data-barcode-prefix="<?= esc((string) ($prefix['barcode_prefix'] ?? '-')) ?>"
                            data-equipment-items="<?= esc(json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]', 'attr') ?>">
                            Info
                        </button>
                        <form method="post" action="/privat-utstyr/delete/<?= esc((string) ($prefix['id'] ?? 0)) ?>" data-confirm-message="Slette denne private utstyr-regelen?" style="margin:0;">
                            <?= csrf_field() ?>
                            <button type="submit" class="btn btn-danger">Slett</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="app-confirm" id="privateEquipmentInfoModal" aria-hidden="true">
    <div class="app-confirm__backdrop" data-private-equipment-info-close></div>
    <div class="app-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="privateEquipmentInfoTitle" style="width:min(860px,100%);">
        <h2 class="app-confirm__title" id="privateEquipmentInfoTitle">Privat utstyr</h2>
        <div class="app-confirm__message">
            <div><strong>Eier:</strong> <span data-private-equipment-owner>-</span></div>
            <div style="margin-top:.45rem;"><strong>Strekkode starter på:</strong> <span data-private-equipment-prefix>-</span></div>
            <div style="margin-top:1rem;">
                <table>
                    <thead>
                        <tr><th>Navn</th><th>Strekkode</th><th>Antall</th><th>Status</th></tr>
                    </thead>
                    <tbody data-private-equipment-items>
                        <tr><td colspan="4">Ingen utstyr registrert på dette prefikset.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="app-confirm__actions">
            <button type="button" class="btn btn-outline-light" data-private-equipment-info-close>Lukk</button>
        </div>
    </div>
</div>

<script>
(() => {
    const modal = document.getElementById('privateEquipmentInfoModal');
    const ownerNode = modal?.querySelector('[data-private-equipment-owner]');
    const prefixNode = modal?.querySelector('[data-private-equipment-prefix]');
    const itemsNode = modal?.querySelector('[data-private-equipment-items]');
    let lastFocusedElement = null;

    const escapeHtml = (value) => {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    };

    const closeModal = () => {
        if (!(modal instanceof HTMLElement)) {
            return;
        }

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        }
    };

    const renderItems = (items) => {
        if (!(itemsNode instanceof HTMLElement)) {
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            itemsNode.innerHTML = '<tr><td colspan="4">Ingen utstyr registrert på dette prefikset.</td></tr>';
            return;
        }

        itemsNode.innerHTML = items.map((item) => `
            <tr>
                <td>${escapeHtml(item.name ?? '-')}</td>
                <td>${escapeHtml(item.serial_number ?? '-')}</td>
                <td>${escapeHtml(item.quantity ?? '-')}</td>
                <td>${escapeHtml(item.status ?? '-')}</td>
            </tr>
        `).join('');
    };

    const openModal = (button) => {
        if (!(modal instanceof HTMLElement)) {
            return;
        }

        lastFocusedElement = button;
        if (ownerNode instanceof HTMLElement) {
            ownerNode.textContent = button.getAttribute('data-owner-name') || '-';
        }
        if (prefixNode instanceof HTMLElement) {
            prefixNode.textContent = button.getAttribute('data-barcode-prefix') || '-';
        }

        let items = [];
        try {
            items = JSON.parse(button.getAttribute('data-equipment-items') || '[]');
        } catch (_) {
            items = [];
        }

        renderItems(items);
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    document.querySelectorAll('[data-private-equipment-info]').forEach((button) => {
        button.addEventListener('click', () => openModal(button));
    });

    modal?.querySelectorAll('[data-private-equipment-info-close]').forEach((element) => {
        element.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal?.classList.contains('is-open')) {
            closeModal();
        }
    });
})();
</script>
<?= $this->endSection() ?>
