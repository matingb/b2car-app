import { useMemo } from "react";
import type { DropdownOption } from "@/app/components/ui/Dropdown";
import {
  calcularDuracionMinutos,
  formatHoraMobile,
  generarHorasFin,
  generarHorasInicio,
  sumarMinutosAHora,
  DURACION_TODO_EL_DIA,
  HORA_INICIO_LABORAL,
} from "@/lib/turnosHorarios";

export type UseTurnoHorariosResult = {
  horaInicioValida: string;
  horaFinCalculada: string;
  isHoraFinValida: boolean;
  horasFinOptions: string[];
  /** Opciones desktop: label con hora y duración. Ej: "09:30 (30 min)" */
  horasInicioDropdownOptions: DropdownOption[];
  horasFinDropdownOptions: DropdownOption[];
  /** Opciones mobile: label compacto. Ej: "9:30" */
  horasInicioDropdownOptionsMobile: DropdownOption[];
  horasFinDropdownOptionsMobile: DropdownOption[];
  isAllDay: boolean;
  calcularDuracionDesdeHoraFin: (horaFin: string) => number;
};

function buildDesktopFinLabel(horaInicio: string, horaFin: string): string {
  const durMin = calcularDuracionMinutos(horaInicio, horaFin);
  const durLabel = durMin >= 60 ? `${durMin / 60} h` : `${durMin} min`;
  return `${horaFin} (${durLabel})`;
}

export function useTurnoHorarios(
  hora: string,
  duracion: number | null
): UseTurnoHorariosResult {
  const duracionActual = duracion ?? 60;
  const horaInicioValida = hora || "09:00";
  const horaFinCalculada = sumarMinutosAHora(horaInicioValida, duracionActual);

  const isAllDay =
    hora === HORA_INICIO_LABORAL && duracionActual === DURACION_TODO_EL_DIA;

  const horasInicioOptions = useMemo(() => generarHorasInicio(), []);
  const horasFinOptions = useMemo(
    () => generarHorasFin(horaInicioValida),
    [horaInicioValida]
  );

  const horasInicioDropdownOptions: DropdownOption[] = useMemo(
    () => horasInicioOptions.map((h) => ({ value: h, label: h })),
    [horasInicioOptions]
  );

  const horasFinDropdownOptions: DropdownOption[] = useMemo(
    () =>
      horasFinOptions.map((h) => ({
        value: h,
        label: buildDesktopFinLabel(horaInicioValida, h),
        selectedLabel: h,
      })),
    [horasFinOptions, horaInicioValida]
  );

  const horasInicioDropdownOptionsMobile: DropdownOption[] = useMemo(
    () => horasInicioOptions.map((h) => ({ value: h, label: formatHoraMobile(h) })),
    [horasInicioOptions]
  );

  const horasFinDropdownOptionsMobile: DropdownOption[] = useMemo(
    () => horasFinOptions.map((h) => ({ value: h, label: formatHoraMobile(h) })),
    [horasFinOptions]
  );

  const isHoraFinValida = horasFinOptions.includes(horaFinCalculada);

  const calcularDuracionDesdeHoraFin = (horaFin: string): number => {
    const dur = calcularDuracionMinutos(horaInicioValida, horaFin);
    return dur > 0 ? dur : 30;
  };

  return {
    horaInicioValida,
    horaFinCalculada,
    isHoraFinValida,
    horasFinOptions,
    horasInicioDropdownOptions,
    horasFinDropdownOptions,
    horasInicioDropdownOptionsMobile,
    horasFinDropdownOptionsMobile,
    isAllDay,
    calcularDuracionDesdeHoraFin,
  };
}
