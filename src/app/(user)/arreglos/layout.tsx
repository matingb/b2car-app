import React from "react";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";

export default function ArreglosLayout({ children }: { children: React.ReactNode }) {
  return (
    <VehiculosProvider>
      <ArreglosProvider>{children}</ArreglosProvider>
    </VehiculosProvider>
  );
}
