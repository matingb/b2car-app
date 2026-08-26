import { describe, it, expect } from "vitest";
import { formatDateLabel, formatDateTimeLabel, formatTimeAgo, isValidDate, toDateInputFormat, toISODateTimeWithCurrentTime } from "./fechas";

describe("isValidDate", () => {
  it("debería retornar true para una fecha válida en formato YYYY-MM-DD", () => {
    expect(isValidDate("2025-11-29")).toBe(true);
  });

  it("debería retornar false para una cadena vacía", () => {
    expect(isValidDate("")).toBe(false);
  });

  it("debería retornar false para una fecha con día inválido", () => {
    expect(isValidDate("2025-02-30")).toBe(false);
  });

  it("debería retornar false para un formato incorrecto", () => {
    expect(isValidDate("29-11-2025")).toBe(false);
  });

  it("debería retornar false para texto que no es fecha", () => {
    expect(isValidDate("abc")).toBe(false);
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-01-03T12:00:00.000Z");

  it('si fecha es inválida, devuelve vacio', () => {
    expect(formatTimeAgo("no-es-fecha", now)).toBe("");
  });

  it("para segundos (<60), devuelve 'Hace ... segundos'", () => {
    const fecha = new Date(now.getTime() - 30 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 30 segundos");
  });

  it("para minutos (<60), devuelve 'Hace ... minutos'", () => {
    const fecha = new Date(now.getTime() - 15 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 15 minutos");
  });

  it("para horas (<24), devuelve 'Hace ... horas'", () => {
    const fecha = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 horas");
  });

  it("para días (<30), devuelve 'Hace ... días'", () => {
    const fecha = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 3 días");
  });

  it("para meses (<12), devuelve 'Hace ... meses'", () => {
    const fecha = new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 meses");
  });

  it("para años (>=12 meses), devuelve 'Hace ... años'", () => {
    const fecha = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 años");
  });
});

describe("toDateInputFormat", () => {
  it("preserva el dia de calendario cuando la fecha viene a medianoche UTC", () => {
    expect(toDateInputFormat("2026-06-08T00:00:00.000Z")).toBe("2026-06-08");
  });

  it("preserva el dia de calendario cuando Supabase devuelve fecha con espacio y timezone", () => {
    expect(toDateInputFormat("2026-06-08 00:00:00+00")).toBe("2026-06-08");
  });
});

describe("formatDateLabel", () => {
  it("muestra el dia correcto para una fecha guardada a medianoche UTC", () => {
    expect(formatDateLabel("2026-06-08T00:00:00.000Z")).toBe("08/06/2026");
  });
});

describe("formatDateTimeLabel", () => {
  it("muestra fecha y hora en formato de 24 horas", () => {
    expect(formatDateTimeLabel("2026-06-08T14:30:00.000Z")).toBe("08/06/2026, 14:30");
  });
});

describe("toISODateTimeWithCurrentTime", () => {
  it("conserva el dia elegido y completa la hora actual", () => {
    const now = new Date(2026, 7, 26, 14, 30, 45, 123);

    expect(toISODateTimeWithCurrentTime("2026-08-20", now)).toBe("2026-08-20T14:30:45.123Z");
  });

  it("devuelve el string intacto si ya es un timestamp completo ISO (idempotencia)", () => {
    const now = new Date(2026, 7, 26, 14, 30, 45, 123);
    const isoString = "2026-08-20T10:15:00.000Z";

    expect(toISODateTimeWithCurrentTime(isoString, now)).toBe(isoString);
  });

  it("acepta un objeto Date y devuelve su ISO string", () => {
    const dateObj = new Date("2026-08-20T10:15:00.000Z");

    expect(toISODateTimeWithCurrentTime(dateObj)).toBe("2026-08-20T10:15:00.000Z");
  });
});


