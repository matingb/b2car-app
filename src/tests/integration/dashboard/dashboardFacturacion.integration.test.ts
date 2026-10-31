import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { dadoUnArreglo } from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import {
  asignarRepuestoViaRoute,
  borrarArregloViaRoute,
  eliminarDetalleArregloViaRoute,
  eliminarRepuestoLineaViaRoute,
} from "../helpers/routeDrivers";
import {
  dadaUnaCategoria,
  dadoUnDetalleFacturado,
  dadoUnEmpleado,
  normalizarFilasDesglose,
} from "./dashboardHelpers";
import { createAdminTestClient, SEED, testClient } from "@/tests/integration";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { GET as getDashboardStats } from "@/app/api/dashboard/stats/route";

const FECHA = "2042-03-15T12:00:00-03:00";
const FROM = "2042-03-01T03:00:00.000Z";
const TO = "2042-04-01T03:00:00.000Z"; // fin exclusivo

// ─── Given ───────────────────────────────────────────────────────────────────

const dadoUnArregloDeMarzo = (estado: "EN_PROGRESO" | "PRESUPUESTO" = "EN_PROGRESO") =>
  dadoUnArreglo({ fecha: FECHA, estado });

/** Asigna un repuesto al arreglo y devuelve el id de su línea (para poder quitarlo). */
async function dadoUnRepuestoAsignado(
  arregloId: string,
  options: { monto: number; cantidad?: number; categoriaId?: string; empleadoId?: string }
): Promise<string> {
  const { stockId } = await dadoQueExisteUnProductoConStock({
    producto: { precio_unitario: options.monto },
    stock: { cantidad: 10 },
  });
  const res = await asignarRepuestoViaRoute(arregloId, {
    taller_id: SEED.tallerId,
    stock_id: stockId,
    cantidad: options.cantidad ?? 1,
    monto_unitario: options.monto,
    categoria_arreglo_id: options.categoriaId,
    empleado_id: options.empleadoId,
  });
  const body = (await res.json()) as { data?: { operacion_id?: string }; error?: string };
  if (res.status !== 200 || !body.data?.operacion_id) {
    throw new Error(`No se pudo asignar el repuesto: ${body.error ?? res.statusText}`);
  }
  const { data: linea, error } = await createAdminTestClient()
    .from("operaciones_lineas")
    .select("id")
    .eq("operacion_id", body.data.operacion_id)
    .single();
  if (error || !linea) throw new Error(`No se encontró la línea del repuesto: ${error?.message}`);
  return linea.id;
}

async function dadoUnArregloDeOtroTenant(): Promise<void> {
  const admin = createAdminTestClient();
  const tenantId = randomUUID();
  const arregloId = randomUUID();
  const { error: tenantError } = await admin.from("tenants").insert({ id: tenantId, nombre: "Otro tenant" });
  if (tenantError) throw new Error(tenantError.message);
  const { error: arregloError } = await admin.from("arreglos").insert({
    id: arregloId,
    tenant_id: tenantId,
    vehiculo_id: SEED.vehiculoId,
    fecha: FECHA,
    numero_orden: 1,
  });
  if (arregloError) throw new Error(arregloError.message);
  const { error: detalleError } = await admin.from("detalle_arreglo").insert({
    tenant_id: tenantId,
    arreglo_id: arregloId,
    descripcion: "Detalle de otro tenant",
    cantidad: 1,
    precio_hora_facturada: 12000,
    horas_facturadas: 1,
  });
  if (detalleError) throw new Error(detalleError.message);
}

// ─── When ────────────────────────────────────────────────────────────────────

const facturacionPorCategoria = () => arregloService.facturacionPorTipo(testClient, FROM, TO);
const facturacionPorEmpleado = () => arregloService.facturacionPorEmpleado(testClient, FROM, TO);

