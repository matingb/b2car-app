import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  label: string;
  value: string;
  icon?: React.ReactNode;
};

export default function DefinitionItem({ label, value, icon }: Props) {
  return (
    <div>
      <div style={styles.dt}>{label}</div>
      <div style={styles.dd}>
        {icon ? <span style={styles.ddIcon}>{icon}</span> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}

export const definitionItemStyles = {
  dt: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 4,
  },
} as const;

const styles = {
  ...definitionItemStyles,
  dd: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 500,
    fontSize: 16,
  },
  ddIcon: { display: "inline-flex" },
} as const;
