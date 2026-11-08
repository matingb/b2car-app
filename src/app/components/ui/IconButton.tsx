"use client";

import React, { ReactNode } from "react";
import { COLOR } from "@/theme/theme";
import Tooltip, { type TooltipPlacement } from "@/app/components/ui/Tooltip";

type Props = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "title"
> & {
  icon: ReactNode;
  size?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  tooltip?: React.ReactNode;
  tooltipPlacement?: TooltipPlacement;
  ariaLabel?: string;
  hoverColor?: string;
};

export default function IconButton({
  icon,
  size = 18,
  onClick,
  title,
  tooltip,
  tooltipPlacement = "top",
  ariaLabel,
  "aria-label": ariaLabelAttr,
  hoverColor,
  style,
  disabled,
  ...rest
}: Props) {
  const hasInteraction = !!onClick;
  const isDisabled = !!disabled || !hasInteraction;
  const tooltipText = typeof tooltip === "string" ? tooltip : undefined;
  const computedAriaLabel = ariaLabel ?? ariaLabelAttr ?? tooltipText ?? title;

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      style={{
        backgroundColor: "transparent",
        border: "none",
        cursor: !isDisabled ? "pointer" : "default",
        padding: 8,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: !isDisabled ? "all 0.2s" : "none",
        color: COLOR.ICON.MUTED,
        opacity: !isDisabled ? 1 : 0.5,
        ...style,
      }}
      onMouseEnter={
        !isDisabled
          ? (e) => {
              e.currentTarget.style.color = hoverColor || COLOR.ACCENT.PRIMARY;
            }
          : undefined
      }
      onMouseLeave={
        !isDisabled
          ? (e) => {
              e.currentTarget.style.color = COLOR.ICON.MUTED;
            }
          : undefined
      }
      aria-label={computedAriaLabel}
      title={title}
      {...rest}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(
            icon as React.ReactElement<
              React.SVGProps<SVGSVGElement> & { size: number }
            >,
            {
              size,
              color: "currentColor",
            }
          )
        : icon}
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement={tooltipPlacement}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
