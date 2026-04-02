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
        html, body {
            background: #111c30 !important;
            max-width: 100%;
            overflow-x: hidden;
        }
        body.dark::before {
            display: none !important;
        }
        body.dark {
            color: #cbd5e1;
        }
        body.dark .header-container,
        .header-container {
            position: fixed;
            top: 0;
            left: 250px;
            right: 0;
            width: calc(100% - 250px);
            margin: 0;
            padding: 0;
            background: linear-gradient(180deg, rgba(8, 15, 28, .99), rgba(13, 22, 38, .97));
            border-bottom: 1px solid #1f2a44;
            box-shadow: none;
            min-height: 0;
            border-radius: 0;
            z-index: 1100;
        }
        .expand-header {
            display: flex;
            align-items: center;
            gap: .9rem;
            min-height: 74px;
            margin: 0;
            padding: .9rem 1.25rem;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
        }
        .header-shell {
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0 1.25rem;
        }
        .navbar-brand {
            display: inline-flex;
            align-items: center;
            gap: .8rem;
            min-width: 0;
            margin-right: auto;
            text-decoration: none;
        }
        .navbar-logo {
            height: 32px;
            width: auto;
            display: block;
        }
        .navbar-brand span {
            white-space: nowrap;
            letter-spacing: .02em;
            font-size: 1rem;
        }
        .navbar-item {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: .55rem;
            flex-wrap: nowrap;
            margin: 0;
            padding: 0;
            list-style: none;
        }
        .navbar-item .nav-item {
            list-style: none;
        }
        .navbar-item .nav-link {
            display: inline-flex;
            align-items: center;
            gap: .45rem;
            min-height: 42px;
            padding: .55rem .85rem;
            border: 1px solid transparent;
            border-radius: .8rem;
            color: #e2e8f0 !important;
            white-space: nowrap;
            transition: background-color .2s ease, border-color .2s ease, color .2s ease;
        }
        .navbar-item .nav-link:hover {
            background: rgba(30, 41, 59, .72);
            border-color: #26344f;
            color: #fff !important;
        }
        .topbar-avatar {
            width: 30px;
            height: 30px;
            border-radius: 999px;
            object-fit: cover;
            border: 1px solid #334155;
            background: #0f172a;
            flex: 0 0 30px;
        }
        .topbar-avatar--fallback {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            border-radius: 999px;
            border: 1px solid #334155;
            background: #0f172a;
            color: #e2e8f0;
            flex: 0 0 30px;
        }
        .notification-item {
            position: relative;
        }
        .notification-toggle {
            position: relative;
        }
        .notification-count {
            position: absolute;
            top: .35rem;
            right: .35rem;
            min-width: 1.1rem;
            height: 1.1rem;
            padding: 0 .22rem;
            border-radius: 999px;
            background: #ef4444;
            color: #fff;
            font-size: .68rem;
            font-weight: 700;
            line-height: 1.1rem;
            text-align: center;
        }
        .notification-panel {
            position: absolute;
            top: calc(100% + .5rem);
            right: 0;
            width: min(420px, calc(100vw - 2rem));
            max-height: min(70vh, 520px);
            overflow-y: auto;
            padding: .85rem;
            background: rgba(11, 19, 36, .98);
            border: 1px solid #24314d;
            border-radius: 1rem;
            box-shadow: 0 24px 60px rgba(2, 6, 23, .45);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(8px);
            transition: opacity .18s ease, visibility .18s ease, transform .18s ease;
        }
        .notification-item.is-open .notification-panel {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(0);
        }
        .notification-panel__title {
            margin: 0 0 .75rem;
            color: #f8fafc;
            font-size: .98rem;
            font-weight: 700;
        }
        .notification-panel__empty {
            margin: 0;
            color: #94a3b8;
            font-size: .9rem;
        }
        .notification-list {
            display: flex;
            flex-direction: column;
            gap: .7rem;
        }
        .notification-card {
            padding: .75rem .85rem;
            background: rgba(15, 23, 42, .82);
            border: 1px solid #22304b;
            border-radius: .9rem;
        }
        .notification-card__meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: .75rem;
            margin-bottom: .35rem;
        }
        .notification-card__status {
            color: #93c5fd;
            font-size: .8rem;
            font-weight: 700;
            letter-spacing: .03em;
            text-transform: uppercase;
        }
        .notification-card__time {
            color: #94a3b8;
            font-size: .78rem;
        }
        .notification-card__title {
            margin: 0;
            color: #f8fafc;
            font-size: .94rem;
            font-weight: 700;
        }
        .notification-card__text {
            margin-top: .25rem;
            color: #cbd5e1;
            font-size: .88rem;
            line-height: 1.45;
            white-space: pre-wrap;
        }
        #menuToggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 46px;
            min-width: 46px;
            height: 46px;
            padding: 0;
            flex: 0 0 46px;
            border-radius: .85rem !important;
            border-color: #314158 !important;
            background: rgba(15, 23, 42, .72) !important;
        }
        body.dark .main-container,
        body.dark .card, body.dark .widget, body.dark .statbox {
            background: #111c30 !important;
            border: 1px solid #1f2a44 !important;
            border-radius: 12px;
        }
        body.dark #content,
        #content.main-content {
            background: #111c30 !important;
            margin-top: 0 !important;
        }
        body.dark h1, body.dark h2, body.dark h3, body.dark h4, body.dark h5 {
            color: #e2e8f0 !important;
        }
        .main-container {
            padding-top: 0;
        }
        .layout-px-spacing { padding: 0 1.25rem 1.25rem; }
        .topbar {
            margin-top: 0;
            margin-bottom: 1.25rem;
        }
        .topbar h1 {
            margin: 0;
        }
        .topbar .muted {
            margin-top: .35rem;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
        .card { padding: 1rem; margin-bottom: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: .65rem; border-bottom: 1px solid #1f2a44; vertical-align: top; }
        th { color: #94a3b8; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
        .card,
        .statbox,
        .widget {
            overflow-x: auto;
        }
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
        .badge.checkin { background: #16a34a !important; color: #fff; }
        .badge.checkout { background: #dc2626 !important; color: #fff; }
        .badge.approved { background: #16a34a !important; color: #fff; }
        .badge.rejected { background: #dc2626 !important; color: #fff; }
        .badge.partial { background: #f59e0b !important; color: #111827; }
        .badge.fulfilled { background: #475569 !important; color: #fff; }
        .badge.task-status--not_started { background: #020617 !important; color: #fff; }
        .badge.task-status--in_progress { background: #7c3aed !important; color: #fff; }
        .badge.task-status--blocked { background: #dc2626 !important; color: #fff; }
        .badge.task-status--completed { background: #16a34a !important; color: #fff; }
        .menu a { text-decoration: none; }
        .menu a { display: block; padding: .75rem .9rem; border-radius: .6rem; margin: .2rem .5rem; }
        .menu a .nav-text { color: #d6e2ff; }
        .menu.active > a { background: #1e2a44; }
        .menu.active > a .nav-text { color: #fff; font-weight: 700; }
        .menu-group {
            margin: .25rem 0;
        }
        .menu-group__toggle {
            width: calc(100% - 1rem);
            margin: .2rem .5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: .75rem;
            padding: .8rem .9rem;
            border: 1px solid #22304b;
            border-radius: .75rem;
            background: rgba(15, 23, 42, .72) !important;
            color: #d6e2ff !important;
            font-weight: 700;
            text-align: left;
        }
        .menu-group__toggle:hover {
            background: rgba(30, 41, 59, .82) !important;
            color: #fff !important;
        }
        .menu-group__toggle-icon {
            transition: transform .2s ease;
        }
        .menu-group.is-open .menu-group__toggle-icon {
            transform: rotate(180deg);
        }
        .menu-group__items {
            display: none;
            padding: .15rem 0 .45rem;
        }
        .menu-group.is-open .menu-group__items {
            display: block;
        }
        .menu-group__items .menu a {
            margin-left: 1rem;
            margin-right: .5rem;
        }
        .sidebar-search {
            padding: .75rem .5rem .35rem;
        }
        .sidebar-search input {
            margin: 0;
        }
        .sidebar-wrapper {
            width: 250px;
            transition: width .2s ease;
            overflow: hidden;
            padding-top: 0 !important;
        }
        #sidebar {
            padding-top: 0 !important;
        }
        #accordionExample,
        .menu-categories {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .sidebar-wrapper .shadow-bottom,
        #sidebar .theme-brand {
            display: none !important;
        }
        .sidebar-wrapper ul.menu-categories,
        #sidebar ul.menu-categories {
            height: calc(100vh - 88px) !important;
            max-height: calc(100vh - 88px) !important;
            overflow-y: auto;
            padding-bottom: 1rem !important;
        }
        #sidebar ul.menu-categories li.menu:first-child {
            margin-top: 0 !important;
        }
        #content.main-content {
            margin-left: 250px !important;
            padding-top: 102px;
            width: auto !important;
            max-width: none !important;
            min-width: 0;
            flex: 1 1 auto;
            transition: margin-left .2s ease, width .2s ease;
        }
        body.sidebar-collapsed .sidebar-wrapper { width: 82px; }
        body.sidebar-collapsed .header-container {
            left: 82px;
            width: calc(100% - 82px);
        }
        body.sidebar-collapsed #content.main-content {
            margin-left: 82px !important;
        }
        body.sidebar-collapsed .menu a .nav-text { display: none; }
        #menuOverlay {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, .55);
            z-index: 1200;
            display: none;
        }
        .toast-stack {
            position: fixed;
            right: 1.25rem;
            bottom: 1.25rem;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: .85rem;
            width: min(360px, calc(100vw - 1.5rem));
            pointer-events: none;
        }
        .app-toast {
            position: relative;
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: start;
            gap: .9rem;
            padding: 1rem 1rem 1rem .95rem;
            overflow: hidden;
            background: rgba(11, 19, 36, .96);
            border: 1px solid #24314d;
            border-radius: 1rem;
            box-shadow: 0 18px 45px rgba(2, 6, 23, .38);
            color: #e2e8f0;
            pointer-events: auto;
            opacity: 0;
            transform: translateY(12px);
            transition: opacity .22s ease, transform .22s ease;
        }
        .app-toast.is-visible {
            opacity: 1;
            transform: translateY(0);
        }
        .app-toast.is-leaving {
            opacity: 0;
            transform: translateY(10px);
        }
        .app-toast::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 4px;
            background: currentColor;
            opacity: .95;
        }
        .app-toast--success {
            color: #86efac;
        }
        .app-toast--error {
            color: #fca5a5;
        }
        .app-toast--warning {
            color: #fcd34d;
        }
        .app-toast--info {
            color: #7dd3fc;
        }
        .app-toast__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.35rem;
            height: 2.35rem;
            border-radius: .85rem;
            background: rgba(148, 163, 184, .12);
            font-size: 1rem;
        }
        .app-toast__body {
            min-width: 0;
        }
        .app-toast__title {
            margin-bottom: .2rem;
            color: #f8fafc;
            font-size: .96rem;
            font-weight: 700;
            line-height: 1.25;
        }
        .app-toast__message {
            color: #cbd5e1;
            font-size: .9rem;
            line-height: 1.45;
            word-break: break-word;
        }
        .app-toast__close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            min-height: 2rem;
            padding: 0;
            border: 0;
            border-radius: .7rem;
            background: transparent !important;
            color: #94a3b8;
            cursor: pointer;
            transition: background-color .2s ease, color .2s ease;
        }
        .app-toast__close:hover {
            background: rgba(148, 163, 184, .12) !important;
            color: #fff;
        }
        .app-toast__progress {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 3px;
            background: currentColor;
            transform-origin: left center;
        }
        .app-confirm {
            position: fixed;
            inset: 0;
            z-index: 2500;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.25rem;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity .18s ease, visibility .18s ease;
        }
        .app-confirm.is-open {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .app-confirm__backdrop {
            position: absolute;
            inset: 0;
            background: rgba(2, 6, 23, .68);
            backdrop-filter: blur(6px);
        }
        .app-confirm__dialog {
            position: relative;
            width: min(460px, 100%);
            padding: 1.25rem;
            background: linear-gradient(180deg, #152238, #10192b);
            border: 1px solid #26344f;
            border-radius: 1rem;
            box-shadow: 0 24px 80px rgba(2, 6, 23, .5);
            color: #e2e8f0;
        }
        .app-confirm__title {
            margin: 0 0 .6rem;
            font-size: 1.15rem;
            font-weight: 700;
            color: #f8fafc;
        }
        .app-confirm__message {
            margin: 0;
            color: #cbd5e1;
            line-height: 1.55;
        }
        .app-confirm__actions {
            display: flex;
            justify-content: flex-end;
            gap: .75rem;
            margin-top: 1.25rem;
        }
        .app-confirm__actions .btn {
            min-width: 120px;
        }
        .page-shell {
            padding-bottom: 88px;
        }
        .app-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1400;
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 1rem;
            min-height: 58px;
            padding: .85rem 1.25rem;
            background: rgba(8, 15, 28, .96);
            border-top: 1px solid #1f2a44;
            box-shadow: 0 -12px 32px rgba(2, 6, 23, .28);
            backdrop-filter: blur(10px);
            color: #dbeafe;
        }
        .app-footer__left,
        .app-footer__center,
        .app-footer__right {
            font-size: .92rem;
            line-height: 1.35;
            white-space: nowrap;
        }
        .app-footer__left {
            justify-self: start;
        }
        .app-footer__center {
            justify-self: center;
            text-align: center;
        }
        .app-footer__right {
            justify-self: end;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .app-footer__heart {
            color: #f87171;
            margin: 0 .2rem;
        }
        .app-footer a {
            color: #93c5fd;
            text-decoration: none;
        }
        .app-footer a:hover {
            color: #dbeafe;
            text-decoration: underline;
        }
        @media (max-width: 991px) {
            body.sidebar-mobile-open {
                overflow: hidden;
            }
            .expand-header {
                align-items: center;
                flex-wrap: wrap;
                padding: .85rem .9rem;
            }
            .navbar-brand {
                flex: 1 1 auto;
                max-width: calc(100% - 58px);
                gap: .65rem;
            }
            .navbar-logo {
                height: 26px;
            }
            .navbar-brand span {
                font-size: .95rem;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .navbar-item {
                width: 100%;
                justify-content: space-between;
                gap: .5rem;
                flex-wrap: wrap;
                margin-top: .15rem;
            }
            .navbar-item .nav-item {
                flex: 1 1 calc(50% - .25rem);
            }
            .navbar-item .nav-link {
                width: 100%;
                justify-content: center;
                min-height: 42px;
                padding: .65rem .75rem;
                border-color: #26344f;
                background: rgba(15, 23, 42, .8);
            }
            .notification-panel {
                position: fixed;
                top: 6.5rem;
                left: .85rem;
                right: .85rem;
                width: auto;
                max-height: 60vh;
            }
            .header-shell {
                padding: 0 .85rem;
            }
            .header-container {
                left: 0;
                width: 100%;
            }
            #content.main-content {
                padding-top: 126px;
            }
            .layout-px-spacing {
                padding: 0 .85rem .85rem;
            }
            .page-shell {
                padding-bottom: 120px;
            }
            .app-footer {
                grid-template-columns: 1fr;
                justify-items: center;
                text-align: center;
                gap: .35rem;
                padding: .8rem .9rem;
            }
            .app-footer__left,
            .app-footer__center,
            .app-footer__right {
                justify-self: center;
                white-space: normal;
                text-align: center;
            }
            .topbar {
                margin-top: 0;
                margin-bottom: 1rem;
            }
            .grid {
                grid-template-columns: 1fr;
            }
            table {
                min-width: 640px;
            }
            .main-container:not(.sbar-open) .sidebar-wrapper {
                left: -260px !important;
                width: 250px !important;
            }
            .sidebar-wrapper {
                position: fixed;
                left: -260px;
                top: 0;
                bottom: 0;
                width: 250px;
                z-index: 1250;
                padding-top: 0;
                background: #0f172a;
                box-shadow: 0 18px 60px rgba(2, 6, 23, .45);
                transition: left .2s ease;
                overflow-y: auto;
            }
            #sidebar {
                height: calc(100vh - 120px) !important;
                padding-bottom: 120px !important;
            }
            .sidebar-wrapper ul.menu-categories,
            #sidebar ul.menu-categories {
                height: calc(100vh - 120px) !important;
                max-height: calc(100vh - 120px) !important;
                padding-bottom: 1.25rem !important;
            }
            #content.main-content {
                margin-left: 0 !important;
                padding-top: 126px;
                width: 100% !important;
            }
            body.sidebar-mobile-open .main-container.sbar-open .sidebar-wrapper { left: 0 !important; }
            body.sidebar-mobile-open #menuOverlay { display: block; }
        }
        @media (max-width: 575px) {
            .toast-stack {
                right: .75rem;
                bottom: .75rem;
                width: calc(100vw - 1rem);
            }
            .navbar-item .nav-link {
                font-size: .9rem;
            }
            .navbar-item .nav-link i {
                margin-right: .35rem !important;
            }
        }
</style>
</head>
<body class="layout-boxed dark">
<?php $appTimezone = config('App')->appTimezone; ?>
<?php $appVersion = 'v0.6.14'; ?>
<?php if (session()->get('user_id')): ?>
<?php
    $settingsRepository = new \App\Repositories\SettingsRepository();
    $feedbackService = new \App\Services\FeedbackService();
    $appSettings = $settingsRepository->get();
    $feedbackBlocked = hasRole('ingen_tilbakemeldinger');
    $notificationPayload = $feedbackService->notificationPayload((int) session('user_id'));
    $feedbackAnnouncements = (array) ($notificationPayload['items'] ?? []);
    $feedbackUnreadCount = (int) ($notificationPayload['unreadCount'] ?? 0);
    $appLogoUrl = trim((string) ($appSettings->logo_url ?? ''));
    if ($appLogoUrl === '') {
        $appLogoUrl = 'https://www.tg.no/tg26/tg26_horizontal.svg';
    }
    $path = trim(service('uri')->getPath(), '/');
    $path = $path === '' ? 'dashboard' : $path;
    $segment = explode('/', $path)[0];
    $operationsSegments = ['shop', 'warehouse', 'categories', 'locations', 'samband', 'requests', 'transport', 'tasks'];
    $assetSegments = ['equipment', 'loans', 'vehicles'];
    $toolsSegments = ['strekkoder', 'privat-utstyr', 'feedback', 'admin'];
    $profileLink = session('wannabe_id') !== null ? base_url('profil/' . (int) session('wannabe_id')) : base_url('profile');
    $profilePictureUrl = (! empty(session('can_show_profile_picture')) && session('wannabe_id') !== null)
        ? base_url('profile/picture/' . (int) session('wannabe_id'))
        : null;
?>
<div class="header-container">
    <div class="header-shell">
        <header class="header navbar navbar-expand-sm expand-header">
        <button type="button" id="menuToggle" class="btn btn-outline-light me-3" aria-label="Veksle meny">
            <i class="fa-solid fa-bars-staggered"></i>
        </button>
        <a href="<?= base_url('dashboard') ?>" class="navbar-brand d-flex align-items-center gap-2">
            <img src="<?= esc($appLogoUrl) ?>" class="navbar-logo" alt="TG logo" style="height:28px;">
            <span class="text-white fw-bold">TG Logistics</span>
        </a>
        <ul class="navbar-item flex-row ms-lg-auto ms-0">
            <li class="nav-item notification-item" data-role="notification-menu" data-fetch-url="<?= esc(base_url('feedback/notifications')) ?>" data-read-url="<?= esc(base_url('feedback/notifications/read')) ?>" data-csrf-name="<?= esc(csrf_token()) ?>" data-csrf-hash="<?= esc(csrf_hash()) ?>">
                <button type="button" class="nav-link text-white notification-toggle" data-role="notification-toggle" aria-expanded="false" aria-label="Vis varsler">
                    <i class="fa-solid fa-bell"></i>
                    <?php if ($feedbackUnreadCount > 0): ?>
                        <span class="notification-count" data-role="notification-count"><?= esc((string) $feedbackUnreadCount) ?></span>
                    <?php endif; ?>
                </button>
                <div class="notification-panel" data-role="notification-panel">
                    <h2 class="notification-panel__title">Siste oppdateringer</h2>
                    <div class="notification-list" data-role="notification-list">
                        <?php if ($feedbackAnnouncements === []): ?>
                            <p class="notification-panel__empty" data-role="notification-empty">Ingen nye oppdateringer enda.</p>
                        <?php else: ?>
                            <?php foreach ($feedbackAnnouncements as $announcement): ?>
                                <article class="notification-card" data-id="<?= esc((string) ($announcement['id'] ?? 0)) ?>">
                                    <div class="notification-card__meta">
                                        <span class="notification-card__status"><?= esc((string) ($announcement['status_label'] ?? $announcement['status'] ?? '')) ?></span>
                                        <span class="notification-card__time"><?= esc((string) ($announcement['created_at_label'] ?? '-')) ?></span>
                                    </div>
                                    <p class="notification-card__title"><?= esc((string) ($announcement['title'] ?? 'Oppdatering')) ?></p>
                                    <div class="notification-card__text"><?= esc((string) ($announcement['message'] ?? '')) ?></div>
                                </article>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>
            </li>
            <li class="nav-item">
                <a class="nav-link text-white" href="<?= $profileLink ?>">
                    <?php if ($profilePictureUrl !== null): ?>
                        <img src="<?= esc($profilePictureUrl) ?>" alt="Profilbilde" class="topbar-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                        <span class="topbar-avatar--fallback" style="display:none;"><i class="fa-solid fa-user"></i></span>
                    <?php else: ?>
                        <span class="topbar-avatar--fallback"><i class="fa-solid fa-user"></i></span>
                    <?php endif; ?>
                    <?= esc((string) (session('first_name') ?: session('name'))) ?>
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
</div>

<div class="main-container" id="container">
    <div id="menuOverlay"></div>
    <div class="sidebar-wrapper sidebar-theme">
        <nav id="sidebar">
            <ul class="list-unstyled menu-categories" id="accordionExample">
                <li class="sidebar-search">
                    <input type="text" id="sidebarMenuSearch" placeholder="Søk i menyen">
                </li>
                <li class="menu <?= $segment === 'dashboard' ? 'active' : '' ?>">
                    <a href="<?= base_url('dashboard') ?>"><i class="fa-solid fa-gauge-high me-2"></i><span class="nav-text">Dashbord</span></a>
                </li>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'logistikk'])): ?>
                    <li class="menu-group <?= in_array($segment, $assetSegments, true) ? 'is-open' : '' ?>" data-menu-group>
                        <button type="button" class="menu-group__toggle" data-menu-group-toggle aria-expanded="<?= in_array($segment, $assetSegments, true) ? 'true' : 'false' ?>">
                            <span><i class="fa-solid fa-boxes-stacked me-2"></i>Utstyr og utlån</span>
                            <i class="fa-solid fa-chevron-down menu-group__toggle-icon"></i>
                        </button>
                        <ul class="list-unstyled menu-group__items">
                            <li class="menu <?= $segment === 'equipment' ? 'active' : '' ?>">
                                <a href="<?= base_url('equipment') ?>"><i class="fa-solid fa-toolbox me-2"></i><span class="nav-text">Utstyr</span></a>
                            </li>
                            <li class="menu <?= $segment === 'loans' ? 'active' : '' ?>">
                                <a href="<?= base_url('loans') ?>"><i class="fa-solid fa-handshake-angle me-2"></i><span class="nav-text">Utlån</span></a>
                            </li>
                            <li class="menu <?= $segment === 'vehicles' ? 'active' : '' ?>">
                                <a href="<?= base_url('vehicles') ?>"><i class="fa-solid fa-car-side me-2"></i><span class="nav-text">Kjøretøy</span></a>
                            </li>
                        </ul>
                    </li>
                <?php endif; ?>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'logistikk', 'sambandsansvarlig'])): ?>
                    <li class="menu-group <?= in_array($segment, $operationsSegments, true) ? 'is-open' : '' ?>" data-menu-group>
                        <button type="button" class="menu-group__toggle" data-menu-group-toggle aria-expanded="<?= in_array($segment, $operationsSegments, true) ? 'true' : 'false' ?>">
                            <span><i class="fa-solid fa-truck-ramp-box me-2"></i>Drift og logistikk</span>
                            <i class="fa-solid fa-chevron-down menu-group__toggle-icon"></i>
                        </button>
                        <ul class="list-unstyled menu-group__items">
                            <?php if (hasRole(['developer', 'chief', 'co-chief', 'logistikk'])): ?>
                                <li class="menu <?= $segment === 'shop' ? 'active' : '' ?>">
                                    <a href="<?= base_url('shop') ?>"><i class="fa-solid fa-store me-2"></i><span class="nav-text">Shop</span></a>
                                </li>
                                <li class="menu <?= $segment === 'warehouse' ? 'active' : '' ?>">
                                    <a href="<?= base_url('warehouse') ?>"><i class="fa-solid fa-warehouse me-2"></i><span class="nav-text">Lager</span></a>
                                </li>
                                <li class="menu <?= $segment === 'categories' ? 'active' : '' ?>">
                                    <a href="<?= base_url('categories') ?>"><i class="fa-solid fa-layer-group me-2"></i><span class="nav-text">Kategorier</span></a>
                                </li>
                                <li class="menu <?= $segment === 'locations' ? 'active' : '' ?>">
                                    <a href="<?= base_url('locations') ?>"><i class="fa-solid fa-location-dot me-2"></i><span class="nav-text">Lokasjoner</span></a>
                                </li>
                            <?php endif; ?>
                            <?php if (hasRole(['developer', 'chief', 'co-chief', 'logistikk', 'sambandsansvarlig'])): ?>
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
                            <li class="menu <?= $segment === 'tasks' ? 'active' : '' ?>">
                                <a href="<?= base_url('tasks') ?>"><i class="fa-solid fa-list-check me-2"></i><span class="nav-text">Oppgaver</span></a>
                            </li>
                        </ul>
                    </li>
                <?php endif; ?>
                <?php if (hasRole(['developer', 'chief', 'co-chief', 'logistikk'])): ?>
                    <li class="menu-group <?= in_array($segment, $toolsSegments, true) ? 'is-open' : '' ?>" data-menu-group>
                        <button type="button" class="menu-group__toggle" data-menu-group-toggle aria-expanded="<?= in_array($segment, $toolsSegments, true) ? 'true' : 'false' ?>">
                            <span><i class="fa-solid fa-screwdriver-wrench me-2"></i>Verktøy</span>
                            <i class="fa-solid fa-chevron-down menu-group__toggle-icon"></i>
                        </button>
                        <ul class="list-unstyled menu-group__items">
                            <li class="menu <?= $segment === 'strekkoder' ? 'active' : '' ?>">
                                <a href="<?= base_url('strekkoder') ?>"><i class="fa-solid fa-barcode me-2"></i><span class="nav-text">Strekkoder</span></a>
                            </li>
                            <li class="menu <?= $segment === 'privat-utstyr' ? 'active' : '' ?>">
                                <a href="<?= base_url('privat-utstyr') ?>"><i class="fa-solid fa-user-lock me-2"></i><span class="nav-text">Privat Utstyr</span></a>
                            </li>
                            <?php if (! hasRole('ingen_tilbakemeldinger')): ?>
                            <li class="menu <?= $segment === 'feedback' ? 'active' : '' ?>">
                                <a href="<?= base_url('feedback') ?>"><i class="fa-solid fa-bug me-2"></i><span class="nav-text">Tilbakemeldinger</span></a>
                            </li>
                            <?php endif; ?>
                            <?php if (hasRole(['developer', 'chief', 'co-chief'])): ?>
                                <li class="menu <?= $segment === 'admin' ? 'active' : '' ?>">
                                    <a href="<?= base_url('admin') ?>"><i class="fa-solid fa-user-shield me-2"></i><span class="nav-text">Administrasjon</span></a>
                                </li>
                            <?php endif; ?>
                        </ul>
                    </li>
                <?php endif; ?>
            </ul>
        </nav>
    </div>

    <div id="content" class="main-content page-shell">
        <div class="layout-px-spacing">
            <?= $this->include('partials/flash') ?>
            <?= $this->renderSection('content') ?>
        </div>
    </div>
