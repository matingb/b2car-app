"use client";

import React from "react";
import Tooltip, { type TooltipPlacement } from "@/app/components/ui/Tooltip";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { COLOR } from "@/theme/theme";
import {
  getStockBreakdown,
  type ProductoStockBreakdown,
  type ProductoStockItem,
} from "@/lib/stock";

export interface StockBreakdownBadgeProps {
  stock?: ProductoStockItem | null;
  breakdown?: ProductoStockBreakdown | null;
  stockActualOverride?: number;
  prefix?: string;
  showPrefix?: boolean;
  fontSize?: number | string;
  style?: React.CSSProperties;
  tooltipPlacement?: TooltipPlacement;
  dataTestId?: string;
}

export function formatStockBreakdownText(
  breakdown: ProductoStockBreakdown,
  prefix: string = "Stock: "
): string {
  return `${prefix}${breakdown.fisico} / ${breakdown.disponible} / ${breakdown.reservado} / ${breakdown.pendiente}`;
}

export function createStockOption({
  value,
  label,
  codePrefix = "",
  stock,
  breakdown,
}: {
  value: string;
  label: string;
  codePrefix?: string;
  stock?: ProductoStockItem | null;
  breakdown?: ProductoStockBreakdown | null;
}): AutocompleteOption {
  const b = breakdown ?? getStockBreakdown(stock);
  return {
    value,
    label,
    secondaryLabel: (
      <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
        {codePrefix ? <span>{codePrefix}</span> : null}
        <StockBreakdownBadge breakdown={b} />
      </span>
    ),
    searchText: `${codePrefix}Stock: ${b.fisico} / ${b.disponible} / ${b.reservado} / ${b.pendiente}`,
  };
}

export interface BuildStockOptionsConfig<T> {
  getCodePrefix?: (item: T) => string;
  prependOptions?: AutocompleteOption[];
  appendOptions?: AutocompleteOption[];
}

export function buildStockAutocompleteOptions<
  T extends {
    id: string;
    nombre: string;
    codigo?: string | null;
    stockActual?: number | null;
    stockDisponible?: number | null;
    stockReservado?: number | null;
    stockPendiente?: number | null;
  }
>(
  items: T[] | null | undefined,
  config?: BuildStockOptionsConfig<T>
): AutocompleteOption[] {
  const baseOptions = (items ?? []).map((s) => {
    const codePrefix = config?.getCodePrefix
      ? config.getCodePrefix(s)
      : s.codigo
      ? `${s.codigo} · `
      : "";
    const b = getStockBreakdown(s);
    return createStockOption({
      value: s.id,
      label: s.nombre,
      codePrefix,
      breakdown: b,
    });
  });

  const prepend = config?.prependOptions ?? [];
  const append = config?.appendOptions ?? [];

  return [...prepend, ...baseOptions, ...append];
}

const STOCK_METRICS = [
  { key: "fisico", label: "Físico", color: COLOR.STOCK.FISICO, testId: "stock-breakdown-fisico" },
  { key: "disponible", label: "Disponible", color: COLOR.STOCK.DISPONIBLE, testId: "stock-breakdown-disponible" },
  { key: "reservado", label: "Reservado", color: COLOR.STOCK.RESERVADO, testId: "stock-breakdown-reservado" },
  { key: "pendiente", label: "Pendiente", color: COLOR.STOCK.PENDIENTE, testId: "stock-breakdown-pendiente" },
] as const;

export default function StockBreakdownBadge({
  stock,
  breakdown,
  stockActualOverride,
  prefix = "Stock: ",
  showPrefix = true,
  fontSize = 12,
  style,
  tooltipPlacement = "top",
  dataTestId,
}: StockBreakdownBadgeProps) {
  const b = breakdown ?? getStockBreakdown(stock, stockActualOverride);

  return (
    <span
      data-testid={dataTestId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize,
        lineHeight: 1.3,
        userSelect: "none",
        ...style,
      }}
      aria-label={`Stock: ${b.fisico} físico, ${b.disponible} disponible, ${b.reservado} reservado, ${b.pendiente} pendiente`}
    >
      {showPrefix && <span style={styles.prefix}>{prefix}</span>}
      {STOCK_METRICS.map((metric, idx) => {
        const value = b[metric.key];
        const tooltipContent = (
          <span
            style={{ ...styles.tooltipText, color: metric.color }}
            data-testid={`stock-breakdown-tooltip-${metric.key}`}
          >
            <span style={{ fontWeight: 600 }}>{metric.label}: </span>
            <span style={{ fontWeight: 700, color: metric.color }}>{value}</span>
          </span>
        );

        return (
          <React.Fragment key={metric.key}>
            {idx > 0 && <span style={styles.separator}> / </span>}
            <Tooltip
              content={tooltipContent}
              placement={tooltipPlacement}
              delayMs={60}
              maxWidth={160}
            >
              <span
                style={{ color: metric.color, fontWeight: 700 }}
                data-testid={metric.testId}
              >
                {value}
              </span>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </span>
  );
}

const styles = {
  prefix: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
  },
  separator: {
    color: COLOR.TEXT.SECONDARY,
    opacity: 0.6,
    padding: "0 1px",
  },
  tooltipText: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap" as const,
    fontSize: 12,
  },
};
