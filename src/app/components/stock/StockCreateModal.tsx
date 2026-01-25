"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import FilterChip from "@/app/components/ui/FilterChip";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useProductos } from "@/app/providers/ProductosProvider";

const CREATE_PRODUCTO_VALUE = "__create_producto__";

type Props = {
  open: boolean;
  categoriasDisponibles: readonly string[];
  tallerId: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

export default function StockCreateModal({
  open,
  categoriasDisponibles,
  tallerId,
  onClose,
  onCreated,
}: Props) {
  const { productos, createProducto, isLoading } = useProductos();
  const { upsertStock } = useInventario();
  const toast = useToast();

  const [productoId, setProductoId] = useState("");
  const isCreatingProducto = productoId === CREATE_PRODUCTO_VALUE;
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Producto (solo si isCreatingProducto = true)
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [precioUnitario, setPrecioUnitario] = useState<number>(0);
  const [costoUnitario, setCostoUnitario] = useState<number>(0);
  const [categorias, setCategorias] = useState<string[]>([]);

  // Stock (opcional)
  const [stockActual, setStockActual] = useState<string>("");
  const [stockMinimo, setStockMinimo] = useState<string>("");
  const [stockMaximo, setStockMaximo] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setProductoId("");
    setNombre("");
    setCodigo("");
    setProveedor("");
    setUbicacion("");
    setPrecioUnitario(0);
    setCostoUnitario(0);
    setCategorias([]);
    setStockActual("");
    setStockMinimo("");
    setStockMaximo("");
    setSubmitError(null);
  }, [open]);

  const canSubmit = useMemo(() => {
    if (isCreatingProducto) return Boolean(nombre.trim() && codigo.trim());
    return Boolean(productoId.trim());
  }, [isCreatingProducto, nombre, codigo, productoId]);

  const productoOptions = useMemo<AutocompleteOption[]>(() => {
    return [
      { value: CREATE_PRODUCTO_VALUE, label: "+ Crear producto", secondaryLabel: "Cargar datos del producto nuevo" },
      ...productos.map((p) => ({
        value: p.id,
        label: p.nombre,
        secondaryLabel: p.codigo,
      })),
    ];
  }, [productos]);

  if (!open) return null;

  const toggleCategoria = (cat: string) => {
    setCategorias((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const parseOptionalNumber = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const stockActualN = parseOptionalNumber(stockActual);
    const stockMinimoN = parseOptionalNumber(stockMinimo);
    const stockMaximoN = parseOptionalNumber(stockMaximo);

    try {
      if (isCreatingProducto) {
        const createdProducto = await createProducto({
          nombre: nombre.trim(),
          codigo: codigo.trim(),
          proveedor: proveedor.trim(),
          ubicacion: ubicacion.trim(),
          categorias,
          precioUnitario: precioUnitario,
          costoUnitario: costoUnitario,
        });
        if (!createdProducto) {
          setSubmitError("No se pudo crear el producto");
          return;
        }
        const createdStock = await upsertStock({
          productoId: createdProducto.id,
          tallerId,
          stockActual: stockActualN,
          stockMinimo: stockMinimoN,
          stockMaximo: stockMaximoN,
        });
        if (createdStock) {
          onCreated?.(createdStock.id);
          toast.success("Stock creado satisfactoriamente");
        }
        onClose();
        return;
      }

      const createdStock = await upsertStock({
        productoId,
        tallerId,
        stockActual: stockActualN,
        stockMinimo: stockMinimoN,
        stockMaximo: stockMaximoN,
      });
      if (createdStock) {
        onCreated?.(createdStock.id);
        toast.success("Stock creado satisfactoriamente");
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el stock";
      setSubmitError(message);
    }
  };

  return (
    <Modal
      open={open}
      title="Nuevo stock"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Crear"
      submitting={isLoading}
      disabledSubmit={!canSubmit}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.fieldWide}>
            <label style={styles.label}>Producto</label>
            <Autocomplete
              options={productoOptions}
              value={productoId}
              onChange={(v) => {
                setProductoId(v);
                setSubmitError(null);
              }}
              placeholder="Buscar o crear producto..."
              dataTestId="stock-create-modal-producto-autocomplete"
            />
          </div>
        </div>

        {isCreatingProducto && (
          <>
            <div css={styles.row}>
              <div style={styles.fieldWide}>
                <label style={styles.label}>Nombre</label>
                <input
                  style={styles.input}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Aceite Motor 10W40 Sintético"
                />
              </div>
            </div>

            <div css={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Código</label>
                <input
                  style={styles.input}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: ACE-10W40-SIN"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Proveedor</label>
                <input
                  style={styles.input}
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej: Lubricantes del Sur"
                />
              </div>
            </div>

            <div css={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Ubicación</label>
                <input
                  style={styles.input}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Estante A-1"
                />
              </div>
              <div style={styles.field} />
            </div>

            <div css={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Precio compra</label>
                <input
                  type="number"
                  style={styles.input}
                  value={precioUnitario}
                  onChange={(e) => setPrecioUnitario(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Precio venta</label>
                <input
                  type="number"
                  style={styles.input}
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div css={styles.row}>
              <div style={styles.fieldWide}>
                <label style={styles.label}>Categorías</label>
                <div css={styles.chips}>
                  {categoriasDisponibles.map((cat) => (
                    <FilterChip
                      key={cat}
                      text={cat}
                      selected={categorias.includes(cat)}
                      onClick={() => toggleCategoria(cat)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Cantidad actual (opcional)</label>
            <input
              type="number"
              style={styles.input}
              value={stockActual}
              onChange={(e) => setStockActual(e.target.value)}
              placeholder="Ej: 12"
            />
          </div>
          <div style={styles.field} />
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Mínimo (opcional)</label>
            <input
              type="number"
              style={styles.input}
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="Ej: 5"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Máximo (opcional)</label>
            <input
              type="number"
              style={styles.input}
              value={stockMaximo}
              onChange={(e) => setStockMaximo(e.target.value)}
              placeholder="Ej: 50"
            />
          </div>
        </div>
      </div>
      {submitError ? (
        <div style={styles.errorBox} role="alert" data-testid="stock-create-modal-error">
          {submitError}
        </div>
      ) : null}
    </Modal>
  );
}

const styles = {
  errorBox: {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${COLOR.ICON.DANGER}`,
    background: "rgba(139, 0, 0, 0.08)",
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    lineHeight: 1.35,
  },
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  field: { flex: 1 },
  fieldWide: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  chips: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }),
} as const;

