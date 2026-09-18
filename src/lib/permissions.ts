export const UserRole = {
  Admin: "admin",
  Operativo: "operativo",
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

export const Permission = {
  // 1. Módulos y Navegación
  DashboardView: "dashboard:view",
  OperacionesView: "operaciones:view",
  OperacionesEdit: "operaciones:edit",
  FinanzasView: "finanzas:view",
  FinanzasEdit: "finanzas:edit",
  FacturasView: "facturas:view",
  FacturasEdit: "facturas:edit",
  EmpleadosView: "empleados:view",
  EmpleadosEdit: "empleados:edit",
  ProductosView: "productos:view",
  ProductosEdit: "productos:edit",
  ConfiguracionView: "configuracion:view",
  ConfiguracionEdit: "configuracion:edit",

  // 2. Arreglos
  ArreglosView: "arreglos:view",
  ArreglosEdit: "arreglos:edit",
  ArreglosPreciosView: "arreglos:precios:view",
  ArreglosPreciosEdit: "arreglos:precios:edit",
  ArreglosCobrosRegister: "arreglos:cobros:register",
  ArreglosRepuestosComprar: "arreglos:repuestos:comprar",

  // 3. Clientes
  ClientesView: "clientes:view",
  ClientesEdit: "clientes:edit",
  ClientesFinanzasView: "clientes:finanzas:view",

  // 4. Vehículos y Turnos
  VehiculosView: "vehiculos:view",
  VehiculosEdit: "vehiculos:edit",
  TurnosView: "turnos:view",
  TurnosEdit: "turnos:edit",
} as const;

export type PermissionValue = typeof Permission[keyof typeof Permission];

export function normalizeUserRole(value: unknown): UserRoleValue | null {
  return value === UserRole.Admin || value === UserRole.Operativo ? value : null;
}

export type PathMatchStrategy = "prefix" | "exact" | "includes" | "endsWith";

export interface RoutePermissionRule {
  path: string | readonly string[];
  permission: PermissionValue;
  match?: PathMatchStrategy;
}

export const PATH_PERMISSIONS: readonly RoutePermissionRule[] = [
  { path: "/cuenta-corriente", permission: Permission.ClientesFinanzasView, match: "includes" },
  { path: "/cobro", permission: Permission.ArreglosCobrosRegister, match: "includes" },
  { path: "/factura", permission: Permission.FacturasView, match: "endsWith" },
  { path: "/api/dashboard/stats", permission: Permission.DashboardView, match: "exact" },

  // Dashboard
  { path: "/dashboard", permission: Permission.DashboardView },

  // Operaciones
  { path: ["/operaciones", "/api/operaciones"], permission: Permission.OperacionesView },

  // Finanzas / Cuentas Financieras / Gastos
  {
    path: ["/cuentas-financieras", "/gastos", "/api/gastos"],
    permission: Permission.FinanzasView,
  },

  // Configuración
  {
    path: ["/configuracion", "/api/facturacion/configuracion"],
    permission: Permission.ConfiguracionView,
  },

  // Facturación y endpoints fiscales
  {
    path: ["/facturacion", "/api/facturas", "/api/fiscal"],
    permission: Permission.FacturasView,
  },

  // Empleados
  { path: ["/empleados"], permission: Permission.EmpleadosView },

  // Productos
  { path: ["/productos", "/api/productos"], permission: Permission.ProductosView },
];

function matchesRule(pathname: string, rule: RoutePermissionRule): boolean {
  const strategy = rule.match ?? "prefix";
  const patterns = Array.isArray(rule.path) ? rule.path : [rule.path];

  return patterns.some((pattern) => {
    switch (strategy) {
      case "exact":
        return pathname === pattern;
      case "endsWith":
        return pathname.endsWith(pattern);
      case "includes":
        return pathname.includes(pattern);
      case "prefix":
      default:
        return pathname === pattern || pathname.startsWith(`${pattern}/`);
    }
  });
}

export function permissionForPath(pathname: string): PermissionValue | null {
  const matchedRule = PATH_PERMISSIONS.find((rule) => matchesRule(pathname, rule));
  return matchedRule ? matchedRule.permission : null;
}

export function getLandingPathForRole(role: unknown): string {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === UserRole.Operativo) {
    return "/arreglos";
  }
  return "/dashboard";
}
