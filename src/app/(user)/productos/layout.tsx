import React from "react";
import { ProductosProvider } from "@/app/providers/ProductosProvider";

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return <ProductosProvider>{children}</ProductosProvider>;
}

