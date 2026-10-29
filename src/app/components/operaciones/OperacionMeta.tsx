"use client";

import React from "react";
import { css } from "@emotion/react";
import { Truck, User, type LucideIcon } from "lucide-react";
import IconLabel from "@/app/components/ui/IconLabel";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { TipoOperacion } from "@/model/types";

type MetaItemConfig = {
  icon: LucideIcon;
  labelDesktop: string;
  labelMobile: string;
};

type Props = {
  metaBadge: MetaItemConfig;
  accountOrWorkshop: MetaItemConfig | null;
  tipo?: TipoOperacion;
  clienteNombre?: string;
  proveedorNombre?: string;
};

export default function OperacionMeta({
  metaBadge,
  accountOrWorkshop,
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

      {tipo === "COMPRA" && proveedorNombre ? (
        <IconLabel
          icon={<Truck size={isMobile ? 14 : 16} color={COLOR.ICON.MUTED} />}
          label={proveedorNombre}
          style={styles.metaTaller}
        />
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
    fontSize: 14,
    fontWeight: 500,
  } as const,
  metaTaller: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  } as const,
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
