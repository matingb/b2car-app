import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));

import { createClient } from "@/supabase/server";
import { lookupArcaPadronPerson } from "@/lib/arcaPadron/arcaPadronGateway";
import {
  exportFacturasRows,
  isVerifiedFiscalPdfCache,
  FacturacionValidationError,
  getDevolucionesDisponibles,
  listFacturas,
  parseNotaInput,
  resolvePdfReceiverSnapshot,
  resolvePdfEmitterSnapshot,
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

describe("datos del emisor para el PDF FCE", () => {
  const emitter = { cuit: "20123456786", domicilio: "Calle 1", ingresosBrutos: "-" };
  function mockConfig(cuit: string, ingresosBrutos: string | null) {
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { cuit, ingresos_brutos: ingresosBrutos }, error: null }) };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    const from = vi.fn().mockReturnValue(chain);
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    return { chain, from };
  }
  it("completa únicamente IIBB faltante con configuración del mismo CUIT, tenant y ambiente", async () => {
    const { chain, from } = mockConfig("20-12345678-6", "Convenio Multilateral 901-123456-7");
    const result = await resolvePdfEmitterSnapshot("tenant-1", "HOMOLOGACION", emitter, 211);
    expect(result).toEqual({ ...emitter, ingresosBrutos: "Convenio Multilateral 901-123456-7" });
    expect(emitter.ingresosBrutos).toBe("-");
    expect(from).toHaveBeenCalledWith("facturacion_configuracion_ambiente");
    expect(chain.eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(chain.eq).toHaveBeenCalledWith("ambiente", "HOMOLOGACION");
  });
  it("no toma IIBB de otro CUIT ni inventa información ausente", async () => {
    mockConfig("30712345671", "EXENTO");
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 211)).toBe(emitter);
    mockConfig(emitter.cuit, null);
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 211)).toBe(emitter);
  });
  it("conserva IIBB del snapshot y no consulta configuración para facturas convencionales", async () => {
    const { from } = mockConfig(emitter.cuit, "EXENTO");
    const complete = { ...emitter, ingresosBrutos: "LOCAL 123456" };
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", complete, 211)).toBe(complete);
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 11)).toBe(emitter);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("integridad de caché PDF fiscal", () => {
  const bytes = new TextEncoder().encode("PDF fiscal autorizado");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = "tenant-1/homologacion/factura-1/fiscal-v6.pdf";

  it("permite redescargar la caché legítima cuando ruta, versión e hash coinciden", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v6", expectedPath: path, storedSha256: sha256, bytes })).toBe(true);
  });

  it("rechaza metadatos apuntados a otro objeto o bytes reemplazados", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: "tenant-1/otro.pdf", storedVersion: "fiscal-v6", expectedPath: path, storedSha256: sha256, bytes })).toBe(false);
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v6", expectedPath: path, storedSha256: "0".repeat(64), bytes })).toBe(false);
  });
  it("invalida la versión anterior aunque el hash coincida", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v4", expectedPath: path, storedSha256: sha256, bytes })).toBe(false);
  });
});

