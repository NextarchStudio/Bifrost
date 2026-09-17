import type { CrewClothingInventoryItem, CrewClothingItemType, CrewClothingMember, CrewClothingWorkspaceResponse, ShopItem, ShopWorkspaceResponse } from "@bifrost/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  createCrewClothingCrew,
  createShopCategory,
  createShopItem,
  deleteCrewClothingInventory,
  deleteShopItem,
  downloadShopExport,
  getCrewClothingWorkspace,
  getShopWorkspace,
  importShopInventory,
  lookupCrewClothingMember,
  moveShopItem,
  saveCrewClothingInventory,
  setCrewClothingDelivery,
  updateCrewClothingCrew,
  updateCrewClothingInventory,
  updateCrewClothingMember,
} from "../../api/client";

export function ShopWorkspace({ accessToken }: { accessToken: string }) {
  const [shop, setShop] = useState<ShopWorkspaceResponse | null>(null);
  const [clothing, setClothing] = useState<CrewClothingWorkspaceResponse | null>(null);
  const [tab, setTab] = useState<"inventory" | "clothing">("inventory");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = async () => {
    const [shopData, clothingData] = await Promise.all([getShopWorkspace(accessToken), getCrewClothingWorkspace(accessToken)]);
    setShop(shopData); setClothing(clothingData);
  };
  useEffect(() => { void reload().catch((reason) => setError(messageFrom(reason))); }, [accessToken]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null); setSuccess(null);
    try { await action(); await reload(); setSuccess(message); }
    catch (reason) { setError(messageFrom(reason)); throw reason; }
  };

  if (!shop || !clothing) return <WorkspaceState title="Laster Shop" detail="Henter varelager og crewtøy …" error={Boolean(error)} />;
  return <section className="flex-1 py-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm text-fuchsia-300">V1-data · ny arbeidsflate</p><h1 className="mt-1 text-3xl font-semibold">Shop og crewtøy</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Lagerbevegelser, varetelling og utleveringsstatus lagres i eksisterende V1-tabeller via API-et.</p></div><div className="flex rounded-xl border border-white/10 bg-white/[.025] p-1"><Tab active={tab === "inventory"} onClick={() => setTab("inventory")}>Varelager</Tab><Tab active={tab === "clothing"} onClick={() => setTab("clothing")}>Crewtøy</Tab></div></div>
    {error && <Banner tone="error">{error}</Banner>}{success && <Banner tone="success">{success}</Banner>}
    {tab === "inventory"
      ? <InventoryWorkspace accessToken={accessToken} data={shop} run={run} onError={setError} />
      : <ClothingWorkspace accessToken={accessToken} data={clothing} run={run} onError={setError} onReload={reload} />}
  </section>;
}

