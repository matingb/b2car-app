"use client";

import React from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteList from "@/app/components/ClienteList";
import { useState, useMemo } from "react";
import ScreenHeader from "@/app/components/ScreenHeader";
import SearchBar from "@/app/components/SearchBar";

export default function ClientesPage() {
  const { clientes, loading } = useClientes();

  const [search, setSearch] = useState("");
  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      Object.values(c ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [clientes, search]);


  return (
    <div>
      <ScreenHeader title="Clientes" />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar clientes..."
        style={{ width: "100%", maxWidth: "420px" }}
      />
      {loading ? (
        <p>Cargando clientes...</p>
      ) : (
        <ClienteList clientes={clientesFiltrados} />
      )}
    </div>
  );
}

 
