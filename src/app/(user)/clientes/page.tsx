"use client";

import React from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteFormModal from "@/app/components/clientes/ClienteFormModal";
import ClienteItem from "@/app/components/clientes/ClienteItem";
import { useState, useMemo } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import { PlusIcon } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useToast } from "@/app/providers/ToastProvider";
import { TipoCliente } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { BREAKPOINTS } from "@/theme/theme";
import { css } from "@emotion/react";

export default function ClientesPage() {
  const { clientes, loading, createParticular, createEmpresa } = useClientes();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [selectedTipos, setSelectedTipos] = useState<TipoCliente[]>([]);
  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    const q = search.trim().toLowerCase();
    return clientes
      .filter((c) => selectedTipos.length === 0 || selectedTipos.includes(c.tipo_cliente))
      .filter((c) =>
        !q
          ? true
          : Object.values(c ?? {}).some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(q)
          )
      );
  }, [clientes, search, selectedTipos]);

  const [open, setOpen] = useState(false);

  const toggleTipo = (tipo: TipoCliente) => {
    setSelectedTipos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  const testFactura = async () => {
    const response = await fetch('/api/facturas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      
    });    const data = await response.json();
    console.log('Factura creada:', data);
  }

  return (
    <div>
      <ScreenHeader title="Clientes" />
      <div style={styles.searchBarContainer}>
        <div style={styles.searchRow}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar clientes..."
            style={styles.searchBar}
          />
          <Button icon={<PlusIcon size={20} />} text="Crear cliente" onClick={() => testFactura()} style={styles.newButton} />
        </div>
        <div className="chips-container" aria-label="Filtrar por tipo de cliente">
          {[TipoCliente.PARTICULAR, TipoCliente.EMPRESA].map((tipo) => {
            const isSelected = selectedTipos.includes(tipo);
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => toggleTipo(tipo)}
                className={`chip-filter ${isSelected ? "chip-filter--selected" : ""}`}
                css={styles.chip}
              >
                {tipo === TipoCliente.PARTICULAR ? "Particulares" : "Empresas"}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <div style={styles.list}>
          {clientesFiltrados.map((cliente) => (
            <ClienteItem key={cliente.id} cliente={cliente} />
          ))}
        </div>
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
              });
            } else {
              await createEmpresa({
                nombre: values.nombre,
                cuit: values.cuit!,
                telefono: values.telefono,
                email: values.email,
                direccion: values.direccion,
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
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  searchBar: {
    flexGrow: 0,
  },
  newButton: {
    height: '40px',
    width: '48px',
    //minWidth: 180,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    width: "100%",
    gap: 12,
  },
  chip: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: '14px',
      padding : '6px 12px',
    },
  })
};
