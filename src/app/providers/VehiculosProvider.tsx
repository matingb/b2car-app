"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Vehiculo, Cliente, Arreglo } from "@/model/types";
import {
  vehiculoClient,
  CreateVehiculoRequest,
  UpdateVehiculoRequest,
  GetVehiculosInput,
} from "@/clients/vehiculoClient";
import { logger } from "@/lib/logger";

type VehiculosContextType = {
  vehiculos: Vehiculo[];
  vehiculoDetalle: Vehiculo | null;
  arreglos: Arreglo[];
  cliente: Cliente | null;
  loading: boolean;
  hasMore: boolean;
  fetchAll: (filters?: GetVehiculosInput) => Promise<Vehiculo[] | null>;
  searchVehiculos: (
    search: string,
    options?: { clienteId?: string; limit?: number; page?: number }
  ) => Promise<Vehiculo[]>;
  getVehiculoById: (id: string) => Promise<Vehiculo | null>;
  fetchById: (id: string) => Promise<Vehiculo | null>;
  fetchCliente: (vehiculoId: string) => Promise<Cliente | null>;
  create: (input: CreateVehiculoRequest) => Promise<string | null>;
  update: (id: string, input: UpdateVehiculoRequest) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reassignOwner: (id: string, clienteId: string) => Promise<void>;
};

export const VehiculosContext = createContext<VehiculosContextType | null>(null);

export function VehiculosProvider({ children }: { children: React.ReactNode }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculoDetalle, setVehiculoDetalle] = useState<Vehiculo | null>(null);
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const vehicleCacheRef = useRef<Map<string, Vehiculo>>(new Map());

  const fetchAll = useCallback(async (filters?: GetVehiculosInput) => {
    setLoading(true);
    try {
      const { data, page, error } = await vehiculoClient.getAll(filters);
      if (error) throw new Error(error);
      const list = data ?? [];
      for (const v of list) {
        vehicleCacheRef.current.set(String(v.id), v);
      }
      setVehiculos(list);
      setHasMore(Boolean(page?.hasMore));
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchVehiculos = useCallback(async (
    search: string,
    options?: { clienteId?: string; limit?: number; page?: number }
  ): Promise<Vehiculo[]> => {
    try {
      const { data, error } = await vehiculoClient.getAll({
        search: search.trim() || undefined,
        cliente_id: options?.clienteId,
        limit: options?.limit ?? 25,
        page: options?.page,
      });
      if (error) {
        logger.error("Error buscando vehiculos:", error);
        return [];
      }
      const list = data ?? [];
      for (const v of list) {
        vehicleCacheRef.current.set(String(v.id), v);
      }
      return list;
    } catch (err) {
      logger.error("Error buscando vehiculos:", err);
      return [];
    }
  }, []);

  const getVehiculoById = useCallback(async (id: string): Promise<Vehiculo | null> => {
    if (!id) return null;
    const cached = vehicleCacheRef.current.get(String(id));
    if (cached) return cached;
    try {
      const { data } = await vehiculoClient.getById(id);
      if (data) {
        vehicleCacheRef.current.set(String(data.id), data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, arreglos, error } = await vehiculoClient.getById(id);
      if (error) throw new Error(error);
      if (data) {
        vehicleCacheRef.current.set(String(data.id), data);
      }
      setVehiculoDetalle(data ?? null);
      setArreglos(arreglos || []);
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCliente = useCallback(async (vehiculoId: string) => {
    const { data, error } = await vehiculoClient.getClienteForVehiculo(vehiculoId);
    if (error) {
      console.error("No se pudo obtener cliente del vehiculo", error);
    }
    setCliente(data ?? null);
    return data ?? null;
  }, []);

  const create = useCallback(async (input: CreateVehiculoRequest) => {
    setLoading(true);
    try {
      const { data, error } = await vehiculoClient.create(input);
      if (error) throw new Error(error);
      await fetchAll();
      return data?.id ?? null;
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const update = useCallback(async (id: string, input: UpdateVehiculoRequest) => {
    setLoading(true);
    try {
      const { error } = await vehiculoClient.update(id, input);
      if (error) throw new Error(error);
      await fetchById(id);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll, fetchById]);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { error } = await vehiculoClient.delete(id);
      if (error) throw new Error(error);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const reassignOwner = useCallback(async (id: string, clienteId: string) => {
    setLoading(true);
    try {
      const { error } = await vehiculoClient.reassignOwner(id, clienteId);
      if (error) throw new Error(error);
      await fetchById(id);
      await fetchCliente(id);
    } finally {
      setLoading(false);
    }
  }, [fetchById, fetchCliente]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const value = useMemo(
    () => ({
      vehiculos,
      vehiculoDetalle,
      arreglos,
      cliente,
      loading,
      hasMore,
      fetchAll,
      searchVehiculos,
      getVehiculoById,
      fetchById,
      fetchCliente,
      create,
      update,
      remove,
      reassignOwner,
    }),
    [
      vehiculos,
      vehiculoDetalle,
      arreglos,
      cliente,
      loading,
      hasMore,
      fetchAll,
      searchVehiculos,
      getVehiculoById,
      fetchById,
      fetchCliente,
      create,
      update,
      remove,
      reassignOwner,
    ]
  );

  return <VehiculosContext.Provider value={value}>{children}</VehiculosContext.Provider>;
}

export function useVehiculos() {
  const ctx = useContext(VehiculosContext);
  if (!ctx) throw new Error("useVehiculos debe usarse dentro de VehiculosProvider");
  return ctx;
}
