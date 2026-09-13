"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Cliente, Particular, TipoCliente } from "@/model/types";
import { clientesClient, DeleteClienteResponse, GetClientesInput } from "@/clients/clientes/clientesClient";
import { CreateParticularRequest } from "../api/clientes/particulares/route";
import { CreateEmpresaRequest } from "../api/clientes/empresas/route";
import { Empresa, empresaClient } from "@/clients/clientes/empresaClient";
import { particularClient } from "@/clients/clientes/particularClient";
import { representantesClient, CreateRepresentanteInput } from "@/clients/representantesClient";
import { Representante } from "@/model/types";
import type { UpdateParticularRequest } from "../api/clientes/particulares/[id]/route";
import type { UpdateEmpresaRequest } from "../api/clientes/empresas/[id]/route";
import { logger } from "@/lib/logger";

type ClientesContextType = {
  clientes: Cliente[];
  loading: boolean;
  hasMore: boolean;
  fetchAll: (filters?: GetClientesInput) => Promise<Cliente[] | null>;
  searchClientes: (search: string, options?: { tipo?: "particular" | "empresa"; limit?: number }) => Promise<Cliente[]>;
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
  getClienteById: (id: string) => Promise<Cliente | null>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(
  undefined
);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const clientCacheRef = useRef<Map<string, Cliente>>(new Map());
  const lastFiltersRef = useRef<GetClientesInput | undefined>({ limit: 50 });

  const fetchAll = useCallback(async (filters?: GetClientesInput): Promise<Cliente[] | null> => {
    lastFiltersRef.current = filters;
    setLoading(true);
    try {
      const { data, page, error } = await clientesClient.getAll(filters);
      if (error) {
        logger.error("Error cargando clientes:", error);
      }
      const list = data ?? [];
      for (const c of list) {
        clientCacheRef.current.set(String(c.id), c);
      }
      setClientes(list);
      setHasMore(Boolean(page?.hasMore));
      return list;
    } catch (err) {
      logger.error("Error cargando clientes:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchClientes = useCallback(async (
    search: string,
    options?: { tipo?: "particular" | "empresa"; limit?: number }
  ): Promise<Cliente[]> => {
    try {
      const { data, error } = await clientesClient.getAll({
        search: search.trim() || undefined,
        tipo: options?.tipo,
        limit: options?.limit ?? 20,
      });
      if (error) {
        logger.error("Error buscando clientes:", error);
        return [];
      }
      const list = data ?? [];
      for (const c of list) {
        clientCacheRef.current.set(String(c.id), c);
      }
      return list;
    } catch (err) {
      logger.error("Error buscando clientes:", err);
      return [];
    }
  }, []);

  const createParticular = useCallback(async (input: CreateParticularRequest): Promise<Cliente> => {
    const { data, error } = await particularClient.create(input);
    if (error || !data) {
      throw new Error(error || "No se pudo crear el cliente");
    }
    clientCacheRef.current.set(String(data.id), data);
    setClientes((prev) => [data, ...prev]);
    return data;
  }, []);

  const createEmpresa = useCallback(async (input: CreateEmpresaRequest): Promise<Cliente> => {
    const { data, error } = await empresaClient.create(input);
    if (error || !data) {
      throw new Error(error || "No se pudo crear el cliente");
    }
    clientCacheRef.current.set(String(data.id), data);
    setClientes((prev) => [data, ...prev]);
    return data;
  }, []);

  useEffect(() => {
    void fetchAll(lastFiltersRef.current);
  }, [fetchAll]);

  const getParticularById = useCallback(async (id: string): Promise<Particular | null> => {
    try {
      const { data, error } = await particularClient.getById(id);
      if (error) {
        logger.error("Error cargando particular:", error);
      }
      return data ?? null;
    } catch (err) {
      logger.error("Error cargando particular:", err);
      return null;
    }
  }, []);  

  const getEmpresaById = useCallback(async (id: string): Promise<Empresa | null> => {
    try {
      const { data, error } = await empresaClient.getById(id);
      if (error) {
        logger.error("Error cargando empresa:", error);
      }
      return data ?? null;
    } catch (err) {
      logger.error("Error cargando empresa:", err);
      return null;
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
      clientCacheRef.current.delete(String(id));
      setClientes((prev) => prev.filter((c) => c.id !== id));
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
    const updatedCliente: Cliente = {
      id: String(data.id),
      nombre,
      tipo_cliente: TipoCliente.PARTICULAR,
      codigo_pais: data.codigo_pais,
      telefono: data.telefono,
      email: data.email,
      direccion: data.direccion,
      dni_cuil: data.dni_cuil,
    };
    clientCacheRef.current.set(String(data.id), updatedCliente);
    setClientes((prev) => prev.map((c) => c.id === data.id ? { ...c, nombre } : c));
    return data;
  }, []);

  const updateEmpresa = useCallback(async (id: string | number, input: UpdateEmpresaRequest): Promise<Empresa> => {
    const { data, error } = await empresaClient.update(id, input);
    if (error || !data) {
      throw new Error(error || "No se pudo actualizar la empresa");
    }
    const updatedCliente: Cliente = {
      id: String(data.id),
      nombre: data.nombre,
      tipo_cliente: TipoCliente.EMPRESA,
      codigo_pais: data.codigo_pais,
      telefono: data.telefono,
      email: data.email,
      direccion: data.direccion,
      cuit: data.cuit,
    };
    clientCacheRef.current.set(String(data.id), updatedCliente);
    setClientes((prev) => prev.map((c) => c.id === data.id ? { ...c, ...data } : c));
    return data;
  }, []);

  const getClienteById = useCallback(async (id: string): Promise<Cliente | null> => {
    const stringId = String(id);
    const cached = clientCacheRef.current.get(stringId);
    if (cached) {
      return cached;
    }

    const inState = clientes.find((c) => String(c.id) === stringId);
    if (inState) {
      clientCacheRef.current.set(stringId, inState);
      return inState;
    }

    try {
      const particularResponse = await particularClient.getById(stringId);
      if (particularResponse.data) {
        const particular = particularResponse.data;
        const clientObj: Cliente = {
          id: particular.id,
          nombre: `${particular.nombre} ${particular.apellido ?? ""}`.trim(),
          tipo_cliente: TipoCliente.PARTICULAR,
          codigo_pais: particular.codigo_pais,
          telefono: particular.telefono,
          email: particular.email,
          direccion: particular.direccion,
          dni_cuil: particular.dni_cuil,
        };
        clientCacheRef.current.set(stringId, clientObj);
        return clientObj;
      }

      const empresaResponse = await empresaClient.getById(stringId);
      if (empresaResponse.data) {
        const empresa = empresaResponse.data;
        const clientObj: Cliente = {
          id: empresa.id,
          nombre: empresa.nombre,
          tipo_cliente: TipoCliente.EMPRESA,
          codigo_pais: empresa.codigo_pais,
          telefono: empresa.telefono,
          email: empresa.email,
          direccion: empresa.direccion,
          cuit: empresa.cuit,
        };
        clientCacheRef.current.set(stringId, clientObj);
        return clientObj;
      }

      return null;
    } catch (err) {
      logger.error("Error obteniendo cliente por id:", err);
      return null;
    }
  }, [clientes]);


  const contextValue = useMemo(
    () => ({
      clientes,
      loading,
      hasMore,
      fetchAll,
      searchClientes,
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
      getClienteById,
    }),
    [
      clientes,
      loading,
      hasMore,
      fetchAll,
      searchClientes,
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
      getClienteById,
    ]
  );

  return (
    <ClientesContext.Provider value={contextValue}>
      {children}
    </ClientesContext.Provider>
  );
}

const defaultClientesContext: ClientesContextType = {
  clientes: [],
  loading: false,
  hasMore: false,
  fetchAll: async () => [],
  searchClientes: async () => [],
  getParticularById: async () => null,
  getEmpresaById: async () => null,
  createParticular: async () => ({} as Cliente),
  createEmpresa: async () => ({} as Cliente),
  deleteCliente: async () => {},
  listRepresentantes: async () => [],
  createRepresentante: async () => ({} as Representante),
  deleteRepresentante: async () => {},
  updateParticular: async () => ({} as Particular),
  updateEmpresa: async () => ({} as Empresa),
  getClienteById: async () => null,
};

export function useClientes() {
  const ctx = useContext(ClientesContext);
  return ctx ?? defaultClientesContext;
}


