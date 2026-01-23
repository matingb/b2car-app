"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  const [talleres] = useState<Taller[]>(TALLERES_MOCK);
  const [tallerSeleccionadoId, setTallerSeleccionadoId] = useState<string>(
    TALLERES_MOCK[0]?.id ?? ""
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

  useEffect(() => {
    if (!tallerSeleccionadoId && talleres[0]?.id) {
      setTallerSeleccionadoId(talleres[0].id);
    }
  }, [tallerSeleccionadoId, talleres]);

  const value = useMemo(
    () => ({
      tenantName,
      talleres,
      tallerSeleccionadoId,
      setTallerSeleccionadoId,
    }),
    [tenantName, talleres, tallerSeleccionadoId]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}

