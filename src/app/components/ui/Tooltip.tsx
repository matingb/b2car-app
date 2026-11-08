"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
} from "@floating-ui/react-dom";
import { COLOR } from "@/theme/theme";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipTrigger = "hover" | "click" | "both";

export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  placement?: TooltipPlacement;
  trigger?: TooltipTrigger;
  delayMs?: number;
  maxWidth?: number | string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
  dataTestId?: string;
  role?: string;
  id?: string;
  showArrow?: boolean;
}

export default function Tooltip({
  content,
  children,
  placement = "top",
  trigger = "hover",
  delayMs = 80,
  maxWidth = 280,
  disabled = false,
  className,
  style,
  wrapperStyle,
  wrapperClassName,
  dataTestId,
  role = "tooltip",
  id: customId,
  showArrow = true,
}: TooltipProps) {
  const generatedId = useId();
  const tooltipId = customId ?? `tooltip-${generatedId}`;

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isVisible = !disabled && Boolean(content) && (isHovered || isPinned);

  const arrowRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { refs, floatingStyles, middlewareData, placement: actualPlacement } =
    useFloating({
      placement,
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 12 }),
        arrow({ element: arrowRef }),
      ],
    });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (!isPinned) return;

    const handleDocClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const triggerEl = refs.reference.current as HTMLElement | null;
      const floatingEl = refs.floating.current as HTMLElement | null;

      if (triggerEl?.contains(target) || floatingEl?.contains(target)) {
        return;
      }
      setIsPinned(false);
    };

    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("touchstart", handleDocClick);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("touchstart", handleDocClick);
    };
  }, [isPinned, refs.reference, refs.floating]);

  // Cierre con Escape
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHovered(false);
        setIsPinned(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    if (trigger === "click") return;
    clearTimer();
    if (delayMs > 0) {
      timerRef.current = setTimeout(() => {
        setIsHovered(true);
      }, delayMs);
    } else {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === "click") return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (trigger === "hover") return;
    e.stopPropagation();
    setIsPinned((prev) => !prev);
  };

  const arrowData = middlewareData.arrow;
  const side = actualPlacement.split("-")[0];
  const staticSide =
    side === "top"
      ? "bottom"
      : side === "bottom"
      ? "top"
      : side === "left"
      ? "right"
      : "left";

  return (
    <>
      <span
        ref={refs.setReference}
        className={wrapperClassName}
        style={{
          ...styles.trigger,
          ...wrapperStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => {
          if (trigger !== "click") setIsHovered(true);
        }}
        onBlur={() => {
          if (trigger !== "click") setIsHovered(false);
        }}
        onClick={trigger !== "hover" ? handleClick : undefined}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </span>

      {isVisible && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={refs.setFloating}
              id={tooltipId}
              role={role}
              data-testid={dataTestId ?? "ui-tooltip"}
              className={className}
              onMouseEnter={() => {
                if (trigger !== "click") {
                  clearTimer();
                  setIsHovered(true);
                }
              }}
              onMouseLeave={() => {
                if (trigger !== "click") {
                  clearTimer();
                  timerRef.current = setTimeout(() => {
                    setIsHovered(false);
                  }, 120);
                }
              }}
              style={{
                ...styles.tooltip,
                ...floatingStyles,
                maxWidth,
                ...style,
              }}
            >
              {content}
              {showArrow && (side === "top" || side === "bottom") && (
                <span
                  ref={arrowRef}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: arrowData?.x != null ? `${arrowData.x}px` : "50%",
                    top: arrowData?.y != null ? `${arrowData.y}px` : undefined,
                    [staticSide]: "-5px",
                    ...(side === "top"
                      ? styles.arrowTopOuter
                      : styles.arrowBottomOuter),
                  }}
                >
                  <span
                    style={
                      side === "top"
                        ? styles.arrowTopInner
                        : styles.arrowBottomInner
                    }
                  />
                </span>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

const styles = {
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
  },
  tooltip: {
    width: "max-content",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 500,
    borderRadius: 8,
    padding: "7px 11px",
    boxShadow:
      "0 6px 20px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)",
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    zIndex: 3000,
    pointerEvents: "auto",
    userSelect: "text",
    wordBreak: "break-word",
    transition: "opacity 0.15s ease",
  },
  arrowTopOuter: {
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: `5px solid ${COLOR.BORDER.DEFAULT}`,
  },
  arrowTopInner: {
    position: "absolute",
    bottom: 1,
    left: -5,
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: `5px solid ${COLOR.BACKGROUND.PRIMARY}`,
  },
  arrowBottomOuter: {
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderBottom: `5px solid ${COLOR.BORDER.DEFAULT}`,
  },
  arrowBottomInner: {
    position: "absolute",
    top: 1,
    left: -5,
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderBottom: `5px solid ${COLOR.BACKGROUND.PRIMARY}`,
  },
} as const;
