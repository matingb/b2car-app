"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";

export type BadgeVariant = "subtle" | "outline" | "solid";
export type BadgeColor = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children?: React.ReactNode;
  title?: string;
  value?: React.ReactNode;
  showTitle?: boolean;
  hideTitleOn?: "mobile" | "tablet";
  icon?: React.ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  onClick?: (e: React.MouseEvent) => void;
  dataTestId?: string;
  style?: React.CSSProperties;
  className?: string;
  titleStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
}

const COLOR_PALETTES = {
  success: COLOR.STATUS.SUCCESS,
  warning: COLOR.STATUS.WARNING,
  danger: COLOR.STATUS.DANGER,
  info: COLOR.STATUS.INFO,
  neutral: COLOR.STATUS.NEUTRAL,
  primary: COLOR.STATUS.PRIMARY,
} as const;

export default function Badge({
  children,
  title,
  value,
  showTitle = true,
  hideTitleOn,
  icon,
  variant = "subtle",
  color = "neutral",
  size = "md",
  onClick,
  dataTestId = "badge",
  style,
  className,
  titleStyle,
  valueStyle,
}: BadgeProps) {
  const palette = COLOR_PALETTES[color] || COLOR_PALETTES.neutral;
  const isInteractive = Boolean(onClick);

  let bg = "transparent";
  let textColor: string = COLOR.TEXT.PRIMARY;
  let border = "1px solid transparent";

  if (variant === "subtle") {
    bg = palette.bgSubtle;
    textColor = palette.textSubtle;
    border = "1px solid transparent";
  } else if (variant === "solid") {
    bg = palette.solidBg;
    textColor = palette.solidText;
    border = `1px solid ${palette.solidBg}`;
  } else if (variant === "outline") {
    bg = "transparent";
    textColor = COLOR.TEXT.PRIMARY;
    border = `1px solid ${palette.borderColor}`;
  }

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: size === "sm" ? 5 : 6,
    whiteSpace: "nowrap",
    fontSize: size === "sm" ? 12 : 13,
    fontWeight: 600,
    lineHeight: 1,
    padding: size === "sm" ? "3px 8px" : "5px 10px",
    borderRadius: 999,
    backgroundColor: bg,
    color: textColor,
    border,
    cursor: isInteractive ? "pointer" : "default",
    transition: "all 0.15s ease-in-out",
    boxSizing: "border-box",
    ...style,
  };

  const isCompound = value !== undefined;
  const cleanTitle = title ? title.trim().replace(/:$/, "") : null;

  
  const tooltip =
    isCompound && cleanTitle && (typeof value === "string" || typeof value === "number")
      ? `${cleanTitle}: ${value}`
      : title ?? undefined;

  const titleResponsiveCss =
    hideTitleOn === "tablet"
      ? css({
          display: "inline",
          [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
            display: "none",
          },
        })
      : hideTitleOn === "mobile"
        ? css({
            display: "inline",
            [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
              display: "none",
            },
          })
        : undefined;

  const visualTitle = isCompound && cleanTitle ? `${cleanTitle}: ` : null;

  const content = (
    <>
      {icon && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      {visualTitle && showTitle && (
        <span
          css={titleResponsiveCss}
          style={{
            fontWeight: 400,
            ...titleStyle,
          }}
        >
          {visualTitle}
        </span>
      )}
      {isCompound ? (
        <span style={{ fontWeight: 700, ...valueStyle }}>{value}</span>
      ) : (
        children
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        data-testid={dataTestId}
        data-isolate-hover="true"
        className={className}
        style={badgeStyle}
        onMouseOver={(e) => e.stopPropagation()}
        onMouseOut={(e) => e.stopPropagation()}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={tooltip}
      data-testid={dataTestId}
      className={className}
      style={badgeStyle}
    >
      {content}
    </span>
  );
}
