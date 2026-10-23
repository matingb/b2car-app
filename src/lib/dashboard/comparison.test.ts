import { describe, expect, it } from "vitest";
import {
    DASHBOARD_MONTH_ROW_ID,
    DEFAULT_COMPARISON_STATE,
    MAX_VISIBLE_PERIODS,
    addComparisonRow,
    countVisible,
    isDuplicatePeriod,
    moveComparisonRow,
    parseComparisonState,
    removeComparisonRow,
    resolveComparisonPeriod,
    toggleComparisonRow,
    visibilityBlocker,
    type ComparisonState,
} from "./comparison";
import { buildMonthPeriod } from "./periods";

const octubre2026 = buildMonthPeriod(2026, 9);

/** Tabla por defecto (mes del dashboard) más `count` meses de 2025, agregados de enero en adelante. */
function withRows(count: number): ComparisonState {
    let state = DEFAULT_COMPARISON_STATE;
    for (let i = 0; i < count; i++) {
        state = addComparisonRow(state, { kind: "mes", year: 2025, month: i }, `r${i}`);
    }
    return state;
}

const ids = (state: ComparisonState) => state.rows.map((row) => row.id);

describe("resolveComparisonPeriod", () => {
    it("resuelve el mes del dashboard y los relativos contra el mes del header", () => {
        expect(resolveComparisonPeriod({ kind: "mes-dashboard" }, octubre2026)).toEqual(octubre2026);
        expect(resolveComparisonPeriod({ kind: "mes-anterior" }, octubre2026)).toEqual(buildMonthPeriod(2026, 8));
        expect(resolveComparisonPeriod({ kind: "anio-anterior" }, octubre2026)).toEqual(buildMonthPeriod(2025, 9));
        expect(resolveComparisonPeriod({ kind: "mes-anterior" }, buildMonthPeriod(2026, 0))?.label).toBe("Diciembre 2025");
    });

    it("dado el período UTC del primer render, resuelve el mismo mes anterior", () => {
        expect(resolveComparisonPeriod({ kind: "mes-anterior" }, buildMonthPeriod(2026, 9, "UTC"))).toEqual(
            buildMonthPeriod(2026, 8),
        );
    });

    it("resuelve meses fijos y rangos de fechas", () => {
        expect(resolveComparisonPeriod({ kind: "mes", year: 2025, month: 2 }, octubre2026)?.label).toBe("Marzo 2025");
        expect(resolveComparisonPeriod({ kind: "rango", desde: "2026-09-15", hasta: "2026-10-15" }, octubre2026)?.label).toBe(
            "15/09/26 – 15/10/26",
        );
    });
});

describe("isDuplicatePeriod", () => {
    it("detecta períodos ya agregados aunque estén definidos distinto", () => {
        const state = addComparisonRow(DEFAULT_COMPARISON_STATE, { kind: "mes-anterior" }, "r1");

        expect(isDuplicatePeriod(state, { kind: "mes", year: 2026, month: 9 }, octubre2026)).toBe(true);
        expect(isDuplicatePeriod(state, { kind: "mes", year: 2026, month: 8 }, octubre2026)).toBe(true);
        expect(isDuplicatePeriod(state, { kind: "anio-anterior" }, octubre2026)).toBe(false);
    });

    it("después de borrar el mes del dashboard, deja volver a agregarlo", () => {
        const state = removeComparisonRow(DEFAULT_COMPARISON_STATE, DASHBOARD_MONTH_ROW_ID);
        expect(isDuplicatePeriod(state, { kind: "mes-dashboard" }, octubre2026)).toBe(false);
    });
});

describe("orden de las filas", () => {
    it("arranca con el mes del dashboard e inserta cada fila nueva arriba de todo", () => {
        expect(ids(DEFAULT_COMPARISON_STATE)).toEqual([DASHBOARD_MONTH_ROW_ID]);
        expect(ids(withRows(2))).toEqual(["r1", "r0", DASHBOARD_MONTH_ROW_ID]);
    });

    it("mueve una fila a la posición indicada y la primera pasa a ser la referencia", () => {
        const state = withRows(2);

        expect(ids(moveComparisonRow(state, DASHBOARD_MONTH_ROW_ID, 0))).toEqual([DASHBOARD_MONTH_ROW_ID, "r1", "r0"]);
        expect(ids(moveComparisonRow(state, "r1", 2))).toEqual(["r0", DASHBOARD_MONTH_ROW_ID, "r1"]);
        expect(ids(moveComparisonRow(state, "r0", 0))).toEqual(["r0", "r1", DASHBOARD_MONTH_ROW_ID]);
    });

    it("ignora movimientos fuera de rango o de filas que no existen", () => {
        const state = withRows(2);

        expect(ids(moveComparisonRow(state, "r1", -1))).toEqual(ids(state));
        expect(ids(moveComparisonRow(state, DASHBOARD_MONTH_ROW_ID, 99))).toEqual(ids(state));
        expect(moveComparisonRow(state, "no-existe", 0)).toBe(state);
    });

    it("mover no cambia visibilidad ni colores", () => {
        const state = withRows(2);
        const moved = moveComparisonRow(state, DASHBOARD_MONTH_ROW_ID, 0);

        expect([...moved.rows].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
            [...state.rows].sort((a, b) => a.id.localeCompare(b.id)),
        );
    });
});

