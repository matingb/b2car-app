import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import HorasTrabajadasPorEmpleado, { buildHorasTrabajadasChartItems } from "./HorasTrabajadasPorEmpleado";
import type { DashboardHorasTrabajadasPorEmpleado } from "@/lib/dashboard/types";

vi.mock("recharts", async () => {
    const React = await import("react");
    return {
        Cell: () => null,
        Pie: ({ data, children }: { data: unknown; children?: import("react").ReactNode }) =>
            React.createElement("div", { "data-testid": "pie-series", "data-items": JSON.stringify(data) }, children),
        PieChart: ({ children }: { children?: import("react").ReactNode }) =>
            React.createElement("div", null, children),
    };
});

vi.mock("@/app/components/shadcn/ui/chart", async () => {
    const React = await import("react");
    return {
        ChartContainer: ({ children }: { children?: import("react").ReactNode }) =>
            React.createElement("div", null, children),
        ChartTooltip: ({ content }: { content?: import("react").ReactElement<Record<string, unknown>> }) =>
            content
                ? React.cloneElement(content, {
                    active: true,
                    payload: [{
                        name: "monto",
                        value: 2.5,
                        color: "#123456",
                        payload: { label: "Tooltip empleado", monto: 2.5, cantidad: 0, porcentaje: 50 },
                    }],
                })
                : null,
    };
});

const datos = (empleados: DashboardHorasTrabajadasPorEmpleado["empleados"]): DashboardHorasTrabajadasPorEmpleado => ({
    totalHoras: empleados.reduce((total, empleado) => total + empleado.horasTrabajadas, 0),
    empleados,
});

describe("HorasTrabajadasPorEmpleado", () => {
    it("suma centésimas sin redondear cada fila a horas enteras", () => {
        const result = buildHorasTrabajadasChartItems(datos([
            { empleadoId: "a", label: "Ana", horasTrabajadas: 0.1 },
            { empleadoId: "b", label: "Beto", horasTrabajadas: 0.2 },
        ]));

        expect(result.totalCentesimas).toBe(30);
        expect(result.items.map((item) => item.monto)).toEqual([0.1, 0.2]);
    });

    it("no presenta un anillo hasta recibir datos y muestra el mensaje cuando el total es cero", () => {
        const { container, rerender } = render(<HorasTrabajadasPorEmpleado />);
        expect(container.textContent).toBe("");

        rerender(<HorasTrabajadasPorEmpleado data={{ totalHoras: 0, empleados: [] }} />);
        expect(screen.getByRole("status").textContent).toBe(
            "No hay horas trabajadas registradas en este período"
        );
        expect(screen.queryByTestId("pie-series")).toBeNull();
    });

    it("mantiene homónimos separados, agrupa el resto y permite desplegarlo", () => {
        const empleados = [
            { empleadoId: "employee-b", label: "Empleado compartido", horasTrabajadas: 2.5 },
            { empleadoId: "employee-a", label: "Empleado compartido", horasTrabajadas: 2 },
            { empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.5 },
            ...Array.from({ length: 5 }, (_, index) => ({
                empleadoId: `employee-${index + 1}`,
                label: `Empleado adicional ${index + 1}`,
                horasTrabajadas: 0.01,
            })),
        ];
        const data = datos(empleados);
        const { container } = render(<HorasTrabajadasPorEmpleado data={data} />);

        expect(screen.getByRole("img", { name: "Horas trabajadas: 5,05 h" })).toBeTruthy();
        expect(screen.getAllByText("Empleado compartido")).toHaveLength(2);
        expect(screen.getAllByText("2,50 h").length).toBeGreaterThan(0);
        expect(screen.getByText("49,5%")).toBeTruthy();
        expect(screen.getByText("Sin empleado")).toBeTruthy();
        expect(screen.queryByText("Cantidad:")).toBeNull();
        expect(screen.getByText("Otros")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Expandir otros" })).toBeTruthy();
        expect(container.textContent).not.toContain("$");

        const series = JSON.parse(container.querySelector("[data-testid='pie-series']")?.getAttribute("data-items") ?? "[]") as Array<{
            key: string;
            label: string;
            fill: string;
            porcentaje: number;
        }>;
        const homonyms = series.filter((item) => item.label === "Empleado compartido");
        expect(homonyms).toHaveLength(2);
        expect(new Set(homonyms.map((item) => item.key)).size).toBe(2);
        expect(series.map((item) => item.label)).toHaveLength(6);

        fireEvent.click(screen.getByRole("button", { name: "Expandir otros" }));
        expect(screen.getByRole("button", { name: "Contraer otros" })).toBeTruthy();
        const expandedSeries = JSON.parse(container.querySelector("[data-testid='pie-series']")?.getAttribute("data-items") ?? "[]") as typeof series;
        expect(expandedSeries.map((item) => item.label)).toHaveLength(8);

        const rowColors = new Map(
            Array.from(container.querySelectorAll<HTMLElement>("[data-testid='desglose-row']")).map((row) => [
                row.dataset.chartKey,
                row.querySelector<HTMLElement>("[data-testid='desglose-bar']")?.style.backgroundColor,
            ])
        );
        for (const item of expandedSeries) {
            const expectedColor = document.createElement("div");
            expectedColor.style.backgroundColor = item.fill;
            expect(rowColors.get(item.key)).toBe(expectedColor.style.backgroundColor);
        }
    });

    it("rechaza diferencias entre la suma en centésimas y el total del servidor", () => {
        expect(() => buildHorasTrabajadasChartItems({
            totalHoras: 0.4,
            empleados: [{ empleadoId: "a", label: "Ana", horasTrabajadas: 0.3 }],
        })).toThrow("no coincide con el total del dashboard");
    });
});
