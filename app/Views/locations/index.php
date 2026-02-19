<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Lokasjoner</h1>

<div class="grid">
    <div class="card" style="color:#f8fafc;">
        <h3>Opprett ny lokasjon</h3>
        <form method="post" action="/locations/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Lokasjonsnavn" required>
            <select name="type" required>
                <option value="">Velg type</option>
                <option value="Lager">Lager</option>
                <option value="Scene">Scene</option>
                <option value="Transport">Transport</option>
                <option value="Annet">Annet</option>
            </select>
            <button type="submit">Opprett lokasjon</button>
        </form>
    </div>
</div>

<div class="card" style="color:#f8fafc;">
    <h3>Eksisterende lokasjoner</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Navn</th><th>Type</th><th>Handling</th></tr>
        <?php foreach ($locations as $location): ?>
            <tr>
                <td><?= esc((string) $location->id) ?></td>
                <td><?= esc((string) $location->name) ?></td>
                <td><?= esc((string) $location->type) ?></td>
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

