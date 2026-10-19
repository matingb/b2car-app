"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

  const [position, setPosition] = useState<{
    top: number;
    left: number;
    actualPlacement: TooltipPlacement;
    arrowLeft?: number;
    arrowTop?: number;
  } | null>(null);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const windowWidth =
      typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
    const windowHeight =
      typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768;

    const numericMaxWidth = typeof maxWidth === "number" ? maxWidth : 280;
    const tooltipWidth = Math.min(numericMaxWidth, windowWidth - 24);

    let actualPlacement = placement;

    // Auto-flip vertical si no hay espacio
    if (placement === "top" && rect.top < 60 && windowHeight - rect.bottom > rect.top) {
      actualPlacement = "bottom";
    } else if (
      placement === "bottom" &&
      windowHeight - rect.bottom < 60 &&
      rect.top > windowHeight - rect.bottom
    ) {
      actualPlacement = "top";
    }

    let top = 0;
    let left = 0;
    let arrowLeft: number | undefined;
    let arrowTop: number | undefined;

    if (actualPlacement === "top") {
      top = rect.top - 8;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      arrowLeft = rect.left + rect.width / 2;
    } else if (actualPlacement === "bottom") {
      top = rect.bottom + 8;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      arrowLeft = rect.left + rect.width / 2;
    } else if (actualPlacement === "left") {
      left = rect.left - 8;
      top = rect.top + rect.height / 2;
      arrowTop = rect.top + rect.height / 2;
    } else if (actualPlacement === "right") {
      left = rect.right + 8;
      top = rect.top + rect.height / 2;
      arrowTop = rect.top + rect.height / 2;
    }

    // Clamp horizontal
    if (left < 12) left = 12;
    if (left + tooltipWidth > windowWidth - 12) {
      left = Math.max(12, windowWidth - tooltipWidth - 12);
    }

    if (arrowLeft !== undefined) {
      arrowLeft = Math.max(left + 12, Math.min(left + tooltipWidth - 12, arrowLeft));
    }

    setPosition({ top, left, actualPlacement, arrowLeft, arrowTop });
  }, [maxWidth, placement]);

  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    if (!isVisible) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  // Cierre de pinned tooltip al hacer clic afuera
  useEffect(() => {
    if (!isPinned) return;

    const handleDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      setIsPinned(false);
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [isPinned]);

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

  const transformMap: Record<TooltipPlacement, string> = {
    top: "translateY(-100%)",
    bottom: "none",
    left: "translate(-100%, -50%)",
    right: "translateY(-50%)",
  };

  const actualTransform = position
    ? transformMap[position.actualPlacement]
    : "none";

  return (
    <>
      <span
        ref={triggerRef}
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
              ref={tooltipRef}
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
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                transform: actualTransform,
                maxWidth,
                opacity: position ? 1 : 0,
                ...style,
              }}
            >
              {content}
              {showArrow && position?.actualPlacement === "top" && (
                <span
                  aria-hidden="true"
                  style={{
                    ...styles.arrowTopOuter,
                    left: (position.arrowLeft ?? 0) - position.left,
                  }}
                >
                  <span style={styles.arrowTopInner} />
                </span>
              )}
              {showArrow && position?.actualPlacement === "bottom" && (
                <span
                  aria-hidden="true"
                  style={{
                    ...styles.arrowBottomOuter,
                    left: (position.arrowLeft ?? 0) - position.left,
                  }}
                >
                  <span style={styles.arrowBottomInner} />
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
    position: "fixed",
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
    position: "absolute",
    top: "100%",
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
    position: "absolute",
    bottom: "100%",
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

