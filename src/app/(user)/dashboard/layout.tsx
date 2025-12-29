import { DashboardProvider } from "@/app/providers/DashboardProvider";
import React from "react";

export default function DashboardPage({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardProvider>
      {children}
    </DashboardProvider>
  );
}