import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { TipoCliente } from "@/model/types";
import { particularService } from "./particulares/particularService";
import { empresaService } from "./empresas/empresaService";

function createSupabaseResult(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient;
}

describe("servicios de detalle de clientes", () => {
  it("devuelve un particular con su tipo discriminante", async () => {
    const result = await particularService.getByIdWithVehiculos(
      createSupabaseResult({
        id: "cliente-1",
        tipo_cliente: TipoCliente.PARTICULAR,
        particular: {
          nombre: "Ana",
          apellido: "Perez",
          telefono: "123",
          email: "ana@example.com",
          direccion: "Calle 1",
        },
        vehiculos: [],
      }),
      "cliente-1"
    );

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: "cliente-1",
      tipo_cliente: TipoCliente.PARTICULAR,
      nombre: "Ana",
      apellido: "Perez",
    });
  });

  it("no interpreta una empresa como particular", async () => {
    const result = await particularService.getByIdWithVehiculos(
      createSupabaseResult({
        id: "cliente-2",
        tipo_cliente: TipoCliente.EMPRESA,
        particular: null,
        empresa: { nombre: "Taller SA" },
        vehiculos: [],
      }),
      "cliente-2"
    );

    expect(result).toEqual({ data: null, error: null });
  });

  it("devuelve una empresa con su tipo discriminante", async () => {
    const result = await empresaService.getByIdWithVehiculos(
      createSupabaseResult({
        id: "cliente-2",
        tipo_cliente: TipoCliente.EMPRESA,
        empresa: {
          nombre: "Taller SA",
          cuit: "30-12345678-9",
          telefono: "456",
          email: "empresa@example.com",
          direccion: "Calle 2",
        },
        vehiculos: [],
      }),
      "cliente-2"
    );

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: "cliente-2",
      tipo_cliente: TipoCliente.EMPRESA,
      nombre: "Taller SA",
    });
  });

  it("no interpreta un particular como empresa", async () => {
    const result = await empresaService.getByIdWithVehiculos(
      createSupabaseResult({
        id: "cliente-1",
        tipo_cliente: TipoCliente.PARTICULAR,
        particular: { nombre: "Ana" },
        empresa: null,
        vehiculos: [],
      }),
      "cliente-1"
    );

    expect(result).toEqual({ data: null, error: null });
  });
});
