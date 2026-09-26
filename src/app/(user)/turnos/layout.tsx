import React from "react";
import { TurnosProvider } from "@/app/providers/TurnosProvider";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { CategoriasArregloProvider } from "@/app/providers/CategoriasArregloProvider";

export default function TurnosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CategoriasArregloProvider>
      <VehiculosProvider>
        <ClientesProvider>
          <TurnosProvider>
            {children}
          </TurnosProvider>
        </ClientesProvider>
      </VehiculosProvider>
    </CategoriasArregloProvider>
  );
}

