"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type AsyncFn<TArgs extends unknown[], TResult> = (
  signal: AbortSignal,
  ...args: TArgs
) => Promise<TResult>;

type UseDebouncedAbortableAsyncOptions<TResult> = {
  debounceMs: number;
  onStart?: () => void;
  onSuccess?: (result: TResult) => void;
  onError?: (error: unknown) => void;
  onFinally?: () => void;
};

function isAbortError(err: unknown) {
  return (
    err instanceof DOMException
      ? err.name === "AbortError"
      : typeof err === "object" &&
        err !== null &&
        "name" in err &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any).name === "AbortError"
  );
}

/**
 * Debounce + Abort + "solo aplica el último" para funciones async.
 *
 * - Cada llamada aborta la anterior (incluyendo requests en progreso).
 * - Debouncea la ejecución (pero dispara `onStart` inmediatamente, útil para loading).
 * - Solo el último request puede invocar `onSuccess/onFinally`.
 */
export function useDebouncedAbortableAsync<TArgs extends unknown[], TResult>(
  fn: AsyncFn<TArgs, TResult>,
  options: UseDebouncedAbortableAsyncOptions<TResult>
) {
  const fnRef = useRef(fn);
  const debounceMsRef = useRef(options.debounceMs);
  const onStartRef = useRef(options.onStart);
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  const onFinallyRef = useRef(options.onFinally);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    debounceMsRef.current = options.debounceMs;
    onStartRef.current = options.onStart;
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
    onFinallyRef.current = options.onFinally;
  }, [options.debounceMs, options.onStart, options.onSuccess, options.onError, options.onFinally]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, [cancel]);

  const execute = useCallback(async (controller: AbortController, requestId: number, args: TArgs) => {
    try {
      const result = await fnRef.current(controller.signal, ...args);
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      onSuccessRef.current?.(result);
      return result;
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return null;
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      onErrorRef.current?.(err);
      return null;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        onFinallyRef.current?.();
      }
    }
  }, []);

  const run = useCallback(
    (...args: TArgs) => {
      onStartRef.current?.();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void execute(controller, requestId, args);
      }, debounceMsRef.current);
    },
    [execute]
  );

  const runNow = useCallback(
    (...args: TArgs) => {
      onStartRef.current?.();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      void execute(controller, requestId, args);
    },
    [execute]
  );

  return useMemo(() => ({ run, runNow, cancel }), [run, runNow, cancel]);
}

