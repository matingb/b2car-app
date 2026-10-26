import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClienteFinanzasService } from "./clienteFinanzasService";
import type { ClienteFinanzasRepository } from "./clienteFinanzasRepository";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockDb = {} as SupabaseClient;

function makeRepo(overrides: Partial<ClienteFinanzasRepository> = {}): ClienteFinanzasRepository {
  return {
    getResumenFinanciero: vi.fn().mockResolvedValue({ data: null, error: null }),
    getCuentaCorriente: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

describe("clienteFinanzasService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getResumenFinanciero", () => {
    it("retorna error si no se especifica clienteId", async () => {
      const service = createClienteFinanzasService(makeRepo());
      const res = await service.getResumenFinanciero(mockDb, "");
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("ID de cliente requerido");
      expect(res.data).toBeNull();
    });

    it("utiliza la RPC cuando responde exitosamente y formatea los datos", async () => {
      const repo = makeRepo({
        getResumenFinanciero: vi.fn().mockResolvedValue({
          data: {
            saldo_cuenta: 5000,
            saldo_a_facturar: 2000,
            total_historico_trabajos: 10000,
            total_historico_cobrado: 5000,
            cantidad_arreglos_pendientes_pago: 1,
            cantidad_arreglos_pendientes_factura: 1,
          },
          error: null,
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getResumenFinanciero(mockDb, "cli-1");

      expect(res.error).toBeNull();
      expect(res.data).toEqual({
        saldo_cuenta: 5000,
        saldo_a_facturar: 2000,
        total_historico_trabajos: 10000,
        total_historico_cobrado: 5000,
        cantidad_arreglos_pendientes_pago: 1,
        cantidad_arreglos_pendientes_factura: 1,
      });
    });

    it("retorna error y loguea cuando la RPC falla", async () => {
      const repo = makeRepo({
        getResumenFinanciero: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "database connection failed" },
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getResumenFinanciero(mockDb, "cli-1");

      expect(res.data).toBeNull();
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("database connection failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Error al obtener resumen financiero del cliente",
        expect.objectContaining({
          clienteId: "cli-1",
          error: { message: "database connection failed" },
        })
      );
    });

    it("retorna error y loguea cuando la RPC responde sin datos", async () => {
      const repo = makeRepo({
        getResumenFinanciero: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getResumenFinanciero(mockDb, "cli-1");

      expect(res.data).toBeNull();
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("Resumen financiero no encontrado");
      expect(logger.error).toHaveBeenCalledWith(
        "Resumen financiero no encontrado o vacío",
        { clienteId: "cli-1" }
      );
    });
  });

  describe("getCuentaCorriente", () => {
    it("retorna error si no se especifica clienteId", async () => {
      const service = createClienteFinanzasService(makeRepo());
      const res = await service.getCuentaCorriente(mockDb, "");
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("ID de cliente requerido");
      expect(res.data).toBeNull();
    });

    it("calcula saldo acumulado y ordena cronológicamente (más recientes primero)", async () => {
      const repo = makeRepo({
        getCuentaCorriente: vi.fn().mockResolvedValue({
          data: [
            {
              id: "mov-1",
              fecha: "2026-01-01T10:00:00Z",
              tipo_movimiento: "CARGO_ARREGLO",
              concepto: "Arreglo frenos",
              debito: 1000,
              credito: 0,
            },
            {
              id: "mov-2",
              fecha: "2026-01-05T10:00:00Z",
              tipo_movimiento: "COBRO",
              concepto: "Pago",
              debito: 0,
              credito: 400,
            },
          ],
          error: null,
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getCuentaCorriente(mockDb, "cli-1");

      expect(res.error).toBeNull();
      // Reverse ordered (latest first)
      expect(res.data?.[0].id).toBe("mov-2");
      expect(res.data?.[0].saldo_acumulado).toBe(600); // 1000 - 400
      expect(res.data?.[1].id).toBe("mov-1");
      expect(res.data?.[1].saldo_acumulado).toBe(1000);
    });

    it("retorna error y loguea cuando la RPC falla", async () => {
      const repo = makeRepo({
        getCuentaCorriente: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "function does not exist" },
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getCuentaCorriente(mockDb, "cli-1", { from: "2026-01-01" });

      expect(res.data).toBeNull();
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("function does not exist");
      expect(logger.error).toHaveBeenCalledWith(
        "Error al obtener cuenta corriente del cliente",
        expect.objectContaining({
          clienteId: "cli-1",
          filters: { from: "2026-01-01" },
          error: { message: "function does not exist" },
        })
      );
    });

    it("retorna error y loguea cuando la respuesta no es un arreglo válido", async () => {
      const repo = makeRepo({
        getCuentaCorriente: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const service = createClienteFinanzasService(repo);
      const res = await service.getCuentaCorriente(mockDb, "cli-1");

      expect(res.data).toBeNull();
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error?.message).toBe("Cuenta corriente no disponible");
      expect(logger.error).toHaveBeenCalledWith(
        "Cuenta corriente retornó formato inválido o vacío",
        { clienteId: "cli-1" }
      );
    });
  });
});
