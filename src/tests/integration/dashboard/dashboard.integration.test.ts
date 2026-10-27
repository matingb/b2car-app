import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { dadoUnArreglo, dadoUnArregloConRepuesto } from "../helpers/integrationFixtures";
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

describe("Integration: dashboard", () => {
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
