import React from "react";
import { ProveedoresProvider } from "@/app/providers/ProveedoresProvider";

export default function ProveedoresLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProveedoresProvider>{children}</ProveedoresProvider>;
}
