import React from "react";
import { TurnosProvider } from "@/app/providers/TurnosProvider";

export default function TurnosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <TurnosProvider>{children}</TurnosProvider>;
}

