import type { CurrentUser, EquipmentCategory, EquipmentListItem, EquipmentListResponse } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import {
  createEquipment,
  createEquipmentCategory,
  deleteEquipmentCategory,
  deleteEquipment,
  getEquipment,
  getEquipmentCategories,
  moveEquipment,
  updateEquipmentDetails,
  updateEquipmentStatus,
} from "../../api/client";

export function EquipmentWorkspace({ user, accessToken }: { user: CurrentUser; accessToken: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EquipmentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentListItem | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [categoryRefresh, setCategoryRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getEquipmentCategories(accessToken).then(setCategories).catch(() => setCategories([]));
  }, [accessToken, categoryRefresh]);

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
        <div className="flex w-full flex-wrap gap-3 md:w-auto">
          <label className="relative block min-w-0 flex-1 md:w-80">
            <span className="sr-only">Søk etter utstyr</span>
            <input className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/60" placeholder="Søk etter navn …" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <button className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:border-emerald-300/40 hover:text-emerald-200" onClick={() => { setNotice(null); setShowCategories(true); }}>Kategorier</button>
          <button className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200" onClick={() => setShowCreate(true)}>Nytt utstyr</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        {notice && <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
        {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-4">Utstyr</th><th className="px-5 py-4">Kategori</th><th className="px-5 py-4">Plassering</th><th className="px-5 py-4">Antall</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"><span className="sr-only">Handlinger</span></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {!data && !error && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Henter utstyr …</td></tr>}
              {data?.items.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Ingen utstyr matcher søket.</td></tr>}
              {data?.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/[.025]">
                  <td className="px-5 py-4"><p className="font-medium text-slate-200">{item.name}</p><p className="mt-1 text-xs text-slate-600">{item.serialNumber}</p></td>
                  <td className="px-5 py-4 text-slate-400">{item.category}</td>
                  <td className="px-5 py-4 text-slate-400">{item.locationName ?? "Ikke plassert"}{item.palletName ? ` · ${item.palletName}` : ""}</td>
                  <td className="px-5 py-4"><span className="text-slate-200">{item.quantity}</span>{item.loanedQuantity > 0 && <span className="ml-2 text-xs text-amber-300">{item.loanedQuantity} utlånt</span>}</td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-4 text-right"><button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:border-emerald-300/40 hover:text-emerald-200" onClick={() => { setNotice(null); setSelectedEquipment(item); }}>Administrer</button></td>
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
      {showCreate && <CreateEquipmentPanel accessToken={accessToken} categories={categories} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh((value) => value + 1); }} />}
      {showCategories && <CategoryManagementPanel accessToken={accessToken} categories={categories} onClose={() => setShowCategories(false)} onChanged={(message) => { setNotice(message); setCategoryRefresh((value) => value + 1); }} />}
      {selectedEquipment && (
        <ManageEquipmentPanel
          accessToken={accessToken}
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          onChanged={(message) => {
            setSelectedEquipment(null);
            setNotice(message);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}

function CategoryManagementPanel({ accessToken, categories, onClose, onChanged }: { accessToken: string; categories: EquipmentCategory[]; onClose: () => void; onChanged: (message: string) => void }) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = (action: string, operation: Promise<unknown>, message: string, form?: HTMLFormElement) => {
    setActiveAction(action); setError(null);
    void operation.then(() => { form?.reset(); onChanged(message); }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.");
    }).finally(() => setActiveAction(null));
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="categories-title">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-emerald-300">Utstyr</p><h2 id="categories-title" className="mt-1 text-2xl font-semibold">Kategorier</h2><p className="mt-2 text-sm leading-6 text-slate-500">Kategorier som brukes av utstyr kan ikke slettes.</p></div><button type="button" className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div>
        <form className="mt-6 flex gap-3" onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const name = String(new FormData(formElement).get("name") ?? "");
          runAction("create", createEquipmentCategory(accessToken, name), "Kategorien ble opprettet.", formElement);
        }}><div className="min-w-0 flex-1"><Field label="Ny kategori" name="name" required /></div><button disabled={activeAction !== null} className="mt-7 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{activeAction === "create" ? "Lagrer …" : "Opprett"}</button></form>
        {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        <div className="mt-5 max-h-80 overflow-y-auto rounded-xl border border-white/10"><ul className="divide-y divide-white/[.06]">{categories.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Ingen kategorier er registrert.</li>}{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-slate-300">{category.name}</span><button type="button" disabled={activeAction !== null} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-40" onClick={() => {
          if (window.confirm(`Er du sikker på at du vil slette kategorien ${category.name}?`)) runAction(`delete-${category.id}`, deleteEquipmentCategory(accessToken, category.id), "Kategorien ble slettet.");
        }}>{activeAction === `delete-${category.id}` ? "Sletter …" : "Slett"}</button></li>)}</ul></div>
      </div>
    </div>
  );
}

