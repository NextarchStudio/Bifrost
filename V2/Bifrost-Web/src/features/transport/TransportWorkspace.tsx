import type { Location, TransportJob, TransportJobKind, TransportWorkspaceResponse } from "@bifrost/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignTransportJob,
  completeTransportJob,
  createTransportJob,
  getTransportJob,
  getTransportWorkspace,
  requestPeopleTransport,
  startTransportJob,
} from "../../api/client";

const KIND_LABELS: Record<TransportJobKind, string> = {
  equipment: "Utstyrstransport",
  innkjopsrunde: "Innkjøpsrunde",
  henterunde: "Henterunde",
  people: "Persontransport",
};

const STATUS_LABELS: Record<TransportJob["status"], string> = {
  open: "Åpen",
  assigned: "Tildelt",
  in_progress: "Pågår",
  completed: "Fullført",
};

export function TransportWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<TransportWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [inspection, setInspection] = useState<TransportJob | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await getTransportWorkspace(accessToken)); }
    catch (reason) { setError(messageFrom(reason)); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (jobId: number, action: () => Promise<void>, success: string) => {
    setBusyJobId(jobId); setError(null); setNotice(null);
    try { await action(); setNotice(success); setInspection(null); await load(); }
    catch (reason) { setError(messageFrom(reason)); }
    finally { setBusyJobId(null); }
  };

  if (loading) return <WorkspaceState title="Henter transport" detail="Laster aktive oppdrag, kjøretøy og ruteinformasjon …" />;
  if (!data) return <WorkspaceState title="Transport kunne ikke lastes" detail={error ?? "Ukjent feil."} error />;

  return <section className="py-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-[.2em] text-emerald-300">TRANSPORT</p><h1 className="mt-2 text-3xl font-semibold">Oppdrag og kjørebok</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Planlegg, tildel og dokumenter hele turen. Distanse beregnes av API-et; kilometerteller og kompetanse kontrolleres før kjøring.</p></div>
      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5" onClick={() => { setLoading(true); void load(); }}>Oppdater</button>
    </div>
    {notice && <Banner tone="success">{notice}</Banner>}
    {error && <Banner tone="error">{error}</Banner>}

    {data.canRequestPeople && <PeopleRequestCard accessToken={accessToken} locations={data.transportLocations} onCreated={() => { setNotice("Transportforespørselen ble sendt."); void load(); }} onError={setError} />}
    {data.canManage && <CreateJobCard accessToken={accessToken} data={data} onCreated={() => { setNotice("Transportoppdraget ble opprettet og kjøretøyet reservert."); void load(); }} onError={setError} />}

    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-emerald-300">Operativ kø</p><h2 className="mt-1 text-xl font-semibold">{data.canManage ? "Aktive oppdrag" : "Mine transportforespørsler"}</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{data.activeJobs.length}</span></div>
      {data.activeJobs.length === 0 ? <EmptyState>Ingen aktive transportoppdrag.</EmptyState> : <div className="mt-5 grid gap-4">{data.activeJobs.map((job) => <JobCard key={job.id} job={job} data={data} busy={busyJobId === job.id} onInspect={() => {
        setBusyJobId(job.id); setError(null);
        void getTransportJob(accessToken, job.id).then(setInspection).catch((reason) => setError(messageFrom(reason))).finally(() => setBusyJobId(null));
      }} onAssign={(userId) => void mutate(job.id, () => assignTransportJob(accessToken, job.id, userId), "Oppdraget ble tildelt.")} onStart={(input) => void mutate(job.id, () => startTransportJob(accessToken, job.id, input), "Oppdraget er startet.")} onComplete={(end) => void mutate(job.id, () => completeTransportJob(accessToken, job.id, end), "Oppdraget er fullført og kjøreboken oppdatert.")} />)}</div>}
    </div>

    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-sky-300">Historikk</p><h2 className="mt-1 text-xl font-semibold">Avsluttede turer</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{data.completedJobs.length}</span></div>
      {data.completedJobs.length === 0 ? <EmptyState>Ingen avsluttede turer.</EmptyState> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-600"><tr><th className="pb-3">Oppdrag</th><th className="pb-3">For</th><th className="pb-3">Rute</th><th className="pb-3">Kjørt av</th><th className="pb-3">Kjøretøy</th><th className="pb-3">Distanse</th><th className="pb-3">Fullført</th></tr></thead><tbody className="divide-y divide-white/[.06]">{data.completedJobs.map((job) => <tr key={job.id} className="align-top"><td className="py-4 pr-4"><button className="text-left font-medium text-slate-200 hover:text-emerald-200" onClick={() => setInspection(job)}>#{job.id} · {KIND_LABELS[job.jobKind]}</button></td><td className="py-4 pr-4 text-slate-400">{requesterLabel(job)}</td><td className="py-4 pr-4 text-slate-400">{job.fromName ?? "Slettet"} → {job.toName ?? "Slettet"}</td><td className="py-4 pr-4 text-slate-400">{job.assignedName ?? "–"}</td><td className="py-4 pr-4 text-slate-400">{vehicleLabel(job)}</td><td className="py-4 pr-4 text-slate-400">{distanceLabel(job)}</td><td className="py-4 text-slate-500">{formatDate(job.updatedAt)}</td></tr>)}</tbody></table></div>}
    </div>
    {inspection && <InspectionDialog job={inspection} onClose={() => setInspection(null)} />}
  </section>;
}

function PeopleRequestCard({ accessToken, locations, onCreated, onError }: { accessToken: string; locations: Location[]; onCreated: () => void; onError: (value: string | null) => void }) {
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return <form key={formKey} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-5" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const pickup = String(form.get("pickupAt") ?? "");
    setSaving(true); onError(null);
    void requestPeopleTransport(accessToken, { description: String(form.get("description") || "") || null, fromLocationId: Number(form.get("fromLocationId")), toLocationId: Number(form.get("toLocationId")), peopleCount: Number(form.get("peopleCount")), pickupAt: new Date(pickup).toISOString() })
      .then(() => { setFormKey((value) => value + 1); onCreated(); }).catch((reason) => onError(messageFrom(reason))).finally(() => setSaving(false));
  }}><div><p className="text-sm text-cyan-300">Innkjøp</p><h2 className="mt-1 text-xl font-semibold">Rekvirer persontransport</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Field label="Antall personer" name="peopleCount" type="number" min="1" max="500" required /><Field label="Hentetid" name="pickupAt" type="datetime-local" required /><LocationSelect label="Fra" name="fromLocationId" locations={locations} required /><LocationSelect label="Til" name="toLocationId" locations={locations} required /><label className="md:col-span-2 lg:col-span-4"><span className="mb-2 block text-sm text-slate-400">Kommentar</span><textarea name="description" maxLength={5000} className={textareaClass} /></label></div><div className="mt-5 flex justify-end"><button disabled={saving || locations.length < 2} className={primaryButton}>{saving ? "Sender …" : "Send forespørsel"}</button></div></form>;
}

