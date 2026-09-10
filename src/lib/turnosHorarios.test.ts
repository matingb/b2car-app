import { describe, expect, it } from "vitest";
import {
  calcularDuracionMinutos,
  formatFechaPill,
  formatFechaMobile,
  formatHoraMobile,
  generarHorasFin,
  generarHorasInicio,
  minutosAHora,
  sumarMinutosAHora,
  DURACION_TODO_EL_DIA,
} from "./turnosHorarios";

describe("turnosHorarios", () => {
  it("convierte minutos a formato HH:mm", () => {
    expect(minutosAHora(360)).toBe("06:00");
    expect(minutosAHora(570)).toBe("09:30");
    expect(minutosAHora(1320)).toBe("22:00");
  });

  it("suma minutos a una hora correctamente", () => {
    expect(sumarMinutosAHora("09:30", 60)).toBe("10:30");
    expect(sumarMinutosAHora("06:00", DURACION_TODO_EL_DIA)).toBe("22:00");
  });

  it("calcula la duración entre hora inicio y fin", () => {
    expect(calcularDuracionMinutos("09:30", "10:30")).toBe(60);
    expect(calcularDuracionMinutos("06:00", "22:00")).toBe(960);
  });

  it("genera horas de inicio cada 30 minutos entre 06:00 y 21:30", () => {
    const horas = generarHorasInicio();
    expect(horas[0]).toBe("06:00");
    expect(horas[1]).toBe("06:30");
    expect(horas[horas.length - 1]).toBe("21:30");
    expect(horas).toContain("09:00");
  });

  it("genera horas de fin posteriores a la hora de inicio", () => {
    const horasFin = generarHorasFin("21:00");
    expect(horasFin).toEqual(["21:30", "22:00"]);
  });

  it("formatea la fecha en estilo Google Calendar en español", () => {
    // 2026-09-09 es miércoles
    const pill = formatFechaPill("2026-09-09");
    expect(pill.toLowerCase()).toContain("miércoles");
    expect(pill).toContain("9");
    expect(pill.toLowerCase()).toContain("septiembre");
  });

  it("formatea la fecha en estilo mobile (ej: Mié, 9 Sep 2026)", () => {
    const mobileDate = formatFechaMobile("2026-09-09");
    expect(mobileDate.toLowerCase()).toContain("mié");
    expect(mobileDate).toContain("9");
    expect(mobileDate).toContain("Sep");
    expect(mobileDate).toContain("2026");
  });

  it("formatea la hora en estilo mobile am/pm (ej: 9:30 am, 2:00 pm)", () => {
    expect(formatHoraMobile("09:30")).toBe("9:30 am");
    expect(formatHoraMobile("09:45")).toBe("9:45 am");
    expect(formatHoraMobile("14:00")).toBe("2:00 pm");
    expect(formatHoraMobile("06:00")).toBe("6:00 am");
    expect(formatHoraMobile("22:00")).toBe("10:00 pm");
  });
});
