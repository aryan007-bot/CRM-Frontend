"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { BrandMark, SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const immediate = setTimeout(update, 0);
    const t = setInterval(update, 30_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, []);
  return now;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const now = useClock();
  return (
    <div className="flex min-h-svh w-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <BrandMark />
        <Separator className="my-4" />
        <SidebarNav />
        <div className="mt-auto rounded-lg border bg-card p-3">
          <p className="text-xs font-medium">Dialing window</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Mon–Fri · 8:00–20:00 ET
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Compliance engine active
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <Clock className="size-3.5" />
              {now
                ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "--:--"}
            </span>
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-[11px]">SR</AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium lg:block">s.reyes</span>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
