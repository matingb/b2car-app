"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { operacionesClient, CreateOperacionInput, UpdateOperacionInput } from "@/clients/operacionesClient";
import type { Operacion, OperacionesFilters } from "@/model/types";

const OPERACIONES_MOCK: Operacion[] = [
	{
		id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0001",
		tipo: "compra",
		taller_id: "58141a55-6cbf-422d-baf9-638abaac2078",
		created_at: "2026-01-26T09:15:00.000Z",
		lineas: [
			{
				id: "b1c2d3e4-0001-4f99-8f11-000000000001",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0001",
				producto_id: "p-001",
				cantidad: 4,
				monto_unitario: 12500,
				delta_cantidad: 4,
				created_at: "2026-01-26T09:15:00.000Z",
			},
			{
				id: "b1c2d3e4-0002-4f99-8f11-000000000002",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0001",
				producto_id: "p-002",
				cantidad: 2,
				monto_unitario: 8400,
				delta_cantidad: 2,
				created_at: "2026-01-26T09:15:00.000Z",
			},
		],
	},
	{
		id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0002",
		tipo: "venta",
		taller_id: "58141a55-6cbf-422d-baf9-638abaac2078",
		created_at: "2026-01-24T15:40:00.000Z",
		lineas: [
			{
				id: "b1c2d3e4-0003-4f99-8f11-000000000003",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0002",
				producto_id: "p-003",
				cantidad: 1,
				monto_unitario: 22000,
				delta_cantidad: -1,
				created_at: "2026-01-24T15:40:00.000Z",
			},
		],
	},
	{
		id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0003",
		tipo: "asignacion_arreglo",
		taller_id: "58141a55-6cbf-422d-baf9-638abaac2078",
		created_at: "2026-01-22T11:05:00.000Z",
		lineas: [
			{
				id: "b1c2d3e4-0004-4f99-8f11-000000000004",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0003",
				producto_id: "p-004",
				cantidad: 3,
				monto_unitario: 5600,
				delta_cantidad: -3,
				created_at: "2026-01-22T11:05:00.000Z",
			},
		],
	},
	{
		id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0004",
		tipo: "ajuste",
		taller_id: "58141a55-6cbf-422d-baf9-638abaac2078",
		created_at: "2026-01-20T08:30:00.000Z",
		lineas: [
			{
				id: "b1c2d3e4-0005-4f99-8f11-000000000005",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0004",
				producto_id: "p-005",
				cantidad: 5,
				monto_unitario: 3100,
				delta_cantidad: 5,
				created_at: "2026-01-20T08:30:00.000Z",
			},
		],
	},
	{
		id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0005",
		tipo: "transferencia",
		taller_id: "58141a55-6cbf-422d-baf9-638abaac2078",
		created_at: "2026-01-18T18:10:00.000Z",
		lineas: [
			{
				id: "b1c2d3e4-0006-4f99-8f11-000000000006",
				operacion_id: "4f2f3db2-2a3e-4d2a-9c2a-9b1f2a9c0005",
				producto_id: "p-006",
				cantidad: 2,
				monto_unitario: 9800,
				delta_cantidad: -2,
				created_at: "2026-01-18T18:10:00.000Z",
			},
		],
	},
];

type OperacionesContextType = {
	operaciones: Operacion[];
	loading: boolean;
	fetchAll: (filters?: OperacionesFilters) => Promise<Operacion[] | null>;
	fetchById: (id: string | number) => Promise<Operacion | null>;
	create: (input: CreateOperacionInput) => Promise<Operacion | null>;
	update: (id: string | number, input: UpdateOperacionInput) => Promise<Operacion | null>;
	remove: (id: string | number) => Promise<void>;
};

const OperacionesContext = createContext<OperacionesContextType | null>(null);

export function OperacionesProvider({ children }: { children: React.ReactNode }) {
	const [operaciones, setOperaciones] = useState<Operacion[]>([]);
	const [loading, setLoading] = useState(false);

	const fetchAll = useCallback(async (filters?: OperacionesFilters) => {
		setLoading(true);
		try {
			// const hasFilters = Boolean(filters?.fecha || filters?.from || filters?.to);
			// const response = hasFilters
			// 	? await operacionesClient.getWithFilters(filters ?? {})
			// 	: await operacionesClient.getAll();
			// if (response?.error) throw new Error(response.error);
			// setOperaciones(response?.data ?? []);
			// return response?.data ?? null;
			setOperaciones(OPERACIONES_MOCK);
			//wait for 1 second
			await new Promise((resolve) => setTimeout(resolve, 2000));
			return OPERACIONES_MOCK;
		} finally {
			setLoading(false);
		}
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
			fetchAll,
			fetchById,
			create,
			update,
			remove,
		}),
		[operaciones, loading, fetchAll, fetchById, create, update, remove]
	);

	return <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>;
}

export function useOperaciones() {
	const ctx = useContext(OperacionesContext);
	if (!ctx) throw new Error("useOperaciones debe usarse dentro de OperacionesProvider");
	return ctx;
}
