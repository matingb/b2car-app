import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));

import { createClient } from "@/supabase/server";
import { lookupArcaPadronPerson } from "@/lib/arcaPadron/arcaPadronGateway";
import {
  exportFacturasRows,
  FacturacionValidationError,
  listFacturas,
  resolvePdfReceiverSnapshot,
  validateConfigurationInput,
} from "./facturacionService";

function createQueryChain() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "gte", "lte", "or"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled, onRejected);
  return chain;
}

describe("filtros de fecha de Facturas", () => {
  let query: ReturnType<typeof createQueryChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = createQueryChain();
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(query),
    } as never);
  });

  it("lista con ambos extremos inclusivos de la columna date, sin conversión de zona", async () => {
    await listFacturas("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });

  it("conserva los mismos extremos inclusivos en la exportación", async () => {
    await exportFacturasRows("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });
});

describe("receptor del PDF fiscal", () => {
  const clientRows: Record<string, unknown> = {};

  function mockClientTables() {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq"]) chain[method] = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: clientRows[table] ?? null, error: null });
        return chain;
      }),
    } as never);
  }

  const snapshot = {
    clienteId: "cliente-1",
    nombre: "Cliente Registrado",
    domicilio: "Calle Ficha 123",
    tipoDocumento: 80,
    numeroDocumento: "30712345671",
    condicionIvaReceptorId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(clientRows)) delete clientRows[key];
    clientRows.clientes = { id: "cliente-1", tipo_cliente: "empresa" };
    clientRows.empresas = { nombre: "Cliente Registrado", direccion: "Calle Ficha 123", cuit: "20-11111111-2" };
    mockClientTables();
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "30712345671", tipoPersona: "JURIDICA", estadoClave: "ACTIVO",
        nombre: "Otra Empresa SA", apellido: null, razonSocial: "Otra Empresa SA",
        nombreCompleto: "Otra Empresa SA", direccion: "Av. Fiscal 456",
      },
    });
  });

  it("usa razón social y domicilio del padrón cuando el CUIT no es el del cliente registrado", async () => {
    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).resolves.toEqual({
      ...snapshot,
      nombre: "Otra Empresa SA",
      domicilio: "Av. Fiscal 456",
    });
    expect(lookupArcaPadronPerson).toHaveBeenCalledWith(80, "30712345671");
  });

  it("no imprime el domicilio de la ficha si el padrón no informa domicilio", async () => {
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "30712345671", tipoPersona: "JURIDICA", estadoClave: "ACTIVO",
        nombre: "Otra Empresa SA", apellido: null, razonSocial: "Otra Empresa SA",
        nombreCompleto: "Otra Empresa SA", direccion: null,
      },
    });

    const receiver = await resolvePdfReceiverSnapshot("tenant-1", snapshot);

    expect(receiver.domicilio).toBeNull();
  });

  it("conserva el snapshot cuando el CUIT es el del cliente registrado", async () => {
    clientRows.empresas = { nombre: "Cliente Registrado", direccion: "Calle Ficha 123", cuit: "30-71234567-1" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).resolves.toBe(snapshot);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("reconoce como propio el CUIL asociado al DNI guardado en la ficha", async () => {
    clientRows.clientes = { id: "cliente-1", tipo_cliente: "particular" };
    clientRows.particulares = { nombre: "Juan", apellido: "Pérez", direccion: "Calle 1", dni_cuil: "12.345.678" };
    const cuilSnapshot = { ...snapshot, tipoDocumento: 86, numeroDocumento: "20123456786" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", cuilSnapshot)).resolves.toBe(cuilSnapshot);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("consulta el padrón cuando el comprobante no tiene cliente registrado", async () => {
    const receiver = await resolvePdfReceiverSnapshot("tenant-1", {
      ...snapshot, clienteId: null, nombre: "Consumidor final", domicilio: null,
    });

    expect(receiver.nombre).toBe("Otra Empresa SA");
    expect(receiver.domicilio).toBe("Av. Fiscal 456");
  });

  it("no consulta el padrón para consumidor final sin identificar", async () => {
    const consumer = { ...snapshot, tipoDocumento: 99, numeroDocumento: "0" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", consumer)).resolves.toBe(consumer);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("falla en lugar de imprimir los datos del cliente registrado si ARCA no responde", async () => {
    vi.mocked(lookupArcaPadronPerson).mockRejectedValue(new Error("ARCA no disponible"));

    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).rejects.toBeInstanceOf(FacturacionValidationError);
  });
});


describe("configuración explícita del sistema FCE", () => {
  const config = {
    razonSocial: "Taller", cuit: "20123456786", condicionIvaEmisor: "MONOTRIBUTISTA",
    domicilio: "Calle 1", inicioActividades: "2020-01-01", puntoVenta: 1, fceCbu: null,
  };

  it("conserva modalidad sin elegir como null y no infiere SCA", () => {
    expect(validateConfigurationInput(config).fceSistema).toBeNull();
  });

  it("rechaza una modalidad no permitida en lugar de convertirla a SCA", () => {
    expect(() => validateConfigurationInput({ ...config, fceSistema: "OTRA" })).toThrow("El sistema de circulación FCE debe ser SCA o ADC");
  });
});
