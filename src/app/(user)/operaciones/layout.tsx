import React from "react";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";
import { TenantProvider } from "@/app/providers/TenantProvider";

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
    return (
        <OperacionesProvider>
            <TenantProvider>
                {children}
            </TenantProvider>
        </OperacionesProvider>);
}
