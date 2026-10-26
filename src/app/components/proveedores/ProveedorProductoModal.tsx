"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import NumberInput from "@/app/components/ui/NumberInput";
import Toggle from "@/app/components/ui/Toggle";
import { COLOR } from "@/theme/theme";
import { useToast } from "@/app/providers/ToastProvider";
import { useProductos } from "@/app/providers/ProductosProvider";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import type { ProductoProveedorDTO } from "@/model/dtos";

export type ProveedorProductoModalProps = {
	open: boolean;
	onClose: () => void;
	proveedorId: string;
	initialData?: ProductoProveedorDTO | null;
	onSuccess: () => void;
};

export default function ProveedorProductoModal({
	open,
	onClose,
	proveedorId,
	initialData,
	onSuccess,
}: ProveedorProductoModalProps) {
	const toast = useToast();
	const { productos, isLoading: loadingProductos } = useProductos();

	const isEditing = Boolean(initialData);

	const [productoId, setProductoId] = useState<string>("");
	const [codigoProveedor, setCodigoProveedor] = useState<string>("");
	const [costoReferencia, setCostoReferencia] = useState<number>(0);
	const [esPredeterminado, setEsPredeterminado] = useState<boolean>(false);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

	useEffect(() => {
		if (initialData) {
			setProductoId(initialData.producto_id);
			setCodigoProveedor(initialData.codigo_proveedor || "");
			setCostoReferencia(initialData.costo_referencia || 0);
			setEsPredeterminado(Boolean(initialData.es_predeterminado));
		} else {
			setProductoId("");
			setCodigoProveedor("");
			setCostoReferencia(0);
			setEsPredeterminado(false);
		}
	}, [initialData, open]);

	// Al seleccionar producto en modo creación, precargar su costo unitario como referencia
	const handleSelectProducto = (id: string) => {
		setProductoId(id);
		const prod = productos.find((p) => p.id === id);
		if (prod && !isEditing) {
			setCostoReferencia(prod.costoUnitario || 0);
		}
	};

	const productoOptions: AutocompleteOption[] = productos.map((p) => ({
		value: p.id,
		label: `${p.nombre} (${p.codigo})`,
	}));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!productoId) {
			toast.error("Producto requerido", "Seleccioná un producto del catálogo.");
			return;
		}

		setIsSubmitting(true);
		try {
			if (isEditing && initialData) {
				const res = await proveedoresClient.actualizarProductoVinculado(
					proveedorId,
					initialData.producto_id,
					{
						codigo_proveedor: codigoProveedor.trim() || null,
						costo_referencia: costoReferencia,
						es_predeterminado: esPredeterminado,
					}
				);
				if (res.error) throw new Error(res.error);
				toast.success("Producto actualizado", "Se actualizaron los datos del producto vinculado.");
			} else {
				const res = await proveedoresClient.asociarProducto(proveedorId, {
					producto_id: productoId,
					codigo_proveedor: codigoProveedor.trim() || null,
					costo_referencia: costoReferencia,
					es_predeterminado: esPredeterminado,
				});
				if (res.error) throw new Error(res.error);
				toast.success("Producto vinculado", "El producto se asoció exitosamente al catálogo del proveedor.");
			}

			onSuccess();
			onClose();
		} catch (err: unknown) {
			toast.error(
				"No se pudo guardar la vinculación",
				err instanceof Error ? err.message : "Error inesperado"
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEditing ? "Editar vinculación de producto" : "Vincular producto al proveedor"}
			onSubmit={handleSubmit}
			submitText={isEditing ? "Guardar cambios" : "Vincular producto"}
			submitting={isSubmitting}
			disabledSubmit={!productoId || isSubmitting}
			modalStyle={{ width: "min(560px, 96vw)" }}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
				<div>
					<label style={styles.label}>
						Producto <span style={{ color: COLOR.SEMANTIC.DANGER }}>*</span>
					</label>
					{isEditing ? (
						<div style={styles.staticField}>
							<strong>{initialData?.producto_nombre || "Producto"}</strong>
							{initialData?.producto_codigo && (
								<span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13, marginLeft: 8 }}>
									({initialData.producto_codigo})
								</span>
							)}
						</div>
					) : (
						<Autocomplete
							options={productoOptions}
							value={productoId}
							onChange={handleSelectProducto}
							placeholder={loadingProductos ? "Cargando productos..." : "Buscar por nombre o código..."}
							disabled={loadingProductos}
						/>
					)}
				</div>

				<div>
					<label style={styles.label}>Código / SKU del Proveedor</label>
					<input
						type="text"
						value={codigoProveedor}
						onChange={(e) => setCodigoProveedor(e.target.value)}
						placeholder="Ej. REF-9842-A"
						style={styles.input}
					/>
					<span style={styles.helperText}>
						Identificador o código que este proveedor específico utiliza en sus facturas o catálogos.
					</span>
				</div>

				<div>
					<label style={styles.label}>Costo de Referencia ($)</label>
					<NumberInput
						value={costoReferencia}
						onValueChange={(val) => setCostoReferencia(Number(val) || 0)}
						minValue={0}
						style={styles.input}
					/>
					<span style={styles.helperText}>
						Precio unitario habitual de compra para este proveedor (se precarga en nuevas órdenes).
					</span>
				</div>

				<div style={styles.toggleRow}>
					<div>
						<div style={{ fontSize: 14, fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>
							Proveedor Predeterminado
						</div>
						<div style={styles.helperText}>
							Si se activa, este proveedor será sugerido por defecto al comprar este producto.
						</div>
					</div>
					<Toggle
						checked={esPredeterminado}
						onChange={setEsPredeterminado}
						label="Proveedor Predeterminado"
					/>
				</div>
			</div>
		</Modal>
	);
}

const styles = {
	label: {
		display: "block",
		fontSize: 13,
		fontWeight: 600,
		color: COLOR.TEXT.SECONDARY,
		marginBottom: 6,
	},
	input: {
		width: "100%",
		padding: "10px 12px",
		borderRadius: 8,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		background: COLOR.INPUT.PRIMARY.BACKGROUND,
		fontSize: 14,
		color: COLOR.TEXT.PRIMARY,
	},
	staticField: {
		padding: "10px 12px",
		borderRadius: 8,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		background: COLOR.BACKGROUND.SUBTLE,
		fontSize: 14,
		color: COLOR.TEXT.PRIMARY,
	},
	helperText: {
		display: "block",
		fontSize: 12,
		color: COLOR.TEXT.SECONDARY,
		marginTop: 4,
	},
	toggleRow: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "12px 14px",
		borderRadius: 8,
		background: COLOR.BACKGROUND.SUBTLE,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		gap: 16,
		marginTop: 4,
	},
} as const;
