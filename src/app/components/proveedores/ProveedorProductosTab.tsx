"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import SearchBar from "@/app/components/ui/SearchBar";
import ViewModeToggle, { type ViewMode } from "@/app/components/ui/ViewModeToggle";
import { Package, Plus } from "lucide-react";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import type { ProductoProveedorDTO } from "@/model/dtos";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useIsTabletOrMobile } from "@/app/hooks/useMediaQuery";
import ProveedorProductoModal from "./ProveedorProductoModal";
import ProveedorProductosTable from "./ProveedorProductosTable";
import ProveedorProductosCards from "./ProveedorProductosCards";

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
	const [desktopView, setDesktopView] = useState<ViewMode>("table");
	const isMobileOrTablet = useIsTabletOrMobile(BREAKPOINTS.lg);
	const isCardsView = isMobileOrTablet || desktopView === "cards";

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
				<div css={styles.searchWrapper}>
					<SearchBar
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Buscar producto, código..."
						inputTestId="proveedor-productos-search"
					/>
				</div>

				<div css={styles.toolbarActions}>
					{/* Selector de vista Tabla / Tarjetas en desktop (se oculta en tablet/mobile donde siempre es tarjetas) */}
					<div css={styles.toggleContainer}>
						<ViewModeToggle value={desktopView} onChange={setDesktopView} />
					</div>

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
			) : !isCardsView ? (
				<ProveedorProductosTable
					productos={filteredProductos}
					onComprarProducto={onComprarProducto}
					onEdit={handleOpenEdit}
					onDesvincular={handleDesvincular}
				/>
			) : (
				<ProveedorProductosCards
					productos={filteredProductos}
					onComprarProducto={onComprarProducto}
					onEdit={handleOpenEdit}
					onDesvincular={handleDesvincular}
				/>
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
		[`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
			flexDirection: "column",
			alignItems: "stretch",
			gap: 10,
		},
	}),
	searchWrapper: css({
		flex: 1,
		minWidth: 200,
		[`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
			width: "100%",
		},
	}),
	toolbarActions: css({
		display: "flex",
		alignItems: "center",
		gap: 10,
		[`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
			justifyContent: "flex-end",
			width: "100%",
		},
		[`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
			flexDirection: "column",
			alignItems: "stretch",
		},
	}),
	toggleContainer: css({
		display: "flex",
		justifyContent: "flex-end",
		alignItems: "center",
		[`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
			display: "none",
		},
	}),
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
