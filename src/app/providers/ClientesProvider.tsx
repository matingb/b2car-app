"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Cliente, Vehiculo } from "@/model/types";

type ClientesContextType = {
  clientes: Cliente[];
  loading: boolean;
  refetch: () => Promise<void>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(
  undefined
);

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
        value={{ clientes, loading, refetch: fetchClientes }}
      >
        <div aria-hidden="true" />
      </ClientesContext.Provider>
    );
  }

  return (
    <ClientesContext.Provider
      value={{ clientes, loading, refetch: fetchClientes }}
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
      const res = await fetch(`/api/clientes/${id}`);
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
