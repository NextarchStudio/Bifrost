<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$typeLabel = static function (string $type): string {
    return match ($type) {
        'bug' => 'Bug',
        'feature' => 'Feature',
        default => $type,
    };
};

$statusLabel = static function (string $status): string {
    return match ($status) {
        'pending' => 'Innmeldt',
        'in_progress' => 'Påbegynt',
        'approved' => 'Godkjent',
        'on_hold' => 'Venter',
        'fixed' => 'Fikset',
        'added' => 'Implementert',
        'rejected' => 'Avslått',
        default => $status,
    };
};
?>
<style>
    .feedback-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: .35rem .65rem;
        border-radius: 999px;
        font-size: .82rem;
        font-weight: 700;
        white-space: nowrap;
    }
    .feedback-status--pending {
        background: #475569;
        color: #fff;
    }
    .feedback-status--on_hold {
        background: #7dd3fc;
        color: #082f49;
    }
    .feedback-status--approved {
        background: #2563eb;
        color: #fff;
    }
    .feedback-status--in_progress {
        background: #f59e0b;
        color: #111827;
    }
    .feedback-status--added,
    .feedback-status--fixed {
        background: #16a34a;
        color: #fff;
    }
    .feedback-status--rejected {
        background: #ef4444;
        color: #fff;
    }
    .feedback-actions {
        display: flex;
        align-items: center;
        gap: .5rem;
        flex-wrap: nowrap;
        white-space: nowrap;
    }
    .feedback-actions form {
        margin: 0;
        flex: 1 1 0;
    }
    .feedback-actions .btn {
        width: 100%;
        min-width: 0;
    }
    .feedback-action--pending {
        background: #475569 !important;
        border-color: #475569 !important;
        color: #fff !important;
    }
    .feedback-action--on_hold {
        background: #7dd3fc !important;
        border-color: #7dd3fc !important;
        color: #082f49 !important;
    }
    .feedback-action--approved {
        background: #2563eb !important;
        border-color: #2563eb !important;
        color: #fff !important;
    }
    .feedback-action--in_progress {
        background: #f59e0b !important;
        border-color: #f59e0b !important;
        color: #111827 !important;
    }
    .feedback-action--added,
    .feedback-action--fixed {
        background: #16a34a !important;
        border-color: #16a34a !important;
        color: #fff !important;
    }
    .feedback-action--rejected {
        background: #ef4444 !important;
        border-color: #ef4444 !important;
        color: #fff !important;
    }
</style>
<h1>Tilbakemeldinger</h1>

<div class="grid">
    <div class="card">
        <h3>Ny tilbakemelding</h3>
        <form method="post" action="/feedback/create" enctype="multipart/form-data">
            <?= csrf_field() ?>
            <select name="type" required>
                <option value="bug" <?= old('type') === 'bug' ? 'selected' : '' ?>>Bug til utvikler</option>
                <option value="feature" <?= old('type') === 'feature' ? 'selected' : '' ?>>Feature</option>
            </select>
            <input type="text" name="title" placeholder="Kort tittel" required value="<?= esc(old('title') ?? '') ?>">
            <textarea name="description" placeholder="Forklar hva du ønsker, hvilken bug du har funnet, og gjerne hva som må rettes." rows="8" required><?= esc(old('description') ?? '') ?></textarea>
            <div data-feedback-attachment-field style="display: <?= old('type', 'bug') === 'bug' ? 'block' : 'none' ?>; margin-bottom: .75rem;">
                <label for="feedback-attachment" style="display:block;margin-bottom:.35rem;">Skjermbilde eller bilde av bug</label>
                <input id="feedback-attachment" type="file" name="attachment" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif">
                <small style="display:block;margin-top:.35rem;color:#94a3b8;">Valgfritt. JPG, PNG, WEBP eller GIF, maks 5 MB.</small>
            </div>
            <label style="display:flex;align-items:center;gap:.45rem;margin-bottom:.75rem;">
                <input type="checkbox" name="needs_database_fix" value="1" <?= old('needs_database_fix') ? 'checked' : '' ?> style="width:auto;margin:0;">
                <span>Dette trenger trolig endringer i database</span>
            </label>
            <button type="submit">Send til utvikler</button>
        </form>
    </div>
</div>

