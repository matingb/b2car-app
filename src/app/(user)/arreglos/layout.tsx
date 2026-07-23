import React from "react";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { FormulariosProvider } from "@/app/providers/FormulariosProvider";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";
import { CategoriasArregloProvider } from "@/app/providers/CategoriasArregloProvider";

export default function ArreglosLayout({ children }: { children: React.ReactNode }) {
  return (
    <VehiculosProvider>
      <InventarioProvider>
        <ArreglosProvider>
          <FormulariosProvider>
            <EmpleadosProvider>
              <CategoriasArregloProvider>
                {children}
              </CategoriasArregloProvider>
            </EmpleadosProvider>
          </FormulariosProvider>
        </ArreglosProvider>
      </InventarioProvider>
    </VehiculosProvider>
  );
}
