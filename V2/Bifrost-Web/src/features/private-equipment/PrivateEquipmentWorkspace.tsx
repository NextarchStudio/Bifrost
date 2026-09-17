import type { PrivateEquipmentRule } from "@bifrost/contracts";
import { useEffect, useState } from "react";
import { createPrivateEquipmentRule, deletePrivateEquipmentRule, getPrivateEquipment } from "../../api/client";
import { confirmAction } from "../../components/notifications";

export function PrivateEquipmentWorkspace({ accessToken }: { accessToken: string }) {
  const [rules, setRules] = useState<PrivateEquipmentRule[] | null>(null);
  const [selectedRule, setSelectedRule] = useState<PrivateEquipmentRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void getPrivateEquipment(accessToken)
      .then((result) => { if (active) { setRules(result); setError(null); } })
      .catch((reason) => { if (active) setError(messageFrom(reason)); });
    return () => { active = false; };
  }, [accessToken, refresh]);

  return <section className="py-10">
    <div className="mb-8"><p className="text-sm text-amber-300">Eiermerking og kontroll</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Privat utstyr</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prefiksreglene viser tydelige advarsler ved utlån og minner lageret på hvem utstyret skal leveres tilbake til.</p></div>

    <form className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={(event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const data = new FormData(formElement);
      setSaving(true); setError(null); setNotice(null);
      void createPrivateEquipmentRule(accessToken, {
        ownerName: String(data.get("ownerName") ?? ""),
        barcodePrefix: String(data.get("barcodePrefix") ?? ""),
      }).then(() => { formElement.reset(); setNotice("Privat utstyr-regelen ble opprettet."); setRefresh((value) => value + 1); })
        .catch((reason) => setError(messageFrom(reason))).finally(() => setSaving(false));
    }}>
      <Field label="Navn på eier" name="ownerName" required />
      <Field label="Strekkode starter på" name="barcodePrefix" placeholder="F.eks. ANGEL-PRIVAT-" required />
      <button disabled={saving} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-50">{saving ? "Lagrer …" : "Lagre regel"}</button>
    </form>

    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
      {notice && <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-200">{notice}</div>}
      {error && <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Eier</th><th className="px-5 py-4">Prefiks</th><th className="px-5 py-4">Laveste / høyeste</th><th className="px-5 py-4">Treff</th><th className="px-5 py-4"><span className="sr-only">Handlinger</span></th></tr></thead><tbody className="divide-y divide-white/[.06]">
        {!rules && !error && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Henter regler …</td></tr>}
        {rules?.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Ingen regler for privat utstyr er registrert.</td></tr>}
        {rules?.map((rule) => <tr key={rule.id} className="hover:bg-white/[.025]"><td className="px-5 py-4 font-medium text-slate-200">{rule.ownerName}</td><td className="px-5 py-4 font-mono text-amber-200">{rule.barcodePrefix}</td><td className="px-5 py-4 text-slate-400">{rule.lowestSerial ?? "–"}<span className="mx-2 text-slate-700">→</span>{rule.highestSerial ?? "–"}</td><td className="px-5 py-4 text-slate-300">{rule.equipmentCount}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5" onClick={() => setSelectedRule(rule)}>Info</button><button type="button" className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10" onClick={async () => {
          if (!await confirmAction({ title: "Slett prefiksregel?", message: `${rule.barcodePrefix} for ${rule.ownerName} fjernes permanent.`, confirmLabel: "Slett regel", danger: true })) return;
          setError(null); setNotice(null);
          void deletePrivateEquipmentRule(accessToken, rule.id).then(() => { setNotice("Privat utstyr-regelen ble slettet."); setRefresh((value) => value + 1); }).catch((reason) => setError(messageFrom(reason)));
        }}>Slett</button></div></td></tr>)}
      </tbody></table></div>
    </div>
    {selectedRule && <RuleDetails rule={selectedRule} onClose={() => setSelectedRule(null)} />}
  </section>;
}

function RuleDetails({ rule, onClose }: { rule: PrivateEquipmentRule; onClose: () => void }) {
  return <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="private-equipment-title"><div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1927] shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-white/10 p-6"><div><p className="text-sm text-amber-300">{rule.barcodePrefix}</p><h2 id="private-equipment-title" className="mt-1 text-2xl font-semibold">Utstyr eid av {rule.ownerName}</h2><p className="mt-2 text-sm text-slate-500">{rule.equipmentCount} registrerte treff i utstyrsbasen.</p></div><button type="button" className="text-slate-500 hover:text-slate-200" onClick={onClose}>Lukk</button></div><div className="max-h-[60vh] overflow-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 bg-[#0d1927] text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Navn</th><th className="px-5 py-4">Strekkode</th><th className="px-5 py-4">Antall</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-white/[.06]">{rule.equipmentItems.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">Ingen utstyr matcher prefikset.</td></tr>}{rule.equipmentItems.map((item) => <tr key={item.id}><td className="px-5 py-4 text-slate-200">{item.name}</td><td className="px-5 py-4 font-mono text-slate-400">{item.serialNumber}</td><td className="px-5 py-4">{item.quantity}</td><td className="px-5 py-4 text-slate-400">{item.status}</td></tr>)}</tbody></table></div></div></div>;
}

function Field({ label, ...props }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-sm text-slate-400">{label}</span><input {...props} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-amber-300/60" /></label>;
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Handlingen kunne ikke fullføres.";
}
