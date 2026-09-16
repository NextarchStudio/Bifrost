<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$statusLabel = static fn (string $status): string => match ($status) {
    'not_started' => 'Ikke startet',
    'in_progress' => 'Pågår',
    'blocked' => 'Blokkert',
    'completed' => 'Ferdig',
    default => $status,
};

$typeLabel = static fn (string $type): string => match ($type) {
    'transport' => 'Transportoppdrag',
    'work' => 'Arbeidsoppgave',
    default => $type,
};

$priorityLabel = static fn (int $priority): string => match ($priority) {
    1 => '1 (Lav)',
    2 => '2 (Middels)',
    3 => '3 (Høy)',
    default => (string) $priority,
};
?>
<h1>Oppgaver</h1>

<?php if ($canManageAll ?? false): ?>
<div class="card">
    <h3>Ny oppgave</h3>
    <form method="post" action="/tasks/create">
        <?= csrf_field() ?>
        <div class="grid">
            <div>
                <label for="task-title">Oppgave</label>
                <input id="task-title" type="text" name="title" placeholder="Oppgavenavn" required value="<?= esc(old('title') ?? '') ?>">
            </div>
            <div>
                <label for="task-type">Type</label>
                <select id="task-type" name="type" required data-task-type>
                    <option value="work" <?= old('type') === 'work' || old('type') === null ? 'selected' : '' ?>>Arbeidsoppgave</option>
                    <option value="transport" <?= old('type') === 'transport' ? 'selected' : '' ?>>Transportoppdrag</option>
                </select>
            </div>
            <div>
                <label for="task-status">Status</label>
                <select id="task-status" name="status" required>
                    <option value="not_started" <?= old('status') === 'not_started' || old('status') === null ? 'selected' : '' ?>>Ikke startet</option>
                    <option value="in_progress" <?= old('status') === 'in_progress' ? 'selected' : '' ?>>Pågår</option>
                    <option value="blocked" <?= old('status') === 'blocked' ? 'selected' : '' ?>>Blokkert</option>
                    <option value="completed" <?= old('status') === 'completed' ? 'selected' : '' ?>>Ferdig</option>
                </select>
            </div>
            <div>
                <label for="task-priority">Prioritet</label>
                <select id="task-priority" name="priority" required>
                    <option value="1" <?= old('priority') === '1' ? 'selected' : '' ?>>1 (Lav)</option>
                    <option value="2" <?= old('priority') === '2' || old('priority') === null ? 'selected' : '' ?>>2 (Middels)</option>
                    <option value="3" <?= old('priority') === '3' ? 'selected' : '' ?>>3 (Høy)</option>
                </select>
            </div>
            <div>
                <label for="task-assigned">Hvem skal gjøre det</label>
                <select id="task-assigned" name="assigned_user_id" required>
                    <option value="">Velg person</option>
                    <?php foreach (($users ?? []) as $user): ?>
                        <option value="<?= esc((string) $user->id) ?>" <?= (string) old('assigned_user_id') === (string) $user->id ? 'selected' : '' ?>>
                            <?= esc((string) $user->name) ?>
                            <?php if (! empty($user->wannabe_id)): ?>
                                (Wannabe <?= esc((string) $user->wannabe_id) ?>)
                            <?php endif; ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label for="task-due-at">Når må det gjøres</label>
                <input id="task-due-at" type="datetime-local" name="due_at" required value="<?= esc(old('due_at') ?? '') ?>">
            </div>
        </div>

        <div class="card" style="padding:.9rem;margin-top:.75rem;" data-transport-task-fields>
            <label for="task-transport-job">Knytt til transportoppdrag</label>
            <select id="task-transport-job" name="transport_job_id">
                <option value="">Ikke knytt til transportoppdrag</option>
                <?php foreach (($transportJobs ?? []) as $job): ?>
                    <option value="<?= esc((string) $job->id) ?>" <?= (string) old('transport_job_id') === (string) $job->id ? 'selected' : '' ?>>
                        #<?= esc((string) $job->id) ?> - <?= esc((string) ($job->description ?? 'Transportoppdrag')) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <label for="task-message">Melding</label>
        <textarea id="task-message" name="message" rows="4" placeholder="Melding fra personen som ønsker noe"><?= esc(old('message') ?? '') ?></textarea>

        <label for="task-description">Beskrivelse</label>
        <textarea id="task-description" name="description" rows="8" placeholder="Beskrivelse av hva som skal gjøres" required><?= esc(old('description') ?? '') ?></textarea>

        <button type="submit">Opprett oppgave</button>
    </form>
</div>
<?php endif; ?>

