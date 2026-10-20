"use client";

import { useCallback, useState } from "react";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { useToast } from "@/app/providers/ToastProvider";

export function useArregloPrintableInvoice() {
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const { error } = useToast();

  const handleOpenPrintableInvoice = useCallback((data?: ArregloDetalleData | null) => {
    if (!data?.arreglo) {
      error("Error", "No se pudo generar el comprobante");
      return;
    }

    const vehiculo = data.arreglo.vehiculo;
    const hasCliente = Boolean(
      vehiculo?.nombre_cliente?.trim() ||
      vehiculo?.cliente_id ||
      data.arreglo.cliente_id
    );
    if (!hasCliente) {
      error("Datos incompletos", "El arreglo no tiene un cliente asignado.");
      return;
    }

    setIsInvoiceModalOpen(true);
  }, [error]);

  const handleClosePrintableInvoice = useCallback(() => {
    setIsInvoiceModalOpen(false);
  }, []);

  return {
    isInvoiceModalOpen,
    handleOpenPrintableInvoice,
    handleClosePrintableInvoice,
  };
}
