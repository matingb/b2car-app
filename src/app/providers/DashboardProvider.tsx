"use client";

import { logger } from "@/lib/logger";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type DashboardStats = {
	totals?: {
		clientes?: number;
		vehiculos?: number;
		arreglos?: number;
		montoIngresos?: number;
		arreglosEsteMes?: number;
		gastos?: number;
		balance?: number;
	};
    recentActivities?: Array<{
        id: string;
        titulo: string;
        vehiculo: string;
        fechaUltimaActualizacion: string;
        monto: number;
    }>;
	arreglos?: {
        tipos?: {
            tipos: string[];
            cantidad: number[];
            ingresos: number[];
        };
        total?: number;
		cobrados?: number;
		pendientes?: number;
	};
    clientes?: {
        nuevosEsteMes?: {
            dias: string[];
            valor: number[];
        };
    };
	arreglosPorPeriodo?: Array<{ label: string; cantidad: number }>;
	ingresosPorPeriodo?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
	gastosPorPeriodo?: Array<{ label: string; repuestos: number; sueldos: number }>;
	lastUpdatedAt?: string;
	[key: string]: unknown;
};

type DashboardStatsApiResponse = {
	data: DashboardStats | null;
	error?: string | null;
};

type FetchStatsOptions = { from?: string; to?: string; tallerId?: string };

type DashboardContextType = {
	stats: DashboardStats | null;
	loading: boolean;
	error: string | null;
	fetchStats: (options?: FetchStatsOptions) => Promise<DashboardStats | null>;
	refresh: (options?: FetchStatsOptions) => Promise<DashboardStats | null>;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchStats = useCallback(async (options?: FetchStatsOptions) => {
		const startTime = performance.now();
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			if (options?.from) params.set("from", options.from);
			if (options?.to) params.set("to", options.to);
			if (options?.tallerId) params.set("tallerId", options.tallerId);
			const qs = params.size > 0 ? `?${params.toString()}` : "";
			const res = await fetch(`/api/dashboard/stats${qs}`);
			const body: Partial<DashboardStatsApiResponse> = await res
				.json()
				.catch(() => ({}));

			if (!res.ok || body?.error) {
				throw new Error(body?.error || `Error ${res.status}`);
			}

			const next = (body as DashboardStatsApiResponse).data ?? null;
			setStats(next);
			return next;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error cargando dashboard";
			setError(message);
			setStats(null);
			return null;
		} finally {
			const elapsedMs = performance.now() - startTime;
			logger.debug(`Fetched dashboard stats in ${elapsedMs.toFixed(1)}ms`);
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	const value = useMemo<DashboardContextType>(
		() => ({
			stats,
			loading,
			error,
			fetchStats,
			refresh: fetchStats,
		}),
		[stats, loading, error, fetchStats]
	);

	return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
	const ctx = useContext(DashboardContext);
	if (!ctx) throw new Error("useDashboard debe usarse dentro de DashboardProvider");
	return ctx;
}

