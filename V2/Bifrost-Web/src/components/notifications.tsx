import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
};

export type ConfirmationInput = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Toast = Required<Pick<ToastInput, "message" | "tone">> & Pick<ToastInput, "title"> & { id: number };
type PendingConfirmation = ConfirmationInput & { resolve: (confirmed: boolean) => void };

const TOAST_EVENT = "bifrost:toast";
const CONFIRM_EVENT = "bifrost:confirm";
let nextToastId = 1;

export function notify(input: string | ToastInput, tone: ToastTone = "info") {
  if (typeof window === "undefined") return;
  const detail = typeof input === "string" ? { message: input, tone } : input;
  window.dispatchEvent(new CustomEvent<ToastInput>(TOAST_EVENT, { detail }));
}

export function confirmAction(input: ConfirmationInput): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<PendingConfirmation>(CONFIRM_EVENT, { detail: { ...input, resolve } }));
  });
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const confirmationQueue = useRef<PendingConfirmation[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const input = (event as CustomEvent<ToastInput>).detail;
      const id = nextToastId++;
      const toast: Toast = { id, message: input.message, title: input.title, tone: input.tone ?? "info" };
      setToasts((current) => [...current.slice(-3), toast]);
      const duration = input.duration ?? (toast.tone === "error" ? 7_000 : 4_500);
      if (duration > 0) timers.current.set(id, window.setTimeout(() => dismissToast(id), duration));
    };
    const onConfirm = (event: Event) => {
      const pending = (event as CustomEvent<PendingConfirmation>).detail;
      setConfirmation((current) => {
        if (!current) return pending;
        confirmationQueue.current.push(pending);
        return current;
      });
    };
    const nativeAlert = window.alert;
    window.alert = (message?: unknown) => notify({ title: "Melding", message: String(message ?? ""), tone: "info" });
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    const activeTimers = timers.current;
    return () => {
      window.alert = nativeAlert;
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, [dismissToast]);

  useEffect(() => {
    if (!confirmation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishConfirmation(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmation]);

  const finishConfirmation = (confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return confirmationQueue.current.shift() ?? null;
    });
  };

  return <>
    {children}
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onClose={() => dismissToast(toast.id)} />)}
    </div>
    {confirmation && <ConfirmationDialog confirmation={confirmation} onResult={finishConfirmation} />}
  </>;
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const presentation = toastPresentation[toast.tone];
  return <section role={toast.tone === "error" ? "alert" : "status"} className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a28]/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
    <div className={`h-0.5 w-full ${presentation.bar}`} />
    <div className="flex gap-3 p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${presentation.icon}`}>{presentation.symbol}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{toast.title ?? presentation.title}</p>
        <p className="mt-1 break-words text-sm leading-5 text-slate-400">{toast.message}</p>
      </div>
      <button type="button" aria-label="Lukk varsel" className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-white/5 hover:text-slate-200" onClick={onClose}>×</button>
    </div>
  </section>;
}

function ConfirmationDialog({ confirmation, onResult }: { confirmation: PendingConfirmation; onResult: (confirmed: boolean) => void }) {
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onResult(false); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1a28] p-6 shadow-2xl shadow-black/60">
      <div className={`grid size-11 place-items-center rounded-2xl ${confirmation.danger ? "bg-rose-400/10 text-rose-300" : "bg-amber-300/10 text-amber-200"}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></svg>
      </div>
      <h2 id="confirmation-title" className="mt-5 text-xl font-semibold text-slate-100">{confirmation.title}</h2>
      <p id="confirmation-message" className="mt-2 leading-6 text-slate-400">{confirmation.message}</p>
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" autoFocus className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5" onClick={() => onResult(false)}>{confirmation.cancelLabel ?? "Avbryt"}</button>
        <button type="button" className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${confirmation.danger ? "bg-rose-400 text-slate-950 hover:bg-rose-300" : "bg-emerald-300 text-slate-950 hover:bg-emerald-200"}`} onClick={() => onResult(true)}>{confirmation.confirmLabel ?? "Bekreft"}</button>
      </div>
    </section>
  </div>;
}

const toastPresentation: Record<ToastTone, { title: string; symbol: string; bar: string; icon: string }> = {
  success: { title: "Fullført", symbol: "✓", bar: "bg-emerald-300", icon: "bg-emerald-300/10 text-emerald-200" },
  error: { title: "Noe gikk galt", symbol: "!", bar: "bg-rose-400", icon: "bg-rose-400/10 text-rose-300" },
  warning: { title: "Viktig", symbol: "!", bar: "bg-amber-300", icon: "bg-amber-300/10 text-amber-200" },
  info: { title: "Informasjon", symbol: "i", bar: "bg-sky-300", icon: "bg-sky-300/10 text-sky-200" },
};
