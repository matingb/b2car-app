import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetProvider } from "@/app/providers/SheetProvider";
import { Permission, type PermissionValue } from "@/lib/permissions";
import { TenantTestProvider } from "@/tests/testUtils";
import DocumentacionPage from "./page";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const fetchMock = vi.fn();

const factura = {
  id: "f1", estado: "AUTORIZADA", ambiente: "HOMOLOGACION", origenTipo: "ARREGLO", origenId: "a1", documentoTipo: "FACTURA",
  claseComprobante: "C", tipoComprobante: 11, puntoVenta: 1, numeroComprobante: 123, cae: "1", caeVencimiento: null,
  total: 245000, concepto: 1, fechaComprobante: "2026-10-05", receptorNombre: "Pablo Méndez", receptorDocumento: "30111222",
};
const remito = {
  id: "r1", clase: "R", puntoEmision: 1, numero: 8, numeroVisible: "R 00001-00000008", fechaEmision: "2026-10-06",
  ambiente: "HOMOLOGACION", destinatarioNombre: "Juan Pérez", destinatarioDocumento: null, factura: null,
};

function responder(items: unknown[]) {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({
    data: { items, page: 1, pageSize: 25, total: items.length },
    error: null,
  })));
}

function lastQuery(): URLSearchParams {
  const url = String(fetchMock.mock.calls.at(-1)?.[0] ?? "");
  expect(url.startsWith("/api/documentos?")).toBe(true);
  return new URLSearchParams(url.split("?")[1]);
}

function renderPage(permissions: PermissionValue[] = [Permission.FacturasView, Permission.FacturasEdit]) {
  return render(
    <TenantTestProvider hasPermission={(permission) => permissions.includes(permission)}>
      <SheetProvider>
        <DocumentacionPage />
      </SheetProvider>
    </TenantTestProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.search = "";
});

describe("DocumentacionPage", () => {
  it("lista facturas y remitos juntos en Documentación", async () => {
    responder([{ tipo: "REMITO", id: "r1", fecha: "2026-10-06", remito }, { tipo: "FISCAL", id: "f1", fecha: "2026-10-05", factura }]);
    renderPage();

    expect(screen.getByRole("heading", { name: "Documentación" })).toBeInTheDocument();
    expect(await screen.findByText("R 00001-00000008")).toBeInTheDocument();
    expect(screen.getByText("Factura C")).toBeInTheDocument();
    expect(screen.getByText("2 documentos")).toBeInTheDocument();
    expect(lastQuery().get("tipo")).toBeNull();
    expect(screen.getByRole("link", { name: /CSV/ })).toBeInTheDocument();
    expect(screen.getByTestId("documentos-nuevo-remito")).toBeInTheDocument();
  });

  it("al elegir Remitos filtra el listado, muestra sus filtros y oculta la exportación fiscal", async () => {
    responder([]);
    renderPage();
    await screen.findByText("No hay documentos para estos filtros");

    fireEvent.click(screen.getByRole("button", { name: "Remitos" }));

    await waitFor(() => expect(lastQuery().get("tipo")).toBe("REMITO"));
    expect(navigation.replace).toHaveBeenCalledWith("/facturacion?tipo=REMITO", { scroll: false });
    expect(screen.getByTestId("documentos-filtros-remitos")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /CSV/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remito R" }));
    await waitFor(() => expect(lastQuery().get("clase")).toBe("R"));
    fireEvent.click(screen.getByRole("button", { name: "Sin factura" }));
    await waitFor(() => expect(lastQuery().get("factura")).toBe("sin"));
  });

  it("toma el tipo inicial de la URL", async () => {
    navigation.search = "tipo=REMITO";
    responder([{ tipo: "REMITO", id: "r1", fecha: "2026-10-06", remito }]);
    renderPage();

    expect(await screen.findByText("R 00001-00000008")).toBeInTheDocument();
    expect(lastQuery().get("tipo")).toBe("REMITO");
  });

  it("oculta Nuevo remito sin facturas:edit", async () => {
    responder([]);
    renderPage([Permission.FacturasView]);
    await screen.findByText("No hay documentos para estos filtros");
    expect(screen.queryByTestId("documentos-nuevo-remito")).not.toBeInTheDocument();
  });

  it("muestra el error del listado", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "El listado muestra hasta 1000 documentos." }), { status: 400 }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("El listado muestra hasta 1000 documentos.");
  });
});
