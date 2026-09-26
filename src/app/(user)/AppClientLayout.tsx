"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SidebarItem from "@/app/components/ui/SidebarItem";
import { ModalMessageProvider } from "@/app/providers/ModalMessageProvider";
import { SheetProvider } from "@/app/providers/SheetProvider";
import { TenantProvider, useTenant } from "@/app/providers/TenantProvider";
import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";
import Divider from "@/app/components/ui/Divider";
import { PanelLeft } from "lucide-react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import { css } from "@emotion/react";
import { SidebarMenuKey, useSidebarMenu } from "@/app/hooks/useSidebarMenu";
import TenantNameText from "@/app/components/ui/TenantNameText";
import type { PermissionValue } from "@/lib/permissions";

export type AppClientLayoutProps = {
  children: React.ReactNode;
  initialPermissions?: PermissionValue[];
};

export default function AppClientLayout({
  children,
  initialPermissions,
}: AppClientLayoutProps) {
  return (
    <TenantProvider initialPermissions={initialPermissions}>
      <CuentasFinancierasProvider>
        <ModalMessageProvider>
          <SheetProvider>
            <AppShell>{children}</AppShell>
          </SheetProvider>
        </ModalMessageProvider>
      </CuentasFinancierasProvider>
    </TenantProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const { tenantName, items } = useSidebarMenu();
  const { canAccessPath } = useTenant();
  const pathname = usePathname();
  const router = useRouter();

  const isAllowed = !pathname || canAccessPath(pathname);

  useEffect(() => {
    if (!isAllowed) {
      const fallback = canAccessPath("/dashboard") ? "/dashboard" : "/arreglos";
      router.replace(fallback);
    }
  }, [isAllowed, canAccessPath, router]);

  const s = useMemo(() => {
    const width = collapsed ? "75px" : "14rem";
    return {
      ...styles,
      sidebar: { ...styles.sidebar, width, transition: "width 300ms ease-out" },
      navList: {
        ...styles.navList,
        rowGap: collapsed ? "0.5rem" : "0.5rem",
        alignItems: collapsed ? "center" : "stretch",
      },
      brandBadge: {
        ...styles.brandBadge,
        cursor: "pointer",
      },
      brandTextWrap: {
        display: collapsed ? "none" : "block",
        flex: 1,
        minWidth: 0,
      },
    } as typeof styles & {
      brandTextWrap: React.CSSProperties;
    };
  }, [collapsed]);

  return (
    <div style={s.appRoot}>
      <div css={s.pageContent}>
        <aside
          css={s.sidebarResponsive}
          style={s.sidebar}
          aria-label="Sidebar"
        >
          <div style={s.card}>
            <div style={s.sidebarHeaderRow}>
              <div
                style={s.brandBadge}
                onClick={() => setCollapsed((v) => !v)}
                title={collapsed ? "Expandir" : "Colapsar"}
                aria-label={
                  collapsed ? "Expandir sidebar" : "Colapsar sidebar"
                }
              >
                <PanelLeft style={{ width: "3rem" }} size={18} />
              </div>
              {!collapsed && (
                <Divider
                  orientation="vertical"
                  style={{
                    margin: "0.5rem 0.5rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                />
              )}
              <div style={s.brandTextWrap}>
                <TenantNameText
                  name={tenantName}
                  maxFontSize={20}
                  minFontSize={6}
                  style={s.title}
                />
              </div>
            </div>

            <nav css={s.navList}>
              {items.map((item) => {
                const showDivider =
                  item.dividerBefore ||
                  item.key === SidebarMenuKey.Logout ||
                  item.key === SidebarMenuKey.Clientes ||
                  item.key === SidebarMenuKey.Productos;
                return (
                  <div key={item.key}>
                    {showDivider ? (
                      <Divider
                        style={{
                          width: collapsed ? "100%" : "100%",
                          marginBottom: collapsed ? "0.5rem" : "0.5rem",
                        }}
                      />
                    ) : null}
                    <SidebarItem
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      disabled={item.disabled}
                      isLoading={item.isLoading}
                      collapsed={collapsed}
                      onClick={item.onClick}
                    />
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        <main style={s.main}>
          <div css={s.cardMain}>{isAllowed ? children : null}</div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  appRoot: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
  },
  pageContent: css({
    marginLeft: "auto",
    marginRight: "auto",
    display: "flex",
    maxWidth: "90rem",
    columnGap: "2rem",
    padding: "1.5rem",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      padding: "0.75rem",
    },
  }),
  sidebar: {
    width: "14rem",
  },
  sidebarResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  card: {
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    borderRadius: "1rem",
    padding: "1.25rem",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  cardMain: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    borderRadius: "1rem",
    padding: "1.5rem",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    overflowY: "auto",
    overflowX: "hidden",
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      padding: "1rem",
    },
  }),
  brandBadge: {
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "3rem",
    width: "100%",
    maxWidth: "3rem",
    userSelect: "none",
  },
  sidebarHeaderRow: {
    marginBottom: "0.5rem",
    display: "flex",
    wrap: "wrap",
    alignItems: "center",
    justifyItems: "left",
  },
  title: {
    color: COLOR.TEXT.PRIMARY,
    marginLeft: "0.5rem",
  },
  subtitle: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    rowGap: "0.5rem",
  },
  main: {
    flex: 1,
    height: "100%",
    minWidth: 0,
  },
} as const;
