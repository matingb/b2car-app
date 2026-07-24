import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { FormulariosProvider } from "@/app/providers/FormulariosProvider";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";
import { CategoriasArregloProvider } from "@/app/providers/CategoriasArregloProvider";

export default function VehiculosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientesProvider>
      <VehiculosProvider>
        <ArreglosProvider>
          <InventarioProvider>
            <FormulariosProvider>
              <EmpleadosProvider>
                <CategoriasArregloProvider>
                  {children}
                </CategoriasArregloProvider>
              </EmpleadosProvider>
            </FormulariosProvider>
          </InventarioProvider>
        </ArreglosProvider>
      </VehiculosProvider>
    </ClientesProvider>
  );
}
