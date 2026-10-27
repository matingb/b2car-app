import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import PanelArreglos from "./PanelArreglos";

vi.mock("@/app/components/graficos/GraficoArreglos", () => ({ default: () => null }));
vi.mock("@/app/components/graficos/GraficoComparacion", () => ({ default: () => null }));
vi.mock("@/app/components/graficos/VolumenDeTrabajo", () => ({ default: () => null }));
vi.mock("@/app/components/graficos/EstadoCobroArreglos", () => ({ default: () => null }));
vi.mock("@/app/components/dashboard/comparacion/PeriodComparison", () => ({ default: () => null }));

describe("PanelArreglos", () => {
    it("agrega las horas antes de los gráficos de volumen y estado de pago", () => {
        const { container } = render(
            <PanelArreglos
                periods={[] as never}
                granularity="day"
                stats={null}
                comparison={null as never}
            />
        );

        const headings = Array.from(container.querySelectorAll("h4")).map((heading) => heading.textContent);
        expect(headings).toEqual([
            "Arreglos realizados",
            "Horas trabajadas por empleado",
            "Volumen de trabajo por categoría",
            "Estado de pago",
        ]);
    });
});
