"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  Handshake,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Radio,
  Settings2,
  ShieldAlert,
  Server,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavSection {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
  }[];
}

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/creditors", label: "Creditors", icon: Landmark },
      { href: "/imports", label: "Imports", icon: FileSpreadsheet },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/recovery", label: "Recovery Queue", icon: ListOrdered },
      { href: "/live-calls", label: "Live Calls", icon: Radio },
      { href: "/call-analysis", label: "Call Analysis", icon: BrainCircuit },
    ],
  },
  {
    title: "RECOVERY",
    items: [
      { href: "/recovery/ptp", label: "Promise to Pay", icon: Handshake },
      { href: "/recovery/callbacks", label: "Callbacks", icon: CalendarClock },
      { href: "/recovery/payments", label: "Payments", icon: Wallet },
      { href: "/recovery/disputes", label: "Disputes", icon: ShieldAlert },
      { href: "/recovery/escalations", label: "Escalations", icon: ShieldAlert },
    ],
  },
  {
    title: "AUTOMATION",
    items: [
      { href: "/automation", label: "Automation", icon: Bot },
      { href: "/automation/rules", label: "Follow-up Rules", icon: Settings2 },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { href: "/analytics/recovery", label: "Recovery Analytics", icon: BarChart3 },
      { href: "/analytics/campaigns", label: "Campaign Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "VOICE & TELEPHONY",
    items: [
      { href: "/ai-agents", label: "AI Agents", icon: Bot },
      { href: "/telephony", label: "Telephony & AI Status", icon: Server },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { href: "/profile", label: "Profile", icon: UserRound },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // /recovery must not swallow /recovery/ptp etc., so only treat exact or
  // child paths as active for leaf items.
  if (href === "/recovery") return pathname === "/recovery";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 overflow-y-auto pr-1">
      {SECTIONS.map((section, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          {section.title ? (
            <p className="px-3 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1 py-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 className="size-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Recovery CRM</span>
        <span className="block text-[11px] text-muted-foreground">
          Phase 3 · Recovery Operations
        </span>
      </span>
    </Link>
  );
}
