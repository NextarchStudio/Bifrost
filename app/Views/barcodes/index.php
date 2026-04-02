<?= $this->extend('layouts/base') ?>
<?= $this->section('content') ?>
<div class="topbar">
    <div>
        <h1>Strekkoder</h1>
        <div class="muted">Generer UDL-fil med ett strekkodenummer per linje.</div>
    </div>
</div>

<div class="grid">
    <div class="card">
        <h3>Eksporter strekkoder</h3>
        <p style="margin-top:0;color:#94a3b8;">Eksporten lages alltid som <code>.udl</code>, med ett strekkodenummer per linje. Du kan bruke enkeltkoder, intervall eller begge deler i samme eksport.</p>
        <form method="post" action="/strekkoder/export">
            <?= csrf_field() ?>
            <label for="filename">Filnavn</label>
            <input id="filename" type="text" name="filename" placeholder="strekkoder-tg26" value="<?= esc(old('filename') ?? '') ?>">
            <div class="grid" style="margin-bottom:.25rem;">
                <div>
                    <label for="range_start">Fra-kode</label>
                    <input id="range_start" type="text" name="range_start" placeholder="TG26-0001" value="<?= esc(old('range_start') ?? '') ?>">
                </div>
                <div>
                    <label for="range_end">Til-kode</label>
                    <input id="range_end" type="text" name="range_end" placeholder="TG26-0020" value="<?= esc(old('range_end') ?? '') ?>">
                </div>
            </div>
            <textarea name="codes" rows="12" placeholder="Eller legg inn enkeltkoder, én per linje&#10;TG26-TLF-001&#10;TG26-TLF-002&#10;TG26-TLF-003"><?= esc(old('codes') ?? '') ?></textarea>
            <button type="submit">Eksporter UDL-fil</button>
        </form>
    </div>

    <div class="card">
        <h3>Hvordan det fungerer</h3>
        <p style="margin-top:0;">Hvis du skriver inn <code>TG26-0001</code> til <code>TG26-0020</code>, blir alle kodene imellom generert automatisk og lagt i samme <code>.udl</code>-fil.</p>
        <p style="margin-top:0;color:#94a3b8;">Formatet i filen blir slik:</p>
        <pre style="margin-top:0;background:#0b1324;color:#dbeafe;border:1px solid #26344f;border-radius:.5rem;padding:.75rem;">TG26-0001
TG26-0002
TG26-0003</pre>
        <p style="margin-bottom:0;">Tilgang til denne siden er begrenset til Chief, Co-Chief, Logistikk og Utvikler.</p>
    </div>
</div>
<?= $this->endSection() ?>
