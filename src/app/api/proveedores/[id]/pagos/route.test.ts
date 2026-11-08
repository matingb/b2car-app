import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { proveedorService } from "@/app/api/proveedores/proveedorService";
import { ServiceError } from "@/app/api/serviceError";
import { POST } from "./route";
import { Permission } from "@/lib/permissions";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: vi.fn(),
  fetchPlanPermissions: vi.fn(),
}));
vi.mock("@/app/api/proveedores/proveedorService", () => ({
  proveedorService: {
    createPagoDirecto: vi.fn(),
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
  mockApiSession({ permissions: [Permission.ProveedoresFinanzasEdit] });
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("POST /api/proveedores/[id]/pagos", () => {
  it("valida que el id del proveedor sea un UUID válido", async () => {
    const req = new NextRequest("http://localhost/api/proveedores/invalid-id/pagos", {
      method: "POST",
      body: JSON.stringify({ cuenta_id: validCuentaId, monto: 1000 }),
    });
    const res = await POST(req, segment("invalid-id"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ID de proveedor inválido");
    expect(proveedorService.createPagoDirecto).not.toHaveBeenCalled();
  });

  it("valida que cuenta_id sea provista y válida", async () => {
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({ cuenta_id: "invalida", monto: 1000 }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Seleccioná una cuenta financiera válida");
    expect(proveedorService.createPagoDirecto).not.toHaveBeenCalled();
  });

  it("valida que monto sea mayor a 0", async () => {
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({ cuenta_id: validCuentaId, monto: -50 }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("El monto debe ser mayor a 0");
    expect(proveedorService.createPagoDirecto).not.toHaveBeenCalled();
  });

  it("registra el pago exitosamente y notifica a statsService", async () => {
    vi.mocked(proveedorService.createPagoDirecto).mockResolvedValue({
      data: "op-pago-1",
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({
        cuenta_id: validCuentaId,
        monto: 25000,
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

  it("retorna 404 si el proveedor no existe", async () => {
    vi.mocked(proveedorService.createPagoDirecto).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({
        cuenta_id: validCuentaId,
        monto: 25000,
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(404);
  });

  it("registra múltiples pagos en diferentes cuentas exitosamente", async () => {
    vi.mocked(proveedorService.createPagoDirecto).mockResolvedValue({
      data: "op-pago-multiple",
      error: null,
    });

    const segundaCuenta = "22222222-3333-4444-5555-666666666666";
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({
        pagos: [
          { cuenta_id: validCuentaId, monto: 15000, descripcion: "Pago Banco" },
          { cuenta_id: segundaCuenta, monto: 10000, descripcion: "Pago Efectivo" },
        ],
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "op-pago-multiple", ok: true });
    expect(proveedorService.createPagoDirecto).toHaveBeenCalledWith(
      expect.anything(),
      validId,
      expect.objectContaining({
        pagos: [
          expect.objectContaining({ cuentaId: validCuentaId, monto: 15000 }),
          expect.objectContaining({ cuentaId: segundaCuenta, monto: 10000 }),
        ],
      })
    );
  });

  it("retorna 403 cuando el usuario no tiene permiso ProveedoresFinanzasEdit", async () => {
    mockApiSession({ permissions: [Permission.ProveedoresView] });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({
        cuenta_id: validCuentaId,
        monto: 1000,
      }),
    });
    const res = await POST(req, segment(validId));
    expect(res.status).toBe(403);
    expect(proveedorService.createPagoDirecto).not.toHaveBeenCalled();
  });

  it("permite registrar un COBRO (reintegro) con permiso ProveedoresFinanzasEdit", async () => {
    mockApiSession({ permissions: [Permission.ProveedoresFinanzasEdit] });
    vi.mocked(proveedorService.createPagoDirecto).mockResolvedValue({
      data: "op-cobro-prov-1",
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}/pagos`, {
      method: "POST",
      body: JSON.stringify({
        sentido: "COBRO",
        cuenta_id: validCuentaId,
        monto: 18000,
        descripcion: "Devolución por mercadería fallada",
      }),
    });
    const res = await POST(req, segment(validId));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "op-cobro-prov-1", ok: true });
    expect(proveedorService.createPagoDirecto).toHaveBeenCalledWith(
      expect.anything(),
      validId,
      expect.objectContaining({
        sentido: "COBRO",
        cuentaId: validCuentaId,
        monto: 18000,
      })
    );
  });
});
