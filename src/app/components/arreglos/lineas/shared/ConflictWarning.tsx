"use client";

import React from "react";
import Color from "color";
import { AlertTriangle } from "lucide-react";
import { COLOR } from "@/theme/theme";

type Props = {
  message: string;
};

export default function ConflictWarning({ message }: Props) {
  return (
    <div style={styles.wrap}>
      <AlertTriangle size={16} style={styles.icon} />
      <span>{message}</span>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${Color(COLOR.SEMANTIC.WARNING).alpha(0.4).string()}`,
    background: Color(COLOR.SEMANTIC.WARNING).alpha(0.03).string(),
    color: COLOR.SEMANTIC.WARNING,
    fontSize: 13,
    fontWeight: 600,
  } as const,
  icon: {
    color: COLOR.SEMANTIC.WARNING,
    flexShrink: 0,
  } as const,
};
