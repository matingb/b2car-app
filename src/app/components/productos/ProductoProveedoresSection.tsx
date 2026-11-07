"use client";

import React, { useCallback, useEffect, useState } from "react";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import Table from "@/app/components/ui/Table";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import NumberInput from "@/app/components/ui/NumberInput";
import Toggle from "@/app/components/ui/Toggle";
import { LoaderCircle, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
    <div>
      <div style={styles.header}>
        <div>
          <div style={styles.titleGroup}>
            <h3 style={styles.sectionTitle}>Proveedores asociados</h3>
            <span style={styles.countBadge}>
              {items.length} {items.length === 1 ? "proveedor" : "proveedores"}
            </span>
          </div>
          <p style={styles.sectionDescription}>
            Configuración y costos de compra según cada proveedor.
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          text="Asociar proveedor"
          onClick={handleOpenAdd}
          outline
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
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Head>PROVEEDOR</Table.Head>
            <Table.Head>CÓD. PROVEEDOR</Table.Head>
            <Table.Head align="right">COSTO REF.</Table.Head>
            <Table.Head align="center">PREDETERMINADO</Table.Head>
            <Table.Head align="right" style={styles.thAcciones}>
              ACCIONES
            </Table.Head>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.proveedor_id}>
                <Table.Cell>
                  <Link
                    href={ROUTES.proveedorDetalle(item.proveedor_id)}
                    style={styles.proveedorLink}
                    title="Ver ficha del proveedor"
                  >
                    {item.proveedor_nombre}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  {item.codigo_proveedor ? (
                    <span style={styles.codeBadge}>{item.codigo_proveedor}</span>
                  ) : (
                    <span style={styles.mutedText}>-</span>
                  )}
                </Table.Cell>
                <Table.Cell align="right">
                  <span style={styles.costoText}>
                    {formatArs(item.costo_referencia, { maxDecimals: 0, minDecimals: 0 })}
                  </span>
                </Table.Cell>
                <Table.Cell align="center">
                  {item.es_predeterminado ? (
                    <span style={styles.starBadge}>
                      <Star size={12} fill={COLOR.STATUS.WARNING.SOLID_BG} color={COLOR.STATUS.WARNING.SOLID_BG} />
                      <span>Sí</span>
                    </span>
                  ) : (
                    <span style={styles.mutedText}>No</span>
                  )}
                </Table.Cell>
                <Table.Cell align="right">
                  <div style={styles.actionButtons}>
                    <IconButton
                      icon={<Pencil />}
                      size={15}
                      onClick={() => handleOpenEdit(item)}
                      title="Editar costos / códigos"
                      ariaLabel={`Editar ${item.proveedor_nombre}`}
                      aria-label={`Editar ${item.proveedor_nombre}`}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      size={15}
                      onClick={() => handleDelete(item)}
                      title="Desvincular proveedor"
                      ariaLabel={`Desvincular ${item.proveedor_nombre}`}
                      aria-label={`Desvincular ${item.proveedor_nombre}`}
                      hoverColor={COLOR.ICON.DANGER}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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
    </div>
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
            placeholder="Ej: BR-1049, COD-99"
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap" as const,
    gap: 10,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  sectionDescription: {
    margin: "-3px 0 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: 500,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    padding: "2px 8px",
    borderRadius: 9999,
  },
  loadingWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "32px 0",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "32px 20px",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 12,
    border: `1px dashed ${COLOR.BORDER.SUBTLE}`,
  },
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  proveedorLink: {
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    textDecoration: "none",
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
    gap: 4,
  },
  thAcciones: {
    width: 90,
    paddingRight: 16,
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
