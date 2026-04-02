<?php
$toasts = [];
$includeSessionFlash = $includeSessionFlash ?? true;

if ($includeSessionFlash) {
    $error = trim((string) session()->getFlashdata('error'));
    if ($error !== '') {
        $toasts[] = [
            'type' => 'error',
            'title' => 'Feilmelding',
            'message' => $error,
            'icon' => 'fa-circle-exclamation',
        ];
    }

    $message = trim((string) session()->getFlashdata('message'));
    if ($message !== '') {
        $toasts[] = [
            'type' => 'success',
            'title' => 'Bekreftelse',
            'message' => $message,
            'icon' => 'fa-circle-check',
        ];
    }
}

foreach (($toastNotifications ?? []) as $toast) {
    $text = trim((string) ($toast['message'] ?? ''));
    if ($text === '') {
        continue;
    }

    $toasts[] = [
        'type' => (string) ($toast['type'] ?? 'info'),
        'title' => (string) ($toast['title'] ?? 'Informasjon'),
        'message' => $text,
        'icon' => (string) ($toast['icon'] ?? 'fa-circle-info'),
    ];
}
?>
<?php if ($toasts !== []): ?>
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
        <?php foreach ($toasts as $toast): ?>
            <div class="app-toast app-toast--<?= esc($toast['type']) ?>" role="alert">
                <div class="app-toast__icon" aria-hidden="true">
                    <i class="fa-solid <?= esc($toast['icon']) ?>"></i>
                </div>
                <div class="app-toast__body">
                    <div class="app-toast__title"><?= esc($toast['title']) ?></div>
                    <div class="app-toast__message"><?= esc($toast['message']) ?></div>
                </div>
                <button type="button" class="app-toast__close" aria-label="Lukk melding">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="app-toast__progress"></div>
            </div>
        <?php endforeach; ?>
    </div>
<?php endif; ?>
