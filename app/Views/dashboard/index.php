<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<div class="topbar">
    <div>
        <h1>Dashbord</h1>
        <div class="muted">Oversikt over aktive operasjoner</div>
    </div>
</div>
<div class="grid">
    <div class="card"><h3>Antall ting utlånt</h3><div style="font-size:34px;font-weight:800;color:#f8fafc;"><?= esc((string) $summary['activeLoans']) ?></div></div>
    <div class="card"><h3>Aktive kjøretøylån</h3><div style="font-size:34px;font-weight:800;color:#f8fafc;"><?= esc((string) $summary['activeVehicleLoans']) ?></div></div>
    <div class="card"><h3>Aktive transporter</h3><div style="font-size:34px;font-weight:800;color:#f8fafc;"><?= esc((string) $summary['activeTransportJobs']) ?></div></div>
    <div class="card"><h3>Totalt kjørt på oppdrag</h3><div style="font-size:34px;font-weight:800;color:#f8fafc;"><?= esc((string) $summary['totalTransportDistance']) ?> km</div></div>
</div>
<div class="card">
    <h3>Utstyr per lokasjon</h3>
    <table style="color:#f8fafc;">
        <tr><th>Lokasjon</th><th>Antall</th></tr>
        <?php foreach ($summary['equipmentPerLocation'] as $row): ?>
            <tr><td><?= esc((string) $row['location_name']) ?></td><td><?= esc((string) $row['equipment_count']) ?></td></tr>
        <?php endforeach; ?>
    </table>
</div>
<?= $this->endSection() ?>
