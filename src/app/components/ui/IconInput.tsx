"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  icon: React.ReactNode;
  wrapperStyle?: React.CSSProperties;
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

export default function IconInput({
  icon,
  wrapperStyle,
  invalid = false,
  ...inputProps
}: Props) {
  const { style: inputStyle, disabled, ...rest } = inputProps;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid ${invalid ? COLOR.ICON.DANGER : COLOR.BORDER.SUBTLE}`,
        borderRadius: 8,
        background: COLOR.INPUT.PRIMARY.BACKGROUND,
        padding: "0 12px",
        height: 42,
        minWidth: 0,
        opacity: disabled ? 0.7 : 1,
        ...wrapperStyle,
      }}
    >
      <span
        style={{
          display: "flex",
          color: COLOR.TEXT.SECONDARY,
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        {icon}
      </span>
      <input
        {...rest}
        disabled={disabled}
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          border: "none",
          background: "transparent",
          outline: "none",
          padding: 0,
          fontSize: 14,
          color: COLOR.TEXT.PRIMARY,
          ...inputStyle,
        }}
      />
    </div>
  );
}
