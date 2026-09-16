import type { Location, Pallet, PalletInspection } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import {
  addEquipmentToPallet,
  createPallet,
  createPalletSlot,
  deletePallet,
  getLocations,
  getPalletInspection,
  getPallets,
  movePalletToLocation,
} from "../../api/client";

export function WarehouseWorkspace({ accessToken }: { accessToken: string }) {
  const [pallets, setPallets] = useState<Pallet[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([getPallets(accessToken), getLocations(accessToken)])
      .then(([palletResult, locationResult]) => {
        if (!active) return;
        setPallets(palletResult);
        setLocations(locationResult.filter((location) => location.type.toLocaleLowerCase("nb-NO") !== "transport"));
        setError(null);
      })
      .catch((reason) => { if (active) setError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken, refresh]);

  const runAction = (key: string, operation: Promise<unknown>, successMessage: string, form?: HTMLFormElement) => {
    setActiveAction(key); setError(null); setNotice(null);
    void operation.then(() => {
      form?.reset();
      setNotice(successMessage);
      setRefresh((value) => value + 1);
    }).catch((reason) => setError(messageFrom(reason))).finally(() => setActiveAction(null));
  };

  return (
    <section className="py-10">
      <div className="mb-8"><p className="text-sm text-emerald-300">Operativ lagerflyt</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Lager og paller</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Opprett og flytt paller, legg til utstyr med strekkoder og inspiser innholdet uten å endre V1-datastrukturen.</p></div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <form className="rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          runAction("create", createPallet(accessToken, { locationId: Number(form.get("locationId")), name: String(form.get("name") ?? ""), qrCode: String(form.get("qrCode") ?? "") }), "Pallen ble opprettet.", formElement);
        }}>
          <h2 className="text-lg font-medium">Ny palle</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Pallenummer" name="name" required /><Field label="Strekkode" name="qrCode" required /><label className="sm:col-span-2"><span className="mb-2 block text-sm text-slate-400">Lokasjon</span><select name="locationId" required className="w-full rounded-xl border border-white/10 bg-[#091421] px-3 py-2.5 outline-none focus:border-emerald-300/60"><option value="">Velg lokasjon</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div>
          <div className="mt-4 flex justify-end"><SubmitButton busy={activeAction === "create"} disabled={activeAction !== null}>Opprett palle</SubmitButton></div>
        </form>

        <form className="rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          runAction("scan", addEquipmentToPallet(accessToken, { palletQrCode: String(form.get("palletQrCode") ?? ""), equipmentBarcode: String(form.get("equipmentBarcode") ?? "") }), "Utstyret ble lagt på pallen.", formElement);
        }}>
          <h2 className="text-lg font-medium">Legg utstyr på palle</h2><p className="mt-2 text-sm leading-6 text-slate-500">Skann først pallen, deretter utstyrets serienummer eller strekkode.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Pallens strekkode" name="palletQrCode" required /><Field label="Utstyrets strekkode" name="equipmentBarcode" required /></div>
          <div className="mt-4 flex justify-end"><SubmitButton busy={activeAction === "scan"} disabled={activeAction !== null}>Legg til</SubmitButton></div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        {notice && <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
        {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Palle</th><th className="px-5 py-4">Strekkode</th><th className="px-5 py-4">Lokasjon</th><th className="px-5 py-4">Flytt til</th><th className="px-5 py-4"><span className="sr-only">Handlinger</span></th></tr></thead><tbody className="divide-y divide-white/[.06]">
          {!pallets && !error && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Henter paller …</td></tr>}
          {pallets?.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Ingen paller er registrert.</td></tr>}
          {pallets?.map((pallet) => <PalletRow key={pallet.id} pallet={pallet} locations={locations} busy={activeAction !== null} onInspect={() => setSelectedPalletId(pallet.id)} onMove={(locationId) => runAction(`move-${pallet.id}`, movePalletToLocation(accessToken, pallet.id, locationId), `${pallet.name} ble flyttet.`)} onDelete={() => {
            if (window.confirm(`Er du sikker på at du vil slette ${pallet.name}?`)) runAction(`delete-${pallet.id}`, deletePallet(accessToken, pallet.id), `${pallet.name} ble slettet.`);
          }} />)}
        </tbody></table></div>
      </div>

      {selectedPalletId !== null && <InspectionPanel accessToken={accessToken} palletId={selectedPalletId} onClose={() => setSelectedPalletId(null)} />}
    </section>
  );
}

