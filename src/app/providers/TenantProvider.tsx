"use client";

import { tenantClient } from "@/clients/tenantClient";
import { hasFeature as hasSubscriptionFeature, normalizeSubscriptionPlan, type FeatureValue, type SubscriptionPlanValue } from "@/lib/subscription";
import { createClient } from "@/supabase/client";
import { TenantFeatureProvider } from "@/app/providers/TenantFeatureContext";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Taller } from "@/model/types";

type TenantContextValue = {
  tenantName: string;
  talleres: Taller[];
  tallerSeleccionadoId: string;
  setTallerSeleccionadoId: (id: string) => void;
  planSub: SubscriptionPlanValue | null;
  planLoading: boolean;
  hasFeature: (feature: FeatureValue) => boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantName, setTenantName] = useState("B2Car");
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(false);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>("");
  const [planSub, setPlanSub] = useState<SubscriptionPlanValue | null>(null);
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
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setPlanLoading(false);
      return;
    }

    const supabase = createClient();
    let active = true;

    const loadPlan = async () => {
      const { data, error } = await supabase.auth.getClaims();
      if (!active) return;
      const claims = data?.claims as Record<string, unknown> | undefined;
      setPlanSub(error ? null : normalizeSubscriptionPlan(claims?.plan_sub));
      setPlanLoading(false);
    };

    void loadPlan();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setPlanSub(null);
        setPlanLoading(false);
        return;
      }
      void loadPlan();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const hasFeature = useCallback(
    (feature: FeatureValue) => hasSubscriptionFeature(planSub, feature),
    [planSub],
  );

  const value = useMemo(
    () => ({
      loading,
      tenantName,
      talleres,
      tallerSeleccionadoId,
      setTallerSeleccionadoId,
      planSub,
      planLoading,
      hasFeature,
    }),
    [loading, tenantName, talleres, tallerSeleccionadoId, planSub, planLoading, hasFeature]
  );

  return (
    <TenantFeatureProvider hasFeature={hasFeature}>
      <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
    </TenantFeatureProvider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}

