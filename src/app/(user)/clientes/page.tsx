"use client";

import React, { useState, useMemo } from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteFormModal from "@/app/components/clientes/ClienteFormModal";
import ClienteItem from "@/app/components/clientes/ClienteItem";
import ClientesFiltersModal, { ClientesFilters } from "@/app/components/clientes/ClientesFiltersModal";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import { PlusIcon, Filter, User, Building2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useToast } from "@/app/providers/ToastProvider";
import { TipoCliente } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

export default function ClientesPage() {
  const { clientes, loading, createParticular, createEmpresa } = useClientes();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [tipoClienteFilter, setTipoClienteFilter] = useState<"" | "particular" | "empresa">("");
  const [saldoFilter, setSaldoFilter] = useState<"" | "PENDIENTE" | "AL_DIA" | "A_FAVOR">("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    const q = search.trim().toLowerCase();
    return clientes
      .filter((c) => {
        if (!tipoClienteFilter) return true;
        return c.tipo_cliente === tipoClienteFilter;
      })
      .filter((c) => {
        if (!saldoFilter) return true;
        const saldo = c.saldo_cuenta ?? 0;
        if (saldoFilter === "PENDIENTE") {
          return saldo > 0;
        }
        if (saldoFilter === "AL_DIA") {
          return saldo === 0;
        }
        if (saldoFilter === "A_FAVOR") {
          return saldo < 0;
        }
        return true;
      })
      .filter((c) =>
        !q
          ? true
          : Object.values(c ?? {}).some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(q)
          )
      );
  }, [clientes, search, tipoClienteFilter, saldoFilter]);

  const handleApplyModalFilters = (filters: ClientesFilters) => {
    setTipoClienteFilter(filters.tipoCliente);
    setSaldoFilter(filters.saldo);
  };

  const handleClearAllFilters = () => {
    setTipoClienteFilter("");
    setSaldoFilter("");
    setSearch("");
  };

  const hasActiveFilters = tipoClienteFilter !== "" || saldoFilter !== "" || search.trim() !== "";

  return (
    <div>
      <ScreenHeader title="Clientes" />
      <div style={styles.searchBarContainer}>
        <div style={styles.searchRow}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar clientes..."
            inputTestId="clientes-search"
            style={styles.searchBar}
          />
          <Button
            icon={<Filter size={20} />}
            text="Filtrar"
            onClick={() => setFiltersOpen(true)}
            style={styles.filterButton}
            dataTestId="clientes-open-filters"
            outline
          />
          <Button
            icon={<PlusIcon size={20} />}
            text="Crear cliente"
            onClick={() => setOpen(true)}
            style={styles.newButton}
            dataTestId="clientes-open-create"
          />
        </div>

        <div css={styles.chipsContainer} aria-label="Filtrar clientes">
          <div css={styles.chipsGroup}>
            <button
              type="button"
              data-testid="clientes-chip-particular"
              onClick={() =>
                setTipoClienteFilter((prev) => (prev === "particular" ? "" : "particular"))
              }
              css={[
                styles.chipBase,
                tipoClienteFilter === "particular" && styles.chipSelected,
                styles.chipResponsive,
              ]}
            >
              <User size={14} />
              <span>Particulares</span>
            </button>
            <button
              type="button"
              data-testid="clientes-chip-empresa"
              onClick={() =>
                setTipoClienteFilter((prev) => (prev === "empresa" ? "" : "empresa"))
              }
              css={[
                styles.chipBase,
                tipoClienteFilter === "empresa" && styles.chipSelected,
                styles.chipResponsive,
              ]}
            >
              <Building2 size={14} />
              <span>Empresas</span>
            </button>
          </div>

          <span css={styles.chipDivider} />

          <div css={styles.chipsGroup}>
            <button
              type="button"
              data-testid="clientes-chip-saldo-pendiente"
              onClick={() =>
                setSaldoFilter((prev) => (prev === "PENDIENTE" ? "" : "PENDIENTE"))
              }
              css={[
                styles.chipBase,
                saldoFilter === "PENDIENTE" && styles.chipSelectedDanger,
                styles.chipResponsive,
              ]}
            >
              <AlertCircle size={14} />
              <span>Saldo pendiente</span>
            </button>
            <button
              type="button"
              data-testid="clientes-chip-saldo-al-dia"
              onClick={() =>
                setSaldoFilter((prev) => (prev === "AL_DIA" ? "" : "AL_DIA"))
              }
              css={[
                styles.chipBase,
                saldoFilter === "AL_DIA" && styles.chipSelectedSuccess,
                styles.chipResponsive,
              ]}
            >
              <CheckCircle2 size={14} />
              <span>Saldo al día</span>
            </button>
            <button
              type="button"
              data-testid="clientes-chip-saldo-a-favor"
              onClick={() =>
                setSaldoFilter((prev) => (prev === "A_FAVOR" ? "" : "A_FAVOR"))
              }
              css={[
                styles.chipBase,
                saldoFilter === "A_FAVOR" && styles.chipSelectedInfo,
                styles.chipResponsive,
              ]}
            >
              <Info size={14} />
              <span>Saldo a favor</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              css={styles.clearButton}
              data-testid="clientes-clear-filters"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : clientesFiltrados.length === 0 ? (
        <div style={styles.emptyContainer} data-testid="clientes-empty-state">
          <p style={styles.emptyText}>No se encontraron clientes para los filtros aplicados.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {clientesFiltrados.map((cliente) => (
            <ClienteItem key={cliente.id} cliente={cliente} />
          ))}
        </div>
      )}

      <ClientesFiltersModal
        open={filtersOpen}
        initial={{
          tipoCliente: tipoClienteFilter,
          saldo: saldoFilter,
        }}
        onClose={() => setFiltersOpen(false)}
        onApply={handleApplyModalFilters}
      />

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
                codigo_pais: values.codigo_pais,
                email: values.email,
                direccion: values.direccion,
                tipo_documento_fiscal: values.tipo_documento_fiscal,
                numero_documento_fiscal: values.numero_documento_fiscal,
                condicion_iva_receptor_id: values.condicion_iva_receptor_id,
                fce_mipyme_alcanzado: values.fce_mipyme_alcanzado,
              });
            } else {
              await createEmpresa({
                nombre: values.nombre,
                cuit: values.cuit!,
                telefono: values.telefono,
                codigo_pais: values.codigo_pais,
                email: values.email,
                direccion: values.direccion,
                condicion_iva_receptor_id: values.condicion_iva_receptor_id,
                fce_mipyme_alcanzado: values.fce_mipyme_alcanzado,
              });
            }
            toast.success("Cliente creado", `${values.nombre} ${values.apellido ?? ""} se registró correctamente.`);
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
    gap: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  searchBar: {
    flexGrow: 1,
  },
  filterButton: {
    height: "40px",
    width: "48px",
    minWidth: "100px",
  },
  newButton: {
    height: "40px",
    width: "48px",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    width: "100%",
    gap: 12,
  },
  chipsContainer: css({
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  }),
  chipsGroup: css({
    display: "flex",
    gap: "8px",
    alignItems: "center",
  }),
  chipDivider: css({
    width: "1px",
    height: "20px",
    backgroundColor: COLOR.BORDER.SUBTLE,
    margin: "0 4px",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  chipBase: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "24px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "14px",
    transition:
      "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease, color 150ms ease",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      transform: "translateY(-1px)",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    },
  }),
  chipSelected: css({
    background: COLOR.BUTTON.PRIMARY.BACKGROUND,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    boxShadow: "none",
    fontWeight: 600,
    "&:hover": {
      color: COLOR.BUTTON.PRIMARY.TEXT,
    },
  }),
  chipSelectedDanger: css({
    background: COLOR.BACKGROUND.DANGER_TINT,
    borderColor: COLOR.SEMANTIC.DANGER,
    color: COLOR.SEMANTIC.DANGER,
    boxShadow: "none",
    fontWeight: 600,
    "&:hover": {
      borderColor: COLOR.SEMANTIC.DANGER,
    },
  }),
  chipSelectedSuccess: css({
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    borderColor: COLOR.SEMANTIC.SUCCESS,
    color: COLOR.SEMANTIC.SUCCESS,
    boxShadow: "none",
    fontWeight: 600,
    "&:hover": {
      borderColor: COLOR.SEMANTIC.SUCCESS,
    },
  }),
  chipSelectedInfo: css({
    background: "#eff6ff",
    borderColor: "#2563eb",
    color: "#1d4ed8",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#2563eb",
    },
  }),
  chipResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      fontSize: "13px",
      padding: "6px 10px",
    },
  }),
  clearButton: css({
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    padding: "6px 12px",
    borderRadius: "18px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    transition: "border-color 150ms ease, color 150ms ease",
    "&:hover": {
      borderColor: COLOR.BORDER.DEFAULT,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  emptyContainer: {
    padding: "48px 24px",
    textAlign: "center" as const,
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginTop: 8,
  },
  emptyText: {
    margin: 0,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 15,
  },
};
