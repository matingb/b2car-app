"use client";

import { useCallback, useRef, useState } from "react";
import type { ServicioLinea } from "@/app/components/arreglos/lineas/ServicioLineasEditableSection";

type AddInput = { descripcion: string; cantidad: number; valor: number };
type UpdatePatch = { descripcion: string; cantidad: number; valor: number };

export function useServiciosDraft() {
  const [items, setItems] = useState<ServicioLinea[]>([]);
  const seq = useRef(0);

  const newId = useCallback(() => {
    seq.current += 1;
    return `svc-${seq.current}`;
  }, []);

  const onAdd = useCallback(
    (input: AddInput) => {
      setItems((prev) => [...prev, { id: newId(), ...input }]);
    },
    [newId]
  );

  const onUpdate = useCallback((id: string, patch: UpdatePatch) => {
    setItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }, []);

  const onDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    seq.current = 0;
  }, []);

  return { items, onAdd, onUpdate, onDelete, reset } as const;
}

