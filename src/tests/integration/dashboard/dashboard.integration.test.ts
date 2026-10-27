import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { dadoUnArreglo, dadoUnArregloConRepuesto } from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import { asignarRepuestoViaRoute, eliminarRepuestoLineaViaRoute } from "../helpers/routeDrivers";
import {
  clientesNuevosPorDia,
  cuandoSeConsultaElDashboard,
  cuandoSeConsultaElPeriodo,
  dadaUnaCompra,
  dadaUnaManoDeObra,
  dadaUnaVenta,
  dadoUnClienteCreadoEl,
  dadoUnGasto,
  dadoUnSueldo,
  dadoUnaCuentaConSaldo,
  diasConDatos,
  fechasConDatos,
} from "./dashboardHelpers";
import { createAdminTestClient, SEED, testClient } from "@/tests/integration";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { GET as getDashboardStats } from "@/app/api/dashboard/stats/route";

async function crearEmpleadoDashboard(nombre: string, apellido: string) {
  const admin = createAdminTestClient();
  const id = randomUUID();
  const { error } = await admin.from("empleados").insert({
    id,
    tenant_id: SEED.tenantId,
    taller_id: SEED.tallerId,
    nombre,
    apellido,
    dni: `DASH-${id}`,
  });
  if (error) throw new Error(`crearEmpleadoDashboard falló: ${error.message}`);
  return id;
}

async function agregarDetalleHoras(
  arregloId: string,
  options: {
    empleadoId?: string | null;
    horasTrabajadas: number | null;
    horasFacturadas?: number | null;
    cantidad?: number;
    tenantId?: string;
  }
) {
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
  if (error) throw new Error(`agregarDetalleHoras falló: ${error.message}`);

  if (options.horasTrabajadas === null) {
    // El trigger convierte NULL a 1 al insertar; solo una actualización puede crear este histórico.
    const { error: updateError } = await testClient
      .from("detalle_arreglo")
      .update({ horas_trabajadas: null })
      .eq("id", detalle.id);
    if (updateError) throw new Error(`No se pudo preparar horas históricas desconocidas: ${updateError.message}`);
  }
}

async function agregarDetalleFacturacionDashboard(
  arregloId: string,
  options: {
    categoriaId?: string | null;
    empleadoId?: string | null;
    cantidad: number;
    horasFacturadas: number;
    precioHoraFacturada: number;
  }
) {
  const { data: detalle, error } = await testClient.from("detalle_arreglo").insert({
    tenant_id: SEED.tenantId,
    arreglo_id: arregloId,
    descripcion: "Detalle de facturación B2C-222",
    cantidad: options.cantidad,
    precio_hora_facturada: options.precioHoraFacturada,
    horas_facturadas: options.horasFacturadas,
    horas_trabajadas: 1,
    categoria_arreglo_id: options.categoriaId ?? null,
    empleado_id: options.empleadoId ?? null,
  }).select("id").single();
  if (error || !detalle) throw new Error(`agregarDetalleFacturacionDashboard falló: ${error?.message ?? "sin respuesta"}`);
  return detalle.id;
}

function normalizarFilasDesglose(data: unknown) {
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = item as { label?: unknown; cantidad?: unknown; monto?: unknown };
    return {
      label: String(row.label ?? ""),
      cantidad: Number(row.cantidad ?? 0),
      monto: Number(row.monto ?? 0),
    };
  });
}

