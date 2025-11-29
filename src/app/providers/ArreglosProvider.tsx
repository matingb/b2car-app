"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Arreglo, Vehiculo } from "@/model/types";
import {
  arreglosClient,
  CreateArregloInput,
  UpdateArregloInput,
} from "@/clients/arreglosClient";

type ArreglosContextType = {
  arreglos: Arreglo[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchById: (id: string | number) => Promise<Arreglo | null>;
  create: (input: CreateArregloInput) => Promise<Arreglo | null>;
  update: (id: string | number, input: UpdateArregloInput, vehiculo?: Vehiculo) => Promise<Arreglo | null>;
};

const ArreglosContext = createContext<ArreglosContextType | null>(null);

export function ArreglosProvider({ children }: { children: React.ReactNode }) {
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
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
      const arreglo = response.data?.arreglo;
      if (!arreglo) return null;
      arreglo.vehiculo = response.data?.vehiculo as Vehiculo;
      return arreglo;
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

  const update = useCallback(async (id: string | number, input: UpdateArregloInput, vehiculo?: Vehiculo) => {
    setLoading(true);
    try {
      const { data, error } = await arreglosClient.update(id, input);
      if (error) throw new Error(error);
      if (data && vehiculo) {
        data.vehiculo = vehiculo;
      }
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const value = useMemo(
    () => ({
      arreglos,
      loading,
      fetchAll,
      fetchById,
      create,
      update,
    }),
    [arreglos, loading, fetchAll, fetchById, create, update]
  );

  return <ArreglosContext.Provider value={value}>{children}</ArreglosContext.Provider>;
}

export function useArreglos() {
  const ctx = useContext(ArreglosContext);
  if (!ctx) throw new Error("useArreglos debe usarse dentro de ArreglosProvider");
  return ctx;
}