describe("devolución de stock por nota de crédito", () => {
  const line1 = "11111111-1111-4111-8111-111111111111";
  const line2 = "22222222-2222-4222-8222-222222222222";
  const noteKey = "33333333-3333-4333-8333-333333333333";

  it("parsea cantidades enteras no negativas sin acoplarlas al importe fiscal", () => {
    expect(parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 25.5, motivo: "Devolución parcial",
      idempotencyKey: noteKey, devoluciones: [{ operacionLineaId: line1, cantidad: 2 }],
    })).toEqual({
      tipo: "NOTA_CREDITO", importe: 25.5, motivo: "Devolución parcial",
      idempotencyKey: noteKey, devoluciones: [{ operacionLineaId: line1, cantidad: 2 }],
    });
  });

  it.each([
    [[{ operacionLineaId: line1, cantidad: -1 }]],
    [[{ operacionLineaId: line1, cantidad: 1.5 }]],
    [[{ operacionLineaId: line1, cantidad: 1 }, { operacionLineaId: line1, cantidad: 1 }]],
  ])("rechaza cantidades inválidas o líneas duplicadas: %j", (devoluciones) => {
    expect(() => parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 25, idempotencyKey: noteKey, devoluciones,
    })).toThrow(FacturacionValidationError);
  });

  it("rechaza devoluciones en una nota de débito", () => {
    expect(() => parseNotaInput({
      tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey,
      devoluciones: [{ operacionLineaId: line1, cantidad: 1 }],
    })).toThrow("Las notas de débito no modifican el stock");
  });

  it("calcula vendido, devuelto, reservado y restante según el estado de cada NC", async () => {
    const rows: Record<string, unknown> = {
      factura: { id: "factura-1", origen_tipo: "VENTA", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: "sha256" },
      facturacion_factura_stock_origenes: [
        { operacion_linea_id: line1, operacion_origen_id: "venta-1", stock_id: "stock-1", taller_id: "taller-1", producto_id: "producto-1", origen_linea: "VENTA", cantidad_original: 5, nombre_snapshot: "Producto A", codigo_snapshot: "A" },
        { operacion_linea_id: line2, operacion_origen_id: "venta-1", stock_id: "stock-2", taller_id: "taller-1", producto_id: "producto-2", origen_linea: "VENTA", cantidad_original: 3, nombre_snapshot: "Producto B", codigo_snapshot: "B" },
      ],
      operaciones_lineas: [{ id: line1, stock_id: "stock-1" }, { id: line2, stock_id: "stock-2" }],
      stocks: [{ id: "stock-1", producto_id: "producto-1" }, { id: "stock-2", producto_id: "producto-2" }],
      productos: [
        { id: "producto-1", nombre: "Producto A", codigo: "A" },
        { id: "producto-2", nombre: "Producto B", codigo: "B" },
      ],
      reservations: [
        { nota_credito_id: "nc-autorizada", operacion_linea_id: line1, cantidad: 1 },
        { nota_credito_id: "nc-incierta", operacion_linea_id: line1, cantidad: 2 },
        { nota_credito_id: "nc-rechazada", operacion_linea_id: line2, cantidad: 3 },
      ],
      notes: [
        { id: "nc-autorizada", estado: "AUTORIZADA" },
        { id: "nc-incierta", estado: "INCIERTA" },
        { id: "nc-rechazada", estado: "RECHAZADA" },
      ],
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      let noteLookup = false;
      for (const method of ["select", "eq", "order"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn((column: string) => {
        if (table === "facturas_electronicas" && column === "id") noteLookup = true;
        return chain;
      });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: rows.factura, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({
          data: table === "facturas_electronicas" && noteLookup
            ? rows.notes
            : table === "facturacion_nc_devoluciones" ? rows.reservations : rows[table],
          error: null,
        }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "factura-1")).resolves.toEqual({
      origenTipo: "VENTA", procedenciaVerificada: true, advertencia: null, items: [
        { operacionLineaId: line1, nombre: "Producto A", codigo: "A", origenLinea: "VENTA", tallerId: "taller-1", cantidadOriginal: 5, vendido: 5, devuelto: 1, reservado: 2, restante: 2 },
        { operacionLineaId: line2, nombre: "Producto B", codigo: "B", origenLinea: "VENTA", tallerId: "taller-1", cantidadOriginal: 3, vendido: 3, devuelto: 0, reservado: 0, restante: 3 },
      ],
    });
  });

  it("ofrece repuestos asignados a una factura de arreglo con su saldo físico", async () => {
    const repairInvoice = { id: "factura-arreglo", origen_tipo: "ARREGLO", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: "sha256" };
    const origin = {
      operacion_linea_id: line1, operacion_origen_id: "asignacion-1", stock_id: "stock-1",
      taller_id: "taller-1", producto_id: "producto-1", origen_linea: "REPUESTO",
      cantidad_original: 4, nombre_snapshot: "Filtro", codigo_snapshot: "FIL-1",
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "in"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: repairInvoice, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({ data: table === "facturacion_factura_stock_origenes" ? [origin] : [], error: null }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "factura-arreglo")).resolves.toEqual({
      origenTipo: "ARREGLO", procedenciaVerificada: true, advertencia: null, items: [{
        operacionLineaId: line1, nombre: "Filtro", codigo: "FIL-1", origenLinea: "REPUESTO",
        tallerId: "taller-1", cantidadOriginal: 4, vendido: 4, devuelto: 0, reservado: 0, restante: 4,
      }],
    });
  });

  it("advierte si una factura histórica carece de procedencia física verificable", async () => {
    const oldInvoice = { id: "factura-antigua", origen_tipo: "ARREGLO", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: null };
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "in"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: oldInvoice, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    const result = await getDevolucionesDisponibles("tenant-1", "factura-antigua");
    expect(result.origenTipo).toBe("ARREGLO");
    expect(result.procedenciaVerificada).toBe(false);
    expect(result.advertencia).toMatch(/no conserva una procedencia física verificable/i);
    expect(result.items).toEqual([]);
  });

  it("no ofrece devoluciones para documentos que no sean facturas autorizadas", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { documento_tipo: "NOTA_CREDITO", origen_tipo: "VENTA", estado: "AUTORIZADA" }, error: null,
        });
        return chain;
      }),
    } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "nota-1")).resolves.toEqual({
      origenTipo: "VENTA", procedenciaVerificada: false, advertencia: null, items: [],
    });
  });
});
