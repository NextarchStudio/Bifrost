<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Lokasjoner</h1>

<div class="grid">
    <div class="card" style="color:#f8fafc;">
        <h3>Opprett ny lokasjon</h3>
        <form method="post" action="/locations/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Lokasjonsnavn" required value="<?= esc(old('name') ?? '') ?>">
            <select name="type" required>
                <option value="">Velg type</option>
                <option value="Lager" <?= old('type') === 'Lager' ? 'selected' : '' ?>>Lager</option>
                <option value="Scene" <?= old('type') === 'Scene' ? 'selected' : '' ?>>Scene</option>
                <option value="Transport" <?= old('type') === 'Transport' ? 'selected' : '' ?>>Transport</option>
                <option value="Annet" <?= old('type') === 'Annet' ? 'selected' : '' ?>>Annet</option>
            </select>
            <input name="address" placeholder="Adresse (valgfritt)" value="<?= esc(old('address') ?? '') ?>">
            <button type="submit">Opprett lokasjon</button>
        </form>
    </div>
</div>

<div class="card" style="color:#f8fafc;">
    <h3>Eksisterende lokasjoner</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Navn</th><th>Type</th><th>Adresse</th><th>Handling</th></tr>
        <?php foreach ($locations as $location): ?>
            <tr>
                <td><?= esc((string) $location->id) ?></td>
                <td colspan="3">
                    <form method="post" action="/locations/update/<?= esc((string) $location->id) ?>" style="display:grid;grid-template-columns:1fr 180px 1fr auto;gap:.5rem;align-items:start;">
                        <?= csrf_field() ?>
                        <input name="name" value="<?= esc((string) $location->name) ?>" required>
                        <select name="type" required>
                            <?php foreach (['Lager', 'Scene', 'Transport', 'Annet', 'Arkiv'] as $type): ?>
                                <option value="<?= esc($type) ?>" <?= (string) $location->type === $type ? 'selected' : '' ?>><?= esc($type) ?></option>
                            <?php endforeach; ?>
                        </select>
                        <input name="address" value="<?= esc((string) ($location->address ?? '')) ?>" placeholder="Adresse (valgfritt)">
                        <button type="submit">Lagre</button>
                    </form>
                </td>
                <td>
                    <form method="post" action="/locations/delete/<?= esc((string) $location->id) ?>" onsubmit="return confirm('Slette lokasjon?');">
                        <?= csrf_field() ?>
                        <button type="submit" class="btn btn-danger">Slett</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
