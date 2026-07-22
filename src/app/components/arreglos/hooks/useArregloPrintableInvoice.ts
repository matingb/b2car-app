"use client";

import { useCallback } from "react";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { openArregloPrintableInvoice } from "@/lib/arregloPrintableInvoice";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";

export function useArregloPrintableInvoice() {
  const { fetchCliente } = useVehiculos();
  const { error } = useToast();

  const handleOpenPrintableInvoice = useCallback(
    async (data: ArregloDetalleData | null) => {
      if (!data?.arreglo) {
        error("Error", "No se pudo generar el comprobante");
        return;
      }

      const printWindow = window.open("", "_blank", "width=900,height=1200");
      if (!printWindow) {
        error("Error", "El navegador bloqueó la ventana de impresión");
        return;
      }

      printWindow.document.write(
        "<!doctype html><title>Generando PDF</title><p>Generando comprobante...</p>"
      );

      const cliente = data.arreglo.vehiculo?.id
        ? await fetchCliente(data.arreglo.vehiculo.id).catch(() => null)
        : null;

      const tenantName = localStorage.getItem("tenant_name") || undefined;

      const opened = openArregloPrintableInvoice(
        {
          data,
          tenantName,
          cliente,
        },
        printWindow
      );

      if (!opened) {
        error("Error", "El navegador bloqueó la ventana de impresión");
      }
    },
    [fetchCliente, error]
  );

  return {
    handleOpenPrintableInvoice,
  };
}
