import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("./fiscalPdf", () => ({ generateFiscalInvoicePdf: vi.fn() }));

import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import { generateFiscalInvoicePdf } from "./fiscalPdf";
import { buildFacturaPdf } from "./facturacionService";

describe("B2C-198: observación al generar el PDF", () => {
  const cachedBytes = new TextEncoder().encode("PDF anterior inmutable");
  const generatedBytes = new TextEncoder().encode("PDF nuevo");
  let invoice: Record<string, unknown>;
  let observation: string | null;
  let repairError: { message: string } | null;
  let repairMissing: boolean;
  let download: ReturnType<typeof vi.fn>;
  let upload: ReturnType<typeof vi.fn>;
  let repairQueries: Array<{ select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> }>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    invoice = {
      id: "invoice-1", estado: "AUTORIZADA", ambiente: "HOMOLOGACION",
      origen_tipo: "ARREGLO", arreglo_id: "repair-1", documento_tipo: "FACTURA",
      tipo_comprobante: 11, clase_comprobante: "C", punto_venta: 1,
      numero_comprobante: 1, total: 100, concepto: 2,
      fecha_comprobante: "2026-10-19", cae: "12345678901234", cae_vencimiento: "2026-10-29",
      emisor_snapshot: { ingresosBrutos: "EXENTO" }, receptor_snapshot: { tipoDocumento: 99 },
      pdf_storage_path: null, pdf_template_version: null, pdf_sha256: null,
    };
    observation = "Revisar frenos en el próximo service";
    repairError = null;
    repairMissing = false;
    repairQueries = [];
    download = vi.fn().mockResolvedValue({ data: { arrayBuffer: async () => cachedBytes.buffer }, error: null });
    upload = vi.fn().mockResolvedValue({ error: null });
    from = vi.fn((table: string) => {
      const chain = {
        select: vi.fn(), eq: vi.fn(), order: vi.fn(),
        maybeSingle: vi.fn(), single: vi.fn(), then: vi.fn(),
      };
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.order.mockReturnValue(chain);
      const result = () => table === "arreglos"
        ? { data: repairMissing ? null : { observaciones: observation }, error: repairError }
        : { data: { ...invoice }, error: null };
      chain.maybeSingle.mockImplementation(async () => result());
      chain.single.mockImplementation(async () => result());
      chain.then.mockImplementation((resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }));
      if (table === "arreglos") repairQueries.push(chain);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from, storage: { from: () => ({ download }) } } as never);
    const update = { eq: vi.fn() };
    update.eq.mockReturnValueOnce(update).mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      storage: { from: () => ({ upload }) },
      from: () => ({ update: vi.fn().mockReturnValue(update) }),
    } as never);
    vi.mocked(generateFiscalInvoicePdf).mockResolvedValue(generatedBytes);
  });

  it.each([1, 6, 11, 201, 206, 211])("incorpora observación tenant-scoped en tipo %s", async (tipo) => {
    invoice.tipo_comprobante = tipo;
    await expect(buildFacturaPdf("tenant-1", "invoice-1")).resolves.toMatchObject({ bytes: generatedBytes });
    expect(generateFiscalInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ observacionArreglo: observation, tipoComprobante: tipo, total: 100 }));
    expect(repairQueries).toHaveLength(1);
    expect(repairQueries[0].select).toHaveBeenCalledWith("observaciones");
    expect(repairQueries[0].eq).toHaveBeenCalledWith("id", "repair-1");
    expect(repairQueries[0].eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(upload).toHaveBeenCalledWith("tenant-1/homologacion/invoice-1/fiscal-v5.pdf", generatedBytes, expect.anything());
  });

  it.each([null, "", "  \n  "])("omite observación vacía (%s)", async (value) => {
    observation = value;
    await buildFacturaPdf("tenant-1", "invoice-1");
    expect(generateFiscalInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ observacionArreglo: null }));
  });

  it("no consulta arreglos para ventas", async () => {
    invoice.origen_tipo = "VENTA";
    invoice.operacion_id = "sale-1";
    await buildFacturaPdf("tenant-1", "invoice-1");
    expect(repairQueries).toHaveLength(0);
    expect(generateFiscalInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ observacionArreglo: null }));
  });

  it("conserva bytes previos aunque cambie la observación y no vuelve a generar", async () => {
    invoice.pdf_storage_path = "tenant-1/homologacion/invoice-1/fiscal-v4.pdf";
    invoice.pdf_template_version = "fiscal-v4";
    invoice.pdf_sha256 = createHash("sha256").update(cachedBytes).digest("hex");
    for (const value of ["Observación vieja", "Observación nueva"]) {
      observation = value;
      expect(Buffer.from((await buildFacturaPdf("tenant-1", "invoice-1")).bytes)).toEqual(Buffer.from(cachedBytes));
    }
    expect(repairQueries).toHaveLength(0);
    expect(generateFiscalInvoicePdf).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("genera con la observación vigente si no existe el archivo anterior", async () => {
    invoice.pdf_storage_path = "tenant-1/homologacion/invoice-1/fiscal-v4.pdf";
    invoice.pdf_template_version = "fiscal-v4";
    invoice.pdf_sha256 = createHash("sha256").update(cachedBytes).digest("hex");
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    await buildFacturaPdf("tenant-1", "invoice-1");
    expect(generateFiscalInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ observacionArreglo: observation }));
  });

  it("no descarga un objeto de otro tenant indicado en metadatos", async () => {
    invoice.pdf_storage_path = "tenant-2/homologacion/invoice-1/fiscal-v4.pdf";
    invoice.pdf_template_version = "fiscal-v4";
    invoice.pdf_sha256 = createHash("sha256").update(cachedBytes).digest("hex");
    await buildFacturaPdf("tenant-1", "invoice-1");
    expect(download).not.toHaveBeenCalled();
  });

  it.each(["error", "missing"])("no guarda un PDF parcial si no puede leer el arreglo (%s)", async (reason) => {
    repairError = reason === "error" ? { message: "query failed" } : null;
    repairMissing = reason === "missing";
    await expect(buildFacturaPdf("tenant-1", "invoice-1")).rejects.toThrow("No se pudo cargar la observación del arreglo");
    expect(upload).not.toHaveBeenCalled();
  });

  it("no permite generar para documentos sin autorización", async () => {
    invoice.estado = "BORRADOR";
    await expect(buildFacturaPdf("tenant-1", "invoice-1")).rejects.toThrow("sólo está disponible para documentos autorizados");
    expect(repairQueries).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