function InventoryWorkspace({ accessToken, data, run, onError }: WorkspaceProps<ShopWorkspaceResponse>) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => { const query = search.trim().toLocaleLowerCase("nb-NO"); return query ? data.items.filter((item) => [item.id, item.name, item.categoryName, item.size, item.notes].join(" ").toLocaleLowerCase("nb-NO").includes(query)) : data.items; }, [data.items, search]);
  return <>
    <div className="grid gap-5 lg:grid-cols-2"><NewShopItem accessToken={accessToken} data={data} run={run} /><NewCategory accessToken={accessToken} run={run} /><ImportExport accessToken={accessToken} run={run} onError={onError} /></div>
    <div className={`${cardClass} mt-5`}><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-fuchsia-300">Beholdning</p><h2 className="mt-1 text-xl font-semibold">Varelager</h2></div><label className="w-full max-w-sm"><span className="sr-only">Søk i varelageret</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Søk på vare, kategori eller størrelse" className={inputClass} /></label></div>
      {filtered.length === 0 ? <EmptyState>{data.items.length ? "Ingen varer matcher søket." : "Ingen varer er registrert."}</EmptyState> : <div className="mt-5 overflow-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className={headClass}><tr><th>Vare</th><th>Kategori</th><th>Størrelse</th><th>Antall</th><th>Status</th><th>Inn / ut</th><th>Slett</th></tr></thead><tbody className="divide-y divide-white/[.06]">{filtered.map((item) => <ShopItemRow key={item.id} item={item} accessToken={accessToken} run={run} />)}</tbody></table></div>}
    </div>
    <div className={`${cardClass} mt-5`}><p className="text-sm text-sky-300">Historikk</p><h2 className="mt-1 text-xl font-semibold">Siste bevegelser</h2>{data.movements.length === 0 ? <EmptyState>Ingen lagerbevegelser.</EmptyState> : <div className="mt-5 overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className={headClass}><tr><th>Tid</th><th>Type</th><th>Vare</th><th>Antall</th><th>Utført av</th><th>Notat</th></tr></thead><tbody className="divide-y divide-white/[.06]">{data.movements.map((movement) => <tr key={movement.id}><Cell>{formatDate(movement.createdAt)}</Cell><Cell><Status active={movement.movementType === "checkin"}>{movement.movementType}</Status></Cell><Cell>{movement.itemName}{movement.itemSize ? ` · ${movement.itemSize}` : ""}</Cell><Cell>{movement.quantity}</Cell><Cell>{movement.actorName ?? "–"}</Cell><Cell>{movement.notes ?? "–"}</Cell></tr>)}</tbody></table></div>}</div>
  </>;
}

function NewShopItem({ accessToken, data, run }: Omit<WorkspaceProps<ShopWorkspaceResponse>, "onError">) {
  const [saving, setSaving] = useState(false);
  return <form className={cardClass} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); void run(() => createShopItem(accessToken, { name: String(form.get("name") ?? ""), categoryId: Number(form.get("categoryId")) || null, newCategory: String(form.get("newCategory") ?? "") || null, size: String(form.get("size") ?? "") || null, quantity: Number(form.get("quantity")), notes: String(form.get("notes") ?? "") || null }), "Varen er opprettet.").then(() => event.currentTarget.reset()).catch(() => undefined).finally(() => setSaving(false)); }}><p className="text-sm text-fuchsia-300">Ny vare</p><h2 className="mt-1 text-xl font-semibold">Legg til i Shop</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Varenavn" name="name" required /><Select label="Kategori" name="categoryId" options={[{ value: "", label: "Velg kategori" }, ...data.categories.map((category) => ({ value: String(category.id), label: category.name }))]} /><Field label="Eller ny kategori" name="newCategory" /><Select label="Størrelse" name="size" options={[{ value: "", label: "Ingen størrelse" }, ...data.sizeOptions.map((size) => ({ value: size, label: size }))]} /><Field label="Antall" name="quantity" type="number" min="0" defaultValue="0" required /><label className="sm:col-span-2"><Label>Notat</Label><textarea name="notes" maxLength={4000} className={textareaClass} /></label></div><button disabled={saving} className={`${primaryButton} mt-5`}>{saving ? "Oppretter …" : "Opprett vare"}</button></form>;
}

function NewCategory({ accessToken, run }: ActionProps) {
  const [saving, setSaving] = useState(false);
  return <form className={cardClass} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); void run(() => createShopCategory(accessToken, String(form.get("name") ?? "")), "Kategorien er opprettet.").then(() => event.currentTarget.reset()).catch(() => undefined).finally(() => setSaving(false)); }}><p className="text-sm text-sky-300">Kategorier</p><h2 className="mt-1 text-xl font-semibold">Opprett kategori</h2><div className="mt-5"><Field label="Kategorinavn" name="name" required /></div><button disabled={saving} className={`${primaryButton} mt-5`}>{saving ? "Oppretter …" : "Opprett kategori"}</button></form>;
}

function ImportExport({ accessToken, run, onError }: ActionProps & { onError: (value: string | null) => void }) {
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const download = (format: "csv" | "pdf") => { setBusy(true); onError(null); void downloadShopExport(accessToken, format).then(({ blob, filename }) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }).catch((reason) => onError(messageFrom(reason))).finally(() => setBusy(false)); };
  return <div className={`${cardClass} lg:col-span-2`}><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm text-amber-300">Varetelling</p><h2 className="mt-1 text-xl font-semibold">Import og eksport</h2><p className="mt-2 text-sm text-slate-500">Importer XLSX, HTML-basert XLS eller CSV. Avvik registreres som inn- eller utsjekk.</p></div><div className="flex gap-2"><button type="button" disabled={busy} className={secondaryButton} onClick={() => download("csv")}>Last ned CSV</button><button type="button" disabled={busy} className={secondaryButton} onClick={() => download("pdf")}>Last ned PDF</button></div></div><form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (!file) return; setBusy(true); void run(async () => { const result = await importShopInventory(accessToken, file); return result; }, "Varetellingen er importert.").then(() => setFile(null)).catch(() => undefined).finally(() => setBusy(false)); }}><label className="min-w-[260px] flex-1"><Label>Importfil</Label><input type="file" accept=".xlsx,.xls,.csv" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={inputClass} /></label><button disabled={busy || !file} className={primaryButton}>{busy ? "Arbeider …" : "Importer varetelling"}</button></form></div>;
}

