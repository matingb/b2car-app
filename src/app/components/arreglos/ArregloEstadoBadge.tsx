"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ESTADOS_ARREGLO, type EstadoArreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";

type BadgeSize = "sm" | "md";

type Props = {
  estado?: EstadoArreglo;
  size?: BadgeSize;
  onStateChange?: (next: EstadoArreglo) => void;
  progress?: number;
};

type EstadoMeta = {
  label: string;
  dotColor: string;
  bgColor: string;
};

const SIZE_MAP: Record<
  BadgeSize,
  { padding: string; gap: number; dot: number; fontSize: number; icon: number }
> = {
  sm: { padding: "4px 10px", gap: 6, dot: 12, fontSize: 12, icon: 14 },
  md: { padding: "6px 10px", gap: 8, dot: 14, fontSize: 13, icon: 16 },
};

export default function ArregloEstadoBadge({
  estado,
  size = "md",
  onStateChange,
  progress,
}: Props) {
  const meta = getArregloEstadoMeta(estado);
  const token = SIZE_MAP[size];
  const safeEstado = estado ?? "SIN_INICIAR";
  const effectiveProgress = clampProgress(progress ?? getArregloEstadoProgress(safeEstado));
  const isInteractive = Boolean(onStateChange);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInteractive || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInteractive, isOpen]);

  const options = useMemo(
    () =>
      ESTADOS_ARREGLO.map((value) => ({
        value,
        meta: getArregloEstadoMeta(value),
        progress: getArregloEstadoProgress(value),
      })),
    []
  );

  if (!isInteractive) {
    return (
      <div style={getBadgeStyle(meta.bgColor, token)}>
        <ProgressCircle
          color={meta.dotColor}
          trackColor={meta.bgColor}
          size={token.dot}
          progress={effectiveProgress}
        />
        <span style={getLabelStyle(token.fontSize)}>{meta.label}</span>
      </div>
    );
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (next: EstadoArreglo) => {
    onStateChange?.(next);
    setIsOpen(false);
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
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Cambiar estado de arreglo. Estado actual: ${meta.label}`}
        style={{
          ...getBadgeStyle(meta.bgColor, token),
          border: "none",
          cursor: "pointer",
          boxShadow: isHovered
            ? `inset 0 0 0 1px ${meta.dotColor}, 0 4px 10px rgba(0, 0, 0, 0.08)`
            : "none",
          filter: isHovered ? "brightness(0.98)" : "none",
          transition: "box-shadow 0.18s ease, filter 0.18s ease",
        }}
      >
        <ProgressCircle
          color={meta.dotColor}
          trackColor={meta.bgColor}
          size={token.dot}
          progress={effectiveProgress}
        />
        <span style={getLabelStyle(token.fontSize)}>{meta.label}</span>
        <ChevronDown
          size={token.icon}
          color={COLOR.TEXT.PRIMARY}
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="Opciones de estado de arreglo"
          style={{
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
          }}
        >
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
                onClick={() => handleSelect(option.value)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: token.gap,
                  padding: token.padding,
                  border: "none",
                  borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
                  background: isSelected
                    ? option.meta.bgColor
                    : COLOR.BACKGROUND.SECONDARY,
                  cursor: "pointer",
                  transition: "filter 0.15s ease",
                }}
              >
                <ProgressCircle
                  color={option.meta.dotColor}
                  trackColor={option.meta.bgColor}
                  size={token.dot}
                  progress={option.progress}
                />
                <span style={getLabelStyle(token.fontSize)}>{option.meta.label}</span>
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
  const clampedProgress = clampProgress(progress);
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

function getBadgeStyle(bgColor: string, token: (typeof SIZE_MAP)[BadgeSize]) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: token.gap,
    width: "fit-content",
    padding: token.padding,
    borderRadius: 999,
    background: bgColor,
    flexShrink: 0,
  } satisfies React.CSSProperties;
}

function getLabelStyle(fontSize: number) {
  return {
    fontSize,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap",
  } satisfies React.CSSProperties;
}

export function getArregloEstadoMeta(estado: EstadoArreglo | undefined): EstadoMeta {
  const safeEstado = estado ?? "SIN_INICIAR";
  const label = safeEstado.replaceAll("_", " ");

  switch (safeEstado) {
    case "PRESUPUESTO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.WARNING,
        bgColor: COLOR.BACKGROUND.WARNING_TINT,
      };
    case "SIN_INICIAR":
      return {
        label,
        dotColor: COLOR.SEMANTIC.DISABLED,
        bgColor: COLOR.BACKGROUND.DISABLED_TINT,
      };
    case "EN_PROGRESO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: COLOR.BACKGROUND.INFO_TINT,
      };
    case "ESPERA":
      return {
        label,
        dotColor: COLOR.SEMANTIC.ALERT,
        bgColor: COLOR.BACKGROUND.ALERT_TINT,
      };
    case "TERMINADO":
      return {
        label,
        dotColor: COLOR.SEMANTIC.SUCCESS,
        bgColor: COLOR.BACKGROUND.SUCCESS_TINT,
      };
    default:
      return {
        label,
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: COLOR.BACKGROUND.INFO_TINT,
      };
  }
}

export function getArregloEstadoProgress(estado: EstadoArreglo | undefined): number {
  switch (estado ?? "SIN_INICIAR") {
    case "PRESUPUESTO":
      return 0;
    case "SIN_INICIAR":
      return 10;
    case "EN_PROGRESO":
      return 50;
    case "ESPERA":
      return 60;
    case "TERMINADO":
      return 100;
    default:
      return 0;
  }
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}
