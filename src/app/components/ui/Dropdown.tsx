"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "children"
> & {
  options: DropdownOption[];
  onChange: (value: string) => void;
  style?: React.CSSProperties;
};

export default function Dropdown({
  style,
  disabled,
  options,
  onChange,
  ...rest
}: DropdownProps) {
  return (
    <select
      {...rest}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...styles.select,
        ...(disabled ? styles.selectDisabled : {}),
        ...(style ?? {}),
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const styles = {
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  selectDisabled: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    cursor: "not-allowed",
    color: COLOR.TEXT.TERTIARY,
  },
} as const;

