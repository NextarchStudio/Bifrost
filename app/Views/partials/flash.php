<?php if (session()->getFlashdata('error')): ?>
    <div class="alert alert-danger"><?= esc((string) session()->getFlashdata('error')) ?></div>
<?php endif; ?>
<?php if (session()->getFlashdata('message')): ?>
    <div class="alert alert-success"><?= esc((string) session()->getFlashdata('message')) ?></div>
<?php endif; ?>
