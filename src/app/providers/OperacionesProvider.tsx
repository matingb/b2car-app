"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { operacionesClient, CreateOperacionInput, UpdateOperacionInput, OperacionesStats } from "@/clients/operacionesClient";
import type { Operacion, OperacionesFilters, TipoOperacion } from "@/model/types";
import { useDebouncedAbortableAsync } from "@/app/hooks/useDebouncedAbortableAsync";

type OperacionesContextType = {
	operaciones: Operacion[];
	stats: OperacionesStats | null;
	loading: boolean;
	selectedTipos: TipoOperacion[];
	setSelectedTipos: React.Dispatch<React.SetStateAction<TipoOperacion[]>>;
	fetchById: (id: string | number) => Promise<Operacion | null>;
	fetchStats: (filters?: OperacionesFilters) => Promise<OperacionesStats | null>;
	create: (input: CreateOperacionInput) => Promise<Operacion | null>;
	update: (id: string | number, input: UpdateOperacionInput) => Promise<Operacion | null>;
	remove: (id: string | number) => Promise<void>;
};

const OperacionesContext = createContext<OperacionesContextType | null>(null);

export function OperacionesProvider({ children }: { children: React.ReactNode }) {
	const [operaciones, setOperaciones] = useState<Operacion[]>([]);
	const [stats, setStats] = useState<OperacionesStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [selectedTipos, setSelectedTipos] = useState<TipoOperacion[]>([]);

	const prevSelectedTiposRef = useRef<TipoOperacion[] | null>(null);

	const fetchAllCore = useCallback(async (signal: AbortSignal, filters?: OperacionesFilters) => {
		const hasFilters = Boolean(
			filters?.fecha ||
				filters?.from ||
				filters?.to ||
				(Array.isArray(filters?.tipo) && filters.tipo.length > 0)
		);

		const response = await operacionesClient.getAll(hasFilters ? (filters ?? {}) : undefined, {
			signal,
		});
		if (response?.error) throw new Error(response.error);
		return response?.data ?? [];
	}, []);

	const fetchAll = useDebouncedAbortableAsync(fetchAllCore, {
		debounceMs: 500,
		onStart: () => setLoading(true),
		onSuccess: (data) => setOperaciones(data),
		onFinally: () => setLoading(false),
	});

	useEffect(() => {
		if (prevSelectedTiposRef.current === null) {
			prevSelectedTiposRef.current = selectedTipos;
			return;
		}
		if (prevSelectedTiposRef.current === selectedTipos) return;
		prevSelectedTiposRef.current = selectedTipos;

		const filters: OperacionesFilters | undefined =
			selectedTipos.length > 0 ? { tipo: selectedTipos } : undefined;
		fetchAll.run(filters);
	}, [selectedTipos, fetchAll]);

	const fetchById = useCallback(async (id: string | number) => {
		setLoading(true);
		try {
			const response = await operacionesClient.getById(id);
			if (response?.error) throw new Error(response.error);
			return response?.data ?? null;
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchStats = useCallback(async (filters?: OperacionesFilters) => {
		setLoading(true);
		try {
			const response = await operacionesClient.getStats(filters);
			if (response?.error) throw new Error(response.error);
			const next = response?.data ?? null;
			setStats(next);
			return next;
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAll.runNow();
		void fetchStats();
	}, [fetchAll, fetchStats]);

	const create = useCallback(async (input: CreateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.create(input);
			if (response?.error) throw new Error(response.error);
			const operacion = response?.data ?? null;
			if (operacion) {
				setOperaciones((prev) => [...prev, operacion]);
			}
			return operacion;
		} finally {
			setLoading(false);
		}
	}, []);

	const update = useCallback(async (id: string | number, input: UpdateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.update(id, input);
			if (response?.error) throw new Error(response.error);
			if (response?.data) {
				const updated = response.data;
				setOperaciones((prev) => prev.map((o) => (o.id === id ? updated : o)));
			}
			return response?.data ?? null;
		} finally {
			setLoading(false);
		}
	}, []);

	const remove = useCallback(async (id: string | number) => {
		setLoading(true);
		try {
			const { error } = await operacionesClient.delete(id);
			if (error) throw new Error(error);
			setOperaciones((prev) => prev.filter((o) => o.id !== id));
		} finally {
			setLoading(false);
		}
	}, []);

	const value = useMemo(
		() => ({
			operaciones,
			stats,
			loading,
			selectedTipos,
			setSelectedTipos,
			fetchById,
			fetchStats,
			create,
			update,
			remove,
		}),
		[operaciones, stats, loading, selectedTipos, fetchById, fetchStats, create, update, remove]
	);

	return <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>;
}

export function useOperaciones() {
	const ctx = useContext(OperacionesContext);
	if (!ctx) throw new Error("useOperaciones debe usarse dentro de OperacionesProvider");
	return ctx;
}
