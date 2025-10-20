"use client";

import React from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteFormModal from "@/app/components/ClienteFormModal";
import ClienteList from "@/app/components/ClienteList";
import { useState, useMemo } from "react";
import ScreenHeader from "@/app/components/ScreenHeader";
import SearchBar from "@/app/components/SearchBar";
import { PlusIcon } from "lucide-react";
import Button from "@/app/components/Button";
import { useAppToast } from "@/app/hooks/useAppToast";
import { TipoCliente } from "@/model/types";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

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
        <ClientesListSkeleton />
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
  },
  searchBar: {
    width: "100%",
    maxWidth: "420px",
  },
};

function ClientesListSkeleton() {
  // 6 filas de carga aproximando la forma de ClienteList
  return (
    <Theme>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={skeletonStyles.card}>
            <div style={skeletonStyles.row}>
              <div style={skeletonStyles.left}>
                <Skeleton style={{ width: 40, height: 40, borderRadius: 9999 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  <Skeleton style={{ width: 180, height: 16 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Skeleton style={{ width: 140, height: 12 }} />
                    <Skeleton style={{ width: 120, height: 12 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Theme>
  );
}

const skeletonStyles = {
  card: {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
} as const;