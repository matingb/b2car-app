"use client";

import { COLOR } from "@/theme/theme";
import { TurnoEstado } from "@/app/providers/TurnosProvider";

export function estadoAccentColor(estado: TurnoEstado) {
  if (estado === "Cancelado") return COLOR.ICON.DANGER;
  if (estado === "Pendiente") return COLOR.BORDER.WEAK;
  return COLOR.ACCENT.PRIMARY;
}

