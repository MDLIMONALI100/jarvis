"use client";
import { Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, description, children, actions }: { title: string; description?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="hud-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold tracking-wide text-cyan-100">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-hud-dim">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="hud-label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-hud-dim">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("hud-input", props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("hud-input min-h-[96px] font-mono text-xs leading-relaxed", props.className)} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={cn("hud-input appearance-none", props.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-hud-line bg-black/20 px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-hud-dim">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition", checked ? "border-cyan-400/70 bg-cyan-500/30" : "border-slate-600 bg-slate-800")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full transition-all", checked ? "left-[22px] bg-cyan-200" : "left-0.5 bg-slate-400")} />
      </button>
    </div>
  );
}

/**
 * Secret input: shows the masked stored value as placeholder. Typing replaces
 * it; the X button clears it (sends null). Leaving it empty keeps the old value.
 */
export function SecretInput({
  value,
  masked,
  isSet,
  onChange,
  placeholder,
}: {
  value: string | null | undefined;
  masked: string;
  isSet: boolean;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const cleared = value === null;
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={cleared ? "Will be cleared on save" : isSet ? masked : (placeholder ?? "Not set")}
        className={cn("hud-input pr-16 font-mono text-xs", cleared && "border-rose-500/50")}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
        <button type="button" className="rounded p-1 text-hud-dim hover:text-cyan-200" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide" : "Show"}>
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        {(isSet || value) && (
          <button type="button" className="rounded p-1 text-hud-dim hover:text-rose-300" onClick={() => onChange(cleared ? "" : null)} aria-label="Clear stored value" title={cleared ? "Undo clear" : "Clear stored value"}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest", on ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-amber-400/40 bg-amber-500/10 text-amber-200")}>
      {children}
    </span>
  );
}
