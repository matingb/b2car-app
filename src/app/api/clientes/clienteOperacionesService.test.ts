import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClienteOperacionesService } from "./clienteOperacionesService";
import { ServiceError } from "@/app/api/serviceError";
import type { ClienteOperacionesRepository } from "./clienteOperacionesRepository";

describe("clienteOperacionesService", () => {
  it("valida que clienteId sea provisto", async () => {
    const mockRepo: ClienteOperacionesRepository = {
      getOperaciones: vi.fn(),
    };
    const service = createClienteOperacionesService(mockRepo);
    const db = {} as SupabaseClient;

    const resEmpty = await service.getOperaciones(db, "");
    expect(resEmpty.error).toBe(ServiceError.Validation);
    expect(mockRepo.getOperaciones).not.toHaveBeenCalled();

    const resSpaces = await service.getOperaciones(db, "   ");
    expect(resSpaces.error).toBe(ServiceError.Validation);
    expect(mockRepo.getOperaciones).not.toHaveBeenCalled();
  });

  it("delega a repository cuando clienteId es válido", async () => {
    const mockResumen = {
      totalVendido: 1000,
      totalCobrado: 1000,
      saldoPendiente: 0,
      operaciones: [],
    };
    const mockRepo: ClienteOperacionesRepository = {
      getOperaciones: vi.fn().mockResolvedValue({ data: mockResumen, error: null }),
    };
    const service = createClienteOperacionesService(mockRepo);
    const db = {} as SupabaseClient;

    const res = await service.getOperaciones(db, "cli-123");

    expect(mockRepo.getOperaciones).toHaveBeenCalledWith(db, "cli-123");
    expect(res.data).toEqual(mockResumen);
    expect(res.error).toBeNull();
  });
});
