"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, ReceiptText, Ban, Check, Loader2, FileX2 } from "lucide-react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";

export type FacturaBadgeData = {
  id?: string;
  estado?: string;
  clase_comprobante?: string;
  punto_venta?: number;
  numero_comprobante?: number;
};

type Props = {
  arregloId: string;
  esFacturable?: boolean;
  factura?: FacturaBadgeData | null;
  onFacturableChanged?: (esFacturable: boolean) => void;
  onOpenFacturaModal?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  size?: "sm" | "md";
};

export default function ArregloFacturaBadge({
  arregloId,
  esFacturable = true,
  factura,
  onFacturableChanged,
  onOpenFacturaModal,
  onOpenChange,
  size = "md",
}: Props) {
  const router = useRouter();
  const { update } = useArreglos();
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentEsFacturable, setCurrentEsFacturable] = useState(esFacturable);
  const [dropdownCoords, setDropdownCoords] = useState<React.CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    const menuMinWidth = 230;
    const menuEstimatedHeight = 110;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
    const spaceAbove = Math.max(0, rect.top - 8);

    // Solo abrir hacia arriba si abajo NO cabe y arriba hay más espacio que abajo
    const placeAbove = spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, Math.floor(placeAbove ? spaceAbove : spaceBelow));

    const verticalStyle: React.CSSProperties = placeAbove
      ? { bottom: viewportHeight - rect.top + 6 }
      : { top: rect.bottom + 6 };

    // Alinear borde derecho del dropdown con el del botón salvo que desborde por izquierda
    const wouldOverflowLeft = rect.right < menuMinWidth;
    const horizontalStyle: React.CSSProperties = wouldOverflowLeft
      ? { left: Math.max(8, rect.left) }
      : { right: Math.max(8, viewportWidth - rect.right) };

    setDropdownCoords({
      ...verticalStyle,
      ...horizontalStyle,
      maxHeight,
    });
  };

  useEffect(() => {
    setCurrentEsFacturable(esFacturable);
  }, [esFacturable]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !dropdownRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    }
    if (isOpen) {
      updatePosition();
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, onOpenChange]);

  const isEmitida = Boolean(factura && factura.estado === "AUTORIZADA");

  const formatFacturaNumero = () => {
    if (!factura) return "";
    const clase = factura.clase_comprobante || "FC";
    const pv = String(factura.punto_venta ?? 1).padStart(4, "0");
    const num = String(factura.numero_comprobante ?? 1).padStart(8, "0");
    return `${clase}-${pv}-${num}`;
  };

  const handleToggleFacturable = async (nextValue: boolean) => {
    setIsOpen(false);
    onOpenChange?.(false);
    if (nextValue === currentEsFacturable) return;

    setLoading(true);
    try {
      const updated = await update(arregloId, { es_facturable: nextValue });
      if (!updated) {
        throw new Error("No se pudo actualizar el estado de facturación");
      }
      setCurrentEsFacturable(nextValue);
      onFacturableChanged?.(nextValue);
      success(
        "Facturación actualizada",
        nextValue
          ? "El arreglo ahora sumará al saldo pendiente de facturar."
          : "El arreglo fue marcado como no facturable."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar facturación";
      error("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    if (isEmitida && factura?.id) {
      router.push(`/facturacion/${factura.id}`);
      return;
    }

    if (!isOpen) {
      updatePosition();
    }
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const isSmall = size === "sm";

  // 1. Factura Emitida
  if (isEmitida) {
    const nro = formatFacturaNumero();
    return (
      <button
        type="button"
        data-testid="arreglo-factura-badge"
        onClick={handleBadgeClick}
        title="Ver factura emitida"
        css={[styles.badgeBase, styles.badgeEmitida, isSmall && styles.badgeSm]}
      >
        <FileText size={isSmall ? 13 : 14} color={COLOR.ACCENT.PRIMARY} />
        <span>{nro ? `Factura emitida (${nro})` : "Factura emitida"}</span>
      </button>
    );
  }

  // 2. No Facturable
  if (currentEsFacturable === false) {
    return (
      <div ref={containerRef} css={styles.container}>
        <button
          type="button"
          data-testid="arreglo-factura-badge"
          onClick={handleBadgeClick}
          title="Trabajo exento de facturación (clic para cambiar)"
          css={[styles.badgeBase, styles.badgeNoFacturable, isSmall && styles.badgeSm]}
        >
          {loading ? (
            <Loader2 size={isSmall ? 13 : 14} className="animate-spin" />
          ) : (
            <FileX2 size={isSmall ? 13 : 14} color={COLOR.ICON.MUTED} />
          )}
          <span>No facturable</span>
        </button>

        {isOpen && typeof document !== "undefined"
          ? createPortal(
            <div
              ref={dropdownRef}
              css={styles.dropdownMenu}
              style={dropdownCoords ?? undefined}
            >
              <button
                type="button"
                css={styles.menuItem}
                data-testid="factura-menu-marcar-facturable"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFacturable(true);
                }}
              >
                <Check size={14} color={COLOR.SEMANTIC.SUCCESS} />
                <span>Marcar como facturable</span>
              </button>
            </div>,
            document.body
          )
          : null}
      </div>
    );
  }

  // 3. Pendiente de Facturación
  return (
    <div ref={containerRef} css={styles.container}>
      <button
        type="button"
        data-testid="arreglo-factura-badge"
        onClick={handleBadgeClick}
        title="Factura pendiente (clic para cambiar)"
        css={[styles.badgeBase, styles.badgePendiente, isSmall && styles.badgeSm]}
      >
        {loading ? (
          <Loader2 size={isSmall ? 13 : 14} className="animate-spin" />
        ) : (
          <FileX2 size={isSmall ? 13 : 14} color="#475569" />
        )}
        <span>Factura pendiente</span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={dropdownRef}
            css={styles.dropdownMenu}
            style={dropdownCoords ?? undefined}
          >
            {onOpenFacturaModal && (
              <button
                type="button"
                css={styles.menuItem}
                data-testid="factura-menu-emitir"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenChange?.(false);
                  onOpenFacturaModal();
                }}
              >
                <ReceiptText size={14} color={COLOR.ACCENT.PRIMARY} />
                <span>Emitir factura electrónica</span>
              </button>
            )}
            <button
              type="button"
              css={styles.menuItem}
              data-testid="factura-menu-marcar-no-facturable"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFacturable(false);
              }}
            >
              <Ban size={14} color={COLOR.SEMANTIC.DANGER} />
              <span>Marcar como no facturable</span>
            </button>
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

