"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
	operacionesClient,
	type CreateOperacionInput,
	type UpdateOperacionInput,
	type OperacionesPagination,
	type OperacionesStats,
	OPERACIONES_PAGE_SIZE,
} from "@/clients/operacionesClient";
import type { Operacion, OperacionesFilters, TipoOperacion } from "@/model/types";
import { useDebouncedAbortableAsync } from "@/app/hooks/useDebouncedAbortableAsync";
import { buildPeriodOptions, type PeriodOption } from "@/app/components/dashboard/PeriodSelector";

export type OperacionesPeriod = PeriodOption;

type OperacionesContextType = {
	operaciones: Operacion[];
	stats: OperacionesStats | null;
	loading: boolean;
	selectedTipos: TipoOperacion[];
	setSelectedTipos: React.Dispatch<React.SetStateAction<TipoOperacion[]>>;
	period: OperacionesPeriod;
	setPeriod: (period: OperacionesPeriod) => void;
	pagination: OperacionesPagination;
	hasMore: boolean;
	loadMore: () => void;
	fetchById: (id: string | number) => Promise<Operacion | null>;
	create: (input: CreateOperacionInput) => Promise<Operacion | null>;
	update: (id: string | number, input: UpdateOperacionInput) => Promise<Operacion | null>;
	remove: (id: string | number) => Promise<void>;
};

const OperacionesContext = createContext<OperacionesContextType | null>(null);

function getCurrentMonthPeriod(): OperacionesPeriod {
	return buildPeriodOptions(1)[0];
}

export function OperacionesProvider({ children }: { children: React.ReactNode }) {
	const [operaciones, setOperaciones] = useState<Operacion[]>([]);
	const [stats, setStats] = useState<OperacionesStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [selectedTiposState, setSelectedTiposState] = useState<TipoOperacion[]>([]);
	const [period, setPeriodState] = useState<OperacionesPeriod>(getCurrentMonthPeriod);
	const [page, setCurrentPage] = useState(1);
	const [reloadVersion, setReloadVersion] = useState(0);
	const [pagination, setPagination] = useState<OperacionesPagination>({
		page: 1,
		pageSize: OPERACIONES_PAGE_SIZE,
		total: 0,
	});

	type FetchPageResult = {
		operaciones: Operacion[];
		stats: OperacionesStats | null;
		pagination: OperacionesPagination;
	};

	const activeFilters = useMemo<OperacionesFilters>(() => ({
		from: period.from,
		to: period.to,
		...(selectedTiposState.length > 0 ? { tipo: selectedTiposState } : {}),
	}), [period.from, period.to, selectedTiposState]);

	const refreshCore = useCallback(async (
		signal: AbortSignal,
		filters: OperacionesFilters,
		targetPage: number,
	): Promise<FetchPageResult> => {
		const [listRes, statsRes] = await Promise.all([
			operacionesClient.getAll(filters, { signal, page: targetPage }),
			operacionesClient.getStats(filters, { signal }),
		]);

		if (listRes?.error) throw new Error(listRes.error);

		return {
			operaciones: listRes?.data ?? [],
			stats: statsRes?.data ?? null,
			pagination: listRes?.pagination ?? {
				page: targetPage,
				pageSize: OPERACIONES_PAGE_SIZE,
				total: 0,
			},
		};
	}, []);

	const refreshDebounced = useDebouncedAbortableAsync(refreshCore, {
		debounceMs: 0,
		onStart: () => setLoading(true),
		onSuccess: (data) => {
			const lastPage = Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize));
			if (data.pagination.page > lastPage) {
				setCurrentPage(lastPage);
				return;
			}

			setOperaciones((previous) => {
				if (data.pagination.page === 1) return data.operaciones;

				const existingIds = new Set(previous.map((operacion) => operacion.id));
				return [
					...previous,
					...data.operaciones.filter((operacion) => !existingIds.has(operacion.id)),
				];
			});
			setStats(data.stats);
			setPagination(data.pagination);
		},
		onFinally: () => setLoading(false),
	});

	useEffect(() => {
		refreshDebounced.runNow(activeFilters, page);
	}, [activeFilters, page, refreshDebounced, reloadVersion]);

	const setSelectedTipos = useCallback<React.Dispatch<React.SetStateAction<TipoOperacion[]>>>((next) => {
		setCurrentPage(1);
		setSelectedTiposState(next);
	}, []);

	const setPeriod = useCallback((nextPeriod: OperacionesPeriod) => {
		setCurrentPage(1);
		setPeriodState(nextPeriod);
	}, []);

	const hasMore = pagination.page * pagination.pageSize < pagination.total;

	const loadMore = useCallback(() => {
		if (loading || !hasMore) return;
		setCurrentPage((currentPage) => currentPage + 1);
	}, [hasMore, loading]);

	const refresh = useCallback(async () => {
		setCurrentPage(1);
		setReloadVersion((current) => current + 1);
	}, []);

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

	const create = useCallback(async (input: CreateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.create(input);
			if (response?.error) throw new Error(response.error);
			const operacion = response?.data ?? null;
			try { await refresh(); } catch { /* ignore */ }
			return operacion;
		} finally {
			setLoading(false);
		}
	}, [refresh]);

	const update = useCallback(async (id: string | number, input: UpdateOperacionInput) => {
		setLoading(true);
		try {
			const response = await operacionesClient.update(id, input);
			if (response?.error) throw new Error(response.error);
			const updated = response?.data ?? null;
			try { await refresh(); } catch { /* ignore */ }
			return updated;
		} finally {
			setLoading(false);
		}
	}, [refresh]);

	const remove = useCallback(async (id: string | number) => {
		setLoading(true);
		try {
			const { error } = await operacionesClient.delete(id);
			if (error) throw new Error(error);
			try { await refresh(); } catch { /* ignore */ }
		} finally {
			setLoading(false);
		}
	}, [refresh]);

	const value = useMemo(
		() => ({
			operaciones,
			stats,
			loading,
			selectedTipos: selectedTiposState,
			setSelectedTipos,
			period,
			setPeriod,
			pagination,
			hasMore,
			loadMore,
			fetchById,
			create,
			update,
			remove,
		}),
		[
			operaciones,
			stats,
			loading,
			selectedTiposState,
			setSelectedTipos,
			period,
			setPeriod,
			pagination,
			hasMore,
			loadMore,
			fetchById,
			create,
			update,
			remove,
		]
	);

	return <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>;
}

export function useOperaciones() {
	const ctx = useContext(OperacionesContext);
	if (!ctx) throw new Error("useOperaciones debe usarse dentro de OperacionesProvider");
	return ctx;
}
