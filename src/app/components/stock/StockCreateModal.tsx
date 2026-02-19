"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useProductos } from "@/app/providers/ProductosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import StockFormFields, { CREATE_PRODUCTO_VALUE, StockFormFieldsValues } from "./StockFormFields";

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
  const { createProducto, isLoading: loadingProductos } = useProductos();
  const { upsertStock, isLoading: loadingStock } = useInventario();
  const toast = useToast();

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [valuesStock, setValuesStock] = useState<StockFormFieldsValues>({
    productId: "",
    productDraft: {
      nombre: "",
      codigo: "",
      proveedor: "",
      ubicacion: "",
      precioCompra: 0,
      precioVenta: 0,
      categorias: [],
    },
    stockActual: 0,
    stockMinimo: 0,
    stockMaximo: 0,
  });

  useEffect(() => {
    if (!open) return;
    setValuesStock({
      productId: "",
      productDraft: {
        nombre: "",
        codigo: "",
        proveedor: "",
        ubicacion: "",
        precioCompra: 0,
        precioVenta: 0,
        categorias: [],
      },
      stockActual: 0,
      stockMinimo: 0,
      stockMaximo: 0,
    });
    setSubmitError(null);
  }, [open]);

  const [isValidStock, setIsValidStock] = useState(false);

  const canSubmit = useMemo(() => isValidStock, [isValidStock]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const stockActualN = valuesStock.stockActual === 0 ? undefined : valuesStock.stockActual;
    const stockMinimoN = valuesStock.stockMinimo === 0 ? undefined : valuesStock.stockMinimo;
    const stockMaximoN = valuesStock.stockMaximo === 0 ? undefined : valuesStock.stockMaximo;

    try {
      if (!valuesStock.productId.trim()) {
        setSubmitError("Debe seleccionar un producto");
        return;
      }

      let productId = valuesStock.productId;

      if (valuesStock.productId === CREATE_PRODUCTO_VALUE) {
        const { producto, error } = await createProducto({
          nombre: valuesStock.productDraft.nombre.trim(),
          codigo: valuesStock.productDraft.codigo.trim(),
          proveedor: valuesStock.productDraft.proveedor.trim(),
          ubicacion: valuesStock.productDraft.ubicacion.trim(),
          categorias: valuesStock.productDraft.categorias,
          precioUnitario: valuesStock.productDraft.precioVenta,
          costoUnitario: valuesStock.productDraft.precioCompra,
        });

        if (!producto) {
          setSubmitError(error ?? "No se pudo crear el producto");
          return;
        }

        productId = producto.id;
      }

      const createdStock = await upsertStock({
        productoId: productId,
        tallerId,
        stockActual: stockActualN,
        stockMinimo: stockMinimoN,
        stockMaximo: stockMaximoN,
      });
      if (!createdStock) {
        setSubmitError("No se pudo crear el stock");
        return;
      }

      toast.success("Stock creado satisfactoriamente");
      onClose();
      onCreated?.(createdStock.id);
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
      submitting={loadingStock || loadingProductos}
      disabledSubmit={!canSubmit}
      modalError={submitError ? { titulo: "Se produjo un error al crear.", descripcion: submitError } : null}
      modalStyle={{ overflowY: "auto" }}
    >
      <StockFormFields
        categoriasDisponibles={categoriasDisponibles}
        values={valuesStock}
        onChange={(patch) => {
          setValuesStock((prev) => ({ ...prev, ...patch }));
        }}
        onValidityChange={(isValid) => setIsValidStock(isValid)}
      />
    </Modal>
  );
}

