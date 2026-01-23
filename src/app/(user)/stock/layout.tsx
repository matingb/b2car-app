import React from "react";
import { StockProvider } from "@/app/providers/StockProvider";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <StockProvider>{children}</StockProvider>;
}

