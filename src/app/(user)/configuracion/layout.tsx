"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, IdCard, ReceiptText, Tags } from "lucide-react";
import { css } from "@emotion/react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTenant } from "@/app/providers/TenantProvider";
import { Permission } from "@/lib/permissions";
import { COLOR } from "@/theme/theme";
import { ROUTES } from "@/routing/routes";

type ConfigurationTab = {
  label: string;
  href: string;
  permissions: readonly (typeof Permission)[keyof typeof Permission][];
  icon: React.ReactNode;
};

export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const { hasPermission } = useTenant();

  const tabs: ConfigurationTab[] = [
    {
      label: "Taller",
      href: ROUTES.configuracionTaller,
      permissions: [Permission.TallerView],
      icon: <Building2 size={18} aria-hidden="true" />,
    },
    {
      label: "Empleados",
      href: ROUTES.configuracionEmpleados,
      permissions: [Permission.EmpleadosView],
      icon: <IdCard size={18} aria-hidden="true" />,
    },
    {
      label: "Categorías de arreglos",
      href: ROUTES.configuracionCategoriasArreglo,
      permissions: [Permission.TallerView],
      icon: <Tags size={18} aria-hidden="true" />,
    },
    {
      label: "Facturación",
      href: ROUTES.configuracionFacturacion,
      permissions: [Permission.ConfiguracionView, Permission.FacturasView],
      icon: <ReceiptText size={18} aria-hidden="true" />,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.permissions.every(hasPermission));

  return (
    <div css={styles.root}>
      <ScreenHeader title="Configuración" breadcrumbs={["Administración"]} />
      <nav css={styles.tabs} aria-label="Secciones de configuración">
        {visibleTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              css={[styles.tab, isActive && styles.tabActive]}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      <main>{children}</main>
    </div>
  );
}

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    gap: 16,
  }),
  tabs: css({
    display: "flex",
    gap: 24,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 4,
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  }),
  tab: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    padding: "10px 4px 12px",
    marginBottom: -1,
    borderBottom: "2px solid transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 15,
    fontWeight: 500,
    textDecoration: "none",
    transition: "color 150ms ease, border-color 150ms ease",
    "&:hover": { color: COLOR.TEXT.PRIMARY },
    "&:focus-visible": {
      outline: `2px solid ${COLOR.ACCENT.PRIMARY}`,
      outlineOffset: 2,
      borderRadius: 4,
    },
  }),
  tabActive: css({
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 600,
    borderBottomColor: COLOR.ACCENT.PRIMARY,
    "&:hover": { color: COLOR.ACCENT.PRIMARY },
  }),
};
