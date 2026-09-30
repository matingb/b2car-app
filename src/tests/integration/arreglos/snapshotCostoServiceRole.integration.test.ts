import { randomUUID } from "crypto";
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminTestClient, createTestClient, SEED } from "@/tests/integration";

// Empleado del seed en SEED.tallerId con valor_hora = 12000.
const EMPLEADO_ID = "e1000000-0000-0000-0000-000000000001";
const EMPLEADO_VALOR_HORA = 12000;

const adminClient = createAdminTestClient();

async function dadoUnArregloDeMigracion(): Promise<string> {
  const { data, error } = await adminClient
    .from("arreglos")
    .insert({
      tenant_id: SEED.tenantId,
      taller_id: SEED.tallerId,
      vehiculo_id: SEED.vehiculoId,
      cliente_id: SEED.clienteId,
      estado: "TERMINADO",
      descripcion: "Arreglo historico migrado",
      fecha: "2014-08-22T11:32:53-03:00",
      precio_final: 0,
      precio_sin_iva: 0,
      total_cobrado: 0,
      es_facturable: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`dadoUnArregloDeMigracion falló: ${error?.message ?? "sin respuesta"}`);
  }
  return data.id;
}

async function cuandoSeInsertaUnDetalle(
  client: SupabaseClient,
  arregloId: string,
  overrides: { empleado_id: string | null; valor_hora_empleado: number | null }
): Promise<string> {
  const id = randomUUID();
  const { error } = await client.from("detalle_arreglo").insert({
    id,
    tenant_id: SEED.tenantId,
    arreglo_id: arregloId,
    descripcion: "Tarea historica",
    cantidad: 1,
    horas_facturadas: 2,
    horas_trabajadas: 2,
    precio_hora_facturada: 10000,
    ...overrides,
  });

  if (error) {
    throw new Error(`cuandoSeInsertaUnDetalle falló: ${error.message}`);
  }
  return id;
}

async function expectValorHoraEmpleado(detalleId: string, esperado: number | null) {
  const { data, error } = await adminClient
    .from("detalle_arreglo")
    .select("valor_hora_empleado")
    .eq("id", detalleId)
    .single();

  expect(error).toBeNull();
  expect(data?.valor_hora_empleado === null ? null : Number(data?.valor_hora_empleado)).toBe(
    esperado
  );
}

describe("Integration: snapshot de costo hora con service_role (B2C-188)", () => {
  it("conserva el valor_hora_empleado explícito enviado por service_role", async () => {
    const arregloId = await dadoUnArregloDeMigracion();

    const detalleId = await cuandoSeInsertaUnDetalle(adminClient, arregloId, {
      empleado_id: EMPLEADO_ID,
      valor_hora_empleado: 8000,
    });

    await expectValorHoraEmpleado(detalleId, 8000);
  });

  it("conserva el NULL explícito como costo histórico desconocido", async () => {
    const arregloId = await dadoUnArregloDeMigracion();

    const detalleId = await cuandoSeInsertaUnDetalle(adminClient, arregloId, {
      empleado_id: EMPLEADO_ID,
      valor_hora_empleado: null,
    });

    await expectValorHoraEmpleado(detalleId, null);
  });

  it("conserva el costo explícito de una tarea sin empleado", async () => {
    const arregloId = await dadoUnArregloDeMigracion();

    const detalleId = await cuandoSeInsertaUnDetalle(adminClient, arregloId, {
      empleado_id: null,
      valor_hora_empleado: 5000,
    });

    await expectValorHoraEmpleado(detalleId, 5000);
  });

  it("sigue reemplazando el costo por el valor hora actual para authenticated sin empleados:edit", async () => {
    const arregloId = await dadoUnArregloDeMigracion();
    const operativoClient = createTestClient({ userRole: "operativo", planSub: "PRO" });

    const detalleId = await cuandoSeInsertaUnDetalle(operativoClient, arregloId, {
      empleado_id: EMPLEADO_ID,
      valor_hora_empleado: 8000,
    });

    await expectValorHoraEmpleado(detalleId, EMPLEADO_VALOR_HORA);
  });
});
