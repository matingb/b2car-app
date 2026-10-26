"use client";

import React from "react";
import Badge, { type BadgeColor, type BadgeSize, type BadgeVariant } from "@/app/components/ui/Badge";
import type { EstadoStockOperacion, TipoOperacion } from "@/model/types";

export type EstadoStockBadgeProps = {
  estado?: EstadoStockOperacion | string | null;
  tipo?: TipoOperacion | "COMPRA" | "VENTA";
  variant?: BadgeVariant;
  size?: BadgeSize;
  compact?: boolean;
  dataTestId?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
};

export function getEstadoStockLabel({
  estado,
  tipo = "COMPRA",
  compact = true,
}: {
  estado?: EstadoStockOperacion | string | null;
  tipo?: TipoOperacion | "COMPRA" | "VENTA";
  compact?: boolean;
}): string {
  const isVenta = tipo === "VENTA";

  switch (estado) {
    case "ENTREGADO":
      return isVenta ? "Entregado" : "Recibido";
    case "PARCIAL":
      if (compact) return "Parcial";
      return isVenta ? "Entrega parcial" : "Recepción parcial";
    case "PENDIENTE":
      if (compact) return "Pendiente";
      return isVenta ? "Mercadería reservada" : "En camino";
    case "NO_APLICA":
    default:
      return "N/A";
  }
}

export function getEstadoStockColor(
  estado?: EstadoStockOperacion | string | null
): BadgeColor {
  switch (estado) {
    case "ENTREGADO":
      return "success";
    case "PARCIAL":
      return "warning";
    case "PENDIENTE":
      return "info";
    case "NO_APLICA":
    default:
      return "neutral";
  }
}

export default function EstadoStockBadge({
  estado,
  tipo = "COMPRA",
  variant = "subtle",
  size = "sm",
  compact = true,
  dataTestId = "estado-stock-badge",
  onClick,
  style,
  className,
  title,
}: EstadoStockBadgeProps) {
  const label = getEstadoStockLabel({ estado, tipo, compact });
  const color = getEstadoStockColor(estado);

  return (
    <Badge
      variant={variant}
      color={color}
      size={size}
      dataTestId={dataTestId}
      onClick={onClick}
      style={style}
      className={className}
      title={title}
    >
      {label}
    </Badge>
  );
}
