import { expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import { crearEmpleadoViaRoute } from "../helpers/routeDrivers";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type {
  CreateEmpleadoRequest,
  CreateEmpleadoResponse,
} from "@/app/api/empleados/contracts";
import type { EmpleadoRow } from "@/app/api/empleados/empleadosService";

// ─── Constantes de prueba ───────────────────────────────────────────────────

export const SEED_SUCURSAL_OESTE_ID = "50000000-0000-0000-0000-000000000002";

/** Período de 6 meses por defecto (abril a septiembre 2026) que produce buckets mensuales 'MM/YY' */
export const PERIODO_TEST_GASTOS = {
  from: "2026-04-01T00:00:00Z",
  to: "2026-10-01T00:00:00Z",
} as const;

// ─── HTTP Drivers ────────────────────────────────────────────────────────────

/**
 * Driver: Invoca la API route POST /api/empleados y valida el status HTTP.
 */
export async function cuandoSeCreaUnEmpleado(
  payload: Partial<CreateEmpleadoRequest>,
  expectedStatus = 201
): Promise<CreateEmpleadoResponse> {
  const res = await crearEmpleadoViaRoute(payload);
  expect(res.status).toBe(expectedStatus);
  return res.json();
}

export const postEmpleado = cuandoSeCreaUnEmpleado;

/**
 * Driver: Crea un empleado vía route y retorna su ID generado.
 */
export async function postEmpleadoAndGetId(
  payload: Partial<CreateEmpleadoRequest>,
  expectedStatus = 201
): Promise<string> {
  const body = await cuandoSeCreaUnEmpleado(payload, expectedStatus);
  expect(body.data?.id).toBeDefined();
  return body.data!.id;
}

// ─── DB Assertion Helpers ───────────────────────────────────────────────────

/**
 * Assertion: Verifica que el empleado exista en la base de datos con los campos indicados.
 */
export async function expectEmpleadoEnDb(
  id: string,
  expected: Partial<EmpleadoRow> = {}
): Promise<EmpleadoRow> {
  const { data: empleadoDb, error } = await testClient
    .from("empleados")
    .select("*")
    .eq("id", id)
    .single();

  expect(error).toBeNull();
  expect(empleadoDb).toBeDefined();

  if (expected.nombre !== undefined) {
    expect(empleadoDb.nombre).toBe(expected.nombre);
  }
  if (expected.apellido !== undefined) {
    expect(empleadoDb.apellido).toBe(expected.apellido);
  }
  if (expected.dni !== undefined) {
    expect(empleadoDb.dni).toBe(expected.dni);
  }
  if (expected.salario !== undefined) {
    expect(Number(empleadoDb.salario)).toBe(expected.salario);
  }
  if (expected.taller_id !== undefined) {
    expect(empleadoDb.taller_id).toBe(expected.taller_id);
  }
  if (expected.fecha_ingreso !== undefined) {
    expect(empleadoDb.fecha_ingreso).toBe(expected.fecha_ingreso);
  }
  if (expected.email !== undefined) {
    expect(empleadoDb.email).toBe(expected.email);
  }
  if (expected.telefono !== undefined) {
    expect(empleadoDb.telefono).toBe(expected.telefono);
  }

  return empleadoDb;
}

/**
 * Assertion: Verifica las filas de historial salarial en `empleado_salarios`.
 */
export async function expectHistorialSalarial(
  empleadoId: string,
  expected: Array<{ salario: number; vigente_desde: string }>
): Promise<void> {
  const { data: salariosDb, error } = await testClient
    .from("empleado_salarios")
    .select("*")
    .eq("empleado_id", empleadoId)
    .order("vigente_desde", { ascending: true });

  expect(error).toBeNull();
  expect(salariosDb).toHaveLength(expected.length);

  expected.forEach((exp, idx) => {
    expect(Number(salariosDb![idx].salario)).toBe(exp.salario);
    expect(salariosDb![idx].vigente_desde).toBe(exp.vigente_desde);
  });
}

// ─── Taller Expenses Helpers ────────────────────────────────────────────────

/**
 * Consulta los gastos por período del taller y retorna los sueldos indexados por etiqueta (ej. { "05/26": 785000 }).
 */
export async function obtenerSueldosTaller(
  tallerId: string = SEED.tallerId,
  fromISO: string = PERIODO_TEST_GASTOS.from,
  toISO: string = PERIODO_TEST_GASTOS.to
): Promise<Record<string, number>> {
  const data = await arregloService.gastosPorPeriodo(testClient, fromISO, toISO, tallerId);
  const map: Record<string, number> = {};
  for (const row of data) {
    map[row.label] = row.sueldos;
  }
  return map;
}

/**
 * Consulta la lista completa de gastos por período para el taller.
 */
export async function obtenerGastosTaller(
  tallerId: string = SEED.tallerId,
  fromISO: string = PERIODO_TEST_GASTOS.from,
  toISO: string = PERIODO_TEST_GASTOS.to
) {
  return arregloService.gastosPorPeriodo(testClient, fromISO, toISO, tallerId);
}
