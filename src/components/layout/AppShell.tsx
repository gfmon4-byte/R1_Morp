"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  CalendarDays,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/training-plan", label: "Plan", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  className,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 min-h-[44px] min-w-[44px] transition-colors",
        active
          ? "text-accent"
          : "text-muted hover:text-foreground",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={href === "/" ? pathname === "/" : pathname.startsWith(href)}
          />
        ))}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:border-r lg:border-border lg:bg-surface lg:px-4 lg:py-8">
      <div className="mb-8 px-2">
        <span className="font-display text-xl font-bold tracking-tight text-accent">
          PACELOG
        </span>
        <p className="text-xs text-muted mt-0.5">Elite Training Tracker</p>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              (href === "/" ? pathname === "/" : pathname.startsWith(href))
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-surface-elevated hover:text-foreground"
            )}
            aria-current={
              (href === "/" ? pathname === "/" : pathname.startsWith(href))
                ? "page"
                : undefined
            }
          >
            {(() => {
              const Icon = icon;
              return <Icon className="h-5 w-5" />;
            })()}
            {label === "Runs" ? "Run History" : label === "Plan" ? "Training Plan" : label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md px-4 py-3 lg:hidden">
          <span className="font-display text-lg font-bold tracking-tight text-accent">
            PACELOG
          </span>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 lg:pb-8 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
