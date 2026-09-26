"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { css } from "@emotion/react";
import { ChevronDown, Check, User, UserX, Search } from "lucide-react";
import { useEmpleados, getEmpleadoColor } from "@/app/providers/EmpleadosProvider";
import { COLOR } from "@/theme/theme";
import { getInitials } from "@/lib/initials";
import { formatArs } from "@/lib/format";
import { useTenant } from "@/app/providers/TenantProvider";

type Props = {
  value: string | null;
  onChange: (empleadoId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  showMontoHoras?: boolean;
  hourlyRate?: number | null;
  canViewHourlyRate?: boolean;
  canEditHourlyRate?: boolean;
  onChangeHourlyRate?: (rate: number | null) => void;
  tallerId?: string | null;
};

export default function EmpleadoSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "+ Empleado",
  showMontoHoras = false,
  hourlyRate = null,
  canViewHourlyRate = false,
  canEditHourlyRate = false,
  onChangeHourlyRate,
  tallerId,
}: Props) {
  const { empleados } = useEmpleados();
  const { tallerSeleccionadoId } = useTenant();
  const activeTallerId = tallerId ?? tallerSeleccionadoId;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = value ? empleados.find((e) => e.id === value) : null;
  const selectedName = selectedEmployee
    ? `${selectedEmployee.nombre} ${selectedEmployee.apellido}`.trim()
    : "";

  const currentRate = hourlyRate ?? (canViewHourlyRate ? selectedEmployee?.valorHora ?? null : null);

  // Estados temporales durante la edición en el popover
  const [tempSelectedId, setTempSelectedId] = useState<string | null>(value);
  const [tempRate, setTempRate] = useState<string>(currentRate == null ? "" : String(currentRate));
  const [rateEdited, setRateEdited] = useState(false);

  // Sincronizar estados temporales cuando se abre el desplegable
  useEffect(() => {
    if (isOpen) {
      setTempSelectedId(value);
      setTempRate(currentRate == null ? "" : String(currentRate));
      setRateEdited(false);
      setSearch("");
    }
  }, [isOpen, value, currentRate]);

  // Actualizar la posición flotante del popover usando portal para evitar clipping/stacking
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const viewportWidth = window.innerWidth || 0;
      const popoverWidth = 275;
      const estimatedPopoverHeight = 320;

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

  // Cerrar al hacer clic fuera del componente (considerando el portal)
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

  const handlePickEmployee = (empId: string | null) => {
    setTempSelectedId(empId);
    if (empId && hourlyRate === null) {
      const emp = empleados.find((e) => e.id === empId);
      setTempRate(emp?.valorHora == null ? "" : String(emp.valorHora));
    }
  };

  const handleConfirm = () => {
    onChange(tempSelectedId);
    if (showMontoHoras && canEditHourlyRate && rateEdited && onChangeHourlyRate) {
      const rate = tempRate.trim() === "" ? null : Number(tempRate);
      onChangeHourlyRate(rate !== null && Number.isFinite(rate) && rate >= 0 ? rate : null);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSelectedId(value);
    setTempRate(currentRate == null ? "" : String(currentRate));
    setIsOpen(false);
  };

  // Filtrado de empleados para la lista
  const filteredEmployees = useMemo(() => {
    const workshopEmployees = activeTallerId
      ? empleados.filter((e) => e.tallerId === activeTallerId)
      : empleados;
    if (!search.trim()) return workshopEmployees;
    const query = search.toLowerCase();
    return workshopEmployees.filter((e) =>
      `${e.nombre} ${e.apellido}`.toLowerCase().includes(query)
    );
  }, [activeTallerId, empleados, search]);

  const isSelected = !!selectedEmployee;
  const initials = selectedName ? getInitials(selectedName) : "";
  const avatarColor = selectedEmployee ? getEmpleadoColor(selectedEmployee.id) : null;

  return (
    <div css={styles.wrapper} ref={triggerRef}>
      {/* Botón Trigger estilo Tag / Píldora */}
      <button
        type="button"
        id="employee-select-trigger"
        aria-label={isSelected ? `empleado ${selectedName}` : placeholder}
        title={isSelected ? selectedName : placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        css={styles.trigger(isSelected, disabled)}
      >
        {isSelected ? (
          <>
            <span
              css={styles.avatarPill}
              style={{
                backgroundColor: avatarColor?.avatarBg ?? COLOR.ACCENT.PRIMARY,
                color: avatarColor?.avatarText ?? COLOR.TEXT.CONTRAST,
              }}
            >
              {initials}
            </span>
            <span css={styles.nameText}>
              {selectedName}
              {showMontoHoras && canViewHourlyRate && currentRate != null && (
                <span css={styles.rateText}>
                  {" · "}
                  {formatArs(currentRate, { maxDecimals: 2, minDecimals: 0 })}/h
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <span css={styles.unassignedIcon}>
              <User size={12} color={COLOR.ICON.MUTED} />
            </span>
            <span css={styles.placeholderText}>{placeholder}</span>
          </>
        )}
        <ChevronDown
          size={13}
          color={isSelected ? COLOR.TEXT.PRIMARY : COLOR.ICON.MUTED}
          css={styles.chevron(isOpen)}
        />
      </button>

      {/* Popover desplegable flotante con lista, edición de valor hora y confirmación */}
      {isOpen && typeof document !== "undefined" &&
        createPortal(
          <div
            id="employee-select-popover"
            ref={popoverRef}
            css={styles.popover}
            style={popoverStyle ?? {}}
          >
          {/* Header con edición de Valor Hora (exclusivo para Mano de Obra) */}
          {showMontoHoras && canViewHourlyRate && (
            <div css={styles.rateHeader}>
              <label htmlFor="employee-hourly-rate-input" css={styles.rateLabel}>
                Valor hora ($/h):
              </label>
              <div css={styles.rateInputWrap}>
                <span css={styles.ratePrefix}>$</span>
                <input
                  type="number"
                  id="employee-hourly-rate-input"
                  min="0"
                  step="0.01"
                  max="9999999999.99"
                  value={tempRate}
                  readOnly={!canEditHourlyRate}
                  onChange={(e) => {
                    setTempRate(e.target.value);
                    setRateEdited(true);
                  }}
                  placeholder="Sin configurar"
                  css={styles.rateInput}
                />
              </div>
            </div>
          )}

          {/* Campo de búsqueda cuando hay varios empleados */}
          {empleados.length > 4 && (
            <div css={styles.searchBox}>
              <Search size={13} color={COLOR.ICON.MUTED} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empleado..."
                css={styles.searchInput}
              />
            </div>
          )}

          {/* Lista de empleados */}
          <div css={styles.list}>
            {/* Opción para Desasignar */}
            <div
              onClick={() => handlePickEmployee(null)}
              css={styles.item(tempSelectedId === null)}
            >
              <div css={styles.itemLeft}>
                <span css={styles.unassignAvatar}>
                  <UserX size={12} color={COLOR.TEXT.SECONDARY} />
                </span>
                <span css={styles.itemLabel}>Sin asignar</span>
              </div>
              {tempSelectedId === null && (
                <Check size={14} color={COLOR.ACCENT.PRIMARY} />
              )}
            </div>

            {filteredEmployees.map((emp) => {
              const fullName = `${emp.nombre} ${emp.apellido}`.trim();
              const isItemChosen = emp.id === tempSelectedId;
              const color = getEmpleadoColor(emp.id);
              const empRate = emp.valorHora;

              return (
                <div
                  key={emp.id}
                  onClick={() => handlePickEmployee(emp.id)}
                  css={styles.item(isItemChosen)}
                >
                  <div css={styles.itemLeft}>
                    <span
                      css={styles.itemAvatar}
                      style={{
                        backgroundColor: isItemChosen
                          ? COLOR.ACCENT.PRIMARY
                          : color.avatarBg,
                        color: isItemChosen ? COLOR.TEXT.CONTRAST : color.avatarText,
                      }}
                    >
                      {getInitials(fullName)}
                    </span>
                    <span css={styles.itemLabel}>{fullName}</span>
                  </div>

                  <div css={styles.itemRight}>
                    {showMontoHoras && canViewHourlyRate && empRate != null && (
                      <span css={styles.itemRate}>
                        {formatArs(empRate, { maxDecimals: 2, minDecimals: 0 })}/h
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botones de acción: Cancelar y Confirmar */}
          <div css={styles.footer}>
            <button
              type="button"
              onClick={handleCancel}
              css={styles.cancelBtn}
            >
              Cancelar
            </button>
            <button
              type="button"
              id="confirm-employee-selection-btn"
              onClick={handleConfirm}
              css={styles.confirmBtn}
            >
              Confirmar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const styles = {
  wrapper: css({
    position: "relative",
    display: "inline-flex",
  }),
  trigger: (isSelected: boolean, disabled: boolean) =>
    css({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 28,
      padding: isSelected ? "3px 10px 3px 6px" : "3px 10px 3px 10px",
      borderRadius: 999,
      border: isSelected
        ? `1px solid ${COLOR.BORDER.SUBTLE}`
        : `1px dashed ${COLOR.BORDER.SUBTLE}`,
      backgroundColor: isSelected
        ? COLOR.BACKGROUND.INFO_TINT
        : COLOR.BACKGROUND.PRIMARY,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transition: "all 150ms ease",
      "&:hover": {
        backgroundColor: disabled
          ? undefined
          : isSelected
          ? COLOR.BACKGROUND.INFO_TINT
          : COLOR.BACKGROUND.SUBTLE,
      },
    }),
  avatarPill: css({
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
    flexShrink: 0,
  }),
  unassignedIcon: css({
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    flexShrink: 0,
  }),
  nameText: css({
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap",
  }),
  rateText: css({
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  }),
  placeholderText: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
  }),
  chevron: (open: boolean) =>
    css({
      transition: "transform 150ms ease",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      marginLeft: 2,
    }),
  popover: css({
    position: "fixed",
    width: 275,
    maxWidth: "calc(100vw - 24px)",
    backgroundColor: "#ffffff",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    padding: 12,
    zIndex: 2000,
  }),
  rateHeader: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  rateLabel: css({
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  }),
  rateInputWrap: css({
    position: "relative",
    width: 105,
  }),
  ratePrefix: css({
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.ICON.MUTED,
    pointerEvents: "none",
  }),
  rateInput: css({
    width: "100%",
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: "#ffffff",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    outline: "none",
    boxSizing: "border-box",
    "&:focus": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
  }),
  searchBox: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 8,
  }),
  searchInput: css({
    border: "none",
    backgroundColor: "transparent",
    outline: "none",
    fontSize: 12,
    color: COLOR.TEXT.PRIMARY,
    width: "100%",
  }),
  list: css({
    maxHeight: 180,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 10,
  }),
  item: (selected: boolean) =>
    css({
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 8px",
      borderRadius: 8,
      cursor: "pointer",
      backgroundColor: selected ? COLOR.BACKGROUND.INFO_TINT : "transparent",
      border: selected ? `1px solid ${COLOR.BORDER.SUBTLE}` : "1px solid transparent",
      transition: "background-color 100ms ease",
      "&:hover": {
        backgroundColor: selected ? COLOR.BACKGROUND.INFO_TINT : COLOR.BACKGROUND.SUBTLE,
      },
    }),
  itemLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  }),
  itemAvatar: css({
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  }),
  unassignAvatar: css({
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    flexShrink: 0,
  }),
  itemLabel: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  itemRight: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  }),
  itemRate: css({
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  }),
  footer: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  cancelBtn: css({
    flex: 1,
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 100ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  confirmBtn: css({
    flex: 1,
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 100ms ease",
    "&:hover": {
      opacity: 0.9,
    },
  }),
} as const;
