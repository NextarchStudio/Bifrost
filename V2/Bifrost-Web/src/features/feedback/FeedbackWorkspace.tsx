import type { FeedbackEntry, FeedbackStatus, FeedbackType, FeedbackWorkspaceResponse } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import {
  createFeedback,
  deleteFeedback,
  getFeedbackAttachment,
  getFeedbackWorkspace,
  updateFeedbackStatus,
} from "../../api/client";
import { confirmAction } from "../../components/notifications";

export function FeedbackWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<FeedbackWorkspaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const reload = async () => setData(await getFeedbackWorkspace(accessToken));
  useEffect(() => { void reload().catch((reason) => setError(messageFrom(reason))); }, [accessToken]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null); setSuccess(null);
    try { await action(); await reload(); setSuccess(message); }
    catch (reason) { setError(messageFrom(reason)); throw reason; }
  };
  const openAttachment = async (entry: FeedbackEntry) => {
    setError(null);
    try {
      const blob = await getFeedbackAttachment(accessToken, entry.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { setError(messageFrom(reason)); }
  };
  if (!data) return <WorkspaceState title="Laster tilbakemeldinger" detail={error ?? "Henter dine innmeldinger og status …"} error={Boolean(error)} />;
  return <section className="flex-1 py-8">
    <div className="mb-7"><p className="text-sm text-fuchsia-300">Forbedring og feilretting</p><h1 className="mt-1 text-3xl font-semibold">Tilbakemeldinger</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Meld inn bugs og forslag. Vedlegg lagres lokalt og er bare tilgjengelige for eieren, developer og logistikk.</p></div>
    {error && <Banner tone="error">{error}</Banner>}{success && <Banner tone="success">{success}</Banner>}
    <NewFeedback accessToken={accessToken} run={run} />
    <FeedbackList title="Mine tilbakemeldinger" detail="Åpne innmeldinger du har sendt" entries={data.myEntries} accessToken={accessToken} run={run} openAttachment={openAttachment} own />
    {data.canViewAll && <FeedbackList title="Innmeldt til utvikler" detail="Alle åpne innmeldinger" entries={data.allEntries} accessToken={accessToken} run={run} openAttachment={openAttachment} canManage={data.canManageAll} />}
  </section>;
}

function NewFeedback({ accessToken, run }: { accessToken: string; run: RunAction }) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [saving, setSaving] = useState(false);
  return <form className={cardClass} encType="multipart/form-data" onSubmit={(event) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const attachment = form.get("attachment"); setSaving(true);
    void run(() => createFeedback(accessToken, {
      type,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      needsDatabaseFix: form.get("needsDatabaseFix") === "1",
      attachment: attachment instanceof File && attachment.size > 0 ? attachment : null,
    }), "Tilbakemeldingen er sendt til utvikler.").then(() => { formElement.reset(); setType("bug"); }).catch(() => undefined).finally(() => setSaving(false));
  }}>
    <p className="text-sm text-fuchsia-300">Ny tilbakemelding</p><h2 className="mt-1 text-xl font-semibold">Send til utvikler</h2>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Select label="Type" name="type" value={type} onChange={(value) => setType(value as FeedbackType)} options={[{ value: "bug", label: "Bug til utvikler" }, { value: "feature", label: "Feature" }]} />
      <Field label="Kort tittel" name="title" minLength={3} maxLength={180} required />
      <label className="md:col-span-2"><Label>Beskrivelse</Label><textarea name="description" minLength={10} maxLength={5000} required className={textareaClass} placeholder="Forklar hva du ønsker, hvilken bug du har funnet, og gjerne hva som må rettes." /></label>
      {type === "bug" && <label><Label>Skjermbilde eller bilde</Label><input name="attachment" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" className={fileClass} /><span className="mt-2 block text-xs text-slate-600">Valgfritt · JPG, PNG, WEBP eller GIF · maks 5 MB</span></label>}
      <label className="flex items-center gap-3 self-end rounded-xl border border-white/[.08] px-4 py-3 text-sm text-slate-400"><input type="checkbox" name="needsDatabaseFix" value="1" className="size-4 accent-fuchsia-300" /><span>Dette trenger trolig endringer i database</span></label>
    </div>
    <button disabled={saving} className={`${primaryButton} mt-5`}>{saving ? "Sender …" : "Send til utvikler"}</button>
  </form>;
}

function FeedbackList({ title, detail, entries, accessToken, run, openAttachment, own = false, canManage = false }: { title: string; detail: string; entries: FeedbackEntry[]; accessToken: string; run: RunAction; openAttachment: (entry: FeedbackEntry) => Promise<void>; own?: boolean; canManage?: boolean }) {
  return <div className={`${cardClass} mt-5`}><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-slate-500">{detail}</p><h2 className="mt-1 text-xl font-semibold">{title}</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{entries.length}</span></div>{entries.length === 0 ? <EmptyState>Ingen åpne tilbakemeldinger i denne listen.</EmptyState> : <div className="mt-5 grid gap-3">{entries.map((entry) => <FeedbackCard key={entry.id} entry={entry} accessToken={accessToken} run={run} openAttachment={openAttachment} own={own} canManage={canManage} />)}</div>}</div>;
}

