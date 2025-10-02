"use client";

import { useState, useMemo } from "react";
import { ROUTES } from "@/routing/routes";
import SidebarItem from "@/app/(user)/components/SidebarItem";
import Header from "@/app/(user)/components/Header";
import { SessionProvider } from "@/app/(user)/providers/SessionProvider";
import {
  ACCENT_PRIMARY,
  BACKGROUND_PRIMARY,
  BACKGROUND_SECONDARY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_CONTRAST,
} from "@/theme/theme";
import Divider from "@mui/material/Divider";
import { Users, Car, LogOut, PanelLeft, AlignJustify } from "lucide-react"; // o tus propios íconos
import { supabase } from "@/supabase/client";
import { ClientesProvider } from "@/app/(user)/providers/CllientesProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const s = useMemo(() => {
    const width = collapsed ? "4.5rem" : "14rem";
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
      <div style={s.appRoot}>
        <div style={s.pageContent}>
          <aside style={s.sidebar} aria-label="Sidebar">
            <div style={s.card}>
              <div style={s.sidebarHeaderRow}>
                <div
                  style={s.brandBadge}
                  onClick={() => setCollapsed(v => !v)}
                  title={collapsed ? "Expandir" : "Colapsar"}
                  aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                >
                  <PanelLeft size={18} />
                </div>
                {!collapsed && (
                  <Divider orientation="vertical" flexItem style={{ margin: "0.5rem 0.5rem", overflow: "hidden", textOverflow: "ellipsis"}} />
                )}
                <div style={s.brandTextWrap}>
                  <div style={s.title}>TallerPro</div>
                </div>
              </div>

              <nav style={s.navList}>
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
                <Divider style={{ width: collapsed ? "2rem" : "100%", margin: collapsed ? "0.5rem 0" : "0.5rem 0" }} />
                <SidebarItem
                  href={""}
                  label="Cerrar sesión"
                  icon={<LogOut size={18} />}
                  collapsed={collapsed}
                  onClick={() => { supabase.auth.signOut() }}
                />
              </nav>
            </div>
          </aside>

          <main style={s.main}>
            <div style={s.cardMain}>{children}</div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}

const styles = {
  appRoot: {
    backgroundColor: BACKGROUND_PRIMARY,
    color: TEXT_PRIMARY,
    minHeight: "100vh",
  },
  pageContent: {
    marginLeft: "auto",
    marginRight: "auto",
    display: "flex",
    maxWidth: "72rem",
    columnGap: "2rem",
    padding: "1.5rem",
  },
  sidebar: {
    width: "14rem",
  },
  card: {
    backgroundColor: BACKGROUND_SECONDARY,
    borderRadius: "1rem",
    padding: "1.25rem",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  cardMain: {
    backgroundColor: BACKGROUND_SECONDARY,
    borderRadius: "1rem",
    padding: "1.5rem",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  brandBadge: {
    //backgroundColor: ACCENT_PRIMARY,
    color: ACCENT_PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "3rem",
    width: "100%",
    maxWidth: "2rem",
    userSelect: "none",
  },
  sidebarHeaderRow: {
    marginBottom: "1.5rem",
    display: "flex",
    wrap: "wrap",
    alignItems: "center",
    justifyItems: "left"
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    fontWeight: 600,
    marginLeft: "0.5rem",
  },
  subtitle: {
    color: TEXT_SECONDARY,
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
  },
} as const;
