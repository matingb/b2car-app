"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";

export type ClienteTabKey = "vehiculos" | "arreglos" | "cuenta_corriente";

type Props = {
  activeTab: ClienteTabKey;
  onChangeTab: (tab: ClienteTabKey) => void;
  vehiculosCount?: number;
  arreglosCount?: number;
};

export default function ClienteTabsNav({
  activeTab,
  onChangeTab,
  vehiculosCount,
  arreglosCount,
}: Props) {
  const tabs: Array<{ key: ClienteTabKey; label: string; count?: number }> = [
    { key: "vehiculos", label: "Vehículos", count: vehiculosCount },
    { key: "arreglos", label: "Arreglos", count: arreglosCount },
    { key: "cuenta_corriente", label: "Cuenta Corriente" },
  ];

  return (
    <nav css={styles.navContainer} aria-label="Secciones del cliente">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChangeTab(tab.key)}
            css={[styles.tabButton, isActive && styles.tabButtonActive]}
          >
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 ? (
              <span css={[styles.countBadge, isActive && styles.countBadgeActive]}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  navContainer: css({
    display: "flex",
    gap: 28,
    borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
    marginBottom: 20,
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  }),
  tabButton: css({
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "10px 4px 12px 4px",
    fontSize: 15,
    fontWeight: 500,
    color: "var(--color-text-secondary, #64748b)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    marginBottom: -1,
    transition: "color 150ms ease, border-color 150ms ease",
    "&:hover": {
      color: "var(--color-text-primary, #0f172a)",
    },
  }),
  tabButtonActive: css({
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 600,
    borderBottomColor: COLOR.ACCENT.PRIMARY,
    "&:hover": {
      color: COLOR.ACCENT.PRIMARY,
    },
  }),
  countBadge: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 10,
    backgroundColor: "var(--color-background-subtle, #f1f5f9)",
    color: "var(--color-text-secondary, #64748b)",
  }),
  countBadgeActive: css({
    backgroundColor: "rgba(0, 128, 162, 0.12)",
    color: COLOR.ACCENT.PRIMARY,
  }),
};
