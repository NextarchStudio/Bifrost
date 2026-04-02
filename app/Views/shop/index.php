<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Shop</h1>
<div class="grid">
    <div class="card">
        <h3>Ny vare</h3>
        <form method="post" action="/shop/items/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Varenavn" value="<?= esc(old('name') ?? '') ?>" required>
            <select name="category_id">
                <option value="">Velg eksisterende kategori</option>
                <?php foreach ($categories as $category): ?>
                    <option value="<?= esc((string) $category['id']) ?>" <?= (string) old('category_id') === (string) $category['id'] ? 'selected' : '' ?>>
                        <?= esc((string) $category['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <input name="new_category" placeholder="Eller skriv ny kategori" value="<?= esc(old('new_category') ?? '') ?>">
            <select name="size">
                <option value="">Ingen størrelse</option>
                <?php foreach ($sizeOptions as $sizeOption): ?>
                    <option value="<?= esc($sizeOption) ?>" <?= (string) old('size') === (string) $sizeOption ? 'selected' : '' ?>>
                        <?= esc($sizeOption) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <small style="display:block;margin-top:-.2rem;margin-bottom:.6rem;color:#94a3b8;">Velg størrelse for klær. La feltet stå tomt for kopper, flasker, musmatter osv.</small>
            <input type="number" min="0" name="quantity" placeholder="Antall på lager" value="<?= esc(old('quantity') ?? '0') ?>" required>
            <textarea name="notes" placeholder="Notater"><?= esc(old('notes') ?? '') ?></textarea>
            <button type="submit">Opprett vare</button>
        </form>
    </div>
    <div class="card">
        <h3>Ny kategori</h3>
        <form method="post" action="/shop/categories/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Kategorinavn" value="<?= esc(old('name') ?? '') ?>" required>
            <button type="submit">Opprett kategori</button>
        </form>
        <hr>
        <h4>Eksisterende kategorier</h4>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap;">
            <?php foreach ($categories as $category): ?>
                <span class="badge pending"><?= esc((string) $category['name']) ?></span>
            <?php endforeach; ?>
        </div>
    </div>
</div>

<div class="card">
    <h3>Varelager</h3>
    <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;">
        <a href="/shop/export/pdf" class="btn btn-outline-light">Last ned PDF</a>
        <a href="/shop/export/excel" class="btn btn-outline-light">Last ned Excel</a>
    </div>
    <table>
        <tr>
            <th>ID</th>
            <th>Vare</th>
            <th>Kategori</th>
            <th>Størrelse</th>
            <th>Antall</th>
            <th>Notater</th>
            <th>Utsjekk</th>
            <th>Innsjekk</th>
            <th>Slett</th>
        </tr>
        <?php foreach ($items as $item): ?>
            <tr>
                <td><?= esc((string) $item->id) ?></td>
                <td><?= esc((string) $item->name) ?></td>
                <td><?= esc((string) $item->category_name) ?></td>
                <td><?= esc((string) ($item->size ?: '-')) ?></td>
                <td><strong><?= esc((string) $item->quantity) ?></strong></td>
                <td><?= esc((string) ($item->notes ?: '-')) ?></td>
                <td>
                    <form method="post" action="/shop/checkout/<?= esc((string) $item->id) ?>">
                        <?= csrf_field() ?>
                        <input type="number" min="1" max="<?= esc((string) max(1, (int) $item->quantity)) ?>" name="quantity" placeholder="Antall" value="1" required>
                        <input name="notes" placeholder="Hvem/hvorfor">
                        <button type="submit" <?= (int) $item->quantity < 1 ? 'disabled' : '' ?>>Sjekk ut</button>
                    </form>
                </td>
                <td>
                    <form method="post" action="/shop/checkin/<?= esc((string) $item->id) ?>">
                        <?= csrf_field() ?>
                        <input type="number" min="1" name="quantity" placeholder="Antall" value="1" required>
                        <input name="notes" placeholder="Kommentar">
                        <button type="submit">Sjekk inn</button>
                    </form>
                </td>
                <td>
                    <form method="post" action="/shop/delete/<?= esc((string) $item->id) ?>" onsubmit="return confirm('Slette denne varen fra shop? Dette fjerner også historikken for varen.');">
                        <?= csrf_field() ?>
                        <button type="submit" class="btn-danger">Slett vare</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<div class="card">
    <h3>Siste bevegelser</h3>
    <table>
        <tr>
            <th>Tid</th>
            <th>Type</th>
            <th>Vare</th>
            <th>Kategori</th>
            <th>Størrelse</th>
            <th>Antall</th>
            <th>Utført av</th>
            <th>Notat</th>
        </tr>
        <?php foreach ($movements as $movement): ?>
            <tr>
                <td><?= esc((string) $movement->created_at) ?></td>
                <td><span class="badge <?= esc((string) $movement->movement_type) ?>"><?= esc((string) $movement->movement_type) ?></span></td>
                <td><?= esc((string) $movement->item_name) ?></td>
                <td><?= esc((string) $movement->category_name) ?></td>
                <td><?= esc((string) ($movement->item_size ?: '-')) ?></td>
                <td><?= esc((string) $movement->quantity) ?></td>
                <td><?= esc((string) ($movement->actor_name ?: '-')) ?></td>
                <td><?= esc((string) ($movement->notes ?: '-')) ?></td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
