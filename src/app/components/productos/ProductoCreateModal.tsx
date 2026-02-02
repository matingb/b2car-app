"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useProductos } from "@/app/providers/ProductosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProductoFormFields from "@/app/components/productos/ProductoFormFields";

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
  const { success } = useToast();

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [precioCompra, setPrecioCompra] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre("");
    setCodigo("");
    setProveedor("");
    setUbicacion("");
    setPrecioCompra(0);
    setPrecioVenta(0);
    setCategorias([]);
    setSubmitError(null);
  }, [open]);

  const canSubmit = useMemo(() => {
    return Boolean(nombre.trim() && codigo.trim() && precioCompra >= 0 && precioVenta >= 0);
  }, [nombre, codigo, precioCompra, precioVenta]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const { producto: created, error: createError } = await createProducto({
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      proveedor: proveedor.trim(),
      ubicacion: ubicacion.trim(),
      categorias,
      precioUnitario: precioVenta,
      costoUnitario: precioCompra,
    });

    if (created) {
      success("Producto creado satisfactoriamente");
      onClose();
      return;
    }

    setSubmitError(createError ?? "Ocurrió un error al crear el producto");
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
      modalError={
        submitError
          ? { titulo: "Error al crear producto", descrippcion: submitError }
          : null
      }
      modalStyle={{ overflowY: "auto" }}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <ProductoFormFields
          categoriasDisponibles={categoriasDisponibles}
          values={{
            nombre,
            codigo,
            proveedor,
            ubicacion,
            precioCompra,
            precioVenta,
            categorias,
          }}
          onChange={(patch) => {
            if (patch.nombre !== undefined) setNombre(patch.nombre);
            if (patch.codigo !== undefined) setCodigo(patch.codigo);
            if (patch.proveedor !== undefined) setProveedor(patch.proveedor);
            if (patch.ubicacion !== undefined) setUbicacion(patch.ubicacion);
            if (patch.precioCompra !== undefined) setPrecioCompra(patch.precioCompra);
            if (patch.precioVenta !== undefined) setPrecioVenta(patch.precioVenta);
            if (patch.categorias !== undefined) setCategorias(patch.categorias);
          }}
        />
      </div>
    </Modal>
  );
}
