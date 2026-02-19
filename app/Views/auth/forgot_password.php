<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<div class="row justify-content-center">
    <div class="col-xl-5 col-lg-6 col-md-8">
        <div class="card mt-5">
            <div class="card-body p-4">
                <h4 class="mb-3">Glemt passord</h4>
                <p class="mb-3">Kontakt en administrator for tilbakestilling av passord.</p>
                <a href="<?= base_url('auth/login') ?>" class="btn btn-primary">Tilbake til innlogging</a>
            </div>
        </div>
    </div>
</div>
<?= $this->endSection() ?>

