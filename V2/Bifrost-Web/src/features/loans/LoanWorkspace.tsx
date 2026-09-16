import type { CrewProfile, EquipmentLoanListItem, EquipmentLoanListResponse, EquipmentLoanReturnResponse, PrivateEquipmentNotice } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import { getEquipmentLoans, getPrivateEquipmentNotices, issueEquipmentLoans, lookupCrewProfile, returnEquipmentLoan } from "../../api/client";

interface LoanLine {
  key: number;
  barcode: string;
  quantity: number;
  privateEquipmentConfirmed: boolean;
}

export function LoanWorkspace({ accessToken }: { accessToken: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EquipmentLoanListResponse | null>(null);
  const [lines, setLines] = useState<LoanLine[]>([{ key: 1, barcode: "", quantity: 1, privateEquipmentConfirmed: false }]);
  const [privateEquipmentNotices, setPrivateEquipmentNotices] = useState<PrivateEquipmentNotice[]>([]);
  const [privateEquipmentError, setPrivateEquipmentError] = useState<string | null>(null);
  const [wannabeQuery, setWannabeQuery] = useState("");
  const [crewProfile, setCrewProfile] = useState<CrewProfile | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EquipmentLoanListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void getEquipmentLoans(accessToken, { page, search: search.trim() || undefined })
        .then((result) => { if (active) { setData(result); setError(null); } })
        .catch((reason) => { if (active) setError(messageFrom(reason)); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [accessToken, page, search, refresh]);

  useEffect(() => {
    let active = true;
    void getPrivateEquipmentNotices(accessToken)
      .then((result) => { if (active) { setPrivateEquipmentNotices(result); setPrivateEquipmentError(null); } })
      .catch((reason) => { if (active) setPrivateEquipmentError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken]);

  const updateLine = (key: number, patch: Partial<LoanLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));

  return (
    <section className="py-10">
      <div className="mb-8"><p className="text-sm text-emerald-300">Utlevering og retur</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Utstyrslån</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Registrer flere strekkoder i samme transaksjon. Hvis én linje er ugyldig eller mangler beholdning, blir ingen av linjene utlevert.</p></div>

      <form className="mb-6 rounded-2xl border border-white/10 bg-white/[.025] p-5" onSubmit={(event) => {
        event.preventDefault();
        const fallbackWannabeId = Number(wannabeQuery);
        if (!crewProfile && (!Number.isInteger(fallbackWannabeId) || fallbackWannabeId <= 0)) {
          setError("Slå opp badge-scan først, eller skriv inn en gyldig Wannabe-ID.");
          return;
        }
        const unconfirmedLine = lines.find((line) => privateEquipmentNoticeFor(privateEquipmentNotices, line.barcode) && !line.privateEquipmentConfirmed);
        if (unconfirmedLine) {
          setError(privateEquipmentNoticeFor(privateEquipmentNotices, unconfirmedLine.barcode)?.issueMessage ?? "Privat utstyr må bekreftes før utlån.");
          return;
        }
        setSaving(true); setError(null); setNotice(null); setWarning(null);
        void issueEquipmentLoans(accessToken, {
          wannabeId: crewProfile?.id ?? fallbackWannabeId,
          lines: lines.map(({ barcode, quantity, privateEquipmentConfirmed }) => ({ barcode, quantity, privateEquipmentConfirmed })),
        }).then((result) => {
          setLines([{ key: 1, barcode: "", quantity: 1, privateEquipmentConfirmed: false }]);
          setWannabeQuery("");
          setCrewProfile(null);
          setLookupError(null);
          setNotice(`${result.loanIds.length} lån ble registrert.`);
          setRefresh((value) => value + 1);
        }).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
      }}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><h2 className="text-lg font-medium">Lån ut utstyr</h2><p className="mt-1 text-sm text-slate-500">Slå opp med Wannabe-ID eller badge-scan. Numerisk Wannabe-ID kan brukes direkte hvis crew-API-et er utilgjengelig.</p></div><div className="w-full lg:w-[28rem]"><label><span className="mb-2 block text-sm text-slate-400">Wannabe-ID / badge-scan</span><div className="flex gap-2"><input required value={wannabeQuery} onChange={(event) => { setWannabeQuery(event.target.value); setCrewProfile(null); setLookupError(null); }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /><button type="button" disabled={lookupBusy || !wannabeQuery.trim()} className="rounded-xl border border-emerald-300/30 px-4 py-2.5 text-sm text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40" onClick={() => {
          const query = wannabeQuery.trim();
          if (!query) return;
          setLookupBusy(true); setLookupError(null); setCrewProfile(null);
          void lookupCrewProfile(accessToken, query).then((profile) => { setCrewProfile(profile); setWannabeQuery(String(profile.id)); }).catch((reason) => setLookupError(messageFrom(reason))).finally(() => setLookupBusy(false));
        }}>{lookupBusy ? "Søker …" : "Slå opp"}</button></div></label>{crewProfile && <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] px-4 py-3"><p className="font-medium text-emerald-100">{crewProfile.displayName}</p><p className="mt-1 text-xs text-emerald-200/60">Wannabe {crewProfile.id}{crewProfile.crewName ? ` · ${crewProfile.crewName}` : ""}{crewProfile.role ? ` · ${crewProfile.role}` : ""}</p></div>}{lookupError && <p className="mt-2 text-sm text-rose-300">{lookupError}</p>}</div></div>
        <div className="mt-5 grid gap-3">{lines.map((line, index) => {
          const privateNotice = privateEquipmentNoticeFor(privateEquipmentNotices, line.barcode);
          return <div key={line.key} className={`rounded-xl border p-4 ${privateNotice ? "border-amber-300/30 bg-amber-300/[.05]" : "border-white/[.07] bg-black/10"}`}><div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"><label><span className="mb-2 block text-sm text-slate-400">Strekkode / serienummer {index + 1}</span><input required value={line.barcode} onChange={(event) => updateLine(line.key, { barcode: event.target.value, privateEquipmentConfirmed: false })} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label><label><span className="mb-2 block text-sm text-slate-400">Antall</span><input type="number" min="1" required value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-100" onClick={() => setLines((current) => current.length === 1 ? [{ ...current[0]!, barcode: "", quantity: 1, privateEquipmentConfirmed: false }] : current.filter((candidate) => candidate.key !== line.key))}>{lines.length === 1 ? "Tøm" : "Fjern"}</button></div>{privateNotice && <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-amber-300/10 px-3 py-3 text-sm text-amber-100"><input type="checkbox" className="mt-1 accent-amber-300" checked={line.privateEquipmentConfirmed} onChange={(event) => updateLine(line.key, { privateEquipmentConfirmed: event.target.checked })} /><span><strong>Privat utstyr:</strong> {privateNotice.issueMessage}</span></label>}</div>;
        })}</div>
        {privateEquipmentError && <p className="mt-3 text-sm text-amber-300">{privateEquipmentError} API-et kontrollerer fortsatt private prefiks ved registrering.</p>}
        <div className="mt-4 flex flex-wrap justify-between gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-emerald-300/40" onClick={() => setLines((current) => [...current, { key: Math.max(...current.map((line) => line.key)) + 1, barcode: "", quantity: 1, privateEquipmentConfirmed: false }])}>Legg til linje</button><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50">{saving ? "Registrerer …" : "Registrer lån"}</button></div>
      </form>

      <div className="mb-4 flex justify-end"><label className="block w-full sm:w-80"><span className="sr-only">Søk i aktive lån</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Søk person, utstyr eller strekkode …" className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-emerald-300/60" /></label></div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        {notice && <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
        {warning && <div className="border-b border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">{warning}</div>}
        {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Utstyr</th><th className="px-5 py-4">Låntaker</th><th className="px-5 py-4">Antall</th><th className="px-5 py-4">Utlevert</th><th className="px-5 py-4">Forespørsel</th><th className="px-5 py-4"><span className="sr-only">Handling</span></th></tr></thead><tbody className="divide-y divide-white/[.06]">
          {!data && !error && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Henter aktive lån …</td></tr>}
          {data?.items.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Ingen aktive lån matcher søket.</td></tr>}
          {data?.items.map((loan) => <tr key={loan.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{loan.equipmentName}</p><p className="mt-1 font-mono text-xs text-slate-600">{loan.serialNumber}</p></td><td className="px-5 py-4"><p className="text-slate-300">{loan.borrowerName ?? `Wannabe ${loan.wannabeId}`}</p><p className="mt-1 text-xs text-slate-600">ID {loan.wannabeId}</p></td><td className="px-5 py-4 text-slate-200">{loan.quantity}</td><td className="px-5 py-4 text-slate-400">{formatDate(loan.issuedAt)}</td><td className="px-5 py-4 text-slate-400">{loan.requestId ?? "–"}</td><td className="px-5 py-4 text-right"><button className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10" onClick={() => { setNotice(null); setSelectedLoan(loan); }}>Returner</button></td></tr>)}
        </tbody></table></div>
        {data && data.pagination.pageCount > 1 && <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-sm text-slate-500"><span>{data.pagination.total} aktive lån</span><div className="flex items-center gap-2"><button disabled={page <= 1} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" onClick={() => setPage((value) => value - 1)}>Forrige</button><span className="px-2">{page} / {data.pagination.pageCount}</span><button disabled={page >= data.pagination.pageCount} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" onClick={() => setPage((value) => value + 1)}>Neste</button></div></div>}
      </div>
      {selectedLoan && <ReturnLoanPanel accessToken={accessToken} loan={selectedLoan} onClose={() => setSelectedLoan(null)} onReturned={(result) => { setSelectedLoan(null); setNotice(result.remainingQuantity === 0 ? "Lånet ble returnert." : `${result.returnedQuantity} ble returnert; ${result.remainingQuantity} gjenstår.`); setWarning(result.privateEquipmentNotice?.returnMessage ?? null); setRefresh((value) => value + 1); }} />}
    </section>
  );
}

function ReturnLoanPanel({ accessToken, loan, onClose, onReturned }: { accessToken: string; loan: EquipmentLoanListItem; onClose: () => void; onReturned: (result: EquipmentLoanReturnResponse) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="return-loan-title"><form className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1927] p-6 shadow-2xl" onSubmit={(event) => {
    event.preventDefault();
    const quantity = Number(new FormData(event.currentTarget).get("quantity"));
    setSaving(true); setError(null);
    void returnEquipmentLoan(accessToken, loan.id, quantity).then(onReturned).catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
  }}><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-emerald-300">Lån #{loan.id}</p><h2 id="return-loan-title" className="mt-1 text-2xl font-semibold">Returner {loan.equipmentName}</h2><p className="mt-2 text-sm text-slate-500">{loan.borrowerName ?? `Wannabe ${loan.wannabeId}`} har {loan.quantity} utlånt.</p></div><button type="button" className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div><div className="mt-6"><Field label="Antall som returneres" name="quantity" type="number" min="1" max={String(loan.quantity)} defaultValue={String(loan.quantity)} required /></div>{error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm" onClick={onClose}>Avbryt</button><button disabled={saving} className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Returnerer …" : "Bekreft retur"}</button></div></form></div>;
}

function Field({ label, ...props }: { label: string; name: string; type?: string; min?: string; max?: string; defaultValue?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/60" /></label>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

function privateEquipmentNoticeFor(rules: PrivateEquipmentNotice[], barcode: string): PrivateEquipmentNotice | null {
  const normalized = barcode.trim().toUpperCase();
  return rules.find((rule) => normalized.startsWith(rule.prefix.toUpperCase())) ?? null;
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.";
}
