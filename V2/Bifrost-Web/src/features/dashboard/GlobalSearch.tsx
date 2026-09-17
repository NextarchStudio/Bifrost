import type { GlobalSearchResponse } from "@bifrost/contracts";
import { useState, type ReactNode } from "react";
import { globalSearch } from "../../api/client";

export function GlobalSearch({ accessToken }: { accessToken: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setLoading(true); setError(null);
    try { setResults(await globalSearch(accessToken, term)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Søket feilet."); setResults(null); }
    finally { setLoading(false); }
  };
  const open = Boolean(results || error);
  return <div className="relative"><form className="flex rounded-lg border border-white/10 bg-black/10" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label className="sr-only" htmlFor="global-search">Globalt søk</label><input id="global-search" type="search" value={term} maxLength={100} onChange={(event) => setTerm(event.target.value)} placeholder="Søk utstyr / Wannabe-ID" className="w-48 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:w-64" /><button disabled={loading || !term.trim()} className="border-l border-white/10 px-3 text-sm text-slate-400 hover:text-slate-100 disabled:opacity-40">{loading ? "…" : "Søk"}</button></form>{open && <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(36rem,calc(100vw-3rem))] overflow-auto rounded-2xl border border-white/10 bg-[#0b1724] p-4 shadow-2xl shadow-black/60"><div className="flex items-center justify-between"><h2 className="font-semibold">Søkeresultater</h2><button className="text-xs text-slate-500 hover:text-slate-200" onClick={() => { setResults(null); setError(null); }}>Lukk</button></div>{error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : results && <><ResultSection title="Utstyr" count={results.equipment.length}>{results.equipment.map((item) => <article key={item.id} className="rounded-lg border border-white/[.07] p-3"><div className="flex justify-between gap-3"><p className="font-medium text-slate-200">{item.name}</p><span className="text-xs text-slate-600">#{item.id}</span></div><p className="mt-1 text-xs text-slate-500">{item.serialNumber} · {locationLabel(item)}</p></article>)}</ResultSection><ResultSection title="Utlån" count={results.loans.length}>{results.loans.map((loan) => <article key={loan.id} className="flex justify-between gap-3 rounded-lg border border-white/[.07] p-3 text-sm"><div><p className="text-slate-300">Wannabe {loan.wannabeId}</p><p className="mt-1 text-xs text-slate-600">Utstyr #{loan.equipmentId} · {dateLabel(loan.issuedAt)}</p></div><span className="text-xs text-amber-300">{loan.status}</span></article>)}</ResultSection>{results.equipment.length === 0 && results.loans.length === 0 && <p className="mt-4 text-sm text-slate-500">Ingen treff.</p>}</>}</div>}</div>;
}

function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return <section className="mt-4"><div className="mb-2 flex justify-between text-xs uppercase tracking-wider text-slate-500"><h3>{title}</h3><span>{count}</span></div><div className="grid gap-2">{children}</div></section>;
}

function locationLabel(item: GlobalSearchResponse["equipment"][number]) { return [item.locationName, item.palletName, item.slotNumber ? `plass ${item.slotNumber}` : null].filter(Boolean).join(" · ") || "Ingen lagerplass"; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
