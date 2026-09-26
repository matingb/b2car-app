import { beforeEach, describe, expect, it, vi } from "vitest";
import TalleresLegacyPage from "../talleres/page";
import EmpleadosLegacyPage from "../empleados/page";
import EmpleadoDetailLegacyPage from "../empleados/[id]/page";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

beforeEach(() => redirect.mockClear());

describe("rutas anteriores de Configuración", () => {
  it("redirige Talleres al nuevo formulario", () => {
    TalleresLegacyPage();
    expect(redirect).toHaveBeenCalledWith("/configuracion/taller");
  });

  it("redirige Empleados al nuevo listado", () => {
    EmpleadosLegacyPage();
    expect(redirect).toHaveBeenCalledWith("/configuracion/empleados");
  });

  it("conserva el ID del empleado al redirigir el detalle", async () => {
    await EmpleadoDetailLegacyPage({ params: Promise.resolve({ id: "emp-1" }) });
    expect(redirect).toHaveBeenCalledWith("/configuracion/empleados/emp-1");
  });
});
