"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  text: string;
};

export default function Pill({ text }: Props) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.BACKGROUND.SUBTLE,
        color: COLOR.TEXT.PRIMARY,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

