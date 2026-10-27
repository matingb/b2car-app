import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DesglosePieChart from "./DesglosePieChart";

vi.mock("recharts", async () => {
    const React = await import("react");
    return {
        Cell: () => null,
        Pie: ({ data, paddingAngle, children }: { data: unknown; paddingAngle?: number; children?: import("react").ReactNode }) =>
            React.createElement("div", {
                "data-testid": "pie-series",
                "data-items": JSON.stringify(data),
                "data-padding-angle": paddingAngle,
            }, children),
        PieChart: ({ children }: { children?: import("react").ReactNode }) =>
            React.createElement("div", null, children),
    };
});

vi.mock("@/app/components/shadcn/ui/chart", async () => {
    const React = await import("react");
    return {
        ChartContainer: ({ children }: { children?: import("react").ReactNode }) =>
            React.createElement("div", null, children),
        ChartTooltip: ({
            content,
            allowEscapeViewBox,
            wrapperStyle,
        }: {
            content?: import("react").ReactElement<Record<string, unknown>>;
            allowEscapeViewBox?: { x: boolean; y: boolean };
            wrapperStyle?: import("react").CSSProperties;
        }) => React.createElement(
            "div",
            {
                "data-testid": "chart-tooltip-wrapper",
                "data-escape-x": allowEscapeViewBox?.x,
                "data-escape-y": allowEscapeViewBox?.y,
                "data-z-index": wrapperStyle?.zIndex,
            },
            content
                ? React.cloneElement(content, {
                    active: true,
                    payload: [{
                        name: "monto",
                        value: 2500,
                        color: "#123456",
                        payload: { label: "Tooltip empleado", monto: 2500, cantidad: 2, porcentaje: 50 },
                    }],
                })
                : null
        ),
    };
});

function mockContainerWidth(width: number) {
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        width,
        height: 400,
        top: 0,
        right: width,
        bottom: 400,
        left: 0,
        toJSON: () => ({}),
    } as DOMRect);
}

describe("DesglosePieChart", () => {
    it("conserva formato monetario, cantidad en tooltip y agrupación predeterminados", () => {
        const items = Array.from({ length: 7 }, (_, index) => ({
            label: `Empleado ${index + 1}`,
            cantidad: index + 1,
            monto: 1000 - index * 100,
        }));
        render(<DesglosePieChart items={items} montoLabel="Facturación" />);

        expect(screen.getByText("$1.000")).toBeTruthy();
        expect(screen.getByText("Cantidad:")).toBeTruthy();
        expect(screen.getByText("Otros")).toBeTruthy();
    });

    it("conserva el layout monetario de escritorio incluso en contenedores estrechos", () => {
        const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
        const containerBounds = mockContainerWidth(671);

        try {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
            const { container } = render(
                <DesglosePieChart items={[{ label: "Mano de obra", cantidad: 1, monto: 2500 }]} />
            );

            const row = container.querySelector<HTMLElement>("[data-testid='desglose-chart-row']");
            const list = container.querySelector<HTMLElement>("[data-testid='desglose-list-container']");
            expect(row?.style.flexDirection).toBe("row");
            expect(list?.style.gridTemplateRows).toBe("1fr");
            expect(list?.style.opacity).toBe("1");
            expect(screen.queryByRole("button", { name: "Ver desglose" })).toBeNull();
        } finally {
            containerBounds.mockRestore();
            if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
        }
    });

    it("permite apilar el gráfico de horas según su ancho sin ocultar la lista en escritorio", () => {
        const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
        const containerBounds = mockContainerWidth(671);

        try {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
            const { container } = render(
                <DesglosePieChart
                    items={[{ label: "Mano de obra", cantidad: 0, monto: 2.5 }]}
                    containerResponsiveLayout
                    centerTotal={2.5}
                    allowTooltipEscape
                />
            );

            const row = container.querySelector<HTMLElement>("[data-testid='desglose-chart-row']");
            const list = container.querySelector<HTMLElement>("[data-testid='desglose-list-container']");
            expect(row?.style.flexDirection).toBe("column");
            expect(list?.style.gridTemplateRows).toBe("1fr");
            expect(list?.style.opacity).toBe("1");
        } finally {
            containerBounds.mockRestore();
            if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
        }
    });

    it("colapsa el listado monetario en un viewport móvil y permite desplegarlo", () => {
        const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");

        try {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
            const { container } = render(
                <DesglosePieChart items={[{ label: "Mano de obra", cantidad: 1, monto: 2500 }]} />
            );

            const list = container.querySelector<HTMLElement>("[data-testid='desglose-list-container']");
            expect(list?.style.gridTemplateRows).toBe("0fr");
            fireEvent.click(screen.getByRole("button", { name: "Ver desglose" }));
            expect(list?.style.gridTemplateRows).toBe("1fr");
        } finally {
            if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
        }
    });

    it("reduce el espacio entre segmentos para conservar arcos positivos con muchas categorías", () => {
        const items = Array.from({ length: 180 }, (_, index) => ({
            label: `Empleado ${index + 1}`,
            cantidad: 0,
            monto: 1,
            identityKey: `empleado-${index + 1}`,
        }));
        render(<DesglosePieChart items={items} groupRest={false} adaptivePaddingAngle />);

        const pie = screen.getByTestId("pie-series");
        const paddingAngle = Number(pie.getAttribute("data-padding-angle"));
        const pieItems = JSON.parse(pie.getAttribute("data-items") ?? "[]") as unknown[];
        expect(pieItems).toHaveLength(180);
        expect(paddingAngle).toBeCloseTo(1);
        expect(180 * paddingAngle).toBeLessThan(360);
    });

    it("deja escapar el tooltip del gráfico y lo apila sobre el total central cuando se solicita", () => {
        render(
            <DesglosePieChart
                items={[{ label: "Ana", cantidad: 0, monto: 2.5, identityKey: "ana" }]}
                centerTotal={2.5}
                allowTooltipEscape
            />
        );

        const tooltip = screen.getByTestId("chart-tooltip-wrapper");
        expect(tooltip.getAttribute("data-escape-x")).toBe("true");
        expect(tooltip.getAttribute("data-escape-y")).toBe("true");
        expect(tooltip.getAttribute("data-z-index")).toBe("10000");
    });
});