<div class="card">
    <h3>Mine tilbakemeldinger</h3>
    <table>
        <tr><th>ID</th><th>Type</th><th>Tittel</th><th>Database</th><th>Status</th><th>Opprettet</th><th>Handling</th></tr>
        <?php foreach (($myEntries ?? []) as $entry): ?>
            <tr>
                <td><?= esc((string) $entry['id']) ?></td>
                <td><?= esc($typeLabel((string) $entry['type'])) ?></td>
                <td>
                    <strong><?= esc((string) $entry['title']) ?></strong>
                    <div style="margin-top:.25rem;color:#94a3b8;white-space:pre-wrap;"><?= esc((string) $entry['description']) ?></div>
                    <?php if (! empty($entry['attachment_path'])): ?>
                        <div style="margin-top:.75rem;">
                            <a href="<?= esc(base_url('feedback/attachment/' . (int) $entry['id'])) ?>" target="_blank" rel="noopener noreferrer">Åpne vedlagt bilde</a>
                        </div>
                    <?php endif; ?>
                </td>
                <td><?= (int) ($entry['needs_database_fix'] ?? 0) === 1 ? 'Ja' : 'Nei' ?></td>
                <td><span class="feedback-status feedback-status--<?= esc((string) $entry['status']) ?>"><?= esc($statusLabel((string) $entry['status'])) ?></span></td>
                <td><?= esc(format_norwegian_datetime($entry['created_at'] ?? null)) ?></td>
                <td>
                    <?php if ((string) ($entry['status'] ?? 'pending') === 'pending'): ?>
                        <form method="post" action="/feedback/delete/<?= esc((string) $entry['id']) ?>" style="margin:0;">
                            <?= csrf_field() ?>
                            <button type="submit" class="btn btn-danger" style="margin:0;">Slett</button>
                        </form>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if ($canViewAll ?? false): ?>
<div class="card">
    <h3>Innmeldt til utvikler</h3>
    <table>
        <tr><th>ID</th><th>Meldt av</th><th>Wannabe ID</th><th>Type</th><th>Innhold</th><th>Database</th><th>Status</th><th>Opprettet</th><th>Handling</th></tr>
        <?php foreach (($allEntries ?? []) as $entry): ?>
            <?php $entryType = (string) ($entry['type'] ?? 'feature'); ?>
            <tr>
                <td><?= esc((string) $entry['id']) ?></td>
                <td><?= esc((string) $entry['requester_name']) ?></td>
                <td><?= esc((string) ($entry['wannabe_id'] ?? '-')) ?></td>
                <td><?= esc($typeLabel($entryType)) ?></td>
                <td>
                    <strong><?= esc((string) $entry['title']) ?></strong>
                    <div style="margin-top:.25rem;color:#94a3b8;white-space:pre-wrap;"><?= esc((string) $entry['description']) ?></div>
                    <?php if (! empty($entry['attachment_path'])): ?>
                        <div style="margin-top:.75rem;">
                            <a href="<?= esc(base_url('feedback/attachment/' . (int) $entry['id'])) ?>" target="_blank" rel="noopener noreferrer">Åpne vedlagt bilde</a>
                        </div>
                    <?php endif; ?>
                </td>
                <td><?= (int) ($entry['needs_database_fix'] ?? 0) === 1 ? 'Ja' : 'Nei' ?></td>
                <td><span class="feedback-status feedback-status--<?= esc((string) $entry['status']) ?>"><?= esc($statusLabel((string) $entry['status'])) ?></span></td>
                <td><?= esc(format_norwegian_datetime($entry['created_at'] ?? null)) ?></td>
                <td>
                    <?php if (($canManageAll ?? false) && ! in_array((string) ($entry['status'] ?? ''), ['fixed', 'added', 'rejected'], true)): ?>
                        <div class="feedback-actions">
                            <?php if ($entryType === 'bug'): ?>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="in_progress">
                                    <button type="submit" class="btn feedback-action--in_progress">Påbegynt</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="fixed">
                                    <button type="submit" class="btn feedback-action--fixed">Fikset</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="rejected">
                                    <button type="submit" class="btn feedback-action--rejected">Avslå</button>
                                </form>
                            <?php else: ?>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="on_hold">
                                    <button type="submit" class="btn feedback-action--on_hold">Venter</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="approved">
                                    <button type="submit" class="btn feedback-action--approved">Godkjent</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="in_progress">
                                    <button type="submit" class="btn feedback-action--in_progress">Påbegynt</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="added">
                                    <button type="submit" class="btn feedback-action--added">Implementert</button>
                                </form>
                                <form method="post" action="/feedback/status/<?= esc((string) $entry['id']) ?>">
                                    <?= csrf_field() ?>
                                    <input type="hidden" name="status" value="rejected">
                                    <button type="submit" class="btn feedback-action--rejected">Avslå</button>
                                </form>
                            <?php endif; ?>
                        </div>
                    <?php else: ?>
                        -
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>
<script>
(() => {
    const typeSelect = document.querySelector('select[name="type"]');
    const attachmentField = document.querySelector('[data-feedback-attachment-field]');

    if (!(typeSelect instanceof HTMLSelectElement) || !(attachmentField instanceof HTMLElement)) {
        return;
    }

    const syncAttachmentField = () => {
        attachmentField.style.display = typeSelect.value === 'bug' ? 'block' : 'none';
    };

    typeSelect.addEventListener('change', syncAttachmentField);
    syncAttachmentField();
})();
</script>
<?= $this->endSection() ?>
