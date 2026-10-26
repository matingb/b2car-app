"use client";

import React, { useMemo, useState } from "react";
import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { PlusIcon, Building2 } from "lucide-react";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProveedorItemCard from "@/app/components/proveedores/ProveedorItemCard";
import ProveedorModal from "@/app/components/proveedores/ProveedorModal";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Proveedor } from "@/model/types";
import { css } from "@emotion/react";

export default function ProveedoresTabContent() {
  const { proveedores, loading, createProveedor, updateProveedor } = useProveedores();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);

  const filteredProveedores = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.cuit && p.cuit.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q))
    );
  }, [proveedores, search]);

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

      <div style={styles.resultsHeader}>
        <h2 style={styles.resultsTitle}>Listado</h2>
        <span style={styles.resultsCount}>
          {filteredProveedores.length} {filteredProveedores.length === 1 ? "proveedor" : "proveedores"}
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
              {search.trim() ? "No se encontraron proveedores" : "No tenés proveedores registrados"}
            </div>
            <div style={styles.emptySub}>
              {search.trim()
                ? "Probá ajustando los términos de búsqueda."
                : "Agregá tu primer proveedor con el botón '+ Nuevo Proveedor'."}
            </div>
            {!search.trim() && (
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
    marginBottom: 20,
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
