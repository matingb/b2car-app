import { useMemo } from "react";
import { EstadoArreglo, ESTADOS_ARREGLO } from "@/model/types";
import { COLOR } from "@/theme/theme";

export type EstadoMeta = {
  label: string;
  dotColor: string;
  bgColor: string;
};

export function getArregloEstadoMeta(estado: EstadoArreglo | undefined): EstadoMeta {
  const safeEstado = estado ?? "SIN_INICIAR";
  const formatted = safeEstado.toLowerCase().replaceAll("_", " ");
  const label = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  switch (safeEstado) {
    case "PRESUPUESTO":
      return { label, dotColor: COLOR.SEMANTIC.WARNING, bgColor: "transparent" };
    case "SIN_INICIAR":
      return { label, dotColor: COLOR.SEMANTIC.DISABLED, bgColor: "transparent" };
    case "EN_PROGRESO":
      return { label, dotColor: COLOR.SEMANTIC.INFO, bgColor: "transparent" };
    case "ESPERA":
      return { label, dotColor: COLOR.SEMANTIC.ALERT, bgColor: "transparent" };
    case "TERMINADO":
      return { label, dotColor: COLOR.SEMANTIC.SUCCESS, bgColor: "transparent" };
    default:
      return { label, dotColor: COLOR.SEMANTIC.INFO, bgColor: "transparent" };
  }
}

export function getArregloEstadoProgress(estado: EstadoArreglo | undefined): number {
  switch (estado ?? "SIN_INICIAR") {
    case "PRESUPUESTO": return 0;
    case "SIN_INICIAR": return 10;
    case "EN_PROGRESO": return 50;
    case "ESPERA": return 60;
    case "TERMINADO": return 100;
    default: return 0;
  }
}

export function useArregloEstado(estado?: EstadoArreglo, customProgress?: number) {
  const meta = useMemo(() => getArregloEstadoMeta(estado), [estado]);

  const progress = useMemo(() => {
    const raw = customProgress ?? getArregloEstadoProgress(estado);
    return Math.max(0, Math.min(100, raw));
  }, [estado, customProgress]);

  const options = useMemo(
    () =>
      ESTADOS_ARREGLO.map((value) => ({
        value,
        meta: getArregloEstadoMeta(value),
        progress: getArregloEstadoProgress(value),
      })),
    []
  );

  return { meta, progress, options };
}
