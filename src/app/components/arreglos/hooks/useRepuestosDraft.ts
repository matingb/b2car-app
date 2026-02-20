"use client";

import { useCallback, useRef, useState } from "react";
import type { RepuestoLinea } from "@/app/components/arreglos/lineas/RepuestoLineasEditableSection";

type UpsertInput = { stock_id: string; cantidad: number; monto_unitario: number };

export function useRepuestosDraft() {
  const [items, setItems] = useState<RepuestoLinea[]>([]);
  const seq = useRef(0);

  const newId = useCallback(() => {
    seq.current += 1;
    return `rep-${seq.current}`;
  }, []);

  const onUpsert = useCallback(
    (input: UpsertInput) => {
      setItems((prev) => {
        const idx = prev.findIndex((r) => r.stock_id === input.stock_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            cantidad: input.cantidad,
            monto_unitario: input.monto_unitario,
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

