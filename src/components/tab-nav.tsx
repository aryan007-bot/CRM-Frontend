"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabItem {
  href: string;
  label: string;
}

/**
 * Underlined sub-navigation used across campaign detail tabs. Renders plain
 * links so tabs are bookmarkable and keyboard-navigable.
 */
export function TabNav({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-1 overflow-x-auto border-b", className)} aria-label="Sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
