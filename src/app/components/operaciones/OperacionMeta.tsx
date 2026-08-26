"use client";

import React from "react";
import { css } from "@emotion/react";
import { Coins, type LucideIcon } from "lucide-react";
import IconLabel from "@/app/components/ui/IconLabel";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

type MetaItemConfig = {
  icon: LucideIcon;
  labelDesktop: string;
  labelMobile: string;
};

type Props = {
  metaBadge: MetaItemConfig;
  accountOrWorkshop: MetaItemConfig;
  totalMonto: number;
};

export default function OperacionMeta({
  metaBadge,
  accountOrWorkshop,
  totalMonto,
}: Props) {
  const BadgeIcon = metaBadge.icon;
  const OriginIcon = accountOrWorkshop.icon;

  const renderGroup = (isMobile: boolean) => (
    <div
      css={[styles.metaGroup, isMobile ? styles.mobileOnly : styles.desktopOnly]}
    >
      <IconLabel
        icon={<BadgeIcon size={18} color={COLOR.ICON.MUTED} />}
        label={isMobile ? metaBadge.labelMobile : metaBadge.labelDesktop}
        style={styles.metaItem}
      />
      <IconLabel
        icon={<Coins size={18} color={COLOR.ICON.MUTED} />}
        label={formatArs(totalMonto)}
        style={styles.metaAmount}
      />
      <IconLabel
        icon={<OriginIcon size={isMobile ? 14 : 16} color={COLOR.ICON.MUTED} />}
        label={isMobile ? accountOrWorkshop.labelMobile : accountOrWorkshop.labelDesktop}
        style={styles.metaTaller}
      />
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
