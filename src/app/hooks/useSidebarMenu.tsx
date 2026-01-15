"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routing/routes";
import {
  Car,
  ChartNoAxesCombined,
  LogOut,
  Users,
  Wrench,
} from "lucide-react";
import { logOut } from "@/app/login/actions";
import { useRouter } from "next/navigation";

export enum SidebarMenuKey {
  Dashboard = "dashboard",
  Clientes = "clientes",
  Vehiculos = "vehiculos",
  Arreglos = "arreglos",
  Logout = "logout",
}

export type SidebarMenuItem = {
  key: SidebarMenuKey;
  href: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};


export function useSidebarMenu() {

  const [tenantName, setTenantName] = useState("B2Car");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tenant_name");
      const next = stored?.trim();
      if (next) setTenantName(next);
    } catch {
      // ignore (e.g. blocked storage)
    }
  }, []);

  const items: SidebarMenuItem[] = useMemo(() => {
    const handleLogout = async () => {
      if (isLoggingOut) return;
      setIsLoggingOut(true);
      try {
        await logOut();
        router.push(ROUTES.login);
      } catch {
        // if logout fails, allow retry
        setIsLoggingOut(false);
      }
    };

    return [
      {
        key: SidebarMenuKey.Dashboard,
        href: ROUTES.dashboard,
        label: "Dashboard",
        icon: <ChartNoAxesCombined size={18} />,
        onClick: () => router.push(ROUTES.dashboard),
      },
      {
        key: SidebarMenuKey.Clientes,
        href: ROUTES.clientes,
        label: "Clientes",
        icon: <Users size={18} />,
        onClick: () => router.push(ROUTES.clientes),
      },
      {
        key: SidebarMenuKey.Vehiculos,
        href: ROUTES.vehiculos,
        label: "Vehículos",
        icon: <Car size={18} />,
        onClick: () => router.push(ROUTES.vehiculos),
      },
      {
        key: SidebarMenuKey.Arreglos,
        href: ROUTES.arreglos,
        label: "Arreglos",
        icon: <Wrench size={18} />,
        onClick: () => router.push(ROUTES.arreglos),
      },
      {
        key: SidebarMenuKey.Logout,
        href: "",
        label: "Cerrar sesión",
        icon: <LogOut size={18} />,
        onClick: handleLogout,
        disabled: isLoggingOut,
        isLoading: isLoggingOut,
      },
    ];
  }, [isLoggingOut, router]);

  return { tenantName, items, isLoggingOut } as const;
}

