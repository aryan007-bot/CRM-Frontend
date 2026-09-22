"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableMessage({
  columns,
  icon: Icon,
  title,
  description,
  action,
}: {
  columns: number;
  icon: typeof Inbox;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-40 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center">
      {icon ? icon : <Inbox className="size-6 text-muted-foreground" aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Inline error surface — never renders a raw exception or stack trace. */
export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span>{message}</span>
        {onRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 px-2">
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <div>
        <p className="text-sm font-medium text-destructive">Could not load this data</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