</div>
<?php else: ?>
<div class="container py-5 page-shell">
    <?= $this->include('partials/flash') ?>
    <?= $this->renderSection('content') ?>
</div>
<?php endif; ?>
<footer class="app-footer" data-app-timezone="<?= esc($appTimezone) ?>">
    <div class="app-footer__left">Laget med <i class="fa-solid fa-heart app-footer__heart" aria-hidden="true"></i> for <a href="https://tg.no" target="_blank" rel="noopener noreferrer">TG</a> (<?= esc($appVersion) ?>)</div>
    <div class="app-footer__center">Kopirett &copy; <a href="https://angel.legacyhosting.xyz" target="_blank" rel="noopener noreferrer">Angel Knutsen Aune</a></div>
    <div class="app-footer__right" id="appFooterClock">--/--/---- --:--:--</div>
</footer>
<div class="app-confirm" id="appConfirm" aria-hidden="true">
    <div class="app-confirm__backdrop" data-confirm-close="cancel"></div>
    <div class="app-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" aria-describedby="appConfirmMessage">
        <h2 class="app-confirm__title" id="appConfirmTitle">Bekreft handling</h2>
        <p class="app-confirm__message" id="appConfirmMessage">Er du sikker på at du vil fortsette?</p>
        <div class="app-confirm__actions">
            <button type="button" class="btn btn-outline-light" data-confirm-close="cancel">Avbryt</button>
            <button type="button" class="btn btn-danger" id="appConfirmAccept">Bekreft</button>
        </div>
    </div>
