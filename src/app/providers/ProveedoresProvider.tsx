"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Proveedor } from "@/model/types";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

export type ProveedoresContextValue = {
  proveedores: Proveedor[];
  loading: boolean;
  error: string | null;
  refresh: (search?: string) => Promise<void>;
  createProveedor: (data: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }) => Promise<Proveedor>;
  updateProveedor: (
    id: string,
    data: Partial<{
      nombre: string;
      cuit?: string | null;
      telefono?: string | null;
      email?: string | null;
      direccion?: string | null;
    }>
  ) => Promise<Proveedor>;
  deleteProveedor: (id: string) => Promise<void>;
};

const ProveedoresContext = createContext<ProveedoresContextValue | null>(null);

export function useProveedores(): ProveedoresContextValue {
  const context = useContext(ProveedoresContext);
  if (!context) {
    throw new Error("useProveedores debe utilizarse dentro de un ProveedoresProvider");
  }
  return context;
}

export function ProveedoresProvider({ children }: { children: React.ReactNode }) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await proveedoresClient.getAll({ search });
      if (res.error) {
        setError(res.error);
      } else {
        setProveedores(res.data ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProveedor = useCallback(
    async (data: {
      nombre: string;
      cuit?: string | null;
      telefono?: string | null;
      email?: string | null;
      direccion?: string | null;
    }) => {
      const res = await proveedoresClient.create(data);
      if (res.error || !res.data) {
        throw new Error(res.error || "No se pudo crear el proveedor");
      }
      setProveedores((prev) => [res.data!, ...prev]);
      return res.data;
    },
    []
  );

  const updateProveedor = useCallback(
    async (
      id: string,
      data: Partial<{
        nombre: string;
        cuit?: string | null;
        telefono?: string | null;
        email?: string | null;
        direccion?: string | null;
      }>
    ) => {
      const res = await proveedoresClient.update(id, data);
      if (res.error || !res.data) {
        throw new Error(res.error || "No se pudo actualizar el proveedor");
      }
      setProveedores((prev) => prev.map((p) => (p.id === id ? res.data! : p)));
      return res.data;
    },
    []
  );

  const deleteProveedor = useCallback(async (id: string) => {
    const res = await proveedoresClient.delete(id);
    if (res.error) {
      throw new Error(res.error);
    }
    setProveedores((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo<ProveedoresContextValue>(
    () => ({
      proveedores,
      loading,
      error,
      refresh,
      createProveedor,
      updateProveedor,
      deleteProveedor,
    }),
    [proveedores, loading, error, refresh, createProveedor, updateProveedor, deleteProveedor]
  );

  return <ProveedoresContext.Provider value={value}>{children}</ProveedoresContext.Provider>;
}
