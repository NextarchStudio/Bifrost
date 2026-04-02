<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Utstyr</h1>
<div class="grid">
    <div class="card">
        <h3>Nytt utstyr</h3>
        <form method="post" action="/equipment/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Navn" required>
            <select name="category" required>
                <option value="">Velg kategori</option>
                <?php foreach ($categories as $category): ?>
                    <option value="<?= esc((string) $category['name']) ?>"><?= esc((string) $category['name']) ?></option>
                <?php endforeach; ?>
            </select>
            <input name="serial_number" placeholder="Serienummer" required>
            <input type="number" min="1" name="quantity" placeholder="Antall stk" value="1" required>
            <textarea name="notes" placeholder="Notater"></textarea>
            <button type="submit">Opprett utstyr</button>
        </form>
    </div>
    <div class="card">
        <h3>Globalt søk</h3>
        <form method="get" action="/search" target="_blank">
            <input name="q" placeholder="Søk utstyr, serial, lokasjon, palle, slot, wannabeId">
            <button type="submit">Kjør søk (JSON)</button>
        </form>
    </div>
</div>
<div class="card" data-live-search-root data-live-search-limit="10">
    <h3>Utstyrsliste</h3>
    <form method="get" action="/equipment" data-live-search-form style="margin-bottom:.8rem;">
        <input type="text" name="q" data-live-search-input placeholder="Søk på navn i utstyrslista" value="<?= esc((string) ($search ?? '')) ?>">
    </form>
    <div data-live-search-summary style="margin:-.2rem 0 .8rem;color:#94a3b8;font-size:.92rem;"></div>
    <table style="color:#f8fafc;">
        <thead>
            <tr><th>ID</th><th>Navn</th><th>Serienummer</th><th>Antall</th><th>Utlånt</th><th>Lokasjon</th><th>Status</th><th>Handling</th></tr>
        </thead>
        <tbody data-live-search-body>
        <?php foreach ($equipment as $row): ?>
            <?php $detailsFormId = 'equipment-details-' . (int) $row->id; ?>
            <?php
            $searchText = implode(' ', [
                (string) $row->id,
                (string) $row->name,
                (string) $row->serial_number,
                (string) (($row->location_names ?? null) ?: ($row->location_name ?? '-')),
                (string) ($row->status ?? ''),
            ]);
            ?>
            <tr data-live-search-row data-search-text="<?= esc(mb_strtolower($searchText)) ?>">
                <td><?= esc((string) $row->id) ?></td>
                <td>
                    <input type="text" name="name" form="<?= esc($detailsFormId) ?>" value="<?= esc((string) $row->name) ?>" required style="margin:0;min-width:120px;">
                </td>
                <td>
                    <input type="text" name="serial_number" form="<?= esc($detailsFormId) ?>" value="<?= esc((string) $row->serial_number) ?>" required style="margin:0;min-width:140px;">
                </td>
                <td>
                    <input type="number" min="0" name="quantity" form="<?= esc($detailsFormId) ?>" value="<?= esc((string) ($row->quantity ?? 0)) ?>" required style="margin:0;min-width:80px;">
                </td>
                <td><?= esc((string) ($row->loaned_quantity ?? 0)) ?></td>
                <td><?= esc((string) (($row->location_names ?? null) ?: ($row->location_name ?? '-'))) ?></td>
                <td><span class="badge <?= esc((string) $row->status) ?>"><?= esc((string) $row->status) ?></span></td>
                <td>
                    <div style="display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;">
                        <form id="<?= esc($detailsFormId) ?>" method="post" action="/equipment/details/<?= esc((string) $row->id) ?>" style="margin:0;">
                            <?= csrf_field() ?>
                            <button type="submit" style="margin:0;min-width:120px;">Lagre</button>
                        </form>
                        <form method="post" action="/equipment/move/<?= esc((string) $row->id) ?>" style="display:flex;gap:.5rem;align-items:center;flex:1;min-width:260px;">
                            <?= csrf_field() ?>
                            <input type="text" name="pallet_qr_code" placeholder="Strekkode fra palle" required style="margin:0;min-width:170px;">
                            <button type="submit" style="margin:0;min-width:120px;">Legg på palle</button>
                        </form>
                        <form method="post" action="/equipment/delete/<?= esc((string) $row->id) ?>" data-confirm-message="Er du sikker på at du vil slette dette utstyret?" style="margin:0;">
                            <?= csrf_field() ?>
                            <button class="btn-danger" type="submit" style="margin:0;min-width:90px;">Slett</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <p data-live-search-empty style="display:none;margin:.8rem 0 0;color:#94a3b8;">Ingen utstyrsrader matcher søket ditt.</p>
</div>
<?= $this->endSection() ?>
