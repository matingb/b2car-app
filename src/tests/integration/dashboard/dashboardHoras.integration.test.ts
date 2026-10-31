import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { dadoUnArreglo } from "../helpers/integrationFixtures";
import {
  cuandoSeConsultaElDashboard,
  dadoUnDetalleDeHoras,
  dadoUnEmpleado,
} from "./dashboardHelpers";
import { createAdminTestClient, SEED } from "@/tests/integration";

const FECHA = "2020-03-15T12:00:00-03:00";

const horasPorEmpleado = async () => (await cuandoSeConsultaElDashboard()).horasTrabajadasPorEmpleado;

describe("Integration: dashboard - horas trabajadas por empleado", () => {
  it("suma las horas de cada empleado", async () => {
    const ana = await dadoUnEmpleado("Ana", "Test");
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: ana, horasTrabajadas: 1.25 });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: ana, horasTrabajadas: 0.75 });

    expect(await horasPorEmpleado()).toEqual({
      totalHoras: 2,
      empleados: [{ empleadoId: ana, label: "Ana Test", horasTrabajadas: 2 }],
    });
  });

  it("distingue por identidad a empleados con el mismo nombre", async () => {
    const empleadoA = await dadoUnEmpleado("Empleado", "Homónimo");
    const empleadoB = await dadoUnEmpleado("Empleado", "Homónimo");
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: empleadoA, horasTrabajadas: 1 });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: empleadoB, horasTrabajadas: 2.5 });

    expect(await horasPorEmpleado()).toEqual({
      totalHoras: 3.5,
      empleados: [
        { empleadoId: empleadoB, label: "Empleado Homónimo", horasTrabajadas: 2.5 },
        { empleadoId: empleadoA, label: "Empleado Homónimo", horasTrabajadas: 1 },
      ],
    });
  });

  it("agrupa las horas sin empleado en 'Sin empleado'", async () => {
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { horasTrabajadas: 0.5 });

    expect(await horasPorEmpleado()).toEqual({
      totalHoras: 0.5,
      empleados: [{ empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.5 }],
    });
  });

  it("no usa la cantidad ni las horas facturadas del detalle", async () => {
    const ana = await dadoUnEmpleado("Ana", "Test");
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: ana, horasTrabajadas: 1, horasFacturadas: 8, cantidad: 3 });

    expect((await horasPorEmpleado())?.totalHoras).toBe(1);
  });

  it("ignora los detalles con horas en cero o desconocidas", async () => {
    const ana = await dadoUnEmpleado("Ana", "Test");
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: ana, horasTrabajadas: 0, horasFacturadas: 2 });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId: ana, horasTrabajadas: null, horasFacturadas: 4 });

    expect(await horasPorEmpleado()).toEqual({ totalHoras: 0, empleados: [] });
  });

  it("excluye los presupuestos", async () => {
    const presupuesto = await dadoUnArreglo({ fecha: FECHA, estado: "PRESUPUESTO" });
    await dadoUnDetalleDeHoras(presupuesto.id, { horasTrabajadas: 12 });

    expect(await horasPorEmpleado()).toEqual({ totalHoras: 0, empleados: [] });
  });

  it("incluye el inicio del período GMT-3 y excluye el fin y lo anterior al inicio", async () => {
    const inicio = await dadoUnArreglo({ fecha: "2020-03-01T03:00:00.000Z" });
    const antesDelInicio = await dadoUnArreglo({ fecha: "2020-03-01T02:59:59.999Z" });
    const fin = await dadoUnArreglo({ fecha: "2020-04-01T03:00:00.000Z" });
    await dadoUnDetalleDeHoras(inicio.id, { horasTrabajadas: 0.3 });
    await dadoUnDetalleDeHoras(antesDelInicio.id, { horasTrabajadas: 0.4 });
    await dadoUnDetalleDeHoras(fin.id, { horasTrabajadas: 0.5 });

    expect((await horasPorEmpleado())?.totalHoras).toBe(0.3);
  });

  it("conserva las horas y las muestra como 'Sin empleado' si se elimina al empleado", async () => {
    const empleadoId = await dadoUnEmpleado("Empleado", "Eliminado");
    const arreglo = await dadoUnArreglo({ fecha: FECHA });
    await dadoUnDetalleDeHoras(arreglo.id, { empleadoId, horasTrabajadas: 0.3 });

    const { error } = await createAdminTestClient().from("empleados").delete().eq("id", empleadoId);
    expect(error).toBeNull();

    expect(await horasPorEmpleado()).toEqual({
      totalHoras: 0.3,
      empleados: [{ empleadoId: null, label: "Sin empleado", horasTrabajadas: 0.3 }],
    });
  });

  it("no incluye horas de otro tenant", async () => {
    const admin = createAdminTestClient();
    const tenantId = randomUUID();
    const arregloId = randomUUID();
    await admin.from("tenants").insert({ id: tenantId, nombre: "Otro tenant" });
    await admin.from("arreglos").insert({
      id: arregloId,
      tenant_id: tenantId,
      vehiculo_id: SEED.vehiculoId,
      fecha: FECHA,
      numero_orden: 1,
    });
    const { error } = await admin.from("detalle_arreglo").insert({
      tenant_id: tenantId,
      arreglo_id: arregloId,
      descripcion: "Horas de otro tenant",
      cantidad: 1,
      precio_hora_facturada: 0,
      horas_trabajadas: 10,
    });
    expect(error).toBeNull();

    expect(await horasPorEmpleado()).toEqual({ totalHoras: 0, empleados: [] });
  });
});
