import { describe, it, expect } from "vitest";
import { createCreateEmpleadoRequest } from "@/tests/factories";
import {
  cuandoSeCreaUnEmpleado,
  expectEmpleadoEnDb,
  expectHistorialSalarial,
  obtenerSueldosTaller,
  SEED_SUCURSAL_OESTE_ID,
} from "./empleadosHelpers";

describe("Integration (Route): POST /api/empleados", () => {
  it("crea un empleado con salario 0 sin fecha de vigencia ni fecha de ingreso y no altera gastos", async () => {
    // Given
    const salario = 0;
    const ingreso = null
    const sueldosAntes = await obtenerSueldosTaller();
    const payload = createCreateEmpleadoRequest({
      nombre: "Martin",
      apellido: "Gomez",
      dni: "38123456",
      email: "martin.gomez@test.com",
      telefono: "1122334455",
      salario: salario,
      fecha_ingreso: ingreso
    });

    // When
    const { data } = await cuandoSeCreaUnEmpleado(payload);

    // Then
    await expectEmpleadoEnDb(data!.id, {
      nombre: "Martin",
      apellido: "Gomez",
      dni: "38123456",
      salario: 0,
    });
    await expectHistorialSalarial(data!.id, []);

    // And: el sueldo 0 no impacta en los gastos del taller
    const sueldosDespues = await obtenerSueldosTaller();
    expect(sueldosDespues).toEqual(sueldosAntes);
  });

  it("crea un empleado con salario 0 con fecha de vigencia y no altera gastos", async () => {
    // Given
    const sueldosAntes = await obtenerSueldosTaller();
    const payload = createCreateEmpleadoRequest({
      nombre: "Lucas",
      apellido: "Diaz",
      dni: "39123456",
      salario: 0,
      salario_vigente_desde: "2026-09-01",
    });

    // When
    const { data } = await cuandoSeCreaUnEmpleado(payload);

    // Then: entidad e historial registrados con monto 0
    await expectEmpleadoEnDb(data!.id, { nombre: "Lucas", salario: 0 });
    await expectHistorialSalarial(data!.id, [
      { salario: 0, vigente_desde: "2026-09-01" },
    ]);

    // And: no impacta en el total de gastos de sueldos
    const sueldosDespues = await obtenerSueldosTaller();
    expect(sueldosDespues).toEqual(sueldosAntes);
  });

  it("crea un empleado con salario positivo y fecha de ingreso derivando vigencia e impactando gastos", async () => {
    // Given
    const sueldosAntes = await obtenerSueldosTaller();
    const payload = createCreateEmpleadoRequest({
      nombre: "Esteban",
      apellido: "Quito",
      dni: "40123456",
      salario: 450000,
      fecha_ingreso: "2026-05-15",
    });

    // When
    const { data } = await cuandoSeCreaUnEmpleado(payload);

    // Then: entidad persistida e historial derivado al primer día del mes
    await expectEmpleadoEnDb(data!.id, {
      nombre: "Esteban",
      salario: 450000,
      fecha_ingreso: "2026-05-15",
    });
    await expectHistorialSalarial(data!.id, [
      { salario: 450000, vigente_desde: "2026-05-01" },
    ]);

    // And: impacta en gastos del taller desde mayo (no en abril, ni en otros talleres)
    const sueldosDespues = await obtenerSueldosTaller();
    expect(sueldosDespues["04/26"]).toBe(sueldosAntes["04/26"]);
    expect(sueldosDespues["05/26"]).toBe(sueldosAntes["05/26"] + 450000);
    expect(sueldosDespues["06/26"]).toBe(sueldosAntes["06/26"] + 450000);

    const sueldosOtroTaller = await obtenerSueldosTaller(SEED_SUCURSAL_OESTE_ID);
    expect(sueldosOtroTaller["05/26"]).toBe(140000);
  });

  it("crea un empleado con salario positivo y salario_vigente_desde explícito impactando gastos", async () => {
    // Given
    const sueldosAntes = await obtenerSueldosTaller();
    const payload = createCreateEmpleadoRequest({
      nombre: "Valeria",
      apellido: "Rios",
      dni: "41123456",
      salario: 600000,
      salario_vigente_desde: "2026-06-01",
      fecha_ingreso: "2026-06-10",
    });

    // When
    const { data } = await cuandoSeCreaUnEmpleado(payload);

    // Then: entidad e historial con fecha explícita
    await expectEmpleadoEnDb(data!.id, { nombre: "Valeria", salario: 600000 });
    await expectHistorialSalarial(data!.id, [
      { salario: 600000, vigente_desde: "2026-06-01" },
    ]);

    // And: impacta en gastos a partir de junio, no en mayo
    const sueldosDespues = await obtenerSueldosTaller();
    expect(sueldosDespues["05/26"]).toBe(sueldosAntes["05/26"]);
    expect(sueldosDespues["06/26"]).toBe(sueldosAntes["06/26"] + 600000);
  });

  it("rechaza con 400 si el salario es positivo pero falta salario_vigente_desde y fecha_ingreso sin alterar gastos", async () => {
    // Given
    const sueldosAntes = await obtenerSueldosTaller();
    const payload = createCreateEmpleadoRequest({
      nombre: "Sin",
      apellido: "Fecha",
      dni: "42123456",
      salario: 300000,
    });

    // When: rechaza con 400
    const body = await cuandoSeCreaUnEmpleado(payload, 400);
    expect(body.error).toContain("Falta salario_vigente_desde");

    // And: los gastos del taller permanecen inalterados
    const sueldosDespues = await obtenerSueldosTaller();
    expect(sueldosDespues).toEqual(sueldosAntes);
  });
});
