import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getWeekDays } from "@/app/components/turnos/utils/calendar";
import { runPendingPromises } from "@/tests/testUtils";
import {
  buildPeriodoLabel,
  useTurnosCalendar,
  VistaTurnos,
} from "@/app/hooks/useTurnosCalendar";

describe("buildPeriodoLabel", () => {
  it.each([
    {
      name: `mensual: devuelve "Enero 2026"`,
      vista: VistaTurnos.Mensual,
      expected: "Enero 2026",
    },
    {
      name: `diaria: devuelve "jueves, 15 de enero de 2026"`,
      vista: VistaTurnos.Diaria,
      expected: "jueves, 15 de enero de 2026",
    },
    {
      name: `semanal: devuelve "Semana del 12 al 18 de Enero"`,
      vista: VistaTurnos.Semanal,
      expected: "Semana del 12 al 18 de Enero",
    },
  ])("$name", ({ vista, expected }) => {
    const fechaActual = new Date(2026, 0, 15, 12); // 15 Ene 2026 (mediodía)
    const diasSemana = getWeekDays(fechaActual);

    const label = buildPeriodoLabel({
      vista,
      fechaActual,
      diasSemana,
    });

    expect(label).toBe(expected);
  });
});

describe("useTurnosCalendar navegación", () => {
  it.each([
    {
      name: "diaria: +1 día",
      vista: VistaTurnos.Diaria,
      expected: new Date(2026, 0, 16, 12),
    },
    {
      name: "semanal: +7 días",
      vista: VistaTurnos.Semanal,
      expected: new Date(2026, 0, 22, 12),
    },
    {
      name: "mensual: +1 mes",
      vista: VistaTurnos.Mensual,
      expected: new Date(2026, 1, 15, 12),
    },
  ])("next modifica en $name", async ({ vista, expected }) => {
    const { result } = renderHook(() => useTurnosCalendar());

    act(() => {
      result.current.setFechaActual(new Date(2026, 0, 15, 12));
      result.current.setVista(vista);
    });
    await runPendingPromises();

    act(() => result.current.goNextPeriod());
    await runPendingPromises();

    expect(result.current.fechaActual).toEqual(expected);
  });


  it.each([
    {
      name: "diaria: -1 día",
      vista: VistaTurnos.Diaria,
      expected: new Date(2026, 0, 14, 12),
    },
    {
      name: "semanal: -7 días",
      vista: VistaTurnos.Semanal,
      expected: new Date(2026, 0, 8, 12),
    },
    {
      name: "mensual: -1 mes",
      vista: VistaTurnos.Mensual,
      expected: new Date(2025, 11, 15, 12),
    },
  ])("prev modifica en $name", async ({ vista, expected }) => {
    const { result } = renderHook(() => useTurnosCalendar());

    act(() => {
      result.current.setFechaActual(new Date(2026, 0, 15, 12));
      result.current.setVista(vista);
    });
    await runPendingPromises();

    act(() => result.current.goPrevPeriod());
    await runPendingPromises();

    expect(result.current.fechaActual).toEqual(expected);
  });
});

