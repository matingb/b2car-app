"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2 } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

export type EstadoPago = "PAGADO" | "PARCIAL" | "PENDIENTE" | "SOBREPAGO" | string;

export interface PagoBadgeProps {
  estado?: EstadoPago | null;
  estaPago?: boolean | null;
  totalCobrado?: number | null;
  saldoPendiente?: number | null;
  precioFinal?: number | null;
  size?: "sm" | "md";
  hideTextOnMobile?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  dataTestId?: string;
}

export function calcularEstadoPago({
  totalCobrado = 0,
  precioFinal = 0,
  estaPago,
}: {
  totalCobrado?: number | null;
  precioFinal?: number | null;
  estaPago?: boolean | null;
}): EstadoPago {
  const cobrado = Number(totalCobrado ?? 0);
  const total = Number(precioFinal ?? 0);

  if (cobrado <= 0) {
    return estaPago ? "PAGADO" : "PENDIENTE";
  }
  if (total > 0) {
    if (cobrado < total) return "PARCIAL";
    if (cobrado === total) return "PAGADO";
    return "SOBREPAGO";
  }
  return "PAGADO";
}

export default function PagoBadge({
  estado,
  estaPago,
  totalCobrado,
  saldoPendiente,
  precioFinal,
  size = "md",
  hideTextOnMobile = false,
  loading = false,
  onClick,
  dataTestId = "pago-badge",
}: PagoBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  let effectiveEstado: EstadoPago;
  if (
    estado === "PAGADO" ||
    estado === "PARCIAL" ||
    estado === "PENDIENTE" ||
    estado === "SOBREPAGO"
  ) {
    effectiveEstado = estado;
  } else if (totalCobrado != null || precioFinal != null || estaPago != null) {
    effectiveEstado = calcularEstadoPago({
      totalCobrado,
      precioFinal,
      estaPago,
    });
  } else if (estado) {
    effectiveEstado = estado;
  } else {
    effectiveEstado = "PENDIENTE";
  }

  const effectiveSaldoPendiente =
    saldoPendiente != null
      ? Number(saldoPendiente)
      : Math.max(0, Number(precioFinal || 0) - Number(totalCobrado || 0));

  const isInteractive = Boolean(onClick);
  const badgeSize = size === "sm" ? 14 : 16;
  const fontSize = size === "sm" ? 12 : 13;
  const padding = size === "sm" ? "4px 10px" : "6px 10px";
  const height = size === "sm" ? 28 : 32;

  const textStyles = hideTextOnMobile
    ? css({
        display: "none",
        [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
          display: "inline",
        },
      })
    : undefined;

  let content: React.ReactNode;
  let activeColor: string;
  let tooltipText: string;

  if (loading) {
    activeColor = COLOR.TEXT.SECONDARY;
    tooltipText = "Actualizando...";
    content = (
      <>
        <Loader2 size={badgeSize} color={COLOR.TEXT.SECONDARY} className="animate-spin" />
        <span css={textStyles}>Actualizando...</span>
      </>
    );
  } else {
    switch (effectiveEstado) {
      case "PAGADO":
        activeColor = COLOR.STATUS.SUCCESS.TEXT;
        tooltipText = totalCobrado ? `Pagado total: ${formatArs(totalCobrado)}` : "Pagado";
        content = (
          <>
            <CheckCircle2 size={badgeSize} color={COLOR.STATUS.SUCCESS.TEXT} />
            <span css={textStyles}>Pagado</span>
          </>
        );
        break;

      case "PARCIAL":
        activeColor = COLOR.STATUS.WARNING.TEXT;
        tooltipText =
          effectiveSaldoPendiente > 0
            ? `Saldo pendiente: ${formatArs(effectiveSaldoPendiente)} (Cobrado: ${formatArs(totalCobrado || 0)})`
            : "Pago parcial";
        content = (
          <>
            <AlertCircle size={badgeSize} color={COLOR.STATUS.WARNING.TEXT} />
            <span css={textStyles}>
              {effectiveSaldoPendiente > 0
                ? `Pendiente: ${formatArs(effectiveSaldoPendiente, { maxDecimals: 0 })}`
                : "Parcial"}
            </span>
          </>
        );
        break;

      case "SOBREPAGO":
        activeColor = COLOR.STATUS.INFO.TEXT;
        tooltipText = "Saldo a favor del cliente";
        content = (
          <>
            <Info size={badgeSize} color={COLOR.STATUS.INFO.TEXT} />
            <span css={textStyles}>Saldo a favor</span>
          </>
        );
        break;

      case "PENDIENTE":
      default:
        activeColor = COLOR.SEMANTIC.DANGER;
        tooltipText = "Registrar pago";
        content = (
          <>
            <XCircle size={badgeSize} color={COLOR.SEMANTIC.DANGER} />
            <span css={textStyles}>Pago pendiente</span>
          </>
        );
        break;
    }
  }

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: size === "sm" ? 6 : 8,
    whiteSpace: "nowrap",
    fontSize,
    fontWeight: 600,
    lineHeight: 1,
    height,
    padding,
    borderRadius: 8,
    backgroundColor: "transparent",
    color: COLOR.TEXT.PRIMARY,
    border: `1px solid ${
      isHovered && isInteractive && !loading ? activeColor : COLOR.BORDER.SUBTLE
    }`,
    filter: isHovered && isInteractive && !loading ? "brightness(0.97)" : "none",
    cursor: isInteractive && !loading ? "pointer" : "default",
    transition: "all 0.18s ease-in-out",
    boxSizing: "border-box",
    opacity: loading ? 0.7 : 1,
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive && !loading) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive) {
      setIsHovered(false);
    }
  };

  if (isInteractive) {
    return (
      <button
        onClick={onClick}
        type="button"
        disabled={loading}
        data-testid={dataTestId}
        data-isolate-hover="true"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseOver={(e) => e.stopPropagation()}
        onMouseOut={(e) => e.stopPropagation()}
        title={tooltipText}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      style={style}
      data-testid={dataTestId}
      title={tooltipText}
    >
      {content}
    </span>
  );
}
