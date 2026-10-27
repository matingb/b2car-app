"use client";

import React from "react";
import { css } from "@emotion/react";
import { CreditCard, Package, ScrollText } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

export type ProveedorTabKey = "productos" | "operaciones" | "cuenta_corriente" | "informacion";

type Props = {
  activeTab: ProveedorTabKey;
  onChangeTab: (tab: ProveedorTabKey) => void;
  productosCount?: number;
};

export default function ProveedorTabsNav({
  activeTab,
  onChangeTab,
  productosCount,
}: Props) {
  return (
    <nav css={styles.navContainer} aria-label="Secciones del proveedor">
      <button
        type="button"
        onClick={() => onChangeTab("productos")}
        css={[styles.tabButton, activeTab === "productos" && styles.tabButtonActive]}
        data-testid="proveedor-tab-productos"
      >
        <Package size={17} />
        <span>Productos</span>
        {productosCount != null && productosCount > 0 ? (
          <span css={[styles.countBadge, activeTab === "productos" && styles.countBadgeActive]}>
            {productosCount}
          </span>
        ) : null}
      </button>

      <Can permission={Permission.OperacionesView}>
        <button
          type="button"
          onClick={() => onChangeTab("operaciones")}
          css={[styles.tabButton, activeTab === "operaciones" && styles.tabButtonActive]}
          data-testid="proveedor-tab-operaciones"
        >
          <ScrollText size={17} />
          <span>Operaciones</span>
        </button>
      </Can>

      <Can permission={Permission.OperacionesView}>
        <button
          type="button"
          onClick={() => onChangeTab("cuenta_corriente")}
          css={[styles.tabButton, activeTab === "cuenta_corriente" && styles.tabButtonActive]}
          data-testid="proveedor-tab-cuentacorriente"
        >
          <CreditCard size={17} />
          <span>Cuenta Corriente</span>
        </button>
      </Can>
    </nav>
  );
}

const styles = {
  navContainer: css({
    display: "flex",
    gap: 32,
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
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 9999,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
  }),
  countBadgeActive: css({
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    color: COLOR.ACCENT.PRIMARY,
  }),
};
