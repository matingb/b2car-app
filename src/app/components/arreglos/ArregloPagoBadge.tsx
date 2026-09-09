import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2, Clock } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { Arreglo, EstadoArreglo, EstadoPagoArreglo } from "@/model/types";
import CobroArregloModal from "@/app/components/arreglos/CobroArregloModal";
import { formatArs } from "@/lib/format";

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

export function calcularEstadoPago({
  totalCobrado = 0,
  precioFinal = 0,
  estaPago,
}: {
  totalCobrado?: number | null;
  precioFinal?: number | null;
  estaPago?: boolean | null;
}): EstadoPagoArreglo {
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
  variant = "default",
}: Props) {
  const [loading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);

  if (estado === "PRESUPUESTO") {
    return null;
  }

  const isInteractive = Boolean(onClick || arregloId);
  const badgeSize = size === "sm" ? 14 : 16;
  const padding = size === "sm" ? "4px 10px" : "6px 10px";
  const fontSize = size === "sm" ? 12 : 13;

  const effectiveEstado: EstadoPagoArreglo = calcularEstadoPago({
    totalCobrado,
    precioFinal,
    estaPago,
  });

  const effectiveSaldoPendiente = saldoPendiente != null
    ? saldoPendiente
    : Math.max(0, Number(precioFinal || 0) - Number(totalCobrado || 0));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
      return;
    }

    if (!arregloId || loading) return;
    setCobroOpen(true);
  };

  const textStyles = hideTextOnMobile ? css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      display: "inline",
    }
  }) : undefined;

  let content: React.ReactNode;
  let activeColor: string;
  let activeBg: string;
  let activeBorder: string;
  let activeTextColor: string;
  let tooltipText: string;

  const isFooter = variant === "footer";

  if (loading) {
    activeColor = COLOR.TEXT.SECONDARY;
    activeBg = isFooter ? "#f8fafc" : "transparent";
    activeBorder = COLOR.BORDER.SUBTLE;
    activeTextColor = COLOR.TEXT.PRIMARY;
    tooltipText = "Actualizando...";
    content = (
      <>
        <Loader2 size={badgeSize} color={COLOR.TEXT.SECONDARY} className="animate-spin" />
        <span css={textStyles}>Actualizando...</span>
      </>
    );
  } else if (isFooter) {
    switch (effectiveEstado) {
      case "PAGADO":
        activeColor = "#16a34a";
        activeBg = "#f0fdf4";
        activeBorder = "#bbf7d0";
        activeTextColor = "#16a34a";
        tooltipText = totalCobrado ? `Pagado total: ${formatArs(totalCobrado)}` : "Cobrado";
        content = (
          <>
            <CheckCircle2 size={badgeSize} color="#16a34a" />
            <span css={textStyles}>Cobrado</span>
          </>
        );
        break;

      case "PARCIAL":
      case "PENDIENTE":
      default:
        activeColor = "#b45309";
        activeBg = "#fffbeb";
        activeBorder = "#fde68a";
        activeTextColor = "#b45309";
        tooltipText = effectiveSaldoPendiente > 0
          ? `Pendiente: ${formatArs(effectiveSaldoPendiente)} (Cobrado: ${formatArs(totalCobrado || 0)})`
          : "Pendiente";
        content = (
          <>
            <Clock size={badgeSize} color="#b45309" />
            <span css={textStyles}>
              {effectiveSaldoPendiente > 0
                ? `Pendiente (${formatArs(effectiveSaldoPendiente, { maxDecimals: 0 })})`
                : "Pendiente"}
            </span>
          </>
        );
        break;

      case "SOBREPAGO":
        activeColor = "#2563eb";
        activeBg = "#eff6ff";
        activeBorder = "#bfdbfe";
        activeTextColor = "#1d4ed8";
        tooltipText = "Saldo a favor del cliente";
        content = (
          <>
            <Info size={badgeSize} color="#2563eb" />
            <span css={textStyles}>Saldo a favor</span>
          </>
        );
        break;
    }
  } else {
    // Default variant
    activeBg = "transparent";
    activeTextColor = COLOR.TEXT.PRIMARY;
    switch (effectiveEstado) {
      case "PAGADO":
        activeColor = COLOR.SEMANTIC.SUCCESS;
        activeBorder = isHovered && isInteractive ? activeColor : COLOR.BORDER.SUBTLE;
        tooltipText = totalCobrado ? `Pagado total: ${formatArs(totalCobrado)}` : "Pagado";
        content = (
          <>
            <CheckCircle2 size={badgeSize} color={COLOR.SEMANTIC.SUCCESS} />
            <span css={textStyles}>Pagado</span>
          </>
        );
        break;

      case "PARCIAL":
        activeColor = "#d97706"; // Amber 600
        activeBorder = isHovered && isInteractive ? activeColor : COLOR.BORDER.SUBTLE;
        tooltipText = effectiveSaldoPendiente > 0
          ? `Saldo pendiente: ${formatArs(effectiveSaldoPendiente)} (Cobrado: ${formatArs(totalCobrado || 0)})`
          : "Pago parcial";
        content = (
          <>
            <AlertCircle size={badgeSize} color="#d97706" />
            <span css={textStyles}>
              {effectiveSaldoPendiente > 0
                ? `Pendiente: ${formatArs(effectiveSaldoPendiente, { maxDecimals: 0 })}`
                : "Pago parcial"}
            </span>
          </>
        );
        break;

      case "SOBREPAGO":
        activeColor = COLOR.ACCENT.PRIMARY;
        activeBorder = isHovered && isInteractive ? activeColor : COLOR.BORDER.SUBTLE;
        tooltipText = "Saldo a favor del cliente";
        content = (
          <>
            <Info size={badgeSize} color={COLOR.ACCENT.PRIMARY} />
            <span css={textStyles}>Saldo a favor</span>
          </>
        );
        break;

      case "PENDIENTE":
      default:
        activeColor = COLOR.SEMANTIC.DANGER;
        activeBorder = isHovered && isInteractive ? activeColor : COLOR.BORDER.SUBTLE;
        tooltipText = "Registrar cobro";
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
    color: activeTextColor,
    backgroundColor: activeBg,
    padding,
    height: size === "sm" ? 28 : 32,
    borderRadius: 8,
    border: `1px solid ${isFooter ? activeBorder : (isHovered && isInteractive && !loading ? activeColor : COLOR.BORDER.SUBTLE)}`,
    filter: isHovered && isInteractive && !loading ? "brightness(0.97)" : "none",
    cursor: isInteractive && !loading ? "pointer" : "default",
    transition: "all 0.18s ease-in-out",
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
      <>
        <button
          onClick={handleToggle}
          type="button"
          disabled={loading}
          data-testid="arreglo-pago-badge"
          data-isolate-hover="true"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseOver={(e) => e.stopPropagation()}
          onMouseOut={(e) => e.stopPropagation()}
          title={tooltipText}
          style={{
            ...style,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {content}
        </button>
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

  return (
    <span style={style} data-testid="arreglo-pago-badge">
      {content}
    </span>
  );
}
