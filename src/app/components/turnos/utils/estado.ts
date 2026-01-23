"use client";

import { COLOR } from "@/theme/theme";
import { TurnoEstado } from "@/model/dtos";

export function estadoAccentColor(estado: TurnoEstado) {
  if (estado === "cancelado") return COLOR.ICON.DANGER;
  if (estado === "pendiente") return COLOR.BORDER.WEAK;
  return COLOR.ACCENT.PRIMARY;
}

