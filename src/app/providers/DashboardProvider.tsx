"use client";

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
	};
    recentActivities?: Array<{
        id: string;
        titulo: string;
        vehiculo: string;
        fechaUltimaActualizacion: string; // ISO
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
    clientes?:{
        nuevosEsteMes?: {
            dias: string[],
            valor: number[];
        }
    }
	ingresos?: {
		mesActual?: number;
		total?: number;
		moneda?: string;
	};
	lastUpdatedAt?: string;
	// Permite extender desde el backend sin romper el tipado del frontend
	[key: string]: unknown;
};

type DashboardStatsApiResponse = {
	data: DashboardStats | null;
	error?: string | null;
};

type DashboardContextType = {
	stats: DashboardStats | null;
	loading: boolean;
	error: string | null;
	fetchStats: () => Promise<DashboardStats | null>;
	refresh: () => Promise<DashboardStats | null>;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchStats = useCallback(async () => {
		const startTime = performance.now();
		setLoading(true);
		setError(null);
		try {

			const res = await fetch("/api/dashboard/stats");
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
			console.log(`dashboard fetchStats: ${elapsedMs.toFixed(1)}ms`);
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

