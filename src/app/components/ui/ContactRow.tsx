import React from "react";
import { COLOR } from "@/theme/theme";
import { definitionItemStyles } from "./DefinitionItem";

type Props = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

export default function ContactRow({ icon, label, value }: Props) {
  return (
    <div style={styles.row}>
      <div style={styles.iconWrap}>{icon}</div>
      <div>
        <div style={definitionItemStyles.dt}>{label}</div>
        <div style={styles.value}>{value}</div>
      </div>
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.INFO_TINT,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  value: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
  },
} as const;
