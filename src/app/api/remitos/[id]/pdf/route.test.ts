import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { buildRemitoPdf } from "@/lib/remitos/remitosService";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ buildRemitoPdf: vi.fn() }));

const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const segment = () => ({ params: Promise.resolve({ id: REMITO_ID }) });
const req = () => new NextRequest(`http://localhost/api/remitos/${REMITO_ID}/pdf`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("GET /api/remitos/[id]/pdf", () => {
  it("requiere facturas:view", async () => {
    mockApiSession({ permissions: [] });
    expect((await GET(req(), segment())).status).toBe(403);
    expect(buildRemitoPdf).not.toHaveBeenCalled();
  });

  it("descarga el PDF sin cache", async () => {
    mockApiSession();
    const bytes = new TextEncoder().encode("%PDF-1.7");
    vi.mocked(buildRemitoPdf).mockResolvedValueOnce({ bytes, filename: "remito-r-00001-00000008.pdf" });

    const response = await GET(req(), segment());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="remito-r-00001-00000008.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});
