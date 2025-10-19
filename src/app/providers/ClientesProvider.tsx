"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Cliente, TipoCliente, Vehiculo } from "@/model/types";
import { API_ROUTES, ROUTES } from "@/routing/routes";

type ClientesContextType = {
  clientes: Cliente[];
  loading: boolean;
  refetch: () => Promise<void>;
  createParticular: (input: CreateParticularRequest) => Promise<Cliente>;
  createEmpresa: (input: CreateEmpresaRequest) => Promise<Cliente>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(
  undefined
);

export type CreateParticularRequest = {
  nombre: string;
  apellido?: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: TipoCliente;
};

export type CreateEmpresaRequest = {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: TipoCliente;
};

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clientes");
      const { data } = await res.json();
      setClientes(data);
    } catch (err) {
      console.error("Error cargando clientes", err);
    }
  };

  const createParticular = async (input: CreateParticularRequest): Promise<Cliente> => {
    const payload = { ...input, tipo_cliente: TipoCliente.PARTICULAR };
    const res = await fetch("/api/clientes/particulares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Error" }));
      throw new Error(error || "No se pudo crear el cliente");
    }
    const { data } = await res.json();
    setClientes((prev) => [...prev, data]);
    return data as Cliente;
  };

  const createEmpresa = async (input: CreateEmpresaRequest): Promise<Cliente> => {
    const payload = { ...input, tipo_cliente: TipoCliente.EMPRESA };
    const res = await fetch("/api/clientes/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Error" }));
      throw new Error(error || "No se pudo crear el cliente");
    }
    const { data } = await res.json();
    setClientes((prev) => [...prev, data]);
    return data as Cliente;
  };

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
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
  }, []);

  if (!mounted) {
    // opcional: placeholder idéntico server/cliente
    return (
      <ClientesContext.Provider
        value={{ clientes, loading, refetch: fetchClientes, createParticular, createEmpresa }}
      >
        <div aria-hidden="true" />
      </ClientesContext.Provider>
    );
  }

  return (
    <ClientesContext.Provider
      value={{ clientes, loading, refetch: fetchClientes, createParticular, createEmpresa }}
    >
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

export function useClienteById(id: string) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [patenteVehiculo, setPatenteVehiculo] = useState<
    Record<string, string>
  >({});
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  useEffect(() => {
    if (id == null) {
      setCliente(null);
      return;
    }

    setLoadingCliente(true);
    (async () => {

      // seleccionar endpoint según el tipo de cliente guardado en localStorage
      const rawTipo = localStorage.getItem("tipo_cliente") ?? "";
      const tipoLower = String(rawTipo).toLowerCase();
      let url = API_ROUTES.clientes + `/${id}`;

      if (tipoLower.includes(TipoCliente.EMPRESA) || rawTipo === String(TipoCliente.EMPRESA)) {
        url = API_ROUTES.empresas + `/${id}`;
      }

      const res = await fetch(url);
      const { data } = await res.json();

      setCliente(data);

      const map: Record<string, string> = {};
      try {
        const vehiculos = data?.vehiculos ?? [];
        setVehiculos(vehiculos);

        for (const v of vehiculos) {
          const id = String(v?.vehiculo_id ?? "");
          const patente = v?.patente ?? "";
          if (id) map[id] = patente;
        }
      } catch (e) {
        console.error("Error construyendo patenteVehiculo", e);
      }
      setPatenteVehiculo(map);

      setLoadingCliente(false);
    })();
  }, [id]);

  return {
    cliente,
    loading: loadingCliente,
    patenteVehiculo,
    vehiculos,
  };
}
