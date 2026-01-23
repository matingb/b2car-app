"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import { getStockPercentage, getStockStatus, type StockLevels } from "@/lib/stock";

type Props = {
  levels: StockLevels;
  height?: number;
  showMinLine?: boolean;
};

export default function StockProgressBar({ levels, height = 8, showMinLine = true }: Props) {
  const percentage = getStockPercentage(levels);
  const status = getStockStatus(levels);

  const fill =
    status === "critico"
      ? COLOR.ICON.DANGER
      : status === "bajo"
        ? "#b45309"
        : status === "alto"
          ? COLOR.ACCENT.PRIMARY
          : "#15803d";

  const minPct =
    levels.stockMaximo > 0
      ? Math.min((levels.stockMinimo / levels.stockMaximo) * 100, 100)
      : 0;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          height,
          borderRadius: 999,
          background: COLOR.BACKGROUND.PRIMARY,
          overflow: "hidden",
          border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: fill,
            borderRadius: 999,
            transition: "width 150ms ease",
          }}
        />
      </div>

      {showMinLine && levels.stockMaximo > 0 && (
        <div
          title="Mínimo"
          style={{
            position: "absolute",
            top: 0,
            left: `${minPct}%`,
            height,
            width: 2,
            background: COLOR.ICON.DANGER,
            transform: "translateX(-1px)",
          }}
        />
      )}
    </div>
  );
}

