"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Arreglo } from "@/model/types";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import {
  arreglosClient,
  CreateArregloInput,
  UpdateArregloInput,
} from "@/clients/arreglosClient";
import { useTenant } from "@/app/providers/TenantProvider";

type ArreglosContextType = {
  arreglos: Arreglo[];
  loading: boolean;
  fetchAll: (params?: { tallerId?: string }) => Promise<Arreglo[] | null>;
  fetchById: (id: string | number) => Promise<ArregloDetalleData | null>;
  create: (input: CreateArregloInput) => Promise<Arreglo | null>;
  update: (
    id: string | number,
    input: UpdateArregloInput,
  ) => Promise<Arreglo | null>;
  remove: (id: string | number) => Promise<void>;

  createDetalle: (arregloId: string | number, input: { descripcion: string; cantidad: number; valor: number }) => Promise<void>;
  updateDetalle: (
    arregloId: string | number,
    detalleId: string,
    patch: Partial<{ descripcion: string; cantidad: number; valor: number }>
  ) => Promise<void>;
  deleteDetalle: (arregloId: string | number, detalleId: string) => Promise<void>;

  upsertRepuestoLinea: (
    arregloId: string | number,
    input: { taller_id: string; stock_id: string; cantidad: number; monto_unitario: number }
  ) => Promise<void>;
  deleteRepuestoLinea: (arregloId: string | number, lineaId: string) => Promise<void>;
};

const ArreglosContext = createContext<ArreglosContextType | null>(null);

export function ArreglosProvider({ children }: { children: React.ReactNode }) {
  const { tallerSeleccionadoId } = useTenant();
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async (filters?: { tallerId?: string }) => {
    setLoading(true);
    try {
      const { data, error } = await arreglosClient.getAll(filters);
      if (error) throw new Error(error);
      setArreglos(data ?? []);
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: string | number) => {
    setLoading(true);
    try {
      const response = await arreglosClient.getById(id);
      if (response.error) throw new Error(response.error);
      return response.data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (input: CreateArregloInput) => {
    setLoading(true);
    try {
      const response = await arreglosClient.create(input);
      if (response?.error) throw new Error(response.error);
      const arreglo = response?.data;
      if (arreglo) {
        setArreglos((prev) => [...prev, arreglo]);
      }
      return arreglo ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(
    async (
      id: string | number,
      input: UpdateArregloInput
    ) => {
      setLoading(true);
      try {
        const { data, error } = await arreglosClient.update(id, input);
        if (error) throw new Error(error);
        if (data) {
          setArreglos((prev) => prev.map((a) => (a.id === id ? data : a)));
        }
        return data ?? null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const remove = useCallback(async (id: string | number) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.delete(id);
      if (error) throw new Error(error);
      setArreglos((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const createDetalle = useCallback(async (arregloId: string | number, input: { descripcion: string; cantidad: number; valor: number }) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.createDetalle(arregloId, input);
      if (error) throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDetalle = useCallback(async (
    arregloId: string | number,
    detalleId: string,
    patch: Partial<{ descripcion: string; cantidad: number; valor: number }>
  ) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.updateDetalle(arregloId, detalleId, patch);
      if (error) throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDetalle = useCallback(async (arregloId: string | number, detalleId: string) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.deleteDetalle(arregloId, detalleId);
      if (error) throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertRepuestoLinea = useCallback(async (
    arregloId: string | number,
    input: { taller_id: string; stock_id: string; cantidad: number; monto_unitario: number }
  ) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.upsertRepuestoLinea(arregloId, input);
      if (error) throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRepuestoLinea = useCallback(async (arregloId: string | number, lineaId: string) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.deleteRepuestoLinea(arregloId, lineaId);
      if (error) throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tallerSeleccionadoId) {
      fetchAll({ tallerId: tallerSeleccionadoId });
    }
  }, [fetchAll, tallerSeleccionadoId]);

  const value = useMemo(
    () => ({
      arreglos,
      loading,
      fetchAll,
      fetchById,
      create,
      update,
      remove,
      createDetalle,
      updateDetalle,
      deleteDetalle,
      upsertRepuestoLinea,
      deleteRepuestoLinea,
    }),
    [
      arreglos,
      loading,
      fetchAll,
      fetchById,
      create,
      update,
      remove,
      createDetalle,
      updateDetalle,
      deleteDetalle,
      upsertRepuestoLinea,
      deleteRepuestoLinea,
    ]
  );

  return (
    <ArreglosContext.Provider value={value}>
      {children}
    </ArreglosContext.Provider>
  );
}

export function useArreglos() {
  const ctx = useContext(ArreglosContext);
  if (!ctx)
    throw new Error("useArreglos debe usarse dentro de ArreglosProvider");
  return ctx;
}
