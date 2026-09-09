import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { ArreglosProvider } from "@/app/providers/ArreglosProvider";
import { CategoriasArregloProvider } from "@/app/providers/CategoriasArregloProvider";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";

export default function ClientesPage({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientesProvider>
      <ArreglosProvider>
        <CategoriasArregloProvider>
          <EmpleadosProvider>
            {children}
          </EmpleadosProvider>
        </CategoriasArregloProvider>
      </ArreglosProvider>
    </ClientesProvider>
  );
}