import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface-elevated p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-sm font-semibold uppercase tracking-wider text-muted", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function StatCard({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="font-display text-2xl font-bold font-tabular text-foreground">
        {value}
      </span>
      {(sub || trend) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "font-medium",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-danger",
                trend.direction === "flat" && "text-muted"
              )}
            >
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
              {trend.text}
            </span>
          )}
          {sub && <span className="text-muted">{sub}</span>}
        </div>
      )}
    </Card>
  );
}
