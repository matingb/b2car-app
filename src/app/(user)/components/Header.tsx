"use client";

import { useSession } from "@/app/(user)/providers/SessionProvider";
import {
  ACCENT_PRIMARY,
  BACKGROUND_SECONDARY,
  TEXT_CONTRAST,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "@/theme/theme";

export default function Header() {
  const { signOut } = useSession();
  return (
    <header style={styles.headerContainer}>
      <div style={styles.headerContent}>
        <div style={styles.brandRow}>
          <div style={styles.brandIcon}>🔧</div>
          <div>
            <div style={styles.brandTitle}>TallerPro</div>
            <div style={styles.brandSubtitle}>Sistema de Gestión</div>
          </div>
        </div>
        <button
          onClick={signOut}
          style={styles.logoutButton}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

const styles = {
  headerContainer: {
    backgroundColor: BACKGROUND_SECONDARY,
    backdropFilter: "blur(8px)",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  headerContent: {
    marginLeft: "auto",
    marginRight: "auto",
    display: "flex",
    maxWidth: "72rem",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.5rem",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
  },
  brandIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "36px",
    width: "36px",
    borderRadius: "8px",
    backgroundColor: ACCENT_PRIMARY,
    color: TEXT_CONTRAST,
  },
  brandTitle: {
    color: TEXT_PRIMARY,
    fontSize: "18px",
    lineHeight: "28px",
    fontWeight: 600,
  },
  brandSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: "12px",
    lineHeight: "16px",
  },
  logoutButton: {
    backgroundColor: ACCENT_PRIMARY,
    color: TEXT_CONTRAST,
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 500,
    cursor: "pointer",
  },
};