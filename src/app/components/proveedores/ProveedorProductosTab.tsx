"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import SearchBar from "@/app/components/ui/SearchBar";
import { Edit2, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { formatArs } from "@/lib/format";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import type { ProductoProveedorDTO } from "@/model/dtos";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProveedorProductoModal from "./ProveedorProductoModal";
import Link from "next/link";
import { ROUTES } from "@/routing/routes";

export type ProveedorProductosTabProps = {
	proveedorId: string;
	proveedorNombre: string;
	onComprarProducto?: (productoId: string, productoNombre: string) => void;
};

export default function ProveedorProductosTab({
	proveedorId,
	proveedorNombre,
	onComprarProducto,
}: ProveedorProductosTabProps) {
	const modal = useModalMessage();
	const toast = useToast();

	const [productos, setProductos] = useState<ProductoProveedorDTO[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>("");

	const [modalOpen, setModalOpen] = useState<boolean>(false);
	const [editingItem, setEditingItem] = useState<ProductoProveedorDTO | null>(null);

	const loadProductos = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await proveedoresClient.getProductos(proveedorId);
			if (res.error) throw new Error(res.error);
			const list = res.data ?? [];
			setProductos(list);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Error cargando catálogo de productos");
		} finally {
			setLoading(false);
		}
	}, [proveedorId]);

	useEffect(() => {
		void loadProductos();
	}, [loadProductos]);

	const filteredProductos = useMemo(() => {
		if (!searchQuery.trim()) return productos;
		const q = searchQuery.toLowerCase();
		return productos.filter(
			(p) =>
				p.producto_nombre?.toLowerCase().includes(q) ||
				p.producto_codigo?.toLowerCase().includes(q) ||
				p.codigo_proveedor?.toLowerCase().includes(q)
		);
	}, [productos, searchQuery]);

	const handleOpenCreate = () => {
		setEditingItem(null);
		setModalOpen(true);
	};

	const handleOpenEdit = (item: ProductoProveedorDTO) => {
		setEditingItem(item);
		setModalOpen(true);
	};

	const handleDesvincular = async (item: ProductoProveedorDTO) => {
		const ok = await modal.confirm({
			title: "Desvincular producto",
			message: `¿Estás seguro de que querés desvincular "${item.producto_nombre || "este producto"}" del proveedor ${proveedorNombre}?`,
			acceptLabel: "Desvincular",
			cancelLabel: "Cancelar",
		});
		if (!ok) return;

		try {
			const res = await proveedoresClient.desvincularProducto(proveedorId, item.producto_id);
			if (res.error) throw new Error(res.error);
			toast.success("Producto desvinculado", "El producto fue eliminado del catálogo del proveedor.");
			await loadProductos();
		} catch (err: unknown) {
			toast.error(
				"No se pudo desvincular el producto",
				err instanceof Error ? err.message : "Error inesperado"
			);
		}
	};

	if (loading) {
		return <div style={styles.loadingContainer}>Cargando catálogo de productos...</div>;
	}

	if (error) {
		return (
			<Card style={styles.errorCard}>
				<div style={{ color: COLOR.SEMANTIC.DANGER, fontWeight: 600 }}>{error}</div>
				<div style={{ marginTop: 12 }}>
					<Button text="Reintentar" onClick={loadProductos} outline />
				</div>
			</Card>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
			<div css={styles.toolbar}>
				<div style={styles.searchWrapper}>
					<SearchBar
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Buscar producto, código..."
						inputTestId="proveedor-productos-search"
					/>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					<Button
						icon={<Plus size={16} />}
						text="Vincular producto"
						onClick={handleOpenCreate}
						dataTestId="proveedor-vincular-producto-btn"
					/>
				</div>
			</div>

			{/* Listado o Empty State */}
			{productos.length === 0 ? (
				<Card style={styles.emptyCard}>
					<Package size={44} color={COLOR.ICON.MUTED} style={{ marginBottom: 12 }} />
					<div style={styles.emptyTitle}>Sin productos asociados</div>
					<div style={styles.emptySubtitle}>
						Este proveedor aún no tiene repuestos o insumos vinculados en su catálogo. Podés asociar
						productos existentes para registrar precios de compra de referencia y agilizar las órdenes.
					</div>
					<div style={{ marginTop: 16 }}>
						<Button icon={<Plus size={16} />} text="Vincular primer producto" onClick={handleOpenCreate} />
					</div>
				</Card>
			) : (
				<div css={styles.tableCard}>
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
							{filteredProductos.map((item) => {
								const costo = item.costo_referencia || 0;
								const venta = item.producto_precio_venta || (costo > 0 ? Math.round(costo * 1.7) : 0);
								const margen = costo > 0 && venta > costo
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
													<span style={styles.productCode}>
														{codigoDisplay}
													</span>
												</div>
											</div>
										</td>

										{/* Stock actual */}
										<td style={styles.td}>
											<span css={styles.stockBadge} data-testid={`stock-actual-${item.producto_id}`}>
												{typeof item.stock_actual === "number" ? `${item.stock_actual} un` : "0 un"}
											</span>
										</td>

										{/* Precio Costo */}
										<td style={styles.td}>
											<span style={styles.costoText}>
												{costo > 0 ? formatArs(costo, { maxDecimals: 0, minDecimals: 0 }) : "—"}
											</span>
										</td>

										{/* Venta Sugerida */}
										<td style={styles.td}>
											<div style={{ display: "flex", flexDirection: "column" }}>
												<span style={styles.ventaSugeridaText}>
													{venta > 0 ? formatArs(venta, { maxDecimals: 0, minDecimals: 0 }) : "—"}
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
															onComprarProducto(item.producto_id, item.producto_nombre || "Producto")
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
													onClick={() => handleOpenEdit(item)}
													style={styles.iconBtn}
												>
													<Edit2 size={15} color={COLOR.TEXT.SECONDARY} />
												</button>

												<button
													type="button"
													title="Desvincular producto"
													onClick={() => handleDesvincular(item)}
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
			)}

			<ProveedorProductoModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				proveedorId={proveedorId}
				initialData={editingItem}
				onSuccess={loadProductos}
			/>
		</div>
	);
}

const styles = {
	loadingContainer: {
		padding: "36px 0",
		textAlign: "center" as const,
		color: COLOR.TEXT.SECONDARY,
		fontSize: 14,
	},
	errorCard: {
		padding: 24,
		textAlign: "center" as const,
	},
	toolbar: css({
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		[`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
			flexDirection: "column",
			alignItems: "stretch",
		},
	}),
	searchWrapper: {
		flex: 1,
		minWidth: 0,
	},
	tableCard: css({
		backgroundColor: COLOR.BACKGROUND.PRIMARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		borderRadius: 12,
		overflowX: "auto",
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
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
	categoryBadge: css({
		display: "inline-block",
		padding: "3px 10px",
		borderRadius: 9999,
		backgroundColor: COLOR.BACKGROUND.SUBTLE,
		color: COLOR.TEXT.SECONDARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		fontSize: 12,
		fontWeight: 500,
	}),
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
	mutedText: {
		fontSize: 12,
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
	emptyCard: {
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "center",
		justifyContent: "center",
		padding: "48px 24px",
		textAlign: "center" as const,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 600,
		color: COLOR.TEXT.PRIMARY,
		marginBottom: 6,
	},
	emptySubtitle: {
		fontSize: 13,
		color: COLOR.TEXT.SECONDARY,
		maxWidth: 480,
		lineHeight: 1.5,
	},
};
