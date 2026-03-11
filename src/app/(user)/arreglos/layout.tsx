import React from "react";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { FormulariosProvider } from "@/app/providers/FormulariosProvider";

export default function ArreglosLayout({ children }: { children: React.ReactNode }) {
  return (
    <VehiculosProvider>
      <InventarioProvider>
        <ArreglosProvider>
          <FormulariosProvider>
            {children}
          </FormulariosProvider>
        </ArreglosProvider>
      </InventarioProvider>
    </VehiculosProvider>
  );
}
