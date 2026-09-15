"use client";

import React, { useState, useEffect } from "react";
import { useClientes } from "@/app/providers/ClientesProvider";
import ClienteFormModal from "@/app/components/clientes/ClienteFormModal";
import ClienteItem from "@/app/components/clientes/ClienteItem";
import ClientesFiltersModal, { ClientesFilters } from "@/app/components/clientes/ClientesFiltersModal";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import ScrollPage from "@/app/components/ui/ScrollPage";
import { PlusIcon, Filter, User, Building2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useToast } from "@/app/providers/ToastProvider";
import { TipoCliente } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

const LIMIT_STEP = 50;

export default function ClientesPage() {
  const { clientes, loading, hasMore = false, fetchAll, createParticular, createEmpresa } = useClientes();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [tipoClienteFilter, setTipoClienteFilter] = useState<"" | "particular" | "empresa">("");
  const [saldoFilter, setSaldoFilter] = useState<"" | "PENDIENTE" | "AL_DIA" | "A_FAVOR">("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(LIMIT_STEP);

  const searchTrimmed = search.trim();

  useEffect(() => {
    setLimit(LIMIT_STEP);
  }, [searchTrimmed, tipoClienteFilter, saldoFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (typeof fetchAll !== "function") return;
      void fetchAll({
        limit,
        search: searchTrimmed || undefined,
        tipo: tipoClienteFilter || undefined,
        saldo: saldoFilter || undefined,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAll, limit, searchTrimmed, tipoClienteFilter, saldoFilter]);

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

      {loading && clientes.length === 0 ? (
        <ListSkeleton />
      ) : clientes.length === 0 ? (
        <div style={styles.emptyContainer} data-testid="clientes-empty-state">
          <p style={styles.emptyText}>No se encontraron clientes para los filtros aplicados.</p>
        </div>
      ) : (
        <ScrollPage
          loadingMore={loading && clientes.length > 0}
          hasMore={hasMore}
          onLoadMore={() => setLimit((current) => current + LIMIT_STEP)}
          loadingMoreLabel="Cargando más clientes..."
        >
          <div style={styles.list}>
            {clientes.map((cliente) => (
              <ClienteItem key={cliente.id} cliente={cliente} />
            ))}
          </div>
        </ScrollPage>
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
                dni_cuil: values.dni_cuil,
              });
            } else {
              await createEmpresa({
                nombre: values.nombre,
                cuit: values.cuit!,
                telefono: values.telefono,
                codigo_pais: values.codigo_pais,
                email: values.email,
                direccion: values.direccion,
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
    gap: "8px",
    alignItems: "center",
    width: "100%",
    overflowX: "auto",
    flexWrap: "nowrap",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    paddingBottom: 4,
    paddingTop: 2,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flexWrap: "wrap",
      overflowX: "visible",
    },
  }),
  chipsGroup: css({
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexShrink: 0,
  }),
  chipDivider: css({
    width: "1px",
    height: "20px",
    backgroundColor: COLOR.BORDER.SUBTLE,
    margin: "0 4px",
    flexShrink: 0,
  }),
  chipBase: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    height: "34px",
    borderRadius: "999px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "13px",
    whiteSpace: "nowrap",
    flexShrink: 0,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    transition:
      "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease, color 150ms ease",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      transform: "translateY(-1px)",
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
    },
    "&:active": {
      transform: "scale(0.97)",
    },
    "& svg": {
      flexShrink: 0,
      color: COLOR.ICON.MUTED,
      transition: "color 150ms ease",
    },
  }),
  chipSelected: css({
    background: COLOR.BUTTON.PRIMARY.BACKGROUND,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    boxShadow: "none",
    fontWeight: 600,
    "& svg": {
      color: "currentColor",
    },
    "&:hover": {
      color: COLOR.BUTTON.PRIMARY.TEXT,
      background: COLOR.ACCENT.HOVER,
      borderColor: COLOR.ACCENT.HOVER,
    },
  }),
  chipSelectedDanger: css({
    background: COLOR.BACKGROUND.DANGER_TINT,
    borderColor: COLOR.SEMANTIC.DANGER,
    color: COLOR.SEMANTIC.DANGER,
    boxShadow: "none",
    fontWeight: 600,
    "& svg": {
      color: COLOR.SEMANTIC.DANGER,
    },
    "&:hover": {
      borderColor: COLOR.SEMANTIC.DANGER,
      background: COLOR.BACKGROUND.DANGER_TINT,
    },
  }),
  chipSelectedSuccess: css({
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    borderColor: COLOR.SEMANTIC.SUCCESS,
    color: COLOR.SEMANTIC.SUCCESS,
    boxShadow: "none",
    fontWeight: 600,
    "& svg": {
      color: COLOR.SEMANTIC.SUCCESS,
    },
    "&:hover": {
      borderColor: COLOR.SEMANTIC.SUCCESS,
      background: COLOR.BACKGROUND.SUCCESS_TINT,
    },
  }),
  chipSelectedInfo: css({
    background: COLOR.BACKGROUND.INFO_TINT,
    borderColor: COLOR.SEMANTIC.INFO,
    color: COLOR.SEMANTIC.INFO,
    boxShadow: "none",
    fontWeight: 600,
    "& svg": {
      color: COLOR.SEMANTIC.INFO,
    },
    "&:hover": {
      borderColor: COLOR.SEMANTIC.INFO,
      background: COLOR.BACKGROUND.INFO_TINT,
    },
  }),
  chipResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: "12px",
      padding: "5px 11px",
      height: "32px",
    },
  }),
  clearButton: css({
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    padding: "5px 12px",
    height: "32px",
    borderRadius: "999px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "border-color 150ms ease, color 150ms ease, background-color 150ms ease",
    "&:hover": {
      borderColor: COLOR.BORDER.DEFAULT,
      color: COLOR.TEXT.PRIMARY,
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
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
