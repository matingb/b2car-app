"use client";

import React, { useMemo, useState } from "react";
import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { PlusIcon, Building2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProveedorItemCard from "@/app/components/proveedores/ProveedorItemCard";
import ProveedorModal from "@/app/components/proveedores/ProveedorModal";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Proveedor } from "@/model/types";
import { css } from "@emotion/react";

type SaldoFilter = "" | "PENDIENTE" | "AL_DIA" | "A_FAVOR";

export default function ProveedoresTabContent() {
  const { proveedores, loading, createProveedor, updateProveedor } = useProveedores();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [saldoFilter, setSaldoFilter] = useState<SaldoFilter>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);

  const filteredProveedores = useMemo(() => {
    let list = proveedores;

    if (saldoFilter === "PENDIENTE") {
      list = list.filter((p) => (p.saldo_pendiente ?? 0) > 0);
    } else if (saldoFilter === "AL_DIA") {
      list = list.filter((p) => (p.saldo_pendiente ?? 0) === 0);
    } else if (saldoFilter === "A_FAVOR") {
      list = list.filter((p) => (p.saldo_pendiente ?? 0) < 0);
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.cuit && p.cuit.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q))
    );
  }, [proveedores, search, saldoFilter]);

  const handleOpenCreate = () => {
    setEditingProveedor(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProveedor(null);
  };

  const handleClearFilters = () => {
    setSaldoFilter("");
    setSearch("");
  };

  const hasActiveFilters = saldoFilter !== "" || search.trim() !== "";

  const handleSubmitModal = async (values: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }) => {
    if (editingProveedor) {
      await updateProveedor(editingProveedor.id, values);
      toast.success("Proveedor actualizado", `"${values.nombre}" se actualizó correctamente.`);
    } else {
      await createProveedor(values);
      toast.success("Proveedor creado", `"${values.nombre}" se agregó a tu lista de proveedores.`);
    }
  };

  return (
    <div>
      <div css={styles.toolbar}>
        <div style={styles.searchWrapper}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, CUIT, teléfono..."
            inputTestId="proveedores-search"
            style={styles.searchBar}
          />
        </div>

        <Can permission={Permission.ProveedoresEdit}>
          <Button
            icon={<PlusIcon size={18} />}
            text="Nuevo Proveedor"
            onClick={handleOpenCreate}
            dataTestId="proveedor-open-create"
            style={styles.newButton}
          />
        </Can>
      </div>

      {/* Filter Chips by Payment / Balance Status */}
      <div css={styles.chipsContainer} aria-label="Filtrar por estado de pago">
        <div css={styles.chipsGroup}>
          <button
            type="button"
            data-testid="proveedores-chip-saldo-pendiente"
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
            data-testid="proveedores-chip-saldo-al-dia"
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
            data-testid="proveedores-chip-saldo-a-favor"
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
            onClick={handleClearFilters}
            css={styles.clearButton}
            data-testid="proveedores-clear-filters"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div style={styles.resultsHeader}>
        <h2 style={styles.resultsTitle}>Listado</h2>
        <span style={styles.resultsCount}>
          {hasActiveFilters && proveedores.length !== filteredProveedores.length
            ? `${filteredProveedores.length} de ${proveedores.length} proveedores`
            : `${filteredProveedores.length} ${filteredProveedores.length === 1 ? "proveedor" : "proveedores"}`}
        </span>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filteredProveedores.length === 0 ? (
        <Card style={styles.emptyCard}>
          <div style={styles.emptyContent}>
            <div style={styles.emptyIcon}>
              <Building2 size={36} color={COLOR.ACCENT.PRIMARY} />
            </div>
            <div style={styles.emptyTitle}>
              {hasActiveFilters
                ? "No se encontraron proveedores"
                : "No tenés proveedores registrados"}
            </div>
            <div style={styles.emptySub}>
              {hasActiveFilters
                ? "Probá ajustando la búsqueda o los filtros de estado de pago."
                : "Agregá tu primer proveedor con el botón '+ Nuevo Proveedor'."}
            </div>
            {hasActiveFilters ? (
              <div style={{ marginTop: 16 }}>
                <Button
                  text="Limpiar filtros"
                  outline
                  onClick={handleClearFilters}
                  dataTestId="proveedores-empty-clear-btn"
                />
              </div>
            ) : (
              <Can permission={Permission.ProveedoresEdit}>
                <div style={{ marginTop: 16 }}>
                  <Button
                    icon={<PlusIcon size={18} />}
                    text="Nuevo Proveedor"
                    onClick={handleOpenCreate}
                  />
                </div>
              </Can>
            )}
          </div>
        </Card>
      ) : (
        <div style={styles.list}>
          {filteredProveedores.map((p) => (
            <ProveedorItemCard
              key={p.id}
              proveedor={p}
              onEdit={handleOpenEdit}
            />
          ))}
        </div>
      )}

      <ProveedorModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        initialValues={editingProveedor}
      />
    </div>
  );
}

const styles = {
  toolbar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  searchWrapper: {
    flex: 1,
    minWidth: 0,
  },
  searchBar: {
    width: "100%",
  },
  newButton: {
    whiteSpace: "nowrap" as const,
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
    marginBottom: 16,
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
  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  resultsCount: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  emptyCard: {
    background: COLOR.BACKGROUND.SECONDARY,
    padding: "48px 24px",
  },
  emptyContent: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: COLOR.STATUS.INFO.BG_SUBTLE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    maxWidth: 420,
  },
};
