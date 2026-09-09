import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArregloBadges from "./ArregloBadges";
import type { ArregloBadgesData } from "./ArregloBadges";

const mockUpdate = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    update: mockUpdate,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

vi.mock("@/app/components/arreglos/CobroArregloModal", () => ({
  default: () => null,
}));

describe("ArregloBadges", () => {
  const basePresupuesto: ArregloBadgesData = {
    id: "arr-presupuesto-1",
    estado: "PRESUPUESTO",
    esta_pago: false,
    precio_final: 85000,
    total_cobrado: 0,
    es_facturable: true,
  };

  const baseTrabajo: ArregloBadgesData = {
    id: "arr-trabajo-1",
    estado: "EN_PROGRESO",
    esta_pago: false,
    precio_final: 120000,
    total_cobrado: 0,
    saldo_pendiente: 120000,
    es_facturable: true,
  };

  it("variante footer: no renderiza el botón de facturación ni badge de pago si es un PRESUPUESTO", () => {
    render(<ArregloBadges arreglo={basePresupuesto} variant="footer" size="sm" />);

    // Muestra el estado del presupuesto
    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();

    // NO debe aparecer el badge de factura
    expect(screen.queryByTestId("arreglo-factura-badge")).not.toBeInTheDocument();

    // NO debe aparecer el badge de pago
    expect(screen.queryByTestId("arreglo-pago-badge")).not.toBeInTheDocument();
  });

  it("variante inline: no renderiza el botón de facturación ni badge de pago si es un PRESUPUESTO", () => {
    render(<ArregloBadges arreglo={basePresupuesto} variant="inline" size="md" />);

    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("arreglo-factura-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arreglo-pago-badge")).not.toBeInTheDocument();
  });

  it("variante footer: renderiza todos los badges normalmente cuando NO es presupuesto", () => {
    render(<ArregloBadges arreglo={baseTrabajo} variant="footer" size="sm" />);

    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-pago-badge")).toBeInTheDocument();
  });

  it("variante inline: renderiza badges de pago y facturación cuando NO es presupuesto", () => {
    render(
      <ArregloBadges
        arreglo={baseTrabajo}
        variant="inline"
        size="md"
        totalCalculado={120000}
      />
    );

    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-pago-badge")).toBeInTheDocument();
  });

  it("renderiza factura emitida en trabajos regulares cuando está disponible", () => {
    render(
      <ArregloBadges
        arreglo={{
          ...baseTrabajo,
          factura_electronica: {
            id: "fact-1",
            estado: "AUTORIZADA",
            clase_comprobante: "FC B",
            punto_venta: 1,
            numero_comprobante: 1234,
          },
        }}
        variant="inline"
        size="md"
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toHaveTextContent("FC B-0001-00001234");
  });
});
