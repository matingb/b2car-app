import { describe, it, expect, vi } from "vitest";
import { createProveedorService } from "./proveedorService";
import type { ProveedorRepository, ProveedorRow } from "./proveedorRepository";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";

const mockSupabase = {} as unknown as SupabaseClient;

function makeMockRepository(overrides: Partial<ProveedorRepository> = {}): ProveedorRepository {
  return {
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    getById: vi.fn().mockResolvedValue({ data: null, error: null }),
    create: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: null, error: null }),
    deleteById: vi.fn().mockResolvedValue({ error: null }),
    getCuentaCorriente: vi.fn().mockResolvedValue({ data: null, error: null }),
    getExtractoCuentaCorriente: vi.fn().mockResolvedValue({ data: [], error: null }),
    getSaldos: vi.fn().mockResolvedValue({ data: new Map(), error: null }),
    createMovimiento: vi.fn().mockResolvedValue({ data: "op-1", error: null }),
    ...overrides,
  };
}

describe("proveedorService", () => {
  it("enriquece los proveedores listados con su saldo_pendiente", async () => {
    const mockList: ProveedorRow[] = [
      {
        id: "p-1",
        tenant_id: "t-1",
        nombre: "Distribuidora A",
        cuit: null,
        telefono: null,
        email: null,
        direccion: null,
        created_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
      },
      {
        id: "p-2",
        tenant_id: "t-1",
        nombre: "Distribuidora B",
        cuit: null,
        telefono: null,
        email: null,
        direccion: null,
        created_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
      },
    ];

    const saldosMap = new Map([
      ["p-1", { saldoPendiente: 75000, totalComprado: 100000, totalPagado: 25000 }],
      ["p-2", { saldoPendiente: 0, totalComprado: 50000, totalPagado: 50000 }],
    ]);

    const mockRepo = makeMockRepository({
      list: vi.fn().mockResolvedValue({ data: mockList, error: null }),
      getSaldos: vi.fn().mockResolvedValue({ data: saldosMap, error: null }),
    });

    const service = createProveedorService(mockRepo);
    const res = await service.list(mockSupabase);

    expect(mockRepo.list).toHaveBeenCalledWith(mockSupabase, undefined);
    expect(mockRepo.getSaldos).toHaveBeenCalledWith(mockSupabase, ["p-1", "p-2"]);
    expect(res.data[0].saldo_pendiente).toBe(75000);
    expect(res.data[1].saldo_pendiente).toBe(0);
  });

  it("crea un proveedor limpiando strings vacíos a null y recortando espacios en nombre", async () => {
    const mockCreated: ProveedorRow = {
      id: "p-1",
      tenant_id: "t-1",
      nombre: "Lubricentro Sur",
      cuit: "30-11111111-2",
      telefono: null,
      email: null,
      direccion: null,
      created_at: "2026-10-21T00:00:00Z",
      updated_at: "2026-10-21T00:00:00Z",
    };
    const mockRepo = makeMockRepository({
      create: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
    });

    const service = createProveedorService(mockRepo);
    const res = await service.create(mockSupabase, {
      nombre: "   Lubricentro Sur   ",
      cuit: "  30-11111111-2  ",
      telefono: "   ",
      email: "",
      direccion: undefined,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(mockSupabase, {
      nombre: "Lubricentro Sur",
      cuit: "30-11111111-2",
      telefono: null,
      email: null,
      direccion: null,
    });
    expect(res.data).toEqual(mockCreated);
  });

  it("actualiza un proveedor recortando y limpiando sólo los campos provistos", async () => {
    const mockUpdated: ProveedorRow = {
      id: "p-1",
      tenant_id: "t-1",
      nombre: "Nuevo Nombre",
      cuit: null,
      telefono: "11223344",
      email: null,
      direccion: null,
      created_at: "2026-10-21T00:00:00Z",
      updated_at: "2026-10-21T00:00:00Z",
    };
    const mockRepo = makeMockRepository({
      updateById: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
    });

    const service = createProveedorService(mockRepo);
    await service.updateById(mockSupabase, "p-1", {
      nombre: " Nuevo Nombre ",
      telefono: " 11223344 ",
      email: "   ",
    });

    expect(mockRepo.updateById).toHaveBeenCalledWith(mockSupabase, "p-1", {
      nombre: "Nuevo Nombre",
      telefono: "11223344",
      email: null,
    });
  });

  it("delega deleteById directamente al repositorio", async () => {
    const mockRepo = makeMockRepository();
    const service = createProveedorService(mockRepo);

    await service.deleteById(mockSupabase, "p-1");

    expect(mockRepo.deleteById).toHaveBeenCalledWith(mockSupabase, "p-1");
  });

  it("delega getCuentaCorriente directamente al repositorio", async () => {
    const mockRepo = makeMockRepository({
      getCuentaCorriente: vi.fn().mockResolvedValue({
        data: { totalComprado: 100, totalPagado: 50, saldoAdeudado: 50, operaciones: [] },
        error: null,
      }),
    });
    const service = createProveedorService(mockRepo);

    const res = await service.getCuentaCorriente(mockSupabase, "p-1");

    expect(mockRepo.getCuentaCorriente).toHaveBeenCalledWith(mockSupabase, "p-1");
    expect(res.data?.saldoAdeudado).toBe(50);
  });

  describe("createMovimiento", () => {
    const validProvId = "11111111-1111-4111-8111-111111111111";
    const validCuentaId = "22222222-2222-4222-8222-222222222222";

    it("retorna error de validación si el proveedorId o cuentaId no son UUID válidos", async () => {
      const mockRepo = makeMockRepository();
      const service = createProveedorService(mockRepo);

      const res1 = await service.createMovimiento(mockSupabase, "invalido", {
        cuentaId: validCuentaId,
        importe: -1000,
      });
      expect(res1.error).toBe(ServiceError.Validation);

      const res2 = await service.createMovimiento(mockSupabase, validProvId, {
        cuentaId: "invalido",
        importe: -1000,
      });
      expect(res2.error).toBe(ServiceError.Validation);
    });

    it("retorna error de validación si el importe es cero", async () => {
      const mockRepo = makeMockRepository();
      const service = createProveedorService(mockRepo);

      const res = await service.createMovimiento(mockSupabase, validProvId, {
        cuentaId: validCuentaId,
        importe: 0,
      });
      expect(res.error).toBe(ServiceError.Validation);
    });

    it("delega la creación al repositorio con los datos limpios", async () => {
      const mockRepo = makeMockRepository({
        createMovimiento: vi.fn().mockResolvedValue({ data: "op-123", error: null }),
      });
      const service = createProveedorService(mockRepo);

      const res = await service.createMovimiento(mockSupabase, validProvId, {
        cuentaId: validCuentaId,
        importe: -15000,
        fecha: "2026-11-08T12:00:00Z",
        descripcion: "  Pago directo  ",
        observaciones: "  Comprobante 999  ",
        idempotencyKey: "idem-key",
      });

      expect(res.data).toBe("op-123");
      expect(res.error).toBeNull();
      expect(mockRepo.createMovimiento).toHaveBeenCalledWith(mockSupabase, {
        proveedor_id: validProvId,
        cuenta_id: validCuentaId,
        importe: -15000,
        fecha: "2026-11-08T12:00:00Z",
        descripcion: "Pago directo",
        observaciones: "Comprobante 999",
        idempotency_key: "idem-key",
        taller_id: null,
      });
    });

    it("valida y delega la creación cuando se proveen múltiples pagos", async () => {
      const mockRepo = makeMockRepository({
        createMovimiento: vi.fn().mockResolvedValue({ data: "op-mult-123", error: null }),
      });
      const service = createProveedorService(mockRepo);
      const cuenta2 = "33333333-3333-4333-8333-333333333333";

      const res = await service.createMovimiento(mockSupabase, validProvId, {
        pagos: [
          { cuentaId: validCuentaId, importe: -10000, descripcion: " Banco " },
          { cuentaId: cuenta2, importe: -5000, descripcion: " Caja " },
        ],
      });

      expect(res.data).toBe("op-mult-123");
      expect(res.error).toBeNull();
      expect(mockRepo.createMovimiento).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          proveedor_id: validProvId,
          cuenta_id: validCuentaId,
          importe: -15000,
          pagos: [
            expect.objectContaining({ cuenta_id: validCuentaId, importe: -10000, descripcion: "Banco" }),
            expect.objectContaining({ cuenta_id: cuenta2, importe: -5000, descripcion: "Caja" }),
          ],
        })
      );
    });

    it("registra un reintegro de proveedor con importe positivo", async () => {
      const mockRepo = makeMockRepository({
        createMovimiento: vi.fn().mockResolvedValue({ data: "op-cobro-1", error: null }),
      });
      const service = createProveedorService(mockRepo);

      const res = await service.createMovimiento(mockSupabase, validProvId, {
        cuentaId: validCuentaId,
        importe: 12000,
        descripcion: " Reintegro NC ",
      });

      expect(res.data).toBe("op-cobro-1");
      expect(res.error).toBeNull();
      expect(mockRepo.createMovimiento).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          proveedor_id: validProvId,
          cuenta_id: validCuentaId,
          importe: 12000,
          descripcion: "Reintegro NC",
        })
      );
    });
  });

  describe("getCuentaCorriente", () => {
    const validProvId = "11111111-1111-4111-8111-111111111111";

    it("incluye movimientos con saldo acumulado cronológico (más recientes primero) junto al resumen", async () => {
      const mockRepo = makeMockRepository({
        getCuentaCorriente: vi.fn().mockResolvedValue({
          data: { totalComprado: 80000, totalPagado: 40000, saldoAdeudado: 40000, operaciones: [] },
          error: null,
        }),
        getExtractoCuentaCorriente: vi.fn().mockResolvedValue({
          data: [
            {
              id: "mov-1",
              fecha: "2026-11-01T10:00:00Z",
              created_at: "2026-11-01T10:00:00Z",
              tipo_movimiento: "CARGO_COMPRA",
              concepto: "Compra filtros",
              comprobante: null,
              debito: 80000,
              credito: 0,
              operacion_id: "op-1",
              cuenta_nombre: "Taller Central",
            },
            {
              id: "mov-2",
              fecha: "2026-11-03T12:00:00Z",
              created_at: "2026-11-03T12:00:00Z",
              tipo_movimiento: "PAGO_DIRECTO",
              concepto: "Pago a cuenta",
              comprobante: null,
              debito: 0,
              credito: 50000,
              operacion_id: null,
              cuenta_nombre: "Banco Galicia",
            },
            {
              id: "mov-3",
              fecha: "2026-11-05T15:00:00Z",
              created_at: "2026-11-05T15:00:00Z",
              tipo_movimiento: "COBRO_DIRECTO",
              concepto: "Reintegro de proveedor",
              comprobante: null,
              debito: 10000,
              credito: 0,
              operacion_id: null,
              cuenta_nombre: "Banco Galicia",
            },
          ],
          error: null,
        }),
      });

      const service = createProveedorService(mockRepo);
      const res = await service.getCuentaCorriente(mockSupabase, validProvId);

      expect(res.error).toBeNull();
      expect(res.data?.saldoAdeudado).toBe(40000);
      expect(res.data?.movimientos).toHaveLength(3);
      expect(res.data?.movimientos?.[0].id).toBe("mov-3");
      expect(res.data?.movimientos?.[0].saldo_acumulado).toBe(40000);
      expect(res.data?.movimientos?.[1].id).toBe("mov-2");
      expect(res.data?.movimientos?.[1].saldo_acumulado).toBe(30000);
      expect(res.data?.movimientos?.[2].id).toBe("mov-1");
      expect(res.data?.movimientos?.[2].saldo_acumulado).toBe(80000);
    });
  });
});
