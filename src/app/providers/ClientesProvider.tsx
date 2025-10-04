"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Persona } from "@/model/types";

const ONE_HOUR = 60 * 60 * 1000;

function shouldFetchClientes(now: number): boolean {
  try {
    const last = localStorage.getItem("lastClientDefaultQuery");
    if (!last) return true;
    return now - Number(last) > ONE_HOUR;
  } catch {
    return true;
  }
}

type ClientesContextType = {
  clientes: Persona[];
  loading: boolean;
  refetch: () => Promise<void>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clientes");
      const { data } = await res.json();
      setClientes(data);

      try {
        localStorage.setItem("clientesCache", JSON.stringify(data));
      } catch (e) {
        console.error("No se pudo guardar clientes en localStorage", e);
      }
    } catch (err) {
      console.error("Error cargando clientes", err);
    } finally {
      setLoading(false);
      const now = Date.now();
      try {
        localStorage.setItem("lastClientDefaultQuery", String(now));
      } catch (e) {
        console.error("No se pudo guardar lastClientDefaultQuery", e);
      }
    }
  };

  useEffect(() => {
    setMounted(true); 
    (async () => {
      const now = Date.now();
      if (shouldFetchClientes(now)) {
        await fetchClientes();
      } else {

        try {
          const cached = localStorage.getItem("clientesCache");
          if (cached) {
            const parsed: Persona[] = JSON.parse(cached);
            setClientes(parsed);
          } else {
            await fetchClientes();
          }
        } catch (e) {
          console.error("No se pudo cargar clientes desde localStorage, intentando fetch", e);
          await fetchClientes();
        } finally {
          setLoading(false);
        }
      }
    })();
  }, []);

  if (!mounted) {
    // opcional: placeholder idéntico server/cliente
    return (
      <ClientesContext.Provider value={{ clientes, loading, refetch: fetchClientes }}>
        <div aria-hidden="true" />
      </ClientesContext.Provider>
    );
  }

  return (
    <ClientesContext.Provider value={{ clientes, loading, refetch: fetchClientes }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error("useClientes debe usarse dentro de ClientesProvider");
  return ctx;
}

export function useClienteById(cliente_id: number | null | undefined) {
  const { clientes, loading, refetch } = useClientes();
  const [cliente, setCliente] = useState<Persona | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(false);

  useEffect(() => {
    if (cliente_id == null) {
      setCliente(null);
      return;
    }
    
    setLoadingCliente(true);
    (async () => {
      const res = await fetch(`/api/clientes/details/${cliente_id}`);
      const { cliente } = await res.json();
      setCliente(cliente);
      setLoadingCliente(false);
    })();
  }, [clientes, loading, cliente_id]);

  return { cliente, loading: loadingCliente, refetch }; 
}


      