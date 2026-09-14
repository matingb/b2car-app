"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FeatureValue } from "@/lib/subscription";

const TenantFeatureContext = createContext<((feature: FeatureValue) => boolean) | null>(null);

export function TenantFeatureProvider({
  children,
  hasFeature,
}: {
  children: ReactNode;
  hasFeature: (feature: FeatureValue) => boolean;
}) {
  return (
    <TenantFeatureContext.Provider value={hasFeature}>
      {children}
    </TenantFeatureContext.Provider>
  );
}

/** Null is reserved for isolated reusable-component rendering outside the app shell. */
export function useOptionalTenantFeature() {
  return useContext(TenantFeatureContext);
}
