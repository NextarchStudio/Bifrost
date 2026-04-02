<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<?php
$settingsRepository = new \App\Repositories\SettingsRepository();
$appSettings = $settingsRepository->get();
$appLogoUrl = trim((string) ($appSettings->logo_url ?? ''));
if ($appLogoUrl === '') {
    $appLogoUrl = 'https://www.tg.no/tg26/tg26_horizontal.svg';
}
?>
<div class="row justify-content-center">
    <div class="col-xl-5 col-lg-6 col-md-8">
        <div class="card mt-5">
            <div class="card-body p-4">
                <style>
                    .password-field {
                        position: relative;
                    }
                    .password-field input {
                        padding-right: 3rem;
                    }
                    .password-field__toggle {
                        position: absolute;
                        top: 50%;
                        right: .65rem;
                        transform: translateY(-50%);
                        width: 2rem;
                        height: 2rem;
                        min-height: 2rem;
                        padding: 0;
                        border: 0;
                        background: transparent !important;
                        color: #94a3b8;
                    }
                </style>
                <div class="text-center mb-4">
                    <img src="<?= esc($appLogoUrl) ?>" alt="TG logo" style="height:40px;">
                    <h4 class="mt-3 mb-0">TG Logistics CMS</h4>
                    <p class="text-muted">Logg inn for å fortsette</p>
                </div>
                <?php if ($localLoginEnabled): ?>
                    <form method="post" action="<?= base_url('auth/login') ?>">
                        <?= csrf_field() ?>
                        <div class="mb-3">
                            <label class="form-label">E-post</label>
                            <input type="email" class="form-control" name="email" value="<?= esc(old('email') ?? '') ?>" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Passord</label>
                            <div class="password-field">
                                <input type="password" class="form-control" name="password" required autocomplete="current-password" data-password-input>
                                <button type="button" class="password-field__toggle" data-password-toggle aria-label="Vis passord">
                                    <i class="fa-regular fa-eye"></i>
                                </button>
                            </div>
                            <div class="text-end mt-2">
                                <a href="<?= base_url('auth/forgot-password') ?>" class="small">Glemt passord?</a>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Logg inn lokalt</button>
                    </form>
                <?php endif; ?>
                <?php if ($keycloakEnabled): ?>
                    <div class="d-grid gap-2 <?= $localLoginEnabled ? 'mt-3' : '' ?>">
                        <a href="<?= base_url('auth/oidc') ?>" class="btn btn-outline-info">Logg inn med SSO</a>
                    </div>
                <?php endif; ?>
                <?php if (! $localLoginEnabled && ! $keycloakEnabled): ?>
                    <?= $this->include('partials/flash', [
                        'includeSessionFlash' => false,
                        'toastNotifications' => [[
                            'type' => 'warning',
                            'title' => 'Innlogging utilgjengelig',
                            'message' => 'Ingen innloggingsmetoder er aktive. Konfigurer OAuth eller skru på lokal innlogging i admin.',
                            'icon' => 'fa-triangle-exclamation',
                        ]],
                    ]) ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
<script>
(() => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const wrapper = button.closest('.password-field');
            const input = wrapper ? wrapper.querySelector('[data-password-input]') : null;
            const icon = button.querySelector('i');
            if (!input) return;

            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.setAttribute('aria-label', reveal ? 'Skjul passord' : 'Vis passord');
            if (icon) {
                icon.className = reveal ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            }
        });
    });
})();
</script>
<?= $this->endSection() ?>
