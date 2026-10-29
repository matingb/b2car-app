"use client";

import React from "react";
import { css } from "@emotion/react";
import { Calendar, Building2 } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import type { PermissionValue } from "@/lib/permissions";
import { useTenant } from "@/app/providers/TenantProvider";

export type CardRightInfoTaller = {
  nombre?: string | null;
  ubicacion?: string | null;
};

export type CardRightInfoProps = {
  price?: React.ReactNode;
  priceColor?: string;
  pricePermission?: PermissionValue;
  date: string;
  taller?: CardRightInfoTaller | string | null;
  hideTallerOnMobile?: boolean;
  style?: React.CSSProperties;
};

export default function CardRightInfo({
  price,
  priceColor = COLOR.ACCENT.PRIMARY,
  pricePermission,
  date,
  taller,
  hideTallerOnMobile = false,
  style,
}: CardRightInfoProps) {
  const { talleres } = useTenant();
  const hasMultipleTalleres = talleres.length > 1;

  const tallerObj: CardRightInfoTaller | null =
    typeof taller === "string" ? { nombre: taller } : taller ?? null;

  const tallerNombre = tallerObj?.nombre?.trim();
  const shouldRenderTaller = Boolean(
    hasMultipleTalleres &&
      tallerNombre &&
      tallerNombre !== "—" &&
      tallerNombre !== "-"
  );

  const priceElement =
    price != null && price !== "" ? (
      <div css={styles.priceValue(priceColor)}>{price}</div>
    ) : null;

  return (
    <div css={styles.rightInfoSection} style={style} data-testid="card-right-info">
      {pricePermission && priceElement ? (
        <Can permission={pricePermission}>{priceElement}</Can>
      ) : (
        priceElement
      )}

      <div css={styles.dateContainer}>
        <Calendar size={15} color={COLOR.ICON.MUTED} />
        <span>{date}</span>
      </div>

      {shouldRenderTaller ? (
        <div
          css={[
            styles.tallerContainer,
            hideTallerOnMobile && styles.tallerHiddenMobile,
          ]}
          title={tallerObj?.ubicacion ?? undefined}
          data-testid="card-right-info-taller"
        >
          <Building2 size={14} color={COLOR.ICON.MUTED} />
          <span>{tallerNombre}</span>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  rightInfoSection: css({
    padding: "13px 20px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      width: 190,
      minWidth: 190,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px 20px",
      textAlign: "center",
      borderTopRightRadius: 8,
    },
  }),
  priceValue: (priceColor: string) =>
    css({
      fontSize: 20,
      fontWeight: 700,
      color: priceColor,
      letterSpacing: "-0.5px",
      [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
        fontSize: 24,
      },
    }),
  dateContainer: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      fontSize: 13,
    },
  }),
  tallerContainer: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    fontSize: 12,
    marginTop: 4,
    fontWeight: 500,
    color: COLOR.TEXT.TERTIARY,
  }),
  tallerHiddenMobile: css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "flex",
    },
  }),
} as const;
