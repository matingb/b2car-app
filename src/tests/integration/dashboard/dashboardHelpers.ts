import { statsService, type DashboardStats } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type { DashboardPeriodo } from "@/lib/dashboard/types";
import { argentinaCalendarDateRangeISO } from "@/lib/fechas";
import { SEED, createAdminTestClient, testClient } from "@/tests/integration";
import {
  dadoUnaCuentaFinanciera,
  dadoUnClienteParticularConVehiculo,
} from "../helpers/integrationFixtures";
import { borrarOperacionViaRoute, crearOperacionViaRoute } from "../helpers/routeDrivers";

// ─── Given ───────────────────────────────────────────────────────────────────

/** Cuenta con saldo de sobra para que ninguna compra o gasto del test falle por fondos. */
export async function dadoUnaCuentaConSaldo(): Promise<string> {
  const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 10_000_000 });
  return cuenta.id;
}

/** Devuelve el id de la operación creada. */
async function dadaUnaOperacionDeStock(
  tipo: "VENTA" | "COMPRA",
  cuentaId: string,
  fecha: string,
  monto: number
): Promise<string> {
  const res = await crearOperacionViaRoute({
    tipo,
    taller_id: SEED.tallerId,
    fecha,
    cuenta_financiera_id: cuentaId,
    idempotency_key: crypto.randomUUID(),
    lineas: [
      {
        stock_id: SEED.stockAceite.id,
        cantidad: 1,
        monto_unitario: monto,
        delta_cantidad: tipo === "VENTA" ? -1 : 1,
      },
    ],
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 201 || !body.data?.id) {
    throw new Error(`dadaUna${tipo}(${fecha}) falló: ${body.error ?? res.statusText}`);
  }
  return body.data.id as string;
}

export const dadaUnaVenta = (cuentaId: string, fecha: string, monto: number) =>
  dadaUnaOperacionDeStock("VENTA", cuentaId, fecha, monto);

export const dadaUnaCompra = (cuentaId: string, fecha: string, monto: number) =>
  dadaUnaOperacionDeStock("COMPRA", cuentaId, fecha, monto);

/** Devuelve el id de la operación del gasto. */
export async function dadoUnGasto(cuentaId: string, fecha: string, importe: number): Promise<string> {
  const { data, error } = await testClient.rpc("rpc_crear_movimiento_cuenta", {
    p_subtipo: "GASTO",
    p_importe: importe,
    p_cuenta_id: cuentaId,
    p_categoria_gasto: "ALQUILER",
    p_descripcion: "Gasto de prueba dashboard",
    p_fecha: fecha,
  });
  if (error) throw new Error(`dadoUnGasto falló: ${error.message}`);
  const fila = Array.isArray(data) ? data[0] : data;
  const id = typeof fila === "string" ? fila : (fila as { id?: string } | null)?.id;
  if (!id) throw new Error(`dadoUnGasto no devolvió el id: ${JSON.stringify(data)}`);
  return id;
}

/** Revierte una venta, compra o gasto por la misma ruta que usa la app. */
export async function cuandoSeBorraLaOperacion(operacionId: string): Promise<void> {
  const res = await borrarOperacionViaRoute(operacionId);
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) throw new Error(`cuandoSeBorraLaOperacion falló: ${body.error ?? res.statusText}`);
}

export async function dadoUnClienteCreadoEl(fecha: string): Promise<void> {
  const { cliente } = await dadoUnClienteParticularConVehiculo();
  const { error } = await createAdminTestClient()
    .from("clientes")
    .update({ fecha_creacion: fecha })
    .eq("id", cliente.id);
  if (error) throw new Error(`dadoUnClienteCreadoEl falló: ${error.message}`);
}

/** Devuelve el id del detalle creado. */
export async function dadaUnaManoDeObra(arregloId: string, monto: number): Promise<string> {
  const { data, error } = await testClient.from("detalle_arreglo").insert({
    tenant_id: SEED.tenantId,
    arreglo_id: arregloId,
    descripcion: "Mano de obra",
    cantidad: 1,
    horas_facturadas: 1,
    horas_trabajadas: 1,
    precio_hora_facturada: monto,
  }).select("id").single();
  if (error || !data) throw new Error(`dadaUnaManoDeObra falló: ${error?.message ?? "sin respuesta"}`);
  return data.id;
}