function PalletRow({ pallet, locations, busy, onInspect, onMove, onDelete }: { pallet: Pallet; locations: Location[]; busy: boolean; onInspect: () => void; onMove: (locationId: number) => void; onDelete: () => void }) {
  return <tr className="hover:bg-white/[.025]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{pallet.name}</p><p className="mt-1 text-xs text-slate-600">ID {pallet.id}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-400">{pallet.qrCode ?? "–"}</td><td className="px-5 py-4 text-slate-300">{pallet.locationName}</td><td className="px-5 py-4"><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onMove(Number(new FormData(event.currentTarget).get("locationId"))); }}><select name="locationId" defaultValue={pallet.locationId} className="min-w-36 rounded-lg border border-white/10 bg-[#091421] px-2 py-2 text-xs outline-none"><option value={pallet.locationId}>{pallet.locationName}</option>{locations.filter((location) => location.id !== pallet.locationId).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-emerald-300/40 disabled:opacity-40">Flytt</button></form></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-emerald-300/40 disabled:opacity-40" onClick={onInspect}>Inspiser</button><button disabled={busy} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-40" onClick={onDelete}>Slett</button></div></td></tr>;
}

function InspectionPanel({ accessToken, palletId, onClose }: { accessToken: string; palletId: number; onClose: () => void }) {
  const [inspection, setInspection] = useState<PalletInspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void getPalletInspection(accessToken, palletId).then((result) => { if (active) { setInspection(result); setError(null); } }).catch((reason) => { if (active) setError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken, palletId, refresh]);

  return <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="inspect-pallet-title"><div className="my-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl"><div className="flex items-start justify-between gap-5"><div><p className="text-sm text-emerald-300">Palleinspeksjon</p><h2 id="inspect-pallet-title" className="mt-1 text-2xl font-semibold">{inspection?.pallet.name ?? "Henter palle …"}</h2>{inspection && <p className="mt-2 text-sm text-slate-500">{inspection.pallet.locationName} · {inspection.pallet.qrCode ?? "Ingen strekkode"}</p>}</div><button className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div>
    {error && <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
    <div className="mt-6 overflow-hidden rounded-xl border border-white/10"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Plass</th><th className="px-4 py-3">Utstyr</th><th className="px-4 py-3">Serienummer</th><th className="px-4 py-3">Antall</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/[.06]">{inspection?.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Pallen har ingen plasser eller utstyr.</td></tr>}{inspection?.rows.map((row) => <tr key={`${row.slotId}-${row.equipmentId ?? "empty"}`}><td className="px-4 py-3 text-slate-400">{row.slotNumber}</td><td className="px-4 py-3 text-slate-200">{row.equipmentName ?? "Ledig plass"}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{row.serialNumber ?? "–"}</td><td className="px-4 py-3 text-slate-400">{row.quantity ?? "–"}</td><td className="px-4 py-3 text-slate-400">{row.equipmentStatus ?? row.slotStatus}</td></tr>)}</tbody></table></div></div>
    <form className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-end" onSubmit={(event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      setSaving(true); setError(null);
      void createPalletSlot(accessToken, palletId, { slotNumber: Number(form.get("slotNumber")), status: String(form.get("status") ?? "available") }).then(() => { formElement.reset(); setRefresh((value) => value + 1); }).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
    }}><div className="flex-1"><Field label="Nytt plassnummer" name="slotNumber" type="number" min="1" required /></div><label className="flex-1"><span className="mb-2 block text-sm text-slate-400">Plass-status</span><select name="status" defaultValue="available" className="w-full rounded-xl border border-white/10 bg-[#091421] px-3 py-2.5 outline-none"><option value="available">Tilgjengelig</option><option value="reserved">Reservert</option><option value="blocked">Blokkert</option></select></label><SubmitButton busy={saving} disabled={saving}>Opprett plass</SubmitButton></form>
  </div></div>;
}

function Field({ label, ...props }: { label: string; name: string; type?: string; min?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label>;
}

function SubmitButton({ busy, disabled, children }: { busy: boolean; disabled: boolean; children: string }) {
  return <button disabled={disabled} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50">{busy ? "Lagrer …" : children}</button>;
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.";
}
