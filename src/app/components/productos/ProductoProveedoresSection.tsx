"use client";

import React, { useCallback, useEffect, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import NumberInput from "@/app/components/ui/NumberInput";
import Toggle from "@/app/components/ui/Toggle";
import { Building2, Edit2, LoaderCircle, Plus, Star, Trash2 } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { productosClient } from "@/clients/productosClient";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { ProductoProveedorDTO } from "@/model/dtos";
import { formatArs } from "@/lib/format";
import Link from "next/link";
import { ROUTES } from "@/routing/routes";

export type ProductoProveedoresSectionProps = {
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  costoUnitario?: number;
  onProveedoresChange?: (count: number) => void;
};

export default function ProductoProveedoresSection({
  productoId,
  productoNombre,
  productoCodigo,
  costoUnitario = 0,
  onProveedoresChange,
}: ProductoProveedoresSectionProps) {
  const modal = useModalMessage();
  const toast = useToast();
  const { proveedores } = useProveedores();

  const [items, setItems] = useState<ProductoProveedorDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductoProveedorDTO | null>(null);

  const loadProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productosClient.getProveedores(productoId);
      if (res.error) throw new Error(res.error);
      const list = res.data ?? [];
      setItems(list);
      onProveedoresChange?.(list.length);
    } catch (err: unknown) {
      toast.error(
        "Error cargando proveedores",
        err instanceof Error ? err.message : "No se pudo obtener los proveedores del producto"
      );
    } finally {
      setLoading(false);
    }
  }, [productoId, onProveedoresChange, toast]);

  useEffect(() => {
    void loadProveedores();
  }, [loadProveedores]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: ProductoProveedorDTO) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: ProductoProveedorDTO) => {
    const ok = await modal.confirm({
      title: "Desvincular proveedor",
      message: `¿Estás seguro de que querés desvincular a "${item.proveedor_nombre}" de este producto?`,
      acceptLabel: "Desvincular",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      const res = await proveedoresClient.desvincularProducto(item.proveedor_id, productoId);
      if (res.error) throw new Error(res.error);
      toast.success("Proveedor desvinculado", "El vínculo fue eliminado correctamente.");
      void loadProveedores();
    } catch (err: unknown) {
      toast.error(
        "Error al desvincular",
        err instanceof Error ? err.message : "No se pudo desvincular el proveedor"
      );
    }
  };

  return (
    <Card style={styles.cardContainer}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <Building2 size={18} color={COLOR.ACCENT.PRIMARY} />
          <h3 style={styles.title}>Proveedores asociados</h3>
          <span style={styles.countBadge}>
            {items.length} {items.length === 1 ? "proveedor" : "proveedores"}
          </span>
        </div>
        <Button
          icon={<Plus size={15} />}
          text="Asociar proveedor"
          onClick={handleOpenAdd}
          outline
          style={styles.addButton}
          dataTestId="btn-asociar-proveedor"
        />
      </div>

      {loading ? (
        <div style={styles.loadingWrapper}>
          <LoaderCircle className="animate-spin" size={24} color={COLOR.ACCENT.PRIMARY} />
        </div>
      ) : items.length === 0 ? (
        <div style={styles.emptyContainer}>
          <p style={styles.emptyText}>
            Este producto aún no está vinculado a ningún proveedor.
          </p>
          <Button
            icon={<Plus size={15} />}
            text="Vincular a un proveedor"
            onClick={handleOpenAdd}
            outline
          />
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Proveedor</th>
                <th style={styles.th}>Cód. Proveedor</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Costo Ref.</th>
                <th style={styles.th}>Predeterminado</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.proveedor_id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <Link
                      href={ROUTES.proveedorDetalle(item.proveedor_id)}
                      style={styles.proveedorLink}
                      title="Ver ficha del proveedor"
                    >
                      {item.proveedor_nombre}
                    </Link>
                  </td>
                  <td style={styles.td}>
                    {item.codigo_proveedor ? (
                      <span style={styles.codeBadge}>{item.codigo_proveedor}</span>
                    ) : (
                      <span style={styles.mutedText}>-</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <span style={styles.costoText}>
                      {formatArs(item.costo_referencia, { maxDecimals: 0, minDecimals: 0 })}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {item.es_predeterminado ? (
                      <span style={styles.starBadge}>
                        <Star size={12} fill={COLOR.STATUS.WARNING.SOLID_BG} color={COLOR.STATUS.WARNING.SOLID_BG} />
                        <span>Sí</span>
                      </span>
                    ) : (
                      <span style={styles.mutedText}>No</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <div style={styles.actionButtons}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        style={styles.iconButton}
                        title="Editar costos / códigos"
                        aria-label={`Editar ${item.proveedor_nombre}`}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        style={{ ...styles.iconButton, color: COLOR.ICON.DANGER }}
                        title="Desvincular proveedor"
                        aria-label={`Desvincular ${item.proveedor_nombre}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <ProductoAsociarProveedorModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          productoId={productoId}
          productoNombre={productoNombre}
          productoCodigo={productoCodigo}
          defaultCosto={costoUnitario}
          initialData={editingItem}
          proveedoresDisponibles={proveedores}
          proveedoresAsociadosIds={items.map((i) => i.proveedor_id)}
          onSuccess={() => {
            setModalOpen(false);
            setEditingItem(null);
            void loadProveedores();
          }}
        />
      ) : null}
    </Card>
  );
}

// Modal interno para vincular o editar la asociación
function ProductoAsociarProveedorModal({
  open,
  onClose,
  productoId,
  productoNombre,
  productoCodigo,
  defaultCosto,
  initialData,
  proveedoresDisponibles,
  proveedoresAsociadosIds,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  defaultCosto: number;
  initialData: ProductoProveedorDTO | null;
  proveedoresDisponibles: { id: string; nombre: string }[];
  proveedoresAsociadosIds: string[];
  onSuccess: () => void;
}) {
  const toast = useToast();
  const isEditing = Boolean(initialData);

  const [proveedorId, setProveedorId] = useState<string>(initialData?.proveedor_id || "");
  const [codigoProveedor, setCodigoProveedor] = useState<string>(initialData?.codigo_proveedor || "");
  const [costoReferencia, setCostoReferencia] = useState<number>(
    initialData?.costo_referencia !== undefined ? initialData.costo_referencia : defaultCosto
  );
  const [esPredeterminado, setEsPredeterminado] = useState<boolean>(Boolean(initialData?.es_predeterminado));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options: AutocompleteOption[] = proveedoresDisponibles
    .filter((p) => isEditing || !proveedoresAsociadosIds.includes(p.id))
    .map((p) => ({ value: p.id, label: p.nombre }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) {
      toast.error("Proveedor requerido", "Por favor seleccioná un proveedor.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const res = await proveedoresClient.actualizarProductoVinculado(proveedorId, productoId, {
          codigo_proveedor: codigoProveedor.trim() || null,
          costo_referencia: costoReferencia,
          es_predeterminado: esPredeterminado,
        });
        if (res.error) throw new Error(res.error);
        toast.success("Asociación actualizada", "Los datos del proveedor fueron actualizados.");
      } else {
        const res = await proveedoresClient.asociarProducto(proveedorId, {
          producto_id: productoId,
          codigo_proveedor: codigoProveedor.trim() || null,
          costo_referencia: costoReferencia,
          es_predeterminado: esPredeterminado,
        });
        if (res.error) throw new Error(res.error);
        toast.success("Proveedor vinculado", "El producto fue vinculado al proveedor exitosamente.");
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error(
        "Error al guardar asociación",
        err instanceof Error ? err.message : "Ocurrió un error inesperado"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar datos de compra" : "Asociar a un proveedor"}
      modalStyle={{ maxWidth: 460 }}
      hideFooter
      wrapInForm={false}
    >
      <div style={{ fontSize: 13, color: COLOR.TEXT.SECONDARY, marginTop: -8, marginBottom: 12 }}>
        {productoCodigo} - {productoNombre}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={modalStyles.label}>Proveedor *</label>
          {isEditing ? (
            <input
              style={{ ...modalStyles.input, background: COLOR.BACKGROUND.SUBTLE, cursor: "not-allowed" }}
              value={initialData?.proveedor_nombre || ""}
              disabled
            />
          ) : (
            <Autocomplete
              options={options}
              value={proveedorId}
              onChange={(val) => setProveedorId(val || "")}
              placeholder="Elegir proveedor..."
            />
          )}
        </div>

        <div>
          <label style={modalStyles.label}>Código en proveedor (opcional)</label>
          <input
            style={modalStyles.input}
            value={codigoProveedor}
            onChange={(e) => setCodigoProveedor(e.target.value)}
            placeholder="Ej: BR-1049, SKU-99"
          />
          <span style={modalStyles.hint}>El código que figura en el catálogo o factura del proveedor</span>
        </div>

        <div>
          <label style={modalStyles.label}>Costo de referencia (ARS)</label>
          <NumberInput
            minValue={0}
            value={costoReferencia}
            onValueChange={setCostoReferencia}
          />
          <span style={modalStyles.hint}>Costo base sugerido al comprar a este proveedor</span>
        </div>

        <div style={modalStyles.toggleRow}>
          <div>
            <div style={modalStyles.toggleLabel}>Proveedor predeterminado</div>
            <div style={modalStyles.toggleHint}>Se seleccionará por defecto al comprar repuestos</div>
          </div>
          <Toggle
            checked={esPredeterminado}
            onChange={setEsPredeterminado}
            label="Marcar como proveedor predeterminado"
          />
        </div>

        <div style={modalStyles.actions}>
          <Button
            text="Cancelar"
            onClick={onClose}
            outline
            disabled={isSubmitting}
            type="button"
          />
          <Button
            text={isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Asociar"}
            disabled={isSubmitting || !proveedorId}
            type="submit"
          />
        </div>
      </form>
    </Modal>
  );
}

const styles = {
  cardContainer: {
    padding: "20px 24px",
    background: COLOR.BACKGROUND.PRIMARY,
    borderRadius: 16,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: 500,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    padding: "2px 8px",
    borderRadius: 9999,
  },
  addButton: {
    fontSize: 13,
    padding: "6px 14px",
  },
  loadingWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "24px 0",
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "24px 16px",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 12,
    border: `1px dashed ${COLOR.BORDER.SUBTLE}`,
  },
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  tableWrapper: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  },
  tableHeaderRow: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px 10px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  tableRow: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  td: {
    padding: "12px",
    verticalAlign: "middle" as const,
    color: COLOR.TEXT.PRIMARY,
  },
  proveedorLink: {
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    textDecoration: "none",
    transition: "color 150ms ease",
    "&:hover": {
      color: COLOR.ACCENT.PRIMARY,
    },
  },
  codeBadge: {
    fontFamily: "monospace",
    fontSize: 12,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    padding: "2px 6px",
    borderRadius: 4,
  },
  costoText: {
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  starBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    background: COLOR.STATUS.WARNING.BG_SUBTLE,
    color: COLOR.STATUS.WARNING.TEXT,
    padding: "2px 8px",
    borderRadius: 9999,
  },
  mutedText: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  actionButtons: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    color: COLOR.TEXT.SECONDARY,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 150ms ease, color 150ms ease",
    "&:hover": {
      background: COLOR.BACKGROUND.SUBTLE,
      color: COLOR.TEXT.PRIMARY,
    },
  },
};

const modalStyles = {
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: 14,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
  },
  hint: {
    display: "block",
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    marginTop: 4,
  },
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "12px 14px",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
  },
  toggleHint: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
};
