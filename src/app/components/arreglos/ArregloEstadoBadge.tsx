"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Info } from "lucide-react";
import { type EstadoArreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useArregloEstado, EstadoMeta } from "./hooks/useArregloEstado";
import Tooltip from "@/app/components/ui/Tooltip";

export type BadgeSize = "sm" | "md";
export type ArregloEstadoVariant = "badge" | "field";

type Props = {
  estado?: EstadoArreglo;
  size?: BadgeSize;
  variant?: ArregloEstadoVariant;
  allowPresupuesto?: boolean;
  disabled?: boolean;
  dataTestId?: string;
  onStateChange?: (next: EstadoArreglo) => void;
  arregloId?: string;
  progress?: number;
  onOpenChange?: (isOpen: boolean) => void;
};

const SIZE_MAP: Record<
  BadgeSize,
  { padding: string; gap: number; dot: number; fontSize: number; icon: number; height: number }
> = {
  sm: { padding: "4px 10px", gap: 6, dot: 12, fontSize: 12, icon: 14, height: 26 },
  md: { padding: "6px 10px", gap: 8, dot: 14, fontSize: 13, icon: 16, height: 32 },
};

const getStyles = (
  token: typeof SIZE_MAP[BadgeSize],
  meta: EstadoMeta,
  isHovered: boolean,
  isInteractive: boolean,
  loading: boolean,
  isOpen: boolean,
  variant: ArregloEstadoVariant
) => {
  const isField = variant === "field";
  return {
    container: {
      position: "relative",
      display: isField ? "flex" : "inline-flex",
      width: isField ? "100%" : undefined,
      flexShrink: isField ? undefined : 0,
    } as React.CSSProperties,
    button: {
      display: "flex",
      alignItems: "center",
      justifyContent: isField ? "space-between" : "flex-start",
      gap: token.gap,
      width: isField ? "100%" : "fit-content",
      padding: isField ? "0 12px" : token.padding,
      height: isField ? 42 : token.height,
      borderRadius: 8,
      background: isField ? COLOR.INPUT.PRIMARY.BACKGROUND : meta.bgColor,
      flexShrink: isField ? undefined : 0,
      border: `1px solid ${
        isField
          ? isOpen
            ? COLOR.TEXT.SECONDARY
            : isHovered && isInteractive && !loading
            ? meta.dotColor
            : COLOR.BORDER.SUBTLE
          : isHovered && isInteractive && !loading
          ? meta.dotColor
          : COLOR.BORDER.SUBTLE
      }`,
      cursor: isInteractive && !loading ? "pointer" : "default",
      boxShadow: isField
        ? isOpen
          ? `0 0 0 2px ${meta.dotColor}22`
          : "none"
        : isHovered && isInteractive && !loading
        ? `0 2px 8px ${meta.dotColor}33`
        : "none",
      filter: !isField && isHovered && isInteractive && !loading ? "brightness(0.98)" : "none",
      transition: isField
        ? "border-color 0.18s ease, box-shadow 0.18s ease"
        : "box-shadow 0.18s ease, filter 0.18s ease",
      opacity: loading || !isInteractive ? 0.7 : 1,
      outline: "none",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    triggerContent: {
      display: "flex",
      alignItems: "center",
      gap: token.gap,
      minWidth: 0,
    } as React.CSSProperties,
    label: {
      fontSize: isField ? 14 : token.fontSize,
      fontWeight: isField ? 500 : 600,
      color: COLOR.TEXT.PRIMARY,
      whiteSpace: "nowrap",
    } as React.CSSProperties,
    chevron: {
      flexShrink: 0,
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
    } as React.CSSProperties,
    listbox: {
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      minWidth: "100%",
      background: COLOR.BACKGROUND.SECONDARY,
      border: `1px solid ${COLOR.BORDER.SUBTLE}`,
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
      overflowY: "auto",
      overflowX: "hidden",
      zIndex: 50,
    } as React.CSSProperties,
    option: (
      isSelected: boolean,
      isFocused: boolean,
      isFirst: boolean,
      isLast: boolean
    ) => ({
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: token.gap,
      padding: isField ? "10px 12px" : token.padding,
      border: "none",
      borderBottom: isLast ? "none" : `1px solid ${COLOR.BORDER.SUBTLE}`,
      borderTopLeftRadius: isFirst ? 11 : 0,
      borderTopRightRadius: isFirst ? 11 : 0,
      borderBottomLeftRadius: isLast ? 11 : 0,
      borderBottomRightRadius: isLast ? 11 : 0,
      background: isFocused
        ? "#e2e8f0"
        : isSelected
        ? "#f1f5f9"
        : COLOR.BACKGROUND.SECONDARY,
      cursor: "pointer",
      outline: "none",
      boxShadow: "none",
      transition: "background-color 0.15s ease",
    } as React.CSSProperties),
    infoTrigger: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2px 4px",
      borderRadius: 4,
      color: COLOR.ICON.MUTED,
      cursor: "pointer",
      transition: "color 0.15s ease, background-color 0.15s ease",
      flexShrink: 0,
    } as React.CSSProperties,
  };
};

