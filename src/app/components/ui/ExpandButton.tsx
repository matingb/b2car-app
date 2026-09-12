"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type Props = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "title" | "onToggle"
> & {
  isExpanded: boolean;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
  size?: number;
  mobileOnly?: boolean;
  dataTestId?: string;
};

export default function ExpandButton({
  isExpanded,
  onToggle,
  title,
  ariaLabel,
  size = 20,
  mobileOnly = true,
  dataTestId = "expand-btn",
  ...rest
}: Props) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggle(event);
  };

  const resolvedTitle =
    title ?? (isExpanded ? "Menos detalles" : "Más detalles");
  const resolvedAriaLabel =
    ariaLabel ?? (isExpanded ? "Colapsar detalles" : "Expandir detalles");

  return (
    <button
      type="button"
      css={[styles.expandButton, mobileOnly && styles.mobileOnly]}
      onClick={handleClick}
      title={resolvedTitle}
      aria-label={resolvedAriaLabel}
      aria-expanded={isExpanded}
      data-testid={dataTestId}
      {...rest}
    >
      <ChevronDown
        size={size}
        css={[styles.chevronIcon, isExpanded && styles.chevronIconExpanded]}
      />
    </button>
  );
}

const styles = {
  expandButton: css({
    display: "flex",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    color: COLOR.ICON.MUTED,
    transition: "all 0.2s ease",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
    "&:active": {
      transform: "scale(0.95)",
    },
  }),
  mobileOnly: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
    },
  }),
  chevronIcon: css({
    transition: "transform 240ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  chevronIconExpanded: css({
    transform: "rotate(180deg)",
  }),
} as const;
