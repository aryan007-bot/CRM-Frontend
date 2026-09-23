"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle as AlertTriangleIcon,
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  CloudCog,
  Cpu,
  Database,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  Handshake,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Radio,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Server,
  Sparkles,
  UserRound,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Capability } from "@/lib/capabilities";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** When set, the item renders only for roles holding the capability. */
  capability?: Capability;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Phase 4 control-plane sections — rendered only for authorized roles. */
const PHASE4_SECTIONS: NavSection[] = [
  {
    title: "OPERATIONS",
    items: [
      { href: "/system", label: "System Overview", icon: Activity, capability: "system.read" },
      { href: "/operations", label: "Live Operations", icon: Radio, capability: "system.read" },
      { href: "/operations/events", label: "Event Stream", icon: ScrollText, capability: "system.read" },
    ],
  },
  {
    title: "INFRASTRUCTURE",
    items: [
      { href: "/infrastructure/services", label: "Services", icon: Server, capability: "infrastructure.read" },
      { href: "/infrastructure/workers", label: "Workers", icon: Cpu, capability: "worker.read" },
      { href: "/infrastructure/queues", label: "Queues", icon: Workflow, capability: "queue.read" },
      { href: "/infrastructure/telephony", label: "Telephony", icon: Radio, capability: "infrastructure.read" },
      { href: "/infrastructure/database", label: "Database", icon: Database, capability: "infrastructure.read" },
      { href: "/infrastructure/capacity", label: "Capacity", icon: Gauge, capability: "infrastructure.read" },
      { href: "/infrastructure/logs", label: "Logs", icon: ScrollText, capability: "infrastructure.read" },
      { href: "/infrastructure/api-usage", label: "API Usage", icon: BarChart3, capability: "infrastructure.read" },
      { href: "/infrastructure/environments", label: "Environments", icon: CloudCog, capability: "deployment.read" },
      { href: "/infrastructure/performance", label: "Performance", icon: Activity, capability: "infrastructure.read" },
    ],
  },
  {
    title: "AI PLATFORM",
    items: [
      { href: "/ai/infrastructure", label: "AI Infrastructure", icon: Sparkles, capability: "ai_provider.read" },
      { href: "/ai/providers", label: "Providers", icon: Bot, capability: "ai_provider.read" },
      { href: "/ai/models", label: "Models", icon: BrainCircuit, capability: "ai_model.read" },
      { href: "/ai/routing", label: "Routing", icon: Workflow, capability: "ai_routing.read" },
      { href: "/ai/usage", label: "Quota & Usage", icon: BarChart3, capability: "usage.read" },
      { href: "/ai/voice", label: "Voice Services", icon: Radio, capability: "ai_provider.read" },
    ],
  },
  {
    title: "RELIABILITY",
    items: [
      { href: "/reliability/incidents", label: "Incidents", icon: ShieldAlert, capability: "incident.read" },
      { href: "/reliability/alerts", label: "Alerts", icon: AlertTriangleIcon, capability: "alert.read" },
      { href: "/reliability/jobs", label: "Failed Jobs", icon: ListOrdered, capability: "queue.read" },
    ],
  },
  {
    title: "DEPLOYMENT",
    items: [
      { href: "/deployments", label: "Deployments", icon: GitBranch, capability: "deployment.read" },
    ],
  },
  {
    title: "SECURITY",
    items: [
      { href: "/security/events", label: "Security Events", icon: ShieldCheck, capability: "security.read" },
      { href: "/audit", label: "Audit Log", icon: ScrollText, capability: "audit.read" },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { href: "/settings/system", label: "System Settings", icon: Settings2, capability: "configuration.read" },
    ],
  },
];

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
  const { user } = useAuth();
  const roles = user?.roles;

  const visible = (item: NavItem) => !item.capability || can(item.capability, roles);
  const phase4 = PHASE4_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(visible),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-4 overflow-y-auto pr-1">
      {[...SECTIONS, ...phase4].map((section, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          {section.title ? (
            <p className="px-3 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
          ) : null}
          {section.items.filter(visible).map((item) => {
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
          Recovery Operations · Control Plane
        </span>
      </span>
    </Link>
  );
}
