import type {
  CrewProfile,
  VehicleCompetencyCode,
  VehicleCompetencyProfile,
  VehicleCompetencyRequirement,
  VehicleListItem,
  VehicleWorkspaceResponse,
} from "@bifrost/contracts";
import { VEHICLE_COMPETENCY_CODES } from "@bifrost/contracts";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createVehicle,
  deleteVehicle,
  getVehicleCompetencyProfile,
  getVehicleWorkspace,
  issueVehicleLoan,
  lookupCrewProfile,
  returnVehicleLoan,
  saveVehicleCompetencyProfile,
  updateVehicle,
} from "../../api/client";
import { confirmAction } from "../../components/notifications";

const REQUIREMENTS: Array<{ code: VehicleCompetencyRequirement; label: string }> = [
  { code: "none", label: "Ingen krav" }, { code: "kdo", label: "KDO" },
  { code: "t1", label: "T1" }, { code: "t2", label: "T2" }, { code: "t3", label: "T3" }, { code: "t4", label: "T4" },
  { code: "b", label: "B" }, { code: "be", label: "BE" }, { code: "c1", label: "C1" }, { code: "c1e", label: "C1E" },
  { code: "c", label: "C" }, { code: "ce", label: "CE" },
];
const LABELS = Object.fromEntries(REQUIREMENTS.map((item) => [item.code, item.label])) as Record<VehicleCompetencyRequirement, string>;

