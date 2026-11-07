"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import type { Producto } from "@/app/providers/ProductosProvider";
import { formatArs } from "@/lib/format";
import { getProductoStockBreakdown } from "@/lib/stock";
import { getProductoStockSummary } from "@/app/hooks/productos/useProductosFilters";
import StockStatusIcon from "@/app/components/stock/StockStatusIcon";
import Table from "@/app/components/ui/Table";

export type ProductosTableProps = {
  productos: Producto[];
  tallerId?: string;
  onProductoClick: (producto: Producto) => void;
};

export default function ProductosTable({
  productos,
  tallerId = "",
  onProductoClick,
}: ProductosTableProps) {
  return (
    <Table data-testid="productos-table-container">
      <Table.Header>
        <Table.Head>Producto</Table.Head>
        <Table.Head>Categoría</Table.Head>
        <Table.Head align="right">Precio</Table.Head>
        <Table.Head align="right">Costo</Table.Head>
        <Table.Head align="right">Físico</Table.Head>
        <Table.Head align="right">Disponible</Table.Head>
        <Table.Head align="right">Reservado</Table.Head>
        <Table.Head align="right">Pendiente</Table.Head>
      </Table.Header>
      <Table.Body>
        {productos.map((producto) => {
          const stock = getProductoStockBreakdown(producto, tallerId);
          const stockSummary = getProductoStockSummary(producto, tallerId);
          const categorias = producto.categorias ?? [];
          const categoriaText = categorias.join(", ");

          return (
            <Table.Row
              key={producto.id}
              onClick={() => onProductoClick(producto)}
              data-testid={`producto-row-${producto.id}`}
            >
              <Table.Cell>
                <div css={styles.productCell}>
                  <StockStatusIcon
                    status={stockSummary.worstStatus}
                    size={16}
                    boxSize={32}
                    borderRadius={8}
                    data-testid={`stock-status-icon-${producto.id}`}
                  />
                  <div css={styles.productInfo}>
                    <span css={styles.productName} title={producto.nombre}>
                      {producto.nombre}
                    </span>
                    <span css={styles.productCode}>{producto.codigo}</span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                {categoriaText ? (
                  <span css={styles.categoryBadge} title={categoriaText}>
                    {categoriaText}
                  </span>
                ) : (
                  <span css={styles.mutedText}>—</span>
                )}
              </Table.Cell>
              <Table.Cell align="right" css={styles.precioText}>
                {formatArs(producto.precioUnitario, {
                  maxDecimals: 0,
                  minDecimals: 0,
                })}
              </Table.Cell>
              <Table.Cell align="right" css={styles.costoText}>
                {formatArs(producto.costoUnitario, {
                  maxDecimals: 0,
                  minDecimals: 0,
                })}
              </Table.Cell>
              <Table.Cell
                align="right"
                css={styles.stockFisico}
                data-testid={`row-fisico-${producto.id}`}
              >
                {stock.fisico}
              </Table.Cell>
              <Table.Cell
                align="right"
                css={styles.stockDisponible}
                data-testid={`row-disponible-${producto.id}`}
              >
                {stock.disponible}
              </Table.Cell>
              <Table.Cell
                align="right"
                css={styles.stockReservado}
                data-testid={`row-reservado-${producto.id}`}
              >
                {stock.reservado}
              </Table.Cell>
              <Table.Cell
                align="right"
                css={styles.stockPendiente}
                data-testid={`row-pendiente-${producto.id}`}
              >
                {stock.pendiente}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}

const styles = {
  productCell: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
  }),
  productInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  }),
  productName: css({
    fontWeight: 600,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 260,
  }),
  productCode: css({
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontFamily: "monospace",
  }),
  categoryBadge: css({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    fontSize: 12,
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  mutedText: css({
    color: COLOR.TEXT.TERTIARY,
  }),
  precioText: css({
    fontWeight: 700,
    fontSize: 14,
    color: COLOR.ACCENT.PRIMARY,
  }),
  costoText: css({
    fontWeight: 500,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  }),
  stockFisico: css({
    fontWeight: 700,
    color: COLOR.STOCK.FISICO.TEXT,
  }),
  stockDisponible: css({
    fontWeight: 700,
    color: COLOR.STOCK.DISPONIBLE.TEXT,
  }),
  stockReservado: css({
    fontWeight: 600,
    color: COLOR.STOCK.RESERVADO.TEXT,
  }),
  stockPendiente: css({
    fontWeight: 600,
    color: COLOR.STOCK.PENDIENTE.TEXT,
  }),
} as const;