function CreateJobCard({ accessToken, data, onCreated, onError }: { accessToken: string; data: TransportWorkspaceResponse; onCreated: () => void; onError: (value: string | null) => void }) {
  const [kind, setKind] = useState<Exclude<TransportJobKind, "people">>("equipment");
  const [stops, setStops] = useState([{ address: "", notes: "" }]);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const allowedLocations = useMemo(() => data.locations.filter((location) => kind === "equipment" ? location.type.toLocaleLowerCase("nb-NO") !== "transport" : ["transport", "lager"].includes(location.type.toLocaleLowerCase("nb-NO"))), [data.locations, kind]);
  const hasStops = kind === "innkjopsrunde" || kind === "henterunde";
  return <form key={formKey} className="mt-7 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.035] p-5" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const requesterUserId = Number(form.get("requesterUserId") || 0); const requesterWannabeId = Number(form.get("requesterWannabeId") || 0);
    setSaving(true); onError(null);
    void createTransportJob(accessToken, { description: String(form.get("description") ?? ""), fromLocationId: Number(form.get("fromLocationId")), toLocationId: Number(form.get("toLocationId")), vehicleId: Number(form.get("vehicleId")), jobKind: kind, requesterUserId: requesterUserId || null, requesterWannabeId: requesterWannabeId || null, stops: hasStops ? stops : [] })
      .then(() => { setKind("equipment"); setStops([{ address: "", notes: "" }]); setFormKey((value) => value + 1); onCreated(); }).catch((reason) => onError(messageFrom(reason))).finally(() => setSaving(false));
  }}><div><p className="text-sm text-emerald-300">Logistikk</p><h2 className="mt-1 text-xl font-semibold">Opprett transportoppdrag</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Select label="Type oppdrag" name="jobKind" value={kind} onChange={(value) => setKind(value as Exclude<TransportJobKind, "people">)} options={[{ value: "equipment", label: KIND_LABELS.equipment }, { value: "innkjopsrunde", label: KIND_LABELS.innkjopsrunde }, { value: "henterunde", label: KIND_LABELS.henterunde }]} /><Select label="Kjøretøy" name="vehicleId" required options={[{ value: "", label: "Velg kjøretøy" }, ...data.vehicles.map((vehicle) => ({ value: String(vehicle.id), label: `${vehicle.name} (${vehicle.registrationNumber})${vehicle.status === "loaned" ? " · utlånt" : ""}` }))]} /><Select label="Registrert bestiller" name="requesterUserId" options={[{ value: "", label: "Valgfritt" }, ...data.users.map((user) => ({ value: String(user.id), label: `${user.name}${user.wannabeId ? ` · ${user.wannabeId}` : ""}` }))]} /><Field label="Eller Wannabe-ID" name="requesterWannabeId" type="number" min="1" /><LocationSelect label="Start / fra" name="fromLocationId" locations={allowedLocations} required /><LocationSelect label="Slutt / til" name="toLocationId" locations={allowedLocations} required /><label className="md:col-span-2 lg:col-span-3"><span className="mb-2 block text-sm text-slate-400">Beskrivelse</span><textarea name="description" maxLength={5000} required className={textareaClass} /></label></div>
    {hasStops && <div className="mt-5 rounded-xl border border-white/[.08] bg-black/10 p-4"><div className="flex items-center justify-between"><div><p className="font-medium">Stopp underveis</p><p className="mt-1 text-xs text-slate-500">Minst én adresse er påkrevd. API-et geokoder stoppene og beregner estimert distanse.</p></div><button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs" onClick={() => setStops((current) => [...current, { address: "", notes: "" }])}>Legg til stopp</button></div><div className="mt-4 grid gap-3">{stops.map((stop, index) => <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input aria-label={`Adresse stopp ${index + 1}`} value={stop.address} onChange={(event) => updateStop(setStops, index, "address", event.target.value)} placeholder={`Adresse stopp ${index + 1}`} maxLength={255} className={inputClass} /><input aria-label={`Notat stopp ${index + 1}`} value={stop.notes} onChange={(event) => updateStop(setStops, index, "notes", event.target.value)} placeholder="Notat (valgfritt)" maxLength={4000} className={inputClass} /><button type="button" disabled={stops.length === 1} className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 disabled:opacity-30" onClick={() => setStops((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Fjern</button></div>)}</div></div>}
    <div className="mt-5 flex justify-end"><button disabled={saving || data.vehicles.length === 0} className={primaryButton}>{saving ? "Oppretter …" : "Opprett og reserver kjøretøy"}</button></div></form>;
}

