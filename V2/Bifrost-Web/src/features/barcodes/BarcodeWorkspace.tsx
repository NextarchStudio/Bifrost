import { useState } from "react";
import { exportBarcodes } from "../../api/client";

export function BarcodeWorkspace({ accessToken }: { accessToken: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section className="py-10">
      <div className="mb-8">
        <p className="text-sm text-emerald-300">Verktøy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Strekkoder</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Generer en V1-kompatibel UDL-fil med én strekkode per linje. Bruk enkeltkoder, et intervall eller begge deler.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <form className="rounded-2xl border border-white/10 bg-white/[.025] p-6" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true); setError(null); setNotice(null);
          void exportBarcodes(accessToken, {
            filename: String(form.get("filename") ?? ""),
            rangeStart: String(form.get("rangeStart") ?? ""),
            rangeEnd: String(form.get("rangeEnd") ?? ""),
            codes: String(form.get("codes") ?? ""),
          }).then(({ content, filename, count }) => {
            const url = URL.createObjectURL(content);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            setNotice(`${filename} ble generert med ${count} strekkoder.`);
          }).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Eksporten kunne ikke fullføres.");
          }).finally(() => setBusy(false));
        }}>
          <h2 className="text-lg font-medium">Eksporter UDL-fil</h2>
          <div className="mt-5">
            <Field label="Filnavn" name="filename" placeholder="strekkoder-tg26" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Fra-kode" name="rangeStart" placeholder="TG26-0001" maxLength={150} />
            <Field label="Til-kode" name="rangeEnd" placeholder="TG26-0020" maxLength={150} />
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-slate-400">Enkeltkoder</span>
            <textarea name="codes" rows={12} maxLength={1_000_000} placeholder={"Én kode per linje\nTG26-TLF-001\nTG26-TLF-002\nTG26-TLF-003"} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-slate-700 focus:border-emerald-300/60" />
          </label>
          {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          {notice && <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">{notice}</p>}
          <div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50">{busy ? "Genererer …" : "Eksporter UDL-fil"}</button></div>
        </form>

        <aside className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
          <h2 className="text-lg font-medium">Slik fungerer det</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Intervallet <code className="text-emerald-200">TG26-0001</code> til <code className="text-emerald-200">TG26-0020</code> genererer alle kodene mellom verdiene og beholder nullutfyllingen.</p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">TG26-0001{"\n"}TG26-0002{"\n"}TG26-0003</pre>
          <p className="mt-5 text-sm leading-6 text-slate-500">Duplikater fjernes i samme rekkefølge som V1. Filen bruker UTF-8 BOM og Windows-linjeskift for kompatibilitet med eksisterende etikettflyt.</p>
          <p className="mt-4 text-xs text-slate-600">Maks 100 000 unike koder per eksport.</p>
        </aside>
      </div>
    </section>
  );
}

function Field({ label, name, placeholder, maxLength = 180 }: { label: string; name: string; placeholder: string; maxLength?: number }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input name={name} maxLength={maxLength} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none placeholder:text-slate-700 focus:border-emerald-300/60" /></label>;
}