const styles = {
  container: css({
    position: "relative",
    display: "inline-block",
  }),
  badgeBase: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 150ms ease",
    whiteSpace: "nowrap",
    background: "transparent",
    border: "1px solid transparent",
    fontFamily: "inherit",
    "&:hover": {
      filter: "brightness(0.97)",
    },
  }),
  badgeSm: css({
    padding: "4px 10px",
    fontSize: 12,
  }),
  badgeEmitida: css({
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    borderColor: COLOR.BORDER.SUBTLE,
    color: COLOR.ACCENT.PRIMARY,
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.PRIMARY,
      borderColor: COLOR.ACCENT.PRIMARY,
      color: COLOR.ACCENT.HOVER,
    },
  }),
  badgePendiente: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px dashed ${COLOR.BORDER.DEFAULT}`,
    color: COLOR.TEXT.SECONDARY,
    "&:hover": {
      borderColor: COLOR.BORDER.WEAK,
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  badgeNoFacturable: css({
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px dashed ${COLOR.BORDER.DEFAULT}`,
    color: COLOR.TEXT.TERTIARY,
    "&:hover": {
      borderColor: COLOR.BORDER.WEAK,
      backgroundColor: COLOR.BACKGROUND.PRIMARY,
      color: COLOR.TEXT.SECONDARY,
    },
  }),
  dropdownMenu: css({
    position: "fixed",
    minWidth: 230,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    zIndex: 2500,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    overflowY: "auto",
  }),
  menuItem: css({
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
    transition: "background-color 120ms ease, color 120ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
};
