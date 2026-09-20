import { expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import { crearEmpleadoViaRoute } from "../helpers/routeDrivers";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type {
  CreateEmpleadoRequest,
  CreateEmpleadoResponse,
} from "@/app/api/empleados/contracts";
import {
  empleadosService,
  type EmpleadoRow,
  type SalarioHistorialRow,
} from "@/app/api/empleados/empleadosService";

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

// ─── DB Assertion Helpers (vía Servicios Reales) ────────────────────────────

/**
 * Assertion: Verifica que el empleado exista en la base de datos con los campos indicados
 * utilizando el servicio real de la aplicación (empleadosService.getById).
 */
export async function expectEmpleadoEnDb(
  id: string,
  expected: Partial<EmpleadoRow> = {}
): Promise<EmpleadoRow> {
  const { data: empleadoDb, error } = await empleadosService.getById(testClient, id);

  expect(error).toBeNull();
  expect(empleadoDb).toBeDefined();
  expect(empleadoDb).not.toBeNull();

  if (expected.nombre !== undefined) {
    expect(empleadoDb!.nombre).toBe(expected.nombre);
  }
  if (expected.apellido !== undefined) {
    expect(empleadoDb!.apellido).toBe(expected.apellido);
  }
  if (expected.dni !== undefined) {
    expect(empleadoDb!.dni).toBe(expected.dni);
  }
  if (expected.salario !== undefined) {
    expect(Number(empleadoDb!.salario)).toBe(expected.salario);
  }
  if (expected.taller_id !== undefined) {
    expect(empleadoDb!.taller_id).toBe(expected.taller_id);
  }
  if (expected.fecha_ingreso !== undefined) {
    expect(empleadoDb!.fecha_ingreso).toBe(expected.fecha_ingreso);
  }
  if (expected.email !== undefined) {
    expect(empleadoDb!.email).toBe(expected.email);
  }
  if (expected.telefono !== undefined) {
    expect(empleadoDb!.telefono).toBe(expected.telefono);
  }

  return empleadoDb!;
}

/**
 * Assertion: Verifica las filas de historial salarial utilizando el servicio real
 * de la aplicación (empleadosService.getSalarioHistory).
 */
export async function expectHistorialSalarial(
  empleadoId: string,
  expected: Array<{ salario: number; vigente_desde: string }>
): Promise<SalarioHistorialRow[]> {
  const { data: salariosDb, error } = await empleadosService.getSalarioHistory(
    testClient,
    empleadoId
  );

  expect(error).toBeNull();
  expect(salariosDb).toHaveLength(expected.length);

  const sortedActual = [...salariosDb].sort((a, b) =>
    a.vigente_desde.localeCompare(b.vigente_desde)
  );
  const sortedExpected = [...expected].sort((a, b) =>
    a.vigente_desde.localeCompare(b.vigente_desde)
  );

  sortedExpected.forEach((exp, idx) => {
    expect(Number(sortedActual[idx].salario)).toBe(exp.salario);
    expect(sortedActual[idx].vigente_desde).toBe(exp.vigente_desde);
  });

  return salariosDb;
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