function ManageEquipmentPanel({ accessToken, equipment, onClose, onChanged }: { accessToken: string; equipment: EquipmentListItem; onClose: () => void; onChanged: (message: string) => void }) {
  const [activeAction, setActiveAction] = useState<"details" | "status" | "move" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = (action: Exclude<typeof activeAction, null>, operation: Promise<void>, message: string) => {
    setActiveAction(action);
    setError(null);
    void operation.then(() => onChanged(message)).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.");
      setActiveAction(null);
    });
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="manage-equipment-title">
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-5">
          <div><p className="text-sm text-emerald-300">Utstyr #{equipment.id}</p><h2 id="manage-equipment-title" className="mt-1 text-2xl font-semibold">Administrer {equipment.name}</h2><p className="mt-2 text-sm text-slate-500">Endringer lagres direkte i den eksisterende V1-databasen og føres i audit-loggen.</p></div>
          <button type="button" className="shrink-0 text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button>
        </div>

        <form className="mt-6 rounded-xl border border-white/10 bg-black/10 p-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          runAction("details", updateEquipmentDetails(accessToken, equipment.id, {
            name: String(form.get("name") ?? ""),
            serialNumber: String(form.get("serialNumber") ?? ""),
            quantity: Number(form.get("quantity") ?? 0),
          }), "Utstyret ble oppdatert.");
        }}>
          <h3 className="font-medium text-slate-200">Detaljer og lagerantall</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Navn" name="name" defaultValue={equipment.name} required />
            <Field label="Serienummer" name="serialNumber" defaultValue={equipment.serialNumber} required />
            <Field label="Antall" name="quantity" type="number" min="0" defaultValue={String(equipment.quantity)} required />
          </div>
          <div className="mt-4 flex justify-end"><ActionButton busy={activeAction === "details"} disabled={activeAction !== null}>Lagre detaljer</ActionButton></div>
        </form>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form className="rounded-xl border border-white/10 bg-black/10 p-4" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            runAction("status", updateEquipmentStatus(accessToken, equipment.id, String(form.get("status") ?? "")), "Status ble oppdatert.");
          }}>
            <h3 className="font-medium text-slate-200">Status</h3>
            <label className="mt-4 block"><span className="mb-2 block text-sm text-slate-400">Lagerstatus</span><select name="status" defaultValue={equipment.status} className="w-full rounded-xl border border-white/10 bg-[#091421] px-3 py-2.5 outline-none focus:border-emerald-300/60"><option value="available">Tilgjengelig</option><option value="loaned">Utlånt</option><option value="maintenance">Vedlikehold</option>{!["available", "loaned", "maintenance"].includes(equipment.status) && <option value={equipment.status}>{equipment.status}</option>}</select></label>
            <div className="mt-4 flex justify-end"><ActionButton busy={activeAction === "status"} disabled={activeAction !== null}>Lagre status</ActionButton></div>
          </form>

          <form className="rounded-xl border border-white/10 bg-black/10 p-4" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            runAction("move", moveEquipment(accessToken, equipment.id, String(form.get("palletQrCode") ?? "")), "Utstyret ble flyttet til pallen.");
          }}>
            <h3 className="font-medium text-slate-200">Flytt til palle</h3>
            <div className="mt-4"><Field label="Pallens strekkode" name="palletQrCode" required /></div>
            <div className="mt-4 flex justify-end"><ActionButton busy={activeAction === "move"} disabled={activeAction !== null}>Flytt utstyr</ActionButton></div>
          </form>
        </div>

        {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-medium text-rose-200">Slett utstyr</h3><p className="mt-1 text-xs text-slate-500">Aktive utlån eller forespørsler blokkerer sletting.</p></div>
          <button type="button" disabled={activeAction !== null} className="rounded-xl border border-rose-400/30 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-400/10 disabled:opacity-50" onClick={() => {
            if (window.confirm(`Er du sikker på at du vil slette ${equipment.name}?`)) runAction("delete", deleteEquipment(accessToken, equipment.id), "Utstyret ble slettet.");
          }}>{activeAction === "delete" ? "Sletter …" : "Slett utstyr"}</button>
        </div>
      </div>
    </div>
  );
}

function CreateEquipmentPanel({ accessToken, categories, onClose, onCreated }: { accessToken: string; categories: EquipmentCategory[]; onClose: () => void; onCreated: () => void }) {
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
          <label><span className="mb-2 block text-sm text-slate-400">Kategori</span><select name="category" required className="w-full rounded-xl border border-white/10 bg-[#091421] px-3 py-2.5 outline-none focus:border-emerald-300/60"><option value="">Velg kategori</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
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

function ActionButton({ busy, disabled, children }: { busy: boolean; disabled: boolean; children: string }) {
  return <button disabled={disabled} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50">{busy ? "Lagrer …" : children}</button>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "available" ? "bg-emerald-300/10 text-emerald-300" : status === "maintenance" ? "bg-amber-300/10 text-amber-300" : "bg-slate-400/10 text-slate-300";
  return <span className={`rounded-full px-2.5 py-1 text-xs ${tone}`}>{status}</span>;
}
