"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { Package, Truck } from "lucide-react";

export type ProductosTabKey = "productos" | "proveedores";

type Props = {
  activeTab: ProductosTabKey;
  onChangeTab: (tab: ProductosTabKey) => void;
};

export default function ProductosTabsNav({
  activeTab,
  onChangeTab,
}: Props) {
  return (
    <nav css={styles.navContainer} aria-label="Secciones de productos y abastecimiento">
      <button
        type="button"
        onClick={() => onChangeTab("productos")}
        css={[styles.tabButton, activeTab === "productos" && styles.tabButtonActive]}
        data-testid="tab-productos"
      >
        <Package size={17} />
        <span>Catálogo de Productos</span>
      </button>

      <Can permission={Permission.ProveedoresView}>
        <button
          type="button"
          onClick={() => onChangeTab("proveedores")}
          css={[styles.tabButton, activeTab === "proveedores" && styles.tabButtonActive]}
          data-testid="tab-proveedores"
        >
          <Truck size={17} />
          <span>Proveedores</span>
        </button>
      </Can>
    </nav>
  );
}

const styles = {
  navContainer: css({
    display: "flex",
    gap: 24,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 16,
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
};