function ShopItemRow({ item, accessToken, run }: { item: ShopItem } & ActionProps) {
  const [quantity, setQuantity] = useState(1); const [busy, setBusy] = useState(false);
  const move = (type: "check-in" | "check-out") => { setBusy(true); void run(() => moveShopItem(accessToken, item.id, type, quantity), type === "check-in" ? "Varen er sjekket inn." : "Varen er sjekket ut.").catch(() => undefined).finally(() => setBusy(false)); };
  return <tr><Cell><span className="font-medium text-slate-200">{item.name}</span><span className="mt-1 block text-xs text-slate-600">#{item.id}{item.notes ? ` · ${item.notes}` : ""}</span></Cell><Cell>{item.categoryName}</Cell><Cell>{item.size ?? "–"}</Cell><Cell>{item.quantity}</Cell><Cell><Status active={item.status !== "discontinued"}>{item.status === "discontinued" ? "Utgår" : "Aktiv"}</Status></Cell><Cell><div className="flex items-center gap-2"><input aria-label={`Antall for ${item.name}`} type="number" min="1" max="1000000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-2" /><button type="button" disabled={busy} className={miniButton} onClick={() => move("check-in")}>Inn</button><button type="button" disabled={busy || item.quantity < quantity} className={miniButton} onClick={() => move("check-out")}>Ut</button></div></Cell><Cell><button type="button" disabled={busy} className={dangerButton} onClick={() => { if (!window.confirm(`Slette ${item.name} og all varehistorikk?`)) return; setBusy(true); void run(() => deleteShopItem(accessToken, item.id), "Varen er slettet.").catch(() => undefined).finally(() => setBusy(false)); }}>Slett</button></Cell></tr>;
}

function ClothingWorkspace({ accessToken, data, run, onError, onReload }: WorkspaceProps<CrewClothingWorkspaceResponse> & { onReload: () => Promise<void> }) {
  const [selected, setSelected] = useState<CrewClothingMember | null>(null);
  useEffect(() => { if (selected) setSelected(data.members.find((member) => member.id === selected.id) ?? selected); }, [data.members]);
  return <>
    <div className="grid gap-5 lg:grid-cols-2"><MemberLookup accessToken={accessToken} onFound={(member) => { setSelected(member); void onReload(); }} onError={onError} /><NewClothingInventory accessToken={accessToken} data={data} run={run} /></div>
    {selected && <SelectedMember member={selected} data={data} accessToken={accessToken} run={run} />}
    <ClothingInventory data={data} accessToken={accessToken} run={run} />
    <CrewSummary data={data} accessToken={accessToken} run={run} />
    <div className={`${cardClass} mt-5`}><p className="text-sm text-sky-300">Oversikt</p><h2 className="mt-1 text-xl font-semibold">Crewmedlemmer</h2>{data.members.length === 0 ? <EmptyState>Ingen crewmedlemmer er registrert.</EmptyState> : <div className="mt-5 overflow-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className={headClass}><tr><th>Navn</th><th>Crew</th><th>Wannabe-ID</th><th>T-skjorte</th><th>Genser</th><th>Status</th></tr></thead><tbody className="divide-y divide-white/[.06]">{data.members.map((member) => <tr key={member.id} className="cursor-pointer hover:bg-white/[.025]" onClick={() => setSelected(member)}><Cell>{member.name}{member.nickname ? ` (${member.nickname})` : ""}</Cell><Cell>{member.crewName ?? "–"}</Cell><Cell>{member.wannabeId ?? "–"}</Cell><Cell>{member.tshirtSize ?? "–"}</Cell><Cell>{member.hoodieSize ?? "–"}</Cell><Cell>T: {member.tshirtDelivered ? "utlevert" : "ikke utlevert"}<br />G: {member.hoodieDelivered ? "utlevert" : "ikke utlevert"}</Cell></tr>)}</tbody></table></div>}</div>
  </>;
}

function MemberLookup({ accessToken, onFound, onError }: { accessToken: string; onFound: (member: CrewClothingMember) => void; onError: (value: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  return <form className={cardClass} onSubmit={(event) => { event.preventDefault(); const query = String(new FormData(event.currentTarget).get("query") ?? ""); setBusy(true); onError(null); void lookupCrewClothingMember(accessToken, query).then(onFound).catch((reason) => onError(messageFrom(reason))).finally(() => setBusy(false)); }}><p className="text-sm text-fuchsia-300">Oppslag</p><h2 className="mt-1 text-xl font-semibold">Finn crewmedlem</h2><div className="mt-5"><Field label="Badge eller Wannabe-ID" name="query" required /></div><button disabled={busy} className={`${primaryButton} mt-5`}>{busy ? "Søker …" : "Søk opp crewmedlem"}</button><p className="mt-3 text-xs leading-5 text-slate-600">Crew og medlem opprettes automatisk fra crew-API-et ved første treff, som i V1.</p></form>;
}

function NewClothingInventory({ accessToken, data, run }: Omit<WorkspaceProps<CrewClothingWorkspaceResponse>, "onError">) {
  const [busy, setBusy] = useState(false);
  return <form className={cardClass} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); void run(() => saveCrewClothingInventory(accessToken, { itemType: String(form.get("itemType")) as CrewClothingItemType, size: String(form.get("size")), quantity: Number(form.get("quantity")) }), "Crewtøybeholdningen er lagret.").then(() => event.currentTarget.reset()).catch(() => undefined).finally(() => setBusy(false)); }}><p className="text-sm text-amber-300">Beholdning</p><h2 className="mt-1 text-xl font-semibold">Ny crewtøyvare</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><Select label="Plagg" name="itemType" required options={[{ value: "", label: "Velg" }, { value: "tshirt", label: "T-skjorte" }, { value: "hoodie", label: "Genser" }]} /><Select label="Størrelse" name="size" required options={[{ value: "", label: "Velg" }, ...data.sizeOptions.map((size) => ({ value: size, label: size }))]} /><Field label="Antall" name="quantity" type="number" min="0" defaultValue="0" required /></div><button disabled={busy} className={`${primaryButton} mt-5`}>{busy ? "Lagrer …" : "Lagre varelinje"}</button></form>;
}

