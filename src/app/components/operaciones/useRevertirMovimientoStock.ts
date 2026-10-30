"use client";

import { useCallback, useState } from "react";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { Operacion, OperacionMovimientoStock } from "@/model/types";

/**
 * Determina si un movimiento representa una reversión de stock.
 */
export function isMovimientoReversion(mov: OperacionMovimientoStock): boolean {
  return (
    mov.tipo_movimiento === "REVERSION" ||
    Boolean(mov.reversion_de_id) ||
    (mov.motivo?.toLowerCase().includes("reversión") ?? false) ||
    (mov.motivo?.toLowerCase().includes("reversion") ?? false)
  );
}

/**
 * Determina si un movimiento ya fue revertido (por flag directo o por existencia de contra-movimiento).
 */
export function isMovimientoRevertido(
  mov: OperacionMovimientoStock,
  todosMovimientos?: OperacionMovimientoStock[]
): boolean {
  if (Boolean(mov.revertido)) return true;
  if (!todosMovimientos) return false;
  return todosMovimientos.some((other) => other.reversion_de_id === mov.id);
}

/**
 * Determina si un movimiento es apto para ser revertido.
 */
export function canRevertirMovimiento(
  mov: OperacionMovimientoStock,
  todosMovimientos?: OperacionMovimientoStock[]
): boolean {
  return !isMovimientoReversion(mov) && !isMovimientoRevertido(mov, todosMovimientos);
}

export interface UseRevertirMovimientoStockOptions {
  operacion?: Operacion | null;
  onSuccess?: (updated: Operacion) => void | Promise<void>;
}

/**
 * Hook centralizado para gestionar el flujo de reversión de entregas/recepciones de stock.
 * Encapsula validaciones previas, diálogo de confirmación, llamada a la API y notificaciones toast.
 */
export function useRevertirMovimientoStock({
  operacion,
  onSuccess,
}: UseRevertirMovimientoStockOptions = {}) {
  const { revertirStock } = useOperaciones();
  const { confirm } = useModalMessage();
  const { success, error: toastError } = useToast();
  const [revertiendoMovId, setRevertiendoMovId] = useState<string | null>(null);

  const isVenta = operacion?.tipo === "VENTA";

  const handleRevertirMovimiento = useCallback(
    async (movimientoId: string, cantidad?: number, prodNombre?: string) => {
      if (!operacion) return;

      const targetMov = (operacion.movimientos_stock ?? []).find((m) => m.id === movimientoId);
      if (!targetMov) return;

      if (isMovimientoReversion(targetMov)) {
        toastError("Operación no permitida", "No se puede revertir un movimiento que ya es una reversión.");
        return;
      }

      if (isMovimientoRevertido(targetMov, operacion.movimientos_stock)) {
        toastError("Operación no permitida", "Este movimiento ya fue revertido previamente.");
        return;
      }

      const unidades = cantidad ?? Math.abs(targetMov.cantidad);
      const nombre = prodNombre || targetMov.producto_nombre || "producto";
      const actionWord = isVenta ? "la entrega" : "la recepción";

      const confirmed = await confirm({
        title: `¿Revertir ${actionWord}?`,
        message: `Esta acción revertirá ${actionWord} de ${unidades} u. de "${nombre}" y devolverá el stock a su estado anterior. ¿Deseas continuar?`,
        acceptLabel: "Revertir",
        cancelLabel: "Cancelar",
      });

      if (!confirmed) return;

      setRevertiendoMovId(movimientoId);
      try {
        const updated = await revertirStock(operacion.id, movimientoId);
        if (updated) {
          success(
            isVenta ? "Entrega revertida" : "Recepción revertida",
            `Se revirtió ${actionWord} de ${unidades} u.`
          );
          await onSuccess?.(updated);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al revertir stock";
        toastError("Error al revertir", msg);
      } finally {
        setRevertiendoMovId(null);
      }
    },
    [confirm, isVenta, onSuccess, operacion, revertirStock, success, toastError]
  );

  return {
    revertiendoMovId,
    handleRevertirMovimiento,
    isMovimientoReversion,
    isMovimientoRevertido,
    canRevertirMovimiento,
  };
}
