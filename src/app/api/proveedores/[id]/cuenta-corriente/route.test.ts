import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { proveedorService } from "@/app/api/proveedores/proveedorService";
import { GET, POST } from "./route";
import { Permission } from "@/lib/permissions";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: vi.fn(),
  fetchPlanPermissions: vi.fn(),
}));
vi.mock("@/app/api/proveedores/proveedorService", () => ({
  proveedorService: {
    getCuentaCorriente: vi.fn(),
    createMovimiento: vi.fn(),
  },
}));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

const validId = "e4a2a11b-7159-4d64-88aa-38e56d787090";
const validCuentaId = "11111111-2222-3333-4444-555555555555";
const segment = (id: string = validId) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockApiSession({ permissions: [Permission.ProveedoresView, Permission.ProveedoresFinanzasEdit] });
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("GET /api/proveedores/[id]/cuenta-corriente", () => {
  it("obtiene la cuenta corriente correctamente", async () => {
    vi.mocked(proveedorService.getCuentaCorriente).mockResolvedValue({
      data: {
        saldoAdeudado: 1000,
        totalComprado: 5000,
        totalPagado: 4000,
        operaciones: [],
        movimientos: [],
      },
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`);
    const res = await GET(req, segment(validId));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.saldoAdeudado).toBe(1000);
  });
});

describe("POST /api/proveedores/[id]/cuenta-corriente", () => {
  it("valida que el id del proveedor sea un UUID válido", async () => {
    const req = new NextRequest("http://localhost/api/proveedores/invalid-id/cuenta-corriente", {
      method: "POST",
      body: JSON.stringify({ cuenta_id: validCuentaId, importe: -1000 }),
    });
    const res = await POST(req, segment("invalid-id"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ID de proveedor inválido");
    expect(proveedorService.createMovimiento).not.toHaveBeenCalled();
  });

  it("valida que cuenta_id sea provista y válida", async () => {
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`, {
      method: "POST",
      body: JSON.stringify({ cuenta_id: "invalida", importe: -1000 }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Seleccioná una cuenta financiera válida");
    expect(proveedorService.createMovimiento).not.toHaveBeenCalled();
  });

  it("valida que importe no sea cero", async () => {
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`, {
      method: "POST",
      body: JSON.stringify({ cuenta_id: validCuentaId, importe: 0 }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("El importe no puede ser cero");
    expect(proveedorService.createMovimiento).not.toHaveBeenCalled();
  });

  it("registra un pago a proveedor (importe negativo) exitosamente", async () => {
    vi.mocked(proveedorService.createMovimiento).mockResolvedValue({
      data: "op-pago-1",
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`, {
      method: "POST",
      body: JSON.stringify({
        cuenta_id: validCuentaId,
        importe: -25000,
        fecha: "2026-11-08T12:00:00Z",
        descripcion: "Pago a cuenta de repuestos",
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "op-pago-1", ok: true });
    expect(body.error).toBeNull();
    expect(statsService.onDataChanged).toHaveBeenCalled();
  });

  it("registra un cobro/reintegro de proveedor (importe positivo) exitosamente", async () => {
    vi.mocked(proveedorService.createMovimiento).mockResolvedValue({
      data: "op-cobro-1",
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`, {
      method: "POST",
      body: JSON.stringify({
        cuenta_id: validCuentaId,
        importe: 5000,
        fecha: "2026-11-08T12:00:00Z",
        descripcion: "Reintegro por devolución",
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "op-cobro-1", ok: true });
    expect(proveedorService.createMovimiento).toHaveBeenCalledWith(
      expect.anything(),
      validId,
      expect.objectContaining({
        importe: 5000,
      })
    );
  });

  it("permite múltiples pagos y delega correctamente", async () => {
    vi.mocked(proveedorService.createMovimiento).mockResolvedValue({
      data: "op-multi-1",
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/cuenta-corriente`, {
      method: "POST",
      body: JSON.stringify({
        pagos: [
          { cuenta_id: validCuentaId, importe: -10000 },
          { cuenta_id: "22222222-2222-2222-2222-222222222222", importe: -15000 },
        ],
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(201);
    expect(proveedorService.createMovimiento).toHaveBeenCalledWith(
      expect.anything(),
      validId,
      expect.objectContaining({
        pagos: [
          expect.objectContaining({ cuentaId: validCuentaId, importe: -10000 }),
          expect.objectContaining({ cuentaId: "22222222-2222-2222-2222-222222222222", importe: -15000 }),
        ],
      })
    );
  });
});
