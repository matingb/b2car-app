"use client";

import React from "react";
import { css } from "@emotion/react";
import Color from "color";
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
  accountOrWorkshop: MetaItemConfig | null;
  totalMonto: number;
  isSinCargo?: boolean;
};

export default function OperacionMeta({
  metaBadge,
  accountOrWorkshop,
  totalMonto,
  isSinCargo,
}: Props) {
  const BadgeIcon = metaBadge.icon;
  const OriginIcon = accountOrWorkshop?.icon;

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
