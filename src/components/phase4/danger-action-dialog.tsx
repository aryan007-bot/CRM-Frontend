"use client";

/**
 * Dangerous-action confirmation for the control plane (spec §46).
 *
 * The dialog spells out exactly what will happen, where, and from what state —
 * never a generic "Are you sure?". Production environments get the persistent
 * environment notice inline.
 */

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isProductionEnvironment } from "@/lib/phase4-format";

export interface DangerActionContext {
  /** What the action will do, e.g. "Stop accepting new jobs and finish current ones". */
  consequence: string;
  /** Affected service/worker/queue name. */
  target: string;
  environment?: string | null;
  /** Current backend state of the target, e.g. "Healthy". */
  currentState?: string | null;
}

export function DangerActionDialog({
  open,
  onOpenChange,
  actionLabel,
  context,
  onConfirm,
  loading = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The requested action, e.g. "Drain worker". */
  actionLabel: string;
  context: DangerActionContext;
  onConfirm: () => void;
  loading?: boolean;
  /** Optional extra content (e.g. a configuration diff) above the footer. */
  children?: React.ReactNode;
}) {
  const production = isProductionEnvironment(context.environment);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionLabel}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>{context.consequence}</p>
              <dl className="rounded-md border bg-muted/40 p-3 text-xs">
                <div className="flex justify-between gap-3 py-0.5">
                  <dt className="text-muted-foreground">Target</dt>
                  <dd className="font-medium">{context.target}</dd>
                </div>
                <div className="flex justify-between gap-3 py-0.5">
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="font-medium">{context.environment ?? "—"}</dd>
                </div>
                {context.currentState ? (
                  <div className="flex justify-between gap-3 py-0.5">
                    <dt className="text-muted-foreground">Current state</dt>
                    <dd className="font-medium">{context.currentState}</dd>
                  </div>
                ) : null}
              </dl>
              {production ? (
                <p className="rounded-md border border-amber-600/40 bg-amber-600/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  You are changing production configuration. This takes effect for live traffic.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
