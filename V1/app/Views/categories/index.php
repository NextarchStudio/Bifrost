<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<h1>Kategorier</h1>

<div class="grid">
    <div class="card" style="color:#f8fafc;">
        <h3>Opprett ny kategori</h3>
        <form method="post" action="/categories/create">
            <?= csrf_field() ?>
            <input name="name" placeholder="Kategorinavn" required>
            <button type="submit">Opprett kategori</button>
        </form>
    </div>
</div>

<div class="card" style="color:#f8fafc;">
    <h3>Eksisterende kategorier</h3>
    <table style="color:#f8fafc;">
        <tr><th>ID</th><th>Navn</th><th>Handling</th></tr>
        <?php foreach ($categories as $category): ?>
            <tr>
                <td><?= esc((string) $category['id']) ?></td>
                <td><?= esc((string) $category['name']) ?></td>
                <td>
                    <form method="post" action="/categories/delete/<?= esc((string) $category['id']) ?>" onsubmit="return confirm('Slette kategori?');">
                        <?= csrf_field() ?>
                        <button type="submit" class="btn btn-danger">Slett</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>

