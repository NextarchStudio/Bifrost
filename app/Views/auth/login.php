<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<div class="row justify-content-center">
    <div class="col-xl-5 col-lg-6 col-md-8">
        <div class="card mt-5">
            <div class="card-body p-4">
                <div class="text-center mb-4">
                    <img src="https://www.tg.no/tg26/tg26_horizontal.svg" alt="TG26 logo" style="height:40px;">
                    <h4 class="mt-3 mb-0">TG Logistics CMS</h4>
                    <p class="text-muted">Logg inn for å fortsette</p>
                </div>
                <form method="post" action="<?= base_url('auth/login') ?>">
                    <?= csrf_field() ?>
                    <div class="mb-3">
                        <label class="form-label">E-post</label>
                        <input type="email" class="form-control" name="email" value="<?= esc(old('email') ?? '') ?>" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Passord</label>
                        <input type="password" class="form-control" name="password" required>
                        <div class="text-end mt-2">
                            <a href="<?= base_url('auth/forgot-password') ?>" class="small">Glemt passord?</a>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Logg inn lokalt</button>
                </form>
                <div class="d-grid gap-2 mt-3">
                    <?php if ($keycloakEnabled): ?>
                        <a href="<?= base_url('auth/oidc') ?>" class="btn btn-outline-info">Logg inn med Keycloak</a>
                    <?php endif; ?>
                    <?php if ($discordEnabled): ?>
                        <a href="<?= base_url('auth/discord') ?>" class="btn btn-outline-secondary">Logg inn med Discord</a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>
<?= $this->endSection() ?>
