import { expect } from "vitest";
import { testClient, createAdminTestClient, SEED } from "@/tests/integration";
import { dadoQueExisteUnProductoConStock } from "./stockHelpers";
import { particularService } from "@/app/api/clientes/particulares/particularService";
import { vehiculoService } from "@/app/api/vehiculos/vehiculoService";
import type { Arreglo, Cliente, EstadoArreglo } from "@/model/types";
import type { CreateArregloInsertPayload } from "@/app/api/arreglos/arregloRequests";
import type { StockRow as Stock } from "@/app/api/stocks/stocksService";
import { stocksService } from "@/app/api/stocks/stocksService";
import { cuentasFinancierasService } from "@/app/api/cuentas-financieras/cuentasFinancierasService";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import {
  cobrarArregloViaRoute as cobrarArreglo,
  asignarRepuestoViaRoute,
  type CobrarArregloPayload,
} from "./routeDrivers";
import {
  proveedorService,
  type CreateProveedorInput,
  type ProveedorRow,
} from "@/app/api/proveedores/proveedorService";

const adminClient = createAdminTestClient();

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CuentaFinancieraFixture {
  id: string;
  nombre: string;
  tipo: string;
  saldoInicial: number;
}

export interface DadoUnArregloOptions {
  vehiculo_id?: string;
  taller_id?: string;
  cliente_id?: string;
  tipo?: string;
  estado?: EstadoArreglo;
  descripcion?: string;
  kilometraje_leido?: number;
  combustible_leido?: number | null;
  fecha?: string;
  observaciones?: string;
  precio_final?: number;
  precio_sin_iva?: number;
  total_cobrado?: number;
  esta_pago?: boolean;
  es_facturable?: boolean;
  precios_incluyen_iva?: boolean;
  tasa_iva?: number | null;
}

export interface DadoUnArregloCobradoOptions {
  precioFinal?: number;
  montoCobrado?: number;
  cuentaId?: string;
  estado?: EstadoArreglo;
}

export interface DadoUnArregloCobradoResult {
  arreglo: Arreglo;
  cuentaId: string;
  operacionId: string;
  montoCobrado: number;
  precioFinal: number;
}

export interface DadoUnArregloConRepuestoOptions {
  stockInicial?: number;
  cantidadAsignada?: number;
  precioUnitario?: number;
  stockOverrides?: Partial<Stock>;
  fecha?: string;
  precioFinal?: number;
}

export interface DadoUnArregloConRepuestoResult {
  arreglo: Arreglo;
  stockId: string;
  productoId: string;
  operacionId: string;
  lineaId: string;
  stockInicial: number;
  cantidadAsignada: number;
  precioUnitario: number;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Fixture: Crea una cuenta financiera aislada para pruebas.
 */
export async function dadoUnaCuentaFinanciera(options?: {
  nombre?: string;
  tipo?: "EFECTIVO" | "CUENTA_BANCARIA" | "BILLETERA_DIGITAL" | "TARJETA_CREDITO";
  saldoInicial?: number;
}): Promise<CuentaFinancieraFixture> {
  const nombre = options?.nombre ?? `Cuenta Test ${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const tipo = options?.tipo ?? "CUENTA_BANCARIA";
  const saldoInicial = options?.saldoInicial ?? 0;

  const { data, error } = await testClient.rpc("rpc_finanzas_crear_cuenta", {
    p_nombre: nombre,
    p_tipo: tipo,
    p_saldo_inicial: saldoInicial,
  });

  if (error || !data || data.length === 0) {
    throw new Error(`dadoUnaCuentaFinanciera falló: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data[0];
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    saldoInicial: Number(row.saldo_inicial),
  };
}

/**
 * Fixture: Crea un arreglo base mediante el repositorio con valores predeterminados sensatos.
 */
export async function dadoUnArreglo(overrides: DadoUnArregloOptions = {}): Promise<Arreglo> {
  const payload: CreateArregloInsertPayload & { tenant_id: string; total_cobrado: number } = {
    tenant_id: SEED.tenantId,
    vehiculo_id: overrides.vehiculo_id ?? SEED.vehiculoId,
    taller_id: overrides.taller_id ?? SEED.tallerId,
    cliente_id: overrides.cliente_id ?? SEED.clienteId,
    estado: overrides.estado ?? "SIN_INICIAR",
    descripcion: overrides.descripcion ?? "Mantenimiento general",
    kilometraje_leido: overrides.kilometraje_leido ?? 50000,
    combustible_leido: overrides.combustible_leido ?? null,
    fecha: overrides.fecha ?? new Date().toISOString(),
    observaciones: overrides.observaciones ?? "",
    precio_final: overrides.precio_final ?? 50000,
    precio_sin_iva: overrides.precio_sin_iva ?? (overrides.precio_final ? overrides.precio_final / 1.21 : 41322.31),
    total_cobrado: overrides.total_cobrado ?? 0,
    esta_pago: overrides.esta_pago ?? false,
    es_facturable: overrides.es_facturable ?? true,
    extra_data: "{}",
    ...(overrides.precios_incluyen_iva !== undefined ? { precios_incluyen_iva: overrides.precios_incluyen_iva } : {}),
    ...(overrides.tasa_iva !== undefined ? { tasa_iva: overrides.tasa_iva } : {}),
  };

  const { data, error } = await supabaseArregloRepository.create(testClient, payload);

  if (error || !data) {
    throw new Error(`dadoUnArreglo falló: ${error ?? "sin respuesta"}`);
  }

  return data;
}

