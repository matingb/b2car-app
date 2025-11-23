"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Cliente, Particular } from "@/model/types";
import { clientesClient } from "@/clients/clientes/clientesClient";
import { CreateParticularRequest } from "../api/clientes/particulares/route";
import { CreateEmpresaRequest } from "../api/clientes/empresas/route";
import { Empresa, empresaClient } from "@/clients/clientes/empresaClient";
import { particularClient } from "@/clients/clientes/particularClient";

type ClientesContextType = {
  clientes: Cliente[];
  loading: boolean;
  refetch: () => Promise<void>;
  getParticularById: (id: string) => Promise<Particular | null>;
  getEmpresaById: (id: string) => Promise<Empresa | null>;
  createParticular: (input: CreateParticularRequest) => Promise<Cliente>;
  createEmpresa: (input: CreateEmpresaRequest) => Promise<Cliente>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(
  undefined
);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await clientesClient.getAll();
      if (error) {
        console.error("Error cargando clientes", error);
      }
      setClientes(data ?? []);
    } catch (err) {
      console.error("Error cargando clientes", err);
    }
  }, []);

  const createParticular = useCallback(async (input: CreateParticularRequest): Promise<Cliente> => {
    const { data, error } = await particularClient.create(input);
    if (error || !data) {
      throw new Error(error || "No se pudo crear el cliente");
    }
    setClientes((prev) => [...prev, data]);
    return data;
  }, []);

  const createEmpresa = useCallback(async (input: CreateEmpresaRequest): Promise<Cliente> => {
    const { data, error } = await empresaClient.create(input);
    if (error || !data) {
      throw new Error(error || "No se pudo crear el cliente");
    }
    setClientes((prev) => [...prev, data]);
    return data;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchClientes();
      } catch (e) {
        console.error(
          "No se pudo cargar clientes desde localStorage, intentando fetch",
          e
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchClientes]);

  const getParticularById = useCallback(async (id: string): Promise<Particular | null> => {
    setLoading(true);
    try {
      const { data, error } = await particularClient.getById(id);
      if (error) {
        console.error("Error cargando particular", error);
      }
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);  

  const getEmpresaById = useCallback(async (id: string): Promise<Empresa | null> => {
    setLoading(true);
    try {
      const { data, error } = await empresaClient.getById(id);
      if (error) {
        console.error("Error cargando empresa", error);
      }
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);  

  const contextValue = useMemo(
    () => ({
      clientes,
      loading,
      refetch: fetchClientes,
      createParticular,
      createEmpresa,
      getParticularById,
      getEmpresaById,
    }),
    [clientes, loading, fetchClientes, createParticular, createEmpresa, getParticularById, getEmpresaById]
  );

  return (
    <ClientesContext.Provider value={contextValue}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const ctx = useContext(ClientesContext);
  if (!ctx)
    throw new Error("useClientes debe usarse dentro de ClientesProvider");
  return ctx;
}
