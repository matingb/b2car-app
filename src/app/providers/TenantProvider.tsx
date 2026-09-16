"use client";

import { tenantClient } from "@/clients/tenantClient";
import { normalizeSubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";
import {
  hasPermission as checkPermission,
  normalizeUserRole,
  permissionForPath,
  type PermissionValue,
  type UserRoleValue,
} from "@/lib/permissions";
import { createClient } from "@/supabase/client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Taller } from "@/model/types";

export type TenantContextValue = {
  tenantName: string;
  talleres: Taller[];
  tallerSeleccionadoId: string;
  setTallerSeleccionadoId: (id: string) => void;
  planLoading: boolean;
  hasPermission: (permission: PermissionValue) => boolean;
  canAccessPath: (pathname: string) => boolean;
};

export const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantName, setTenantName] = useState("B2Car");
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(false);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>("");
  const [planSub, setPlanSub] = useState<SubscriptionPlanValue | null>(null);
  const [userRole, setUserRole] = useState<UserRoleValue | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await tenantClient.getAll();
      if (error) throw new Error(error);
      setTalleres(data ?? []);
      return data ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setTalleres(talleres as unknown as Taller[]);
      setTallerSeleccionadoId(talleres[0]?.id ?? "");
      const stored = localStorage.getItem("tenant_name");
      const next = stored?.trim();
      if (next) setTenantName(next);
    } catch {
      // ignore
    }
  }, [talleres]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setPlanLoading(false);
      return;
    }

    const supabase = createClient();
    let active = true;

    const loadClaims = async () => {
      const { data, error } = await supabase.auth.getClaims();
      if (!active) return;
      const claims = data?.claims as Record<string, unknown> | undefined;
      setPlanSub(error ? null : normalizeSubscriptionPlan(claims?.plan_sub));
      setUserRole(error ? null : normalizeUserRole(claims?.user_role));
      setPlanLoading(false);
    };

    void loadClaims();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setPlanSub(null);
        setUserRole(null);
        setPlanLoading(false);
        return;
      }
      void loadClaims();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

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

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}
