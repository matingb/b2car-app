"use client";

import React from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteList from "@/app/components/ClienteList";
import { useState, useMemo } from "react";
import ScreenHeader from "@/app/components/ScreenHeader";
import SearchBar from "@/app/components/SearchBar";
import { PlusIcon } from "lucide-react";
import Button from "@/app/components/Button";
import { ROUTES } from "@/routing/routes";
import { redirect } from "next/navigation";

export default function ClientesPage() {
  const { clientes, loading } = useClientes();

  const [search, setSearch] = useState("");
  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      Object.values(c ?? {}).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [clientes, search]);

  return (
    <div>
      <ScreenHeader title="Clientes" />
      <div style={styles.searchBarContainer}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar clientes..."
          style={styles.searchBar}
        />
        <Button icon={<PlusIcon size={20}/>} text="Nuevo cliente" onClick={() => redirect(ROUTES.clientes + "/nuevo")}/>
      </div>

      {loading ? (
        <p>Cargando clientes...</p>
      ) : (
        <ClienteList clientes={clientesFiltrados} />
      )}
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
  },
  searchBar: {
    width: "100%",
    maxWidth: "420px",
  },
};