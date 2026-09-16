import {
  normalizeSubscriptionPlan,
  SubscriptionPlan,
  type SubscriptionPlanValue,
} from "@/lib/subscription";

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

const ROLE_PERMISSIONS: Record<UserRoleValue, Set<PermissionValue>> = {
  [UserRole.Admin]: new Set(Object.values(Permission) as PermissionValue[]),
  [UserRole.Operativo]: new Set([
    Permission.ArreglosView,
    Permission.ArreglosEdit,
    Permission.ArreglosRepuestosComprar,
    Permission.ClientesView,
    Permission.ClientesEdit,
    Permission.VehiculosView,
    Permission.VehiculosEdit,
    Permission.TurnosView,
    Permission.TurnosEdit,
  ]),
};

export const PLAN_PERMISSIONS: Record<SubscriptionPlanValue, Set<PermissionValue>> = {
  [SubscriptionPlan.Base]: new Set(
    (Object.values(Permission) as PermissionValue[]).filter(
      (p) =>
        p !== Permission.FacturasView &&
        p !== Permission.FacturasEdit &&
        p !== Permission.ConfiguracionView &&
        p !== Permission.ConfiguracionEdit
    )
  ),
  [SubscriptionPlan.Pro]: new Set(Object.values(Permission) as PermissionValue[]),
};

export function hasPlanPermission(plan: unknown, permission: PermissionValue): boolean {
  const normalizedPlan = normalizeSubscriptionPlan(plan);
  return normalizedPlan ? PLAN_PERMISSIONS[normalizedPlan].has(permission) : false;
}

export function hasPermission(
  role: unknown,
  permission: PermissionValue,
  plan?: unknown,
): boolean {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole || !ROLE_PERMISSIONS[normalizedRole].has(permission)) {
    return false;
  }
  if (plan !== undefined) {
    const normalizedPlan = normalizeSubscriptionPlan(plan);
    if (!normalizedPlan || !PLAN_PERMISSIONS[normalizedPlan].has(permission)) {
      return false;
    }
  }
  return true;
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
    path: ["/cuentas-financieras", "/api/cuentas-financieras", "/gastos", "/api/gastos"],
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
  { path: ["/empleados", "/api/empleados"], permission: Permission.EmpleadosView },

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

export function canPlanAccessPath(plan: unknown, pathname: string): boolean {
  const requiredPermission = permissionForPath(pathname);
  if (!requiredPermission) return true;
  return hasPlanPermission(plan, requiredPermission);
}

export function canAccessPath(role: unknown, pathname: string, plan?: unknown): boolean {
  const requiredPermission = permissionForPath(pathname);
  if (!requiredPermission) return true;
  return hasPermission(role, requiredPermission, plan);
}

export function getLandingPathForRole(role: unknown): string {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === UserRole.Operativo) {
    return "/arreglos";
  }
  return "/dashboard";
}
