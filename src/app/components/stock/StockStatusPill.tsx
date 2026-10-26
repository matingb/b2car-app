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
      ? COLOR.STATUS.DANGER.SOLID_BG
      : status === "bajo"
        ? COLOR.STATUS.WARNING.SOLID_BG
        : status === "alto"
          ? COLOR.STATUS.INFO.SOLID_BG
          : COLOR.STATUS.SUCCESS.SOLID_BG;

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

