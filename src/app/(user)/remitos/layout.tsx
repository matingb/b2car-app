import React from "react";
import { ClientesProvider } from "@/app/providers/ClientesProvider";

export default function RemitosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ClientesProvider>{children}</ClientesProvider>;
}
