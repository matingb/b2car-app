"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Cliente, Particular, TipoCliente } from "@/model/types";
import { clientesClient, DeleteClienteResponse } from "@/clients/clientes/clientesClient";
import { CreateParticularRequest } from "../api/clientes/particulares/route";
import { CreateEmpresaRequest } from "../api/clientes/empresas/route";
import { Empresa, empresaClient } from "@/clients/clientes/empresaClient";
import { particularClient } from "@/clients/clientes/particularClient";
import { representantesClient, CreateRepresentanteInput } from "@/clients/representantesClient";
import { Representante } from "@/model/types";
import type { UpdateParticularRequest } from "../api/clientes/particulares/[id]/route";
import type { UpdateEmpresaRequest } from "../api/clientes/empresas/[id]/route";

type ClientesContextType = {
  clientes: Cliente[];
  loading: boolean;
  refetch: () => Promise<void>;
  getParticularById: (id: string) => Promise<Particular | null>;
  getEmpresaById: (id: string) => Promise<Empresa | null>;
  createParticular: (input: CreateParticularRequest) => Promise<Cliente>;
  createEmpresa: (input: CreateEmpresaRequest) => Promise<Cliente>;
  deleteCliente: (id: string, tipo: TipoCliente) => Promise<void>;
  listRepresentantes: (empresaId: string | number) => Promise<Representante[]>;
  createRepresentante: (empresaId: string | number, input: CreateRepresentanteInput) => Promise<Representante>;
  deleteRepresentante: (empresaId: string | number, representanteId: string | number) => Promise<void>;
  updateParticular: (id: string | number, input: UpdateParticularRequest) => Promise<Particular>;
  updateEmpresa: (id: string | number, input: UpdateEmpresaRequest) => Promise<Empresa>;
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
        console.error("Error cargando clientes", e);
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

  const deleteCliente = useCallback(async (id: string, tipo: TipoCliente) => {
    setLoading(true);
    try {
      let response: DeleteClienteResponse | null = null;
      if (tipo === TipoCliente.PARTICULAR) {
        response = await particularClient.delete(id);
      } else {
        response = await empresaClient.delete(id);
      }
      if(response?.error) {
        throw new Error(response.error);
      }
      setClientes((prev) => prev.filter((c) => c.id !== id));
      //return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const listRepresentantes = useCallback(async (empresaId: string | number) => {
    const { data, error } = await representantesClient.getByEmpresaId(empresaId);
    if (error) {
      throw new Error(error);
    }
    return data || [];
  }, []);

  const createRepresentante = useCallback(async (empresaId: string | number, input: CreateRepresentanteInput) => {
    const { data, error } = await representantesClient.create(empresaId, input);
    console.log({data, error});
    if (error || !data) {
      throw new Error(error || "No se pudo crear el representante");
    }
    return data;
  }, []);

  const deleteRepresentante = useCallback(async (empresaId: string | number, representanteId: string | number) => {
    const { error } = await representantesClient.delete(empresaId, representanteId);
    if (error) {
      throw new Error(error);
    }
  }, []);

  const updateParticular = useCallback(async (id: string | number, input: UpdateParticularRequest): Promise<Particular> => {
    const { data, error } = await particularClient.update(id, input);
    if (error || !data) {
      throw new Error(error || "No se pudo actualizar el particular");
    }
    const nombre = `${data?.nombre || ""} ${data?.apellido || ""}`.trim();
    setClientes((prev) => prev.map((c) => c.id === data.id ? { ...c, nombre } : c));
    return data;
  }, []);

  const updateEmpresa = useCallback(async (id: string | number, input: UpdateEmpresaRequest): Promise<Empresa> => {
    const { data, error } = await empresaClient.update(id, input);
    if (error || !data) {
      throw new Error(error || "No se pudo actualizar la empresa");
    }
    setClientes((prev) => prev.map((c) => c.id === data.id ? { ...c, ...data } : c));
    return data;
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
      deleteCliente,
      listRepresentantes,
      createRepresentante,
      deleteRepresentante,
      updateParticular,
      updateEmpresa,
    }),
    [clientes, loading, fetchClientes, createParticular, createEmpresa, getParticularById, getEmpresaById, deleteCliente, listRepresentantes, createRepresentante, deleteRepresentante, updateParticular, updateEmpresa]
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