/**
 * Fixture: Realiza el cobro de un arreglo vía route y retorna su detalle completo actualizado.
 */
export async function cuandoSeCobraUnArreglo(
  arregloId: string,
  payload: CobrarArregloPayload
) {
  const res = await cobrarArreglo(arregloId, payload);
  const json = await res.json().catch(() => ({}));

  if (res.status !== 200 || json.error) {
    throw new Error(`cuandoSeCobraUnArreglo falló: ${json.error ?? res.statusText}`);
  }

  const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
    testClient,
    arregloId
  );

  return detalle;
}

/**
 * Fixture: Crea un arreglo y le cobra un monto determinado invocando la route POST /api/arreglos/[id]/cobro.
 * Retorna el arreglo, cuenta, operacion_id e importes.
 */
export async function dadoUnArregloCobrado(
  options: DadoUnArregloCobradoOptions = {}
): Promise<DadoUnArregloCobradoResult> {
  const precioFinal = options.precioFinal ?? 100000;
  const montoCobrado = options.montoCobrado ?? precioFinal;

  let cuentaId = options.cuentaId;
  if (!cuentaId) {
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    cuentaId = cuenta.id;
  }

  const arreglo = await dadoUnArreglo({
    precio_final: precioFinal,
    estado: options.estado ?? "EN_PROGRESO",
  });

  const detalle = await cuandoSeCobraUnArreglo(arreglo.id, {
    cuenta_financiera_id: cuentaId,
    monto: montoCobrado,
    fecha_cobro: new Date().toISOString().slice(0, 10),
    descripcion: "Cobro inicial fixture",
  });

  const operacionId = detalle?.cobros?.[0]?.operacion_id;
  if (!operacionId) {
    throw new Error("dadoUnArregloCobrado: no se obtuvo operacion_id del cobro");
  }

  return {
    arreglo: detalle?.arreglo ?? arreglo,
    cuentaId,
    operacionId,
    montoCobrado,
    precioFinal,
  };
}

/**
 * Fixture: Crea producto, stock y asigna repuesto a un arreglo invocando la route POST /api/arreglos/[id]/repuestos.
 */
export async function dadoUnArregloConRepuesto(
  options: DadoUnArregloConRepuestoOptions = {}
): Promise<DadoUnArregloConRepuestoResult> {
  const stockInicial = options.stockInicial ?? 30;
  const cantidadAsignada = options.cantidadAsignada ?? 5;
  const precioUnitario = options.precioUnitario ?? 8500;

  const { productoId, stockId } = await dadoQueExisteUnProductoConStock({
    stock: { cantidad: stockInicial, taller_id: SEED.tallerId, ...options.stockOverrides },
  });

  const precioFinal = options.precioFinal ?? cantidadAsignada * precioUnitario;
  const arreglo = await dadoUnArreglo({
    precio_final: precioFinal,
    fecha: options.fecha,
    estado: "EN_PROGRESO",
  });

  const res = await asignarRepuestoViaRoute(arreglo.id, {
    taller_id: SEED.tallerId,
    stock_id: stockId,
    cantidad: cantidadAsignada,
    monto_unitario: precioUnitario,
  });
  const json = await res.json();

  if (res.status !== 200 || !json.data?.operacion_id) {
    throw new Error(`dadoUnArregloConRepuesto falló al asignar: ${json.error ?? res.statusText}`);
  }

  const operacionId = json.data.operacion_id;

  const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
    testClient,
    arreglo.id
  );

  const linea = detalle?.asignaciones?.[0]?.lineas?.[0];
  if (!linea) {
    throw new Error(`dadoUnArregloConRepuesto no pudo encontrar operaciones_lineas`);
  }

  return {
    arreglo,
    stockId,
    productoId,
    operacionId,
    lineaId: linea.id,
    stockInicial,
    cantidadAsignada,
    precioUnitario,
  };
}

/**
 * Fixture: Crea un cliente particular nuevo junto a un vehículo exclusivo para aislar el test.
 */
