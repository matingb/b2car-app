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
            cantidad: [12000, 8000, 5000, 3000, 1487],
        },
        total: 31487,
        cobrados: 27884,
        pendientes: 3603,
    },
    clientes: {
        nuevosEsteMes: {
            dias: ['01/05', '02/05', '03/05', '04/05', '05/05', '06/05', '07/05', '08/05', '09/05', '10/05', '11/05', '12/05', '13/05', '14/05', '15/05', '16/05', '17/05', '18/05', '19/05', '20/05', '21/05', '22/05', '23/05', '24/05', '25/05', '26/05', '27/05', '28/05', '29/05', '30/05', '31/05'],
            valor: [10, 20, 17, 25, 7, 6, 8, 5, 9, 12, 15, 11, 14, 0, 10, 12, 4, 13, 7, 5, 10, 4, 1, 4, 0, 7, 9, 12, 4, 7, 0],
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

