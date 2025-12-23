"use client";

import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type Props = {
  text: string;
  onClick: () => void;
  selected?: boolean;
};

export default function FilterChip({ text, onClick, selected = true }: Props) {
  return (
    <button
      type="button"
      css={[styles.chipBase, selected && styles.chipSelected, styles.chipResponsive]}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

const styles = {
  chipBase: css({
    padding: "8px 16px",
    borderRadius: "24px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    fontWeight: 500,
    transition:
      "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease, color 150ms ease",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      transform: "translateY(-2px)",
      boxShadow: "0 4px 12px rgba(0, 128, 162, 0.15)",
    },
  }),
  chipSelected: css({
    background: COLOR.BUTTON.PRIMARY.BACKGROUND,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    boxShadow: "none",
  }),
  chipResponsive: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: "14px",
      padding: "6px 12px",
    },
  }),
} as const;