describe("Integration: dashboard - facturación por categoría", () => {
  it("suma los detalles de una categoría y cuenta el arreglo una sola vez", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 5000 });

    expect(await facturacionPorCategoria()).toEqual([{ label: "Mecánica", cantidad: 1, monto: 15000 }]);
  });

  it("multiplica el importe del detalle por cantidad y horas facturadas", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, {
      categoriaId: mecanica,
      cantidad: 2,
      horasFacturadas: 1.5,
      precioHoraFacturada: 10000,
    });

    expect(await facturacionPorCategoria()).toEqual([{ label: "Mecánica", cantidad: 1, monto: 30000 }]);
  });

  it("cuenta el mismo arreglo en cada una de sus categorías", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const electricidad = await dadaUnaCategoria("Electricidad");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: electricidad, precioHoraFacturada: 2500 });

    expect(await facturacionPorCategoria()).toEqual([
      { label: "Mecánica", cantidad: 1, monto: 10000 },
      { label: "Electricidad", cantidad: 1, monto: 2500 },
    ]);
  });

  it("suma la misma categoría de arreglos distintos", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    for (const precio of [10000, 8000]) {
      const arreglo = await dadoUnArregloDeMarzo();
      await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: precio });
    }

    expect(await facturacionPorCategoria()).toEqual([{ label: "Mecánica", cantidad: 2, monto: 18000 }]);
  });

  it("agrupa los detalles sin categoría en 'Sin categoría'", async () => {
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { precioHoraFacturada: 8000 });

    expect(await facturacionPorCategoria()).toEqual([{ label: "Sin categoría", cantidad: 1, monto: 8000 }]);
  });

  it("incluye el repuesto asignado en la categoría que se le indicó", async () => {
    const frenos = await dadaUnaCategoria("Frenos");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnRepuestoAsignado(arreglo.id, { monto: 2000, cantidad: 2, categoriaId: frenos });

    expect(await facturacionPorCategoria()).toEqual([{ label: "Frenos", cantidad: 1, monto: 4000 }]);
  });

  it("cuenta una sola vez 'Sin categoría' si el arreglo tiene detalles y formulario personalizado", async () => {
    const arreglo = await dadoUnArreglo({ fecha: FECHA, tasa_iva: 0.21 });
    await dadoUnDetalleFacturado(arreglo.id, { precioHoraFacturada: 1000 });
    await dadoUnDetalleFacturado(arreglo.id, { precioHoraFacturada: 2000 });
    const { error } = await createAdminTestClient()
      .from("detalle_form_custom")
      .insert({ tenant_id: SEED.tenantId, arreglo_id: arreglo.id, costo: 3000 });
    if (error) throw new Error(`No se pudo crear el formulario personalizado: ${error.message}`);

    expect(await facturacionPorCategoria()).toEqual([{ label: "Sin categoría", cantidad: 1, monto: 6000 }]);
    expect(await facturacionPorEmpleado()).toEqual([{ label: "Sin empleado", cantidad: 1, monto: 6000 }]);
  });

  it("excluye los presupuestos", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const presupuesto = await dadoUnArregloDeMarzo("PRESUPUESTO");
    await dadoUnDetalleFacturado(presupuesto.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });

    expect(await facturacionPorCategoria()).toEqual([]);
  });

  it("excluye los arreglos que caen en el límite final (exclusivo) del período", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const arreglo = await dadoUnArreglo({ fecha: TO });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });

    expect(await facturacionPorCategoria()).toEqual([]);
  });

  it("excluye los arreglos de otro tenant", async () => {
    await dadoUnArregloDeOtroTenant();

    expect(await facturacionPorCategoria()).toEqual([]);
  });

  it("con top 1, agrupa el resto de las categorías en 'Otros'", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const electricidad = await dadaUnaCategoria("Electricidad");
    const frenos = await dadaUnaCategoria("Frenos");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: electricidad, precioHoraFacturada: 3000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: frenos, precioHoraFacturada: 2000 });

    const { data, error } = await testClient.rpc("dashboard_facturacion_por_categoria", {
      top: 1,
      p_from: FROM,
      p_to: TO,
      p_taller_id: null,
    });

    expect(error).toBeNull();
    expect(normalizarFilasDesglose(data)).toEqual([
      { label: "Mecánica", cantidad: 1, monto: 10000 },
      { label: "Otros", cantidad: 2, monto: 5000 },
    ]);
  });

  it("el servicio de estadísticas y la ruta HTTP devuelven el mismo desglose", async () => {
    const mecanica = await dadaUnaCategoria("Mecánica");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: mecanica, precioHoraFacturada: 10000 });
    const esperado = [{ label: "Mecánica", cantidad: 1, monto: 10000 }];

    const stats = await statsService.getStats(testClient, FROM, TO, SEED.tenantId);
    const response = await getDashboardStats(
      new Request(`http://localhost/api/dashboard/stats?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`)
    );
    const body = (await response.json()) as { data?: { facturacionPorTipo?: unknown } };

    expect(stats.facturacionPorTipo).toEqual(esperado);
    expect(response.status).toBe(200);
    expect(body.data?.facturacionPorTipo).toEqual(esperado);
  });
});

