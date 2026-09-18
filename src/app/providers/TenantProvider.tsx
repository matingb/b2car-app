"use client";

import { tenantClient } from "@/clients/tenantClient";
import {
  permissionForPath,
  type PermissionValue,
} from "@/lib/permissions";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Taller } from "@/model/types";

export type TenantContextValue = {
  loading: boolean;
  tenantName: string;
  talleres: Taller[];
  tallerSeleccionadoId: string;
  setTallerSeleccionadoId: (id: string) => void;
  hasPermission: (permission: PermissionValue) => boolean;
  canAccessPath: (pathname: string) => boolean;
};

export const TenantContext = createContext<TenantContextValue | null>(null);

export type TenantProviderProps = {
  children: React.ReactNode;
  initialPermissions?: PermissionValue[];
};

export function TenantProvider({
  children,
  initialPermissions = [],
}: TenantProviderProps) {
  const [tenantName, setTenantName] = useState("B2Car");
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(false);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>("");
  const [permissions] = useState<Set<PermissionValue>>(
    () => new Set(initialPermissions),
  );

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
    (permission: PermissionValue): boolean => permissions.has(permission),
    [permissions],
  );

  const canAccessPath = useCallback(
    (pathname: string): boolean => {
      const required = permissionForPath(pathname);
      return !required || hasPermission(required);
    },
    [hasPermission],
  );

  const value = useMemo(
    () => ({
      loading,
      tenantName,
      talleres,
      tallerSeleccionadoId,
      setTallerSeleccionadoId,
      hasPermission,
      canAccessPath,
    }),
    [loading, tenantName, talleres, tallerSeleccionadoId, hasPermission, canAccessPath],
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
