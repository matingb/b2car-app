"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import { getStockPercentage, getStockStatus, type StockLevels } from "@/lib/stock";
import { css } from "@emotion/react";

type Props = {
  levels: StockLevels;
  height?: number;
  showMinLine?: boolean;
};

export default function StockProgressBar({
  levels,
  height = 8,
  showMinLine = true,
}: Props) {
  const percentage = getStockPercentage(levels);
  const status = getStockStatus(levels);

  const fill =
    status === "critico"
      ? COLOR.STATUS.DANGER.SOLID_BG
      : status === "bajo"
        ? COLOR.STATUS.WARNING.SOLID_BG
        : status === "alto"
          ? COLOR.STATUS.INFO.SOLID_BG
          : COLOR.STATUS.SUCCESS.SOLID_BG;

  const minPct =
    levels.stockMaximo > 0
      ? Math.min((levels.stockMinimo / levels.stockMaximo) * 100, 100)
      : 0;

  return (
    <div css={styles.container}>
      <div css={styles.track} style={{ height }}>
        <div
          css={styles.fill}
          style={{
            width: `${percentage}%`,
            background: fill,
          }}
        />
      </div>

      {showMinLine && levels.stockMaximo > 0 && levels.stockMinimo > 0 && (
        <div
          title="Mínimo"
          css={styles.minLine}
          style={{
            left: `${minPct}%`,
            height,
          }}
        />
      )}
    </div>
  );
}

const styles = {
  container: css({
    position: "relative",
    width: "100%",
  }),
  track: css({
    borderRadius: 999,
    background: COLOR.BACKGROUND.PRIMARY,
    overflow: "hidden",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  fill: css({
    height: "100%",
    borderRadius: 999,
    transition: "width 150ms ease",
  }),
  minLine: css({
    position: "absolute",
    top: 0,
    width: 2,
    background: COLOR.STATUS.DANGER.SOLID_BG,
    transform: "translateX(-1px)",
    borderRadius: 1,
    zIndex: 1,
  }),
};

