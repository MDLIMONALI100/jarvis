import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hud-panel flex min-h-0 flex-col p-4", className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/90">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </h2>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-hud-dim">{children}</p>;
}