function JobCard({ job, data, busy, onInspect, onAssign, onStart, onComplete }: { job: TransportJob; data: TransportWorkspaceResponse; busy: boolean; onInspect: () => void; onAssign: (userId: number) => void; onStart: (input: { vehicleId?: number | null; startOdometer?: number | null }) => void; onComplete: (endOdometer: number | null) => void }) {
  return <article className="rounded-xl border border-white/[.08] bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-600">#{job.id}</span><StatusBadge status={job.status} /><span className="text-xs text-slate-500">{KIND_LABELS[job.jobKind]}</span></div><h3 className="mt-2 font-medium text-slate-200">{job.description}</h3><p className="mt-2 text-sm text-slate-500">{job.fromName ?? "Slettet lokasjon"} → {job.toName ?? "Slettet lokasjon"}{job.stops.length ? ` · ${job.stops.length} stopp` : ""}</p></div><button disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40" onClick={onInspect}>{busy ? "Arbeider …" : "Inspiser"}</button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Fact label="Bestilt for" value={requesterLabel(job)} /><Fact label="Tildelt" value={job.assignedName ?? "Ikke tildelt"} /><Fact label="Kjøretøy" value={vehicleLabel(job)} /><Fact label="Distanse" value={distanceLabel(job)} />{job.pickupAt && <Fact label="Hentetid" value={formatDate(job.pickupAt)} />}{job.peopleCount && <Fact label="Personer" value={String(job.peopleCount)} />}</div>{data.canManage && <div className="mt-4 border-t border-white/[.06] pt-4">{job.status === "open" && <AssignAction job={job} busy={busy} onAssign={onAssign} />}{job.status === "assigned" && <StartAction job={job} vehicles={data.vehicles} busy={busy} onStart={onStart} />}{job.status === "in_progress" && <CompleteAction job={job} busy={busy} onComplete={onComplete} />}</div>}</article>;
}

