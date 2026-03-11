"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { GetFormularioConfigResponse } from "@/app/api/arreglos/formularios/route";
import type { FormularioConfigItem } from "@/app/api/arreglos/formularios/formularioService";
import { logger } from "@/lib/logger";

type FormulariosContextType = {
	formularios: FormularioConfigItem[];
	loading: boolean;
	fetchAll: () => Promise<FormularioConfigItem[] | null>;
};

const FormulariosContext = createContext<FormulariosContextType | null>(null);

export function FormulariosProvider({ children }: { children: React.ReactNode }) {
	const [formularios, setFormularios] = useState<FormularioConfigItem[]>([]);
	const [loading, setLoading] = useState(false);

	const fetchAll = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/arreglos/formularios", {
				method: "GET",
			});

			const body: GetFormularioConfigResponse = await response.json();
			if (!response.ok || body.error) {
				throw new Error(body.error || `Error ${response.status}`);
			}

			setFormularios(body.data ?? []);
			return body.data ?? null;
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchAll();
	}, [fetchAll]);

	const value = useMemo(
		() => ({
			formularios,
			loading,
			fetchAll,
		}),
		[formularios, loading, fetchAll]
	);

	return (
		<FormulariosContext.Provider value={value}>
			{children}
		</FormulariosContext.Provider>
	);
}

export function useFormularios() {
	const ctx = useContext(FormulariosContext);
	if (!ctx) {
		throw new Error("useFormularios debe usarse dentro de FormulariosProvider");
	}
	return ctx;
}

