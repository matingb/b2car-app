import { describe, expect, it } from "vitest";
import {
  Permission,
  UserRole,
  getLandingPathForPermissions,
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

    it("acepta roles personalizados sin agregarlos a UserRole", () => {
      expect(normalizeUserRole("operativo_arturo")).toBe("operativo_arturo");
      expect(normalizeUserRole("recepcion_tenant_nuevo")).toBe("recepcion_tenant_nuevo");
    });

    it("retorna null para identificadores inválidos o vacíos", () => {
      expect(normalizeUserRole(null)).toBeNull();
      expect(normalizeUserRole(undefined)).toBeNull();
      expect(normalizeUserRole("")).toBeNull();
      expect(normalizeUserRole(" ")).toBeNull();
      expect(normalizeUserRole(" admin ")).toBeNull();
      expect(normalizeUserRole("x".repeat(51))).toBeNull();
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
      ["/gastos", Permission.FinanzasView],
      ["/api/gastos", Permission.FinanzasView],
      ["/facturacion", Permission.FacturasView],
      ["/api/facturas", Permission.FacturasView],
      ["/empleados", Permission.EmpleadosView],
      ["/productos", Permission.ProductosView],
      ["/api/productos", Permission.ProductosView],
      ["/configuracion", Permission.TallerView],
      ["/configuracion/taller", Permission.TallerView],
      ["/configuracion/empleados", Permission.EmpleadosView],
      ["/configuracion/empleados/123", Permission.EmpleadosView],
      ["/configuracion/facturacion", Permission.FacturasView],
      ["/api/facturacion/configuracion", Permission.FacturasView],
      ["/talleres", Permission.TallerView],
      ["/api/tenant/taller", Permission.TallerView],
      ["/api/clientes/123/cuenta-corriente", Permission.ClientesFinanzasView],
      ["/api/arreglos/123/cobro", Permission.ArreglosCobrosRegister],
      ["/arreglos", Permission.ArreglosView],
      ["/arreglos/123", Permission.ArreglosView],
      ["/api/arreglos", Permission.ArreglosView],
      ["/api/arreglos/123/repuestos", Permission.ArreglosView],
      ["/clientes", Permission.ClientesView],
      ["/vehiculos", Permission.VehiculosView],
      ["/turnos", Permission.TurnosView],
      ["/stock", Permission.ProductosView],
    ] as const)("mapea %s a %s", (pathname, expected) => {
      expect(permissionForPath(pathname)).toBe(expected);
    });

    it.each([
      "/login",
      "/auth/callback",
      "/ruta-desconocida",
    ])("retorna null para rutas sin regla: %s", (pathname) => {
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

  describe("getLandingPathForPermissions", () => {
    it("lleva a Arturo a trabajos sin conceder acceso al dashboard", () => {
      expect(getLandingPathForPermissions([
        Permission.ArreglosView, Permission.ArreglosEdit,
        Permission.ArreglosPreciosEdit, Permission.ProductosView,
      ])).toBe("/arreglos");
    });

    it("prioriza el dashboard únicamente si tiene permiso", () => {
      expect(getLandingPathForPermissions([Permission.ArreglosView, Permission.DashboardView])).toBe("/dashboard");
    });

    it.each([
      [Permission.ProductosView, "/productos"],
      [Permission.TurnosView, "/turnos"],
      [Permission.ClientesView, "/clientes"],
      [Permission.EmpleadosView, "/configuracion/empleados"],
    ] as const)("elige una pantalla accesible para %s", (permission, path) => {
      expect(getLandingPathForPermissions([permission])).toBe(path);
    });

    it("no redirige a una pantalla protegida si no tiene permisos de lectura", () => {
      expect(getLandingPathForPermissions([])).toBe("/login");
      expect(getLandingPathForPermissions([Permission.ProductosEdit])).toBe("/login");
    });
  });
});
