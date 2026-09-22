"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

function GuardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/**
 * Client-side guard for the console. It redirects unauthenticated visitors for
 * UX only — every API call is still authorized by the backend.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || user) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [loading, user, router, pathname]);

  if (loading) return <GuardSkeleton />;
  if (!user) return <GuardSkeleton />;

  return <>{children}</>;
}
