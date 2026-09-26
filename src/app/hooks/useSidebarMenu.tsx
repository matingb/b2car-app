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
  WalletCards,
  Settings,
  ReceiptText,
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
  dividerBefore?: boolean;
};

export function useSidebarMenu() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { tenantName, hasPermission } = useTenant();
  const canViewConfiguration = hasPermission(Permission.TallerView);
  const canViewEmployees = hasPermission(Permission.EmpleadosView);
  const canViewInvoices = hasPermission(Permission.FacturasView);

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
      ...(canViewInvoices ? [{
        key: SidebarMenuKey.Facturas,
        href: ROUTES.facturacion,
        label: "Facturas",
        icon: <ReceiptText size={18} />,
        dividerBefore: true,
        onClick: () => router.push(ROUTES.facturacion),
      }] : []),
      ...(canViewConfiguration || canViewEmployees ? [{
        key: SidebarMenuKey.Configuracion,
        href: canViewConfiguration ? ROUTES.configuracion : ROUTES.configuracionEmpleados,
        label: "Configuración",
        icon: <Settings size={18} />,
        dividerBefore: !canViewInvoices,
        onClick: () => router.push(
          canViewConfiguration ? ROUTES.configuracion : ROUTES.configuracionEmpleados,
        ),
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
  }, [canViewConfiguration, canViewEmployees, canViewInvoices, hasPermission, isLoggingOut, router]);

  return { tenantName, items, isLoggingOut } as const;
}
