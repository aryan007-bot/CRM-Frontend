"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Error code from the backend envelope, e.g. "RESOURCE_NOT_FOUND". */
  errorCode: string | null;
  refresh: () => void;
}

/**
 * Data-fetching hook.
 *
 * - `loading` is true until the first response for a given dependency set.
 * - Refetching after a mutation keeps the previous data on screen, so lists do
 *   not flash empty.
 * - Passing `null` as the function skips the request (used for conditional
 *   fetches such as a missing route param).
 */
export function useApi<T>(
  fn: (() => Promise<T>) | null,
  deps: unknown[] = [],
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(fn !== null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);

  // Keep the latest callback without writing to the ref during render.
  // Declared before the fetch effect so it runs first on every commit.
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    const current = fnRef.current;
    if (!current) {
      setData(null);
      setLoading(false);
      setError(null);
      setErrorCode(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const result = await current();
        if (!cancelled) {
          setData(result);
          setError(null);
          setErrorCode(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Something went wrong. Try again.",
          );
          setErrorCode(err instanceof ApiError ? err.code : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, errorCode, refresh };
}
