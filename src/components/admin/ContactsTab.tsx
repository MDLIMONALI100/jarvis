"use client";
import { Loader2, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Field, TextArea, TextInput, Toggle } from "./ui";

interface Contact {
  id: string;
  name: string;
  nicknames: string;
  phone: string;
  email: string | null;
  notes: string | null;
  isVip: boolean;
}
type Draft = Omit<Contact, "id"> & { id?: string };
const EMPTY: Draft = { name: "", nicknames: "", phone: "", email: "", notes: "", isVip: false };

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ contacts: Contact[] }>("/api/admin/contacts");
    setContacts(r.contacts);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...body } = editing;
      await api(id ? `/api/admin/contacts/${id}` : "/api/admin/contacts", { method: id ? "PUT" : "POST", json: { ...body, email: body.email || "" } });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    await api(`/api/admin/contacts/${c.id}`, { method: "DELETE" });
    load();
  };

  const filtered = contacts.filter((c) => `${c.name} ${c.nicknames} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="hud-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold tracking-wide text-cyan-100">Contacts</h3>
          <p className="text-xs text-hud-dim">Names and nicknames voice commands resolve to WhatsApp numbers. VIP contacts boost email importance.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-hud-dim" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-8" aria-label="Search contacts" />
          </div>
          <button className="hud-btn hud-btn-primary" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-hud-dim">{contacts.length ? "No matches." : "No contacts yet — add Mom, Boss, etc."}</p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="hud-label text-left">
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Nicknames</th>
                <th className="pb-2 font-normal">WhatsApp</th>
                <th className="pb-2 font-normal">Email</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-hud-line/60">
                  <td className="py-2.5 font-semibold">
                    <span className="flex items-center gap-1.5">{c.isVip && <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-label="VIP" />}{c.name}</span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-300">{c.nicknames || "—"}</td>
                  <td className="py-2.5 font-mono text-xs">{c.phone}</td>
                  <td className="py-2.5 text-xs text-slate-300">{c.email || "—"}</td>
                  <td className="py-2.5 text-right">
                    <button className="rounded p-1.5 text-hud-dim hover:text-cyan-200" onClick={() => setEditing({ ...c, email: c.email ?? "", notes: c.notes ?? "" })} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded p-1.5 text-hud-dim hover:text-rose-300" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-hud-line bg-black/25 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">{c.isVip && <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />}{c.name}</p>
                  <p className="font-mono text-xs text-cyan-200/80">{c.phone}</p>
                  {c.nicknames && <p className="truncate text-[11px] text-hud-dim">aka {c.nicknames}</p>}
                </div>
                <button className="rounded p-2 text-hud-dim" onClick={() => setEditing({ ...c, email: c.email ?? "", notes: c.notes ?? "" })} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                <button className="rounded p-2 text-hud-dim" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center" onClick={() => setEditing(null)}>
          <div className="hud-panel max-h-[90dvh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editing.id ? "Edit contact" : "Add contact"}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-cyan-100">{editing.id ? "Edit contact" : "New contact"}</h3>
              <button onClick={() => setEditing(null)} className="rounded p-1 text-hud-dim hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3">
              <Field label="Name">
                <TextInput autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Maria Stark" />
              </Field>
              <Field label="Nicknames" hint="Comma-separated: what you'd say out loud — mom, mum, mother">
                <TextInput value={editing.nicknames} onChange={(e) => setEditing({ ...editing, nicknames: e.target.value })} placeholder="mom, mum" />
              </Field>
              <Field label="WhatsApp number" hint="International format with country code">
                <TextInput value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+15551234567" inputMode="tel" />
              </Field>
              <Field label="Email (optional)">
                <TextInput value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} type="email" />
              </Field>
              <Field label="Notes (optional)">
                <TextArea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="min-h-[60px] font-sans text-sm" />
              </Field>
              <Toggle checked={editing.isVip} onChange={(v) => setEditing({ ...editing, isVip: v })} label="VIP" hint="Emails from this contact are scored higher" />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button className="hud-btn" onClick={() => setEditing(null)}>Cancel</button>
                <button className="hud-btn hud-btn-primary" onClick={save} disabled={saving || !editing.name || !editing.phone}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
