import React, { type ReactElement, type ReactNode } from "react";
import { act, render, type RenderOptions } from "@testing-library/react";
import { TenantContext, type TenantContextValue } from "@/app/providers/TenantProvider";
import { permissionForPath } from "@/lib/permissions";

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
  planLoading = false,
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
    planLoading,
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
