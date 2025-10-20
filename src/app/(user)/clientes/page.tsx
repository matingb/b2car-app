"use client";

import React from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteFormModal from "@/app/components/clientes/ClienteFormModal";
import ClienteList from "@/app/components/clientes/ClienteList";
import { useState, useMemo } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import { PlusIcon } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useAppToast } from "@/app/hooks/useAppToast";
import { TipoCliente } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";

export default function ClientesPage() {
  const { clientes, loading, createParticular, createEmpresa } = useClientes();
  const toast = useAppToast();

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

  const [open, setOpen] = useState(false);

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
        <Button icon={<PlusIcon size={20}/>} text="Nuevo cliente" onClick={() => setOpen(true)}/>
      </div>

      {loading ? (
        <ListSkeleton />
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
    justifyContent: "start",
    gap: 16,
  },
  searchBar: {
    width: "100%",
    maxWidth: "420px",
  },
};