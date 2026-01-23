import React from "react";
import { InventarioProvider } from "@/app/providers/InventarioProvider";

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return <InventarioProvider>{children}</InventarioProvider>;
}

