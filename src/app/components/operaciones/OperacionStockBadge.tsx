"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { COLOR } from "@/theme/theme";
import type { Operacion, EstadoStockOperacion, TipoOperacion } from "@/model/types";
import OperacionStockConfirmModal from "./OperacionStockConfirmModal";

export interface OperacionStockBadgeProps {
  operacionId?: string | number;
  operacion?: Operacion | null;
  estadoStock?: EstadoStockOperacion | string | null;
  tipo?: TipoOperacion | string | null;
  size?: "sm" | "md";
  onStockUpdated?: () => void;
  dataTestId?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function OperacionStockBadge({
  operacionId: propOperacionId,
  operacion,
  estadoStock,
  tipo,
  size = "sm",
  onStockUpdated,
  dataTestId = "operacion-estado-stock-badge",
  onClick,
}: OperacionStockBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const effectiveTipo = operacion?.tipo ?? tipo;
  const isComercial = effectiveTipo === "VENTA" || effectiveTipo === "COMPRA";
  if (!isComercial) return null;

  const effectiveEstado = operacion?.estado_stock ?? estadoStock;
  if (!effectiveEstado || effectiveEstado === "NO_APLICA") return null;

  const isVenta = effectiveTipo === "VENTA";
  const isEntregado = effectiveEstado === "ENTREGADO";
  const isParcial = effectiveEstado === "PARCIAL";

  const label = isEntregado
    ? isVenta
      ? "Entregado"
      : "Recibido"
    : isParcial
      ? isVenta
        ? "Entrega parcial"
        : "Recepción parcial"
      : isVenta
        ? "Reservada"
        : "En camino";

  // Es interactivo si hay una operación vinculada o se proveyó un onClick explícito
  const hasOperacion = Boolean(operacion || propOperacionId);
  const isInteractive = Boolean(onClick || hasOperacion);

  const badgeSize = size === "sm" ? 14 : 16;
  const fontSize = size === "sm" ? 12 : 13;
  const padding = size === "sm" ? "4px 10px" : "6px 10px";
  const height = size === "sm" ? 28 : 32;

  let activeColor: string;
  let icon: React.ReactNode;

  if (isEntregado) {
    activeColor = COLOR.STATUS.SUCCESS.TEXT;
    icon = <CheckCircle2 size={badgeSize} color={COLOR.STATUS.SUCCESS.TEXT} />;
  } else if (isParcial) {
    activeColor = COLOR.STATUS.WARNING.TEXT;
    icon = <AlertCircle size={badgeSize} color={COLOR.STATUS.WARNING.TEXT} />;
  } else {
    activeColor = COLOR.STATUS.INFO.TEXT;
    icon = <Clock size={badgeSize} color={COLOR.STATUS.INFO.TEXT} />;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
      return;
    }
    if (!hasOperacion) return;
    setModalOpen(true);
  };

  const tooltipText = isInteractive
    ? isEntregado
      ? isVenta
        ? "Ver o revertir entrega de stock"
        : "Ver o revertir recepción de stock"
      : isVenta
        ? "Confirmar entrega de stock"
        : "Confirmar recepción de stock"
    : undefined;

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
      isHovered && isInteractive ? activeColor : COLOR.BORDER.SUBTLE
    }`,
    filter: isHovered && isInteractive ? "brightness(0.97)" : "none",
    cursor: isInteractive ? "pointer" : "default",
    transition: "all 0.18s ease-in-out",
    boxSizing: "border-box" as const,
    userSelect: "none" as const,
    fontFamily: "inherit",
  };

  return (
    <>
      <span
        onClick={handleClick}
        title={tooltipText}
        data-testid={dataTestId}
        style={style}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onMouseEnter={() => isInteractive && setIsHovered(true)}
        onMouseLeave={() => isInteractive && setIsHovered(false)}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalOpen(true);
                }
              }
            : undefined
        }
      >
        {icon}
        <span>{label}</span>
      </span>

      {(operacion || propOperacionId) && modalOpen ? (
        <OperacionStockConfirmModal
          open={modalOpen}
          operacionId={propOperacionId ?? operacion?.id}
          operacion={operacion ?? null}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            onStockUpdated?.();
          }}
        />
      ) : null}
    </>
  );
}
