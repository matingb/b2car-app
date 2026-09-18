import React, { type ReactElement, type ReactNode } from "react";
import { act, render, type RenderOptions } from "@testing-library/react";
import { TenantContext, type TenantContextValue } from "@/app/providers/TenantProvider";
import {
  Permission,
  type PermissionValue,
  UserRole,
  type UserRoleValue,
  permissionForPath,
} from "@/lib/permissions";
import { SubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";

export const MOCK_ADMIN_PERMISSIONS: PermissionValue[] = Object.values(Permission);

export const MOCK_OPERATIVO_PERMISSIONS: PermissionValue[] = [
  Permission.ArreglosView,
  Permission.ArreglosEdit,
  Permission.ArreglosRepuestosComprar,
  Permission.ClientesView,
  Permission.ClientesEdit,
  Permission.VehiculosView,
  Permission.VehiculosEdit,
  Permission.TurnosView,
  Permission.TurnosEdit,
];

export function mockHasPermission(
  role: UserRoleValue = UserRole.Admin,
  plan?: SubscriptionPlanValue,
): (permission: PermissionValue) => boolean {
  let perms = role === UserRole.Admin ? MOCK_ADMIN_PERMISSIONS : MOCK_OPERATIVO_PERMISSIONS;
  if (plan === SubscriptionPlan.Base) {
    perms = perms.filter(
      (p) =>
        p !== Permission.FacturasView &&
        p !== Permission.FacturasEdit &&
        p !== Permission.ConfiguracionView &&
        p !== Permission.ConfiguracionEdit,
    );
  }
  const permSet = new Set(perms);
  return (permission: PermissionValue) => permSet.has(permission);
}

/**
 * Útil para evitar `waitFor` cuando las actualizaciones son sincrónicas
 * pero React aplica el re-render de forma async.
 */
export const runPendingPromises = async () => act(async () => {});

export type TenantTestProviderProps = Partial<TenantContextValue> & {
  children: React.ReactNode;
};

export function TenantTestProvider({
  children,
  tenantName = "B2Car",
  talleres = [],
  tallerSeleccionadoId = "",
  setTallerSeleccionadoId = () => {},
  loading = false,
  hasPermission = () => true,
  canAccessPath: customCanAccessPath,
}: TenantTestProviderProps) {
  const defaultCanAccessPath = (pathname: string) => {
    const required = permissionForPath(pathname);
    return !required || hasPermission(required);
  };

  const value: TenantContextValue = {
    loading,
    tenantName,
    talleres,
    tallerSeleccionadoId,
    setTallerSeleccionadoId,
    hasPermission,
    canAccessPath: customCanAccessPath ?? defaultCanAccessPath,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function createGenericWrapper(tenantProps?: TenantTestProviderProps) {
  return function GenericWrapper({ children }: { children: ReactNode }) {
    return <TenantTestProvider {...tenantProps}>{children}</TenantTestProvider>;
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & {
    tenantProps?: TenantTestProviderProps;
  }
) {
  const { tenantProps, ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: createGenericWrapper(tenantProps),
    ...renderOptions,
  });
}
