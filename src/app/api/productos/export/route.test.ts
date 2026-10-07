import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("./productosExportService", () => ({
  productosExportService: {
    exportInventarioExcel: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { productosExportService } from "./productosExportService";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("GET /api/productos/export (controlador)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({} as SupabaseClient);
  });

  it("retorna error si requirePermission falla", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(
      Response.json({ error: "FORBIDDEN" }, { status: 403 })
    );

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("retorna 500 si el servicio de exportación falla", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(null);
    vi.mocked(productosExportService.exportInventarioExcel).mockResolvedValueOnce({
      data: null,
      error: "Error al obtener datos de stock",
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Error al obtener datos de stock");
  });

  it("retorna 200 con archivo .xlsx cuando el servicio genera el contenido exitosamente", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(null);

    const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    vi.mocked(productosExportService.exportInventarioExcel).mockResolvedValueOnce({
      data: {
        buffer: dummyBuffer,
        filename: "inventario_2026-10-06",
      },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="inventario_2026-10-06.xlsx"'
    );

    const bodyBuffer = await res.arrayBuffer();
    expect(bodyBuffer.byteLength).toBe(4);
  });
});
