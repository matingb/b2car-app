"use client";

import React from "react";
import Link from "next/link";
import { css } from "@emotion/react";
import { Edit2, Package, ShoppingCart, Trash2 } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { ROUTES } from "@/routing/routes";
import type { ProductoProveedorDTO } from "@/model/dtos";

export type ProveedorProductosTableProps = {
	productos: ProductoProveedorDTO[];
	onComprarProducto?: (productoId: string, productoNombre: string) => void;
	onEdit: (item: ProductoProveedorDTO) => void;
	onDesvincular: (item: ProductoProveedorDTO) => void;
};

export default function ProveedorProductosTable({
	productos,
	onComprarProducto,
	onEdit,
	onDesvincular,
}: ProveedorProductosTableProps) {
	return (
		<div css={[styles.tableCard, styles.desktopTableContainer]}>
			<table style={styles.table}>
				<thead>
					<tr style={styles.theadRow}>
						<th style={styles.th}>PRODUCTO</th>
						<th style={styles.th}>STOCK ACTUAL</th>
						<th style={styles.th}>PRECIO COSTO</th>
						<th style={styles.th}>VENTA SUGERIDA</th>
						<th style={{ ...styles.th, textAlign: "right" }}>ACCIÓN</th>
					</tr>
				</thead>
				<tbody>
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
							<tr key={item.id} style={styles.tr}>
								<td style={styles.td}>
									<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
										<div css={styles.productIconWrapper}>
											<Package size={18} color={COLOR.ACCENT.PRIMARY} />
										</div>
										<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
											<Link
												href={`${ROUTES.productos}/${item.producto_id}`}
												style={styles.productLink}
											>
												{item.producto_nombre || "Producto"}
											</Link>
											<span style={styles.productCode}>{codigoDisplay}</span>
										</div>
									</div>
								</td>

								{/* Stock actual */}
								<td style={styles.td}>
									<span
										css={styles.stockBadge}
										data-testid={`stock-actual-${item.producto_id}`}
									>
										{typeof item.stock_actual === "number"
											? `${item.stock_actual} un`
											: "0 un"}
									</span>
								</td>

								{/* Precio Costo */}
								<td style={styles.td}>
									<span style={styles.costoText}>
										{costo > 0
											? formatArs(costo, { maxDecimals: 0, minDecimals: 0 })
											: "—"}
									</span>
								</td>

								{/* Venta Sugerida */}
								<td style={styles.td}>
									<div style={{ display: "flex", flexDirection: "column" }}>
										<span style={styles.ventaSugeridaText}>
											{venta > 0
												? formatArs(venta, { maxDecimals: 0, minDecimals: 0 })
												: "—"}
										</span>
										{margen != null && (
											<span style={styles.margenText}>+{margen}% margen</span>
										)}
									</div>
								</td>

								{/* Acciones */}
								<td style={{ ...styles.td, textAlign: "right" }}>
									<div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
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
												data-testid={`comprar-producto-${item.producto_id}`}
											>
												<ShoppingCart size={14} />
												<span>Pedir</span>
											</button>
										)}

										<button
											type="button"
											title="Editar vinculación"
											onClick={() => onEdit(item)}
											style={styles.iconBtn}
										>
											<Edit2 size={15} color={COLOR.TEXT.SECONDARY} />
										</button>

										<button
											type="button"
											title="Desvincular producto"
											onClick={() => onDesvincular(item)}
											style={styles.iconBtnDanger}
										>
											<Trash2 size={15} color={COLOR.SEMANTIC.DANGER} />
										</button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

const styles = {
	tableCard: css({
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		borderRadius: 12,
		overflowX: "auto",
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
	}),
	desktopTableContainer: css({
		[`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
			display: "none",
		},
	}),
	table: {
		width: "100%",
		borderCollapse: "collapse" as const,
		fontSize: 13,
	},
	theadRow: {
		borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		textAlign: "left" as const,
	},
	th: {
		padding: "14px 16px",
		fontSize: 11,
		fontWeight: 700,
		textTransform: "uppercase" as const,
		letterSpacing: "0.05em",
		color: COLOR.TEXT.SECONDARY,
		whiteSpace: "nowrap" as const,
	},
	tr: {
		borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
		transition: "background-color 150ms ease",
		"&:hover": {
			backgroundColor: "rgba(0, 0, 0, 0.01)",
		},
	},
	td: {
		padding: "14px 16px",
		verticalAlign: "middle" as const,
		whiteSpace: "nowrap" as const,
	},
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
	stockBadge: css({
		display: "inline-block",
		padding: "3px 10px",
		borderRadius: 9999,
		backgroundColor: COLOR.BACKGROUND.SUBTLE,
		color: COLOR.TEXT.PRIMARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		fontSize: 12,
		fontWeight: 600,
	}),
	costoText: {
		fontWeight: 700,
		fontSize: 13,
		color: COLOR.TEXT.PRIMARY,
	},
	ventaSugeridaText: {
		fontWeight: 700,
		fontSize: 13,
		color: COLOR.SEMANTIC.SUCCESS,
	},
	margenText: {
		fontSize: 11,
		fontWeight: 500,
		color: COLOR.TEXT.SECONDARY,
	},
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
