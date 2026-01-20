import React from "react";
import { TurnosProvider } from "@/app/providers/TurnosProvider";
import { ClientesProvider } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";

export default function TurnosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <VehiculosProvider>
      <ClientesProvider>
        <TurnosProvider>
          {children}
        </TurnosProvider>
      </ClientesProvider>
    </VehiculosProvider>
  )
}

