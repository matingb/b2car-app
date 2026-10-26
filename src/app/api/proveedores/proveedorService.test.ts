import { describe, it, expect, vi } from "vitest";
import { createProveedorService } from "./proveedorService";
import type { ProveedorRepository, ProveedorRow } from "./proveedorRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockSupabase = {} as unknown as SupabaseClient;

function makeMockRepository(overrides: Partial<ProveedorRepository> = {}): ProveedorRepository {
  return {
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    getById: vi.fn().mockResolvedValue({ data: null, error: null }),
    create: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: null, error: null }),
    deleteById: vi.fn().mockResolvedValue({ error: null }),
    getCuentaCorriente: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

describe("proveedorService", () => {
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
});
