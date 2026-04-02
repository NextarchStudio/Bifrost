<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
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
                <h4 class="mb-3">Velg passord</h4>
                <p class="mb-3">Du setter passord for <strong><?= esc($email ?? '') ?></strong>.</p>
                <form method="post" action="<?= base_url('auth/reset-password') ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="token" value="<?= esc($token ?? '') ?>">
                    <div class="mb-3">
                        <label class="form-label">Nytt passord</label>
                        <div class="password-field">
                            <input id="resetPasswordField" type="password" class="form-control" name="password" required minlength="10" autocomplete="new-password">
                            <button type="button" class="password-field__toggle" data-password-toggle="#resetPasswordField" aria-label="Vis passord">
                                <i class="fa-regular fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Bekreft passord</label>
                        <div class="password-field">
                            <input id="resetPasswordConfirmationField" type="password" class="form-control" name="password_confirmation" required minlength="10" autocomplete="new-password">
                            <button type="button" class="password-field__toggle" data-password-toggle="#resetPasswordConfirmationField" aria-label="Vis passord">
                                <i class="fa-regular fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Lagre passord</button>
                </form>
            </div>
        </div>
    </div>
</div>
<script>
(() => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const selector = button.getAttribute('data-password-toggle');
            const input = selector ? document.querySelector(selector) : null;
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
