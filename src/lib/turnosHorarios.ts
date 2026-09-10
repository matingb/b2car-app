import { horaAMinutos } from "./fechas";

export const HORA_INICIO_LABORAL = "06:00";
export const HORA_FIN_LABORAL = "22:00";
export const DURACION_TODO_EL_DIA = 960; // 16 horas entre 06:00 y 22:00
export const INTERVALO_MINUTOS = 30;

export function minutosAHora(totalMinutos: number): string {
  const minsClamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutos));
  const h = Math.floor(minsClamped / 60);
  const m = minsClamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sumarMinutosAHora(hora: string, minutos: number): string {
  const inicio = horaAMinutos(hora);
  return minutosAHora(inicio + minutos);
}

export function calcularDuracionMinutos(horaInicio: string, horaFin: string): number {
  const inicio = horaAMinutos(horaInicio);
  const fin = horaAMinutos(horaFin);
  return Math.max(0, fin - inicio);
}

export function generarHorasInicio(
  horaMin = HORA_INICIO_LABORAL,
  horaMax = "21:30",
  intervalo = INTERVALO_MINUTOS
): string[] {
  const minMinutos = horaAMinutos(horaMin);
  const maxMinutos = horaAMinutos(horaMax);
  const horas: string[] = [];

  for (let m = minMinutos; m <= maxMinutos; m += intervalo) {
    horas.push(minutosAHora(m));
  }
  return horas;
}

export function generarHorasFin(
  horaInicio: string,
  horaMax = HORA_FIN_LABORAL,
  intervalo = INTERVALO_MINUTOS
): string[] {
  const inicio = horaAMinutos(horaInicio);
  const maxMinutos = horaAMinutos(horaMax);
  const horas: string[] = [];

  for (let m = inicio + intervalo; m <= maxMinutos; m += intervalo) {
    horas.push(minutosAHora(m));
  }
  if (horas.length === 0) {
    horas.push(horaMax);
  }
  return horas;
}

export function formatFechaPill(fechaIso: string): string {
  if (!fechaIso) return "";
  const [y, m, d] = fechaIso.split("-").map(Number);
  if (!y || !m || !d) return fechaIso;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return fechaIso;

  const weekday = date.toLocaleDateString("es-AR", { weekday: "long" });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const month = date.toLocaleDateString("es-AR", { month: "long" });

  return `${capitalizedWeekday}, ${d} de ${month}`;
}

export function formatFechaMobile(fechaIso: string): string {
  if (!fechaIso) return "";
  const [y, m, d] = fechaIso.split("-").map(Number);
  if (!y || !m || !d) return fechaIso;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return fechaIso;

  const weekday = date.toLocaleDateString("es-AR", { weekday: "short" });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", "");
  const month = date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

  return `${capitalizedWeekday}, ${d} ${capitalizedMonth} ${y}`;
}

export function formatHoraMobile(hora: string): string {
  if (!hora) return "";
  const [hStr, mStr] = hora.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h) || isNaN(m)) return hora;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mFormatted = String(m).padStart(2, "0");
  return `${h12}:${mFormatted} ${period}`;
}

