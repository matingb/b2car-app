"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import { getStockStatusLabel, type StockStatus } from "@/lib/stock";

type Props = {
  status: StockStatus;
  small?: boolean;
};

export default function StockStatusPill({ status, small = false }: Props) {
  const bg =
    status === "critico"
      ? COLOR.ICON.DANGER
      : status === "bajo"
        ? "#b45309"
        : status === "alto"
          ? COLOR.ACCENT.PRIMARY
          : "#15803d";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: small ? "4px 10px" : "6px 12px",
        borderRadius: 999,
        background: bg,
        color: COLOR.TEXT.CONTRAST,
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {getStockStatusLabel(status)}
    </span>
  );
}