/** Devuelve el id del empleado cuyo salario se registra. */
export async function dadoUnSueldo(monto: number, fecha: string = "2020-03-01"): Promise<string> {
  const admin = createAdminTestClient();
  const id = crypto.randomUUID();
  const fechaYmd = fecha.slice(0, 10);
  const { error: errorEmp } = await admin.from("empleados").insert({
    id,
    tenant_id: SEED.tenantId,
    taller_id: SEED.tallerId,
    nombre: "Empleado",
    apellido: "Dashboard",
    dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
    salario: monto,
    fecha_ingreso: fechaYmd,
  });
  if (errorEmp) throw new Error(`dadoUnSueldo falló: ${errorEmp.message}`);

  const { error: errorSal } = await admin.from("empleado_salarios").insert({
    empleado_id: id,
    tenant_id: SEED.tenantId,
    taller_id: SEED.tallerId,
    salario: monto,
    vigente_desde: fechaYmd,
  });
  if (errorSal) throw new Error(`dadoUnSueldo (salario) falló: ${errorSal.message}`);
  return id;
}

/** Empleado sin salario, para atribuir horas o importes. */
export async function dadoUnEmpleado(nombre: string, apellido: string): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await createAdminTestClient().from("empleados").insert({
    id,
    tenant_id: SEED.tenantId,
    taller_id: SEED.tallerId,
    nombre,
    apellido,
    dni: `DASH-${id}`,
  });
  if (error) throw new Error(`dadoUnEmpleado falló: ${error.message}`);
  return id;
}

/** Categoría de arreglo por nombre; reutiliza la del seed si existe (el nombre es único por tenant). */
export async function dadaUnaCategoria(nombre: string): Promise<string> {
  const { data: existente } = await createAdminTestClient()
    .from("categorias_arreglo")
    .select("id")
    .eq("tenant_id", SEED.tenantId)
    .ilike("nombre", nombre)
    .maybeSingle();
  if (existente) return existente.id;
  const id = crypto.randomUUID();
  const { error } = await createAdminTestClient()
    .from("categorias_arreglo")
    .insert({ id, tenant_id: SEED.tenantId, nombre });
  if (error) throw new Error(`dadaUnaCategoria falló: ${error.message}`);
  return id;
}

/** Detalle con horas trabajadas (null simula un dato histórico desconocido). */
export async function dadoUnDetalleDeHoras(
  arregloId: string,
  options: {
    empleadoId?: string | null;
    horasTrabajadas: number | null;
    horasFacturadas?: number | null;
    cantidad?: number;
    tenantId?: string;
  }
): Promise<void> {
  const { data: detalle, error } = await testClient.from("detalle_arreglo").insert({
    tenant_id: options.tenantId ?? SEED.tenantId,
    arreglo_id: arregloId,
    empleado_id: options.empleadoId ?? null,
    descripcion: "Detalle de prueba dashboard",
    cantidad: options.cantidad ?? 1,
    precio_hora_facturada: 0,
    horas_trabajadas: options.horasTrabajadas,
    horas_facturadas: options.horasFacturadas ?? null,
  }).select("id").single();
  if (error) throw new Error(`dadoUnDetalleDeHoras falló: ${error.message}`);

  if (options.horasTrabajadas === null) {
    const { error: updateError } = await testClient
      .from("detalle_arreglo")
      .update({ horas_trabajadas: null })
      .eq("id", detalle.id);
    if (updateError) throw new Error(`No se pudo preparar horas históricas desconocidas: ${updateError.message}`);
  }
}

