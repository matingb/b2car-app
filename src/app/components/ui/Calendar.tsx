"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { COLOR } from "@/theme/theme";

export interface CalendarProps {
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS_SEMANA_HEADERS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function parseIsoParts(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Calendar({
  value,
  onChange,
  children,
  placeholder = "Seleccionar fecha...",
  disabled = false,
  dataTestId,
}: CalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<React.CSSProperties | null>(null);

  // Inicializar el mes y año visibles a partir de la fecha seleccionada o de hoy
  const initialParts = useMemo(() => {
    const parsed = parseIsoParts(value);
    if (parsed) return parsed;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  // Cuando cambia el valor externo, sincronizar el mes visible
  useEffect(() => {
    const parsed = parseIsoParts(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Posicionamiento inteligente del popover
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const viewportWidth = window.innerWidth || 0;

      const calendarWidth = Math.min(290, viewportWidth - 32);
      const calendarHeight = 320;

      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
      const spaceAbove = Math.max(0, rect.top - 8);
      const placeAbove = spaceBelow < calendarHeight && spaceAbove > spaceBelow;

      let left = rect.left;
      if (left + calendarWidth > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - calendarWidth - 16);
      }
      if (left < 16) left = 16;

      setCoords(
        placeAbove
          ? {
              position: "fixed",
              bottom: viewportHeight - rect.top + 6,
              left,
              width: calendarWidth,
              zIndex: 3000,
            }
          : {
              position: "fixed",
              top: rect.bottom + 6,
              left,
              width: calendarWidth,
              zIndex: 3000,
            }
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const todayIso = formatIso(now.getFullYear(), now.getMonth(), now.getDate());
    onChange(todayIso);
    setIsOpen(false);
  };

  const handleSelectDay = (dayIso: string) => {
    onChange(dayIso);
    setIsOpen(false);
  };

  // Cálculo de los días del mes y días adyacentes
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Lun=0..Dom=6

    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonthNumber = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYearNumber = viewMonth === 0 ? viewYear - 1 : viewYear;

    const nextMonthNumber = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYearNumber = viewMonth === 11 ? viewYear + 1 : viewYear;

    const now = new Date();
    const todayIso = formatIso(now.getFullYear(), now.getMonth(), now.getDate());

    const result: Array<{
      iso: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Días del mes anterior para completar la primera semana
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const iso = formatIso(prevYearNumber, prevMonthNumber, d);
      result.push({
        iso,
        dayNum: d,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === value,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = formatIso(viewYear, viewMonth, d);
      result.push({
        iso,
        dayNum: d,
        isCurrentMonth: true,
        isToday: iso === todayIso,
        isSelected: iso === value,
      });
    }

    // Días del mes siguiente para completar 35 o 42 celdas
    const remaining = (7 - (result.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const iso = formatIso(nextYearNumber, nextMonthNumber, d);
      result.push({
        iso,
        dayNum: d,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === value,
      });
    }

    return result;
  }, [viewYear, viewMonth, value]);

  const calendarContent = (
    <div
      ref={popoverRef}
      style={{
        ...styles.calendarCard,
        ...(coords ?? {}),
      }}
      data-testid={dataTestId ? `${dataTestId}-popover` : "calendar-popover"}
      role="dialog"
      aria-label="Selector de fecha"
    >
      {/* Encabezado: navegación de mes */}
      <div style={styles.header}>
        <button
          type="button"
          onClick={handlePrevMonth}
          style={styles.navButton}
          aria-label="Mes anterior"
          data-testid={dataTestId ? `${dataTestId}-prev-month` : "calendar-prev-month"}
        >
          <ChevronLeft size={18} color={COLOR.TEXT.PRIMARY} />
        </button>

        <span style={styles.monthTitle}>
          {MESES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          style={styles.navButton}
          aria-label="Mes siguiente"
          data-testid={dataTestId ? `${dataTestId}-next-month` : "calendar-next-month"}
        >
          <ChevronRight size={18} color={COLOR.TEXT.PRIMARY} />
        </button>
      </div>

      {/* Días de la semana */}
      <div style={styles.weekHeadersRow}>
        {DIAS_SEMANA_HEADERS.map((dh) => (
          <div key={dh} style={styles.weekHeaderCell}>
            {dh}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div style={styles.grid}>
        {calendarDays.map((cd) => {
          return (
            <button
              key={cd.iso}
              type="button"
              onClick={() => handleSelectDay(cd.iso)}
              style={{
                ...styles.dayCell,
                ...(!cd.isCurrentMonth ? styles.dayCellOutside : {}),
                ...(cd.isToday && !cd.isSelected ? styles.dayCellToday : {}),
                ...(cd.isSelected ? styles.dayCellSelected : {}),
              }}
              data-testid={
                dataTestId ? `${dataTestId}-day-${cd.iso}` : `calendar-day-${cd.iso}`
              }
              aria-label={`${cd.dayNum} de ${MESES[viewMonth]}`}
              aria-pressed={cd.isSelected}
            >
              {cd.dayNum}
            </button>
          );
        })}
      </div>

      {/* Barra de acceso rápido: Hoy */}
      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleSelectToday}
          style={styles.todayButton}
          data-testid={dataTestId ? `${dataTestId}-today-btn` : "calendar-today-btn"}
        >
          Hoy
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        ...(disabled ? { cursor: "not-allowed" } : {}),
      }}
      onClick={() => {
        if (!disabled && !isOpen) {
          setIsOpen(true);
        }
      }}
    >
      {children ?? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          style={{
            ...styles.defaultTrigger,
            ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
          }}
          data-testid={dataTestId}
        >
          <CalendarIcon size={16} color={COLOR.TEXT.SECONDARY} style={{ flexShrink: 0 }} />
          <span style={styles.triggerText}>{value || placeholder}</span>
        </button>
      )}
      {isOpen && typeof document !== "undefined"
        ? createPortal(calendarContent, document.body)
        : null}
    </div>
  );
}

const styles = {
  container: {
    position: "relative" as const,
    display: "inline-flex",
  },
  defaultTrigger: {
    height: 38,
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    boxSizing: "border-box" as const,
    userSelect: "none" as const,
  },
  triggerText: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  calendarCard: {
    position: "relative" as const,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    padding: "12px",
    boxSizing: "border-box" as const,
    userSelect: "none" as const,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    textTransform: "capitalize" as const,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  weekHeadersRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    textAlign: "center" as const,
    marginBottom: 6,
  },
  weekHeaderCell: {
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    padding: "4px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
  },
  dayCell: {
    height: 32,
    border: "none",
    borderRadius: 6,
    backgroundColor: "transparent",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 400,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  },
  dayCellOutside: {
    color: COLOR.TEXT.TERTIARY,
    opacity: 0.5,
  },
  dayCellToday: {
    border: `1px solid ${COLOR.ACCENT.PRIMARY}`,
    fontWeight: 600,
  },
  dayCellSelected: {
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: "#ffffff",
    fontWeight: 600,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 6,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  todayButton: {
    border: "none",
    backgroundColor: "transparent",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: 4,
  },
} as const;
