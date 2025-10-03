"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Persona } from "@/model/types"; 

type ClientesContextType = {
  clientes: Persona[];
  loading: boolean;
  refetch: () => void;
};

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clientes");
      const {data} = await res.json();
      setClientes(data);
    } catch (err) {
      console.error("Error cargando clientes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

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
