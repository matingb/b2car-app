import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";

export default function VehiculosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientesProvider>
      <VehiculosProvider>
        <ArreglosProvider>
          <InventarioProvider>
            {children}
          </InventarioProvider>
        </ArreglosProvider>
      </VehiculosProvider>
    </ClientesProvider>
  );
}
