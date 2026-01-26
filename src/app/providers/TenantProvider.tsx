"use client";

import { tenantClient } from "@/clients/tenantClient";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Taller = {
  id: string;
  nombre: string;
};

type TenantContextValue = {
  tenantName: string;
  talleres: Taller[];
  tallerSeleccionadoId: string;
  setTallerSeleccionadoId: (id: string) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

const TALLERES_MOCK: Taller[] = [
  { id: "TAL-001", nombre: "Taller Centro" },
  { id: "TAL-002", nombre: "Taller Norte" },
  { id: "TAL-003", nombre: "Taller Sur" },
];

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantName, setTenantName] = useState("B2Car");
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(false);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>("");

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

  const value = useMemo(
    () => ({
      loading,
      tenantName,
      talleres,
      tallerSeleccionadoId,
      setTallerSeleccionadoId,
    }),
    [loading, tenantName, talleres, tallerSeleccionadoId, setTallerSeleccionadoId]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}