</div>
<script src="<?= base_url('admintemplate/src/bootstrap/js/bootstrap.bundle.min.js') ?>"></script>
<script>
(() => {
    const createToast = ({ type = 'info', title = 'Informasjon', message = '', icon = 'fa-circle-info' }) => {
        if (!message) {
            return;
        }

        let stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('aria-live', 'polite');
            stack.setAttribute('aria-atomic', 'true');
            document.body.appendChild(stack);
        }

        const toast = document.createElement('div');
        toast.className = `app-toast app-toast--${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="app-toast__icon" aria-hidden="true">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="app-toast__body">
                <div class="app-toast__title"></div>
                <div class="app-toast__message"></div>
            </div>
            <button type="button" class="app-toast__close" aria-label="Lukk melding">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="app-toast__progress"></div>
        `;
        toast.querySelector('.app-toast__title').textContent = title;
        toast.querySelector('.app-toast__message').textContent = message;
        stack.appendChild(toast);

        const progress = toast.querySelector('.app-toast__progress');
        const closeButton = toast.querySelector('.app-toast__close');
        const TOAST_DURATION = 5000;
        let remaining = TOAST_DURATION;
        let startedAt = 0;
        let timerId = 0;
        let rafId = 0;

        const clearScheduledWork = () => {
            if (timerId) {
                window.clearTimeout(timerId);
                timerId = 0;
            }
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
        };

        const removeToast = () => {
            if (toast.dataset.closing === 'true') {
                return;
            }
            toast.dataset.closing = 'true';
            clearScheduledWork();
            toast.classList.remove('is-visible');
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 220);
        };

        const renderProgress = () => {
            if (!(progress instanceof HTMLElement)) {
                return;
            }
            const ratio = Math.max(0, Math.min(1, remaining / TOAST_DURATION));
            progress.style.transform = `scaleX(${ratio})`;
        };

        const tick = () => {
            const elapsed = Date.now() - startedAt;
            remaining = Math.max(0, remaining - elapsed);
            renderProgress();

            if (remaining <= 0) {
                removeToast();
                return;
            }

            startedAt = Date.now();
            timerId = window.setTimeout(tick, remaining);
        };

        const resume = () => {
            if (toast.dataset.closing === 'true' || timerId) {
                return;
            }
            startedAt = Date.now();
            timerId = window.setTimeout(tick, remaining);
        };

        const pause = () => {
            if (!timerId) {
                return;
            }
            window.clearTimeout(timerId);
            timerId = 0;
            remaining = Math.max(0, remaining - (Date.now() - startedAt));
            renderProgress();
        };

        closeButton?.addEventListener('click', removeToast);
        toast.addEventListener('mouseenter', pause);
        toast.addEventListener('mouseleave', resume);

        renderProgress();
        rafId = window.requestAnimationFrame(() => {
            toast.classList.add('is-visible');
            resume();
        });
    };

    window.appShowToast = createToast;

    const TOAST_DURATION = 5000;

    document.querySelectorAll('.app-toast').forEach((toast) => {
        const progress = toast.querySelector('.app-toast__progress');
        const closeButton = toast.querySelector('.app-toast__close');
        let remaining = TOAST_DURATION;
        let startedAt = 0;
        let timerId = 0;
        let rafId = 0;

        const clearScheduledWork = () => {
            if (timerId) {
                window.clearTimeout(timerId);
                timerId = 0;
            }
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
        };

        const removeToast = () => {
            if (toast.dataset.closing === 'true') {
                return;
            }
            toast.dataset.closing = 'true';
            clearScheduledWork();
            toast.classList.remove('is-visible');
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 220);
        };

        const renderProgress = () => {
            if (!progress) {
                return;
            }
            const ratio = Math.max(0, Math.min(1, remaining / TOAST_DURATION));
            progress.style.transform = `scaleX(${ratio})`;
        };

        const tick = () => {
            const elapsed = Date.now() - startedAt;
            remaining = Math.max(0, remaining - elapsed);
            renderProgress();

            if (remaining <= 0) {
                removeToast();
                return;
            }

            startedAt = Date.now();
            timerId = window.setTimeout(tick, remaining);
        };

        const resume = () => {
            if (toast.dataset.closing === 'true' || timerId) {
                return;
            }
            startedAt = Date.now();
            timerId = window.setTimeout(tick, remaining);
        };

        const pause = () => {
            if (!timerId) {
                return;
            }
            window.clearTimeout(timerId);
            timerId = 0;
            remaining = Math.max(0, remaining - (Date.now() - startedAt));
            renderProgress();
        };

        closeButton?.addEventListener('click', removeToast);
        toast.addEventListener('mouseenter', pause);
        toast.addEventListener('mouseleave', resume);

        renderProgress();
        rafId = window.requestAnimationFrame(() => {
            toast.classList.add('is-visible');
            resume();
        });
    });
})();
</script>
<script>
(() => {
    const modal = document.getElementById('appConfirm');
    const messageNode = document.getElementById('appConfirmMessage');
    const acceptButton = document.getElementById('appConfirmAccept');

    if (!modal || !messageNode || !acceptButton) {
        return;
    }

    const confirmPattern = /confirm\(\s*(['"])(.*?)\1\s*\)/;
    let activeResolver = null;
    let lastFocusedElement = null;

    const extractConfirmMessage = (value) => {
        if (!value || !value.includes('confirm(')) {
            return null;
        }

        const match = value.match(confirmPattern);
        if (!match) {
            return null;
        }

        return match[2]
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    };

    const normalizeLegacyConfirmAttributes = () => {
        document.querySelectorAll('form[onsubmit], a[onclick], button[onclick], input[onclick]').forEach((element) => {
            const attributeName = element.hasAttribute('onsubmit') ? 'onsubmit' : 'onclick';
            const attributeValue = element.getAttribute(attributeName) || '';
            const message = extractConfirmMessage(attributeValue);

            if (!message) {
                return;
            }

            element.dataset.confirmMessage = message;
            element.removeAttribute(attributeName);
        });
    };

    const closeModal = (confirmed) => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (typeof activeResolver === 'function') {
            activeResolver(confirmed);
            activeResolver = null;
        }

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        }
    };

    const openModal = (message) => new Promise((resolve) => {
        activeResolver = resolve;
        lastFocusedElement = document.activeElement;
        messageNode.textContent = message || 'Er du sikker på at du vil fortsette?';
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => acceptButton.focus(), 0);
    });

    modal.querySelectorAll('[data-confirm-close]').forEach((element) => {
        element.addEventListener('click', () => closeModal(false));
    });

    acceptButton.addEventListener('click', () => closeModal(true));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal(false);
        }
    });

    const bindConfirmHandlers = () => {
        document.querySelectorAll('form[data-confirm-message]').forEach((form) => {
            if (!(form instanceof HTMLFormElement) || form.dataset.confirmBound === 'true') {
                return;
            }

            form.dataset.confirmBound = 'true';
            form.addEventListener('submit', async (event) => {
                const message = form.dataset.confirmMessage;
                if (!message || form.dataset.confirmBypass === 'true') {
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();

                const confirmed = await openModal(message);
                if (!confirmed) {
                    return;
                }

                form.dataset.confirmBypass = 'true';
                form.submit();
                window.setTimeout(() => {
                    delete form.dataset.confirmBypass;
                }, 0);
            });
        });

        document.querySelectorAll('a[data-confirm-message], button[data-confirm-message], input[data-confirm-message]').forEach((trigger) => {
            if (!(trigger instanceof HTMLElement) || trigger.dataset.confirmBound === 'true') {
                return;
            }

            trigger.dataset.confirmBound = 'true';
            trigger.addEventListener('click', async (event) => {
                const message = trigger.dataset.confirmMessage;
                if (!message || trigger.dataset.confirmBypass === 'true') {
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();

                const confirmed = await openModal(message);
                if (!confirmed) {
                    return;
                }

                if (trigger instanceof HTMLAnchorElement && trigger.href) {
                    window.location.href = trigger.href;
                    return;
                }

                if (trigger instanceof HTMLButtonElement || trigger instanceof HTMLInputElement) {
                    const form = trigger.form;
                    if (form instanceof HTMLFormElement) {
                        form.dataset.confirmBypass = 'true';
                        form.requestSubmit(trigger);
                        window.setTimeout(() => {
                            delete form.dataset.confirmBypass;
                        }, 0);
                        return;
                    }
                }
            });
        });
    };

    normalizeLegacyConfirmAttributes();
    bindConfirmHandlers();
})();
</script>
<script>
(() => {
    const notificationMenu = document.querySelector('[data-role="notification-menu"]');
    const notificationToggle = document.querySelector('[data-role="notification-toggle"]');

    if (notificationMenu instanceof HTMLElement && notificationToggle instanceof HTMLElement) {
        const notificationList = notificationMenu.querySelector('[data-role="notification-list"]');
        const fetchUrl = notificationMenu.getAttribute('data-fetch-url') || '';
        const readUrl = notificationMenu.getAttribute('data-read-url') || '';
        const csrfName = notificationMenu.getAttribute('data-csrf-name') || '';
        let csrfHash = notificationMenu.getAttribute('data-csrf-hash') || '';
        let knownIds = new Set(
            [...notificationList.querySelectorAll('.notification-card')]
                .map((card) => Number(card.getAttribute('data-id')))
                .filter((id) => Number.isInteger(id) && id > 0)
        );

        const escapeHtml = (value) => {
            const div = document.createElement('div');
            div.textContent = value ?? '';
            return div.innerHTML;
        };

        const getCountNode = () => notificationMenu.querySelector('[data-role="notification-count"]');

        const updateUnreadCount = (count) => {
            const countNode = getCountNode();
            if (count <= 0) {
                countNode?.remove();
                return;
            }

            if (countNode instanceof HTMLElement) {
                countNode.textContent = String(count);
                return;
            }

            const badge = document.createElement('span');
            badge.className = 'notification-count';
            badge.setAttribute('data-role', 'notification-count');
            badge.textContent = String(count);
            notificationToggle.appendChild(badge);
        };

        const renderNotifications = (items) => {
            if (!(notificationList instanceof HTMLElement)) {
                return;
            }

            if (!Array.isArray(items) || items.length === 0) {
                notificationList.innerHTML = '<p class="notification-panel__empty" data-role="notification-empty">Ingen nye oppdateringer enda.</p>';
                knownIds = new Set();
                return;
            }

            notificationList.innerHTML = items.map((item) => `
                <article class="notification-card" data-id="${Number(item.id) || 0}">
                    <div class="notification-card__meta">
                        <span class="notification-card__status">${escapeHtml(item.status_label || item.status || '')}</span>
                        <span class="notification-card__time">${escapeHtml(item.created_at_label || '')}</span>
                    </div>
                    <p class="notification-card__title">${escapeHtml(item.title || 'Oppdatering')}</p>
                    <div class="notification-card__text">${escapeHtml(item.message || '')}</div>
                </article>
            `).join('');

            knownIds = new Set(items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0));
        };

        const markRead = async () => {
            if (!readUrl || !csrfName || !csrfHash) {
                return;
            }

            const body = new URLSearchParams();
            body.set(csrfName, csrfHash);

            try {
                const response = await fetch(readUrl, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    },
                    body: body.toString(),
                    credentials: 'same-origin',
                });
                const payload = await response.json();
                if (payload && typeof payload.csrfHash === 'string' && payload.csrfHash !== '') {
                    csrfHash = payload.csrfHash;
                }
                updateUnreadCount(0);
            } catch (_) {
                return;
            }
        };

        const pollNotifications = async () => {
            if (!fetchUrl) {
                return;
            }

            try {
                const response = await fetch(fetchUrl, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                const items = Array.isArray(payload.items) ? payload.items : [];
                const newIds = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
                const hasFreshUnread = newIds.some((id) => !knownIds.has(id));
                renderNotifications(items);
                updateUnreadCount(Number(payload.unreadCount || 0));

                if (hasFreshUnread && !notificationMenu.classList.contains('is-open')) {
                    notificationToggle.classList.add('text-warning');
                    window.setTimeout(() => notificationToggle.classList.remove('text-warning'), 1800);
                }
            } catch (_) {
                return;
            }
        };

        const closeNotifications = () => {
            notificationMenu.classList.remove('is-open');
            notificationToggle.setAttribute('aria-expanded', 'false');
        };

        notificationToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = !notificationMenu.classList.contains('is-open');
            closeNotifications();
            if (willOpen) {
                notificationMenu.classList.add('is-open');
                notificationToggle.setAttribute('aria-expanded', 'true');
                markRead();
            }
        });

        document.addEventListener('click', (event) => {
            if (!notificationMenu.contains(event.target instanceof Node ? event.target : null)) {
                closeNotifications();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeNotifications();
            }
        });

        pollNotifications();
        window.setInterval(pollNotifications, 15000);
    }

    const footer = document.querySelector('.app-footer');
    const clock = document.getElementById('appFooterClock');

    if (!footer || !clock) {
        return;
    }

    const timezone = footer.getAttribute('data-app-timezone') || 'Europe/Oslo';
    const formatter = new Intl.DateTimeFormat('nb-NO', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour12: false,
    });

    const render = () => {
        const parts = formatter.formatToParts(new Date());
        const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        clock.textContent = `${map.hour ?? '--'}:${map.minute ?? '--'}:${map.second ?? '--'} ${map.day ?? '--'}/${map.month ?? '--'}/${map.year ?? '----'}`;
    };

    render();
    window.setInterval(render, 1000);
})();
</script>
<script>
(() => {
    const roots = [...document.querySelectorAll('[data-live-search-root]')];
    if (roots.length === 0) {
        return;
    }

    const refreshRoot = (root) => {
        const input = root.querySelector('[data-live-search-input]');
        const body = root.querySelector('[data-live-search-body]');
        const rows = [...root.querySelectorAll('[data-live-search-row]')];
        const emptyState = root.querySelector('[data-live-search-empty]');
        const summary = root.querySelector('[data-live-search-summary]');
        const limit = Math.max(1, Number(root.getAttribute('data-live-search-limit') || '10'));
        const query = (input instanceof HTMLInputElement ? input.value : '').trim().toLowerCase();

        let matched = 0;
        let shown = 0;

        rows.forEach((row) => {
            const haystack = (row.getAttribute('data-search-text') || '').toLowerCase();
            const isMatch = query === '' || haystack.includes(query);
            if (isMatch) {
                matched++;
            }

            const shouldShow = isMatch && shown < limit;
            row.style.display = shouldShow ? '' : 'none';
            if (shouldShow) {
                shown++;
            }
        });

        if (emptyState instanceof HTMLElement) {
            emptyState.style.display = matched === 0 ? '' : 'none';
        }

        if (summary instanceof HTMLElement) {
            if (matched === 0) {
                summary.textContent = 'Viser 0 treff.';
            } else if (matched > limit) {
                summary.textContent = `Viser ${limit} av ${matched} treff. Fortsett å søke for å snevre inn listen.`;
            } else {
                summary.textContent = `Viser ${matched} treff.`;
            }
        }

        if (body instanceof HTMLElement && shown === 0 && matched === 0) {
            body.style.display = '';
        }
    };

    roots.forEach((root) => {
        const input = root.querySelector('[data-live-search-input]');
        const form = root.querySelector('[data-live-search-form]');

        form?.addEventListener('submit', (event) => event.preventDefault());
        input?.addEventListener('input', () => refreshRoot(root));
        refreshRoot(root);
    });

    document.addEventListener('app:live-search-refresh', () => {
        roots.forEach(refreshRoot);
    });
})();
</script>
<?php if (session()->get('user_id')): ?>
<script>
(() => {
    const body = document.body;
    const container = document.getElementById('container');
    const toggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('menuOverlay');
    const closeMobile = () => {
        body.classList.remove('sidebar-mobile-open');
        container?.classList.remove('sbar-open');
    };
    const sidebarSearchInput = document.getElementById('sidebarMenuSearch');
    const toggleMenu = () => {
        if (window.innerWidth <= 991) {
            const willOpen = ! body.classList.contains('sidebar-mobile-open');
            body.classList.toggle('sidebar-mobile-open', willOpen);
            container?.classList.toggle('sbar-open', willOpen);
            return;
        }
        body.classList.toggle('sidebar-collapsed');
    };
    toggle?.addEventListener('click', toggleMenu);
    overlay?.addEventListener('click', closeMobile);
    const refreshSidebarSearch = () => {
        const query = (sidebarSearchInput?.value || '').trim().toLowerCase();

        document.querySelectorAll('#sidebar > ul > li.menu').forEach((item) => {
            const text = item.textContent?.trim().toLowerCase() || '';
            item.style.display = query === '' || text.includes(query) ? '' : 'none';
        });

        document.querySelectorAll('[data-menu-group]').forEach((group) => {
            const toggleNode = group.querySelector('[data-menu-group-toggle]');
            const childItems = [...group.querySelectorAll('.menu-group__items .menu')];
            const groupText = toggleNode?.textContent?.trim().toLowerCase() || '';
            let matchedChildren = 0;

            childItems.forEach((item) => {
                const text = item.textContent?.trim().toLowerCase() || '';
                const matches = query === '' || text.includes(query) || groupText.includes(query);
                item.style.display = matches ? '' : 'none';
                if (matches) {
                    matchedChildren++;
                }
            });

            const showGroup = query === '' || groupText.includes(query) || matchedChildren > 0;
            group.style.display = showGroup ? '' : 'none';

            if (query !== '' && showGroup) {
                group.classList.add('is-open');
                toggleNode?.setAttribute('aria-expanded', 'true');
            } else if (query === '' && !group.querySelector('.menu.active')) {
                group.classList.remove('is-open');
                toggleNode?.setAttribute('aria-expanded', 'false');
            }
        });
    };

    sidebarSearchInput?.addEventListener('input', refreshSidebarSearch);
    document.querySelectorAll('[data-menu-group-toggle]').forEach((toggleButton) => {
        toggleButton.addEventListener('click', () => {
            if ((sidebarSearchInput?.value || '').trim() !== '') {
                return;
            }
            const group = toggleButton.closest('[data-menu-group]');
            if (!(group instanceof HTMLElement)) {
                return;
            }

            const willOpen = !group.classList.contains('is-open');
            document.querySelectorAll('[data-menu-group]').forEach((item) => {
                item.classList.remove('is-open');
                const button = item.querySelector('[data-menu-group-toggle]');
                if (button instanceof HTMLElement) {
                    button.setAttribute('aria-expanded', 'false');
                }
            });

            if (willOpen) {
                group.classList.add('is-open');
                toggleButton.setAttribute('aria-expanded', 'true');
            }
        });
    });
    document.querySelectorAll('#sidebar a').forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 991) {
                closeMobile();
            }
        });
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 991) {
            closeMobile();
        }
    });
    refreshSidebarSearch();
})();
</script>
<?php endif; ?>
</body>
</html>