describe("visibilidad", () => {
    it(`muestra las filas nuevas hasta ${MAX_VISIBLE_PERIODS} visibles y agrega ocultas las siguientes`, () => {
        const state = withRows(4);

        expect(countVisible(state)).toBe(MAX_VISIBLE_PERIODS);
        expect(state.rows.find((r) => r.id === "r3")?.visible).toBe(false);
        expect(visibilityBlocker(state, "r3")).toBe("max");
        expect(toggleComparisonRow(state, "r3")).toBe(state);
    });

    it("no deja ocultar el último período visible", () => {
        const state = toggleComparisonRow(DEFAULT_COMPARISON_STATE, DASHBOARD_MONTH_ROW_ID);

        expect(state.rows[0].visible).toBe(true);
        expect(visibilityBlocker(state, DASHBOARD_MONTH_ROW_ID)).toBe("last");
    });

    it("asigna colores sin repetir entre visibles y conserva el propio al volver a mostrar si está libre", () => {
        let state = withRows(3);
        const color = (id: string) => state.rows.find((r) => r.id === id)?.colorIndex;
        expect([color(DASHBOARD_MONTH_ROW_ID), color("r0"), color("r1"), color("r2")]).toEqual([0, 1, 2, 3]);

        state = toggleComparisonRow(state, "r1");
        state = toggleComparisonRow(state, "r1");
        expect(color("r1")).toBe(2);

        state = toggleComparisonRow(state, "r1");
        state = addComparisonRow(state, { kind: "anio-anterior" }, "r9");
        state = toggleComparisonRow(state, DASHBOARD_MONTH_ROW_ID);
        state = toggleComparisonRow(state, "r1");
        const visibles = state.rows.filter((r) => r.visible).map((r) => r.colorIndex);
        expect(new Set(visibles).size).toBe(visibles.length);
    });
});

describe("quitar filas", () => {
    it("deja borrar el mes del dashboard y vaciar la tabla", () => {
        let state = withRows(1);
        state = removeComparisonRow(state, DASHBOARD_MONTH_ROW_ID);
        expect(ids(state)).toEqual(["r0"]);

        state = removeComparisonRow(state, "r0");
        expect(state.rows).toEqual([]);
        expect(countVisible(state)).toBe(0);
    });

    it("al quitar la única fila visible, muestra la que quedó arriba de todo", () => {
        let state = withRows(1);
        state = toggleComparisonRow(state, DASHBOARD_MONTH_ROW_ID);
        expect(state.rows.map((r) => r.visible)).toEqual([true, false]);

        state = removeComparisonRow(state, "r0");
        expect(state.rows).toMatchObject([{ id: DASHBOARD_MONTH_ROW_ID, visible: true }]);
    });

    it("con la tabla vacía, la fila nueva entra visible", () => {
        const vacia = removeComparisonRow(DEFAULT_COMPARISON_STATE, DASHBOARD_MONTH_ROW_ID);
        const state = addComparisonRow(vacia, { kind: "mes-anterior" }, "r1");

        expect(state.rows).toMatchObject([{ id: "r1", visible: true, colorIndex: 0 }]);
    });
});

describe("parseComparisonState", () => {
    it("devuelve el estado por defecto ante datos corruptos o sin filas guardadas", () => {
        expect(parseComparisonState(null)).toEqual(DEFAULT_COMPARISON_STATE);
        expect(parseComparisonState("texto")).toEqual(DEFAULT_COMPARISON_STATE);
        expect(parseComparisonState({ open: true })).toEqual(DEFAULT_COMPARISON_STATE);
    });

    it("respeta una tabla vaciada a propósito", () => {
        expect(parseComparisonState({ open: true, rows: [] })).toEqual({ open: true, rows: [] });
    });

    it("descarta filas inválidas o repetidas, respeta el orden y restablece los invariantes", () => {
        const state = parseComparisonState({
            open: true,
            rows: [
                { id: "a", def: { kind: "mes-anterior" }, visible: true, colorIndex: 1 },
                { id: "a", def: { kind: "anio-anterior" }, visible: true, colorIndex: 2 },
                { id: "b", def: { kind: "mes", year: 2025, month: 13 }, visible: true, colorIndex: 2 },
                { id: "c", def: { kind: "rango", desde: "2026-10-10", hasta: "2026-10-01" }, visible: true },
                { id: "d", def: { kind: "anio-anterior" }, visible: true, colorIndex: 1 },
                { id: "e", def: { kind: "mes-dashboard" }, visible: true, colorIndex: 0 },
                { id: "f", def: { kind: "mes", year: 2025, month: 0 }, visible: true, colorIndex: 0 },
                { id: "g", def: { kind: "mes", year: 2025, month: 1 }, visible: true, colorIndex: 0 },
            ],
        });

        expect(state.open).toBe(true);
        expect(ids(state)).toEqual(["a", "d", "e", "f", "g"]);
        expect(countVisible(state)).toBe(MAX_VISIBLE_PERIODS);
        expect(state.rows.find((r) => r.id === "g")?.visible).toBe(false);
        const visibles = state.rows.filter((r) => r.visible).map((r) => r.colorIndex);
        expect(new Set(visibles).size).toBe(visibles.length);
    });

    it("si hay filas pero ninguna visible, muestra la primera", () => {
        const state = parseComparisonState({
            rows: [
                { id: "a", def: { kind: "mes-anterior" }, visible: false },
                { id: "b", def: { kind: "anio-anterior" }, visible: false },
            ],
        });
        expect(state.rows.map((r) => r.visible)).toEqual([true, false]);
    });
});
