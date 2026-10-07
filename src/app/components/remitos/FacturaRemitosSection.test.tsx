import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Permission, type PermissionValue } from "@/lib/permissions";
import { TenantTestProvider } from "@/tests/testUtils";
import FacturaRemitosSection from "./FacturaRemitosSection";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const FACTURA_ID = "44444444-4444-4444-8444-444444444444";
const fetchMock = vi.fn();

function respuesta(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), { status: 200 });
}

const remito = {
  id: "remito-1", clase: "X", puntoEmision: 1, numero: 3, numeroVisible: "X 00001-00000003", fechaEmision: "2026-10-06",
  ambiente: "HOMOLOGACION", destinatarioNombre: "Juan", destinatarioDocumento: null, factura: { id: FACTURA_ID, label: "Factura C 00001-00000123" },
};
const linea = (cantidadDisponible: number) => ({
  id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro",
  cantidadFacturada: 2, cantidadRemitida: 2 - cantidadDisponible, cantidadDisponible,
});

function renderSection(permissions: PermissionValue[]) {
  return render(
    <TenantTestProvider hasPermission={(permission) => permissions.includes(permission)}>
      <FacturaRemitosSection facturaId={FACTURA_ID} />
    </TenantTestProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

describe("FacturaRemitosSection", () => {
  it("lista los remitos de la factura y permite generar otro si queda disponible", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta({ remitos: [remito], lineas: [linea(1)] }));
    renderSection([Permission.FacturasView, Permission.FacturasEdit]);

    expect(await screen.findByText("X 00001-00000003")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/facturas/${FACTURA_ID}/remitos`, expect.any(Object));
    const boton = screen.getByTestId("factura-generar-remito");
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    expect(push).toHaveBeenCalledWith(`/remitos/nuevo?facturaId=${FACTURA_ID}`);
  });

  it("muestra el estado vacío y deshabilita la generación cuando no queda nada por remitir", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta({ remitos: [], lineas: [linea(0)] }));
    renderSection([Permission.FacturasView, Permission.FacturasEdit]);

    expect(await screen.findByText("Esta factura no tiene remitos.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("factura-generar-remito")).toBeDisabled());
    expect(screen.getByTestId("factura-generar-remito")).toHaveAttribute("title", "Todas las cantidades facturadas ya fueron remitidas");
  });

  it("oculta la generación sin facturas:edit", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(respuesta({ remitos: [remito], lineas: [linea(1)] }));
    renderSection([Permission.FacturasView]);

    expect(await screen.findByText("X 00001-00000003")).toBeInTheDocument();
    expect(screen.queryByTestId("factura-generar-remito")).not.toBeInTheDocument();
  });
});
