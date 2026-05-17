"use client";

import { useCallback, useRef, useState } from "react";
import type {
  RepuestoLinea,
  RepuestoUpsertInput,
} from "@/app/components/arreglos/lineas/repuestos/RepuestoLineasEditableSection";

const NEW_PRODUCT_VALUE = "__nuevo_producto__";

export function useRepuestosDraft() {
  const [items, setItems] = useState<RepuestoLinea[]>([]);
  const seq = useRef(0);

  const newId = useCallback(() => {
    seq.current += 1;
    return `rep-${seq.current}`;
  }, []);

  const onUpsert = useCallback(
    (input: RepuestoUpsertInput) => {
      setItems((prev) => {
        if (input.tipo === "nuevo") {
          const idx = input.id
            ? prev.findIndex((r) => r.id === input.id)
            : prev.findIndex(
                (r) =>
                  r.tipo === "nuevo" &&
                  r.nuevoProducto?.codigo.trim().toLowerCase() === input.codigo.trim().toLowerCase()
              );
          const nextItem: RepuestoLinea = {
            id: idx >= 0 ? prev[idx].id : newId(),
            tipo: "nuevo",
            stock_id: NEW_PRODUCT_VALUE,
            cantidad: input.cantidad,
            monto_unitario: input.precio_venta,
            producto: { nombre: input.nombre, codigo: input.codigo },
            nuevoProducto: {
              codigo: input.codigo,
              nombre: input.nombre,
              precioCompra: input.precio_compra,
              precioVenta: input.precio_venta,
            },
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = nextItem;
            return next;
          }
          return [...prev, nextItem];
        }

        const idx = prev.findIndex((r) => r.stock_id === input.stock_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            cantidad: input.cantidad,
            monto_unitario: input.monto_unitario,
            precioCompra: input.precio_compra,
          };
          return next;
        }
        return [
          ...prev,
          {
            id: newId(),
            stock_id: input.stock_id,
            cantidad: input.cantidad,
            monto_unitario: input.monto_unitario,
            precioCompra: input.precio_compra,
            producto: null,
          },
        ];
      });
    },
    [newId]
  );

  const onDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    seq.current = 0;
  }, []);

  return { items, onUpsert, onDelete, reset } as const;
}