export async function dadoUnClienteParticularConVehiculo(overrides?: {
  nombre?: string;
  apellido?: string;
  patente?: string;
}): Promise<{ cliente: Cliente; vehiculo: { id: string } }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const { data: cliente, error: cliError } = await particularService.createClienteParticular(
    testClient,
    {
      nombre: overrides?.nombre ?? `Cliente-${stamp}`,
      apellido: overrides?.apellido ?? "Test",
      telefono: "1122334455",
      email: `test-${stamp}@b2car.ar`,
      direccion: "Av San Martin 1234",
    }
  );

  if (cliError || !cliente) {
    throw new Error(`dadoUnClienteParticularConVehiculo falló al crear cliente: ${cliError?.message}`);
  }

  const patente = overrides?.patente ?? `TST-${stamp.slice(-4).toUpperCase()}`;
  const { data: vehiculo, error: vehError } = await vehiculoService.create(testClient, {
    cliente_id: cliente.id,
    patente,
    marca: "Toyota",
    modelo: "Yaris",
    fecha_patente: "2020-01-01",
  });

  if (vehError || !vehiculo) {
    throw new Error(`dadoUnClienteParticularConVehiculo falló al crear vehiculo: ${vehError?.message}`);
  }

  return { cliente, vehiculo };
}


/**
 * Fixture: Simula la emisión de una factura electrónica autorizada vinculada al arreglo.
 */
export async function dadoUnaFacturaAutorizadaParaArreglo(arregloId: string): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient
    .from("facturas_electronicas")
    .insert([
      {
        tenant_id: SEED.tenantId,
        arreglo_id: arregloId,
        idempotency_key: crypto.randomUUID(),
        estado: "AUTORIZADA",
        ambiente: "HOMOLOGACION",
        origen_tipo: "ARREGLO",
        documento_tipo: "FACTURA",
        clase_comprobante: "C",
        concepto: 1,
        fecha_comprobante: new Date().toISOString().slice(0, 10),
        moneda: "PES",
        total: 10000,
        punto_venta: 1,
        tipo_comprobante: 11,
        numero_comprobante: Math.floor(Math.random() * 90000) + 10000,
        cae: "12345678901234",
        cae_vencimiento: "2026-10-01",
        emisor_snapshot: {
          razon_social: "B2Car Taller",
          cuit: "20123456789",
          punto_venta: 1,
        },
        receptor_snapshot: {
          razon_social: "Cliente Test",
          nro_doc: "12345678",
          tipo_doc: 96,
        },
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`dadoUnaFacturaAutorizadaParaArreglo falló: ${error?.message ?? "sin respuesta"}`);
  }

  return data;
}

export async function dadoUnProveedor(
  overrides?: Partial<CreateProveedorInput>
): Promise<ProveedorRow> {
  const stamp = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const { data, error } = await proveedorService.create(testClient, {
    nombre: overrides?.nombre ?? `Proveedor Test ${stamp}`,
    cuit: overrides?.cuit ?? `30-${Math.floor(10000000 + Math.random() * 90000000)}-9`,
    telefono: overrides?.telefono ?? "1144556677",
    email: overrides?.email ?? `proveedor-${stamp}@test.ar`,
    direccion: overrides?.direccion ?? "Av. Warnes 1234",
  });

  if (error || !data) {
    throw new Error(`dadoUnProveedor falló: ${JSON.stringify(error) ?? "sin respuesta"}`);
  }

  return data;
}

// ─── Assertions ───────────────────────────────────────────────────────────────

/**
 * Comprueba que el saldo de una cuenta financiera coincida con el valor esperado consultando el servicio.
 */
export async function expectSaldoCuenta(cuentaId: string, saldoEsperado: number): Promise<void> {
  const { data, error } = await cuentasFinancierasService.getById(testClient, cuentaId);
  expect(error).toBeNull();
  expect(data?.saldoActual).toBe(saldoEsperado);
}

/**
 * Comprueba que la cantidad en stock coincida con el valor esperado consultando el servicio de stocks.
 */
export async function expectCantidadDeStock(stockId: string, cantidadEsperada: number): Promise<void> {
  const { data, error } = await stocksService.getById(testClient, stockId);
  expect(error).toBeNull();
  expect(data?.cantidad).toBe(cantidadEsperada);
}


export async function expectStockDetallado(
  stockId: string,
  expected: { cantidad?: number; cantidad_reservada?: number; cantidad_pendiente?: number; cantidad_disponible?: number }
): Promise<void> {
  const { data, error } = await stocksService.getById(testClient, stockId);
  expect(error).toBeNull();
  if (expected.cantidad !== undefined) {
    expect(data?.cantidad).toBe(expected.cantidad);
  }
  if (expected.cantidad_reservada !== undefined) {
    expect(data?.cantidad_reservada).toBe(expected.cantidad_reservada);
  }
  if (expected.cantidad_pendiente !== undefined) {
    expect(data?.cantidad_pendiente).toBe(expected.cantidad_pendiente);
  }
  if (expected.cantidad_disponible !== undefined) {
    expect(data?.cantidad_disponible).toBe(expected.cantidad_disponible);
  }
}