function FeedbackCard({ entry, accessToken, run, openAttachment, own, canManage }: { entry: FeedbackEntry; accessToken: string; run: RunAction; openAttachment: (entry: FeedbackEntry) => Promise<void>; own: boolean; canManage: boolean }) {
  const [saving, setSaving] = useState(false);
  const statuses = entry.type === "bug"
    ? (["in_progress", "fixed", "rejected"] as FeedbackStatus[])
    : (["on_hold", "approved", "in_progress", "added", "rejected"] as FeedbackStatus[]);
  return <article className="rounded-xl border border-white/[.08] bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-600">#{entry.id}</span><span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{entry.type === "bug" ? "Bug" : "Feature"}</span><h3 className="font-medium text-slate-200">{entry.title}</h3><Status status={entry.status} /></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{entry.description}</p><div className="mt-3 flex flex-wrap gap-2">{entry.hasAttachment && <button type="button" className={smallButton} onClick={() => void openAttachment(entry)}>Åpne vedlagt bilde</button>}{entry.needsDatabaseFix && <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200">Trenger databaseendring</span>}</div></div><div className="min-w-[180px] text-sm text-slate-500"><p>{entry.requesterName}</p><p className="mt-1">Wannabe ID: {entry.wannabeId ?? "–"}</p><p className="mt-1">{formatDate(entry.createdAt)}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2">{own && entry.status === "pending" && <button type="button" disabled={saving} className={dangerButton} onClick={async () => { if (!await confirmAction({ title: "Slett tilbakemelding?", message: "Den ventende tilbakemeldingen slettes permanent.", confirmLabel: "Slett", danger: true })) return; setSaving(true); void run(() => deleteFeedback(accessToken, entry.id), "Tilbakemeldingen er slettet.").catch(() => undefined).finally(() => setSaving(false)); }}>Slett</button>}{canManage && statuses.map((status) => <button key={status} type="button" disabled={saving} className={statusButton(status)} onClick={() => { setSaving(true); void run(() => updateFeedbackStatus(accessToken, entry.id, status), "Tilbakemeldingsstatusen er oppdatert.").catch(() => undefined).finally(() => setSaving(false)); }}>{statusLabel(status)}</button>)}</div>
  </article>;
}

function Select({ label, options, onChange, ...props }: { label: string; name: string; options: Array<{ value: string; label: string }>; value?: string; onChange?: (value: string) => void }) { return <label><Label>{label}</Label><select {...props} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className={selectClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Field({ label, ...props }: { label: string; name: string; minLength?: number; maxLength?: number; required?: boolean }) { return <label><Label>{label}</Label><input {...props} className={inputClass} /></label>; }
function Label({ children }: { children: string }) { return <span className="mb-2 block text-sm text-slate-400">{children}</span>; }
function Status({ status }: { status: FeedbackStatus }) { const classes = ["fixed", "added"].includes(status) ? "bg-emerald-300/10 text-emerald-200" : status === "rejected" ? "bg-rose-300/10 text-rose-200" : status === "in_progress" ? "bg-amber-300/10 text-amber-200" : ["approved", "on_hold"].includes(status) ? "bg-cyan-300/10 text-cyan-200" : "bg-slate-300/10 text-slate-300"; return <span className={`rounded-full px-2.5 py-1 text-xs ${classes}`}>{statusLabel(status)}</span>; }
function Banner({ tone, children }: { tone: "success" | "error"; children: string }) { return <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>{children}</div>; }
function EmptyState({ children }: { children: string }) { return <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-600">{children}</p>; }
function WorkspaceState({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) { return <section className="grid flex-1 place-items-center py-16"><div className="text-center"><p className={error ? "text-rose-300" : "text-fuchsia-300"}>{error ? "Feil" : "Vent litt"}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-slate-500">{detail}</p></div></section>; }
function statusLabel(status: FeedbackStatus) { return { pending: "Innmeldt", on_hold: "Venter", approved: "Godkjent", in_progress: "Påbegynt", fixed: "Fikset", added: "Implementert", rejected: "Avslått" }[status]; }
function statusButton(status: FeedbackStatus) { const tone = status === "rejected" ? "border-rose-300/20 text-rose-200 hover:bg-rose-300/10" : ["fixed", "added"].includes(status) ? "border-emerald-300/20 text-emerald-200 hover:bg-emerald-300/10" : status === "in_progress" ? "border-amber-300/20 text-amber-200 hover:bg-amber-300/10" : "border-cyan-300/20 text-cyan-200 hover:bg-cyan-300/10"; return `rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${tone}`; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }); }
function messageFrom(reason: unknown) { return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres."; }

type RunAction = (action: () => Promise<unknown>, message: string) => Promise<void>;
const cardClass = "rounded-2xl border border-white/10 bg-white/[.025] p-5";
const inputClass = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-fuchsia-300/60";
const selectClass = "w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2.5 outline-none focus:border-fuchsia-300/60";
const textareaClass = `${inputClass} min-h-32`;
const fileClass = "block w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-300 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950";
const primaryButton = "rounded-xl bg-fuchsia-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";
const smallButton = "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-fuchsia-200 hover:bg-white/5";
const dangerButton = "rounded-lg border border-rose-300/20 px-3 py-2 text-sm text-rose-200 hover:bg-rose-300/10 disabled:opacity-50";
