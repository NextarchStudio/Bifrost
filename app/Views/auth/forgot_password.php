<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<div class="row justify-content-center">
    <div class="col-xl-5 col-lg-6 col-md-8">
        <div class="card mt-5">
            <div class="card-body p-4">
                <h4 class="mb-3">Glemt passord</h4>
                <p class="mb-3">Skriv inn e-postadressen din, så sender vi deg en lenke for å velge nytt passord.</p>
                <form method="post" action="<?= base_url('auth/forgot-password') ?>">
                    <?= csrf_field() ?>
                    <div class="mb-3">
                        <label class="form-label">E-post</label>
                        <input type="email" class="form-control" name="email" value="<?= esc(old('email') ?? '') ?>" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Send lenke</button>
                </form>
                <div class="text-center mt-3">
                    <a href="<?= base_url('auth/login') ?>" class="small">Tilbake til innlogging</a>
                </div>
            </div>
        </div>
    </div>
</div>
<?= $this->endSection() ?>