/** Detalle facturado: importe = cantidad × horasFacturadas × precioHoraFacturada. Devuelve su id. */
export async function dadoUnDetalleFacturado(
  arregloId: string,
  options: {
    categoriaId?: string | null;
    empleadoId?: string | null;
    cantidad?: number;
    horasFacturadas?: number;
    precioHoraFacturada: number;
  }
): Promise<string> {
  const { data, error } = await testClient.from("detalle_arreglo").insert({
    tenant_id: SEED.tenantId,
    arreglo_id: arregloId,
    descripcion: "Detalle de facturación",
    cantidad: options.cantidad ?? 1,
    precio_hora_facturada: options.precioHoraFacturada,
    horas_facturadas: options.horasFacturadas ?? 1,
    horas_trabajadas: 1,
    categoria_arreglo_id: options.categoriaId ?? null,
    empleado_id: options.empleadoId ?? null,
  }).select("id").single();
  if (error || !data) throw new Error(`dadoUnDetalleFacturado falló: ${error?.message ?? "sin respuesta"}`);
  return data.id;
}

// ─── When ────────────────────────────────────────────────────────────────────
const rangoMarzo = argentinaCalendarDateRangeISO("2020-03-01", "2020-03-31")!;
const MARZO_2020 = { from: rangoMarzo.from!, to: rangoMarzo.to! };

export function cuandoSeConsultaElDashboard(): Promise<DashboardStats> {
  return statsService.getStats(testClient, MARZO_2020.from, MARZO_2020.to, SEED.tenantId);
}

/** Consulta un período a comparar, con días calendario de Buenos Aires inclusivos. */
export function cuandoSeConsultaElPeriodo(desde: string, hasta: string): Promise<DashboardPeriodo> {
  const rango = argentinaCalendarDateRangeISO(desde, hasta)!;
  return arregloService.dashboardPeriodo(testClient, rango.from!, rango.to!);
}

// ─── Then (helpers) ──────────────────────────────────────────────────────────

export const suma = <T>(items: T[], valor: (item: T) => number) =>
  items.reduce((total, item) => total + valor(item), 0);

/** Días de una serie diaria que tienen datos: { fecha: valor }. Ignora los días en cero. */
export function fechasConDatos<T extends { fecha: string }>(
  filas: T[],
  valor: (fila: T) => number
): Record<string, number> {
  return Object.fromEntries(
    filas.filter((fila) => valor(fila) > 0).map((fila) => [fila.fecha, valor(fila)])
  );
}

/** Días del gráfico que tienen datos: { label: valor }. Ignora los slots en cero. */
export function diasConDatos<T extends { label: string }>(
  filas: T[],
  valor: (fila: T) => number
): Record<string, number> {
  return Object.fromEntries(
    filas.filter((fila) => valor(fila) > 0).map((fila) => [fila.label, valor(fila)])
  );
}

/** Serie de clientes nuevos como filas { label, valor }, compatible con diasConDatos. */
export function clientesNuevosPorDia(stats: DashboardStats): { label: string; valor: number }[] {
  const nuevos = stats.clientes?.nuevosEsteMes;
  return (nuevos?.dias ?? []).map((label, i) => ({ label, valor: nuevos?.valor[i] ?? 0 }));
}
/** Fila diaria de ingresos del período (undefined si el día no está en el rango). */
export const ingresosDelDia = (stats: DashboardStats, fecha: string) =>
  stats.periodo!.series.ingresos.find((d) => d.fecha === fecha);

/** Fila diaria de gastos del período (undefined si el día no está en el rango). */
export const gastosDelDia = (stats: DashboardStats, fecha: string) =>
  stats.periodo!.series.gastos.find((d) => d.fecha === fecha);

/** Cantidad de arreglos del día. */
export const arreglosDelDia = (stats: DashboardStats, fecha: string) =>
  stats.periodo!.series.arreglos.find((d) => d.fecha === fecha)?.cantidad ?? 0;

/** Normaliza las filas devueltas por los RPC de desglose. */
export function normalizarFilasDesglose(data: unknown) {
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = item as { label?: unknown; cantidad?: unknown; monto?: unknown };
    return {
      label: String(row.label ?? ""),
      cantidad: Number(row.cantidad ?? 0),
      monto: Number(row.monto ?? 0),
    };
  });
}
