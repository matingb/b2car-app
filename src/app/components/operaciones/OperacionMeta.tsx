"use client";

import React from "react";
import { css } from "@emotion/react";
import Color from "color";
import { Coins, Truck, User, type LucideIcon } from "lucide-react";
import IconLabel from "@/app/components/ui/IconLabel";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import type { EstadoPagoOperacion, EstadoStockOperacion, TipoOperacion } from "@/model/types";

type MetaItemConfig = {
  icon: LucideIcon;
  labelDesktop: string;
  labelMobile: string;
};

type Props = {
  metaBadge: MetaItemConfig;
  accountOrWorkshop: MetaItemConfig | null;
  totalMonto: number;
  isSinCargo?: boolean;
  estadoPago?: EstadoPagoOperacion;
  estadoStock?: EstadoStockOperacion;
  saldoPendiente?: number;
  tipo?: TipoOperacion;
  clienteNombre?: string;
  proveedorNombre?: string;
};

export default function OperacionMeta({
  metaBadge,
  accountOrWorkshop,
  totalMonto,
  isSinCargo,
  estadoPago,
  estadoStock,
  saldoPendiente,
  tipo,
  clienteNombre,
  proveedorNombre,
}: Props) {
  const BadgeIcon = metaBadge.icon;
  const OriginIcon = accountOrWorkshop?.icon;

  const isComercial = tipo === "VENTA" || tipo === "COMPRA";

  const renderGroup = (isMobile: boolean) => (
    <div
      css={[styles.metaGroup, isMobile ? styles.mobileOnly : styles.desktopOnly]}
    >
      <IconLabel
        icon={<BadgeIcon size={18} color={COLOR.ICON.MUTED} />}
        label={isMobile ? metaBadge.labelMobile : metaBadge.labelDesktop}
        style={styles.metaItem}
      />
      {isSinCargo ? (
        <span css={styles.sinCargoChip} data-testid="chip-adquisicion-sin-cargo">
          Adquisición sin cargo
        </span>
      ) : (
        <IconLabel
          icon={<Coins size={18} color={COLOR.ICON.MUTED} />}
          label={formatArs(totalMonto)}
          style={styles.metaAmount}
        />
      )}
      {accountOrWorkshop && OriginIcon ? (
        <IconLabel
          icon={<OriginIcon size={isMobile ? 14 : 16} color={COLOR.ICON.MUTED} />}
          label={isMobile ? accountOrWorkshop.labelMobile : accountOrWorkshop.labelDesktop}
          style={styles.metaTaller}
        />
      ) : null}

      {isComercial && tipo === "VENTA" && clienteNombre ? (
        <IconLabel
          icon={<User size={isMobile ? 14 : 16} color={COLOR.ICON.MUTED} />}
          label={clienteNombre}
          style={styles.metaTaller}
        />
      ) : null}

      {isComercial && tipo === "COMPRA" && proveedorNombre ? (
        <IconLabel
          icon={<Truck size={isMobile ? 14 : 16} color={COLOR.ICON.MUTED} />}
          label={proveedorNombre}
          style={styles.metaTaller}
        />
      ) : null}

      {isComercial && estadoPago ? (
        <span
          css={[
            styles.statusChip,
            estadoPago === "PAGADO"
              ? styles.chipSuccess
              : estadoPago === "PARCIAL"
                ? styles.chipWarning
                : styles.chipDanger,
          ]}
          data-testid="operacion-estado-pago-badge"
        >
          {estadoPago === "PAGADO"
            ? (tipo === "VENTA" ? "Cobrado" : "Pagado")
            : estadoPago === "PARCIAL"
              ? (tipo === "VENTA"
                  ? `Cobro parcial (Resta ${formatArs(saldoPendiente ?? 0)})`
                  : `Pago parcial (Resta ${formatArs(saldoPendiente ?? 0)})`)
              : (tipo === "VENTA"
                  ? `Por cobrar (${formatArs(saldoPendiente ?? totalMonto)})`
                  : `Por pagar (${formatArs(saldoPendiente ?? totalMonto)})`)}
        </span>
      ) : null}

      {isComercial && estadoStock && estadoStock !== "NO_APLICA" ? (
        <span
          css={[
            styles.statusChip,
            estadoStock === "ENTREGADO"
              ? styles.chipSuccess
              : estadoStock === "PARCIAL"
                ? styles.chipWarning
                : styles.chipInfo,
          ]}
          data-testid="operacion-estado-stock-badge"
        >
          {estadoStock === "ENTREGADO"
            ? (tipo === "VENTA" ? "Entregado" : "Recibido")
            : estadoStock === "PARCIAL"
              ? (tipo === "VENTA" ? "Entrega parcial" : "Recepción parcial")
              : (tipo === "VENTA" ? "Mercadería reservada" : "En camino")}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      {renderGroup(false)}
      {renderGroup(true)}
    </>
  );
}

const styles = {
  metaGroup: css({
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  }),
  metaItem: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 17,
    fontWeight: 600,
  } as const,
  metaAmount: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 17,
    fontWeight: 600,
  } as const,
  metaTaller: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  } as const,
  sinCargoChip: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.SEMANTIC.INFO,
    backgroundColor: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    border: `1px solid ${Color(COLOR.SEMANTIC.INFO).alpha(0.25).toString()}`,
  }),
  statusChip: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.02em",
  }),
  chipSuccess: css({
    color: COLOR.SEMANTIC.SUCCESS,
    backgroundColor: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    border: `1px solid ${Color(COLOR.SEMANTIC.SUCCESS).alpha(0.25).toString()}`,
  }),
  chipWarning: css({
    color: COLOR.SEMANTIC.WARNING,
    backgroundColor: Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
    border: `1px solid ${Color(COLOR.SEMANTIC.WARNING).alpha(0.25).toString()}`,
  }),
  chipDanger: css({
    color: COLOR.SEMANTIC.DANGER,
    backgroundColor: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
    border: `1px solid ${Color(COLOR.SEMANTIC.DANGER).alpha(0.25).toString()}`,
  }),
  chipInfo: css({
    color: COLOR.SEMANTIC.INFO,
    backgroundColor: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    border: `1px solid ${Color(COLOR.SEMANTIC.INFO).alpha(0.25).toString()}`,
  }),
  desktopOnly: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  mobileOnly: css({
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      display: "none",
    },
  }),
};
