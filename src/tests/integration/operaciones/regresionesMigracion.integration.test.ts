import { describe, expect, it } from "vitest";
import { createAdminTestClient, createTestClient, SEED } from "@/tests/integration";

describe("Regresiones del rediseño de operaciones", () => {
  it.each(["VENTA", "COMPRA"])("crea %s sin contraparte y con su hija obligatoria", async (tipo) => {
    const client = createTestClient();
    const { data: id, error } = await client.rpc("rpc_crear_operacion_con_stock", {
      p_tipo: tipo, p_taller_id: SEED.tallerId, p_estado_pago: "PENDIENTE", p_mover_stock: false,
      p_lineas: [{ stock_id: SEED.stockAceite.id, cantidad: 1, monto_unitario: 100 }],
    });
    expect(error).toBeNull();
    const tabla = tipo === "VENTA" ? "operaciones_venta" : "operaciones_compra";
    const campo = tipo === "VENTA" ? "cliente_id" : "proveedor_id";
    const { data, error: readError } = await client.from(tabla).select(campo).eq("operacion_id", id).single();
    expect(readError).toBeNull();
    expect(data).toEqual({ [campo]: null });
  });

  it.each(["operaciones", "operaciones_movimiento_cuenta", "operaciones_movimiento_stock"])("rechaza escritura directa de %s", async (tabla) => {
    const { error } = await createTestClient().from(tabla).insert({ tenant_id: SEED.tenantId });
    expect(error?.code).toBe("42501");
  });

  it("aplica permisos dentro de la RPC aunque tenga SECURITY DEFINER", async () => {
    const { error } = await createTestClient({ userRole: "sin_permisos" }).rpc("rpc_crear_operacion_gasto", {
      p_monto: 100, p_categoria_gasto: "OTROS",
    });
    expect(error?.code).toBe("42501");
    const { error: helperError } = await createTestClient().rpc("_sync_stock_derivados", { p_stock_id: SEED.stockAceite.id });
    expect(helperError?.code).toBe("42501");
  });

  it("permite al operativo comprar un repuesto desde un arreglo sin darle operaciones:edit", async () => {
    const client = createTestClient({ userRole: "operativo" });
    const { data: arreglo } = await client.from("arreglos").select("id").eq("taller_id", SEED.tallerId).limit(1).single();
    expect(arreglo).toBeTruthy();
    const { data, error } = await client.rpc("rpc_crear_producto_inline_para_arreglo", {
      p_arreglo_id: arreglo!.id, p_taller_id: SEED.tallerId, p_codigo: `REP-${crypto.randomUUID()}`,
      p_nombre: "Repuesto", p_precio_compra: 100, p_precio_venta: 150, p_cantidad: 1,
      p_cuenta_id: SEED.cuentaId,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const { error: directError } = await client.rpc("rpc_crear_operacion_con_stock", {
      p_tipo: "COMPRA", p_taller_id: SEED.tallerId, p_lineas: [],
    });
    expect(directError?.code).toBe("42501");
  });

  it("rechaza cliente y proveedor de otro tenant y no deja documentos incompletos", async () => {
    const admin = createAdminTestClient();
    const tenant = crypto.randomUUID();
    const cliente = crypto.randomUUID();
    const proveedor = crypto.randomUUID();
    expect((await admin.from("tenants").insert({ id: tenant, nombre: "Otro tenant" })).error).toBeNull();
    expect((await admin.from("clientes").insert({ id: cliente, tenant_id: tenant })).error).toBeNull();
    expect((await admin.from("proveedores").insert({ id: proveedor, tenant_id: tenant, nombre: "Proveedor" })).error).toBeNull();
    const client = createTestClient();
    for (const tipo of ["VENTA", "COMPRA"]) {
      const { error } = await client.rpc("rpc_crear_operacion_con_stock", {
        p_tipo: tipo, p_taller_id: SEED.tallerId, p_lineas: [],
        p_cliente_id: tipo === "VENTA" ? cliente : null,
        p_proveedor_id: tipo === "COMPRA" ? proveedor : null,
      });
      expect(error?.code).toBe("22023");
    }
  });

  it("preserva un único pago parcial al editar la descripción de un gasto", async () => {
    const client = createTestClient();
    const { data: id, error } = await client.rpc("rpc_crear_operacion_gasto", {
      p_monto: 100, p_categoria_gasto: "OTROS", p_estado_pago: "PARCIAL",
      p_cuenta_id: SEED.cuentaId, p_monto_inicial: 40,
    });
    expect(error).toBeNull();
    expect((await client.rpc("rpc_actualizar_movimiento_cuenta", { p_operacion_id: id, p_descripcion: "Nueva descripción" })).error).toBeNull();
    const { error: amountError } = await client.rpc("rpc_actualizar_movimiento_cuenta", { p_operacion_id: id, p_importe: 200 });
    expect(amountError?.code).toBe("22023");
    const { error: accountError } = await client.rpc("rpc_actualizar_movimiento_cuenta", {
      p_operacion_id: id, p_cuenta_id: "c0000000-0000-4000-8000-000000000002",
    });
    expect(accountError?.code).toBe("22023");
    const { data } = await client.from("operaciones").select("monto_total,total_pagado").eq("id", id).single();
    expect(data).toEqual({ monto_total: 100, total_pagado: 40 });
  });

  it("permite múltiples ventas diferidas aun cuando superan el stock disponible", async () => {
    const client = createTestClient();
    const { data: inicial } = await client.from("stocks").select("cantidad,cantidad_reservada,cantidad_disponible").eq("id", SEED.stockAceite.id).single();
    expect(inicial?.cantidad_disponible).toBeGreaterThan(1);
    const cantidad = Math.floor(inicial!.cantidad_disponible / 2) + 1;
    const crear = () => client.rpc("rpc_crear_operacion_con_stock", {
      p_tipo: "VENTA", p_taller_id: SEED.tallerId, p_mover_stock: false, p_estado_pago: "PENDIENTE",
      p_lineas: [{ stock_id: SEED.stockAceite.id, cantidad, monto_unitario: 100 }],
    });
    const results = await Promise.all([crear(), crear()]);
    expect(results.filter((r) => !r.error)).toHaveLength(2);
    const { data: final } = await client.from("stocks").select("cantidad,cantidad_reservada").eq("id", SEED.stockAceite.id).single();
    expect(final).toEqual({ cantidad: inicial!.cantidad, cantidad_reservada: inicial!.cantidad_reservada + cantidad * 2 });
  });
});
