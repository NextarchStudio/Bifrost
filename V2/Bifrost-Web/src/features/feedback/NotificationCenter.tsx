import type { FeedbackNotificationResponse } from "@bifrost/contracts";
import { useEffect, useRef, useState } from "react";
import { getFeedbackNotifications, markFeedbackNotificationsRead } from "../../api/client";

export function NotificationCenter({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<FeedbackNotificationResponse>({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { const next = await getFeedbackNotifications(accessToken); if (active) setData(next); } catch { /* Header notifications must not break the workspace. */ } };
    void refresh(); const timer = window.setInterval(() => void refresh(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accessToken]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("click", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", escape); };
  }, []);
  const toggle = () => {
    const next = !open; setOpen(next);
    if (next && data.unreadCount > 0) {
      setData((current) => ({ ...current, unreadCount: 0, items: current.items.map((item) => ({ ...item, isRead: true })) }));
      void markFeedbackNotificationsRead(accessToken).catch(() => undefined);
    }
  };
  return <div ref={root} className="relative"><button type="button" aria-label="Vis varsler" aria-expanded={open} onClick={toggle} className="relative grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5"><span aria-hidden="true">🔔</span>{data.unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-rose-400 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{data.unreadCount}</span>}</button>{open && <div className="absolute right-0 z-50 mt-3 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-white/10 bg-[#0b1724] p-4 shadow-2xl shadow-black/50"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Siste oppdateringer</h2><span className="text-xs text-slate-600">{data.items.length}</span></div>{data.items.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-slate-600">Ingen nye oppdateringer enda.</p> : <div className="grid gap-2">{data.items.map((item) => <article key={item.id} className="rounded-xl border border-white/[.08] bg-black/10 p-3"><div className="flex justify-between gap-3 text-xs"><span className={item.status === "added" ? "text-emerald-300" : "text-cyan-300"}>{item.statusLabel}</span><time className="text-slate-600">{formatDate(item.createdAt)}</time></div><h3 className="mt-2 text-sm font-medium text-slate-200">{item.title}</h3><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.message}</p></article>)}</div>}</div>}</div>;
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }); }
