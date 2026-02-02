"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import FilterChip from "@/app/components/ui/FilterChip";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { useProductos } from "@/app/providers/ProductosProvider";
import { useToast } from "@/app/providers/ToastProvider";

type Props = {
  open: boolean;
  categoriasDisponibles: readonly string[];
  onClose: () => void;
};

export default function ProductoCreateModal({
  open,
  categoriasDisponibles,
  onClose,
}: Props) {
  const { createProducto, isLoading } = useProductos();
  const { success, error } = useToast();

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [precioCompra, setPrecioCompra] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNombre("");
    setCodigo("");
    setProveedor("");
    setUbicacion("");
    setPrecioCompra(0);
    setPrecioVenta(0);
    setCategorias([]);
  }, [open]);

  const canSubmit = useMemo(() => {
    return Boolean(nombre.trim() && codigo.trim() && precioCompra >= 0 && precioVenta >= 0);
  }, [nombre, codigo, precioCompra, precioVenta]);

  if (!open) return null;

  const toggleCategoria = (cat: string) => {
    setCategorias((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createProducto({
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      proveedor: proveedor.trim(),
      ubicacion: ubicacion.trim(),
      categorias,
      precioUnitario: precioVenta,
      costoUnitario: precioCompra,
    });

    if (created) success("Producto creado satisfactoriamente");
    else error("Ocurrió un error al crear el producto");

    onClose();
  };

  return (
    <Modal
      open={open}
      title="Nuevo producto"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Crear"
      submitting={isLoading}
      disabledSubmit={!canSubmit}
      modalStyle={{ overflowY: "auto" }}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.fieldWide}>
            <label style={styles.label}>
              Nombre <span aria-hidden="true" style={styles.required}>*</span>
            </label>
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
            <label style={styles.label}>
              Código <span aria-hidden="true" style={styles.required}>*</span>
            </label>
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
              min={0}
              style={styles.input}
              value={precioCompra}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPrecioCompra(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              placeholder="0"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Precio venta</label>
            <input
              type="number"
              min={0}
              style={styles.input}
              value={precioVenta}
              onChange={(e) => setPrecioVenta(Number(e.target.value))}
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
      </div>
    </Modal>
  );
}

const styles = {
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
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
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

