import React from "react";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";
import { TenantProvider } from "@/app/providers/TenantProvider";
import { ProductosProvider } from "@/app/providers/ProductosProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
    return (
        <OperacionesProvider>
            <TenantProvider>
                <ProductosProvider>
                    <InventarioProvider>
                        {children}
                    </InventarioProvider>
                </ProductosProvider>
            </TenantProvider>
        </OperacionesProvider>);
}
