"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { operacionesClient, CreateOperacionInput, UpdateOperacionInput } from "@/clients/operacionesClient";
import type { Operacion, OperacionesFilters, TipoOperacion } from "@/model/types";

type OperacionesContextType = {
	operaciones: Operacion[];
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
	const [loading, setLoading] = useState(false);
	const [selectedTipos, setSelectedTipos] = useState<TipoOperacion[]>([]);

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const didMountTiposRef = useRef(false);

	const fetchAll = useCallback(async (filters?: OperacionesFilters) => {
		setLoading(true);
		try {
			const hasFilters = Boolean(
				filters?.fecha ||
					filters?.from ||
					filters?.to ||
					(Array.isArray(filters?.tipo) && filters.tipo.length > 0)
			);

			const response = await operacionesClient.getAll(hasFilters ? (filters ?? {}) : undefined);
			if (response?.error) throw new Error(response.error);
			setOperaciones(response?.data ?? []);
			return response?.data ?? null;
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchAll();
	}, [fetchAll]);

	useEffect(() => {
		if (!didMountTiposRef.current) {
			didMountTiposRef.current = true;
			return;
		}

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const filters: OperacionesFilters | undefined =
				selectedTipos.length > 0 ? { tipo: selectedTipos } : undefined;
			void fetchAll(filters);
		}, 3000);
	}, [selectedTipos, fetchAll]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
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
			loading,
			selectedTipos,
			setSelectedTipos,
			fetchById,
			create,
			update,
			remove,
		}),
		[operaciones, loading, selectedTipos, fetchById, create, update, remove]
	);

	return <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>;
}

export function useOperaciones() {
	const ctx = useContext(OperacionesContext);
	if (!ctx) throw new Error("useOperaciones debe usarse dentro de OperacionesProvider");
	return ctx;
}
