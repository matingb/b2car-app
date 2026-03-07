import React from "react";
import type { EstadoArreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";

type BadgeSize = "sm" | "md";

type Props = {
  estado?: EstadoArreglo;
  size?: BadgeSize;
};

type EstadoMeta = {
  label: string;
  dotColor: string;
  bgColor: string;
};

const SIZE_MAP: Record<BadgeSize, { padding: string; gap: number; dot: number; fontSize: number }> = {
  sm: { padding: "4px 10px", gap: 6, dot: 8, fontSize: 12 },
  md: { padding: "6px 10px", gap: 8, dot: 10, fontSize: 13 },
};

export default function ArregloEstadoBadge({ estado, size = "md" }: Props) {
  const meta = getArregloEstadoMeta(estado);
  const token = SIZE_MAP[size];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: token.gap,
        width: "fit-content",
        padding: token.padding,
        borderRadius: 999,
        background: meta.bgColor,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: token.dot,
          height: token.dot,
          borderRadius: 999,
          background: meta.dotColor,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontSize: token.fontSize,
          fontWeight: 700,
          color: COLOR.TEXT.PRIMARY,
          whiteSpace: "nowrap",
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}

export function getArregloEstadoMeta(estado: EstadoArreglo | undefined): EstadoMeta {
  const safeEstado = estado ?? "SIN_INICIAR";
  const label = safeEstado.replaceAll("_", " ");

  switch (safeEstado) {
    case "PRESUPUESTO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.WARNING,
        bgColor: COLOR.BACKGROUND.WARNING_TINT,
      };
    case "SIN_INICIAR":
      return {
        label,
        dotColor: COLOR.SEMANTIC.DISABLED,
        bgColor: COLOR.BACKGROUND.DISABLED_TINT,
      };
    case "EN_PROGRESO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: COLOR.BACKGROUND.INFO_TINT,
      };
    case "ESPERA":
      return {
        label,
        dotColor: COLOR.SEMANTIC.WARNING,
        bgColor: COLOR.BACKGROUND.SUBTLE,
      };
    case "TERMINADO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.SUCCESS,
        bgColor: COLOR.BACKGROUND.SUCCESS_TINT,
      };
    default:
      return {
        label,
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: COLOR.BACKGROUND.INFO_TINT,
      };
  }
}
