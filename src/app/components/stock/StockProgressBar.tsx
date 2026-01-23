"use client";

import React from "react";
import type { StockItem } from "@/model/stock";
import { COLOR } from "@/theme/theme";
import { getStockPercentage, getStockStatus } from "@/lib/stock";

type Props = {
  item: StockItem;
  height?: number;
  showMinLine?: boolean;
};

export default function StockProgressBar({ item, height = 8, showMinLine = true }: Props) {
  const percentage = getStockPercentage(item);
  const status = getStockStatus(item);

  const fill =
    status === "critico"
      ? COLOR.ICON.DANGER
      : status === "bajo"
        ? "#b45309"
        : status === "alto"
          ? COLOR.ACCENT.PRIMARY
          : "#15803d";

  const minPct = item.stockMaximo > 0 ? Math.min((item.stockMinimo / item.stockMaximo) * 100, 100) : 0;

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

      {showMinLine && item.stockMaximo > 0 && (
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

