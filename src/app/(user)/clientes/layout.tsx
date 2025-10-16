import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";

export default function ClientesPage({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <ClientesProvider>
        {children}
      </ClientesProvider>
  );
}