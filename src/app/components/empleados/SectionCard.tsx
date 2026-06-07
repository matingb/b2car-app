import React from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type Props = {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export default function SectionCard({ icon, title, children, action }: Props) {
  return (
    <div style={styles.card}>
      <div css={styles.titleRow}>
        <div style={styles.titleLeft}>
          {icon}
          <h3 style={styles.title}>{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

export const sectionCardStyles = {
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    padding: 16,
  },
  dlGrid: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
} as const;

const styles = {
  card: sectionCardStyles.card,
  titleRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  titleLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: 600, margin: 0 },
} as const;
