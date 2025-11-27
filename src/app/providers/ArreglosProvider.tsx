"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Arreglo } from "@/model/types";
import {
  arreglosClient,
  CreateArregloInput,
  UpdateArregloInput,
  GetArregloByIdResponse,
} from "@/clients/arreglosClient";

type ArreglosContextType = {
  arreglos: Arreglo[];
  arregloDetalle: GetArregloByIdResponse | null;
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchById: (id: string | number) => Promise<GetArregloByIdResponse | null>;
  create: (input: CreateArregloInput) => Promise<void>;
  update: (id: string | number, input: UpdateArregloInput) => Promise<void>;
  togglePago: (id: string | number, esta_pago: boolean) => Promise<void>;
};

const ArreglosContext = createContext<ArreglosContextType | null>(null);

export function ArreglosProvider({ children }: { children: React.ReactNode }) {
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [arregloDetalle, setArregloDetalle] = useState<GetArregloByIdResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await arreglosClient.getAll();
      if (error) throw new Error(error);
      setArreglos(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: string | number) => {
    setLoading(true);
    try {
      const response = await arreglosClient.getById(id);
      if (response.error) throw new Error(response.error);
      setArregloDetalle(response);
      return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (input: CreateArregloInput) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.create(input);
      if (error) throw new Error(error);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const update = useCallback(async (id: string | number, input: UpdateArregloInput) => {
    setLoading(true);
    try {
      const { error } = await arreglosClient.update(id, input);
      if (error) throw new Error(error);
      await fetchById(id);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll, fetchById]);

  const togglePago = useCallback(async (id: string | number, esta_pago: boolean) => {
    await update(id, { esta_pago });
  }, [update]);

  const value = useMemo(
    () => ({
      arreglos,
      arregloDetalle,
      loading,
      fetchAll,
      fetchById,
      create,
      update,
      togglePago,
    }),
    [arreglos, arregloDetalle, loading, fetchAll, fetchById, create, update, togglePago]
  );

  return <ArreglosContext.Provider value={value}>{children}</ArreglosContext.Provider>;
}

export function useArreglos() {
  const ctx = useContext(ArreglosContext);
  if (!ctx) throw new Error("useArreglos debe usarse dentro de ArreglosProvider");
  return ctx;
}
