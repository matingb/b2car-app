import { describe, expect, it } from "vitest";
import { applyGranularity } from "./aggregation";

type Point = { fecha: string; cantidad: number };

const sumCantidad = (items: Point[]) => ({
    cantidad: items.reduce((total, item) => total + item.cantidad, 0),
});

describe("applyGranularity", () => {
    const data: Point[] = [
        { fecha: "2026-06-01", cantidad: 2 },
        { fecha: "2026-06-02", cantidad: 3 },
        { fecha: "2026-06-08", cantidad: 5 },
    ];

    it("deja un punto por día con etiqueta día/mes", () => {
        expect(applyGranularity(data, "day", sumCantidad)).toEqual([
            { key: "2026-06-01", label: "01/06", cantidad: 2 },
            { key: "2026-06-02", label: "02/06", cantidad: 3 },
            { key: "2026-06-08", label: "08/06", cantidad: 5 },
        ]);
    });

    it("agrupa los datos por semana calendario de lunes a domingo", () => {
        expect(applyGranularity(data, "week", sumCantidad)).toEqual([
            { key: "2026-06-01", label: "01/06 - 07/06", cantidad: 5 },
            { key: "2026-06-08", label: "08/06 - 14/06", cantidad: 5 },
        ]);
    });

    it("agrupa los datos por mes calendario", () => {
        expect(applyGranularity(data, "month", sumCantidad)).toEqual([
            { key: "2026-06-01", label: "Jun 2026", cantidad: 10 },
        ]);
    });

    it("dado un período que cruza meses, separa cada mes y cada semana sin mezclar días de otro año", () => {
        const rango: Point[] = [
            { fecha: "2026-09-29", cantidad: 1 },
            { fecha: "2026-09-30", cantidad: 2 },
            { fecha: "2026-10-01", cantidad: 4 },
            { fecha: "2026-10-05", cantidad: 8 },
        ];

        expect(applyGranularity(rango, "month", sumCantidad)).toEqual([
            { key: "2026-09-01", label: "Sep 2026", cantidad: 3 },
            { key: "2026-10-01", label: "Oct 2026", cantidad: 12 },
        ]);
        expect(applyGranularity(rango, "week", sumCantidad)).toEqual([
            { key: "2026-09-28", label: "28/09 - 04/10", cantidad: 7 },
            { key: "2026-10-05", label: "05/10 - 11/10", cantidad: 8 },
        ]);
    });

    it("dado un período que corta la primera y la última semana, solo suma los días incluidos", () => {
        const octubre: Point[] = [
            { fecha: "2026-10-01", cantidad: 3 },
            { fecha: "2026-10-31", cantidad: 4 },
        ];

        expect(applyGranularity(octubre, "week", sumCantidad)).toEqual([
            { key: "2026-09-28", label: "28/09 - 04/10", cantidad: 3 },
            { key: "2026-10-26", label: "26/10 - 01/11", cantidad: 4 },
        ]);
    });

    it("ordena cronológicamente aunque la serie llegue desordenada e ignora fechas inválidas", () => {
        const desordenada: Point[] = [
            { fecha: "2026-01-02", cantidad: 1 },
            { fecha: "2025-12-31", cantidad: 2 },
            { fecha: "31/12", cantidad: 9 },
        ];

        expect(applyGranularity(desordenada, "month", sumCantidad)).toEqual([
            { key: "2025-12-01", label: "Dic 2025", cantidad: 2 },
            { key: "2026-01-01", label: "Ene 2026", cantidad: 1 },
        ]);
    });
});
