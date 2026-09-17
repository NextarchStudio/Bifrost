import type { CurrentUser, UserProfileResponse } from "@bifrost/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { getUserProfile, getUserProfilePicture } from "../../api/client";

export function ProfileWorkspace({ accessToken, currentUser }: { accessToken: string; currentUser: CurrentUser }) {
  const [wannabeId, setWannabeId] = useState<number | null>(currentUser.wannabeId);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [canViewOtherProfiles, setCanViewOtherProfiles] = useState(false);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProfile(null); setError(null);
    if (!wannabeId) return () => { active = false; };
    void getUserProfile(accessToken, wannabeId)
      .then((data) => { if (active) { setProfile(data); setCanViewOtherProfiles(data.canViewOtherProfiles); } })
      .catch((reason) => { if (active) setError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken, wannabeId]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPictureUrl(null);
    if (!profile?.pictureAvailable) return () => { active = false; };
    void getUserProfilePicture(accessToken, profile.user.wannabeId).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPictureUrl(objectUrl);
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [accessToken, profile?.pictureAvailable, profile?.user.wannabeId]);

  if (!wannabeId) return <section className="grid flex-1 place-items-center py-16"><div className="max-w-xl rounded-3xl border border-amber-300/20 bg-amber-300/[.05] p-8 text-center"><p className="text-sm text-amber-300">Profilen kan ikke åpnes</p><h1 className="mt-3 text-3xl font-semibold">Wannabe-ID mangler</h1><p className="mt-4 text-slate-400">{currentUser.name} må få koblet en Wannabe-ID til Bifrost-brukeren før lån og forespørsler kan vises.</p></div></section>;

  return <section className="flex-1 py-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-medium text-emerald-300">Identitet og aktivitet</p><h1 className="mt-2 text-3xl font-semibold">{profile?.isOwnProfile ? "Min profil" : "Profil"}</h1><p className="mt-2 text-slate-500">Aktive lån og forespørsler fra den eksisterende V1-databasen.</p></div>{canViewOtherProfiles && <ProfileLookup current={wannabeId} own={currentUser.wannabeId} onOpen={setWannabeId} />}</div>
    {error && <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {!profile && !error && <div className="rounded-2xl border border-white/10 bg-white/[.025] px-6 py-12 text-center text-slate-500">Henter profil …</div>}
    {profile && <>
      <ProfileHeader profile={profile} pictureUrl={pictureUrl} />
      <div className="mt-6 grid gap-5 xl:grid-cols-2"><LoanTable title={profile.isOwnProfile ? "Mine aktive kjøretøylån" : "Aktive kjøretøylån"} empty="Ingen aktive kjøretøylån." headers={["Kjøretøy", "Regnr", "Utstedt"]} rows={profile.vehicleLoans.map((loan) => [loan.vehicleName, loan.registrationNumber, formatDate(loan.issuedAt)])} /><LoanTable title={profile.isOwnProfile ? "Mine aktive utstyrslån" : "Aktive utstyrslån"} empty="Ingen aktive utstyrslån." headers={["Utstyr", "Serienummer", "Antall", "Utstedt"]} rows={profile.equipmentLoans.map((loan) => [loan.equipmentName, loan.serialNumber, String(loan.quantity), formatDate(loan.issuedAt)])} /></div>
      <div className="mt-5"><LoanTable title={profile.isOwnProfile ? "Mine aktive sambandlån" : "Aktive sambandlån"} empty="Ingen aktive sambandlån." headers={["Type", "Innhold", "Antall ting", "Utstedt"]} rows={profile.commsLoans.map((loan) => [loan.setId ? `Sett: ${loan.setName ?? "–"}` : "Enkeltutstyr", loan.itemsSummary, String(loan.totalItems), formatDate(loan.issuedAt)])} /></div>
      {profile.canViewRequests && <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-medium">{profile.isOwnProfile ? "Mine forespørsler" : "Brukerens forespørsler"}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">ID</th><th className="px-5 py-4">Utstyr</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Opprettet</th></tr></thead><tbody className="divide-y divide-white/[.06]">{profile.requests.length === 0 && <tr><td colSpan={4} className="px-5 py-9 text-center text-slate-500">Ingen aktive forespørsler.</td></tr>}{profile.requests.map((request) => <tr key={request.id}><td className="px-5 py-4 text-slate-500">#{request.id}</td><td className="px-5 py-4 text-slate-300">{request.itemsSummary}</td><td className="px-5 py-4"><StatusBadge status={request.status} /></td><td className="px-5 py-4 text-slate-500">{formatDate(request.createdAt)}</td></tr>)}</tbody></table></div></div>}
    </>}
  </section>;
}

function ProfileHeader({ profile, pictureUrl }: { profile: UserProfileResponse; pictureUrl: string | null }) {
  const initials = `${profile.user.firstName[0] ?? ""}${profile.user.lastName[0] ?? ""}`.toUpperCase() || "?";
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="flex flex-wrap items-center gap-5">{pictureUrl ? <img src={pictureUrl} alt="Profilbilde" className="size-24 rounded-full border border-white/10 object-cover" /> : <div className="grid size-24 place-items-center rounded-full border border-white/10 bg-black/20 text-2xl font-semibold text-slate-400">{initials}</div>}<div><h2 className="text-2xl font-semibold">{profile.user.name}</h2><p className="mt-1 text-sm text-slate-500">Wannabe-ID {profile.user.wannabeId}</p><div className="mt-3 flex flex-wrap gap-2">{profile.user.roleDisplayNames.map((role) => <span key={role} className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-200">{role}</span>)}</div></div></div><dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3"><Info label="Fornavn" value={profile.user.firstName} /><Info label="Etternavn" value={profile.user.lastName} /><Info label="E-post" value={profile.user.email} /></dl>{profile.isOwnProfile && <p className="mt-5 text-xs text-slate-600">Innlogging og passord administreres i Keycloak. V2 lagrer ikke et lokalt innloggingspassord.</p>}</div>;
}

function ProfileLookup({ current, own, onOpen }: { current: number; own: number | null; onOpen: (wannabeId: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) return setError("Skriv inn en gyldig Wannabe-ID.");
    setError(null); if (id !== current) onOpen(id);
  };
  return <form onSubmit={submit}><label><span className="mb-2 block text-xs text-slate-500">Vis annen profil</span><div className="flex gap-2"><input value={value} onChange={(event) => setValue(event.target.value)} inputMode="numeric" placeholder="Wannabe-ID" className="w-40 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm outline-none focus:border-emerald-300/60" /><button className="rounded-xl border border-emerald-300/30 px-4 py-2.5 text-sm text-emerald-200">Åpne</button>{own && current !== own && <button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300" onClick={() => onOpen(own)}>Min profil</button>}</div></label>{error && <p className="mt-1 text-xs text-rose-300">{error}</p>}</form>;
}

function LoanTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: string[][] }) {
  return <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-medium">{title}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-white/[.06]">{rows.length === 0 && <tr><td colSpan={headers.length} className="px-5 py-9 text-center text-slate-500">{empty}</td></tr>}{rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className="px-5 py-4 text-slate-300">{value}</td>)}</tr>)}</tbody></table></div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 text-sm text-slate-300">{value}</dd></div>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "approved" || status === "fulfilled" ? "bg-emerald-300/10 text-emerald-200" : status === "rejected" ? "bg-rose-300/10 text-rose-200" : "bg-amber-300/10 text-amber-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{status}</span>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Profilen kunne ikke hentes.";
}
