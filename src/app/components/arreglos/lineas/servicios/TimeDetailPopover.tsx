"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { css } from "@emotion/react";
import { Clock, ChevronDown } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeNumber } from "@/lib/numbers";
import { COLOR } from "@/theme/theme";

interface TimeDetailPopoverProps {
  billedHours: number | string;
  actualHours: number | string;
  unitPrice: number | string;
  quantity: number | string;
  employeeHourlyRate?: number | string | null;
  disabled?: boolean;
  onChangeBilledHours: (hours: string) => void;
  onChangeActualHours: (hours: string) => void;
}

export const TimeDetailPopover: React.FC<TimeDetailPopoverProps> = ({
  billedHours,
  actualHours,
  unitPrice,
  quantity,
  employeeHourlyRate = 0,
  disabled = false,
  onChangeBilledHours,
  onChangeActualHours,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const numBilled = safeNumber(billedHours);
  const numActual = safeNumber(actualHours);
  const numPrice = safeNumber(unitPrice);
  const numQty = safeNumber(quantity) || 1;
  const numRate = safeNumber(employeeHourlyRate);

  // Actualizar la posición flotante del popover usando portal para evitar clipping/stacking
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const viewportWidth = window.innerWidth || 0;
      const popoverWidth = 270;
      const estimatedPopoverHeight = 220;

      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
      const spaceAbove = Math.max(0, rect.top - 8);
      const placeAbove = spaceBelow < estimatedPopoverHeight && spaceAbove > spaceBelow;

      let left = rect.left;
      if (viewportWidth > 0 && left + popoverWidth > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - popoverWidth - 12);
      }

      setPopoverStyle({
        position: "fixed",
        top: placeAbove ? undefined : rect.bottom + 6,
        bottom: placeAbove ? viewportHeight - rect.top + 6 : undefined,
        left,
        width: popoverWidth,
        maxWidth: "calc(100vw - 24px)",
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
  }, [isOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Cálculos de precio y costo
  const billedRevenue = numBilled * numPrice * numQty;
  const laborCost = numActual * numRate;

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      ref={triggerRef}
    >
      {/* Botón Trigger estilo tag */}
      <button
        type="button"
        id="time-detail-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        css={styles.hoursTag(isOpen)}
        title="Ver y editar horas facturadas y horas trabajadas"
      >
        <Clock size={13} color={COLOR.TEXT.SECONDARY} style={{ flexShrink: 0 }} />
        <span>
          Fact: <strong css={styles.hoursBold}>{numBilled}h</strong> · Trab:{" "}
          <strong css={styles.hoursBold}>{numActual}h</strong>
        </span>
        <ChevronDown
          size={12}
          color={COLOR.TEXT.SECONDARY}
          style={{
            transition: "transform 150ms ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Desplegable minimalista versión en línea */}
      {isOpen && typeof document !== "undefined" &&
        createPortal(
          <div
            id="time-detail-popover"
            ref={popoverRef}
            css={styles.popover}
            style={popoverStyle ?? {}}
          >
          <div>
            {/* Fila Facturada */}
            <div css={styles.row}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>
                  Facturada
                </span>
                <span style={{ fontSize: 11, color: COLOR.TEXT.SECONDARY }}>
                  ({formatArs(billedRevenue, { maxDecimals: 0, minDecimals: 0 })})
                </span>
              </div>
              <div css={styles.inputWrap}>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={billedHours === 0 || billedHours === "0" ? "" : billedHours}
                  onChange={(e) => onChangeBilledHours(e.target.value)}
                  css={styles.input}
                />
                <span css={styles.unitSuffix}>h</span>
              </div>
            </div>

            {/* Fila Trabajada */}
            <div css={styles.row}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>
                  Trabajada
                </span>
                <span style={{ fontSize: 11, color: COLOR.TEXT.SECONDARY }}>
                  ({formatArs(laborCost, { maxDecimals: 0, minDecimals: 0 })})
                </span>
              </div>
              <div css={styles.inputWrap}>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={actualHours === 0 || actualHours === "0" ? "" : actualHours}
                  onChange={(e) => onChangeActualHours(e.target.value)}
                  css={styles.input}
                />
                <span css={styles.unitSuffix}>h</span>
              </div>
            </div>
          </div>

          {/* Botón de cierre */}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              id="confirm-time-detail-btn"
              onClick={() => setIsOpen(false)}
              css={styles.confirmBtn}
            >
              Listo
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const styles = {
  hoursTag: (open: boolean) =>
    css({
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      backgroundColor: open ? COLOR.BACKGROUND.PRIMARY : COLOR.BACKGROUND.SUBTLE,
      border: `1px solid ${COLOR.BORDER.SUBTLE}`,
      color: COLOR.TEXT.SECONDARY,
      cursor: "pointer",
      transition: "background-color 150ms ease, border-color 150ms ease",
      "&:hover": {
        backgroundColor: COLOR.BACKGROUND.PRIMARY,
        borderColor: COLOR.BORDER.DEFAULT,
      },
      "&:disabled": {
        opacity: 0.6,
        cursor: "not-allowed",
      },
    }),
  hoursBold: css({
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
  }),
  popover: css({
    position: "fixed",
    width: 270,
    maxWidth: "calc(100vw - 24px)",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
    padding: 12,
    zIndex: 2000,
  }),
  row: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 6,
  }),
  inputWrap: css({
    position: "relative",
    width: 60,
    flexShrink: 0,
  }),
  input: css({
    width: "100%",
    paddingLeft: 6,
    paddingRight: 16,
    paddingTop: 3,
    paddingBottom: 3,
    backgroundColor: "#ffffff",
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    textAlign: "right",
    outline: "none",
    "&:focus": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
  }),
  unitSuffix: css({
    position: "absolute",
    right: 5,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 10,
    color: COLOR.TEXT.SECONDARY,
    pointerEvents: "none",
  }),
  confirmBtn: css({
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 12,
    padding: "5px 14px",
    cursor: "pointer",
    transition: "background-color 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.ACCENT.HOVER,
    },
  }),
} as const;

export default TimeDetailPopover;
