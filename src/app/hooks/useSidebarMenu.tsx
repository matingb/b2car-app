"use client";

import { useMemo, useState } from "react";
import { ROUTES } from "@/routing/routes";
import { Permission } from "@/lib/permissions";
import {
  Car,
  CalendarDays,
  ChartNoAxesCombined,
  LogOut,
  Package,
  Users,
  Wrench,
  ScrollText,
  IdCard,
  WalletCards,
  Settings,
  ReceiptText,
  Building2,
} from "lucide-react";
import { logOut } from "@/app/login/actions";
import { useRouter } from "next/navigation";
import { useTenant } from "@/app/providers/TenantProvider";

export enum SidebarMenuKey {
  Dashboard = "dashboard",
  Turnos = "turnos",
  Clientes = "clientes",
  Vehiculos = "vehiculos",
  Arreglos = "arreglos",
  Stock = "stock",
  Productos = "productos",
  Operaciones = "operaciones",
  CuentasFinancieras = "cuentas-financieras",
  Empleados = "empleados",
  Facturas = "facturas",
  Talleres = "talleres",
  Configuracion = "configuracion",
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { tenantName, hasPermission } = useTenant();

  const items: SidebarMenuItem[] = useMemo(() => {
    const handleLogout = async () => {
      if (isLoggingOut) return;
      setIsLoggingOut(true);
      try {
        await logOut();
        router.push(ROUTES.login);
      } catch {
        setIsLoggingOut(false);
      }
    };

    return [
      ...(hasPermission(Permission.DashboardView) ? [{
        key: SidebarMenuKey.Dashboard,
        href: ROUTES.dashboard,
        label: "Dashboard",
        icon: <ChartNoAxesCombined size={18} />,
        onClick: () => router.push(ROUTES.dashboard),
      }] : []),
      ...(hasPermission(Permission.TurnosView) ? [{
        key: SidebarMenuKey.Turnos,
        href: ROUTES.turnos,
        label: "Turnos",
        icon: <CalendarDays size={18} />,
        onClick: () => router.push(ROUTES.turnos),
      }] : []),
      ...(hasPermission(Permission.ClientesView) ? [{
        key: SidebarMenuKey.Clientes,
        href: ROUTES.clientes,
        label: "Clientes",
        icon: <Users size={18} />,
        onClick: () => router.push(ROUTES.clientes),
      }] : []),
      ...(hasPermission(Permission.VehiculosView) ? [{
        key: SidebarMenuKey.Vehiculos,
        href: ROUTES.vehiculos,
        label: "Vehículos",
        icon: <Car size={18} />,
        onClick: () => router.push(ROUTES.vehiculos),
      }] : []),
      ...(hasPermission(Permission.ArreglosView) ? [{
        key: SidebarMenuKey.Arreglos,
        href: ROUTES.arreglos,
        label: "Arreglos",
        icon: <Wrench size={18} />,
        onClick: () => router.push(ROUTES.arreglos),
      }] : []),
      ...(hasPermission(Permission.ProductosView) ? [{
        key: SidebarMenuKey.Productos,
        href: ROUTES.productos,
        label: "Productos",
        icon: <Package size={18} />,
        onClick: () => router.push(ROUTES.productos),
      }] : []),
      ...(hasPermission(Permission.OperacionesView) ? [{
        key: SidebarMenuKey.Operaciones,
        href: ROUTES.operaciones,
        label: "Operaciones",
        icon: <ScrollText size={18} />,
        onClick: () => router.push(ROUTES.operaciones),
      }] : []),
      ...(hasPermission(Permission.FinanzasView) ? [{
        key: SidebarMenuKey.CuentasFinancieras,
        href: ROUTES.cuentasFinancieras,
        label: "Finanzas",
        icon: <WalletCards size={18} />,
        onClick: () => router.push(ROUTES.cuentasFinancieras),
      }] : []),
      ...(hasPermission(Permission.EmpleadosView) ? [{
        key: SidebarMenuKey.Empleados,
        href: ROUTES.empleados,
        label: "Empleados",
        icon: <IdCard size={18} />,
        onClick: () => router.push(ROUTES.empleados),
      }] : []),
      ...(hasPermission(Permission.FacturasView) ? [{
        key: SidebarMenuKey.Facturas,
        href: ROUTES.facturacion,
        label: "Facturas",
        icon: <ReceiptText size={18} />,
        onClick: () => router.push(ROUTES.facturacion),
      }] : []),
      ...(hasPermission(Permission.ConfiguracionView) ? [{
        key: SidebarMenuKey.Talleres,
        href: ROUTES.talleres,
        label: "Talleres",
        icon: <Building2 size={18} />,
        onClick: () => router.push(ROUTES.talleres),
      }] : []),
      ...(hasPermission(Permission.ConfiguracionView) ? [{
        key: SidebarMenuKey.Configuracion,
        href: ROUTES.configuracion,
        label: "Configuración",
        icon: <Settings size={18} />,
        onClick: () => router.push(ROUTES.configuracion),
      }] : []),
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
  }, [hasPermission, isLoggingOut, router]);

  return { tenantName, items, isLoggingOut } as const;
}
