import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));
vi.mock("@/lib/facturacion/afipGateway", () => ({ createArcaGateway: vi.fn(), sanitizeFiscalPayload: vi.fn() }));

import { lookupArcaPadronPerson } from "@/lib/arcaPadron/arcaPadronGateway";
import { createArcaGateway } from "@/lib/facturacion/afipGateway";
import { ApiError } from "@/app/api/apiError";
import { selectedColumns, supabaseQueryMock as supabaseMock } from "@/tests/supabaseQueryMock";
import {
  getFacturaRemitos,
  getRemitoDetalle,
  getRemitoPreflight,
  listRemitos,
  parseRemitoNumeroSearch,
} from "./remitosService";

const TENANT = "11111111-1111-4111-8111-111111111111";
const FACTURA_ID = "22222222-2222-4222-8222-222222222222";
const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const ARREGLO_ID = "55555555-5555-4555-8555-555555555555";

/** Claves de importe prohibidas en cualquier respuesta de remitos. */
function amountKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => amountKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(/^(importe|subtotal|total|iva|precio)/i.test(key) ? [`${path}.${key}`] : []),
    ...amountKeys(item, `${path}.${key}`),
  ]);
}

const facturaConImportes = {
  id: FACTURA_ID,
  documento_tipo: "FACTURA",
  clase_comprobante: "C",
  punto_venta: 1,
  numero_comprobante: 123,
  estado: "AUTORIZADA",
  ambiente: "HOMOLOGACION",
  fecha_comprobante: "2026-10-01",
  total: 99999,
  importe_iva: 1234,
  receptor_snapshot: {
    clienteId: "44444444-4444-4444-8444-444444444444",
    nombre: "Cliente Factura",
    domicilio: "Calle Falsa 123",
    tipoDocumento: 96,
    numeroDocumento: "30111222",
    condicionIvaReceptorId: 5,
  },
};

const lineasFacturaConImportes = [
  { id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidad: "5.0000", importe_unitario: 100, subtotal: 500 },
  { id: "l2", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidad: "1.0000", importe_unitario: 900, subtotal: 900 },
];

const remitoRow = {
  id: REMITO_ID,
  clase: "R",
  tipo_comprobante: 91,
  punto_emision: 1,
  numero: 8,
  fecha_emision: "2026-10-06",
  ambiente: "HOMOLOGACION",
  emisor_snapshot: {
    razonSocial: "Taller SRL", nombreFantasia: null, cuit: "20123456786", domicilio: "Calle 1",
    ingresosBrutos: null, inicioActividades: "2020-01-01", condicionIvaEmisor: "MONOTRIBUTISTA", condicionIva: "Monotributista",
  },
  destinatario_snapshot: { nombre: "Juan", tipoDocumento: 80, numeroDocumento: "20123456786", condicionIvaReceptorId: 1, condicionIva: "Responsable inscripto" },
  transportista_snapshot: null,
  cai: "71234567890123",
  cai_vencimiento: "2026-12-31",
  impresion_snapshot: { autoimpresor: true, numeroDesde: null, numeroHasta: null, inicioActividades: null, imprenta: null },
  observaciones: null,
  factura_id: FACTURA_ID,
  factura_asociada_at: "2026-10-06T12:00:00Z",
  created_at: "2026-10-06T12:00:00Z",
  factura: facturaConImportes,
};