export default function ArregloEstadoBadge({
  estado,
  size = "md",
  variant = "badge",
  allowPresupuesto,
  disabled = false,
  dataTestId = "arreglo-estado-badge",
  onStateChange,
  progress: customProgress,
  arregloId,
  onOpenChange,
}: Props) {
  const { update, loading } = useArreglos();
  const { success, error } = useToast();

  const optionsConfig = useMemo(() => ({ allowPresupuesto }), [allowPresupuesto]);
  const { meta, progress, options } = useArregloEstado(estado, customProgress, optionsConfig);
  const token = SIZE_MAP[size];
  const safeEstado = estado ?? "SIN_INICIAR";
  const isInteractive = Boolean(!disabled && (onStateChange || arregloId));
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusFirstOnOpen = useRef(false);
  const [listboxPosition, setListboxPosition] = useState<React.CSSProperties | null>(null);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setFocusedIndex(null);
    setListboxPosition(null);
    onOpenChange?.(false);
    if (restoreFocus) {
      containerRef.current?.querySelector("button")?.focus();
    }
  }, [onOpenChange]);

  const getAdjacentFocusable = (backwards: boolean) => {
    const trigger = containerRef.current?.querySelector("button");
    if (!trigger) return null;
    const focusables = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => {
      if (listboxRef.current?.contains(element) || element.tabIndex < 0) return false;
      if (element.closest("[hidden], [inert], [aria-hidden=\"true\"]")) return false;

      for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = window.getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
          return false;
        }
      }
      return true;
    });
    const index = focusables.indexOf(trigger);
    return focusables[index + (backwards ? -1 : 1)] ?? null;
  };

  useEffect(() => {
    if (!isInteractive || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !listboxRef.current?.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInteractive, isOpen, closeMenu]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = containerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 8);
      const spaceAbove = Math.max(0, rect.top - 8);
      const itemHeight = variant === "field" ? 40 : token.height + 1;
      const menuHeight = listboxRef.current?.scrollHeight ?? options.length * itemHeight + 2;
      const placeAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(0, placeAbove ? spaceAbove : spaceBelow);
      const width = Math.max(rect.width, 150);
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));

      setListboxPosition({
        position: "fixed",
        top: placeAbove ? "auto" : rect.bottom + 6,
        bottom: placeAbove ? window.innerHeight - rect.top + 6 : "auto",
        left,
        width,
        minWidth: rect.width,
        maxHeight,
        zIndex: 2000,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, options.length, token.height, variant]);

  useEffect(() => {
    if (isOpen && listboxPosition && focusFirstOnOpen.current) {
      setFocusedIndex(0);
      optionRefs.current[0]?.focus();
      focusFirstOnOpen.current = false;
    }
  }, [isOpen, listboxPosition]);

  const styles = getStyles(token, meta, isHovered, isInteractive, loading, isOpen, variant);

  const handleToggle = (e?: React.SyntheticEvent, focusFirst = false) => {
    e?.stopPropagation();
    e?.preventDefault();
    const next = !isOpen;
    if (next) {
      setListboxPosition(null);
      focusFirstOnOpen.current = focusFirst;
    }
    setIsOpen(next);
    onOpenChange?.(next);
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (index + direction + options.length) % options.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      optionRefs.current[nextIndex]?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const nextIndex = index + (event.shiftKey ? -1 : 1);
      if (nextIndex >= 0 && nextIndex < options.length) {
        setFocusedIndex(nextIndex);
        optionRefs.current[nextIndex]?.focus();
      } else {
        const target = event.shiftKey
          ? containerRef.current?.querySelector("button")
          : getAdjacentFocusable(false);
        closeMenu(false);
        target?.focus();
      }
    }
  };

  const handleSelect = async (e: React.MouseEvent, next: EstadoArreglo) => {
    e.stopPropagation();
    e.preventDefault();
    closeMenu(true);
    if (onStateChange) {
      onStateChange(next);
      return;
    }
    if (arregloId) {
      if (loading || !update) return;
      try {
        await update(arregloId, { estado: next });
        success("Estado actualizado", "El estado del arreglo se actualizó correctamente.");
      } catch {
        error("Error", "No se pudo actualizar el estado.");
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (isOpen) {
        const targetIdx = event.key === "ArrowDown" ? 0 : options.length - 1;
        setFocusedIndex(targetIdx);
        optionRefs.current[targetIdx]?.focus();
      } else {
        handleToggle(event, true);
      }
      return;
    }
    if (event.key === "Tab" && isOpen) {
      event.preventDefault();
      if (event.shiftKey) {
        closeMenu(false);
        getAdjacentFocusable(true)?.focus();
      } else {
        setFocusedIndex(0);
        optionRefs.current[0]?.focus();
      }
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        type="button"
        data-testid={dataTestId}
        disabled={!isInteractive || loading}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        data-isolate-hover="true"
        onMouseEnter={(e) => {
          e.stopPropagation();
          setIsHovered(true);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          setIsHovered(false);
        }}
        onMouseOver={(e) => e.stopPropagation()}
        onMouseOut={(e) => e.stopPropagation()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Cambiar estado de arreglo. Estado actual: ${meta.label}`}
        style={styles.button}
      >
        <div style={styles.triggerContent}>
          <ProgressCircle
            color={meta.dotColor}
            trackColor={meta.bgColor}
            size={token.dot}
            progress={progress}
          />
          <span style={styles.label}>{meta.label}</span>
        </div>
        <ChevronDown
          size={token.icon}
          color={variant === "field" ? COLOR.TEXT.SECONDARY : COLOR.TEXT.PRIMARY}
          style={styles.chevron}
        />
      </button>


      {isOpen && listboxPosition && typeof document !== "undefined" ? createPortal(
        <div
          ref={listboxRef}
          role="listbox"
          aria-label="Opciones de estado de arreglo"
          style={{ ...styles.listbox, ...listboxPosition }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === safeEstado;
            const isFocused = focusedIndex === index;
            const isFirst = index === 0;
            const isLast = index === options.length - 1;

            return (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                data-testid={`arreglo-estado-option-${option.value}`}
                aria-selected={isSelected}
                style={styles.option(isSelected, isFocused, isFirst, isLast)}
                onClick={(e) => handleSelect(e, option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(null)}
                onMouseEnter={() => setFocusedIndex(index)}
                onMouseLeave={() => setFocusedIndex((prev) => (prev === index ? null : prev))}
              >
                <ProgressCircle
                  color={option.meta.dotColor}
                  trackColor={option.meta.bgColor}
                  size={token.dot}
                  progress={option.progress}
                />
                <span style={styles.label}>{option.meta.label}</span>
                {option.value === "PRESUPUESTO" && (
                  <Tooltip
                    content="Los repuestos asignados no se descontarán del stock mientras el arreglo se encuentre como presupuesto."
                    trigger="both"
                    delayMs={0}
                    placement="top"
                    maxWidth={270}
                    dataTestId="arreglo-presupuesto-tooltip"
                    wrapperStyle={{ marginLeft: "auto" }}
                  >
                    <span
                      data-testid="arreglo-presupuesto-info-trigger"
                      role="button"
                      aria-label="Información sobre presupuesto"
                      tabIndex={-1}
                      style={styles.infoTrigger}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = COLOR.ACCENT.PRIMARY;
                        e.currentTarget.style.backgroundColor = "rgba(0, 121, 149, 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = COLOR.ICON.MUTED;
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Info size={14} data-testid="arreglo-presupuesto-info-icon" />
                    </span>
                  </Tooltip>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

const progressStyles = {
  circle: {
    borderRadius: 999,
    padding: 1,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inner: {
    borderRadius: 999,
    display: "inline-block",
  },
} as const;

function ProgressCircle({
  color,
  trackColor,
  size,
  progress,
}: {
  color: string;
  trackColor: string;
  size: number;
  progress: number;
}) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const degrees = (clampedProgress / 100) * 360;
  const innerSize = Math.max(4, size - 4);

  return (
    <span
      data-testid="arreglo-estado-progress"
      aria-hidden="true"
      style={{
        ...progressStyles.circle,
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        border: `1px solid ${color}`,
      }}
    >
      <span
        style={{
          ...progressStyles.inner,
          width: innerSize,
          height: innerSize,
          background: `conic-gradient(${color} 0deg ${degrees}deg, ${trackColor} ${degrees}deg 360deg)`,
        }}
      />
    </span>
  );
}

