import React from "react";
import { ProveedoresProvider } from "@/app/providers/ProveedoresProvider";
import { ProductosProvider } from "@/app/providers/ProductosProvider";

export default function ProveedoresLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProductosProvider>
      <ProveedoresProvider>{children}</ProveedoresProvider>
    </ProductosProvider>
  );
}
