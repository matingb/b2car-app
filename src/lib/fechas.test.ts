import { describe, it, expect } from "vitest";
import {
  argentinaCalendarDateRangeISO,
  formatCalendarDateLabel,
  formatDateLabel,
  formatDateTimeLabel,
  formatLocalDateLabel,
  formatTimeAgo,
  isValidDate,
  localCalendarDateEndExclusiveISO,
  localCalendarDateRangeISO,
  localCalendarDateStartISO,
  parseCalendarDate,
  toAppCalendarDate,
  toDateInputFormat,
  toISODateTimeWithCurrentTime,
  toISODateTimeWithLocalCurrentTime,
  toISODateAppTimeZone,
  toISODateLocal,
  toLocalDateInputFormat,
} from "./fechas";

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

describe("fechas de calendario local", () => {
	it("obtiene la fecha calendario de Buenos Aires para un instante UTC", () => {
	  expect(toISODateAppTimeZone(new Date("2026-10-07T02:59:59Z"))).toBe("2026-10-06");
	  expect(toISODateAppTimeZone(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-07");
	});

	it("construye rangos estables en la zona de Buenos Aires", () => {
	  expect(argentinaCalendarDateRangeISO("2026-09-18", "2026-09-18")).toEqual({
	    from: "2026-09-18T03:00:00.000Z",
	    to: "2026-09-19T03:00:00.000Z",
	  });
	});

  it("valida fechas Gregorianas sin interpretar YYYY-MM-DD como UTC", () => {
    expect(parseCalendarDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(isValidDate("2026-02-30")).toBe(false);
  });

  it("construye un rango local semiabierto usando medianoches de calendario", () => {
    const start = localCalendarDateStartISO("2026-09-01");
    const end = localCalendarDateEndExclusiveISO("2026-09-13");
    const expectedStart = new Date(2026, 8, 1).toISOString();
    const expectedEnd = new Date(2026, 8, 14).toISOString();
    expect(start).toBe(expectedStart);
    expect(end).toBe(expectedEnd);
    expect(localCalendarDateRangeISO("2026-09-01", "2026-09-13")).toEqual({
      from: expectedStart,
      to: expectedEnd,
    });
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Argentina/Buenos_Aires") {
      expect(start).toBe("2026-09-01T03:00:00.000Z");
      expect(end).toBe("2026-09-14T03:00:00.000Z");
    }
  });

  it("usa el día calendario siguiente aun si el cambio horario hace que el día dure 23 horas", () => {
    const start = localCalendarDateStartISO("2026-03-08");
    const end = localCalendarDateEndExclusiveISO("2026-03-08");
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === "America/New_York") {
      expect(Date.parse(end!) - Date.parse(start!)).toBe(23 * 60 * 60 * 1000);
    }
  });

  it("combina el día elegido con la hora local actual y muestra el día local del timestamp", () => {
    const now = new Date(2026, 8, 24, 21, 35, 12, 345);
    const expected = new Date(2026, 8, 13, 21, 35, 12, 345).toISOString();
    expect(toISODateTimeWithLocalCurrentTime("2026-09-13", now)).toBe(expected);
    expect(toLocalDateInputFormat(expected)).toBe(toISODateLocal(new Date(expected)));
    expect(formatCalendarDateLabel("2026-09-13")).toBe("13/09/2026");
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Argentina/Buenos_Aires") {
      expect(formatLocalDateLabel("2026-09-14T00:00:00.000Z")).toBe("13/09/2026");
      expect(formatDateTimeLabel("2026-09-14T00:00:00.000Z")).toBe("13/09/2026, 21:00");
    }
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

describe("toAppCalendarDate", () => {
  it("devuelve tal cual una fecha sin hora", () => {
    expect(toAppCalendarDate("2026-10-12")).toBe("2026-10-12");
  });

  it("convierte un timestamp a GMT-3 en lugar de tomar el día UTC", () => {
    // 22:30 del 12/10 en Buenos Aires ya es el 13/10 en UTC.
    expect(toAppCalendarDate("2026-10-13T01:30:00.000Z")).toBe("2026-10-12");
    expect(toAppCalendarDate("2026-10-13T02:59:59.999Z")).toBe("2026-10-12");
    expect(toAppCalendarDate("2026-10-13T03:00:00.000Z")).toBe("2026-10-13");
  });

  it("acepta los formatos de timestamp que devuelve Supabase (espacio y offset corto)", () => {
    expect(toAppCalendarDate("2026-10-13 01:30:00+00")).toBe("2026-10-12");
    expect(toAppCalendarDate("2026-10-13T01:30:00.123456+00:00")).toBe("2026-10-12");
  });

  it("interpreta un timestamp sin zona como hora de Buenos Aires", () => {
    expect(toAppCalendarDate("2026-10-12 22:30:00")).toBe("2026-10-12");
  });

  it("respeta otros offsets al convertir a GMT-3", () => {
    expect(toAppCalendarDate("2026-10-13T00:30:00-03:00")).toBe("2026-10-13");
    expect(toAppCalendarDate("2026-10-13T02:30:00+02:00")).toBe("2026-10-12");
  });

  it("conserva el día de los registros viejos guardados sin hora (medianoche UTC)", () => {
    expect(toAppCalendarDate("2026-06-08T00:00:00.000Z")).toBe("2026-06-08");
    expect(toAppCalendarDate("2026-06-08T00:00:00+00:00")).toBe("2026-06-08");
    expect(toAppCalendarDate("2026-06-08 00:00:00+00")).toBe("2026-06-08");
  });

  it("no trata como fecha sin hora a un instante que no es medianoche UTC exacta", () => {
    expect(toAppCalendarDate("2026-06-08T00:00:00.001Z")).toBe("2026-06-07");
  });

  it("devuelve null para valores vacíos o inválidos", () => {
    expect(toAppCalendarDate("")).toBeNull();
    expect(toAppCalendarDate(null)).toBeNull();
    expect(toAppCalendarDate("no-es-fecha")).toBeNull();
  });
});

describe("toDateInputFormat", () => {
  it("preserva el dia de calendario cuando la fecha viene a medianoche UTC", () => {
    expect(toDateInputFormat("2026-06-08T00:00:00.000Z")).toBe("2026-06-08");
  });

  it("preserva el dia de calendario cuando Supabase devuelve fecha con espacio y timezone", () => {
    expect(toDateInputFormat("2026-06-08 00:00:00+00")).toBe("2026-06-08");
  });

  it("usa el día de Buenos Aires para un timestamp con hora", () => {
    expect(toDateInputFormat("2026-10-13T01:30:00.000Z")).toBe("2026-10-12");
    expect(toDateInputFormat("2026-10-13T03:00:00.000Z")).toBe("2026-10-13");
  });

  it("devuelve vacío si no hay fecha o es inválida", () => {
    expect(toDateInputFormat(undefined)).toBe("");
    expect(toDateInputFormat("no-es-fecha")).toBe("");
  });
});

describe("formatDateLabel", () => {
  it("muestra el dia correcto para una fecha guardada a medianoche UTC", () => {
    expect(formatDateLabel("2026-06-08T00:00:00.000Z")).toBe("08/06/2026");
  });

  it("muestra el día de hoy para un arreglo creado de noche en GMT-3", () => {
    // Creado el 12/10 a las 22:30 (GMT-3), guardado como 2026-10-13T01:30Z.
    expect(formatDateLabel("2026-10-13T01:30:00.000Z")).toBe("12/10/2026");
    expect(formatDateLabel("2026-10-13 01:30:00+00")).toBe("12/10/2026");
  });

  it("cambia de día a la medianoche de Buenos Aires", () => {
    expect(formatDateLabel("2026-10-13T02:59:59.999Z")).toBe("12/10/2026");
    expect(formatDateLabel("2026-10-13T03:00:00.000Z")).toBe("13/10/2026");
  });

  it("no corre un día una fecha sin hora (ej: cumpleaños)", () => {
    expect(formatDateLabel("1990-05-10")).toBe("10/05/1990");
  });

  it("devuelve el fallback cuando no hay fecha", () => {
    expect(formatDateLabel(null, "-")).toBe("-");
    expect(formatDateLabel(undefined)).toBe("");
  });
});

describe("formatDateTimeLabel", () => {
  it("muestra fecha y hora en formato de 24 horas en GMT-3", () => {
    expect(formatDateTimeLabel("2026-06-08T14:30:00.000Z")).toBe("08/06/2026, 11:30");
  });

  it("no depende del día UTC cuando el instante cruza la medianoche UTC", () => {
    expect(formatDateTimeLabel("2026-10-13T01:30:00.000Z")).toBe("12/10/2026, 22:30");
  });
});

describe("toISODateTimeWithCurrentTime", () => {
  it("conserva el dia elegido y completa la hora actual", () => {
    const now = new Date("2026-08-26T17:30:45.123Z");

    expect(toISODateTimeWithCurrentTime("2026-08-20", now)).toBe("2026-08-20T17:30:45.123Z");
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


