import { describe, expect, it } from "vitest";
import { SubscriptionPlan } from "./subscription";
import {
  Permission,
  UserRole,
  canAccessPath,
  canPlanAccessPath,
  getLandingPathForRole,
  hasPermission,
  hasPlanPermission,
  normalizeUserRole,
  permissionForPath,
  PATH_PERMISSIONS,
  PLAN_PERMISSIONS,
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

  describe("hasPermission (Allowlist / Deny-by-default)", () => {
    it("admin tiene todos los permisos", () => {
      Object.values(Permission).forEach((perm) => {
        expect(hasPermission(UserRole.Admin, perm)).toBe(true);
      });
    });

    it("operativo tiene acceso exclusivo al ámbito operativo", () => {
      // Permitidos
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosView)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosEdit)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosRepuestosComprar)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.VehiculosView)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.VehiculosEdit)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.TurnosView)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.TurnosEdit)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.ClientesView)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.ClientesEdit)).toBe(true);

      // Denegados por defecto
      expect(hasPermission(UserRole.Operativo, Permission.DashboardView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.OperacionesView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.OperacionesEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.FinanzasView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.FinanzasEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.FacturasView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.FacturasEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.EmpleadosView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.EmpleadosEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ProductosView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ProductosEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ConfiguracionView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ConfiguracionEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosPreciosView)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosPreciosEdit)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosCobrosRegister)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ClientesFinanzasView)).toBe(false);
    });

    it("niega cualquier permiso si el rol es inválido o indefinido", () => {
      expect(hasPermission(undefined, Permission.ArreglosView)).toBe(false);
      expect(hasPermission("invitado", Permission.TurnosView)).toBe(false);
      expect(hasPermission(null, Permission.VehiculosView)).toBe(false);
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

  describe("canAccessPath", () => {
    it("permite acceso a admin para cualquier ruta protegida o libre", () => {
      expect(canAccessPath(UserRole.Admin, "/dashboard")).toBe(true);
      expect(canAccessPath(UserRole.Admin, "/operaciones")).toBe(true);
      expect(canAccessPath(UserRole.Admin, "/cuentas-financieras")).toBe(true);
      expect(canAccessPath(UserRole.Admin, "/facturacion")).toBe(true);
      expect(canAccessPath(UserRole.Admin, "/api/clientes/123/cuenta-corriente")).toBe(true);
      expect(canAccessPath(UserRole.Admin, "/arreglos")).toBe(true);
    });

    it("permite a operativo acceder a rutas no restringidas y deniega rutas protegidas", () => {
      // Permitidas (rutas libres/operativas que devuelven null en permissionForPath)
      expect(canAccessPath(UserRole.Operativo, "/arreglos")).toBe(true);
      expect(canAccessPath(UserRole.Operativo, "/clientes")).toBe(true);
      expect(canAccessPath(UserRole.Operativo, "/vehiculos")).toBe(true);
      expect(canAccessPath(UserRole.Operativo, "/turnos")).toBe(true);

      // Denegadas
      expect(canAccessPath(UserRole.Operativo, "/dashboard")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/operaciones")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/cuentas-financieras")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/facturacion")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/empleados")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/productos")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/configuracion")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/api/clientes/123/cuenta-corriente")).toBe(false);
      expect(canAccessPath(UserRole.Operativo, "/api/arreglos/123/cobro")).toBe(false);
    });

    it("deniega acceso a rutas protegidas para usuario sin rol o anónimo", () => {
      expect(canAccessPath(null, "/dashboard")).toBe(false);
      expect(canAccessPath(undefined, "/operaciones")).toBe(false);
      expect(canAccessPath("invalido", "/cuentas-financieras")).toBe(false);

      // Permite rutas libres (que no requieren permiso en permissionForPath)
      expect(canAccessPath(null, "/arreglos")).toBe(true);
    });
  });

  describe("PLAN_PERMISSIONS and hasPlanPermission", () => {
    it("plan PRO habilita todos los permisos del sistema", () => {
      Object.values(Permission).forEach((perm) => {
        expect(hasPlanPermission(SubscriptionPlan.Pro, perm)).toBe(true);
        expect(PLAN_PERMISSIONS[SubscriptionPlan.Pro].has(perm)).toBe(true);
      });
    });

    it("plan BASE habilita todo excepto facturas y configuración", () => {
      // Excluidos en BASE
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.FacturasView)).toBe(false);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.FacturasEdit)).toBe(false);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.ConfiguracionView)).toBe(false);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.ConfiguracionEdit)).toBe(false);

      // Habilitados en BASE
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.DashboardView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.OperacionesView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.FinanzasView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.EmpleadosView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.ProductosView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.ArreglosView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.ClientesView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.VehiculosView)).toBe(true);
      expect(hasPlanPermission(SubscriptionPlan.Base, Permission.TurnosView)).toBe(true);
    });

    it("retorna false para planes inválidos o nulos", () => {
      expect(hasPlanPermission(null, Permission.DashboardView)).toBe(false);
      expect(hasPlanPermission(undefined, Permission.DashboardView)).toBe(false);
      expect(hasPlanPermission("ENTERPRISE", Permission.DashboardView)).toBe(false);
    });
  });

  describe("hasPermission con combinación de Rol y Plan", () => {
    it("admin en plan PRO tiene todos los permisos", () => {
      expect(hasPermission(UserRole.Admin, Permission.FacturasView, SubscriptionPlan.Pro)).toBe(true);
      expect(hasPermission(UserRole.Admin, Permission.ConfiguracionView, SubscriptionPlan.Pro)).toBe(true);
      expect(hasPermission(UserRole.Admin, Permission.OperacionesView, SubscriptionPlan.Pro)).toBe(true);
    });

    it("admin en plan BASE no tiene facturación ni configuración", () => {
      expect(hasPermission(UserRole.Admin, Permission.FacturasView, SubscriptionPlan.Base)).toBe(false);
      expect(hasPermission(UserRole.Admin, Permission.ConfiguracionView, SubscriptionPlan.Base)).toBe(false);
      // Pero conserva el resto de los permisos de admin
      expect(hasPermission(UserRole.Admin, Permission.OperacionesView, SubscriptionPlan.Base)).toBe(true);
      expect(hasPermission(UserRole.Admin, Permission.FinanzasView, SubscriptionPlan.Base)).toBe(true);
    });

    it("operativo en plan PRO no tiene facturación porque su rol lo prohíbe", () => {
      expect(hasPermission(UserRole.Operativo, Permission.FacturasView, SubscriptionPlan.Pro)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.FinanzasView, SubscriptionPlan.Pro)).toBe(false);
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosView, SubscriptionPlan.Pro)).toBe(true);
    });

    it("operativo en plan BASE conserva sus permisos operativos", () => {
      expect(hasPermission(UserRole.Operativo, Permission.ArreglosView, SubscriptionPlan.Base)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.VehiculosView, SubscriptionPlan.Base)).toBe(true);
      expect(hasPermission(UserRole.Operativo, Permission.FacturasView, SubscriptionPlan.Base)).toBe(false);
    });
  });

  describe("canPlanAccessPath", () => {
    it("permite acceso en PRO a todas las rutas", () => {
      expect(canPlanAccessPath(SubscriptionPlan.Pro, "/facturacion")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Pro, "/configuracion")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Pro, "/api/fiscal/condicion-iva")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Pro, "/api/arreglos/123/factura")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Pro, "/operaciones")).toBe(true);
    });

    it("bloquea en BASE las rutas de facturación y configuración", () => {
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/facturacion")).toBe(false);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/configuracion")).toBe(false);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/api/fiscal/condicion-iva")).toBe(false);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/api/arreglos/123/factura")).toBe(false);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/api/operaciones/123/factura")).toBe(false);

      // Permite rutas operativas y generales
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/dashboard")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/operaciones")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/cuentas-financieras")).toBe(true);
      expect(canPlanAccessPath(SubscriptionPlan.Base, "/arreglos")).toBe(true);
    });
  });

  describe("canAccessPath con combinación rol + plan", () => {
    it("valida simultáneamente rol y plan", () => {
      // Admin + PRO -> puede facturación
      expect(canAccessPath(UserRole.Admin, "/facturacion", SubscriptionPlan.Pro)).toBe(true);
      // Admin + BASE -> no puede facturación
      expect(canAccessPath(UserRole.Admin, "/facturacion", SubscriptionPlan.Base)).toBe(false);
      // Operativo + PRO -> no puede facturación por rol
      expect(canAccessPath(UserRole.Operativo, "/facturacion", SubscriptionPlan.Pro)).toBe(false);
      // Operativo + BASE -> puede arreglos
      expect(canAccessPath(UserRole.Operativo, "/arreglos", SubscriptionPlan.Base)).toBe(true);
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
