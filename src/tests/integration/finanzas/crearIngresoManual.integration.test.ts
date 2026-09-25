import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as crearIngresoRoute } from "@/app/api/cuentas-financieras/ingresos/route";
import { DELETE as eliminarOperacionRoute } from "@/app/api/operaciones/[id]/route";
import { testClient, createTestClient } from "@/tests/integration";
import { dadoUnaCuentaFinanciera, expectSaldoCuenta } from "../helpers/integrationFixtures";

describe("Integration (Route): ingreso manual de cuenta financiera", () => {
  it("acredita una sola vez, aísla tenant, rechaza cuentas inactivas y revierte al borrar", async () => {
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 100 });
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      cuentaId: cuenta.id,
      importe: 250.5,
      fecha: "2026-09-24T23:55:00-03:00",
      descripcion: "Aporte de capital",
      idempotencyKey,
    };
    const postIngreso = () => crearIngresoRoute(new Request("http://localhost/api/cuentas-financieras/ingresos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));

    const firstResponse = await postIngreso();
    const firstBody = await firstResponse.json();
    expect(firstResponse.status).toBe(201);
    const operacionId = firstBody.data.id as string;

    const { data: operacion, error: operacionError } = await testClient
      .from("operaciones")
      .select("tipo, taller_id")
      .eq("id", operacionId)
      .single();
    expect(operacionError).toBeNull();
    expect(operacion).toEqual({ tipo: "MOVIMIENTO_CUENTA", taller_id: null });

    const { data: movimientoCuenta, error: movimientoCuentaError } = await testClient
      .from("operaciones_movimiento_cuenta")
      .select("subtipo, cuenta_id, importe, descripcion, cuenta_origen_id, cuenta_destino_id, categoria_gasto")
      .eq("operacion_id", operacionId)
      .single();
    expect(movimientoCuentaError).toBeNull();
    expect(movimientoCuenta).toMatchObject({
      subtipo: "INGRESO",
      cuenta_id: cuenta.id,
      importe: 250.5,
      descripcion: "Aporte de capital",
      cuenta_origen_id: null,
      cuenta_destino_id: null,
      categoria_gasto: null,
    });

    const { data: asiento, error: asientoError } = await testClient
      .from("movimientos_financieros")
      .select("importe")
      .eq("operacion_id", operacionId);
    expect(asientoError).toBeNull();
    expect(asiento).toHaveLength(1);
    expect(Number(asiento?.[0]?.importe)).toBe(250.5);
    await expectSaldoCuenta(cuenta.id, 350.5);

    const duplicateResponse = await postIngreso();
    const duplicateBody = await duplicateResponse.json();
    expect(duplicateResponse.status).toBe(201);
    expect(duplicateBody.data.id).toBe(operacionId);
    await expectSaldoCuenta(cuenta.id, 350.5);

    const operativoClient = createTestClient({ userRole: "operativo" });
    const { error: unauthorizedError } = await operativoClient.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_cuenta_id: cuenta.id,
      p_importe: 75,
      p_fecha: payload.fecha,
      p_descripcion: "Ingreso sin permiso financiero",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(unauthorizedError?.code).toBe("42501");
    await expectSaldoCuenta(cuenta.id, 350.5);

    const { error: missingDescriptionError } = await testClient.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_cuenta_id: cuenta.id,
      p_importe: 75,
      p_fecha: payload.fecha,
      p_descripcion: "   ",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(missingDescriptionError?.code).toBe("23514");
    await expectSaldoCuenta(cuenta.id, 350.5);

    const otherTenant = createTestClient({ tenantId: "99999999-9999-4999-8999-999999999999" });
    const { error: foreignTenantError } = await otherTenant.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_cuenta_id: cuenta.id,
      p_importe: 50,
      p_fecha: payload.fecha,
      p_descripcion: "No debe acreditarse",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(foreignTenantError?.code).toBe("P0002");
    await expectSaldoCuenta(cuenta.id, 350.5);

    const deleteRequest = new NextRequest(`http://localhost/api/operaciones/${operacionId}`, {
      method: "DELETE",
      headers: { "X-Idempotency-Key": crypto.randomUUID() },
    });
    const deleteResponse = await eliminarOperacionRoute(deleteRequest, {
      params: Promise.resolve({ id: operacionId }),
    });
    expect(deleteResponse.status).toBe(200);
    await expectSaldoCuenta(cuenta.id, 100);
    const { data: ledgerAfterDelete, error: ledgerAfterDeleteError } = await testClient
      .from("movimientos_financieros")
      .select("importe")
      .eq("cuenta_financiera_id", cuenta.id);
    expect(ledgerAfterDeleteError).toBeNull();
    expect(ledgerAfterDelete?.map((entry) => Number(entry.importe))).toContain(-250.5);
    expect(ledgerAfterDelete?.reduce((total, entry) => total + Number(entry.importe), 0)).toBe(100);

    const { error: deactivateError } = await testClient.rpc("rpc_finanzas_actualizar_cuenta", {
      p_cuenta_id: cuenta.id,
      p_activo: false,
    });
    expect(deactivateError).toBeNull();
    const inactiveResponse = await postIngreso();
    expect(inactiveResponse.status).toBe(400);
    await expectSaldoCuenta(cuenta.id, 100);
  });
});