function AssignAction({ job, busy, onAssign }: { job: TransportJob; busy: boolean; onAssign: (id: number) => void }) {
  return <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); onAssign(Number(new FormData(event.currentTarget).get("assignedUserId"))); }}><Select label="Tildel sjåfør" name="assignedUserId" required options={[{ value: "", label: job.eligibleAssignees.length ? "Velg person" : "Ingen med riktig kompetanse" }, ...job.eligibleAssignees.map((user) => ({ value: String(user.id), label: user.name }))]} /><button disabled={busy || job.eligibleAssignees.length === 0} className={smallPrimaryButton}>Tildel</button></form>;
}

function StartAction({ job, vehicles, busy, onStart }: { job: TransportJob; vehicles: TransportWorkspaceResponse["vehicles"]; busy: boolean; onStart: (input: { vehicleId?: number | null; startOdometer?: number | null }) => void }) {
  const [vehicleId, setVehicleId] = useState(job.assignedVehicleId ? String(job.assignedVehicleId) : "");
  const selected = job.assignedVehicleId ? { id: job.assignedVehicleId, currentOdometer: job.vehicleCurrentOdometer, odometerExempt: job.vehicleOdometerExempt ?? false } : vehicles.find((vehicle) => vehicle.id === Number(vehicleId));
  return <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onStart({ vehicleId: job.assignedVehicleId ? null : Number(vehicleId), startOdometer: selected?.odometerExempt ? null : Number(form.get("startOdometer")) }); }}>{!job.assignedVehicleId && <Select label="Kjøretøy" name="vehicleId" value={vehicleId} onChange={setVehicleId} required options={[{ value: "", label: "Velg tilgjengelig kjøretøy" }, ...vehicles.filter((vehicle) => vehicle.status === "available").map((vehicle) => ({ value: String(vehicle.id), label: `${vehicle.name} (${vehicle.registrationNumber})` }))]} />}{selected && !selected.odometerExempt && <Field label="Kilometerstand ved start" name="startOdometer" type="number" min={String(selected.currentOdometer ?? 0)} defaultValue={String(selected.currentOdometer ?? 0)} required />}<button disabled={busy || !selected} className={smallPrimaryButton}>Begynn tur</button></form>;
}

function CompleteAction({ job, busy, onComplete }: { job: TransportJob; busy: boolean; onComplete: (value: number | null) => void }) {
  const suggested = (job.startOdometer ?? 0) + (job.estimatedDistanceKm ?? 0);
  return <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("endOdometer"); onComplete(job.vehicleOdometerExempt ? null : Number(value)); }}>{!job.vehicleOdometerExempt && <Field label="Kilometerstand ved parkering" name="endOdometer" type="number" min={String(job.startOdometer ?? 0)} defaultValue={String(suggested)} required />}<button disabled={busy} className={smallPrimaryButton}>Fullfør tur</button></form>;
}

function InspectionDialog({ job, onClose }: { job: TransportJob; onClose: () => void }) {
  return <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d1927] p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-emerald-300">Oppdrag #{job.id}</p><h2 className="mt-1 text-2xl font-semibold">{KIND_LABELS[job.jobKind]}</h2></div><button className="rounded-lg border border-white/10 px-3 py-2 text-sm" onClick={onClose}>Lukk</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Fact label="Status" value={STATUS_LABELS[job.status]} /><Fact label="Bestilt for" value={requesterLabel(job)} /><Fact label="Fra" value={`${job.fromName ?? "Slettet"}${job.fromType ? ` (${job.fromType})` : ""}`} /><Fact label="Til" value={`${job.toName ?? "Slettet"}${job.toType ? ` (${job.toType})` : ""}`} /><Fact label="Hentetid" value={job.pickupAt ? formatDate(job.pickupAt) : "–"} /><Fact label="Antall personer" value={job.peopleCount?.toString() ?? "–"} /><Fact label="Kjøretøy" value={vehicleLabel(job)} /><Fact label="Tildelt" value={job.assignedName ?? "–"} /><Fact label="Estimert distanse" value={job.estimatedDistanceKm == null ? "–" : `${job.estimatedDistanceKm} km`} /><Fact label="Kjørt distanse" value={job.vehicleOdometerExempt ? "Unntatt" : job.distanceKm == null ? "–" : `${job.distanceKm} km`} /><Fact label="Kilometerstand start" value={job.vehicleOdometerExempt ? "Unntatt" : job.startOdometer?.toString() ?? "–"} /><Fact label="Kilometerstand slutt" value={job.vehicleOdometerExempt ? "Unntatt" : job.endOdometer?.toString() ?? "–"} /><Fact label="Avvik" value={job.vehicleOdometerExempt ? "Unntatt" : job.distanceDeviationKm == null ? "–" : `${job.distanceDeviationKm > 0 ? "+" : ""}${job.distanceDeviationKm} km`} /><Fact label="Opprettet" value={formatDate(job.createdAt)} /></div>{job.stops.length > 0 && <div className="mt-5 rounded-xl border border-white/[.08] p-4"><p className="text-sm font-medium">Stopp</p><ol className="mt-3 grid gap-2 text-sm text-slate-400">{job.stops.map((stop) => <li key={stop.id}><span className="text-slate-600">{stop.stopNumber}.</span> {stop.address}{stop.notes ? ` · ${stop.notes}` : ""}</li>)}</ol></div>}<div className="mt-5 rounded-xl bg-white/[.025] p-4"><p className="text-xs uppercase tracking-wider text-slate-600">Beskrivelse</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{job.description}</p></div></div></div>;
}

