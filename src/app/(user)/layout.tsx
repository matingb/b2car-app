"use client";

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

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div style={styles.appRoot}>
        <Header />
        <div style={styles.pageContent}>
          <aside style={styles.sidebar}>
            <div style={styles.card}>
              <div style={styles.sidebarHeaderRow}>
                <div style={styles.brandBadge}>
                  🔧
                </div>
                <div>
                  <div style={styles.title}>TallerPro</div>
                  <div style={styles.subtitle}>Sistema de Gestión</div>
                </div>
              </div>
              <nav style={styles.navList}>
                <SidebarItem href={ROUTES.clientes} label="Clientes" />
                <SidebarItem href={ROUTES.vehiculos} label="Vehículos" />
              </nav>
            </div>
          </aside>
          <main style={styles.main}>
            <div style={styles.cardMain}>{children}</div>
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
  loading: {
    display: "flex",
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
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
    width: "16rem",
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
    backgroundColor: ACCENT_PRIMARY,
    color: TEXT_CONTRAST,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "3rem",
    width: "3rem",
    borderRadius: "0.75rem",
  },
  sidebarHeaderRow: {
    marginBottom: "1.5rem",
    display: "flex",
    alignItems: "center",
    columnGap: "0.75rem",
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    fontWeight: 600,
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


