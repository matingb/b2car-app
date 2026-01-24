"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

export type CreatedTaller = {
	nombre: string;
	direccion: string;
};

type Props = {
	open: boolean;
	onClose: (taller?: CreatedTaller) => void;
};

export default function TallerCreateModal({ open, onClose }: Props) {
	const [nombre, setNombre] = useState("");
	const [direccion, setDireccion] = useState("");

	useEffect(() => {
		if (!open) return;
		setNombre("");
		setDireccion("");
	}, [open]);

	const canSubmit = useMemo(() => {
		return Boolean(nombre.trim() && direccion.trim());
	}, [nombre, direccion]);

	if (!open) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		onClose({ nombre: nombre.trim(), direccion: direccion.trim() });
	};

	return (
		<Modal
			open={open}
			title="Nuevo taller"
			onClose={() => onClose()}
			onSubmit={handleSubmit}
			submitText="Crear"
			disabledSubmit={!canSubmit}
		>
			<div style={{ padding: "4px 0 12px" }}>
				<div css={styles.row}>
					<div style={styles.fieldWide}>
						<label style={styles.label}>Nombre</label>
						<input
							style={styles.input}
							value={nombre}
							onChange={(e) => setNombre(e.target.value)}
							placeholder="Ej: Taller Central"
						/>
					</div>
				</div>

				<div css={styles.row}>
					<div style={styles.fieldWide}>
						<label style={styles.label}>Dirección</label>
						<input
							style={styles.input}
							value={direccion}
							onChange={(e) => setDireccion(e.target.value)}
							placeholder="Ej: Av. San Martín 1234"
						/>
					</div>
				</div>
			</div>
		</Modal>
	);
}

const styles = {
	row: css({
		display: "flex",
		gap: 16,
		marginTop: 10,
		width: "auto",
		[`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
			width: "100%",
			flexDirection: "column",
			gap: 8,
		},
	}),
	fieldWide: { flex: 1 },
	label: {
		display: "block",
		fontSize: 13,
		marginBottom: 6,
		color: COLOR.TEXT.SECONDARY,
	},
	input: {
		width: "100%",
		padding: "10px 12px",
		borderRadius: 8,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		background: COLOR.INPUT.PRIMARY.BACKGROUND,
	},
} as const;
