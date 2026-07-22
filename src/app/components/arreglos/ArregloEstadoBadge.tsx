"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { type EstadoArreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useArregloEstado, EstadoMeta } from "./hooks/useArregloEstado";

type BadgeSize = "sm" | "md";

type Props = {
  estado?: EstadoArreglo;
  size?: BadgeSize;
  onStateChange?: (next: EstadoArreglo) => void;
  arregloId?: string;
  progress?: number;
  onOpenChange?: (isOpen: boolean) => void;
};

const SIZE_MAP: Record<
  BadgeSize,
  { padding: string; gap: number; dot: number; fontSize: number; icon: number }
> = {
  sm: { padding: "4px 10px", gap: 6, dot: 12, fontSize: 12, icon: 14 },
  md: { padding: "6px 10px", gap: 8, dot: 14, fontSize: 13, icon: 16 },
};

const getStyles = (
  token: typeof SIZE_MAP[BadgeSize],
  meta: EstadoMeta,
  isHovered: boolean,
  isInteractive: boolean,
  loading: boolean,
  isOpen: boolean
) => ({
  container: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
  } as React.CSSProperties,
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: token.gap,
    width: "fit-content",
    padding: token.padding,
    borderRadius: 8,
    background: meta.bgColor,
    flexShrink: 0,
    border: `1px solid ${isHovered && isInteractive && !loading ? meta.dotColor : COLOR.BORDER.SUBTLE
      }`,
    cursor: isInteractive && !loading ? "pointer" : "default",
    boxShadow: isHovered && isInteractive && !loading
      ? `0 2px 8px ${meta.dotColor}33`
      : "none",
    filter: isHovered && isInteractive && !loading ? "brightness(0.98)" : "none",
    transition: "box-shadow 0.18s ease, filter 0.18s ease",
    opacity: loading ? 0.7 : 1,
  } as React.CSSProperties,
  label: {
    fontSize: token.fontSize,
    fontWeight: 600,
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
    overflow: "hidden",
    zIndex: 50,
  } as React.CSSProperties,
  option: (isSelected: boolean) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: token.gap,
    padding: token.padding,
    border: "none",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: isSelected ? COLOR.BACKGROUND.SUBTLE : COLOR.BACKGROUND.SECONDARY,
    cursor: "pointer",
    transition: "filter 0.15s ease",
  } as React.CSSProperties)
});

export default function ArregloEstadoBadge({
  estado,
  size = "md",
  onStateChange,
  progress: customProgress,
  arregloId,
  onOpenChange,
}: Props) {
  const { update, loading } = useArreglos();
  const { success, error } = useToast();

  const { meta, progress, options } = useArregloEstado(estado, customProgress);
  const token = SIZE_MAP[size];
  const safeEstado = estado ?? "SIN_INICIAR";
  const isInteractive = Boolean(onStateChange || arregloId);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInteractive || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInteractive, isOpen, onOpenChange]);

  const styles = getStyles(token, meta, isHovered, isInteractive, loading, isOpen);

  const handleToggle = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const next = !isOpen;
    setIsOpen(next);
    onOpenChange?.(next);
  };

  const handleSelect = async (e: React.MouseEvent, next: EstadoArreglo) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    onOpenChange?.(false);
    if (onStateChange) {
      onStateChange(next);
      return;
    }
    if (arregloId) {
      if (loading) return;
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

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        type="button"
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
        <ProgressCircle
          color={meta.dotColor}
          trackColor={meta.bgColor}
          size={token.dot}
          progress={progress}
        />
        <span style={styles.label}>{meta.label}</span>
        <ChevronDown size={token.icon} color={COLOR.TEXT.PRIMARY} style={styles.chevron} />
      </button>

      {isOpen ? (
        <div role="listbox" aria-label="Opciones de estado de arreglo" style={styles.listbox}>
          <style>{`
            .arreglo-estado-option:hover {
              filter: brightness(0.98);
            }
          `}</style>
          {options.map((option) => {
            const isSelected = option.value === safeEstado;

            return (
              <button
                className="arreglo-estado-option"
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(e) => handleSelect(e, option.value)}
                style={styles.option(isSelected)}
              >
                <ProgressCircle
                  color={option.meta.dotColor}
                  trackColor={option.meta.bgColor}
                  size={token.dot}
                  progress={option.progress}
                />
                <span style={styles.label}>{option.meta.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: 999,
        border: `1px solid ${color}`,
        padding: 1,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: 999,
          background: `conic-gradient(${color} 0deg ${degrees}deg, ${trackColor} ${degrees}deg 360deg)`,
          display: "inline-block",
        }}
      />
    </span>
  );
}
