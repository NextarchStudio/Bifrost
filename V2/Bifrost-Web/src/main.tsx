import type { CurrentUser } from "@bifrost/contracts";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentUser } from "./api/client";
import { beginSignIn, completeSignIn, getSignedInUser, signOut } from "./auth/oidc";
import { EquipmentWorkspace } from "./features/equipment/EquipmentWorkspace";
import { LocationWorkspace } from "./features/locations/LocationWorkspace";
import { WarehouseWorkspace } from "./features/warehouse/WarehouseWorkspace";
import { LoanWorkspace } from "./features/loans/LoanWorkspace";
import { PrivateEquipmentWorkspace } from "./features/private-equipment/PrivateEquipmentWorkspace";
import { RequestWorkspace } from "./features/requests/RequestWorkspace";
import "./styles.css";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: CurrentUser; accessToken: string }
  | { status: "error"; message: string };

function App() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [workspace, setWorkspace] = useState<Workspace>(workspaceFromPath());

  useEffect(() => {
    const load = async () => {
      try {
        const isCallback = window.location.pathname === "/auth/callback";
        const oidcUser = isCallback ? await completeSignIn() : await getSignedInUser();
        if (isCallback) window.history.replaceState({}, "", "/equipment");
        if (!oidcUser || oidcUser.expired) return setSession({ status: "anonymous" });
        setSession({ status: "authenticated", user: await getCurrentUser(oidcUser.access_token), accessToken: oidcUser.access_token });
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

  const hasLogisticsAccess = session.status === "authenticated" && session.user.roles.some((role) => LOGISTICS_ROLES.has(role));

  return (
    <main className="min-h-screen bg-[#07111d] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-300 font-black text-slate-950">B</div>
            <div><p className="font-semibold">Bifrost</p><p className="text-xs text-slate-500">TG Logistics</p></div>
          </div>
          {session.status === "authenticated" && <div className="flex flex-wrap items-center gap-2"><nav className="mr-2 flex flex-wrap rounded-xl border border-white/10 bg-white/[.025] p-1" aria-label="Hovednavigasjon">{hasLogisticsAccess && <><NavigationButton active={workspace === "equipment"} onClick={() => navigate("equipment")}>Utstyr</NavigationButton><NavigationButton active={workspace === "warehouse"} onClick={() => navigate("warehouse")}>Lager</NavigationButton><NavigationButton active={workspace === "locations"} onClick={() => navigate("locations")}>Lokasjoner</NavigationButton><NavigationButton active={workspace === "loans"} onClick={() => navigate("loans")}>Utlån</NavigationButton><NavigationButton active={workspace === "private-equipment"} onClick={() => navigate("private-equipment")}>Privat utstyr</NavigationButton></>}<NavigationButton active={workspace === "requests"} onClick={() => navigate("requests")}>Forespørsler</NavigationButton></nav><button className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5" onClick={() => void signOut()}>Logg ut</button></div>}
        </header>

        {session.status === "authenticated" ? (
          workspace === "requests" ? <RequestWorkspace accessToken={session.accessToken} /> : !hasLogisticsAccess ? <NoAccessWorkspace user={session.user} /> : workspace === "locations" ? <LocationWorkspace accessToken={session.accessToken} /> : workspace === "warehouse" ? <WarehouseWorkspace accessToken={session.accessToken} /> : workspace === "loans" ? <LoanWorkspace accessToken={session.accessToken} /> : workspace === "private-equipment" ? <PrivateEquipmentWorkspace accessToken={session.accessToken} /> : <EquipmentWorkspace user={session.user} accessToken={session.accessToken} />
        ) : <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="mb-5 text-xs font-bold tracking-[.22em] text-emerald-300">BIFROST V2 · SIKKER LOGISTIKK</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-tight md:text-7xl">Alt utstyr.<br /><span className="text-slate-500">Én operativ flate.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">Ny arbeidsflate for lager, utlån, transport, samband og crew-operasjoner — koblet til eksisterende Bifrost-data.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl shadow-black/30 backdrop-blur">
            {session.status === "loading" && <Status title="Kobler til Bifrost" detail="Kontrollerer sikker økt …" />}
            {session.status === "anonymous" && (
              <>
                <p className="text-sm font-medium text-emerald-300">Sikker innlogging</p>
                <h2 className="mt-3 text-2xl font-semibold">Fortsett med Keycloak</h2>
                <p className="mt-3 leading-7 text-slate-400">Bruk din autoriserte The Gathering-konto. Lokal innlogging er ikke tilgjengelig i V2.</p>
                <button className="mt-8 w-full rounded-xl bg-emerald-300 px-5 py-3.5 font-semibold text-slate-950 hover:bg-emerald-200" onClick={() => void beginSignIn()}>Logg inn</button>
              </>
            )}
            {session.status === "error" && <Status title="Kunne ikke koble til" detail={session.message} error />}
          </div>
        </section>}
      </div>
    </main>
  );
}

const LOGISTICS_ROLES = new Set(["developer", "chief", "co-chief", "logistikk"]);

type Workspace = "equipment" | "warehouse" | "locations" | "loans" | "private-equipment" | "requests";

function workspaceFromPath(): Workspace {
  if (window.location.pathname === "/locations") return "locations";
  if (window.location.pathname === "/warehouse") return "warehouse";
  if (window.location.pathname === "/loans") return "loans";
  if (window.location.pathname === "/private-equipment") return "private-equipment";
  if (window.location.pathname === "/requests") return "requests";
  return "equipment";
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

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
