import { describe, expect, it } from "vitest";
import { applyGranularity } from "./aggregation";

type Point = { label: string; cantidad: number };

function sumCantidad(label: string, items: Point[]): Point {
    return {
        label,
        cantidad: items.reduce((total, item) => total + item.cantidad, 0),
    };
}

describe("applyGranularity", () => {
    const periodFrom = "2026-06-01T00:00:00.000Z";
    const data: Point[] = [
        { label: "01", cantidad: 2 },
        { label: "02", cantidad: 3 },
        { label: "08", cantidad: 5 },
    ];

    it("devuelve los datos originales para granularidad diaria", () => {
        expect(applyGranularity(data, "day", periodFrom, sumCantidad)).toEqual(data);
    });

    it("agrupa los datos por semana calendario", () => {
        expect(applyGranularity(data, "week", periodFrom, sumCantidad)).toEqual([
            { label: "01/06 - 07/06", cantidad: 5 },
            { label: "08/06 - 14/06", cantidad: 5 },
        ]);
    });

    it("agrupa todos los datos del periodo en el mes seleccionado", () => {
        expect(applyGranularity(data, "month", periodFrom, sumCantidad)).toEqual([
            { label: "Jun 2026", cantidad: 10 },
        ]);
    });
});
