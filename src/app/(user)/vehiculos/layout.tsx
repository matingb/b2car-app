import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { FormulariosProvider } from "@/app/providers/FormulariosProvider";

export default function VehiculosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientesProvider>
      <VehiculosProvider>
        <ArreglosProvider>
          <InventarioProvider>
            <FormulariosProvider>
            {children}
            </FormulariosProvider>
          </InventarioProvider>
        </ArreglosProvider>
      </VehiculosProvider>
    </ClientesProvider>
  );
}
