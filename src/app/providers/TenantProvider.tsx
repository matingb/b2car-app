"use client";

import { tenantClient } from "@/clients/tenantClient";
import type { SubscriptionPlanValue } from "@/lib/subscription";
import {
  hasPermission as checkPermission,
  permissionForPath,
  type PermissionValue,
  type UserRoleValue,
} from "@/lib/permissions";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Taller } from "@/model/types";

export type TenantContextValue = {
  loading: boolean;
  tenantName: string;
  talleres: Taller[];
  tallerSeleccionadoId: string;
  setTallerSeleccionadoId: (id: string) => void;
  planLoading: boolean;
  hasPermission: (permission: PermissionValue) => boolean;
  canAccessPath: (pathname: string) => boolean;
};

export const TenantContext = createContext<TenantContextValue | null>(null);

export type TenantProviderProps = {
  children: React.ReactNode;
  initialUserRole?: UserRoleValue | null;
  initialPlanSub?: SubscriptionPlanValue | null;
};

export function TenantProvider({
  children,
  initialUserRole = null,
  initialPlanSub = null,
}: TenantProviderProps) {
  const [tenantName, setTenantName] = useState("B2Car");
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(false);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>("");
  const [planSub, setPlanSub] = useState<SubscriptionPlanValue | null>(initialPlanSub ?? null);
  const [userRole, setUserRole] = useState<UserRoleValue | null>(initialUserRole ?? null);
  const [planLoading] = useState(false);

  useEffect(() => {
    setUserRole(initialUserRole ?? null);
  }, [initialUserRole]);

  useEffect(() => {
    setPlanSub(initialPlanSub ?? null);
  }, [initialPlanSub]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tenant_name");
      const next = stored?.trim();
      if (next) setTenantName(next);
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await tenantClient.getAll();
      if (error) throw new Error(error);
      const list = data ?? [];
      setTalleres(list);
      setTallerSeleccionadoId((prev) => prev || (list[0]?.id ?? ""));
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const hasPermission = useCallback(
    (permission: PermissionValue): boolean => checkPermission(userRole, permission, planSub),
    [userRole, planSub],
  );

  const canAccessPath = useCallback(
    (pathname: string): boolean => {
      const required = permissionForPath(pathname);
      return !required || hasPermission(required);
    },
    [hasPermission]
  );

  const value = useMemo(
    () => ({
      loading,
      tenantName,
      talleres,
      tallerSeleccionadoId,
      setTallerSeleccionadoId,
      planLoading,
      hasPermission,
      canAccessPath,
    }),
    [loading, tenantName, talleres, tallerSeleccionadoId, planLoading, hasPermission, canAccessPath]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant debe usarse dentro de TenantProvider");
  }
  return ctx;
}