function LocationSelect({ label, locations, ...props }: { label: string; name: string; locations: Location[]; required?: boolean }) {
  return <Select label={label} {...props} options={[{ value: "", label: "Velg lokasjon" }, ...locations.map((location) => ({ value: String(location.id), label: `${location.name} (${location.type})` }))]} />;
}

function Select({ label, options, onChange, ...props }: { label: string; name: string; options: Array<{ value: string; label: string }>; value?: string; required?: boolean; onChange?: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><select {...props} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="w-full min-w-48 rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2.5 outline-none focus:border-emerald-300/60">{options.map((option) => <option key={`${option.value}:${option.label}`} value={option.value}>{option.label}</option>)}</select></label>;
}

function Field({ label, ...props }: { label: string; name: string; type?: string; min?: string; max?: string; defaultValue?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className={inputClass} /></label>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[.025] px-3 py-2"><p className="text-[11px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 text-sm text-slate-300">{value}</p></div>;
}

function StatusBadge({ status }: { status: TransportJob["status"] }) {
  const colors = status === "open" ? "bg-sky-300/10 text-sky-200" : status === "assigned" ? "bg-amber-300/10 text-amber-200" : status === "in_progress" ? "bg-violet-300/10 text-violet-200" : "bg-emerald-300/10 text-emerald-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{STATUS_LABELS[status]}</span>;
}

function EmptyState({ children }: { children: string }) { return <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-600">{children}</p>; }
function Banner({ tone, children }: { tone: "success" | "error"; children: string }) { return <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>{children}</div>; }
function WorkspaceState({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) { return <section className="grid flex-1 place-items-center py-16"><div className="text-center"><p className={error ? "text-rose-300" : "text-emerald-300"}>{error ? "Feil" : "Vent litt"}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-slate-500">{detail}</p></div></section>; }

function requesterLabel(job: TransportJob): string { return job.requesterName ? `${job.requesterName}${job.requesterWannabeId ? ` · ${job.requesterWannabeId}` : ""}` : job.requesterWannabeId ? `Wannabe ${job.requesterWannabeId}` : "–"; }
function vehicleLabel(job: TransportJob): string { return job.vehicleName ? `${job.vehicleName} (${job.vehicleRegistrationNumber ?? "–"})` : "–"; }
function distanceLabel(job: TransportJob): string { if (job.vehicleOdometerExempt) return "Unntatt"; if (job.distanceKm != null && job.estimatedDistanceKm != null) return `${job.distanceKm} / ${job.estimatedDistanceKm} km${job.distanceDeviationKm != null ? ` · ${job.distanceDeviationKm > 0 ? "+" : ""}${job.distanceDeviationKm}` : ""}`; if (job.estimatedDistanceKm != null) return `Estimat ${job.estimatedDistanceKm} km`; if (job.distanceKm != null) return `${job.distanceKm} km`; return job.startOdometer != null ? `Start ${job.startOdometer}` : "–"; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }); }
function messageFrom(reason: unknown): string { return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres."; }
function updateStop(setter: React.Dispatch<React.SetStateAction<Array<{ address: string; notes: string }>>>, index: number, key: "address" | "notes", value: string) { setter((current) => current.map((stop, itemIndex) => itemIndex === index ? { ...stop, [key]: value } : stop)); }

const inputClass = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60";
const textareaClass = `${inputClass} min-h-24`;
const primaryButton = "rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";
const smallPrimaryButton = "rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40";
