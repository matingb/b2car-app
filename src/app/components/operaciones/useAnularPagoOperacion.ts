"use client";

import { useCallback, useState } from "react";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { formatArs } from "@/lib/format";
import type { Operacion } from "@/model/types";

export interface UseAnularPagoOperacionOptions {
  operacionId?: string | number | null;
  isVenta: boolean;
  onSuccess?: (updated: Operacion) => void | Promise<void>;
}

/**
 * Hook centralizado para anular un pago/cobro de una operación.
 * Encapsula confirmación, llamada a la API, toasts y estado de "anulando".
 */
export function useAnularPagoOperacion({
  operacionId,
  isVenta,
  onSuccess,
}: UseAnularPagoOperacionOptions) {
  const { anularPago } = useOperaciones();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();
  const [anulandoPagoId, setAnulandoPagoId] = useState<string | null>(null);

  const handleAnularPago = useCallback(
    async (pagoId: string, importe: number) => {
      const noun = isVenta ? "cobro" : "pago";
      const confirmed = await confirm({
        title: isVenta ? "Anular cobro" : "Anular pago",
        message: `¿Estás seguro de que querés anular este ${noun} de ${formatArs(importe)}? Se generará el reverso contable correspondiente.`,
        acceptLabel: isVenta ? "Anular cobro" : "Anular pago",
        cancelLabel: "Cancelar",
      });
      if (!confirmed || !operacionId) return;

      setAnulandoPagoId(pagoId);
      try {
        const updated = await anularPago(operacionId, pagoId);
        if (updated) {
          success(
            isVenta ? "Cobro anulado" : "Pago anulado",
            `El ${noun} fue anulado y el saldo fue actualizado.`
          );
          await onSuccess?.(updated);
        }
      } catch (err: unknown) {
        error("Error", err instanceof Error ? err.message : `No se pudo anular el ${noun}`);
      } finally {
        setAnulandoPagoId(null);
      }
    },
    [anularPago, confirm, error, isVenta, onSuccess, operacionId, success]
  );

  return { anulandoPagoId, handleAnularPago };
}
