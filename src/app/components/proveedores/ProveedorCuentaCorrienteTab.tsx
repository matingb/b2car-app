"use client";

import React, { useCallback, useEffect, useState } from "react";
import { css } from "@emotion/react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { ShoppingCart } from "lucide-react";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";
import Link from "next/link";

export type ProveedorCuentaCorrienteTabProps = {
	proveedorId: string;
	onCountChange?: (count: number) => void;
	onNuevaCompra?: () => void;
};

export default function ProveedorCuentaCorrienteTab({
	proveedorId,
	onCountChange,
	onNuevaCompra,
}: ProveedorCuentaCorrienteTabProps) {
	const [data, setData] = useState<ProveedorCuentaCorrienteResumen | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await proveedoresClient.getOperaciones(proveedorId);
			if (res.error) throw new Error(res.error);
			setData(res.data);
			onCountChange?.(res.data?.operaciones.length ?? 0);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Error cargando cuenta corriente");
		} finally {
			setLoading(false);
		}
	}, [proveedorId, onCountChange]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	if (loading) {
		return <div style={styles.loadingContainer}>Cargando operaciones y cuenta corriente...</div>;
	}

	if (error) {
		return (
			<Card style={styles.errorCard}>
				<div style={{ color: COLOR.SEMANTIC.DANGER, fontWeight: 600 }}>{error}</div>
				<div style={{ marginTop: 12 }}>
					<Button text="Reintentar" onClick={loadData} outline />
				</div>
			</Card>
		);
	}

	const resumen = data ?? { totalComprado: 0, totalPagado: 0, saldoAdeudado: 0, operaciones: [] };
	const operaciones = resumen.operaciones;


	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
			{/* Listado de Operaciones */}
			{operaciones.length === 0 ? (
				<Card style={styles.emptyCard}>
					<ShoppingCart size={44} color={COLOR.ICON.MUTED} style={{ marginBottom: 12 }} />
					<div style={styles.emptyTitle}>Sin operaciones comerciales</div>
					<div style={styles.emptySubtitle}>
						Aún no se han emitido órdenes de compra o gastos vinculados a este proveedor. Al registrar
						compras, podrás hacer seguimiento de las entregas y el estado de la cuenta corriente aquí.
					</div>
					{onNuevaCompra && (
						<div style={{ marginTop: 16 }}>
							<Button
								icon={<ShoppingCart size={16} />}
								text="Comprar"
								onClick={onNuevaCompra}
							/>
						</div>
					)}
				</Card>
			) : (
				<div css={styles.tableCard}>
					<table style={styles.table}>
						<thead>
							<tr style={styles.theadRow}>
								<th style={styles.th}>Fecha</th>
								<th style={styles.th}>Operación</th>
								<th style={styles.th}>Taller</th>
								<th style={{ ...styles.th, textAlign: "right" }}>Total</th>
								<th style={{ ...styles.th, textAlign: "right" }}>Pagado</th>
								<th style={{ ...styles.th, textAlign: "right" }}>Saldo</th>
							</tr>
						</thead>
						<tbody>
							{operaciones.map((op) => (
								<tr key={op.id} style={styles.tr}>
									<td style={styles.td}>
										<div style={{ fontWeight: 500, color: COLOR.TEXT.PRIMARY }}>
											{formatDateLabel(op.fecha || op.created_at)}
										</div>
										<div style={{ fontSize: 11, color: COLOR.TEXT.SECONDARY }}>
											{new Date(op.fecha || op.created_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</div>
									</td>

									<td style={styles.td}>
										<Link
											href={`/operaciones/${op.id}`}
											style={styles.operacionLink}
										>
											{op.tipo} #{op.id.slice(0, 8).toUpperCase()}
										</Link>
										{op.observaciones && (
											<div style={{ fontSize: 11, color: COLOR.TEXT.SECONDARY, marginTop: 2 }}>
												{op.observaciones}
											</div>
										)}
									</td>

									<td style={styles.td}>{op.taller_nombre || "—"}</td>

									<td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
										{formatArs(op.monto_total)}
									</td>

									<td style={{ ...styles.td, textAlign: "right", color: COLOR.SEMANTIC.SUCCESS }}>
										{formatArs(op.total_pagado)}
									</td>

									<td
										style={{
											...styles.td,
											textAlign: "right",
											fontWeight: 700,
											color: op.saldo_pendiente > 0 ? COLOR.SEMANTIC.WARNING : COLOR.TEXT.PRIMARY,
										}}
									>
										{formatArs(op.saldo_pendiente)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
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
	statsGrid: css({
		display: "grid",
		gridTemplateColumns: "repeat(3, 1fr)",
		gap: 16,
		[`@media (max-width: ${BREAKPOINTS.md}px)`]: {
			gridTemplateColumns: "1fr",
		},
	}),
	statCard: {
		padding: 18,
		borderRadius: 12,
		background: COLOR.BACKGROUND.SECONDARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		display: "flex",
		flexDirection: "column" as const,
		gap: 4,
	},
	statHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 4,
	},
	statLabel: {
		fontSize: 12,
		fontWeight: 600,
		color: COLOR.TEXT.SECONDARY,
		textTransform: "uppercase" as const,
		letterSpacing: "0.04em",
	},
	statNumber: {
		fontSize: 22,
		fontWeight: 700,
		color: COLOR.TEXT.PRIMARY,
	},
	statFootnote: {
		fontSize: 12,
		color: COLOR.TEXT.SECONDARY,
		marginTop: 4,
	},
	tableCard: css({
		backgroundColor: COLOR.BACKGROUND.SECONDARY,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		borderRadius: 12,
		overflowX: "auto",
	}),
	table: {
		width: "100%",
		borderCollapse: "collapse" as const,
		fontSize: 13,
	},
	theadRow: {
		borderBottom: `2px solid ${COLOR.BORDER.SUBTLE}`,
		backgroundColor: COLOR.BACKGROUND.SUBTLE,
		textAlign: "left" as const,
	},
	th: {
		padding: "12px 16px",
		fontSize: 12,
		fontWeight: 700,
		textTransform: "uppercase" as const,
		letterSpacing: "0.04em",
		color: COLOR.TEXT.SECONDARY,
	},
	tr: {
		borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
	},
	td: {
		padding: "12px 16px",
		verticalAlign: "middle" as const,
	},
	operacionLink: {
		fontWeight: 600,
		fontSize: 13,
		color: COLOR.ACCENT.PRIMARY,
		textDecoration: "none",
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