function SelectedMember({ member, data, accessToken, run }: { member: CrewClothingMember; data: CrewClothingWorkspaceResponse } & ActionProps) {
  const [busy, setBusy] = useState(false);
  const deliver = (types: CrewClothingItemType[], delivered: boolean) => { setBusy(true); void run(() => setCrewClothingDelivery(accessToken, member.id, types, delivered), "Utleveringsstatusen er oppdatert.").catch(() => undefined).finally(() => setBusy(false)); };
  const bothDelivered = member.tshirtDelivered && member.hoodieDelivered;
  return <div className={`${cardClass} mt-5`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-fuchsia-300">Valgt crewmedlem</p><h2 className="mt-1 text-2xl font-semibold">{member.name}</h2><p className="mt-2 text-sm text-slate-500">{member.nickname || "Ingen nickname"} · Wannabe {member.wannabeId ?? "–"} · {member.crewName ?? "Ingen crew"}</p></div><div className="flex gap-2"><Status active={member.tshirtDelivered}>T {member.tshirtDelivered ? "utlevert" : "ikke utlevert"}</Status><Status active={member.hoodieDelivered}>G {member.hoodieDelivered ? "utlevert" : "ikke utlevert"}</Status></div></div>
    <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); void run(() => updateCrewClothingMember(accessToken, member.id, { crewId: Number(form.get("crewId")) || null, tshirtSize: String(form.get("tshirtSize") ?? "") || null, hoodieSize: String(form.get("hoodieSize") ?? "") || null }), "Størrelser og crew er oppdatert.").catch(() => undefined).finally(() => setBusy(false)); }}><Select label="Crew" name="crewId" defaultValue={member.crewId ? String(member.crewId) : ""} options={[{ value: "", label: "Ingen crew" }, ...data.crews.map((crew) => ({ value: String(crew.id), label: crew.name }))]} /><Select label="T-skjorte" name="tshirtSize" defaultValue={member.tshirtSize ?? ""} options={[{ value: "", label: "Ikke valgt" }, ...data.sizeOptions.map((size) => ({ value: size, label: size }))]} /><Select label="Genser" name="hoodieSize" defaultValue={member.hoodieSize ?? ""} options={[{ value: "", label: "Ikke valgt" }, ...data.sizeOptions.map((size) => ({ value: size, label: size }))]} /><button disabled={busy} className={`${primaryButton} md:col-span-3 md:justify-self-start`}>Lagre størrelser og crew</button></form>
    <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} className={secondaryButton} onClick={() => deliver(["tshirt"], !member.tshirtDelivered)}>T {member.tshirtDelivered ? "ikke utlevert" : "utlevert"}</button><button disabled={busy} className={secondaryButton} onClick={() => deliver(["hoodie"], !member.hoodieDelivered)}>G {member.hoodieDelivered ? "ikke utlevert" : "utlevert"}</button><button disabled={busy} className={secondaryButton} onClick={() => deliver(["tshirt", "hoodie"], !bothDelivered)}>GT {bothDelivered ? "ikke utlevert" : "utlevert"}</button></div></div>;
}

