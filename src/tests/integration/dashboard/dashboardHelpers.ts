import { statsService, type DashboardStats } from "@/app/api/dashboard/stats/dashboardStatsService";
import { argentinaCalendarDateRangeISO } from "@/lib/fechas";
import { SEED, createAdminTestClient, testClient } from "@/tests/integration";
import {
  dadoUnaCuentaFinanciera,
  dadoUnClienteParticularConVehiculo,
} from "../helpers/integrationFixtures";
import { crearOperacionViaRoute } from "../helpers/routeDrivers";

export type IngresoDia = NonNullable<DashboardStats["ingresosPorPeriodo"]>[number];
export type GastoDia = NonNullable<DashboardStats["gastosPorPeriodo"]>[number];

// ─── Given ───────────────────────────────────────────────────────────────────

/** Cuenta con saldo de sobra para que ninguna compra o gasto del test falle por fondos. */
export async function dadoUnaCuentaConSaldo(): Promise<string> {
  const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 10_000_000 });
  return cuenta.id;
}

async function dadaUnaOperacionDeStock(
  tipo: "VENTA" | "COMPRA",
  cuentaId: string,
  fecha: string,
  monto: number
): Promise<void> {
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
  if (res.status !== 201) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`dadaUna${tipo}(${fecha}) falló: ${body.error ?? res.statusText}`);
  }
}

export const dadaUnaVenta = (cuentaId: string, fecha: string, monto: number) =>
  dadaUnaOperacionDeStock("VENTA", cuentaId, fecha, monto);

export const dadaUnaCompra = (cuentaId: string, fecha: string, monto: number) =>
  dadaUnaOperacionDeStock("COMPRA", cuentaId, fecha, monto);

export async function dadoUnGasto(cuentaId: string, fecha: string, importe: number): Promise<void> {
  const { error } = await testClient.rpc("rpc_crear_movimiento_cuenta", {
    p_subtipo: "GASTO",
    p_importe: importe,
    p_cuenta_id: cuentaId,
    p_categoria_gasto: "ALQUILER",
    p_descripcion: "Gasto de prueba dashboard",
    p_fecha: fecha,
  });
  if (error) throw new Error(`dadoUnGasto falló: ${error.message}`);
}

export async function dadoUnClienteCreadoEl(fecha: string): Promise<void> {
  const { cliente } = await dadoUnClienteParticularConVehiculo();
  const { error } = await createAdminTestClient()
    .from("clientes")
    .update({ fecha_creacion: fecha })
    .eq("id", cliente.id);
  if (error) throw new Error(`dadoUnClienteCreadoEl falló: ${error.message}`);
}

export async function dadaUnaManoDeObra(arregloId: string, monto: number): Promise<void> {
  const { error } = await testClient.from("detalle_arreglo").insert({
    tenant_id: SEED.tenantId,
    arreglo_id: arregloId,
    descripcion: "Mano de obra",
    cantidad: 1,
    horas_facturadas: 1,
    horas_trabajadas: 1,
    precio_hora_facturada: monto,
  });
  if (error) throw new Error(`dadaUnaManoDeObra falló: ${error.message}`);
}

export async function dadoUnSueldo(monto: number, fecha: string = "2020-03-01"): Promise<void> {
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
}



// ─── When ────────────────────────────────────────────────────────────────────
const rangoMarzo = argentinaCalendarDateRangeISO("2020-03-01", "2020-03-31")!;
const MARZO_2020 = { from: rangoMarzo.from!, to: rangoMarzo.to! };

export function cuandoSeConsultaElDashboard(): Promise<DashboardStats> {
  return statsService.getStats(testClient, MARZO_2020.from, MARZO_2020.to, SEED.tenantId);
}

// ─── Then (helpers) ──────────────────────────────────────────────────────────

export const suma = <T>(items: T[], valor: (item: T) => number) =>
  items.reduce((total, item) => total + valor(item), 0);

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

