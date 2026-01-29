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

	type FetchAllResult = {
		operaciones: Operacion[];
		stats?: OperacionesStats | null;
	};

	const refreshCore = useCallback(async (signal: AbortSignal, filters?: OperacionesFilters): Promise<FetchAllResult> => {
		const hasFilters = Boolean(
			filters?.fecha ||
				filters?.from ||
				filters?.to ||
				(Array.isArray(filters?.tipo) && filters.tipo.length > 0)
		);

		const normalizedFilters = hasFilters ? (filters ?? {}) : undefined;

		const [listRes, statsRes] = await Promise.all([
			operacionesClient.getAll(normalizedFilters, { signal }),
			operacionesClient.getStats(filters, { signal }),
		]);

		if (listRes?.error) throw new Error(listRes.error);

		return {
			operaciones: listRes?.data ?? [],
			stats: statsRes?.data ?? null,
		};
	}, []);

	const refreshDebounced = useDebouncedAbortableAsync(refreshCore, {
		debounceMs: 500,
		onStart: () => setLoading(true),
		onSuccess: (data) => {
			setOperaciones(data.operaciones);
			if (data.stats !== undefined) setStats(data.stats);
		},
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
		refreshDebounced.run(filters);
	}, [selectedTipos, refreshDebounced]);

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

	const getCurrentFilters = useCallback((): OperacionesFilters | undefined => {
		return selectedTipos.length > 0 ? { tipo: selectedTipos } : undefined;
	}, [selectedTipos]);

	const refresh = useCallback(
		async (filters?: OperacionesFilters) => {
			setLoading(true);
			try {
				const controller = new AbortController();
				const data = await refreshCore(controller.signal, filters);
				setOperaciones(data.operaciones);
				if (data.stats !== undefined) setStats(data.stats);
				return data;
			} finally {
				setLoading(false);
			}
		},
		[refreshCore]
	);

	useEffect(() => {
		refreshDebounced.runNow();
	}, [refreshDebounced]);

	const create = useCallback(async (input: CreateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.create(input);
			if (response?.error) throw new Error(response.error);
			const operacion = response?.data ?? null;
			try { await refresh(getCurrentFilters()); } catch { /* ignore */ }
			return operacion;
		} finally {
			setLoading(false);
		}
	}, [getCurrentFilters, refresh]);

	const update = useCallback(async (id: string | number, input: UpdateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.update(id, input);
			if (response?.error) throw new Error(response.error);
			const updated = response?.data ?? null;

			try { await refresh(getCurrentFilters()); } catch { /* ignore */ }

			return updated;
		} finally {
			setLoading(false);
		}
	}, [getCurrentFilters, refresh]);

	const remove = useCallback(async (id: string | number) => {
		setLoading(true);
		try {
			const { error } = await operacionesClient.delete(id);
			if (error) throw new Error(error);
			try {
				await refresh(getCurrentFilters());
			} catch { /* ignore */ }
		} finally {
			setLoading(false);
		}
	}, [getCurrentFilters, refresh]);

	const value = useMemo(
		() => ({
			operaciones,
			stats,
			loading,
			selectedTipos,
			setSelectedTipos,
			fetchById,
			create,
			update,
			remove,
		}),
		[operaciones, stats, loading, selectedTipos, fetchById, create, update, remove]
	);

	return <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>;
}

export function useOperaciones() {
	const ctx = useContext(OperacionesContext);
	if (!ctx) throw new Error("useOperaciones debe usarse dentro de OperacionesProvider");
	return ctx;
}
