import type { EquipmentRequest, EquipmentRequestWorkspaceResponse, PrivateEquipmentNotice } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import {
  approveEquipmentRequest,
  createEquipmentRequest,
  deleteEquipmentRequest,
  getEquipmentRequestWorkspace,
  getPrivateEquipmentNotices,
  updateEquipmentRequestStatus,
} from "../../api/client";
import { confirmAction } from "../../components/notifications";

interface SelectedItem {
  quantity: number;
  note: string;
}

interface ApprovalDecision {
  approvedQuantity: number;
  rejected: boolean;
  privateEquipmentConfirmed: boolean;
}

export function RequestWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<EquipmentRequestWorkspaceResponse | null>(null);
  const [privateNotices, setPrivateNotices] = useState<PrivateEquipmentNotice[]>([]);
  const [selected, setSelected] = useState<Record<number, SelectedItem>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const workspace = await getEquipmentRequestWorkspace(accessToken);
        if (!active) return;
        setData(workspace);
        setError(null);
        if (workspace.canManage) {
          const notices = await getPrivateEquipmentNotices(accessToken);
          if (active) setPrivateNotices(notices);
        } else {
          setPrivateNotices([]);
        }
      } catch (reason) {
        if (active) setError(messageFrom(reason));
      }
    };
    void load();
    return () => { active = false; };
  }, [accessToken, refresh]);

  const changed = (message: string) => { setNotice(message); setError(null); setRefresh((value) => value + 1); };
  const removeRequest = async (request: EquipmentRequest) => {
    if (!await confirmAction({ title: "Slett forespørsel?", message: `Forespørsel #${request.id} slettes permanent.`, confirmLabel: "Slett", danger: true })) return;
    setError(null); setNotice(null);
    void deleteEquipmentRequest(accessToken, request.id).then(() => changed("Forespørselen ble slettet.")).catch((reason) => setError(messageFrom(reason)));
  };

  const visibleEquipment = data?.selection.filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || `${item.name} ${item.serialNumber} ${item.locationName ?? ""}`.toLowerCase().includes(query);
  }) ?? [];

  return <section className="py-10">
    <div className="mb-8"><p className="text-sm text-sky-300">Behov, godkjenning og utlevering</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Utstyrsforespørsler</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Forespørsler bruker din innloggede Wannabe-ID. Godkjenning reserverer lager og oppretter aktive lån i én transaksjon.</p></div>
    {notice && <div className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
    {error && <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}

    {!data && !error && <div className="rounded-2xl border border-white/10 bg-white/[.025] px-5 py-14 text-center text-slate-500">Henter forespørsler …</div>}
    {data?.canCreate ? <form className="mb-8 rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
      event.preventDefault();
      const items = Object.entries(selected).map(([equipmentId, value]) => ({ equipmentId: Number(equipmentId), quantity: value.quantity, note: value.note || undefined }));
      if (items.length === 0) { setError("Velg minst ett utstyr i listen."); return; }
      setSaving(true); setError(null); setNotice(null);
      void createEquipmentRequest(accessToken, items).then((result) => { setSelected({}); changed(`Forespørsel #${result.id} ble sendt til logistikk.`); }).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
    }}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h2 className="text-lg font-medium">Ny forespørsel</h2><p className="mt-1 text-sm text-slate-500">Wannabe-ID: {data.currentWannabeId ?? "mangler på profilen"}</p></div><label className="w-full md:w-80"><span className="sr-only">Søk i utstyr</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Søk navn, serienummer eller lokasjon …" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-300/60" /></label></div>
      {!data.currentWannabeId && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Du mangler Wannabe-ID og kan ikke sende forespørselen før profilen er oppdatert.</p>}
      <div className="mt-5 max-h-[28rem] overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[860px] text-left text-sm"><thead className="sticky top-0 bg-[#0b1724] text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Velg</th><th className="px-4 py-3">Utstyr</th><th className="px-4 py-3">Lokasjon</th><th className="px-4 py-3">Tilgjengelig</th><th className="px-4 py-3">Antall</th><th className="px-4 py-3">Notat</th></tr></thead><tbody className="divide-y divide-white/[.06]">{visibleEquipment.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Ingen utstyr matcher søket.</td></tr>}{visibleEquipment.map((item) => {
        const requestable = item.quantity > 0 && item.status !== "maintenance";
        const value = selected[item.id];
        return <tr key={item.id} className="hover:bg-white/[.025]"><td className="px-4 py-3"><input type="checkbox" disabled={!requestable} checked={Boolean(value)} onChange={(event) => setSelected((current) => { const next = { ...current }; if (event.target.checked) next[item.id] = { quantity: 1, note: "" }; else delete next[item.id]; return next; })} className="accent-sky-300" /></td><td className="px-4 py-3"><p className="font-medium text-slate-200">{item.name}</p><p className="mt-1 font-mono text-xs text-slate-600">{item.serialNumber}</p></td><td className="px-4 py-3 text-slate-400">{item.locationName ?? "–"}</td><td className="px-4 py-3"><span className={requestable ? "text-emerald-300" : "text-rose-300"}>{requestable ? item.quantity : "Utilgjengelig"}</span></td><td className="px-4 py-3"><input type="number" min="1" max={Math.max(1, item.quantity)} disabled={!value} value={value?.quantity ?? 1} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { note: "" }), quantity: Number(event.target.value) } }))} className="w-24 rounded-lg border border-white/10 bg-black/20 px-3 py-2 disabled:opacity-30" /></td><td className="px-4 py-3"><input disabled={!value} value={value?.note ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { quantity: 1 }), note: event.target.value } }))} className="w-full min-w-48 rounded-lg border border-white/10 bg-black/20 px-3 py-2 disabled:opacity-30" /></td></tr>;
      })}</tbody></table></div>
      <div className="mt-4 flex justify-end"><button disabled={saving || !data.currentWannabeId} className="rounded-xl bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-40">{saving ? "Sender …" : "Send forespørsel"}</button></div>
    </form> : data && <div className="mb-8 rounded-2xl border border-white/10 bg-white/[.025] px-5 py-4 text-sm text-slate-400">Rollen din kan se forespørsler, men kan ikke opprette nye. Dette følger V1-regelen for logistikk, ledelse og sambandsansvarlig.</div>}

    {data && <RequestTable title="Mine forespørsler" requests={data.mine} onDelete={removeRequest} canManage={false} />}
    {data?.canManage && <div className="mt-8"><h2 className="mb-4 text-xl font-semibold">Innkommende forespørsler</h2><div className="grid gap-4">{data.incoming.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[.025] px-5 py-10 text-center text-sm text-slate-500">Ingen innkommende forespørsler.</div>}{data.incoming.map((request) => <ManagementCard key={request.id} accessToken={accessToken} request={request} privateNotices={privateNotices} onChanged={changed} onDelete={() => removeRequest(request)} />)}</div></div>}
  </section>;
}

function RequestTable({ title, requests, onDelete, canManage }: { title: string; requests: EquipmentRequest[]; onDelete: (request: EquipmentRequest) => void; canManage: boolean }) {
  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-medium">{title}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">ID</th><th className="px-5 py-4">Utstyr</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Avvik</th><th className="px-5 py-4">Opprettet</th><th className="px-5 py-4"><span className="sr-only">Handling</span></th></tr></thead><tbody className="divide-y divide-white/[.06]">{requests.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Ingen forespørsler.</td></tr>}{requests.map((request) => {
    const canDelete = canManage || ["pending", "rejected", "returned"].includes(request.status);
    return <tr key={request.id}><td className="px-5 py-4 font-mono text-slate-400">#{request.id}</td><td className="max-w-md px-5 py-4 text-slate-300">{request.itemsSummary || "–"}</td><td className="px-5 py-4"><StatusBadge status={request.status} /></td><td className="px-5 py-4 text-amber-200">{request.changeSummary ?? "–"}</td><td className="px-5 py-4 text-slate-500">{formatDate(request.createdAt)}</td><td className="px-5 py-4 text-right">{canDelete ? <button type="button" className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10" onClick={() => onDelete(request)}>Slett</button> : <span className="text-xs text-slate-600">Kan ikke slettes</span>}</td></tr>;
  })}</tbody></table></div></div>;
}

function ManagementCard({ accessToken, request, privateNotices, onChanged, onDelete }: { accessToken: string; request: EquipmentRequest; privateNotices: PrivateEquipmentNotice[]; onChanged: (message: string) => void; onDelete: () => void }) {
  const [decisions, setDecisions] = useState<Record<number, ApprovalDecision>>(() => Object.fromEntries(request.items.map((item) => [item.id, { approvedQuantity: item.approvedQuantity, rejected: item.itemStatus === "rejected", privateEquipmentConfirmed: false }])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDecisions(Object.fromEntries(request.items.map((item) => [item.id, { approvedQuantity: item.approvedQuantity, rejected: item.itemStatus === "rejected", privateEquipmentConfirmed: false }])));
  }, [request]);
  const mutate = (promise: Promise<void>, message: string) => { setBusy(true); setError(null); void promise.then(() => onChanged(message)).catch((reason) => setError(messageFrom(reason))).finally(() => setBusy(false)); };
  const approvalPayload = (approveAll: boolean) => request.items.map((item) => ({
    itemId: item.id,
    approvedQuantity: approveAll ? item.quantity : decisions[item.id]?.approvedQuantity ?? item.approvedQuantity,
    rejected: approveAll ? false : decisions[item.id]?.rejected ?? false,
    privateEquipmentConfirmed: decisions[item.id]?.privateEquipmentConfirmed ?? false,
  }));
  const approve = (approveAll: boolean) => {
    const payload = approvalPayload(approveAll);
    const unconfirmed = request.items.find((item) => {
      const privateNotice = noticeFor(privateNotices, item.serialNumber);
      const decision = payload.find((candidate) => candidate.itemId === item.id);
      return privateNotice && (decision?.approvedQuantity ?? 0) > item.approvedQuantity && !decision?.privateEquipmentConfirmed;
    });
    if (unconfirmed) { setError(noticeFor(privateNotices, unconfirmed.serialNumber)?.issueMessage ?? "Privat utstyr må bekreftes."); return; }
    mutate(approveEquipmentRequest(accessToken, request.id, { approveAll, decisions: payload }), approveAll ? "Alle mulige linjer ble godkjent og registrert som lån." : "Forespørselen ble behandlet.");
  };

  return <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-medium">Forespørsel #{request.id}</h3><StatusBadge status={request.status} /></div><p className="mt-2 text-sm text-slate-400">{request.requesterName} · Wannabe {request.wannabeId} · {formatDate(request.createdAt)}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300" onClick={() => mutate(updateEquipmentRequestStatus(accessToken, request.id, "pending"), "Status ble satt til venter.")}>Venter</button><button disabled={busy} type="button" className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300" onClick={() => mutate(updateEquipmentRequestStatus(accessToken, request.id, "rejected"), "Forespørselen ble avvist.")}>Avvis</button><button disabled={busy} type="button" className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200" onClick={() => mutate(updateEquipmentRequestStatus(accessToken, request.id, "fulfilled"), "Forespørselen ble markert som utlevert.")}>Utlevert</button><button disabled={busy} type="button" className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300" onClick={onDelete}>Slett</button></div></div>
    <div className="mt-5 grid gap-3">{request.items.map((item) => {
      const decision = decisions[item.id]!;
      const privateNotice = noticeFor(privateNotices, item.serialNumber);
      return <div key={item.id} className={`rounded-xl border p-4 ${privateNotice ? "border-amber-300/25 bg-amber-300/[.04]" : "border-white/[.07] bg-black/10"}`}><div className="grid gap-4 md:grid-cols-[1fr_130px_110px] md:items-end"><div><p className="font-medium text-slate-200">{item.equipmentName}</p><p className="mt-1 text-xs text-slate-500">{item.serialNumber} · forespurt {item.quantity} · godkjent {item.approvedQuantity} · lager {item.equipmentQuantity}</p>{item.note && <p className="mt-2 text-sm text-slate-400">Notat: {item.note}</p>}</div><label><span className="mb-2 block text-xs text-slate-500">Godkjent antall</span><input type="number" min="0" max={item.quantity} value={decision.approvedQuantity} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...current[item.id]!, approvedQuantity: Number(event.target.value), rejected: false } }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label><label className="flex items-center gap-2 pb-2 text-sm text-slate-400"><input type="checkbox" checked={decision.rejected} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...current[item.id]!, rejected: event.target.checked, approvedQuantity: event.target.checked ? 0 : current[item.id]!.approvedQuantity } }))} className="accent-rose-300" />Avvis linje</label></div>{privateNotice && <label className="mt-3 flex items-start gap-3 rounded-lg bg-amber-300/10 px-3 py-3 text-sm text-amber-100"><input type="checkbox" checked={decision.privateEquipmentConfirmed} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...current[item.id]!, privateEquipmentConfirmed: event.target.checked } }))} className="mt-1 accent-amber-300" /><span><strong>Privat utstyr:</strong> {privateNotice.issueMessage}</span></label>}</div>;
    })}</div>
    {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
    <div className="mt-4 flex flex-wrap justify-end gap-3"><button disabled={busy} type="button" className="rounded-xl border border-sky-300/30 px-4 py-2.5 text-sm text-sky-200 hover:bg-sky-300/10 disabled:opacity-40" onClick={() => approve(false)}>Behandle linjer</button><button disabled={busy} type="button" className="rounded-xl bg-sky-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-40" onClick={() => approve(true)}>Godkjenn alle</button></div>
  </article>;
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { pending: "Venter", approved: "Godkjent", rejected: "Avvist", partial: "Delvis godkjent", fulfilled: "Utlevert", returned: "Returnert" };
  const color = status === "approved" || status === "fulfilled" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : status === "rejected" ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : status === "partial" ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300";
  return <span className={`rounded-full border px-2.5 py-1 text-xs ${color}`}>{labels[status] ?? status}</span>;
}

function noticeFor(rules: PrivateEquipmentNotice[], barcode: string): PrivateEquipmentNotice | null {
  const normalized = barcode.trim().toUpperCase();
  return rules.find((rule) => normalized.startsWith(rule.prefix.toUpperCase())) ?? null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.";
}
