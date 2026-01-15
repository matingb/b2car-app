"use client";

export function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function horaAMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function isSameLocalDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Dom..Sáb)
  const offset = (day + 6) % 7; // 0..6 (Lun..Dom)
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(date: Date) {
  const start = startOfWeekMonday(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthGrid(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);

  // lunes=0..domingo=6
  const firstOffset = (first.getDay() + 6) % 7;
  const days: Array<Date | null> = [];
  for (let i = 0; i < firstOffset; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
  return days;
}

