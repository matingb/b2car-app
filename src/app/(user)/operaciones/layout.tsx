import React from "react";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";
import { ProductosProvider } from "@/app/providers/ProductosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
    return (
        <OperacionesProvider>
                <ProductosProvider>
                    <InventarioProvider>
                        {children}
                    </InventarioProvider>
                </ProductosProvider>
        </OperacionesProvider>);
}
