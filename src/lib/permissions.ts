export const UserRole = {
  Admin: "admin",
  Operativo: "operativo",
  OperativoArturo: "operativo_arturo",
} as const;

// Los identificadores de roles se definen en la BD, no en esta lista de constantes.
export type UserRoleValue = string;

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
  TallerView: "configuracion:taller:view",

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
  // Valida el identificador del claim; la autorización depende de role_permissions.
  return typeof value === "string" &&
    value.length > 0 && value.length <= 50 && value === value.trim()
    ? value
    : null;
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
    path: ["/configuracion/empleados"],
    permission: Permission.EmpleadosView,
  },
  {
    path: ["/configuracion/facturacion", "/api/facturacion/configuracion"],
    permission: Permission.FacturasView,
  },
  {
    path: ["/configuracion"],
    permission: Permission.TallerView,
  },

  // Talleres
  { path: ["/talleres", "/api/tenant/taller"], permission: Permission.TallerView },

  // Facturación y endpoints fiscales
  {
    path: ["/facturacion", "/api/facturas", "/api/fiscal"],
    permission: Permission.FacturasView,
  },

  // Empleados
  { path: ["/empleados"], permission: Permission.EmpleadosView },

  // Productos
  { path: ["/productos", "/api/productos"], permission: Permission.ProductosView },
  { path: ["/stock", "/api/stocks"], permission: Permission.ProductosView },

  // Módulos operativos: un rol personalizado puede no tener acceso a todos ellos.
  { path: ["/arreglos", "/api/arreglos"], permission: Permission.ArreglosView },
  { path: ["/clientes", "/api/clientes"], permission: Permission.ClientesView },
  { path: ["/vehiculos", "/api/vehiculos"], permission: Permission.VehiculosView },
  { path: ["/turnos", "/api/turnos"], permission: Permission.TurnosView },
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

export function getLandingPathForPermissions(permissions: readonly PermissionValue[]): string {
  const granted = new Set(permissions);
  const destinations: readonly [PermissionValue, string][] = [
    [Permission.DashboardView, "/dashboard"],
    [Permission.ArreglosView, "/arreglos"],
    [Permission.TurnosView, "/turnos"],
    [Permission.ClientesView, "/clientes"],
    [Permission.VehiculosView, "/vehiculos"],
    [Permission.ProductosView, "/productos"],
    [Permission.OperacionesView, "/operaciones"],
    [Permission.FinanzasView, "/cuentas-financieras"],
    [Permission.FacturasView, "/facturacion"],
    [Permission.TallerView, "/configuracion"],
    [Permission.EmpleadosView, "/configuracion/empleados"],
  ];
  return destinations.find(([permission]) => granted.has(permission))?.[1] ?? "/login";
}
