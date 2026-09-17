import { hasBifrostAccess, isBifrostDenied, type CurrentUser } from "@bifrost/contracts";
import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { completeLoginSession, getAuthConfig, getCurrentUser, loginLocal, logoutLocal } from "./api/client";
import { beginSignIn, completeSignIn, getSignedInUser, signOut } from "./auth/oidc";
import { NotificationsProvider } from "./components/notifications";
import { EquipmentWorkspace } from "./features/equipment/EquipmentWorkspace";
import { LocationWorkspace } from "./features/locations/LocationWorkspace";
import { WarehouseWorkspace } from "./features/warehouse/WarehouseWorkspace";
import { LoanWorkspace } from "./features/loans/LoanWorkspace";
import { PrivateEquipmentWorkspace } from "./features/private-equipment/PrivateEquipmentWorkspace";
import { RequestWorkspace } from "./features/requests/RequestWorkspace";
import { VehicleWorkspace } from "./features/vehicles/VehicleWorkspace";
import { ProfileWorkspace } from "./features/profiles/ProfileWorkspace";
import { TransportWorkspace } from "./features/transport/TransportWorkspace";
import { CommsWorkspace } from "./features/comms/CommsWorkspace";
import { ShopWorkspace } from "./features/shop/ShopWorkspace";
import { TaskWorkspace } from "./features/tasks/TaskWorkspace";
import { FeedbackWorkspace } from "./features/feedback/FeedbackWorkspace";
import { NotificationCenter } from "./features/feedback/NotificationCenter";
import { AdminWorkspace } from "./features/admin/AdminWorkspace";
import { DashboardWorkspace } from "./features/dashboard/DashboardWorkspace";
import { GlobalSearch } from "./features/dashboard/GlobalSearch";
import { BarcodeWorkspace } from "./features/barcodes/BarcodeWorkspace";
import "./styles.css";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous"; localLoginEnabled: boolean }
  | { status: "authenticated"; user: CurrentUser; accessToken: string }
  | { status: "error"; message: string };

function App() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [workspace, setWorkspace] = useState<Workspace>(workspaceFromPath());

  useEffect(() => {
    const load = async () => {
      try {
        const isCallback = window.location.pathname === "/auth/callback";
        if (!isCallback) {
          const localToken = window.sessionStorage.getItem(LOCAL_TOKEN_STORAGE_KEY);
          if (localToken) {
            try {
              const user = await getCurrentUser(localToken);
              setSession({ status: "authenticated", user, accessToken: localToken });
              return;
            } catch {
              window.sessionStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
            }
          }
        }

        const oidcUser = isCallback ? await completeSignIn() : await getSignedInUser();
        if (isCallback) window.history.replaceState({}, "", "/dashboard");
        if (!oidcUser || oidcUser.expired) {
          const config = await getAuthConfig();
          return setSession({ status: "anonymous", localLoginEnabled: Boolean(config.localLoginEnabled) });
        }
        const user = isCallback
          ? await completeLoginSession(oidcUser.access_token)
          : await getCurrentUser(oidcUser.access_token);
        setSession({ status: "authenticated", user, accessToken: oidcUser.access_token });
      } catch (error) {
        setSession({ status: "error", message: error instanceof Error ? error.message : "Innlogging feilet." });
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const handleNavigation = () => setWorkspace(workspaceFromPath());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  const navigate = (nextWorkspace: Workspace) => {
    setWorkspace(nextWorkspace);
    window.history.pushState({}, "", `/${nextWorkspace}`);
  };

  const handleLocalLogin = async (email: string, password: string) => {
    const result = await loginLocal({ email, password });
    window.sessionStorage.setItem(LOCAL_TOKEN_STORAGE_KEY, result.accessToken);
    window.history.replaceState({}, "", "/dashboard");
    setWorkspace("dashboard");
    setSession({ status: "authenticated", user: result.user, accessToken: result.accessToken });
  };

  const handleSignOut = async () => {
    if (session.status !== "authenticated") return;
    if (session.accessToken.startsWith("bfl_")) {
      try { await logoutLocal(session.accessToken); } finally {
        window.sessionStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
        window.location.assign("/");
      }
      return;
    }
    await signOut();
  };

  const hasLogisticsAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "logistics");
  const hasVehicleAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "vehicle");
  const hasTransportAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "transport");
  const hasCommsAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "comms");
  const hasShopAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "shop");
  const hasFeedbackAccess = session.status === "authenticated" && !isBifrostDenied(session.user.roles, "feedback");
  const hasAdminAccess = session.status === "authenticated" && hasBifrostAccess(session.user.roles, "admin");

  if (session.status === "authenticated") {
    return <AuthenticatedShell
      session={session}
      workspace={workspace}
      navigate={navigate}
      onSignOut={handleSignOut}
      access={{
        logistics: hasLogisticsAccess,
        vehicle: hasVehicleAccess,
        transport: hasTransportAccess,
        comms: hasCommsAccess,
        shop: hasShopAccess,
        feedback: hasFeedbackAccess,
        admin: hasAdminAccess,
      }}
    />;
  }

  return <PublicShell session={session} onLocalLogin={handleLocalLogin} />;
}