describe("remitosService", () => {
  it("mapea el detalle sin exponer importes de la factura asociada", async () => {
    const { supabase, calls } = supabaseMock({
      remitos: [{ data: remitoRow, error: null }],
      remitos_lineas: [{
        data: [{ id: "rl1", ordinal: 1, codigo: "FIL", descripcion: "Filtro", observaciones: null, cantidad: "2.5000", factura_linea_id: "l1" }],
        error: null,
      }],
    });

    const detalle = await getRemitoDetalle(supabase, TENANT, REMITO_ID);

    expect(detalle).toMatchObject({
      numeroVisible: "R 00001-00000008",
      tipoComprobante: 91,
      destinatarioDocumento: "CUIT 20123456786",
      factura: {
        id: FACTURA_ID,
        label: "Factura C 00001-00000123",
        receptorNombre: "Cliente Factura",
        receptorDocumento: "DNI 30111222",
      },
      lineas: [{ id: "rl1", cantidad: 2.5, facturaLineaId: "l1" }],
    });
    expect(amountKeys(detalle)).toEqual([]);
    expect(selectedColumns(calls.remitos)[0]).not.toMatch(/\*|total|importe/);
  });

  it("devuelve 404 cuando el remito no existe en el tenant", async () => {
    const { supabase } = supabaseMock({ remitos: [{ data: null, error: null }] });
    await expect(getRemitoDetalle(supabase, TENANT, REMITO_ID)).rejects.toMatchObject({ status: 404, message: "Remito no encontrado" });
  });

  it("calcula disponibles de la factura sin leer importes de sus líneas", async () => {
    const { supabase, calls } = supabaseMock({
      facturas_electronicas: [{ data: { id: FACTURA_ID }, error: null }],
      remitos: [{
        data: [{ ...remitoRow, clase: "X", tipo_comprobante: null }],
        error: null,
      }],
      facturas_electronicas_lineas: [{ data: lineasFacturaConImportes, error: null }],
      remitos_lineas: [{ data: [{ factura_linea_id: "l1", cantidad: "2.5" }, { factura_linea_id: "l1", cantidad: "1" }], error: null }],
    });

    const result = await getFacturaRemitos(supabase, TENANT, FACTURA_ID);

    expect(result.remitos.map((remito) => remito.numeroVisible)).toEqual(["X 00001-00000008"]);
    expect(result.lineas).toEqual([
      { id: "l1", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidadFacturada: 5, cantidadRemitida: 3.5, cantidadDisponible: 1.5 },
      { id: "l2", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidadFacturada: 1, cantidadRemitida: 0, cantidadDisponible: 1 },
    ]);
    expect(amountKeys(result)).toEqual([]);
    expect(selectedColumns(calls.facturas_electronicas_lineas)).toEqual(["id, ordinal, origen, codigo, descripcion, cantidad"]);
  });

  it("arma el preflight con la factura de origen, disponibles y evaluación de R sin consultar ARCA", async () => {
    const { supabase, calls } = supabaseMock({
      facturacion_configuracion_ambiente: [{
        data: { razon_social: "Taller SRL", cuit: "20123456786", domicilio: "Calle 1", inicio_actividades: "2020-01-01" },
        error: null,
      }],
      remitos_configuracion: [{ data: { r_cai: null, r_punto_emision: 2, r_proximo_numero: 5, x_punto_emision: 1, x_proximo_numero: 3 }, error: null }],
      remitos: [{ data: [{ numero: 4 }], error: null }, { data: [{ numero: 2 }], error: null }],
      facturas_electronicas: [{ data: facturaConImportes, error: null }],
      facturas_electronicas_lineas: [{ data: lineasFacturaConImportes, error: null }],
      remitos_lineas: [{ data: [], error: null }],
    });

    const preflight = await getRemitoPreflight(supabase, TENANT, "HOMOLOGACION", FACTURA_ID);

    expect(preflight.emisor).toEqual({ completo: true, faltantes: [] });
    expect(preflight.tipos.R).toMatchObject({ emitible: false, proximoNumeroVisible: "R 00002-00000005" });
    expect(preflight.tipos.R.motivos).toContain("Falta configurar el CAI.");
    expect(preflight.tipos.X).toEqual({ emitible: true, motivos: [], proximoNumeroVisible: "X 00001-00000003" });
    expect(preflight.factura).toMatchObject({
      label: "Factura C 00001-00000123",
      destinatario: { nombre: "Cliente Factura", tipoDocumento: 96, numeroDocumento: "30111222", condicionIvaReceptorId: 5 },
    });
    expect(preflight.factura?.lineas.map((linea) => linea.cantidadDisponible)).toEqual([5, 1]);
    expect(amountKeys(preflight)).toEqual([]);
    expect(selectedColumns(calls.facturas_electronicas)[0]).not.toMatch(/\*|total|importe/);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
    expect(createArcaGateway).not.toHaveBeenCalled();
  });

  it("precarga bienes y el número de factura asociada desde el arreglo sin exponer importes", async () => {
    const { supabase, calls } = supabaseMock({
      facturacion_configuracion_ambiente: [{ data: null, error: null }],
      remitos_configuracion: [{ data: null, error: null }],
      remitos: [{ data: [], error: null }, { data: [], error: null }],
      arreglos: [{ data: { id: ARREGLO_ID, numero_orden: 42, cliente_id: null }, error: null }],
      facturas_electronicas: [{ data: { punto_venta: 1, numero_comprobante: 123 }, error: null }],
    });
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        arreglo: {
          vehiculo: { nombre_cliente: "Cliente del arreglo" },
          repuestos_pendientes: [{ codigo: "REP-P", nombre: "Filtro pendiente", cantidad: 1, precio_venta: 500 }],
        },
        detalles: [{ descripcion: "Mano de obra", cantidad: 3 }],
        asignaciones: [{
          lineas: [{
            cantidad: 2,
            monto_unitario: 700,
            producto: { codigo: "REP-1", nombre: "Pastillas de freno", precio_unitario: 1000 },
          }],
        }],
      },
      error: null,
    } as never);

    const preflight = await getRemitoPreflight(supabase, TENANT, "HOMOLOGACION", null, ARREGLO_ID);

    expect(preflight.arreglo).toEqual({
      id: ARREGLO_ID,
      label: "Arreglo N° 42",
      facturaNumero: "00001-00000123",
      destinatario: {
        clienteId: null,
        nombre: "Cliente del arreglo",
        domicilio: null,
        tipoDocumento: null,
        numeroDocumento: null,
        condicionIvaReceptorId: null,
      },
      lineas: [
        { codigo: "REP-P", descripcion: "Filtro pendiente", cantidad: 1 },
        { codigo: "REP-1", descripcion: "Pastillas de freno", cantidad: 2 },
      ],
    });
    expect(amountKeys(preflight)).toEqual([]);
    expect(selectedColumns(calls.arreglos)).toEqual(["id, numero_orden, cliente_id"]);
    expect(calls.arreglos).toEqual(expect.arrayContaining([
      { method: "eq", args: ["tenant_id", TENANT] },
    ]));
    expect(supabase.rpc).toHaveBeenCalledWith("rpc_get_arreglo_detalle", { p_arreglo_id: ARREGLO_ID });
  });

  it("no permite precargar un arreglo que no pertenece al tenant", async () => {
    const { supabase, calls } = supabaseMock({
      facturacion_configuracion_ambiente: [{ data: null, error: null }],
      remitos_configuracion: [{ data: null, error: null }],
      remitos: [{ data: [], error: null }, { data: [], error: null }],
      arreglos: [{ data: null, error: null }],
    });
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);

    await expect(getRemitoPreflight(supabase, TENANT, "HOMOLOGACION", null, ARREGLO_ID))
      .rejects.toMatchObject({ status: 404, message: "Arreglo no encontrado" });
    expect(calls.arreglos).toEqual(expect.arrayContaining([
      { method: "eq", args: ["tenant_id", TENANT] },
    ]));
  });

  it.each([
    [{ ...facturaConImportes, estado: "RECHAZADA" }, 400, "Solo se pueden generar remitos desde facturas autorizadas"],
    [{ ...facturaConImportes, documento_tipo: "NOTA_CREDITO" }, 400, "Solo se pueden generar remitos desde facturas autorizadas"],
    [{ ...facturaConImportes, ambiente: "PRODUCCION" }, 400, "otro ambiente fiscal"],
    [null, 404, "Factura no encontrada"],
  ])("rechaza en el preflight facturas no remitibles", async (factura, status, message) => {
    const { supabase } = supabaseMock({
      facturacion_configuracion_ambiente: [{ data: null, error: null }],
      remitos_configuracion: [{ data: null, error: null }],
      remitos: [{ data: [], error: null }],
      facturas_electronicas: [{ data: factura, error: null }],
    });

    const error = await getRemitoPreflight(supabase, TENANT, "HOMOLOGACION", FACTURA_ID).catch((cause) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status });
    expect(error.message).toContain(message);
  });

  it("lista por tenant y ambiente con filtros y búsqueda por número visible", async () => {
    const { supabase, calls } = supabaseMock({
      remitos: [{ data: [{ ...remitoRow, factura: { ...facturaConImportes } }], error: null, count: 1 }],
    });

    const result = await listRemitos(supabase, TENANT, "HOMOLOGACION", {
      page: 2, pageSize: 10, clase: "R", factura: "con", desde: "2026-10-01", hasta: "2026-10-31", search: "R 00001-00000008",
    });

    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 1, items: [{ numeroVisible: "R 00001-00000008", factura: { label: "Factura C 00001-00000123" } }] });
    expect(amountKeys(result.items)).toEqual([]);
    const remitosCalls = calls.remitos.map((call) => [call.method, ...call.args]);
    expect(remitosCalls).toEqual(expect.arrayContaining([
      ["eq", "tenant_id", TENANT],
      ["eq", "ambiente", "HOMOLOGACION"],
      ["eq", "clase", "R"],
      ["not", "factura_id", "is", null],
      ["gte", "fecha_emision", "2026-10-01"],
      ["lte", "fecha_emision", "2026-10-31"],
      ["range", 10, 19],
      ["or", expect.stringContaining("and(numero.eq.8,punto_emision.eq.1,clase.eq.R)")],
    ]));
  });

  it.each([
    [{ clase: "Z" }, "tipo de remito"],
    [{ factura: "quizas" }, "filtro de factura"],
    [{ desde: "2026-13-01" }, "AAAA-MM-DD"],
    [{ desde: "2026-10-10", hasta: "2026-10-01" }, "posterior"],
  ])("valida los filtros del listado %o", async (filtros, message) => {
    const { supabase } = supabaseMock({});
    await expect(listRemitos(supabase, TENANT, "HOMOLOGACION", filtros)).rejects.toThrow(message);
  });

  it("interpreta las búsquedas por número", () => {
    expect(parseRemitoNumeroSearch("8")).toEqual({ numero: 8, clase: undefined });
    expect(parseRemitoNumeroSearch("00001-00000008")).toEqual({ puntoEmision: 1, numero: 8, clase: undefined });
    expect(parseRemitoNumeroSearch("x 1-8")).toEqual({ clase: "X", puntoEmision: 1, numero: 8 });
    expect(parseRemitoNumeroSearch("Juan")).toBeNull();
    expect(parseRemitoNumeroSearch("0")).toBeNull();
  });
});
