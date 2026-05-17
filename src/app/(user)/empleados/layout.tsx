import React from "react";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";

export default function EmpleadosLayout({ children }: { children: React.ReactNode }) {
  return <EmpleadosProvider>{children}</EmpleadosProvider>;
}
