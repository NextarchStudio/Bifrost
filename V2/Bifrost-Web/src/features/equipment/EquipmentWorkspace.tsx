import type { CurrentUser, EquipmentListResponse } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import { createEquipment, getEquipment } from "../../api/client";

export function EquipmentWorkspace({ user, accessToken }: { user: CurrentUser; accessToken: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EquipmentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getEquipment(accessToken, { page, search: search.trim() || undefined })
        .then((response) => { if (!controller.signal.aborted) { setData(response); setError(null); } })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Ukjent feil"); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [accessToken, page, search, refresh]);

  return (
    <section className="py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-emerald-300">Operativ oversikt</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Utstyr</h1>
          <p className="mt-2 text-sm text-slate-500">{user.name} · {user.roles.join(", ")}</p>
        </div>
        <div className="flex w-full gap-3 md:w-auto">
          <label className="relative block min-w-0 flex-1 md:w-80">
            <span className="sr-only">Søk etter utstyr</span>
            <input className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/60" placeholder="Søk etter navn …" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <button className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200" onClick={() => setShowCreate(true)}>Nytt utstyr</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-4">Utstyr</th><th className="px-5 py-4">Kategori</th><th className="px-5 py-4">Plassering</th><th className="px-5 py-4">Antall</th><th className="px-5 py-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {!data && !error && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Henter utstyr …</td></tr>}
              {data?.items.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Ingen utstyr matcher søket.</td></tr>}
              {data?.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/[.025]">
                  <td className="px-5 py-4"><p className="font-medium text-slate-200">{item.name}</p><p className="mt-1 text-xs text-slate-600">{item.serialNumber}</p></td>
                  <td className="px-5 py-4 text-slate-400">{item.category}</td>
                  <td className="px-5 py-4 text-slate-400">{item.locationName ?? "Ikke plassert"}{item.palletName ? ` · ${item.palletName}` : ""}</td>
                  <td className="px-5 py-4"><span className="text-slate-200">{item.quantity}</span>{item.loanedQuantity > 0 && <span className="ml-2 text-xs text-amber-300">{item.loanedQuantity} utlånt</span>}</td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pagination.pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-sm text-slate-500">
            <span>{data.pagination.total} treff</span>
            <div className="flex gap-2">
              <button className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Forrige</button>
              <span className="px-2 py-2">{page} / {data.pagination.pageCount}</span>
              <button className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" disabled={page >= data.pagination.pageCount} onClick={() => setPage((value) => value + 1)}>Neste</button>
            </div>
          </div>
        )}
      </div>
      {showCreate && <CreateEquipmentPanel accessToken={accessToken} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh((value) => value + 1); }} />}
    </section>
  );
}

function CreateEquipmentPanel({ accessToken, onClose, onCreated }: { accessToken: string; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="create-equipment-title">
      <form className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setSaving(true); setError(null);
        void createEquipment(accessToken, {
          name: String(form.get("name") ?? ""),
          category: String(form.get("category") ?? ""),
          serialNumber: String(form.get("serialNumber") ?? ""),
          quantity: Number(form.get("quantity") ?? 1),
          notes: String(form.get("notes") ?? "") || undefined,
        }).then(onCreated).catch((reason) => setError(reason instanceof Error ? reason.message : "Kunne ikke lagre.")).finally(() => setSaving(false));
      }}>
        <div className="flex items-start justify-between"><div><p className="text-sm text-emerald-300">Lager</p><h2 id="create-equipment-title" className="mt-1 text-2xl font-semibold">Registrer utstyr</h2></div><button type="button" className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Navn" name="name" required />
          <Field label="Kategori" name="category" required />
          <Field label="Serienummer" name="serialNumber" required />
          <Field label="Antall" name="quantity" type="number" min="1" defaultValue="1" required />
          <label className="sm:col-span-2"><span className="mb-2 block text-sm text-slate-400">Notater</span><textarea name="notes" rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label>
        </div>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm" onClick={onClose}>Avbryt</button><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Lagrer …" : "Lagre"}</button></div>
      </form>
    </div>
  );
}

function Field(props: { label: string; name: string; type?: string; min?: string; defaultValue?: string; required?: boolean }) {
  const { label, ...inputProps } = props;
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...inputProps} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "available" ? "bg-emerald-300/10 text-emerald-300" : status === "maintenance" ? "bg-amber-300/10 text-amber-300" : "bg-slate-400/10 text-slate-300";
  return <span className={`rounded-full px-2.5 py-1 text-xs ${tone}`}>{status}</span>;
}
