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
        <Button icon={<PlusIcon size={20}/>} text="Crear cliente" onClick={() => setOpen(true)} style={styles.newButton} />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <ClienteList clientes={clientesFiltrados} />
      )}
      <ClienteFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (values) => {
          try {
            if (values.tipo_cliente === TipoCliente.PARTICULAR) {
              await createParticular({
                nombre: values.nombre,
                apellido: values.apellido,
                telefono: values.telefono,
                email: values.email,
                direccion: values.direccion,
                tipo_cliente: values.tipo_cliente,
              });
            } else {
              await createEmpresa({
                nombre: values.nombre,
                telefono: values.telefono,
                email: values.email,
                direccion: values.direccion,
                tipo_cliente: values.tipo_cliente,
              });
            }
            toast.success("Cliente creado", values.nombre);
          } catch (e) {
            const message = e instanceof Error ? e.message : "";
            toast.error("No se pudo crear", message);
            throw e;
          }
        }}
      />
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    display: "flex",
    justifyContent: "start",
    marginTop: 8,
    gap: 16,
  },
  searchBar: {
    width: "100%",
  },
  newButton: {
    height: 40,
    minWidth: 180,
  }
};