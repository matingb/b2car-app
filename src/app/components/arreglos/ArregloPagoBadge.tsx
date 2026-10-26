import React, { useState } from "react";
import { Arreglo, EstadoArreglo } from "@/model/types";
import CobroArregloModal from "@/app/components/arreglos/CobroArregloModal";
import PagoBadge, { calcularEstadoPago } from "@/app/components/ui/PagoBadge";

export { calcularEstadoPago };

type Props = {
  estado?: EstadoArreglo | string | null;
  estaPago?: boolean;
  totalCobrado?: number;
  saldoPendiente?: number;
  precioFinal?: number;
  arregloId?: string | number;
  onClick?: (e: React.MouseEvent) => void;
  onPagoUpdated?: (updatedArreglo: Arreglo) => void;
  size?: "sm" | "md";
  hideTextOnMobile?: boolean;
  variant?: "default" | "footer";
};

export default function ArregloPagoBadge({
  estado,
  estaPago,
  totalCobrado,
  saldoPendiente,
  precioFinal,
  arregloId,
  onClick,
  onPagoUpdated,
  size = "md",
  hideTextOnMobile,
}: Props) {
  const [cobroOpen, setCobroOpen] = useState(false);

  if (estado === "PRESUPUESTO") {
    return null;
  }

  const isInteractive = Boolean(onClick || arregloId);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
      return;
    }

    if (!arregloId) return;
    setCobroOpen(true);
  };

  return (
    <>
      <PagoBadge
        estaPago={estaPago}
        totalCobrado={totalCobrado}
        saldoPendiente={saldoPendiente}
        precioFinal={precioFinal}
        size={size}
        hideTextOnMobile={hideTextOnMobile}
        onClick={isInteractive ? handleToggle : undefined}
        dataTestId="arreglo-pago-badge"
      />
      {arregloId ? (
        <CobroArregloModal
          open={cobroOpen}
          arregloId={arregloId}
          onClose={() => setCobroOpen(false)}
          onPaid={(updated) => {
            onPagoUpdated?.(updated);
          }}
        />
      ) : null}
    </>
  );
}