describe("Integration: dashboard - facturación por empleado", () => {
  it("suma los detalles de cada empleado y cuenta el arreglo una vez por empleado", async () => {
    const ana = await dadoUnEmpleado("Ana", "Test");
    const bruno = await dadoUnEmpleado("Bruno", "Test");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { empleadoId: ana, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { empleadoId: ana, precioHoraFacturada: 5000 });
    await dadoUnDetalleFacturado(arreglo.id, { empleadoId: bruno, precioHoraFacturada: 7000 });

    expect(await facturacionPorEmpleado()).toEqual([
      { label: "Ana Test", cantidad: 1, monto: 15000 },
      { label: "Bruno Test", cantidad: 1, monto: 7000 },
    ]);
  });

  it("agrupa los detalles sin empleado en 'Sin empleado'", async () => {
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { precioHoraFacturada: 4000 });

    expect(await facturacionPorEmpleado()).toEqual([{ label: "Sin empleado", cantidad: 1, monto: 4000 }]);
  });

  it("atribuye el repuesto asignado al empleado que se le indicó", async () => {
    const bruno = await dadoUnEmpleado("Bruno", "Test");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnRepuestoAsignado(arreglo.id, { monto: 2000, cantidad: 2, empleadoId: bruno });

    expect(await facturacionPorEmpleado()).toEqual([{ label: "Bruno Test", cantidad: 1, monto: 4000 }]);
  });

  it("con top 1, agrupa el resto de los empleados en 'Otros'", async () => {
    const ana = await dadoUnEmpleado("Ana", "Test");
    const bruno = await dadoUnEmpleado("Bruno", "Test");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { empleadoId: ana, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { empleadoId: bruno, precioHoraFacturada: 3000 });

    const { data, error } = await testClient.rpc("dashboard_facturacion_por_empleado", {
      top: 1,
      p_from: FROM,
      p_to: TO,
      p_taller_id: null,
    });

    expect(error).toBeNull();
    expect(normalizarFilasDesglose(data)).toEqual([
      { label: "Ana Test", cantidad: 1, monto: 10000 },
      { label: "Otros", cantidad: 1, monto: 3000 },
    ]);
  });
});

describe("Integration: dashboard - reversión de la facturación", () => {
  it("al cambiar la categoría de un detalle, mueve su importe a la nueva categoría", async () => {
    const alineacion = await dadaUnaCategoria("Alineación");
    const frenos = await dadaUnaCategoria("Frenos");
    const arreglo = await dadoUnArregloDeMarzo();
    const detalle = await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 5000 });

    const { error } = await createAdminTestClient()
      .from("detalle_arreglo")
      .update({ categoria_arreglo_id: frenos })
      .eq("id", detalle);
    expect(error).toBeNull();

    expect(await facturacionPorCategoria()).toEqual([
      { label: "Frenos", cantidad: 1, monto: 10000 },
      { label: "Alineación", cantidad: 1, monto: 5000 },
    ]);
  });

  it("al eliminar un detalle, resta su importe pero conserva la categoría si queda otro detalle", async () => {
    const alineacion = await dadaUnaCategoria("Alineación");
    const arreglo = await dadoUnArregloDeMarzo();
    const detalle = await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 5000 });

    const res = await eliminarDetalleArregloViaRoute(arreglo.id, detalle);

    expect(res.status).toBe(200);
    expect(await facturacionPorCategoria()).toEqual([{ label: "Alineación", cantidad: 1, monto: 5000 }]);
  });

  it("al eliminar el último detalle de una categoría, la categoría desaparece del desglose", async () => {
    const alineacion = await dadaUnaCategoria("Alineación");
    const frenos = await dadaUnaCategoria("Frenos");
    const arreglo = await dadoUnArregloDeMarzo();
    const detalleAlineacion = await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 10000 });
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: frenos, precioHoraFacturada: 7000 });

    await eliminarDetalleArregloViaRoute(arreglo.id, detalleAlineacion);

    expect(await facturacionPorCategoria()).toEqual([{ label: "Frenos", cantidad: 1, monto: 7000 }]);
    expect(await facturacionPorEmpleado()).toEqual([{ label: "Sin empleado", cantidad: 1, monto: 7000 }]);
  });

  it("al quitar el repuesto, resta su importe de la categoría y del empleado", async () => {
    const alineacion = await dadaUnaCategoria("Alineación");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, precioHoraFacturada: 8000 });
    const lineaRepuesto = await dadoUnRepuestoAsignado(arreglo.id, { monto: 3000, categoriaId: alineacion });
    expect(await facturacionPorCategoria()).toEqual([{ label: "Alineación", cantidad: 1, monto: 11000 }]);

    const res = await eliminarRepuestoLineaViaRoute(arreglo.id, lineaRepuesto);

    expect(res.status).toBe(200);
    expect(await facturacionPorCategoria()).toEqual([{ label: "Alineación", cantidad: 1, monto: 8000 }]);
  });

  it("al borrar el arreglo, deja de figurar en ambos desgloses", async () => {
    const alineacion = await dadaUnaCategoria("Alineación");
    const ana = await dadoUnEmpleado("Ana", "Test");
    const arreglo = await dadoUnArregloDeMarzo();
    await dadoUnDetalleFacturado(arreglo.id, { categoriaId: alineacion, empleadoId: ana, precioHoraFacturada: 10000 });

    const res = await borrarArregloViaRoute(arreglo.id);

    expect(res.status).toBe(200);
    expect(await facturacionPorCategoria()).toEqual([]);
    expect(await facturacionPorEmpleado()).toEqual([]);
  });
});
