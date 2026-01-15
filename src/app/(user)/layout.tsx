"use client";

import { useMemo, useState } from "react";
import SidebarItem from "@/app/components/ui/SidebarItem";
import { SessionProvider } from "@/app/providers/SessionProvider";
import { ModalMessageProvider } from "@/app/providers/ModalMessageProvider";
import { SheetProvider } from "@/app/providers/SheetProvider";
import Divider from "@/app/components/ui/Divider";
import { PanelLeft } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { css } from '@emotion/react'
import { BREAKPOINTS } from '@/theme/theme'
import { SidebarMenuKey, useSidebarMenu } from "@/app/hooks/useSidebarMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const { tenantName, items } = useSidebarMenu();

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
                      <div style={s.title}>{tenantName}</div>
                    </div>
                  </div>

                  <nav css={s.navList}>
                    {items.map((item) => {
                      const isLogout = item.key === SidebarMenuKey.Logout;
                      return (
                        <div key={item.key}>
                          {isLogout ? (
                            <Divider
                              style={{
                                width: collapsed ? "100%" : "100%",
                                margin: collapsed ? "0.5rem 0" : "0.5rem 0",
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
                <div css={s.cardMain}>{children}</div>
              </main>

            </div>

          </div>
          </SheetProvider>
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
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      padding: "0.75rem",
    },
  }),
  sidebar: {
    width: "14rem",
  },
  sidebarResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
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
    overflowX: "hidden",
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
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
    minWidth: 0,
  },
} as const;
