import { describe, expect, it } from "vitest";
import {
  Permission,
  UserRole,
  getLandingPathForRole,
  normalizeUserRole,
  permissionForPath,
  PATH_PERMISSIONS,
} from "./permissions";

describe("permissions", () => {
  describe("normalizeUserRole", () => {
    it("reconoce 'admin' y 'operativo'", () => {
      expect(normalizeUserRole("admin")).toBe(UserRole.Admin);
      expect(normalizeUserRole("operativo")).toBe(UserRole.Operativo);
    });

    it("retorna null para valores inválidos, vacíos o desconocidos", () => {
      expect(normalizeUserRole(null)).toBeNull();
      expect(normalizeUserRole(undefined)).toBeNull();
      expect(normalizeUserRole("")).toBeNull();
      expect(normalizeUserRole("otro")).toBeNull();
      expect(normalizeUserRole(123)).toBeNull();
    });
  });

  describe("permissionForPath", () => {
    it.each([
      ["/dashboard", Permission.DashboardView],
      ["/api/dashboard/stats", Permission.DashboardView],
      ["/operaciones", Permission.OperacionesView],
      ["/operaciones/123", Permission.OperacionesView],
      ["/api/operaciones", Permission.OperacionesView],
      ["/cuentas-financieras", Permission.FinanzasView],
      ["/cuentas-financieras/xyz", Permission.FinanzasView],
      ["/api/cuentas-financieras", Permission.FinanzasView],
      ["/gastos", Permission.FinanzasView],
      ["/api/gastos", Permission.FinanzasView],
      ["/facturacion", Permission.FacturasView],
      ["/api/facturas", Permission.FacturasView],
      ["/empleados", Permission.EmpleadosView],
      ["/api/empleados", Permission.EmpleadosView],
      ["/productos", Permission.ProductosView],
      ["/api/productos", Permission.ProductosView],
      ["/configuracion", Permission.ConfiguracionView],
      ["/api/facturacion/configuracion", Permission.ConfiguracionView],
      ["/api/clientes/123/cuenta-corriente", Permission.ClientesFinanzasView],
      ["/api/arreglos/123/cobro", Permission.ArreglosCobrosRegister],
    ] as const)("mapea %s a %s", (pathname, expected) => {
      expect(permissionForPath(pathname)).toBe(expected);
    });

    it.each([
      "/arreglos",
      "/arreglos/123",
      "/api/arreglos",
      "/api/arreglos/123/repuestos",
      "/clientes",
      "/vehiculos",
      "/turnos",
    ])("retorna null para rutas libres u operativas: %s", (pathname) => {
      expect(permissionForPath(pathname)).toBeNull();
    });
  });

  describe("PATH_PERMISSIONS", () => {
    it("posee reglas válidas con paths y permisos bien definidos", () => {
      expect(PATH_PERMISSIONS.length).toBeGreaterThan(0);
      for (const rule of PATH_PERMISSIONS) {
        expect(rule.permission).toBeDefined();
        if (Array.isArray(rule.path)) {
          expect(rule.path.length).toBeGreaterThan(0);
          for (const p of rule.path) {
            expect(typeof p).toBe("string");
          }
        } else {
          expect(typeof rule.path).toBe("string");
        }
      }
    });
  });

  describe("getLandingPathForRole", () => {
    it("retorna /arreglos para operativo", () => {
      expect(getLandingPathForRole(UserRole.Operativo)).toBe("/arreglos");
    });

    it("retorna /dashboard para admin o por defecto", () => {
      expect(getLandingPathForRole(UserRole.Admin)).toBe("/dashboard");
      expect(getLandingPathForRole(null)).toBe("/dashboard");
      expect(getLandingPathForRole(undefined)).toBe("/dashboard");
    });
  });
});
