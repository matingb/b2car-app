"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

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
  return (
    <nav css={styles.navContainer} aria-label="Secciones del cliente">
      <button
        type="button"
        onClick={() => onChangeTab("vehiculos")}
        css={[styles.tabButton, activeTab === "vehiculos" && styles.tabButtonActive]}
      >
        <span>Vehículos</span>
        {vehiculosCount != null && vehiculosCount > 0 ? (
          <span css={[styles.countBadge, activeTab === "vehiculos" && styles.countBadgeActive]}>
            {vehiculosCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => onChangeTab("arreglos")}
        css={[styles.tabButton, activeTab === "arreglos" && styles.tabButtonActive]}
      >
        <span>Arreglos</span>
        {arreglosCount != null && arreglosCount > 0 ? (
          <span css={[styles.countBadge, activeTab === "arreglos" && styles.countBadgeActive]}>
            {arreglosCount}
          </span>
        ) : null}
      </button>

      <Can permission={Permission.ClientesFinanzasView}>
        <button
          type="button"
          onClick={() => onChangeTab("cuenta_corriente")}
          css={[styles.tabButton, activeTab === "cuenta_corriente" && styles.tabButtonActive]}
        >
          <span>Cuenta Corriente</span>
        </button>
      </Can>
    </nav>
  );
}

const styles = {
  navContainer: css({
    display: "flex",
    gap: 28,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    marginBottom: -1,
    transition: "color 150ms ease, border-color 150ms ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
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
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
  }),
  countBadgeActive: css({
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
  }),
};
