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
<div class="card">
    <h3>Utstyrsliste</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Navn</th><th>Serienummer</th><th>Antall</th><th>Utlånt</th><th>Lokasjon</th><th>Status</th><th>Handling</th></tr>
        <?php foreach ($equipment as $row): ?>
            <tr>
                <td><?= esc((string) $row->id) ?></td>
                <td><?= esc((string) $row->name) ?></td>
                <td><?= esc((string) $row->serial_number) ?></td>
                <td><?= esc((string) ($row->quantity ?? 0)) ?></td>
                <td><?= esc((string) ($row->loaned_quantity ?? 0)) ?></td>
                <td><?= esc((string) (($row->location_names ?? null) ?: ($row->location_name ?? '-'))) ?></td>
                <td><span class="badge <?= esc((string) $row->status) ?>"><?= esc((string) $row->status) ?></span></td>
                <td>
                    <div style="display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;">
                        <form method="post" action="/equipment/move/<?= esc((string) $row->id) ?>" style="display:flex;gap:.5rem;align-items:center;flex:1;min-width:260px;">
                            <?= csrf_field() ?>
                            <input type="text" name="pallet_qr_code" placeholder="Strekkode fra palle" required style="margin:0;min-width:170px;">
                            <button type="submit" style="margin:0;min-width:120px;">Legg pa palle</button>
                        </form>
                        <form method="post" action="/equipment/delete/<?= esc((string) $row->id) ?>" style="margin:0;">
                            <?= csrf_field() ?>
                            <button class="btn-danger" type="submit" style="margin:0;min-width:90px;">Slett</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
