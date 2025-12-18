"use client";

import { useState, useMemo } from "react";
import { ROUTES } from "@/routing/routes";
import SidebarItem from "@/app/components/ui/SidebarItem";
import { SessionProvider } from "@/app/providers/SessionProvider";
import { ModalMessageProvider } from "@/app/providers/ModalMessageProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import { SheetProvider } from "@/app/providers/SheetProvider";
import Divider from "@/app/components/ui/Divider";
import { Users, Car, LogOut, PanelLeft, Wrench } from "lucide-react";
import { logOut } from "@/app/login/actions";
import { COLOR } from "@/theme/theme";
import { css } from '@emotion/react'
import { BREAKPOINTS } from '@/theme/theme'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    } as typeof styles & {
      brandTextWrap: React.CSSProperties;
    };
  }, [collapsed]);

  return (
    <SessionProvider>
      <ModalMessageProvider>
        <ToastProvider>
          <SheetProvider>
          <div style={s.appRoot}>
            <div css={s.pageContent}>
              <aside css={s.sidebarResponsive} style={s.sidebar} aria-label="Sidebar">
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
                      <div style={s.title}>CarMax</div>
                    </div>
                  </div>

                  <nav css={s.navList}>
                    <SidebarItem
                      href={ROUTES.clientes}
                      label="Clientes"
                      icon={<Users size={18} />}
                      collapsed={collapsed}
                    />
                    <SidebarItem
                      href={ROUTES.vehiculos}
                      label="Vehículos"
                      icon={<Car size={18} />}
                      collapsed={collapsed}
                    />
                    <SidebarItem
                      href={ROUTES.arreglos}
                      label="Arreglos"
                      icon={<Wrench size={18} />}
                      collapsed={collapsed}
                    />
                    <Divider
                      style={{
                        width: collapsed ? "2rem" : "100%",
                        margin: collapsed ? "0.5rem 0" : "0.5rem 0",
                      }}
                    />
                    <SidebarItem
                      href={""}
                      label="Cerrar sesión"
                      icon={<LogOut size={18} />}
                      collapsed={collapsed}
                      onClick={() => {
                        logOut();
                      }}
                    />
                  </nav>
                </div>
              </aside>

              <main style={s.main}>
                <div css={s.cardMain}>{children}</div>
              </main>

            </div>

          </div>
          </SheetProvider>
        </ToastProvider>
      </ModalMessageProvider>
    </SessionProvider>
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
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "0.75rem",
    },
  }),
  sidebar: {
    width: "14rem",
  },
  sidebarResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: 'none',
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
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "1rem",
    },
  }),
  brandBadge: {
    //backgroundColor: ACCENT_PRIMARY,
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
    marginBottom: "1.5rem",
    display: "flex",
    wrap: "wrap",
    alignItems: "center",
    justifyItems: "left",
  },
  title: {
    color: COLOR.TEXT.PRIMARY,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    fontWeight: 600,
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
  },
} as const;
