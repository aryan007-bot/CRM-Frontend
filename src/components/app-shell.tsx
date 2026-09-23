"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BrandMark, SidebarNav } from "@/components/sidebar-nav";
import { ControlPlaneHeader } from "@/components/phase4/control-plane-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";

function OrganizationPanel() {
  const profile = useApi(() => api.getProfile(), []);

  if (!profile.data) return null;

  return (
    <div className="mt-auto rounded-lg border bg-card p-3">
      <p className="text-xs font-medium">{profile.data.organization_name}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Signed in as {profile.data.role.replace(/_/g, " ").toLowerCase()}
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    toast.success("Signed out.");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-svh w-full">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
        <BrandMark />
        <Separator className="my-4" />
        <SidebarNav />
        <OrganizationPanel />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          {/* Mobile navigation */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 px-3 py-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <BrandMark />
              <Separator className="my-4" />
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="md:hidden">
            <span className="text-sm font-semibold">Recovery CRM</span>
          </div>

          {/* Phase 4 control-plane status strip (env badge, health, alerts). */}
          <ControlPlaneHeader />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[11px]">
                      {initials(user?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium sm:block">{user?.email ?? "—"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium">{user?.name ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {user?.primary_role?.replace(/_/g, " ") ?? ""}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserRound className="size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleLogout()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
