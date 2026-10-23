"use client";

import { logger } from "@/lib/logger";
import { periodKey } from "@/lib/dashboard/periods";
import type { DashboardPeriodo, DashboardRange, DashboardStats } from "@/lib/dashboard/types";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type { DashboardStats } from "@/lib/dashboard/types";

type ApiResponse<T> = {
	data: T | null;
	error?: string | null;
};

type FetchStatsOptions = { from?: string; to?: string };

/** Estado de carga de un período a comparar, independiente del período base y de los demás. */
export type PeriodoEntry =
	| { status: "loading"; data: null; error: null }
	| { status: "ready"; data: DashboardPeriodo; error: null }
	| { status: "error"; data: null; error: string };

type DashboardContextType = {
	stats: DashboardStats | null;
	loading: boolean;
	error: string | null;
	fetchStats: (options?: FetchStatsOptions) => Promise<DashboardStats | null>;
	refresh: (options?: FetchStatsOptions) => Promise<DashboardStats | null>;
	/** Períodos a comparar ya pedidos, por `periodKey`. */
	periodos: Record<string, PeriodoEntry>;
	/** Pide el período si todavía no se pidió; no reintenta los que fallaron. */
	ensurePeriodo: (range: DashboardRange) => void;
	/** Vuelve a pedir el período aunque ya esté cargado o haya fallado. */
	reloadPeriodo: (range: DashboardRange) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
	const res = await fetch(url, { signal });
	const body: Partial<ApiResponse<T>> = await res.json().catch(() => ({}));
	if (!res.ok || body?.error) {
		throw new Error(body?.error || `Error ${res.status}`);
	}
	return (body as ApiResponse<T>).data ?? null;
}

function rangeQuery(range: { from?: string; to?: string }): string {
	const params = new URLSearchParams();
	if (range.from) params.set("from", range.from);
	if (range.to) params.set("to", range.to);
	return params.size > 0 ? `?${params.toString()}` : "";
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const statsController = useRef<AbortController | null>(null);

	const [periodos, setPeriodos] = useState<Record<string, PeriodoEntry>>({});
	// Copia síncrona del estado: evita pedir dos veces el mismo período antes de que React re-renderice.
	const periodosRef = useRef<Record<string, PeriodoEntry>>({});
	const periodoControllers = useRef(new Map<string, AbortController>());

	useEffect(() => {
		const controllers = periodoControllers.current;
		return () => {
			statsController.current?.abort();
			controllers.forEach((controller) => controller.abort());
		};
	}, []);

	const fetchStats = useCallback(async (options?: FetchStatsOptions) => {
		// Solo vale la respuesta del último pedido: si el usuario cambia de mes antes de que llegue la
		// anterior, esa se cancela y nunca pisa los datos del mes nuevo.
		statsController.current?.abort();
		const controller = new AbortController();
		statsController.current = controller;

		const startTime = performance.now();
		setLoading(true);
		setError(null);
		try {
			const next = await fetchJson<DashboardStats>(
				`/api/dashboard/stats${rangeQuery(options ?? {})}`,
				controller.signal,
			);
			if (controller.signal.aborted) return null;
			setStats(next);
			return next;
		} catch (err: unknown) {
			if (controller.signal.aborted) return null;
			const message = err instanceof Error ? err.message : "Error cargando dashboard";
			setError(message);
			setStats(null);
			return null;
		} finally {
			if (statsController.current === controller) {
				statsController.current = null;
				const elapsedMs = performance.now() - startTime;
				logger.debug(`Fetched dashboard stats in ${elapsedMs.toFixed(1)}ms`);
				setLoading(false);
			}
		}
	}, []);

	const setPeriodo = useCallback((key: string, entry: PeriodoEntry) => {
		periodosRef.current = { ...periodosRef.current, [key]: entry };
		setPeriodos(periodosRef.current);
	}, []);

	const loadPeriodo = useCallback(
		async (range: DashboardRange) => {
			const key = periodKey(range);
			periodoControllers.current.get(key)?.abort();
			const controller = new AbortController();
			periodoControllers.current.set(key, controller);
			setPeriodo(key, { status: "loading", data: null, error: null });

			try {
				const data = await fetchJson<DashboardPeriodo>(
					`/api/dashboard/periodo${rangeQuery(range)}`,
					controller.signal,
				);
				if (controller.signal.aborted) return;
				if (!data) throw new Error("Respuesta vacía al cargar el período");
				setPeriodo(key, { status: "ready", data, error: null });
			} catch (err: unknown) {
				if (controller.signal.aborted) return;
				const message = err instanceof Error ? err.message : "Error cargando el período";
				logger.error("Error cargando período del dashboard", message);
				setPeriodo(key, { status: "error", data: null, error: message });
			} finally {
				if (periodoControllers.current.get(key) === controller) periodoControllers.current.delete(key);
			}
		},
		[setPeriodo],
	);

	const ensurePeriodo = useCallback(
		(range: DashboardRange) => {
			if (periodosRef.current[periodKey(range)]) return;
			void loadPeriodo(range);
		},
		[loadPeriodo],
	);

	const reloadPeriodo = useCallback(
		(range: DashboardRange) => {
			void loadPeriodo(range);
		},
		[loadPeriodo],
	);

	const value = useMemo<DashboardContextType>(
		() => ({
			stats,
			loading,
			error,
			fetchStats,
			refresh: fetchStats,
			periodos,
			ensurePeriodo,
			reloadPeriodo,
		}),
		[stats, loading, error, fetchStats, periodos, ensurePeriodo, reloadPeriodo]
	);

	return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
	const ctx = useContext(DashboardContext);
	if (!ctx) throw new Error("useDashboard debe usarse dentro de DashboardProvider");
	return ctx;
}
