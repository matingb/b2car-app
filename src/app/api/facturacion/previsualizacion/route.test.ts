import { beforeEach, describe, expect, it, vi } from "vitest";

const { preview, draftPdf, actor } = vi.hoisted(() => ({ preview: vi.fn(), draftPdf: vi.fn(), actor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/facturacion/facturacionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facturacion/facturacionService")>();
  return { ...actual, previewSourceFactura: preview, buildFacturaDraftPdf: draftPdf };
});
vi.mock("@/lib/facturacion/serverAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facturacion/serverAuth")>();
  return { ...actual, requireTenantBillingActor: actor };
});
vi.mock("@/lib/facturacion/environment", () => ({ getFacturacionAmbiente: () => "HOMOLOGACION" }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "./route";
import { POST as POST_PDF } from "./pdf/route";
import { FacturaRevisionDesactualizadaError } from "@/lib/facturacion/facturacionService";
import { FacturacionHttpError } from "@/lib/facturacion/serverAuth";

const body = {
  origenTipo: "ARREGLO", origenId: "arreglo-1", condicionVenta: "CONTADO",
  receptor: { modo: "OTRO", nombre: "Otra Empresa SA", domicilio: null, tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 },
  fechas: { fechaComprobante: "2026-10-28" },
};
const request = (value: unknown) => new Request("http://localhost/api/facturacion/previsualizacion", { method: "POST", body: JSON.stringify(value) });

beforeEach(() => {
  vi.clearAllMocks();
  actor.mockResolvedValue({ tenantId: "tenant", userId: "user" });
});

describe("POST /api/facturacion/previsualizacion", () => {
  it("devuelve la revisión sin caché y con el draft completo", async () => {
    preview.mockResolvedValue({ revision: { revisionHash: "a".repeat(64) }, issues: [] });

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ data: { revisionHash: "a".repeat(64) }, error: null, issues: [] });
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant" }), "ARREGLO", "arreglo-1",
      expect.objectContaining({ receptor: expect.objectContaining({ modo: "OTRO", nombre: "Otra Empresa SA", domicilio: null }) }),
    );
  });

  it("devuelve los errores agrupados con 422", async () => {
    const issues = [
      { codigo: "RECEPTOR_NOMBRE_REQUERIDO", grupo: "RECEPTOR", campo: "receptor.nombre", mensaje: "Ingresá el nombre", severidad: "error" },
      { codigo: "FECHAS_INVALIDAS", grupo: "COMPROBANTE", campo: "fechas.fechaComprobante", mensaje: "Fecha inválida", severidad: "error" },
    ];
    preview.mockResolvedValue({ revision: null, issues });

    const response = await POST(request(body));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ data: null, error: "Ingresá el nombre", issues });
  });

  it("rechaza un pedido sin receptor elegido sin preparar la factura", async () => {
    const response = await POST(request({ ...body, receptor: { tipoDocumento: 99 } }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: "Elegí a quién se emite la factura" });
    expect(preview).not.toHaveBeenCalled();
  });

  it("no revisa sin un actor con permiso de facturación en el tenant", async () => {
    actor.mockRejectedValue(new FacturacionHttpError("No se encontró una membresía de tenant activa", 403));

    const response = await POST(request(body));

    expect(response.status).toBe(403);
    expect(preview).not.toHaveBeenCalled();
  });
});

describe("POST /api/facturacion/previsualizacion/pdf", () => {
  it("entrega el borrador inline, sin caché ni archivo persistido", async () => {
    draftPdf.mockResolvedValue({ bytes: new TextEncoder().encode("%PDF-borrador"), filename: "borrador-factura-a.pdf" });

    const response = await POST_PDF(request({ ...body, revisionHash: "b".repeat(64) }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="borrador-factura-a.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("%PDF-borrador");
    expect(draftPdf).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ revisionHash: "b".repeat(64) }));
  });

  it("responde conflicto tipado si cambió el contenido revisado", async () => {
    draftPdf.mockRejectedValue(new FacturaRevisionDesactualizadaError());

    const response = await POST_PDF(request({ ...body, revisionHash: "b".repeat(64) }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "REVISION_DESACTUALIZADA" });
  });
});
