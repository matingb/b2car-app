"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useProductos } from "@/app/providers/ProductosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProductoFormFields, { ProductoFormFieldsValues } from "@/app/components/productos/ProductoFormFields";

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

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const [values, setValues] = useState<ProductoFormFieldsValues>({
    nombre: "",
    codigo: "",
    proveedor: "",
    ubicacion: "",
    precioCompra: 0,
    precioVenta: 0,
    categorias: [],
  })

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const { producto: created, error: createError } = await createProducto({
      nombre: values.nombre.trim(),
      codigo: values.codigo.trim(),
      proveedor: values.proveedor.trim(),
      ubicacion: values.ubicacion.trim(),
      categorias: values.categorias,
      precioUnitario: values.precioVenta,
      costoUnitario: values.precioCompra,
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
      disabledSubmit={!isValid}
      modalError={
        submitError
          ? { titulo: "Error al crear producto", descripcion: submitError }
          : null
      }
      modalStyle={{ overflowY: "auto" }}
    >
      <ProductoFormFields
          categoriasDisponibles={categoriasDisponibles}
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          onValidityChange={(isValid) => setIsValid(isValid)}
        />
    </Modal>
  );
}
