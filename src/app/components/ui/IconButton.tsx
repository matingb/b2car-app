"use client";

import React, { ReactNode } from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  icon: ReactNode;
  size?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
};

export default function IconButton({
  icon,
  size = 18,
  onClick,
  title,
  ariaLabel,
}: Props) {
  const hasInteraction = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasInteraction}
      style={{
        background: "transparent",
        border: "none",
        cursor: hasInteraction ? "pointer" : "default",
        padding: 8,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: hasInteraction ? "all 0.2s" : "none",
        color: hasInteraction ? COLOR.ICON.MUTED : COLOR.ICON.MUTED,
        opacity: hasInteraction ? 1 : 0.5,
      }}
      onMouseEnter={
        hasInteraction
          ? (e) => {
              e.currentTarget.style.color = COLOR.ACCENT.PRIMARY;
            }
          : undefined
      }
      onMouseLeave={
        hasInteraction
          ? (e) => {
              e.currentTarget.style.color = COLOR.ICON.MUTED;
            }
          : undefined
      }
      aria-label={ariaLabel}
      title={title}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(icon as React.ReactElement<any>, {
            size,
            color: "currentColor",
          })
        : icon}
    </button>
  );
}


