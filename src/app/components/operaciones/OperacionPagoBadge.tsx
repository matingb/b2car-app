"use client";

import React, { useState } from "react";
import type { Operacion, EstadoPagoOperacion, TipoOperacion } from "@/model/types";
import PagoBadge, { calcularEstadoPago } from "@/app/components/ui/PagoBadge";
import OperacionPagoModal from "@/app/components/operaciones/OperacionPagoModal";

export { calcularEstadoPago };

export interface OperacionPagoBadgeProps {
  operacion?: Operacion | null;
  estado?: EstadoPagoOperacion | string | null;
  estaPago?: boolean | null;
  totalPagado?: number | null;
  saldoPendiente?: number | null;
  montoTotal?: number | null;
  tipo?: TipoOperacion | string | null;
  size?: "sm" | "md";
  hideTextOnMobile?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPagoUpdated?: () => void;
  dataTestId?: string;
}

export default function OperacionPagoBadge({
  operacion,
  estado,
  estaPago,
  totalPagado,
  saldoPendiente,
  montoTotal,
  tipo,
  size = "sm",
  hideTextOnMobile = false,
  onClick,
  onPagoUpdated,
  dataTestId = "operacion-pago-badge",
}: OperacionPagoBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const effectiveTipo = operacion?.tipo ?? tipo;
  const isComercial = effectiveTipo === "VENTA" || effectiveTipo === "COMPRA";

  if (!isComercial) {
    return null;
  }

  const effectiveMontoTotal =
    operacion?.monto_total ??
    montoTotal ??
    (operacion?.lineas ?? []).reduce(
      (acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
      0
    );

  const isSinCargo =
    effectiveTipo === "COMPRA" &&
    effectiveMontoTotal === 0 &&
    !(operacion?.total_pagado || totalPagado);

  if (isSinCargo) {
    return null;
  }

  const effectiveTotalPagado =
    operacion?.total_pagado ??
    totalPagado ??
    (operacion?.esta_pago || estaPago ? effectiveMontoTotal : 0);

  const effectiveSaldoPendiente =
    operacion?.saldo_pendiente ??
    saldoPendiente ??
    Math.max(0, effectiveMontoTotal - effectiveTotalPagado);

  const effectiveEstaPago =
    operacion?.esta_pago ??
    estaPago ??
    (operacion?.estado_pago === "PAGADO" || estado === "PAGADO");

  const effectiveEstado =
    operacion?.estado_pago ??
    estado ??
    calcularEstadoPago({
      totalCobrado: effectiveTotalPagado,
      precioFinal: effectiveMontoTotal,
      estaPago: effectiveEstaPago,
    });

  const canPay = effectiveEstado !== "PAGADO" && effectiveSaldoPendiente > 0;
  const isInteractive = Boolean(onClick || (operacion && canPay));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
      return;
    }

    if (!operacion || !canPay) return;
    setModalOpen(true);
  };

  return (
    <>
      <span
        onClick={(e) => e.stopPropagation()}
        style={{ display: "inline-flex" }}
      >
        <PagoBadge
          estado={effectiveEstado}
          estaPago={effectiveEstaPago}
          totalCobrado={effectiveTotalPagado}
          saldoPendiente={effectiveSaldoPendiente}
          precioFinal={effectiveMontoTotal}
          size={size}
          hideTextOnMobile={hideTextOnMobile}
          onClick={isInteractive ? handleToggle : undefined}
          dataTestId={dataTestId}
        />
      </span>
      {operacion && modalOpen ? (
        <OperacionPagoModal
          open={modalOpen}
          operacion={operacion}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            onPagoUpdated?.();
          }}
        />
      ) : null}
    </>
  );
}