function ClothingInventory({ data, accessToken, run }: { data: CrewClothingWorkspaceResponse } & ActionProps) {
  return <div className={`${cardClass} mt-5`}><p className="text-sm text-amber-300">Lager</p><h2 className="mt-1 text-xl font-semibold">Crewtøybeholdning</h2>{data.inventory.length === 0 ? <EmptyState>Ingen crewtøyvarer.</EmptyState> : <div className="mt-5 grid gap-3">{data.inventory.map((item) => <ClothingInventoryRow key={item.id} item={item} sizes={data.sizeOptions} accessToken={accessToken} run={run} />)}</div>}</div>;
}

function ClothingInventoryRow({ item, sizes, accessToken, run }: { item: CrewClothingInventoryItem; sizes: readonly string[] } & ActionProps) {
  const [busy, setBusy] = useState(false);
  return <form className="grid gap-3 rounded-xl border border-white/[.08] bg-black/10 p-3 sm:grid-cols-[1fr_1fr_120px_auto_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); void run(() => updateCrewClothingInventory(accessToken, item.id, { itemType: String(form.get("itemType")) as CrewClothingItemType, size: String(form.get("size")), quantity: Number(form.get("quantity")) }), "Varelinjen er oppdatert.").catch(() => undefined).finally(() => setBusy(false)); }}><Select label={`Plagg #${item.id}`} name="itemType" defaultValue={item.itemType} options={[{ value: "tshirt", label: "T-skjorte" }, { value: "hoodie", label: "Genser" }]} /><Select label="Størrelse" name="size" defaultValue={item.size} options={sizes.map((size) => ({ value: size, label: size }))} /><Field label="Antall" name="quantity" type="number" min="0" defaultValue={String(item.quantity)} required /><button disabled={busy} className={secondaryButton}>Lagre</button><button type="button" disabled={busy} className={dangerButton} onClick={() => { if (!window.confirm("Slette denne varelinjen?")) return; setBusy(true); void run(() => deleteCrewClothingInventory(accessToken, item.id), "Varelinjen er slettet.").catch(() => undefined).finally(() => setBusy(false)); }}>Slett</button></form>;
}

function CrewSummary({ data, accessToken, run }: { data: CrewClothingWorkspaceResponse } & ActionProps) {
  return <div className={`${cardClass} mt-5`}><div><p className="text-sm text-sky-300">Crew</p><h2 className="mt-1 text-xl font-semibold">Crewoversikt</h2></div>{data.canManageCrews && <NewCrew accessToken={accessToken} run={run} />}{data.crews.length === 0 ? <EmptyState>Ingen crew er registrert.</EmptyState> : <div className="mt-5 grid gap-3">{data.crews.map((crew) => data.canManageCrews ? <CrewEditRow key={crew.id} crew={crew} accessToken={accessToken} run={run} /> : <div key={crew.id} className="grid gap-2 rounded-xl border border-white/[.08] bg-black/10 p-4 sm:grid-cols-4"><span className="font-medium">{crew.name}</span><span className="text-slate-500">{crew.membersTotal} medlemmer</span><span className="text-slate-500">T: {crew.tshirtDeliveredTotal} utlevert</span><span className="text-slate-500">G: {crew.hoodieDeliveredTotal} utlevert</span></div>)}</div>}</div>;
}

