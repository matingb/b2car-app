import { describe, expect, it } from "vitest";
import { createAdminTestClient, createTestClient, SEED } from "@/tests/integration";

describe("Cierre de esquema y permisos (Etapa 10)", () => {
  it("Venta sin cliente: se rechaza la creación de una venta sin registro en operaciones_venta", async () => {
    const admin = createAdminTestClient();
    const { error } = await admin.from("operaciones").insert({
      tenant_id: SEED.tenantId,
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      monto_total: 1500,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/operaciones_venta/i);
  });

  it("Transferencia a la misma cuenta: se rechaza transferencia donde cuenta_origen es igual a cuenta_destino", async () => {
    const client = createTestClient();
    const { error } = await client.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "TRANSFERENCIA",
      p_cuenta_id: SEED.cuentaId,
      p_cuenta_origen_id: SEED.cuentaId,
      p_cuenta_destino_id: SEED.cuentaId,
      p_importe: 500,
      p_fecha: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/distintas/i);
  });

  it("Gasto con líneas de mercadería: se rechaza si un gasto intenta tener líneas de mercadería", async () => {
    const client = createTestClient();
    const { data: gastoId, error: gastoErr } = await client.rpc("rpc_crear_operacion_gasto", {
      p_monto: 250,
      p_categoria_gasto: "OTROS",
      p_observaciones: "Lavandina",
    });

    expect(gastoErr).toBeNull();
    expect(gastoId).toBeDefined();

    const admin = createAdminTestClient();
    const { error: lineaErr } = await admin.from("operaciones_lineas").insert({
      operacion_id: gastoId,
      stock_id: SEED.stockAceite.id,
      cantidad: 1,
      monto_unitario: 250,
      sentido: -1,
    });

    expect(lineaErr).not.toBeNull();
    expect(lineaErr?.message).toMatch(/no puede tener líneas de mercadería/i);
  });

  it("CHECK tipo no MOVIMIENTO_CUENTA: se rechaza cualquier inserción con el tipo obsoleto", async () => {
    const admin = createAdminTestClient();
    const { error } = await admin.from("operaciones").insert({
      tenant_id: SEED.tenantId,
      tipo: "MOVIMIENTO_CUENTA",
      monto_total: 100,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/operaciones_tipo_no_movimiento_cuenta/i);
  });

  it("Escritura directa del ledger: usuario autenticado no puede insertar en movimientos_financieros", async () => {
    const client = createTestClient();
    const { error } = await client.from("movimientos_financieros").insert({
      tenant_id: SEED.tenantId,
      cuenta_financiera_id: SEED.cuentaId,
      importe: 1000,
      fecha: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("Escritura directa del kardex: usuario autenticado no puede insertar en movimientos_stock", async () => {
    const client = createTestClient();
    const { error } = await client.from("movimientos_stock").insert({
      tenant_id: SEED.tenantId,
      taller_id: SEED.tallerId,
      producto_id: SEED.stockAceite.productoId,
      stock_id: SEED.stockAceite.id,
      tipo_movimiento: "AJUSTE",
      cantidad: 5,
      saldo_anterior: 200,
      saldo_posterior: 205,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("Escritura directa de la cantidad: no se puede modificar a mano la cantidad de un stock", async () => {
    const client = createTestClient();
    const { error } = await client
      .from("stocks")
      .update({ cantidad: 999 })
      .eq("id", SEED.stockAceite.id);

    expect(error).not.toBeNull();
    // PostgREST blocks direct quantity mutation (masked as 500 "Something went wrong" or code 55000)
    expect(error?.message === "Something went wrong" || error?.code === "55000").toBe(true);
  });

  it("Editar el stock mínimo: se puede modificar el stock mínimo sin afectar el kardex", async () => {
    const client = createTestClient();
    const { error } = await client
      .from("stocks")
      .update({ stock_minimo: 15 })
      .eq("id", SEED.stockAceite.id);

    expect(error).toBeNull();
  });
});
