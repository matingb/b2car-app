"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Vehiculo, Cliente, Arreglo } from "@/model/types";
import {
  vehiculoClient,
  CreateVehiculoRequest,
  UpdateVehiculoRequest,
} from "@/clients/vehiculoClient";

type VehiculosContextType = {
  vehiculos: Vehiculo[];
  vehiculoDetalle: Vehiculo | null;
  arreglos: Arreglo[];
  cliente: Cliente | null;
  loading: boolean;
  fetchAll: () => Promise<Vehiculo[] | null>;
  fetchById: (id: string | number) => Promise<Vehiculo | null>;
  fetchCliente: (vehiculoId: string | number) => Promise<Cliente | null>;
  create: (input: CreateVehiculoRequest) => Promise<number | null>;
  update: (id: string | number, input: UpdateVehiculoRequest) => Promise<void>;
  remove: (id: string | number) => Promise<void>;
  reassignOwner: (id: string | number, clienteId: string | number) => Promise<void>;
};

const VehiculosContext = createContext<VehiculosContextType | null>(null);

export function VehiculosProvider({ children }: { children: React.ReactNode }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculoDetalle, setVehiculoDetalle] = useState<Vehiculo | null>(null);
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await vehiculoClient.getAll();
      if (error) throw new Error(error);
      setVehiculos(data ?? []);
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: string | number) => {
    setLoading(true);
    try {
      const { data, arreglos, error } = await vehiculoClient.getById(id);
      if (error) throw new Error(error);
      setVehiculoDetalle(data ?? null);
      setArreglos(arreglos || []);
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCliente = useCallback(async (vehiculoId: string | number) => {
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
      const { created_id, error } = await vehiculoClient.create(input);
      if (error) throw new Error(error);
      await fetchAll();
      return created_id ?? null;
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const update = useCallback(async (id: string | number, input: UpdateVehiculoRequest) => {
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

  const remove = useCallback(async (id: string | number) => {
    setLoading(true);
    try {
      const { error } = await vehiculoClient.delete(id);
      if (error) throw new Error(error);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const reassignOwner = useCallback(async (id: string | number, clienteId: string | number) => {
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
      fetchAll,
      fetchById,
      fetchCliente,
      create,
      update,
      remove,
      reassignOwner,
    }),
    [vehiculos, vehiculoDetalle, arreglos, cliente, loading, fetchAll, fetchById, fetchCliente, create, update, reassignOwner]
  );

  return <VehiculosContext.Provider value={value}>{children}</VehiculosContext.Provider>;
}

export function useVehiculos() {
  const ctx = useContext(VehiculosContext);
  if (!ctx) throw new Error("useVehiculos debe usarse dentro de VehiculosProvider");
  return ctx;
}
