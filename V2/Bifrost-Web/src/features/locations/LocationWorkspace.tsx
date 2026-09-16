import type { Location } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import { createLocation, deleteLocation, getLocations, updateLocation } from "../../api/client";

const LOCATION_TYPES = ["Lager", "Scene", "Transport", "Annet", "Arkiv"];

export function LocationWorkspace({ accessToken }: { accessToken: string }) {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void getLocations(accessToken)
      .then((result) => { if (active) { setLocations(result); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Kunne ikke hente lokasjoner."); });
    return () => { active = false; };
  }, [accessToken, refresh]);

  const changed = (message: string) => {
    setShowCreate(false);
    setSelectedLocation(null);
    setNotice(message);
    setRefresh((value) => value + 1);
  };

  return (
    <section className="py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="text-sm text-emerald-300">Lagerstruktur</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Lokasjoner</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Lokasjoner brukes av paller og transportoppdrag. Adresseendringer nullstiller koordinater slik at de kan geokodes på nytt.</p></div>
        <button className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200" onClick={() => { setNotice(null); setShowCreate(true); }}>Ny lokasjon</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        {notice && <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
        {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Lokasjon</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Adresse</th><th className="px-5 py-4"><span className="sr-only">Handlinger</span></th></tr></thead>
            <tbody className="divide-y divide-white/[.06]">
              {!locations && !error && <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">Henter lokasjoner …</td></tr>}
              {locations?.length === 0 && <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">Ingen lokasjoner er registrert.</td></tr>}
              {locations?.map((location) => <tr key={location.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{location.name}</p><p className="mt-1 text-xs text-slate-600">ID {location.id}</p></td><td className="px-5 py-4 text-slate-400">{location.type}</td><td className="px-5 py-4 text-slate-400">{location.address ?? "Ikke registrert"}</td><td className="px-5 py-4 text-right"><button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:border-emerald-300/40 hover:text-emerald-200" onClick={() => { setNotice(null); setSelectedLocation(location); }}>Rediger</button></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <LocationPanel accessToken={accessToken} onClose={() => setShowCreate(false)} onChanged={() => changed("Lokasjonen ble opprettet.")} />}
      {selectedLocation && <LocationPanel accessToken={accessToken} location={selectedLocation} onClose={() => setSelectedLocation(null)} onChanged={() => changed("Lokasjonen ble oppdatert.")} onDeleted={() => changed("Lokasjonen ble slettet.")} />}
    </section>
  );
}

function LocationPanel({ accessToken, location, onClose, onChanged, onDeleted }: { accessToken: string; location?: Location; onClose: () => void; onChanged: () => void; onDeleted?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(location);

  const fail = (reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.");
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="location-panel-title">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-emerald-300">Lagerstruktur</p><h2 id="location-panel-title" className="mt-1 text-2xl font-semibold">{isEditing ? `Rediger ${location?.name}` : "Opprett lokasjon"}</h2></div><button type="button" className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div>
        <form className="mt-6 grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const input = { name: String(form.get("name") ?? ""), type: String(form.get("type") ?? ""), address: String(form.get("address") ?? "") || undefined };
          setSaving(true); setError(null);
          const operation = location ? updateLocation(accessToken, location.id, input) : createLocation(accessToken, input).then(() => undefined);
          void operation.then(onChanged).catch(fail);
        }}>
          <Field label="Navn" name="name" defaultValue={location?.name} required />
          <label><span className="mb-2 block text-sm text-slate-400">Type</span><select name="type" required defaultValue={location?.type ?? ""} className="w-full rounded-xl border border-white/10 bg-[#091421] px-3 py-2.5 outline-none focus:border-emerald-300/60"><option value="">Velg type</option>{LOCATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}{location && !LOCATION_TYPES.includes(location.type) && <option value={location.type}>{location.type}</option>}</select></label>
          <Field label="Adresse (valgfritt)" name="address" defaultValue={location?.address ?? ""} />
          {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <div className="mt-2 flex justify-end gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm" onClick={onClose}>Avbryt</button><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Lagrer …" : isEditing ? "Lagre" : "Opprett"}</button></div>
        </form>
        {location && onDeleted && <div className="mt-6 border-t border-white/10 pt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">Sletting blokkeres hvis lokasjonen har paller eller aktive transportoppdrag.</p><button type="button" disabled={saving} className="shrink-0 rounded-xl border border-rose-400/30 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-400/10 disabled:opacity-50" onClick={() => {
          if (!window.confirm(`Er du sikker på at du vil slette ${location.name}?`)) return;
          setSaving(true); setError(null);
          void deleteLocation(accessToken, location.id).then(onDeleted).catch(fail);
        }}>Slett lokasjon</button></div></div>}
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label>;
}
