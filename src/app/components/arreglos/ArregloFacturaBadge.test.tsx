import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import { describe, expect, it, vi } from "vitest";
import ArregloFacturaBadge from "./ArregloFacturaBadge";

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

describe("ArregloFacturaBadge", () => {
  it("renderiza 'Factura emitida' con clase y número cuando la factura está AUTORIZADA", () => {
    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        factura={{
          id: "fact-1",
          estado: "AUTORIZADA",
          clase_comprobante: "A",
          punto_venta: 1,
          numero_comprobante: 2,
        }}
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toHaveTextContent("Factura emitida (A-0001-00000002)");
  });

  it("renderiza 'Factura emitida' sin número si numero_comprobante no existe", () => {
    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        factura={{
          id: "fact-2",
          estado: "AUTORIZADA",
          clase_comprobante: "A",
          punto_venta: 1,
        }}
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toHaveTextContent("Factura emitida");
    expect(screen.getByTestId("arreglo-factura-badge")).not.toHaveTextContent("00000001");
    expect(screen.getByTestId("arreglo-factura-badge")).not.toHaveTextContent("(");
  });

  it("renderiza 'Factura emitida' sin número si punto_venta o numero_comprobante son menores o iguales a cero", () => {
    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        factura={{
          id: "fact-4",
          estado: "AUTORIZADA",
          clase_comprobante: "B",
          punto_venta: 0,
          numero_comprobante: -5,
        }}
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toHaveTextContent("Factura emitida");
    expect(screen.getByTestId("arreglo-factura-badge")).not.toHaveTextContent("(");
  });

  it("renderiza el badge cuando no hay factura emitida", () => {
    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        esFacturable={true}
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();
  });

  it("permite marcar como no facturable al abrir el dropdown y hace update", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "arr-1", es_facturable: false });
    const onFacturableChanged = vi.fn();

    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        esFacturable={true}
        onFacturableChanged={onFacturableChanged}
      />
    );

    const badgeBtn = screen.getByTestId("arreglo-factura-badge");
    fireEvent.click(badgeBtn);

    const noFacturableOption = screen.getByTestId("factura-menu-marcar-no-facturable");
    expect(noFacturableOption).toBeInTheDocument();

    fireEvent.click(noFacturableOption);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("arr-1", { es_facturable: false });
      expect(onFacturableChanged).toHaveBeenCalledWith(false);
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it("renderiza cuando esFacturable es false y permite reactivarlo", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "arr-1", es_facturable: true });
    const onFacturableChanged = vi.fn();

    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        esFacturable={false}
        onFacturableChanged={onFacturableChanged}
      />
    );

    expect(screen.getByTestId("arreglo-factura-badge")).toBeInTheDocument();

    const badgeBtn = screen.getByTestId("arreglo-factura-badge");
    fireEvent.click(badgeBtn);

    const marcarFacturableOption = screen.getByTestId("factura-menu-marcar-facturable");
    expect(marcarFacturableOption).toBeInTheDocument();

    fireEvent.click(marcarFacturableOption);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("arr-1", { es_facturable: true });
      expect(onFacturableChanged).toHaveBeenCalledWith(true);
    });
  });

  it("llama a onOpenChange cuando se abre y se cierra el dropdown", () => {
    const onOpenChange = vi.fn();

    render(
      <ArregloFacturaBadge
        arregloId="arr-1"
        esFacturable={true}
        onOpenChange={onOpenChange}
      />
    );

    const badgeBtn = screen.getByTestId("arreglo-factura-badge");
    fireEvent.click(badgeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.mouseDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