describe("Integration: dashboard", () => {
  it("cuenta cada arreglo una vez por categoría y conserva importes y cantidades por empleado", async () => {
    const suffix = randomUUID().slice(0, 8);
    const nombreMecanica = `Mecánica ${suffix}`;
    const nombreElectricidad = `Electricidad ${suffix}`;
    const empleadoAna = await crearEmpleadoDashboard("Ana", suffix);
    const empleadoBruno = await crearEmpleadoDashboard("Bruno", suffix);
    const categoriaMecanica = randomUUID();
    const categoriaElectricidad = randomUUID();
    const { error: categoriasError } = await createAdminTestClient()
      .from("categorias_arreglo")
      .insert([
        { id: categoriaMecanica, tenant_id: SEED.tenantId, nombre: nombreMecanica },
        { id: categoriaElectricidad, tenant_id: SEED.tenantId, nombre: nombreElectricidad },
      ]);
    if (categoriasError) throw new Error(`No se pudieron crear categorías del dashboard: ${categoriasError.message}`);

    const fecha = "2042-03-15T12:00:00-03:00";
    const arreglo = await dadoUnArreglo({
      fecha,
      estado: "EN_PROGRESO",
      precio_final: 44000,
      precio_sin_iva: 44000,
    });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      categoriaId: categoriaMecanica,
      empleadoId: empleadoAna,
      cantidad: 2,
      horasFacturadas: 1.5,
      precioHoraFacturada: 10000,
    });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      categoriaId: categoriaMecanica,
      empleadoId: empleadoBruno,
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 5000,
    });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      categoriaId: categoriaElectricidad,
      empleadoId: empleadoAna,
      cantidad: 1,
      horasFacturadas: 2,
      precioHoraFacturada: 2500,
    });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      cantidad: 1,
      horasFacturadas: 0,
      precioHoraFacturada: 8000,
    });

    const { stockId } = await dadoQueExisteUnProductoConStock({
      producto: { nombre: `Repuesto B2C-222 ${suffix}`, precio_unitario: 2000 },
      stock: { cantidad: 10 },
    });
    const repuestoResponse = await asignarRepuestoViaRoute(arreglo.id, {
      taller_id: SEED.tallerId,
      stock_id: stockId,
      cantidad: 2,
      monto_unitario: 2000,
      categoria_arreglo_id: categoriaElectricidad,
      empleado_id: empleadoBruno,
    });
    const repuestoBody = await repuestoResponse.json() as { data?: { operacion_id?: string }; error?: string };
    if (repuestoResponse.status !== 200 || !repuestoBody.data?.operacion_id) {
      throw new Error(`No se pudo asignar el repuesto de prueba: ${repuestoBody.error ?? repuestoResponse.statusText}`);
    }

    // Estas filas deben quedar fuera: el presupuesto, el límite final exclusivo y otro tenant.
    const presupuesto = await dadoUnArreglo({ fecha: "2042-03-20T12:00:00-03:00", estado: "PRESUPUESTO" });
    await agregarDetalleFacturacionDashboard(presupuesto.id, {
      categoriaId: categoriaMecanica,
      empleadoId: empleadoAna,
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 10000,
    });
    const arregloFueraDelRango = await dadoUnArreglo({ fecha: "2042-04-01T03:00:00.000Z" });
    await agregarDetalleFacturacionDashboard(arregloFueraDelRango.id, {
      categoriaId: categoriaMecanica,
      empleadoId: empleadoAna,
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 10000,
    });
    const otroTenant = randomUUID();
    const arregloOtroTenant = randomUUID();
    const admin = createAdminTestClient();
    const { error: tenantError } = await admin.from("tenants").insert({ id: otroTenant, nombre: "Tenant B2C-222" });
    if (tenantError) throw new Error(`No se pudo crear tenant de prueba: ${tenantError.message}`);
    const { error: arregloOtroTenantError } = await admin.from("arreglos").insert({
      id: arregloOtroTenant,
      tenant_id: otroTenant,
      vehiculo_id: SEED.vehiculoId,
      fecha,
      numero_orden: 1,
    });
    if (arregloOtroTenantError) throw new Error(`No se pudo crear arreglo de otro tenant: ${arregloOtroTenantError.message}`);
    const { error: detalleOtroTenantError } = await admin.from("detalle_arreglo").insert({
      tenant_id: otroTenant,
      arreglo_id: arregloOtroTenant,
      descripcion: "Detalle de otro tenant",
      cantidad: 1,
      precio_hora_facturada: 12000,
      horas_facturadas: 1,
    });
    if (detalleOtroTenantError) throw new Error(`No se pudo crear detalle de otro tenant: ${detalleOtroTenantError.message}`);

    const from = "2042-03-01T03:00:00.000Z";
    const to = "2042-04-01T03:00:00.000Z";
    const facturacionCategoriaRpc = await arregloService.facturacionPorTipo(testClient, from, to);
    const facturacionEmpleadoRpc = await arregloService.facturacionPorEmpleado(testClient, from, to);
    const stats = await statsService.getStats(testClient, from, to, SEED.tenantId);
    const httpResponse = await getDashboardStats(new Request(`http://localhost/api/dashboard/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
    const httpBody = await httpResponse.json() as {
      data?: {
        facturacionPorTipo?: Array<{ label: string; cantidad: number; monto: number }>;
        facturacionPorEmpleado?: Array<{ label: string; cantidad: number; monto: number }>;
      };
    };

    const esperadoPorCategoria = [
      { label: nombreMecanica, cantidad: 1, monto: 35000 },
      { label: nombreElectricidad, cantidad: 1, monto: 9000 },
      { label: "Sin categoría", cantidad: 1, monto: 0 },
    ];
    const esperadoPorEmpleado = [
      { label: `Ana ${suffix}`, cantidad: 1, monto: 35000 },
      { label: `Bruno ${suffix}`, cantidad: 1, monto: 9000 },
      { label: "Sin empleado", cantidad: 1, monto: 0 },
    ];

    expect(facturacionCategoriaRpc).toEqual(esperadoPorCategoria);
    expect(facturacionEmpleadoRpc).toEqual(esperadoPorEmpleado);
    expect(stats.facturacionPorTipo).toEqual(esperadoPorCategoria);
    expect(stats.facturacionPorEmpleado).toEqual(esperadoPorEmpleado);
    expect(httpResponse.status).toBe(200);
    expect(httpBody.data?.facturacionPorTipo).toEqual(esperadoPorCategoria);
    expect(httpBody.data?.facturacionPorEmpleado).toEqual(esperadoPorEmpleado);
    expect(esperadoPorCategoria.reduce((total, fila) => total + fila.monto, 0)).toBe(44000);
    expect(esperadoPorEmpleado.reduce((total, fila) => total + fila.monto, 0)).toBe(44000);

    const [categoriaTop, empleadoTop] = await Promise.all([
      testClient.rpc("dashboard_facturacion_por_categoria", { top: 1, p_from: from, p_to: to, p_taller_id: null }),
      testClient.rpc("dashboard_facturacion_por_empleado", { top: 1, p_from: from, p_to: to, p_taller_id: null }),
    ]);
    expect(categoriaTop.error).toBeNull();
    expect(empleadoTop.error).toBeNull();
    expect(normalizarFilasDesglose(categoriaTop.data)).toEqual([
      { label: nombreMecanica, cantidad: 1, monto: 35000 },
      { label: "Otros", cantidad: 2, monto: 9000 },
    ]);
    expect(normalizarFilasDesglose(empleadoTop.data)).toEqual([
      { label: `Ana ${suffix}`, cantidad: 1, monto: 35000 },
      { label: "Otros", cantidad: 2, monto: 9000 },
    ]);
  });

  it("suma todos los importes, pero cuenta por arreglo y categoría en el ejemplo B2C-222", async () => {
    const suffix = randomUUID().slice(0, 8);
    const nombreAlineacion = `Alineación ${suffix}`;
    const nombreFrenos = `Frenos ${suffix}`;
    const categoriaAlineacion = randomUUID();
    const categoriaFrenos = randomUUID();
    const { error: categoriasError } = await createAdminTestClient()
      .from("categorias_arreglo")
      .insert([
        { id: categoriaAlineacion, tenant_id: SEED.tenantId, nombre: nombreAlineacion },
        { id: categoriaFrenos, tenant_id: SEED.tenantId, nombre: nombreFrenos },
      ]);
    if (categoriasError) throw new Error(`No se pudieron crear categorías B2C-222: ${categoriasError.message}`);

    const fecha = "2042-03-15T12:00:00-03:00";
    const arregloA = await dadoUnArreglo({ fecha, estado: "EN_PROGRESO" });
    const arregloB = await dadoUnArreglo({ fecha, estado: "EN_PROGRESO" });
    const detallesAlineacion: string[] = [];
    for (const importe of [10000, 10000, 5000]) {
      detallesAlineacion.push(await agregarDetalleFacturacionDashboard(arregloA.id, {
        categoriaId: categoriaAlineacion,
        cantidad: 1,
        horasFacturadas: 1,
        precioHoraFacturada: importe,
      }));
    }
    await agregarDetalleFacturacionDashboard(arregloA.id, {
      categoriaId: categoriaFrenos,
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 7000,
    });
    detallesAlineacion.push(await agregarDetalleFacturacionDashboard(arregloB.id, {
      categoriaId: categoriaAlineacion,
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 8000,
    }));

    const { stockId } = await dadoQueExisteUnProductoConStock({
      producto: { nombre: `Repuesto B2C-222 ${suffix}`, precio_unitario: 3000 },
      stock: { cantidad: 2 },
    });
    const repuestoResponse = await asignarRepuestoViaRoute(arregloA.id, {
      taller_id: SEED.tallerId,
      stock_id: stockId,
      cantidad: 1,
      monto_unitario: 3000,
      categoria_arreglo_id: categoriaAlineacion,
    });
    const repuestoBody = await repuestoResponse.json() as { data?: { operacion_id?: string }; error?: string };
    if (repuestoResponse.status !== 200 || !repuestoBody.data?.operacion_id) {
      throw new Error(`No se pudo asignar el repuesto del ejemplo B2C-222: ${repuestoBody.error ?? repuestoResponse.statusText}`);
    }

    const from = "2042-03-01T03:00:00.000Z";
    const to = "2042-04-01T03:00:00.000Z";
    const resultado = await arregloService.facturacionPorTipo(testClient, from, to);
    expect(resultado).toEqual([
      { label: nombreAlineacion, cantidad: 2, monto: 36000 },
      { label: nombreFrenos, cantidad: 1, monto: 7000 },
    ]);
    expect(resultado.reduce((total, fila) => total + fila.monto, 0)).toBe(43000);
    expect(await arregloService.facturacionPorEmpleado(testClient, from, to)).toEqual([
      { label: "Sin empleado", cantidad: 2, monto: 43000 },
    ]);

    const admin = createAdminTestClient();
    const { error: cambioCategoriaError } = await admin
      .from("detalle_arreglo")
      .update({ categoria_arreglo_id: categoriaFrenos })
      .eq("id", detallesAlineacion[0]);
    if (cambioCategoriaError) throw new Error(`No se pudo mover el detalle entre categorías: ${cambioCategoriaError.message}`);
    expect(await arregloService.facturacionPorTipo(testClient, from, to)).toEqual([
      { label: nombreAlineacion, cantidad: 2, monto: 26000 },
      { label: nombreFrenos, cantidad: 1, monto: 17000 },
    ]);

    const { error: bajaParcialError } = await admin
      .from("detalle_arreglo")
      .delete()
      .eq("id", detallesAlineacion[1]);
    if (bajaParcialError) throw new Error(`No se pudo eliminar un detalle de alineación: ${bajaParcialError.message}`);
    expect(await arregloService.facturacionPorTipo(testClient, from, to)).toEqual([
      { label: nombreFrenos, cantidad: 1, monto: 17000 },
      { label: nombreAlineacion, cantidad: 2, monto: 16000 },
    ]);

    const { error: bajaUltimoDetalleAError } = await admin
      .from("detalle_arreglo")
      .delete()
      .eq("id", detallesAlineacion[2]);
    if (bajaUltimoDetalleAError) throw new Error(`No se pudo eliminar el último detalle de alineación de A: ${bajaUltimoDetalleAError.message}`);
    const { data: repuesto, error: repuestoLookupError } = await admin
      .from("operaciones_lineas")
      .select("id")
      .eq("operacion_id", repuestoBody.data.operacion_id)
      .single();
    if (repuestoLookupError || !repuesto) throw new Error(`No se pudo encontrar el repuesto del ejemplo: ${repuestoLookupError?.message ?? "sin respuesta"}`);
    const eliminarRepuestoResponse = await eliminarRepuestoLineaViaRoute(arregloA.id, repuesto.id);
    if (eliminarRepuestoResponse.status !== 200) {
      throw new Error(`No se pudo quitar el repuesto de alineación: ${eliminarRepuestoResponse.statusText}`);
    }
    expect(await arregloService.facturacionPorTipo(testClient, from, to)).toEqual([
      { label: nombreFrenos, cantidad: 1, monto: 17000 },
      { label: nombreAlineacion, cantidad: 1, monto: 8000 },
    ]);

    const { error: bajaUltimoArregloError } = await admin
      .from("detalle_arreglo")
      .delete()
      .eq("id", detallesAlineacion[3]);
    if (bajaUltimoArregloError) throw new Error(`No se pudo eliminar el último detalle de alineación: ${bajaUltimoArregloError.message}`);
    expect(await arregloService.facturacionPorTipo(testClient, from, to)).toEqual([
      { label: nombreFrenos, cantidad: 1, monto: 17000 },
    ]);
    expect(await arregloService.facturacionPorEmpleado(testClient, from, to)).toEqual([
      { label: "Sin empleado", cantidad: 1, monto: 17000 },
    ]);
  });

  it("cuenta una sola vez Sin categoría con detalles y formulario personalizado del mismo arreglo", async () => {
    const arreglo = await dadoUnArreglo({ fecha: "2042-03-15T12:00:00-03:00" });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 1000,
    });
    await agregarDetalleFacturacionDashboard(arreglo.id, {
      cantidad: 1,
      horasFacturadas: 1,
      precioHoraFacturada: 2000,
    });

    const admin = createAdminTestClient();
    const { error: arregloError } = await admin
      .from("arreglos")
      .update({ tasa_iva: 21 })
      .eq("id", arreglo.id);
    if (arregloError) throw new Error(`No se pudo habilitar el IVA para el formulario personalizado: ${arregloError.message}`);
    const { error: customError } = await admin.from("detalle_form_custom").insert({
      tenant_id: SEED.tenantId,
      arreglo_id: arreglo.id,
      costo: 3000,
    });
    if (customError) throw new Error(`No se pudo crear el formulario personalizado: ${customError.message}`);

    const resultado = await arregloService.facturacionPorTipo(
      testClient,
      "2042-03-01T03:00:00.000Z",
      "2042-04-01T03:00:00.000Z"
    );
    expect(resultado).toEqual([{ label: "Sin categoría", cantidad: 1, monto: 6000 }]);
    expect(await arregloService.facturacionPorEmpleado(
      testClient,
      "2042-03-01T03:00:00.000Z",
      "2042-04-01T03:00:00.000Z"
    )).toEqual([{ label: "Sin empleado", cantidad: 1, monto: 6000 }]);
  });

  it("dado una acción de cada tipo, al consultar el dashboard ubica cada operación en el timezone de Buenos Aires", async () => {
    const fecha = "2020-03-15T22:30:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadoUnArreglo({ fecha });
    await dadaUnaVenta(cuentaId, fecha, 1500);
    await dadaUnaCompra(cuentaId, fecha, 800);
    await dadoUnGasto(cuentaId, fecha, 300);
    await dadoUnClienteCreadoEl(fecha);

    const stats = await cuandoSeConsultaElDashboard();
    const series = stats.periodo!.series;

    // Then: todo debe figurar el día 15, no el 16
    expect({
      arreglos: fechasConDatos(series.arreglos, (d) => d.cantidad),
      ventas: fechasConDatos(series.ingresos, (d) => d.ventas),
      compras: fechasConDatos(series.gastos, (d) => d.repuestos),
      gastosEventuales: fechasConDatos(series.gastos, (d) => d.eventuales),
      clientesNuevos: diasConDatos(clientesNuevosPorDia(stats), (d) => d.valor),
    }).toEqual({
      arreglos: { "2020-03-15": 1 },
      ventas: { "2020-03-15": 1500 },
      compras: { "2020-03-15": 800 },
      gastosEventuales: { "2020-03-15": 300 },
      clientesNuevos: { "15/03": 1 },
    });
  });

  it("dado ingresos de ingresos mano de obra, repuestos y ventas de mostrador en el mismo día, desglosa la facturación total para cada tipo ", async () => {
    const fecha = "2020-03-10T14:00:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();

    const { arreglo } = await dadoUnArregloConRepuesto({
      fecha,
      cantidadAsignada: 2,
      precioUnitario: 1500,
    });
    await dadaUnaManoDeObra(arreglo.id, 7000);
    await dadaUnaVenta(cuentaId, fecha, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    const ingresosDelDia = stats.periodo!.series.ingresos.find((d) => d.fecha === "2020-03-10");
    expect(ingresosDelDia).toEqual({
      fecha: "2020-03-10",
      mano_de_obra: 7000,
      repuestos: 3000,
      ventas: 4000,
    });
  });

  it("dado gastos de compras de repuestos, gastos eventuales y sueldos en el mismo día, desglosa el gasto total para cada tipo", async () => {
    const fecha = "2020-03-01T14:00:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();

    await dadaUnaCompra(cuentaId, fecha, 3000);
    await dadoUnGasto(cuentaId, fecha, 4000);
    await dadoUnSueldo(50000, fecha);

    const stats = await cuandoSeConsultaElDashboard();

    const gastosDelDia = stats.periodo!.series.gastos.find((d) => d.fecha === "2020-03-01");
    expect(gastosDelDia).toEqual({
      fecha: "2020-03-01",
      repuestos: 3000,
      sueldos: 50000,
      eventuales: 4000,
    });
    expect(stats.totals?.gastos).toBe(57000);
  });

  it("dado un período que cruza meses, devuelve un día por fila y el sueldo solo en los días 1 incluidos", async () => {
    await dadoUnSueldo(50000, "2020-02-01");
    await dadoUnArreglo({ fecha: "2020-02-25T10:00:00-03:00" });
    await dadoUnArreglo({ fecha: "2020-03-05T10:00:00-03:00" });

    const periodo = await cuandoSeConsultaElPeriodo("2020-02-20", "2020-03-10");

    // 20/02 al 29/02 (2020 es bisiesto) y 01/03 al 10/03
    expect(periodo.series.arreglos).toHaveLength(20);
    expect(periodo.series.arreglos[0].fecha).toBe("2020-02-20");
    expect(periodo.series.arreglos.at(-1)?.fecha).toBe("2020-03-10");
    expect(fechasConDatos(periodo.series.arreglos, (d) => d.cantidad)).toEqual({
      "2020-02-25": 1,
      "2020-03-05": 1,
    });
    expect(fechasConDatos(periodo.series.gastos, (d) => d.sueldos)).toEqual({ "2020-03-01": 50000 });
    expect(periodo.resumen.total).toBe(2);
  });

  it("dado un período de más de 100 días, no agrupa por semana ni por mes: sigue devolviendo un día por fila", async () => {
    const periodo = await cuandoSeConsultaElPeriodo("2020-01-01", "2020-06-30");

    expect(periodo.series.arreglos).toHaveLength(182);
    expect(periodo.series.ingresos).toHaveLength(182);
    expect(periodo.series.gastos).toHaveLength(182);
  });

  it("dado un rango invertido, la base lo rechaza", async () => {
    await expect(
      arregloService.dashboardPeriodo(testClient, "2020-03-10T03:00:00.000Z", "2020-03-01T03:00:00.000Z")
    ).rejects.toThrow("Rango de fechas inválido");
  });

  it("agrega una vez las horas trabajadas de cada detalle, por identidad y sin usar cantidad ni facturación", async () => {
    const empleadoA = await crearEmpleadoDashboard("Empleado", "Homónimo");
    const empleadoB = await crearEmpleadoDashboard("Empleado", "Homónimo");
    const arreglo = await dadoUnArreglo({ fecha: "2020-03-15T12:00:00-03:00" });

    await agregarDetalleHoras(arreglo.id, {
      empleadoId: empleadoA,
      horasTrabajadas: 1.25,
      horasFacturadas: 7.5,
      cantidad: 3,
    });
    await agregarDetalleHoras(arreglo.id, {
      empleadoId: empleadoA,
      horasTrabajadas: 0.75,
      horasFacturadas: 0,
    });
    await agregarDetalleHoras(arreglo.id, {
      empleadoId: empleadoB,
      horasTrabajadas: 2.5,
      horasFacturadas: 0.25,
    });
    await agregarDetalleHoras(arreglo.id, {
      horasTrabajadas: 0.5,
      horasFacturadas: 8,
    });
    await agregarDetalleHoras(arreglo.id, {
      empleadoId: empleadoA,
      horasTrabajadas: 0,
      horasFacturadas: 2,
    });
    await agregarDetalleHoras(arreglo.id, {
      empleadoId: empleadoA,
      horasTrabajadas: null,
      horasFacturadas: 4,
    });

    const presupuesto = await dadoUnArreglo({
      fecha: "2020-03-16T12:00:00-03:00",
      estado: "PRESUPUESTO",
    });
    await agregarDetalleHoras(presupuesto.id, {
      empleadoId: empleadoB,
      horasTrabajadas: 12,
    });

    const stats = await cuandoSeConsultaElDashboard();
    expect(stats.horasTrabajadasPorEmpleado).toEqual({
      totalHoras: 5,
      empleados: [
        { empleadoId: empleadoB, label: "Empleado Homónimo", horasTrabajadas: 2.5 },
        { empleadoId: empleadoA, label: "Empleado Homónimo", horasTrabajadas: 2 },
        { empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.5 },
      ],
    });
  });

  it("usa el inicio inclusivo y el fin exclusivo del período calendario GMT-3", async () => {
    const inicio = await dadoUnArreglo({ fecha: "2020-03-01T03:00:00.000Z" });
    const antesDelInicio = await dadoUnArreglo({ fecha: "2020-03-01T02:59:59.999Z" });
    const fin = await dadoUnArreglo({ fecha: "2020-04-01T03:00:00.000Z" });
    await agregarDetalleHoras(inicio.id, { horasTrabajadas: 0.3 });
    await agregarDetalleHoras(antesDelInicio.id, { horasTrabajadas: 0.4 });
    await agregarDetalleHoras(fin.id, { horasTrabajadas: 0.5 });

    const stats = await cuandoSeConsultaElDashboard();
    expect(stats.horasTrabajadasPorEmpleado).toEqual({
      totalHoras: 0.3,
      empleados: [{ empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.3 }],
    });
  });

  it("mantiene las horas y las muestra sin empleado cuando se elimina la persona", async () => {
    const empleadoId = await crearEmpleadoDashboard("Empleado", "Eliminado");
    const arreglo = await dadoUnArreglo({ fecha: "2020-03-15T12:00:00-03:00" });
    await agregarDetalleHoras(arreglo.id, { empleadoId, horasTrabajadas: 0.3 });

    const { error } = await createAdminTestClient().from("empleados").delete().eq("id", empleadoId);
    if (error) throw new Error(`No se pudo eliminar empleado de prueba: ${error.message}`);

    const stats = await cuandoSeConsultaElDashboard();
    expect(stats.horasTrabajadasPorEmpleado).toEqual({
      totalHoras: 0.3,
      empleados: [{ empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.3 }],
    });
  });

  it("no incluye horas de otro tenant aunque su arreglo caiga en el mismo rango", async () => {
    const admin = createAdminTestClient();
    const otroTenant = randomUUID();
    const arregloId = randomUUID();
    const { error: tenantError } = await admin.from("tenants").insert({
      id: otroTenant,
      nombre: "Tenant secundario de prueba",
    });
    if (tenantError) throw new Error(`No se pudo crear tenant de prueba: ${tenantError.message}`);

    const { error: arregloError } = await admin.from("arreglos").insert({
      id: arregloId,
      tenant_id: otroTenant,
      vehiculo_id: SEED.vehiculoId,
      fecha: "2020-03-15T12:00:00-03:00",
      numero_orden: 1,
    });
    if (arregloError) throw new Error(`No se pudo crear arreglo de otro tenant: ${arregloError.message}`);

    const { error: detalleError } = await admin.from("detalle_arreglo").insert({
      tenant_id: otroTenant,
      arreglo_id: arregloId,
      descripcion: "Horas de otro tenant",
      cantidad: 1,
      precio_hora_facturada: 0,
      horas_trabajadas: 10,
    });
    if (detalleError) throw new Error(`No se pudo crear detalle de otro tenant: ${detalleError.message}`);

    const stats = await cuandoSeConsultaElDashboard();
    expect(stats.horasTrabajadasPorEmpleado).toEqual({ totalHoras: 0, empleados: [] });
  });
});
