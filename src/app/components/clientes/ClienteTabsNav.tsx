"use client";

import React from "react";
import { css } from "@emotion/react";
import { Car, CreditCard, Receipt, Wrench } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

export type ClienteTabKey = "vehiculos" | "arreglos" | "ventas" | "cuenta_corriente";

type Props = {
  activeTab: ClienteTabKey;
  onChangeTab: (tab: ClienteTabKey) => void;
};

export default function ClienteTabsNav({
  activeTab,
  onChangeTab,
}: Props) {
  return (
    <nav css={styles.navContainer} aria-label="Secciones del cliente">
      <button
        type="button"
        onClick={() => onChangeTab("vehiculos")}
        css={[styles.tabButton, activeTab === "vehiculos" && styles.tabButtonActive]}
        data-testid="cliente-tab-vehiculos"
      >
        <Car size={17} />
        <span>Vehículos</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab("arreglos")}
        css={[styles.tabButton, activeTab === "arreglos" && styles.tabButtonActive]}
        data-testid="cliente-tab-arreglos"
      >
        <Wrench size={17} />
        <span>Arreglos</span>
      </button>

      <Can permission={Permission.OperacionesView}>
        <button
          type="button"
          onClick={() => onChangeTab("ventas")}
          css={[styles.tabButton, activeTab === "ventas" && styles.tabButtonActive]}
          data-testid="cliente-tab-ventas"
        >
          <Receipt size={17} />
          <span>Ventas</span>
        </button>
      </Can>

      <Can permission={Permission.ClientesFinanzasView}>
        <button
          type="button"
          onClick={() => onChangeTab("cuenta_corriente")}
          css={[styles.tabButton, activeTab === "cuenta_corriente" && styles.tabButtonActive]}
          data-testid="cliente-tab-cuentacorriente"
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
};
