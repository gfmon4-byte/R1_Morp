import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="mt-3 sm:mt-0">{action}</div>}
    </div>
  );
}

export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors min-h-[44px]",
            value === opt.value
              ? "bg-accent text-background"
              : "bg-surface-elevated text-muted hover:text-foreground border border-border"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
