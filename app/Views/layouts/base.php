<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title><?= esc($title ?? 'TG Logistics CMS') ?></title>
    <link rel="icon" type="image/x-icon" href="<?= base_url('admintemplate/src/assets/img/favicon.ico') ?>"/>
    <link href="https://fonts.googleapis.com/css?family=Nunito:400,600,700" rel="stylesheet">

    <link href="<?= base_url('admintemplate/src/bootstrap/css/bootstrap.min.css') ?>" rel="stylesheet" type="text/css"/>
    <link href="<?= base_url('admintemplate/layouts/modern-dark-menu/css/light/plugins.css') ?>" rel="stylesheet" type="text/css"/>
    <link href="<?= base_url('admintemplate/layouts/modern-dark-menu/css/dark/plugins.css') ?>" rel="stylesheet" type="text/css"/>
    <link href="<?= base_url('admintemplate/src/assets/css/light/main.css') ?>" rel="stylesheet" type="text/css"/>
    <link href="<?= base_url('admintemplate/src/assets/css/dark/main.css') ?>" rel="stylesheet" type="text/css"/>
    <script src="https://kit.fontawesome.com/e9608bcacc.js" crossorigin="anonymous"></script>

    <style>
        body.dark {
            background: #0b1220 !important;
            color: #cbd5e1;
        }
        body.dark .main-container,
        body.dark #content,
        body.dark .layout-px-spacing {
            background: #0f172a !important;
        }
        body.dark .card, body.dark .widget, body.dark .statbox {
            background: #111c30 !important;
            border: 1px solid #1f2a44 !important;
            border-radius: 12px;
        }
        body.dark h1, body.dark h2, body.dark h3, body.dark h4, body.dark h5 {
            color: #e2e8f0 !important;
        }
        .layout-px-spacing { padding: 1.25rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
        .card { padding: 1rem; margin-bottom: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: .65rem; border-bottom: 1px solid #1f2a44; vertical-align: top; }
        th { color: #94a3b8; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
        body.dark table th,
        body.dark table td,
        body.dark .table th,
        body.dark .table td,
        body.dark .card table th,
        body.dark .card table td {
            color: #e2e8f0 !important;
            border-color: #24314d !important;
        }
        body.dark .card table tbody tr:nth-child(even) {
            background: rgba(15, 23, 42, .35);
        }
        input, select, textarea { width: 100%; margin-bottom: .6rem; background: #0b1324 !important; color: #dbeafe !important; border: 1px solid #26344f !important; border-radius: .5rem; padding: .55rem .7rem; }
        button, .btn { min-height: 42px; border-radius: .55rem !important; }
        .badge.open, .badge.available, .badge.active, .badge.assigned { background: #16a34a !important; color: #fff; }
        .badge.loaned, .badge.in_progress { background: #ea580c !important; color: #fff; }
        .badge.returned, .badge.completed { background: #475569 !important; color: #fff; }
        .badge.pending { background: #0ea5e9 !important; color: #fff; }
        .badge.approved { background: #16a34a !important; color: #fff; }
        .badge.rejected { background: #dc2626 !important; color: #fff; }
        .badge.partial { background: #f59e0b !important; color: #111827; }
        .badge.fulfilled { background: #475569 !important; color: #fff; }
        .menu a { text-decoration: none; }
        .menu a { display: block; padding: .75rem .9rem; border-radius: .6rem; margin: .2rem .5rem; }
        .menu a .nav-text { color: #d6e2ff; }
        .menu.active > a { background: #1e2a44; }
        .menu.active > a .nav-text { color: #fff; font-weight: 700; }
        .sidebar-wrapper { width: 250px; transition: width .2s ease; overflow: hidden; }
        .main-content { margin-left: 250px; transition: margin-left .2s ease; }
        body.sidebar-collapsed .sidebar-wrapper { width: 82px; }
        body.sidebar-collapsed .main-content { margin-left: 82px; }
        body.sidebar-collapsed .menu a .nav-text { display: none; }
        #menuOverlay {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, .55);
            z-index: 997;
            display: none;
        }
        @media (max-width: 991px) {
            .sidebar-wrapper {
                position: fixed;
                left: -260px;
                top: 0;
                bottom: 0;
                width: 250px;
                z-index: 999;
                transition: left .2s ease;
            }
            .main-content { margin-left: 0; }
            body.sidebar-mobile-open .sidebar-wrapper { left: 0; }
            body.sidebar-mobile-open #menuOverlay { display: block; }
        }
    </style>
</head>
<body class="layout-boxed dark">
<?php if (session()->get('user_id')): ?>
<?php
    $path = trim(service('uri')->getPath(), '/');
    $path = $path === '' ? 'dashboard' : $path;
    $segment = explode('/', $path)[0];
    $profileLink = session('wannabe_id') !== null ? base_url('profil/' . (int) session('wannabe_id')) : base_url('profile');
?>
<div class="header-container container-xxl">
    <header class="header navbar navbar-expand-sm expand-header">
        <button type="button" id="menuToggle" class="btn btn-outline-light me-3" aria-label="Veksle meny">
            <i class="fa-solid fa-bars-staggered"></i>
        </button>
        <a href="<?= base_url('dashboard') ?>" class="navbar-brand d-flex align-items-center gap-2">
            <img src="https://www.tg.no/tg26/tg26_horizontal.svg" class="navbar-logo" alt="TG26 logo" style="height:28px;">
            <span class="text-white fw-bold">TG Logistics</span>
        </a>
        <ul class="navbar-item flex-row ms-lg-auto ms-0">
            <li class="nav-item">
                <a class="nav-link text-white" href="<?= $profileLink ?>">
                    <i class="fa-solid fa-user me-1"></i><?= esc((string) (session('first_name') ?: session('name'))) ?>
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link text-white" href="<?= base_url('auth/logout') ?>">
                    <i class="fa-solid fa-right-from-bracket me-1"></i>Logg ut
                </a>
            </li>
        </ul>
    </header>
</div>

<div class="main-container" id="container">
    <div id="menuOverlay"></div>
    <div class="sidebar-wrapper sidebar-theme">
        <nav id="sidebar">
            <ul class="list-unstyled menu-categories" id="accordionExample">
                <li class="menu <?= $segment === 'dashboard' ? 'active' : '' ?>">
                    <a href="<?= base_url('dashboard') ?>"><i class="fa-solid fa-gauge-high me-2"></i><span class="nav-text">Dashbord</span></a>
                </li>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'skiftleder', 'logistikk'])): ?>
                    <li class="menu <?= $segment === 'equipment' ? 'active' : '' ?>">
                        <a href="<?= base_url('equipment') ?>"><i class="fa-solid fa-toolbox me-2"></i><span class="nav-text">Utstyr</span></a>
                    </li>
                    <li class="menu <?= $segment === 'categories' ? 'active' : '' ?>">
                        <a href="<?= base_url('categories') ?>"><i class="fa-solid fa-layer-group me-2"></i><span class="nav-text">Kategorier</span></a>
                    </li>
                    <li class="menu <?= $segment === 'locations' ? 'active' : '' ?>">
                        <a href="<?= base_url('locations') ?>"><i class="fa-solid fa-location-dot me-2"></i><span class="nav-text">Lokasjoner</span></a>
                    </li>
                <?php endif; ?>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'logistikk'])): ?>
                    <li class="menu <?= $segment === 'warehouse' ? 'active' : '' ?>">
                        <a href="<?= base_url('warehouse') ?>"><i class="fa-solid fa-warehouse me-2"></i><span class="nav-text">Lager</span></a>
                    </li>
                <?php endif; ?>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk'])): ?>
                    <li class="menu <?= $segment === 'loans' ? 'active' : '' ?>">
                        <a href="<?= base_url('loans') ?>"><i class="fa-solid fa-handshake-angle me-2"></i><span class="nav-text">Utlån</span></a>
                    </li>
                <?php endif; ?>
                <?php if (hasRole(['developer', 'chief', 'sambandsansvarlig'])): ?>
                    <li class="menu <?= $segment === 'samband' ? 'active' : '' ?>">
                        <a href="<?= base_url('samband') ?>"><i class="fa-solid fa-tower-broadcast me-2"></i><span class="nav-text">Samband</span></a>
                    </li>
                <?php endif; ?>
                <li class="menu <?= $segment === 'requests' ? 'active' : '' ?>">
                    <a href="<?= base_url('requests') ?>"><i class="fa-solid fa-clipboard-list me-2"></i><span class="nav-text">Forespørsler</span></a>
                </li>
                <li class="menu <?= $segment === 'transport' ? 'active' : '' ?>">
                    <a href="<?= base_url('transport') ?>"><i class="fa-solid fa-truck-fast me-2"></i><span class="nav-text">Transport</span></a>
                </li>
                <?php if (hasRole(['developer', 'chief'])): ?>
                    <li class="menu <?= $segment === 'admin' ? 'active' : '' ?>">
                        <a href="<?= base_url('admin') ?>"><i class="fa-solid fa-user-shield me-2"></i><span class="nav-text">Administrasjon</span></a>
                    </li>
                <?php endif; ?>
            </ul>
        </nav>
    </div>

    <div id="content" class="main-content">
        <div class="layout-px-spacing">
            <?= $this->include('partials/flash') ?>
            <?= $this->renderSection('content') ?>
        </div>
    </div>
</div>
<?php else: ?>
<div class="container py-5">
    <?= $this->include('partials/flash') ?>
    <?= $this->renderSection('content') ?>
</div>
<?php endif; ?>
<script src="<?= base_url('admintemplate/src/bootstrap/js/bootstrap.bundle.min.js') ?>"></script>
<?php if (session()->get('user_id')): ?>
<script>
(() => {
    const body = document.body;
    const toggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('menuOverlay');
    const closeMobile = () => {
        body.classList.remove('sidebar-mobile-open');
    };
    const toggleMenu = () => {
        if (window.innerWidth <= 991) {
            body.classList.toggle('sidebar-mobile-open');
            return;
        }
        body.classList.toggle('sidebar-collapsed');
    };
    toggle?.addEventListener('click', toggleMenu);
    overlay?.addEventListener('click', closeMobile);
    window.addEventListener('resize', () => {
        if (window.innerWidth > 991) {
            closeMobile();
        }
    });
})();
</script>
<?php endif; ?>
</body>
</html>