type AuthenticatedSession = Extract<SessionState, { status: "authenticated" }>;
type WorkspaceAccess = {
  logistics: boolean;
  vehicle: boolean;
  transport: boolean;
  comms: boolean;
  shop: boolean;
  feedback: boolean;
  admin: boolean;
};

function AuthenticatedShell({ session, workspace, navigate, onSignOut, access }: {
  session: AuthenticatedSession;
  workspace: Workspace;
  navigate: (workspace: Workspace) => void;
  onSignOut: () => Promise<void>;
  access: WorkspaceAccess;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const goTo = (next: Workspace) => {
    navigate(next);
    setNavigationOpen(false);
  };
  const groups: NavigationGroup[] = [
    { label: "Oversikt", items: [{ workspace: "dashboard", label: "Dashboard", icon: "dashboard" }] },
    { label: "Logistikk", items: [
      { workspace: "equipment", label: "Utstyr", icon: "box", visible: access.logistics },
      { workspace: "warehouse", label: "Lager", icon: "warehouse", visible: access.logistics },
      { workspace: "locations", label: "Lokasjoner", icon: "location", visible: access.logistics },
      { workspace: "loans", label: "Utlån", icon: "loan", visible: access.logistics },
      { workspace: "private-equipment", label: "Privat utstyr", icon: "shield", visible: access.logistics },
      { workspace: "barcodes", label: "Strekkoder", icon: "barcode", visible: access.logistics },
    ] },
    { label: "Operativ drift", items: [
      { workspace: "vehicles", label: "Kjøretøy", icon: "vehicle", visible: access.vehicle },
      { workspace: "transport", label: "Transport", icon: "transport", visible: access.transport },
      { workspace: "comms", label: "Samband", icon: "radio", visible: access.comms },
      { workspace: "shop", label: "Shop", icon: "shop", visible: access.shop },
    ] },
    { label: "Arbeidsflyt", items: [
      { workspace: "tasks", label: "Oppgaver", icon: "tasks" },
      { workspace: "requests", label: "Forespørsler", icon: "requests" },
      { workspace: "feedback", label: "Tilbakemeldinger", icon: "feedback", visible: access.feedback },
    ] },
    { label: "System", items: [
      { workspace: "admin", label: "Administrasjon", icon: "settings", visible: access.admin },
      { workspace: "profile", label: "Min profil", icon: "profile" },
    ] },
  ];
  const activeGroup = groups.find((group) => group.items.some((item) => item.workspace === workspace && item.visible !== false))?.label ?? null;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroup);
  useEffect(() => { if (activeGroup) setExpandedGroup(activeGroup); }, [activeGroup]);
  const meta = workspaceMeta[workspace];

  return <div className="h-[100dvh] overflow-hidden bg-[#07111d] text-slate-100 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
    <a href="#main-content" className="sr-only z-[70] rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Hopp til innhold</a>
    {navigationOpen && <button type="button" aria-label="Lukk navigasjon" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setNavigationOpen(false)} />}
    <aside id="primary-navigation" className={`fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-white/[.08] bg-[#091522] shadow-2xl shadow-black/40 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${navigationOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/[.08] px-5">
        <Brand />
        <button type="button" aria-label="Lukk meny" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-200 lg:hidden" onClick={() => setNavigationOpen(false)}>
          <span aria-hidden="true" className="text-xl">×</span>
        </button>
      </div>
      <nav aria-label="Hovednavigasjon" className="bifrost-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          const items = group.items.filter((item) => item.visible !== false);
          if (!items.length) return null;
          const open = expandedGroup === group.label;
          const panelId = `navigation-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          return <div key={group.label} className="mb-2 last:mb-0">
            <button type="button" aria-expanded={open} aria-controls={panelId} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[.14em] transition ${open ? "border-emerald-300/15 bg-emerald-300/[.06] text-emerald-200" : "border-transparent text-slate-600 hover:border-white/[.06] hover:bg-white/[.025] hover:text-slate-400"}`} onClick={() => setExpandedGroup((current) => current === group.label ? null : group.label)}>
              <span>{group.label}</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" /></svg>
            </button>
            <div id={panelId} aria-hidden={!open} className={`mt-1 gap-1 pl-2 ${open ? "grid" : "hidden"}`}>
              {items.map((item) => <SidebarNavigationButton key={item.workspace} item={item} active={workspace === item.workspace} onClick={() => goTo(item.workspace)} />)}
            </div>
          </div>;
        })}
      </nav>
      <div className="shrink-0 border-t border-white/[.08] p-3">
        <button type="button" className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[.04]" onClick={() => goTo("profile")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-300/10 text-sm font-semibold text-emerald-200">{initials(session.user.name)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{session.user.name}</span><span className="block truncate text-xs text-slate-600">{session.user.email}</span></span>
        </button>
        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200" onClick={() => void onSignOut()}>
          <NavigationIcon name="logout" />
          Logg ut
        </button>
      </div>
    </aside>

    <div className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden">
      <header className="z-30 shrink-0 border-b border-white/[.08] bg-[#07111d]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 w-full max-w-[96rem] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" aria-label="Åpne navigasjon" aria-controls="primary-navigation" aria-expanded={navigationOpen} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 lg:hidden" onClick={() => setNavigationOpen(true)}>
            <NavigationIcon name="menu" />
          </button>
          <div className="mr-auto min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300/80">{meta.group}</p>
            <p className="truncate text-lg font-semibold text-slate-100">{meta.label}</p>
          </div>
          {access.logistics && <div className="order-3 w-full sm:order-none sm:w-auto"><GlobalSearch accessToken={session.accessToken} /></div>}
          <NotificationCenter accessToken={session.accessToken} />
        </div>
      </header>
      <main id="main-content" className="bifrost-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-[96rem] flex-col px-4 sm:px-6 lg:px-8"><WorkspaceContent session={session} workspace={workspace} access={access} /></div>
      </main>
      <div className="shrink-0"><AppFooter /></div>
    </div>
  </div>;
}

function PublicShell({ session, onLocalLogin }: {
  session: Exclude<SessionState, { status: "authenticated" }>;
  onLocalLogin: (email: string, password: string) => Promise<void>;
}) {
  return <main className="bifrost-scrollbar h-[100dvh] overflow-y-auto bg-[#07111d] text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pt-8 md:px-10">
      <header className="flex items-center border-b border-white/10 pb-5"><Brand /></header>
      <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="mb-5 text-xs font-bold tracking-[.22em] text-emerald-300">BIFROST V2 · SIKKER LOGISTIKK</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-tight md:text-7xl">Alt utstyr.<br /><span className="text-slate-500">Én operativ flate.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">Ny arbeidsflate for lager, utlån, transport, samband og crew-operasjoner — koblet til eksisterende Bifrost-data.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          {session.status === "loading" && <Status title="Kobler til Bifrost" detail="Kontrollerer sikker økt …" />}
          {session.status === "anonymous" && <LoginPanel localLoginEnabled={session.localLoginEnabled} onLocalLogin={onLocalLogin} />}
          {session.status === "error" && <Status title="Kunne ikke koble til" detail={session.message} error />}
        </div>
      </section>
      <AppFooter contained={false} />
    </div>
  </main>;
}

function WorkspaceContent({ session, workspace, access }: { session: AuthenticatedSession; workspace: Workspace; access: WorkspaceAccess }) {
  const token = session.accessToken;
  if (workspace === "dashboard") return <DashboardWorkspace accessToken={token} />;
  if (workspace === "profile") return <ProfileWorkspace accessToken={token} currentUser={session.user} />;
  if (workspace === "admin") return access.admin ? <AdminWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (workspace === "feedback") return access.feedback ? <FeedbackWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (workspace === "tasks") return <TaskWorkspace accessToken={token} />;
  if (workspace === "requests") return <RequestWorkspace accessToken={token} />;
  if (workspace === "shop") return access.shop ? <ShopWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (workspace === "comms") return access.comms ? <CommsWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (workspace === "transport") return access.transport ? <TransportWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (workspace === "vehicles") return access.vehicle ? <VehicleWorkspace accessToken={token} /> : <NoAccessWorkspace user={session.user} />;
  if (!access.logistics) return <NoAccessWorkspace user={session.user} />;
  if (workspace === "locations") return <LocationWorkspace accessToken={token} />;
  if (workspace === "warehouse") return <WarehouseWorkspace accessToken={token} />;
  if (workspace === "loans") return <LoanWorkspace accessToken={token} />;
  if (workspace === "private-equipment") return <PrivateEquipmentWorkspace accessToken={token} />;
  if (workspace === "barcodes") return <BarcodeWorkspace accessToken={token} />;
  return <EquipmentWorkspace user={session.user} accessToken={token} />;
}

function Brand() {
  return <div className="flex items-center gap-3">
    <div className="grid size-10 place-items-center rounded-xl bg-emerald-300 font-black text-slate-950 shadow-lg shadow-emerald-300/10">B</div>
    <div><p className="font-semibold leading-tight">Bifrost</p><p className="mt-1 text-[11px] text-slate-500">TG Logistics</p></div>
  </div>;
}

function AppFooter({ contained = true }: { contained?: boolean }) {
  const content = <div className="flex flex-col gap-2 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
    <p>© {new Date().getFullYear()} Nextarch Studio. Alle rettigheter reservert.</p>
    <p className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-300" />Bifrost V2 · Sikker logistikk</p>
  </div>;
  return <footer className="border-t border-white/[.08]">{contained ? <div className="mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-8">{content}</div> : content}</footer>;
}

type NavigationIconName = "dashboard" | "box" | "warehouse" | "location" | "loan" | "shield" | "barcode" | "vehicle" | "transport" | "radio" | "shop" | "tasks" | "requests" | "feedback" | "settings" | "profile" | "logout" | "menu";
type NavigationItem = { workspace: Workspace; label: string; icon: NavigationIconName; visible?: boolean };
type NavigationGroup = { label: string; items: NavigationItem[] };

function SidebarNavigationButton({ item, active, onClick }: { item: NavigationItem; active: boolean; onClick: () => void }) {
  return <button type="button" aria-current={active ? "page" : undefined} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-emerald-300/10 font-medium text-emerald-200" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`} onClick={onClick}>
    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-300" />}
    <NavigationIcon name={item.icon} />
    <span>{item.label}</span>
  </button>;
}

