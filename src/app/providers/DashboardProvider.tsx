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
	arreglos?: {
        tipos?: {
            tipos: string[];
            cantidad: number[];
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

const mockData = {
    totals: {
        clientes: 1450,
        vehiculos: 2193,
        arreglos: 31487,
        montoIngresos: 7500548.28,
    },
    arreglos: {
        tipos: {
            tipos: ['Mantenimiento', 'Reparacion', 'Inspeccion', 'Electricidad', 'Otros'],
            cantidad: [200, 150, 100, 75, 25],
        },
        total: 450,
        cobrados: 300,
        pendientes: 150,
    },
    clientes: {
        nuevosEsteMes: {
            dias: ['01', '05', '10', '15', '20', '25', '30'],
            valor: [100, 150, 200, 250, 300, 350, 400],
        },
    },
}

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
		setLoading(true);
		setError(null);
		try {
			// API route aún no implementado: este provider asume que existirá en /api/dashboard/stats
			const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
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
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		//fetchStats();
        setStats(mockData);
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