export function VehicleWorkspace({ accessToken }: { accessToken: string }) {
  const [workspace, setWorkspace] = useState<VehicleWorkspaceResponse | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<VehicleListItem | null>(null);
  const [activeTab, setActiveTab] = useState<"fleet" | "loans" | "new" | "competency">("fleet");

  useEffect(() => {
    let active = true;
    setError(null);
    void getVehicleWorkspace(accessToken)
      .then((data) => { if (active) setWorkspace(data); })
      .catch((reason) => { if (active) setError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken, refresh]);

  const reload = (message?: string) => {
    if (message) setNotice(message);
    setRefresh((value) => value + 1);
  };

  return <section className="flex-1 py-10">
    <div className="mb-8"><p className="text-sm font-medium text-emerald-300">Kjøretøy og kompetanse</p><h1 className="mt-2 text-3xl font-semibold">Kjøretøy</h1><p className="mt-2 max-w-3xl text-slate-500">Samme kjøretøyregister, KDO og sertifikater som V1. Alle utlån og returer håndheves i API-et og audit-logges.</p></div>
    {notice && <Banner tone="success">{notice}</Banner>}
    {error && <Banner tone="error">{error}</Banner>}

    {!workspace && !error && <div className="rounded-2xl border border-white/10 bg-white/[.025] px-6 py-12 text-center text-slate-500">Henter kjøretøy …</div>}
    {workspace && <>
      <div className={tabsClass} role="tablist" aria-label="Kjøretøyvisning">
        <Tab active={activeTab === "fleet"} onClick={() => setActiveTab("fleet")}>Kjøretøyliste ({workspace.vehicles.length})</Tab>
        {workspace.canManageLoans && <Tab active={activeTab === "loans"} onClick={() => setActiveTab("loans")}>Utlån</Tab>}
        {workspace.canCreate && <Tab active={activeTab === "new"} onClick={() => setActiveTab("new")}>Nytt kjøretøy</Tab>}
        {workspace.canManageCompetencies && <Tab active={activeTab === "competency"} onClick={() => setActiveTab("competency")}>Kompetanse</Tab>}
      </div>
      {activeTab === "new" && workspace.canCreate && <div className="mt-6"><CreateVehicleCard accessToken={accessToken} onCreated={() => reload("Kjøretøyet ble opprettet.")} /></div>}
      {activeTab === "loans" && workspace.canManageLoans && <div className="mt-6"><IssueVehicleCard accessToken={accessToken} vehicles={workspace.vehicles} onIssued={() => reload("Kjøretøyet ble lånt ut.")} /></div>}
      {activeTab === "competency" && workspace.canManageCompetencies && <CompetencyAdminCard accessToken={accessToken} />}

      {activeTab === "fleet" && <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        <div className="border-b border-white/10 px-5 py-4"><h2 className="font-medium">Kjøretøyliste</h2><p className="mt-1 text-sm text-slate-500">{workspace.vehicles.length} registrerte kjøretøy</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Kjøretøy</th><th className="px-5 py-4">Kilometer</th><th className="px-5 py-4">Nyttelast</th><th className="px-5 py-4">Krav</th><th className="px-5 py-4">Status / låntaker</th><th className="px-5 py-4"><span className="sr-only">Handlinger</span></th></tr></thead><tbody className="divide-y divide-white/[.06]">
          {workspace.vehicles.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Ingen kjøretøy er registrert.</td></tr>}
          {workspace.vehicles.map((vehicle) => <tr key={vehicle.id} className="align-top hover:bg-white/[.02]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{vehicle.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{vehicle.registrationNumber}</p>{!vehicle.vegvesenExempt && <a className="mt-2 inline-block text-xs text-emerald-300 hover:underline" href={vegvesenUrl(vehicle.registrationNumber)} target="_blank" rel="noreferrer">Vis hos Vegvesen</a>}</td><td className="px-5 py-4 text-slate-300">{vehicle.odometerExempt ? "Unntatt" : vehicle.currentOdometer === null ? "–" : `${vehicle.currentOdometer.toLocaleString("nb-NO")} km`}</td><td className="px-5 py-4 text-slate-300">{vehicle.vegvesenExempt ? "Unntatt" : vehicle.maxPayloadKg === null ? "–" : `${vehicle.maxPayloadKg.toLocaleString("nb-NO")} kg`}</td><td className="px-5 py-4"><p className="text-slate-300">{LABELS[vehicle.competencyRequirement]}</p>{vehicle.competencyOverrideRequirement && <p className="mt-1 text-xs text-slate-600">Overstyres av {LABELS[vehicle.competencyOverrideRequirement]}</p>}</td><td className="px-5 py-4"><StatusBadge status={vehicle.status} />{vehicle.activeLoanId && <div className="mt-2"><p className="text-slate-300">{vehicle.activeBorrowerName ?? `Wannabe ${vehicle.activeWannabeId}`}</p><p className="mt-1 text-xs text-slate-600">ID {vehicle.activeWannabeId}{vehicle.activeIssuedAt ? ` · ${formatDate(vehicle.activeIssuedAt)}` : ""}</p></div>}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{vehicle.activeLoanId && workspace.canManageLoans && <button className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-300/10" onClick={() => {
            setError(null);
            void returnVehicleLoan(accessToken, vehicle.activeLoanId!).then(() => reload("Kjøretøyet ble returnert.")).catch((reason) => setError(messageFrom(reason)));
          }}>Returner</button>}{workspace.canEdit && <><button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5" onClick={() => setEditing(vehicle)}>Rediger</button><button className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 hover:bg-rose-300/10" onClick={async () => {
            if (!await confirmAction({ title: "Slett kjøretøy?", message: `${vehicle.name} slettes permanent dersom kjøretøyet ikke er i bruk.`, confirmLabel: "Slett kjøretøy", danger: true })) return;
            setError(null);
            void deleteVehicle(accessToken, vehicle.id).then(() => reload("Kjøretøyet ble slettet.")).catch((reason) => setError(messageFrom(reason)));
          }}>Slett</button></>}</div></td></tr>)}
        </tbody></table></div>
      </div>}
    </>}

    {editing && <EditVehicleDialog accessToken={accessToken} vehicle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload("Kjøretøyet ble oppdatert."); }} />}
  </section>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" role="tab" aria-selected={active} className={`rounded-lg px-4 py-2.5 text-sm transition ${active ? "bg-emerald-300 font-semibold text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`} onClick={onClick}>{children}</button>; }

function CreateVehicleCard({ accessToken, onCreated }: { accessToken: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<VehicleCompetencyRequirement>("none");
  const [odometerMode, setOdometerMode] = useState<"tracked" | "exempt">("tracked");
  const [formKey, setFormKey] = useState(0);

  return <form key={formKey} className="rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(null);
    void createVehicle(accessToken, {
      name: String(form.get("name") ?? ""),
      registrationNumber: String(form.get("registrationNumber") ?? ""),
      competencyRequirement: requirement,
      competencyOverrideRequirement: requirement === "kdo" ? String(form.get("competencyOverrideRequirement") || "") as VehicleCompetencyCode || null : null,
      odometerMode,
      currentOdometer: odometerMode === "tracked" ? Number(form.get("currentOdometer")) : null,
      vegvesenExempt: form.get("vegvesenExempt") === "on",
      notes: String(form.get("notes") || "") || null,
    }).then(() => { setRequirement("none"); setOdometerMode("tracked"); setFormKey((value) => value + 1); onCreated(); }).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
  }}><div><p className="text-sm text-emerald-300">Register</p><h2 className="mt-1 text-xl font-semibold">Nytt kjøretøy</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Navn" name="name" required /><Field label="Registreringsnummer" name="registrationNumber" required /><SelectField label="Kompetansekrav" name="competencyRequirement" value={requirement} onChange={(value) => setRequirement(value as VehicleCompetencyRequirement)} options={REQUIREMENTS} />{requirement === "kdo" && <SelectField label="KDO kan overstyres av" name="competencyOverrideRequirement" options={[{ code: "", label: "Ingen overstyring" }, ...REQUIREMENTS.filter((item) => item.code !== "none" && item.code !== "kdo")]} />}<SelectField label="Kilometerstand" name="odometerMode" value={odometerMode} onChange={(value) => setOdometerMode(value as "tracked" | "exempt")} options={[{ code: "tracked", label: "Har kilometerstand" }, { code: "exempt", label: "Unntatt kilometerstand" }]} />{odometerMode === "tracked" && <Field label="Kilometerstand ved registrering" name="currentOdometer" type="number" min="0" required />}<label className="flex items-center gap-3 text-sm text-slate-300"><input name="vegvesenExempt" type="checkbox" className="accent-emerald-300" />Fiktivt regnr / unntatt Vegvesen</label><label className="sm:col-span-2"><span className="mb-2 block text-sm text-slate-400">Notater</span><textarea name="notes" maxLength={4000} className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label></div>{error && <InlineError>{error}</InlineError>}<div className="mt-5 flex justify-end"><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Oppretter …" : "Opprett kjøretøy"}</button></div></form>;
}

function IssueVehicleCard({ accessToken, vehicles, onIssued }: { accessToken: string; vehicles: VehicleListItem[]; onIssued: () => void }) {
  const available = useMemo(() => vehicles.filter((vehicle) => vehicle.status === "available" && !vehicle.activeLoanId), [vehicles]);
  const [vehicleId, setVehicleId] = useState("");
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<CrewProfile | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ vehicle: VehicleListItem; wannabeId: number; profile: VehicleCompetencyProfile } | null>(null);

  const performIssue = (wannabeId: number, competencies: Array<VehicleCompetencyCode | "kdo">, competencyConfirmed: boolean) => {
    setSaving(true); setError(null);
    void issueVehicleLoan(accessToken, { vehicleId: Number(vehicleId), wannabeId, competencies, competencyConfirmed })
      .then(() => { setVehicleId(""); setQuery(""); setPerson(null); setConfirmation(null); onIssued(); })
      .catch((reason) => { setError(messageFrom(reason)); setConfirmation(null); }).finally(() => setSaving(false));
  };
  const lookup = () => {
    if (!query.trim() || lookupBusy) return;
    setLookupBusy(true); setError(null);
    void lookupCrewProfile(accessToken, query.trim()).then((profile) => { setPerson(profile); setQuery(String(profile.id)); }).catch((reason) => setError(messageFrom(reason))).finally(() => setLookupBusy(false));
  };

  return <form className="rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
    event.preventDefault();
    const vehicle = available.find((item) => item.id === Number(vehicleId));
    const wannabeId = person?.id ?? (/^\d+$/.test(query.trim()) ? Number(query.trim()) : 0);
    if (!vehicle) return setError("Velg et tilgjengelig kjøretøy.");
    if (!wannabeId) return setError("Slå opp badge eller bruk en gyldig Wannabe-ID.");
    setSaving(true); setError(null);
    void getVehicleCompetencyProfile(accessToken, wannabeId, vehicle.id).then((profile) => {
      if (requirementSatisfied(vehicle, profile)) performIssue(wannabeId, [], false);
      else { setSaving(false); setConfirmation({ vehicle, wannabeId, profile }); }
    }).catch((reason) => { setSaving(false); setError(messageFrom(reason)); });
  }}><div><p className="text-sm text-emerald-300">Operativt</p><h2 className="mt-1 text-xl font-semibold">Lån ut kjøretøy</h2></div><div className="mt-5 grid gap-4"><SelectField label="Tilgjengelig kjøretøy" name="vehicleId" value={vehicleId} onChange={(value) => { setVehicleId(value); setConfirmation(null); }} options={[{ code: "", label: "Velg kjøretøy" }, ...available.map((vehicle) => ({ code: String(vehicle.id), label: `${vehicle.name} (${vehicle.registrationNumber}) · ${LABELS[vehicle.competencyRequirement]}` }))]} /><label><span className="mb-2 block text-sm text-slate-400">Wannabe-ID / badge-scan</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPerson(null); setConfirmation(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); lookup(); } }} required autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /><span className="mt-2 block text-xs text-slate-600">{lookupBusy ? "Søker …" : "Skann badge eller skriv ID, og trykk Enter."}</span></label>{person && <PersonCard person={person} />}</div>{error && <InlineError>{error}</InlineError>}<div className="mt-5 flex justify-end"><button disabled={saving || lookupBusy || available.length === 0} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Kontrollerer …" : "Registrer utlån"}</button></div>
    {confirmation && <CompetencyConfirmation vehicle={confirmation.vehicle} profile={confirmation.profile} saving={saving} onCancel={() => setConfirmation(null)} onConfirm={(selected) => performIssue(confirmation.wannabeId, selected, true)} />}
  </form>;
}

function CompetencyConfirmation({ vehicle, profile, saving, onCancel, onConfirm }: { vehicle: VehicleListItem; profile: VehicleCompetencyProfile; saving: boolean; onCancel: () => void; onConfirm: (selected: Array<VehicleCompetencyCode | "kdo">) => void }) {
  const initial = [...VEHICLE_COMPETENCY_CODES.filter((code) => profile.competencies[code]), ...(profile.kdoForVehicle ? ["kdo" as const] : [])];
  const [selected, setSelected] = useState<Array<VehicleCompetencyCode | "kdo">>(initial);
  const toggle = (code: VehicleCompetencyCode | "kdo") => setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  return <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1927] p-6"><p className="text-sm text-amber-300">Kompetanse må kontrolleres</p><h3 className="mt-2 text-2xl font-semibold">{vehicle.name} krever {LABELS[vehicle.competencyRequirement]}</h3>{vehicle.competencyOverrideRequirement && <p className="mt-2 text-sm text-slate-400">{LABELS[vehicle.competencyOverrideRequirement]} kan overstyre KDO for dette kjøretøyet.</p>}<p className="mt-3 text-sm text-slate-500">Bekreft bare dokumentasjon du fysisk har kontrollert. Valget lagres på kompetanseprofilen; KDO lagres for dette kjøretøyet.</p><CompetencyChecks selected={selected} includeKdo onToggle={toggle} /><div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm" onClick={onCancel}>Avbryt</button><button type="button" disabled={saving} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50" onClick={() => onConfirm(selected)}>Bekreft og lån ut</button></div></div></div>;
}

function CompetencyAdminCard({ accessToken }: { accessToken: string }) {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<CrewProfile | null>(null);
  const [wannabeId, setWannabeId] = useState<number | null>(null);
  const [selected, setSelected] = useState<VehicleCompetencyCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toggle = (code: VehicleCompetencyCode | "kdo") => {
    if (code === "kdo") return;
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  };
  const load = async () => {
    const raw = query.trim();
    setBusy(true); setError(null); setNotice(null); setPerson(null); setWannabeId(null);
    try {
      let id = /^\d+$/.test(raw) ? Number(raw) : 0;
      try {
        const found = await lookupCrewProfile(accessToken, raw);
        setPerson(found); id = found.id; setQuery(String(found.id));
      } catch (reason) {
        if (!id) throw reason;
      }
      const profile = await getVehicleCompetencyProfile(accessToken, id);
      setWannabeId(id);
      setSelected(VEHICLE_COMPETENCY_CODES.filter((code) => profile.competencies[code]));
    } catch (reason) { setError(messageFrom(reason)); }
    finally { setBusy(false); }
  };
  return <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-5"><div><p className="text-sm text-sky-300">Admin</p><h2 className="mt-1 text-xl font-semibold">Sertifikater og kompetanse</h2><p className="mt-2 text-sm text-slate-500">Tilsvarer kompetansefeltene på brukeradministrasjonen i V1. KDO håndteres per kjøretøy ved utlån.</p></div><label className="mt-5 block max-w-xl"><span className="sr-only">Wannabe-ID eller badge-scan</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void load(); } }} placeholder="Wannabe-ID eller badge-scan" autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-sky-300/60" /><span className="mt-2 block text-xs text-slate-600">{busy ? "Henter profil …" : "Trykk Enter for å hente profilen."}</span></label>{person && <PersonCard person={person} />}{wannabeId && <><CompetencyChecks selected={selected} onToggle={toggle} /><div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-xl bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50" onClick={() => {
    setBusy(true); setError(null); setNotice(null);
    void saveVehicleCompetencyProfile(accessToken, wannabeId, selected).then(() => setNotice("Kompetanseprofilen ble lagret.")).catch((reason) => setError(messageFrom(reason))).finally(() => setBusy(false));
  }}>{busy ? "Lagrer …" : "Lagre kompetanse"}</button></div></>}{notice && <div className="mt-4 text-sm text-emerald-300">{notice}</div>}{error && <InlineError>{error}</InlineError>}</div>;
}

function EditVehicleDialog({ accessToken, vehicle, onClose, onSaved }: { accessToken: string; vehicle: VehicleListItem; onClose: () => void; onSaved: () => void }) {
  const [requirement, setRequirement] = useState(vehicle.competencyRequirement);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true"><form className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d1927] p-6" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); setError(null);
    void updateVehicle(accessToken, vehicle.id, { name: String(form.get("name") ?? ""), registrationNumber: String(form.get("registrationNumber") ?? ""), competencyRequirement: requirement, competencyOverrideRequirement: requirement === "kdo" ? String(form.get("competencyOverrideRequirement") || "") as VehicleCompetencyCode || null : null, vegvesenExempt: form.get("vegvesenExempt") === "on" }).then(onSaved).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
  }}><p className="text-sm text-emerald-300">Kjøretøy #{vehicle.id}</p><h2 className="mt-1 text-2xl font-semibold">Rediger kjøretøy</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Navn" name="name" defaultValue={vehicle.name} required /><Field label="Registreringsnummer" name="registrationNumber" defaultValue={vehicle.registrationNumber} readOnly={!vehicle.vegvesenExempt} required /><SelectField label="Kompetansekrav" name="competencyRequirement" value={requirement} onChange={(value) => setRequirement(value as VehicleCompetencyRequirement)} options={REQUIREMENTS} />{requirement === "kdo" && <SelectField label="KDO kan overstyres av" name="competencyOverrideRequirement" defaultValue={vehicle.competencyOverrideRequirement ?? ""} options={[{ code: "", label: "Ingen overstyring" }, ...REQUIREMENTS.filter((item) => item.code !== "none" && item.code !== "kdo")]} />}<label className="flex items-center gap-3 text-sm text-slate-300"><input name="vegvesenExempt" type="checkbox" defaultChecked={vehicle.vegvesenExempt} className="accent-emerald-300" />Fiktivt regnr / unntatt Vegvesen</label></div>{!vehicle.vegvesenExempt && <p className="mt-3 text-xs text-slate-600">Registreringsnummer kan endres etter at kjøretøyet er lagret som unntatt Vegvesen, likt V1.</p>}{error && <InlineError>{error}</InlineError>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm" onClick={onClose}>Avbryt</button><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Lagrer …" : "Lagre"}</button></div></form></div>;
}

function CompetencyChecks({ selected, includeKdo = false, onToggle }: { selected: Array<VehicleCompetencyCode | "kdo">; includeKdo?: boolean; onToggle: (code: VehicleCompetencyCode | "kdo") => void }) {
  const groups: Array<{ title: string; codes: Array<VehicleCompetencyCode | "kdo"> }> = [
    { title: "Kompetansebevis", codes: ["t1", "t2", "t3", "t4"] },
    { title: "Førerkort", codes: ["b", "be", "c1", "c1e", "c", "ce"] },
    ...(includeKdo ? [{ title: "Dokumentert opplæring", codes: ["kdo" as const] }] : []),
  ];
  return <div className="mt-5 grid gap-3 sm:grid-cols-3">{groups.map((group) => <fieldset key={group.title} className="rounded-xl border border-white/[.08] bg-black/10 p-4"><legend className="px-1 text-sm font-medium text-slate-300">{group.title}</legend><div className="mt-2 grid grid-cols-2 gap-2">{group.codes.map((code) => <label key={code} className="flex cursor-pointer items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={selected.includes(code)} onChange={() => onToggle(code)} className="accent-emerald-300" />{LABELS[code]}</label>)}</div></fieldset>)}</div>;
}

function requirementSatisfied(vehicle: VehicleListItem, profile: VehicleCompetencyProfile): boolean {
  if (vehicle.competencyRequirement === "none") return true;
  if (vehicle.competencyRequirement === "kdo") return profile.kdoForVehicle || Boolean(vehicle.competencyOverrideRequirement && profile.competencies[vehicle.competencyOverrideRequirement]);
  return profile.competencies[vehicle.competencyRequirement];
}

function Field({ label, ...props }: { label: string; name: string; type?: string; min?: string; defaultValue?: string; required?: boolean; readOnly?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none read-only:text-slate-500 focus:border-emerald-300/60" /></label>;
}

function SelectField({ label, options, onChange, ...props }: { label: string; name: string; options: Array<{ code: string; label: string }>; value?: string; defaultValue?: string; onChange?: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><select {...props} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2.5 outline-none focus:border-emerald-300/60">{options.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>;
}

function PersonCard({ person }: { person: CrewProfile }) {
  return <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] px-4 py-3"><p className="font-medium text-emerald-100">{person.displayName}</p><p className="mt-1 text-xs text-emerald-200/60">Wannabe {person.id}{person.crewName ? ` · ${person.crewName}` : ""}{person.role ? ` · ${person.role}` : ""}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "available";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-300/10 text-emerald-200" : status === "loaned" ? "bg-amber-300/10 text-amber-200" : "bg-slate-300/10 text-slate-300"}`}>{status}</span>;
}

function Banner({ tone, children }: { tone: "success" | "error"; children: string }) {
  return <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>{children}</div>;
}

function InlineError({ children }: { children: string }) {
  return <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{children}</p>;
}

function vegvesenUrl(registrationNumber: string): string {
  return `https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/sjekk-kjoretoyopplysninger/?registreringsnummer=${encodeURIComponent(registrationNumber)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.";
}

const tabsClass = "flex flex-wrap gap-1 rounded-xl border border-white/[.08] bg-black/10 p-1.5";
