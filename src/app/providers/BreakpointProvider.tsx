"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BREAKPOINTS } from "@/theme/theme";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

interface BreakpointContextType {
  width: number;
  breakpoint: Breakpoint;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isXxl: boolean;
  isMobile: boolean;
}

const BreakpointContext = createContext<BreakpointContextType | undefined>(undefined);

export function BreakpointProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    // Set initial width
    setWidth(window.innerWidth);

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getBreakpoint = (w: number): Breakpoint => {
    if (w === 0) return "xs"; // fallback during SSR
    if (w >= BREAKPOINTS.xxl) return "xxl";
    if (w >= BREAKPOINTS.xl) return "xl";
    if (w >= BREAKPOINTS.lg) return "lg";
    if (w >= BREAKPOINTS.md) return "md";
    if (w >= BREAKPOINTS.sm) return "sm";
    return "xs";
  };

  const breakpoint = getBreakpoint(width);

  const value: BreakpointContextType = {
    width,
    breakpoint,
    isXs: breakpoint === "xs",
    isSm: breakpoint === "sm",
    isMd: breakpoint === "md",
    isLg: breakpoint === "lg",
    isXl: breakpoint === "xl",
    isXxl: breakpoint === "xxl",
    isMobile: width > 0 && width < BREAKPOINTS.md,
  };

  return (
    <BreakpointContext.Provider value={value}>
      {children}
    </BreakpointContext.Provider>
  );
}

export function useBreakpoint() {
  const context = useContext(BreakpointContext);
  if (context === undefined) {
    throw new Error("useBreakpoint must be used within a BreakpointProvider");
  }
  return context;
}
