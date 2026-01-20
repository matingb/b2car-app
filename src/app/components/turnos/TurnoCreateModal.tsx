"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useClientes } from "@/app/providers/ClientesProvider";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";
import { useTurnos } from "@/app/providers/TurnosProvider";

export type CreatedTurno = {
	id: number;
	fecha: string;
	hora: string;
	duracion: number;
	cliente_id: string;
	vehiculo_id: string;
	tipo: string;
};

type Props = {
	open: boolean;
	onClose: (turno?: CreatedTurno) => void;
	defaultFecha?: Date;
	defaultClienteId?: string;
};

const DURACIONES_MIN = [30, 45, 60, 90, 120, 150, 180] as const;
const TIPOS_TURNO = ["Mecánica", "Eléctrica", "Carrocería", "Pintura", "Neumáticos", "Service"] as const;

function toISODateLocal(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function norm(s: string) {
	return s.trim().toLowerCase();
}

export default function TurnoCreateModal({ open, onClose, defaultFecha, defaultClienteId }: Props) {
	const { clientes } = useClientes();
	const { vehiculos } = useVehiculos();
	const toast = useToast();

	const [clienteId, setClienteId] = useState(defaultClienteId ?? "");
	const [vehiculoId, setVehiculoId] = useState("");
	const [fecha, setFecha] = useState<string>(toISODateLocal(defaultFecha ?? new Date()));
	const [hora, setHora] = useState<string>("09:00");
	const [duracion, setDuracion] = useState<number>(60);
	const [tipo, setTipo] = useState<string>("Mecánica");
	const [descripcion, setDescripcion] = useState<string>("");
	const [observaciones, setObservaciones] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
    const { turnos } = useTurnos(); 

	const clienteOptions: AutocompleteOption[] = useMemo(
		() =>
			clientes.map((c) => ({
				value: String(c.id),
				label: c.nombre,
				secondaryLabel: c.email || undefined,
			})),
		[clientes]
	);

	const selectedCliente = useMemo(() => {
		if (!clienteId) return undefined;
		return clientes.find((c) => String(c.id) === clienteId);
	}, [clientes, clienteId]);

	const vehiculosFiltrados = useMemo(() => {
		if (!selectedCliente) return vehiculos;

		// Nota: el modelo actual de Vehiculo no tiene cliente_id; filtramos por nombre_cliente.
		const clienteNombre = norm(selectedCliente.nombre);
		return vehiculos.filter((v) => {
			const nombreClienteVeh = norm(v.nombre_cliente || "");
			return nombreClienteVeh === clienteNombre ||
				nombreClienteVeh.includes(clienteNombre) ||
				clienteNombre.includes(nombreClienteVeh);
		});
	}, [vehiculos, selectedCliente]);

	const vehiculoOptions: AutocompleteOption[] = useMemo(() => {
		return vehiculosFiltrados.map((v) => {
			const label = `${v.marca} ${v.modelo} - ${v.patente}`.trim();
			const secondaryParts = [v.nombre_cliente, v.nro_interno ? `Int: ${v.nro_interno}` : ""].filter(Boolean);
			return {
				value: String(v.id),
				label: label.length > 3 ? label : v.patente,
				secondaryLabel: secondaryParts.join(" · ") || undefined,
			};
		});
	}, [vehiculosFiltrados]);

	const tipoOptions: AutocompleteOption[] = useMemo(
		() => TIPOS_TURNO.map((t) => ({ value: t, label: t })),
		[]
	);

	useEffect(() => {
		if (!open) return;
		setClienteId(defaultClienteId ?? "");
		setVehiculoId("");
		setFecha(toISODateLocal(defaultFecha ?? new Date()));
		setHora("09:00");
		setDuracion(60);
		setTipo("Mecánica");
		setDescripcion("");
		setObservaciones("");
		setSubmitting(false);
	}, [open, defaultClienteId, defaultFecha]);

	useEffect(() => {
		// Si cambia el cliente, limpiar vehículo seleccionado
		setVehiculoId("");
	}, [clienteId]);

	const isValid = useMemo(() => {
		const okCliente = clienteId.trim().length > 0;
		const okVehiculo = vehiculoId.trim().length > 0;
		const okFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
		const okHora = /^\d{2}:\d{2}$/.test(hora);
		const okDuracion = Number.isFinite(duracion) && duracion > 0;
		const okTipo = tipo.trim().length > 0;
		return okCliente && okVehiculo && okFecha && okHora && okDuracion && okTipo;
	}, [clienteId, vehiculoId, fecha, hora, duracion, tipo]);

	if (!open) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;
        /*
		setSubmitting(true);
		try {
			const { data, error } = await turnosClient.create({
				cliente_id: clienteId,
				vehiculo_id: vehiculoId,
				fecha,
				hora,
				duracion,
				tipo: tipo.trim(),
				descripcion: descripcion.trim() ? descripcion.trim() : null,
				observaciones: observaciones.trim() ? observaciones.trim() : null,
			});

			if (error || !data) {
				throw new Error(error || "Error al crear turno");
			}

			toast.success("Turno creado", `${fecha} ${hora} (${duracion} min)`);
			onClose({
				id: data.id,
				fecha: data.fecha,
				hora: data.hora,
				duracion: data.duracion,
				cliente_id: data.cliente_id,
				vehiculo_id: data.vehiculo_id,
				tipo: data.tipo,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Ocurrió un error";
			toast.error(msg);
		} finally {
			setSubmitting(false);
		}
            */
	};

	return (
		<Modal
			open={open}
			title="Crear turno"
			onClose={() => onClose()}
			onSubmit={handleSubmit}
			submitText="Guardar"
			submitting={submitting}
			disabledSubmit={!isValid}
		>
			<div style={{ display: "grid", gap: 12 }}>
				<div>
					<label style={styles.label}>
						Cliente <span style={{ color: "#d00" }}>*</span>
					</label>
					<Autocomplete
						options={clienteOptions}
						value={clienteId}
						onChange={setClienteId}
						placeholder="Buscar cliente..."
					/>
				</div>

				<div>
					<label style={styles.label}>
						Vehículo <span style={{ color: "#d00" }}>*</span>
					</label>
					<Autocomplete
						options={vehiculoOptions}
						value={vehiculoId}
						onChange={setVehiculoId}
						placeholder={
							selectedCliente
								? vehiculoOptions.length
									? "Buscar vehículo..."
									: "Sin vehículos para este cliente"
								: "Seleccione un cliente primero"
						}
						disabled={!selectedCliente || vehiculoOptions.length === 0}
					/>
				</div>

				<div style={styles.row}>
					<div style={styles.field}>
						<label style={styles.label}>
							Fecha <span style={{ color: "#d00" }}>*</span>
						</label>
						<input
							type="date"
							style={styles.input}
							value={fecha}
							onChange={(e) => setFecha(e.target.value)}
						/>
					</div>
					<div style={styles.field}>
						<label style={styles.label}>
							Hora <span style={{ color: "#d00" }}>*</span>
						</label>
						<input
							type="time"
							step={300}
							style={styles.input}
							value={hora}
							onChange={(e) => setHora(e.target.value)}
						/>
					</div>
				</div>

				<div style={styles.row}>
					<div style={styles.field}>
						<label style={styles.label}>
							Duración <span style={{ color: "#d00" }}>*</span>
						</label>
						<select
							style={styles.input}
							value={String(duracion)}
							onChange={(e) => setDuracion(Number(e.target.value))}
						>
							{DURACIONES_MIN.map((m) => (
								<option key={m} value={m}>
									{m} min
								</option>
							))}
						</select>
					</div>
					<div style={styles.field}>
						<label style={styles.label}>
							Tipo <span style={{ color: "#d00" }}>*</span>
						</label>
						<Autocomplete
							options={tipoOptions}
							value={tipo}
							onChange={setTipo}
							placeholder="Ej: Mecánica"
							allowCustomValue
						/>
					</div>
				</div>

				<div>
					<label style={styles.label}>Descripción del trabajo</label>
					<textarea
						style={styles.textarea}
						value={descripcion}
						onChange={(e) => setDescripcion(e.target.value)}
						placeholder="Qué hay que hacer..."
						rows={3}
					/>
				</div>

				<div>
					<label style={styles.label}>Observaciones</label>
					<textarea
						style={styles.textarea}
						value={observaciones}
						onChange={(e) => setObservaciones(e.target.value)}
						placeholder="Notas internas, detalles, etc."
						rows={3}
					/>
				</div>
			</div>
		</Modal>
	);
}

const styles = {
	row: {
		display: "flex",
		gap: 16,
	},
	field: {
		flex: 1,
		minWidth: 0,
	},
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
		color: COLOR.TEXT.PRIMARY,
	},
	textarea: {
		width: "100%",
		padding: "10px 12px",
		borderRadius: 8,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		background: COLOR.INPUT.PRIMARY.BACKGROUND,
		color: COLOR.TEXT.PRIMARY,
		resize: "vertical" as const,
		fontFamily: "inherit",
		fontSize: 14,
	},
} as const;

