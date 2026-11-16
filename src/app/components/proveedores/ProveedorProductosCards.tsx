"use client";

import React from "react";
import Link from "next/link";
import { css } from "@emotion/react";
import { Edit2, Package, ShoppingCart, Trash2 } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { ROUTES } from "@/routing/routes";
import type { ProductoProveedorDTO } from "@/model/dtos";

export type ProveedorProductosCardsProps = {
	productos: ProductoProveedorDTO[];
	onComprarProducto?: (productoId: string, productoNombre: string) => void;
	onEdit: (item: ProductoProveedorDTO) => void;
	onDesvincular: (item: ProductoProveedorDTO) => void;
};

export default function ProveedorProductosCards({
	productos,
	onComprarProducto,
	onEdit,
	onDesvincular,
}: ProveedorProductosCardsProps) {
	return (
		<div css={styles.cardsList}>
			{productos.map((item) => {
				const costo = item.costo_referencia || 0;
				const venta =
					item.producto_precio_venta ||
					(costo > 0 ? Math.round(costo * 1.7) : 0);
				const margen =
					costo > 0 && venta > costo
						? Math.round(((venta - costo) / costo) * 100)
						: null;
				const cleanProdCodigo = item.producto_codigo?.trim() || null;
				const cleanProvCodigo = item.codigo_proveedor?.trim() || null;
				const codigoDisplay = cleanProdCodigo || cleanProvCodigo || "—";

				return (
					<div
						key={`card-${item.id}`}
						css={styles.cardItem}
						data-testid={`proveedor-producto-card-${item.producto_id}`}
					>
						{/* Cuerpo principal: detalles izquierda, precios derecha */}
						<div css={styles.cardBody}>
							{/* Detalles a la izquierda */}
							<div css={styles.cardMainInfo}>
								<div css={styles.cardTopRow}>
									<div css={styles.productIconWrapper}>
										<Package size={18} color={COLOR.ACCENT.PRIMARY} />
									</div>
									<div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
										<Link
											href={`${ROUTES.productos}/${item.producto_id}`}
											style={styles.productLink}
											title={item.producto_nombre || "Producto"}
										>
											{item.producto_nombre || "Producto"}
										</Link>
									</div>
								</div>

								<div css={styles.cardMetaRow}>
									<span style={styles.productCode}>Cód: {codigoDisplay}</span>
									<span css={styles.cardDot}>·</span>
									<span
										css={styles.cardStockBadge}
										data-testid={`stock-actual-${item.producto_id}`}
									>
										Stock: {typeof item.stock_actual === "number" ? `${item.stock_actual} un` : "0 un"}
									</span>
								</div>
							</div>

							{/* Precios a la derecha */}
							<div css={styles.cardRightSection}>
								<span css={styles.cardCostoLabel}>Costo ref.</span>
								<span css={styles.cardCostoMonto}>
									{costo > 0 ? formatArs(costo, { maxDecimals: 0, minDecimals: 0 }) : "—"}
								</span>
								{/* Venta sugerida + margen */}
								{venta > 0 && (
									<div css={styles.cardVentaWrapper}>
										<span>Venta: {formatArs(venta, { maxDecimals: 0, minDecimals: 0 })}</span>
										{margen != null && (
											<span css={styles.cardMargenText}>(+{margen}%)</span>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Barra de acciones debajo */}
						<div css={styles.cardFooterRow}>
							<div css={styles.cardFooterLeft}>
								{onComprarProducto && (
									<button
										type="button"
										onClick={() =>
											onComprarProducto(
												item.producto_id,
												item.producto_nombre || "Producto"
											)
										}
										css={styles.pedirButton}
										data-testid={`card-comprar-producto-${item.producto_id}`}
									>
										<ShoppingCart size={14} />
										<span>Pedir</span>
									</button>
								)}
							</div>

							<div css={styles.cardFooterRight}>
								<button
									type="button"
									title="Editar vinculación"
									onClick={() => onEdit(item)}
									style={styles.iconBtn}
									data-testid={`card-editar-producto-${item.producto_id}`}
								>
									<Edit2 size={15} color={COLOR.TEXT.SECONDARY} />
								</button>

								<button
									type="button"
									title="Desvincular producto"
									onClick={() => onDesvincular(item)}
									style={styles.iconBtnDanger}
									data-testid={`card-desvincular-producto-${item.producto_id}`}
								>
									<Trash2 size={15} color={COLOR.SEMANTIC.DANGER} />
								</button>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

const styles = {
	cardsList: css({
		display: "grid",
		gridTemplateColumns: "1fr",
		gap: 12,
		[`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		},
	}),
	cardItem: css({
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		borderRadius: 8,
		overflow: "hidden",
		boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
		display: "flex",
		flexDirection: "column",
		transition: "border-color 150ms ease, box-shadow 150ms ease",
		"&:hover": {
			borderColor: COLOR.BORDER.DEFAULT,
			boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
		},
	}),
	cardBody: css({
		display: "flex",
		flexDirection: "row",
		width: "100%",
		minWidth: 0,
	}),
	cardMainInfo: css({
		flex: 1,
		minWidth: 0,
		padding: "10px 14px",
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		gap: 6,
	}),
	cardTopRow: css({
		display: "flex",
		alignItems: "center",
		gap: 10,
		minWidth: 0,
		width: "100%",
	}),
	productIconWrapper: css({
		width: 36,
		height: 36,
		borderRadius: 8,
		backgroundColor: "rgba(15, 118, 110, 0.08)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	}),
	productLink: {
		fontWeight: 600,
		fontSize: 13,
		color: COLOR.TEXT.PRIMARY,
		textDecoration: "none",
	},
	productCode: {
		fontSize: 11,
		color: COLOR.TEXT.SECONDARY,
		fontWeight: 500,
		letterSpacing: "0.03em",
	},
	cardMetaRow: css({
		display: "flex",
		alignItems: "center",
		gap: 8,
		flexWrap: "wrap",
		fontSize: 12,
		color: COLOR.TEXT.SECONDARY,
	}),
	cardDot: css({
		color: COLOR.TEXT.TERTIARY,
	}),
	cardStockBadge: css({
		display: "inline-block",
		padding: "2px 8px",
		borderRadius: 9999,
		backgroundColor: COLOR.BACKGROUND.SUBTLE,
		color: COLOR.TEXT.PRIMARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		fontSize: 11,
		fontWeight: 600,
	}),
	cardRightSection: css({
		padding: "8px 14px",
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: 3,
		flexShrink: 0,
		minWidth: 105,
		[`@media (min-width: ${BREAKPOINTS.md}px)`]: {
			minWidth: 140,
			padding: "10px 18px",
		},
	}),
	cardCostoLabel: css({
		fontSize: 10,
		fontWeight: 700,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
		color: COLOR.TEXT.SECONDARY,
	}),
	cardCostoMonto: css({
		fontSize: 15,
		fontWeight: 700,
		color: COLOR.TEXT.PRIMARY,
		lineHeight: 1.2,
		whiteSpace: "nowrap",
		[`@media (min-width: ${BREAKPOINTS.md}px)`]: {
			fontSize: 17,
		},
	}),
	cardVentaWrapper: css({
		display: "flex",
		alignItems: "center",
		gap: 4,
		fontSize: 11,
		color: COLOR.SEMANTIC.SUCCESS,
		fontWeight: 600,
		whiteSpace: "nowrap",
	}),
	cardMargenText: css({
		fontSize: 10,
		fontWeight: 500,
		color: COLOR.TEXT.SECONDARY,
		[`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
			display: "none",
		},
	}),
	cardFooterRow: css({
		padding: "6px 14px",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
	}),
	cardFooterLeft: css({
		display: "flex",
		alignItems: "center",
		gap: 8,
	}),
	cardFooterRight: css({
		display: "flex",
		alignItems: "center",
		gap: 6,
	}),
	pedirButton: css({
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		backgroundColor: COLOR.ACCENT.PRIMARY,
		color: "#FFFFFF",
		border: "none",
		borderRadius: 6,
		padding: "6px 14px",
		fontSize: 13,
		fontWeight: 600,
		cursor: "pointer",
		transition: "opacity 150ms ease",
		"&:hover": {
			opacity: 0.9,
		},
	}),
	iconBtn: {
		background: "transparent",
		border: "none",
		padding: 6,
		borderRadius: 6,
		cursor: "pointer",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	iconBtnDanger: {
		background: "transparent",
		border: "none",
		padding: 6,
		borderRadius: 6,
		cursor: "pointer",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
};