const navigationPaths: Record<NavigationIconName, string[]> = {
  dashboard: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  box: ["m4 7 8-4 8 4-8 4-8-4Z", "m4 7 8 4 8-4v10l-8 4-8-4V7Z", "M12 11v10"],
  warehouse: ["M3 21V8l9-5 9 5v13", "M7 21v-8h10v8", "M7 17h10"],
  location: ["M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z", "M12 10h.01"],
  loan: ["M7 7h11l-3-3", "m18 7-3 3", "M17 17H6l3 3", "m6 17 3-3"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  barcode: ["M3 5v14M7 5v14M10 5v14M14 5v14M18 5v14M21 5v14"],
  vehicle: ["m5 17-2-1v-5l2-5h14l2 5v5l-2 1", "M5 11h14", "M7 17v2M17 17v2", "M7 14h.01M17 14h.01"],
  transport: ["M3 6h11v11H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  radio: ["M6 18h12", "M8 18V8h8v10", "M10 12h4", "M12 8V5", "M5 9a10 10 0 0 1 14 0", "M2 6a14 14 0 0 1 20 0"],
  shop: ["M5 8h14l-1 13H6L5 8Z", "M9 9V6a3 3 0 0 1 6 0v3"],
  tasks: ["M9 6h11M9 12h11M9 18h11", "m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"],
  requests: ["M4 4h16v13H7l-3 3V4Z", "M8 9h8M8 13h5"],
  feedback: ["M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z", "M8 8h8M8 12h5"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 3.67-.08-.02a1.7 1.7 0 0 0-1.8-.3l-.8.46a1.7 1.7 0 0 0-.82 1.72V22H9.94v-.1a1.7 1.7 0 0 0-.84-1.47l-.8-.46a1.7 1.7 0 0 0-1.88.04l-.06.05-2.12-3.67.08-.06a1.7 1.7 0 0 0 .64-1.7v-.92a1.7 1.7 0 0 0-.98-1.58L4 12.1V7.86l.08-.03a1.7 1.7 0 0 0 .98-1.58v-.92a1.7 1.7 0 0 0-.64-1.7l-.08-.06L6.46 0l.06.05a1.7 1.7 0 0 0 1.88.04l.8-.46"],
  profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
};

function NavigationIcon({ name }: { name: NavigationIconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{navigationPaths[name].map((path, index) => <path key={index} d={path} />)}</svg>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";
}

const LOCAL_TOKEN_STORAGE_KEY = "bifrost.local.access_token";

function LoginPanel({ localLoginEnabled, onLocalLogin }: { localLoginEnabled: boolean; onLocalLogin: (email: string, password: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await onLocalLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lokal innlogging feilet.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <p className="text-sm font-medium text-emerald-300">Sikker innlogging</p>
    <h2 className="mt-3 text-2xl font-semibold">Logg inn i Bifrost</h2>
    <p className="mt-3 leading-7 text-slate-400">Keycloak er hovedinnloggingen. Lokal V1-konto kan brukes når reserveinnlogging er aktivert.</p>
    {localLoginEnabled && <form className="mt-6 grid gap-3" onSubmit={(event) => void submit(event)}>
      <label><span className="mb-2 block text-sm text-slate-400">E-post</span><input name="email" type="email" required autoComplete="username" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-emerald-300/60" /></label>
      <label><span className="mb-2 block text-sm text-slate-400">Passord</span><input name="password" type="password" required autoComplete="current-password" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-emerald-300/60" /></label>
      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      <button disabled={busy} className="rounded-xl border border-emerald-300/30 px-5 py-3.5 font-semibold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50">{busy ? "Logger inn …" : "Logg inn lokalt"}</button>
    </form>}
    {localLoginEnabled && <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/10" />eller<span className="h-px flex-1 bg-white/10" /></div>}
    <button className={`${localLoginEnabled ? "" : "mt-8 "}w-full rounded-xl bg-emerald-300 px-5 py-3.5 font-semibold text-slate-950 hover:bg-emerald-200`} onClick={() => void beginSignIn()}>Fortsett med Keycloak</button>
  </>;
}

type Workspace = "dashboard" | "equipment" | "warehouse" | "locations" | "loans" | "private-equipment" | "barcodes" | "requests" | "vehicles" | "transport" | "comms" | "shop" | "tasks" | "feedback" | "admin" | "profile";

const workspaceMeta: Record<Workspace, { label: string; group: string }> = {
  dashboard: { label: "Dashboard", group: "Oversikt" },
  equipment: { label: "Utstyr", group: "Logistikk" },
  warehouse: { label: "Lager", group: "Logistikk" },
  locations: { label: "Lokasjoner", group: "Logistikk" },
  loans: { label: "Utlån", group: "Logistikk" },
  "private-equipment": { label: "Privat utstyr", group: "Logistikk" },
  barcodes: { label: "Strekkoder", group: "Logistikk" },
  requests: { label: "Forespørsler", group: "Arbeidsflyt" },
  vehicles: { label: "Kjøretøy", group: "Operativ drift" },
  transport: { label: "Transport", group: "Operativ drift" },
  comms: { label: "Samband", group: "Operativ drift" },
  shop: { label: "Shop", group: "Operativ drift" },
  tasks: { label: "Oppgaver", group: "Arbeidsflyt" },
  feedback: { label: "Tilbakemeldinger", group: "Arbeidsflyt" },
  admin: { label: "Administrasjon", group: "System" },
  profile: { label: "Min profil", group: "System" },
};

function workspaceFromPath(): Workspace {
  if (window.location.pathname === "/dashboard" || window.location.pathname === "/") return "dashboard";
  if (window.location.pathname === "/equipment") return "equipment";
  if (window.location.pathname === "/locations") return "locations";
  if (window.location.pathname === "/warehouse") return "warehouse";
  if (window.location.pathname === "/loans") return "loans";
  if (window.location.pathname === "/private-equipment") return "private-equipment";
  if (window.location.pathname === "/barcodes" || window.location.pathname === "/strekkoder") return "barcodes";
  if (window.location.pathname === "/requests") return "requests";
  if (window.location.pathname === "/vehicles") return "vehicles";
  if (window.location.pathname === "/transport") return "transport";
  if (window.location.pathname === "/comms" || window.location.pathname === "/samband") return "comms";
  if (window.location.pathname === "/shop" || window.location.pathname === "/crewtoy") return "shop";
  if (window.location.pathname === "/tasks" || window.location.pathname === "/oppgaver") return "tasks";
  if (window.location.pathname === "/feedback" || window.location.pathname === "/tilbakemeldinger") return "feedback";
  if (window.location.pathname === "/admin") return "admin";
  if (window.location.pathname === "/profile") return "profile";
  return "dashboard";
}

function NoAccessWorkspace({ user }: { user: CurrentUser }) {
  return <section className="grid flex-1 place-items-center py-16"><div className="max-w-xl rounded-3xl border border-white/10 bg-white/[.025] p-8 text-center"><p className="text-sm text-amber-300">Innlogget uten operativ modul</p><h1 className="mt-3 text-3xl font-semibold">Hei, {user.firstName}</h1><p className="mt-4 leading-7 text-slate-400">Kontoen er gyldig, men rollene dine gir ikke tilgang til de ferdige V2-modulene ennå. API-et håndhever de samme V1-rollene.</p><p className="mt-4 text-sm text-slate-600">Roller: {user.roles.join(", ") || "ingen"}</p></div></section>;
}

function NavigationButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button className={`rounded-lg px-3 py-2 text-sm transition ${active ? "bg-emerald-300 text-slate-950" : "text-slate-400 hover:text-slate-100"}`} onClick={onClick}>{children}</button>;
}

function Status({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) {
  return <div><p className={error ? "text-sm font-medium text-rose-300" : "text-sm font-medium text-emerald-300"}>{error ? "Tilkoblingsfeil" : "Vent litt"}</p><h2 className="mt-3 text-2xl font-semibold">{title}</h2><p className="mt-3 text-slate-400">{detail}</p></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><NotificationsProvider><App /></NotificationsProvider></StrictMode>);
