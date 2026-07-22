import React from "react";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { FormulariosProvider } from "@/app/providers/FormulariosProvider";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";
import { TiposArregloProvider } from "@/app/providers/TiposArregloProvider";

export default function ArreglosLayout({ children }: { children: React.ReactNode }) {
  return (
    <VehiculosProvider>
      <InventarioProvider>
        <ArreglosProvider>
          <FormulariosProvider>
            <EmpleadosProvider>
              <TiposArregloProvider>
                {children}
              </TiposArregloProvider>
            </EmpleadosProvider>
          </FormulariosProvider>
        </ArreglosProvider>
      </InventarioProvider>
    </VehiculosProvider>
  );
}