function NewCrew({ accessToken, run }: ActionProps) {
  return <form className="mt-5 grid gap-3 rounded-xl border border-fuchsia-300/10 bg-fuchsia-300/[.025] p-4 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => createCrewClothingCrew(accessToken, { name: String(form.get("name")), tshirtMax: Number(form.get("tshirtMax")), hoodieMax: Number(form.get("hoodieMax")) }), "Crewet er opprettet.").then(() => event.currentTarget.reset()).catch(() => undefined); }}><Field label="Nytt crew" name="name" required /><Field label="T maks" name="tshirtMax" type="number" min="0" defaultValue="1" required /><Field label="G maks" name="hoodieMax" type="number" min="0" defaultValue="1" required /><button className={primaryButton}>Opprett</button></form>;
}

function CrewEditRow({ crew, accessToken, run }: { crew: CrewClothingWorkspaceResponse["crews"][number] } & ActionProps) {
  const [busy, setBusy] = useState(false);
  return <form className="grid gap-3 rounded-xl border border-white/[.08] bg-black/10 p-4 sm:grid-cols-[1fr_110px_110px_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); void run(() => updateCrewClothingCrew(accessToken, crew.id, { name: String(form.get("name")), tshirtMax: Number(form.get("tshirtMax")), hoodieMax: Number(form.get("hoodieMax")) }), "Crewet er oppdatert.").catch(() => undefined).finally(() => setBusy(false)); }}><Field label={`Crew #${crew.id}`} name="name" defaultValue={crew.name} required /><Field label="T maks" name="tshirtMax" type="number" min="0" defaultValue={String(crew.tshirtMax)} required /><Field label="G maks" name="hoodieMax" type="number" min="0" defaultValue={String(crew.hoodieMax)} required /><div className="pb-2 text-sm text-slate-500">{crew.membersTotal} medlemmer · T {crew.tshirtDeliveredTotal} · G {crew.hoodieDeliveredTotal}</div><button disabled={busy} className={secondaryButton}>Lagre</button></form>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) { return <button className={`rounded-lg px-4 py-2 text-sm ${active ? "bg-fuchsia-300 text-slate-950" : "text-slate-400 hover:text-white"}`} onClick={onClick}>{children}</button>; }
function Select({ label, options, ...props }: { label: string; name: string; options: Array<{ value: string; label: string }>; required?: boolean; defaultValue?: string }) { return <label><Label>{label}</Label><select {...props} className={selectClass}>{options.map((option) => <option key={`${option.value}:${option.label}`} value={option.value}>{option.label}</option>)}</select></label>; }
function Field({ label, ...props }: { label: string; name: string; type?: string; min?: string; defaultValue?: string; required?: boolean }) { return <label><Label>{label}</Label><input {...props} className={inputClass} /></label>; }
function Label({ children }: { children: string }) { return <span className="mb-2 block text-sm text-slate-400">{children}</span>; }
function Cell({ children }: { children: React.ReactNode }) { return <td className="py-3 pr-4 text-slate-400">{children}</td>; }
function Status({ active, children }: { active: boolean; children: React.ReactNode }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${active ? "bg-emerald-300/10 text-emerald-200" : "bg-rose-300/10 text-rose-200"}`}>{children}</span>; }
function Banner({ tone, children }: { tone: "success" | "error"; children: string }) { return <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>{children}</div>; }
function EmptyState({ children }: { children: string }) { return <p className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-600">{children}</p>; }
function WorkspaceState({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) { return <section className="grid flex-1 place-items-center py-16"><div className="text-center"><p className={error ? "text-rose-300" : "text-fuchsia-300"}>{error ? "Feil" : "Vent litt"}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-slate-500">{detail}</p></div></section>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }); }
function messageFrom(reason: unknown) { return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres."; }

interface ActionProps { accessToken: string; run: (action: () => Promise<unknown>, message: string) => Promise<void>; }
interface WorkspaceProps<T> extends ActionProps { data: T; onError: (value: string | null) => void; }
const cardClass = "rounded-2xl border border-white/10 bg-white/[.025] p-5";
const inputClass = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-fuchsia-300/60";
const selectClass = "w-full rounded-xl border border-white/10 bg-[#0b1724] px-3 py-2.5 outline-none focus:border-fuchsia-300/60";
const textareaClass = `${inputClass} min-h-24`;
const primaryButton = "rounded-xl bg-fuchsia-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";
const secondaryButton = "rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50";
const miniButton = "rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40";
const dangerButton = "rounded-xl border border-rose-300/20 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-300/10 disabled:opacity-50";
const headClass = "text-xs uppercase tracking-wider text-slate-600 [&_th]:pb-3 [&_th]:pr-4";
