import React from "react";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { ProductosProvider } from "@/app/providers/ProductosProvider";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductosProvider>
      <InventarioProvider>{children}</InventarioProvider>
    </ProductosProvider>
  );
}