<div class="card">
    <h3>Mine oppgaver</h3>
    <table>
        <tr>
            <th>ID</th>
            <th>Oppgave</th>
            <th>Type</th>
            <th>Prioritet</th>
            <th>Må gjøres innen</th>
            <th>Status</th>
            <th>Handling</th>
        </tr>
        <?php foreach (($myTasks ?? []) as $task): ?>
            <tr>
                <td><?= esc((string) $task['id']) ?></td>
                <td>
                    <strong><?= esc((string) $task['title']) ?></strong>
                    <div style="margin-top:.3rem;color:#94a3b8;white-space:pre-wrap;"><?= esc((string) $task['description']) ?></div>
                    <?php if (! empty($task['message'])): ?>
                        <div style="margin-top:.55rem;padding:.7rem;background:rgba(15,23,42,.55);border:1px solid #22304b;border-radius:.75rem;">
                            <strong style="display:block;margin-bottom:.2rem;">Melding</strong>
                            <div style="white-space:pre-wrap;"><?= esc((string) $task['message']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if ((string) ($task['type'] ?? '') === 'transport' && ! empty($task['transport_job_id'])): ?>
                        <div style="margin-top:.45rem;">
                            <a href="<?= base_url('transport/inspect/' . (int) $task['transport_job_id']) ?>">
                                Knyttet til transportoppdrag #<?= esc((string) $task['transport_job_id']) ?>
                            </a>
                        </div>
                    <?php endif; ?>
                </td>
                <td><?= esc($typeLabel((string) $task['type'])) ?></td>
                <td><?= esc($priorityLabel((int) $task['priority'])) ?></td>
                <td><?= esc(format_norwegian_datetime($task['due_at'] ?? null)) ?></td>
                <td><span class="badge task-status--<?= esc((string) $task['status']) ?>"><?= esc($statusLabel((string) $task['status'])) ?></span></td>
                <td>
                    <form method="post" action="/tasks/status/<?= esc((string) $task['id']) ?>" style="margin:0;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                        <?= csrf_field() ?>
                        <select name="status" style="margin:0;min-width:170px;">
                            <option value="not_started" <?= (string) $task['status'] === 'not_started' ? 'selected' : '' ?>>Ikke startet</option>
                            <option value="in_progress" <?= (string) $task['status'] === 'in_progress' ? 'selected' : '' ?>>Pågår</option>
                            <option value="blocked" <?= (string) $task['status'] === 'blocked' ? 'selected' : '' ?>>Blokkert</option>
                            <option value="completed" <?= (string) $task['status'] === 'completed' ? 'selected' : '' ?>>Ferdig</option>
                        </select>
                        <button type="submit" style="margin:0;">Lagre status</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if ($canManageAll ?? false): ?>
<div class="card">
    <h3>Alle oppgaver</h3>
    <table>
        <tr>
            <th>ID</th>
            <th>Oppgave</th>
            <th>Type</th>
            <th>Prioritet</th>
            <th>Hvem skal gjøre det</th>
            <th>Må gjøres innen</th>
            <th>Status</th>
        </tr>
        <?php foreach (($allTasks ?? []) as $task): ?>
            <tr>
                <td><?= esc((string) $task['id']) ?></td>
                <td>
                    <strong><?= esc((string) $task['title']) ?></strong>
                    <div style="margin-top:.3rem;color:#94a3b8;white-space:pre-wrap;"><?= esc((string) $task['description']) ?></div>
                    <?php if (! empty($task['message'])): ?>
                        <div style="margin-top:.55rem;padding:.7rem;background:rgba(15,23,42,.55);border:1px solid #22304b;border-radius:.75rem;">
                            <strong style="display:block;margin-bottom:.2rem;">Melding</strong>
                            <div style="white-space:pre-wrap;"><?= esc((string) $task['message']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if ((string) ($task['type'] ?? '') === 'transport' && ! empty($task['transport_job_id'])): ?>
                        <div style="margin-top:.45rem;">
                            <a href="<?= base_url('transport/inspect/' . (int) $task['transport_job_id']) ?>">
                                Knyttet til transportoppdrag #<?= esc((string) $task['transport_job_id']) ?>
                            </a>
                        </div>
                    <?php endif; ?>
                </td>
                <td><?= esc($typeLabel((string) $task['type'])) ?></td>
                <td><?= esc($priorityLabel((int) $task['priority'])) ?></td>
                <td>
                    <?= esc((string) ($task['assigned_name'] ?? '-')) ?>
                    <?php if (! empty($task['assigned_wannabe_id'])): ?>
                        <div style="margin-top:.2rem;color:#94a3b8;">Wannabe <?= esc((string) $task['assigned_wannabe_id']) ?></div>
                    <?php endif; ?>
                </td>
                <td><?= esc(format_norwegian_datetime($task['due_at'] ?? null)) ?></td>
                <td><span class="badge task-status--<?= esc((string) $task['status']) ?>"><?= esc($statusLabel((string) $task['status'])) ?></span></td>
            </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>

<script>
(() => {
    const typeSelect = document.querySelector('[data-task-type]');
    const transportFields = document.querySelector('[data-transport-task-fields]');

    if (!(typeSelect instanceof HTMLSelectElement) || !(transportFields instanceof HTMLElement)) {
        return;
    }

    const refresh = () => {
        transportFields.style.display = typeSelect.value === 'transport' ? '' : 'none';
        if (typeSelect.value !== 'transport') {
            const select = transportFields.querySelector('select');
            if (select instanceof HTMLSelectElement) {
                select.value = '';
            }
        }
    };

    typeSelect.addEventListener('change', refresh);
    refresh();
})();
</script>
<?= $this->endSection() ?>
