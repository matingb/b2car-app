"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Color from "color";
import { css } from "@emotion/react";
import { productosClient } from "@/clients/productosClient";
import type { MovimientoStockDTO } from "@/model/dtos";
import { formatDateLabel } from "@/lib/fechas";
import { ArrowDownLeft, ArrowUpRight, History, Package, RotateCcw, SlidersHorizontal, Wrench } from "lucide-react";
import Link from "next/link";

export type ProductoKardexModalProps = {
	open: boolean;
	onClose: () => void;
	productoId: string;
	productoNombre: string;
	productoCodigo: string;
	talleres?: { id: string; nombre: string }[];
};

export default function ProductoKardexModal({
	open,
	onClose,
	productoId,
	productoNombre,
	productoCodigo,
	talleres = [],
}: ProductoKardexModalProps) {
	const [selectedTallerId, setSelectedTallerId] = useState<string>("");
	const [movimientos, setMovimientos] = useState<MovimientoStockDTO[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !productoId) return;

		let isMounted = true;
		setLoading(true);
		setError(null);

		productosClient
			.getMovimientosStock(productoId, {
				tallerId: selectedTallerId || undefined,
				limit: 100,
			})
			.then((res) => {
				if (!isMounted) return;
				if (res.error) {
					setError(res.error);
				} else {
					setMovimientos(res.data ?? []);
				}
			})
			.catch((err) => {
				if (!isMounted) return;
				setError(err instanceof Error ? err.message : "Error al cargar movimientos");
			})
			.finally(() => {
				if (isMounted) setLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [open, productoId, selectedTallerId]);

	const { totalEntradas, totalSalidas } = useMemo(() => {
		let entradas = 0;
		let salidas = 0;
		for (const m of movimientos) {
			if (m.cantidad > 0) entradas += m.cantidad;
			else salidas += Math.abs(m.cantidad);
		}
		return { totalEntradas: entradas, totalSalidas: salidas };
	}, [movimientos]);

	const renderBadge = (tipo: string) => {
		switch (tipo) {
			case "COMPRA":
				return (
					<span css={styles.badgeSuccess}>
						<ArrowDownLeft size={13} style={{ marginRight: 4 }} />
						Compra
					</span>
				);
			case "VENTA":
				return (
					<span css={styles.badgeInfo}>
						<ArrowUpRight size={13} style={{ marginRight: 4 }} />
						Venta
					</span>
				);
			case "ASIGNACION_ARREGLO":
				return (
					<span css={styles.badgePurple}>
						<Wrench size={13} style={{ marginRight: 4 }} />
						Arreglo
					</span>
				);
			case "AJUSTE":
				return (
					<span css={styles.badgeWarning}>
						<SlidersHorizontal size={13} style={{ marginRight: 4 }} />
						Ajuste
					</span>
				);
			case "REVERSION":
				return (
					<span css={styles.badgeDanger}>
						<RotateCcw size={13} style={{ marginRight: 4 }} />
						Reversión
					</span>
				);
			case "INICIAL":
			default:
				return (
					<span css={styles.badgeNeutral}>
						<Package size={13} style={{ marginRight: 4 }} />
						Inicial
					</span>
				);
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={`Kardex: ${productoNombre} (${productoCodigo})`}
			modalStyle={{ width: "min(900px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
				{/* Barra de Filtro y Resumen */}
				<div css={styles.summaryBar}>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						{talleres.length > 1 && (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<label style={{ fontSize: 13, fontWeight: 500, color: COLOR.TEXT.SECONDARY }}>Taller:</label>
								<select
									value={selectedTallerId}
									onChange={(e) => setSelectedTallerId(e.target.value)}
									style={styles.tallerSelect}
									data-testid="kardex-taller-select"
								>
									<option value="">Todos los talleres</option>
									{talleres.map((t) => (
										<option key={t.id} value={t.id}>
											{t.nombre}
										</option>
									))}
								</select>
							</div>
						)}
					</div>

					<div style={{ display: "flex", gap: 16, fontSize: 13 }}>
						<div style={{ color: COLOR.TEXT.SECONDARY }}>
							Total ingresos: <strong style={{ color: COLOR.SEMANTIC.SUCCESS }}>+{totalEntradas}</strong>
						</div>
						<div style={{ color: COLOR.TEXT.SECONDARY }}>
							Total egresos: <strong style={{ color: COLOR.SEMANTIC.DANGER }}>-{totalSalidas}</strong>
						</div>
					</div>
				</div>

				{/* Contenido / Tabla */}
				{loading ? (
					<div style={{ textAlign: "center", padding: "40px 0", color: COLOR.TEXT.SECONDARY }}>
						Cargando historial de movimientos...
					</div>
				) : error ? (
					<div style={{ textAlign: "center", padding: "32px 0", color: COLOR.SEMANTIC.DANGER }}>
						{error}
					</div>
				) : movimientos.length === 0 ? (
					<div style={{ textAlign: "center", padding: "48px 16px", color: COLOR.TEXT.SECONDARY }}>
						<History size={40} color={COLOR.ICON.MUTED} style={{ margin: "0 auto 12px" }} />
						<p style={{ margin: 0, fontWeight: 500 }}>No hay movimientos registrados para este producto.</p>
					</div>
				) : (
					<div style={{ overflowX: "auto" }}>
						<table style={styles.table}>
							<thead>
								<tr style={styles.theadRow}>
									<th style={styles.th}>Fecha</th>
									<th style={styles.th}>Tipo</th>
									<th style={styles.th}>Taller</th>
									<th style={{ ...styles.th, textAlign: "right" }}>Variación</th>
									<th style={{ ...styles.th, textAlign: "right" }}>Saldo Resultante</th>
									<th style={styles.th}>Operación / Motivo</th>
								</tr>
							</thead>
							<tbody>
								{movimientos.map((m) => {
									const isPositive = m.cantidad > 0;
									const deltaFormatted = isPositive ? `+${m.cantidad}` : `${m.cantidad}`;
									return (
										<tr key={m.id} style={styles.tr}>
											<td style={styles.td}>
												<div style={{ fontWeight: 500, color: COLOR.TEXT.PRIMARY }}>
													{formatDateLabel(m.fecha || m.created_at)}
												</div>
												<div style={{ fontSize: 11, color: COLOR.TEXT.SECONDARY }}>
													{new Date(m.fecha || m.created_at).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</div>
											</td>
											<td style={styles.td}>{renderBadge(m.tipo_movimiento)}</td>
											<td style={styles.td}>{m.taller_nombre || "-"}</td>
											<td
												style={{
													...styles.td,
													textAlign: "right",
													fontWeight: 600,
													color: isPositive ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.DANGER,
												}}
											>
												{deltaFormatted}
											</td>
											<td style={{ ...styles.td, textAlign: "right", fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>
												{m.saldo_posterior} u.
											</td>
											<td style={styles.td}>
												{m.operacion_id ? (
													<Link
														href={`/operaciones/${m.operacion_id}`}
														style={{
															fontSize: 13,
															color: COLOR.ACCENT.PRIMARY,
															textDecoration: "none",
															fontWeight: 500,
														}}
													>
														Ver #{m.operacion_id.slice(0, 8)} ➔
													</Link>
												) : null}
												{m.motivo ? (
													<div style={{ fontSize: 12, color: COLOR.TEXT.SECONDARY, marginTop: 2 }}>
														{m.motivo}
													</div>
												) : null}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</Modal>
	);
}

const styles = {
	summaryBar: css`
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 16px;
		background-color: ${COLOR.BACKGROUND.SUBTLE};
		border-radius: 8px;
		border: 1px solid ${COLOR.BORDER.SUBTLE};

		@media (min-width: ${BREAKPOINTS.md}px) {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	`,
	tallerSelect: {
		height: 34,
		fontSize: 13,
		borderRadius: 6,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		padding: "0 8px",
		backgroundColor: "#fff",
		color: COLOR.TEXT.PRIMARY,
	},
	table: {
		width: "100%",
		borderCollapse: "collapse" as const,
		fontSize: 13,
	},
	theadRow: {
		borderBottom: `2px solid ${COLOR.BORDER.SUBTLE}`,
		textAlign: "left" as const,
	},
	th: {
		padding: "10px 12px",
		fontSize: 12,
		fontWeight: 600,
		color: COLOR.TEXT.SECONDARY,
		textTransform: "uppercase" as const,
		letterSpacing: "0.5px",
	},
	tr: {
		borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
	},
	td: {
		padding: "10px 12px",
		verticalAlign: "middle" as const,
	},
	badgeSuccess: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString()};
		color: ${COLOR.SEMANTIC.SUCCESS};
	`,
	badgeInfo: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString()};
		color: ${COLOR.SEMANTIC.INFO};
	`,
	badgePurple: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color("#7c3aed").alpha(0.12).toString()};
		color: #7c3aed;
	`,
	badgeWarning: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString()};
		color: ${COLOR.SEMANTIC.WARNING};
	`,
	badgeDanger: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString()};
		color: ${COLOR.SEMANTIC.DANGER};
	`,
	badgeNeutral: css`
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background-color: ${Color(COLOR.TEXT.SECONDARY).alpha(0.12).toString()};
		color: ${COLOR.TEXT.SECONDARY};
	`,
};
