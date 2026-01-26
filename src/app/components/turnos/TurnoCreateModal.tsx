"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useClientes } from "@/app/providers/ClientesProvider";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { CreateTurnoInput } from "@/app/api/turnos/turnosService";
import Dropdown from "@/app/components/ui/Dropdown";
import { TipoCliente, Turno } from "@/model/types";

export type CreatedTurno = {
	id: number;
	fecha: string;
	hora: string;
	duracion: number | null;
	cliente_id: string;
	vehiculo_id: string;
	tipo: string | null;
};

type Props = {
	open: boolean;
	onClose: (turno?: CreatedTurno) => void;
	defaultFecha?: Date;
	defaultHora?: string;
	defaultClienteId?: string;
	turnoToEdit?: Turno | null;
};

const DURACIONES_MIN = [30, 45, 60, 90, 120, 150, 180] as const;
const TIPOS_TURNO = ["Mecánica", "Eléctrica", "Carrocería", "Pintura", "Neumáticos", "Service"] as const;

const CREATE_CLIENTE_VALUE = "__create_cliente__";
const CREATE_VEHICULO_VALUE = "__create_vehiculo__";

function toISODateLocal(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function norm(s: string) {
	return s.trim().toLowerCase();
}

export default function TurnoCreateModal({
	open,
	onClose,
	defaultFecha,
	defaultHora,
	defaultClienteId,
	turnoToEdit,
}: Props) {
	const { clientes, createParticular, createEmpresa } = useClientes();
	const { vehiculos, create: createVehiculo } = useVehiculos();
	const toast = useToast();

	const [clienteId, setClienteId] = useState(defaultClienteId ?? "");
	const [vehiculoId, setVehiculoId] = useState("");
	const [fecha, setFecha] = useState<string>(toISODateLocal(defaultFecha ?? new Date()));
	const [hora, setHora] = useState<string>(defaultHora ?? "09:00");
	const [duracion, setDuracion] = useState<number | null>(null);
	const [tipo, setTipo] = useState<string>("Mecánica");
	const [descripcion, setDescripcion] = useState<string>("");
	const [observaciones, setObservaciones] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const { create, update } = useTurnos();
	const isEditing = Boolean(turnoToEdit);

	// Inline create Cliente
	const [clienteTipo, setClienteTipo] = useState<TipoCliente>(TipoCliente.PARTICULAR);
	const [clienteNombre, setClienteNombre] = useState<string>("");
	const [clienteApellido, setClienteApellido] = useState<string>("");
	const [clienteCuit, setClienteCuit] = useState<string>("");
	const [clienteTelefono, setClienteTelefono] = useState<string>("");
	const [clienteEmail, setClienteEmail] = useState<string>("");
	const [clienteDireccion, setClienteDireccion] = useState<string>("");

	// Inline create Vehiculo
	const [vehiculoPatente, setVehiculoPatente] = useState<string>("");
	const [vehiculoFechaPatente, setVehiculoFechaPatente] = useState<string>("");
	const [vehiculoMarca, setVehiculoMarca] = useState<string>("");
	const [vehiculoModelo, setVehiculoModelo] = useState<string>("");
	const [vehiculoNroInterno, setVehiculoNroInterno] = useState<string>("");

	const isCreatingCliente = clienteId === CREATE_CLIENTE_VALUE;
	const isCreatingVehiculo = vehiculoId === CREATE_VEHICULO_VALUE;

	const tipoClienteOptions: AutocompleteOption[] = useMemo(
		() => [
			{ value: TipoCliente.PARTICULAR, label: "Particular" },
			{ value: TipoCliente.EMPRESA, label: "Empresa" },
		],
		[]
	);

	const clienteOptions: AutocompleteOption[] = useMemo(
		() => [
			{ value: CREATE_CLIENTE_VALUE, label: "+ Crear cliente", secondaryLabel: "Cargar datos del cliente nuevo" },
			...clientes.map((c) => ({
				value: String(c.id),
				label: c.nombre,
				secondaryLabel: c.email || undefined,
			})),
		],
		[clientes]
	);

	const selectedCliente = useMemo(() => {
		if (!clienteId || isCreatingCliente) return undefined;
		return clientes.find((c) => String(c.id) === clienteId);
	}, [clientes, clienteId, isCreatingCliente]);

	const vehiculosFiltrados = useMemo(() => {
		if (!selectedCliente) return [];

		// Nota: el modelo actual de Vehiculo no tiene cliente_id; filtramos por nombre_cliente.
		const clienteNombre = norm(selectedCliente.nombre);
		return vehiculos.filter((v) => {
			const nombreClienteVeh = norm(v.nombre_cliente || "");
			return (
				nombreClienteVeh === clienteNombre ||
				nombreClienteVeh.includes(clienteNombre) ||
				clienteNombre.includes(nombreClienteVeh)
			);
		});
	}, [vehiculos, selectedCliente]);

	const vehiculoOptions: AutocompleteOption[] = useMemo(() => {
		const base: AutocompleteOption[] = vehiculosFiltrados.map((v) => {
			const label = `${v.marca} ${v.modelo} - ${v.patente}`.trim();
			const secondaryParts = [v.nombre_cliente, v.nro_interno ? `Int: ${v.nro_interno}` : ""].filter(Boolean);
			return {
				value: String(v.id),
				label: label.length > 3 ? label : v.patente,
				secondaryLabel: secondaryParts.join(" · ") || undefined,
			};
		});

		return [
			{ value: CREATE_VEHICULO_VALUE, label: "+ Crear vehículo", secondaryLabel: "Cargar datos del vehículo nuevo" },
			...base,
		];
	}, [vehiculosFiltrados]);

	const tipoOptions: AutocompleteOption[] = useMemo(
		() => TIPOS_TURNO.map((t) => ({ value: t, label: t })),
		[]
	);

	const duracionOptions: AutocompleteOption[] = useMemo(
		() => DURACIONES_MIN.map((m) => ({ value: String(m), label: `${m} min` })),
		[]
	);

	useEffect(() => {
		if (!open) return;

		if (turnoToEdit) {
			setClienteId(String(turnoToEdit.cliente.id));
			setVehiculoId(String(turnoToEdit.vehiculo.id));
			setFecha(turnoToEdit.fecha);
			setHora(turnoToEdit.hora);
			setDuracion(turnoToEdit.duracion ?? null);
			setTipo(turnoToEdit.tipo ?? "Mecánica");
			setDescripcion(turnoToEdit.descripcion ?? "");
			setObservaciones(turnoToEdit.observaciones ?? "");
			setSubmitting(false);
			setClienteTipo(turnoToEdit.cliente.tipo_cliente ?? TipoCliente.PARTICULAR);
		} else {
			setClienteId(defaultClienteId ?? "");
			setVehiculoId("");
			setFecha(toISODateLocal(defaultFecha ?? new Date()));
			setHora(defaultHora ?? "09:00");
			setDuracion(null);
			setTipo("Mecánica");
			setDescripcion("");
			setObservaciones("");
			setSubmitting(false);
			setClienteTipo(TipoCliente.PARTICULAR);
		}

		setClienteNombre("");
		setClienteApellido("");
		setClienteCuit("");
		setClienteTelefono("");
		setClienteEmail("");
		setClienteDireccion("");

		setVehiculoPatente("");
		setVehiculoFechaPatente("");
		setVehiculoMarca("");
		setVehiculoModelo("");
		setVehiculoNroInterno("");
	}, [open, defaultClienteId, defaultFecha, defaultHora, turnoToEdit]);

	const clienteInlineIsValid = useMemo(() => {
		if (clienteNombre.trim().length === 0) return false;
		if (clienteTipo === TipoCliente.PARTICULAR && clienteApellido.trim().length === 0) return false;
		if (clienteTipo === TipoCliente.EMPRESA && clienteCuit.trim().length === 0) return false;
		return true;
	}, [clienteNombre, clienteTipo, clienteApellido, clienteCuit]);

	const clienteIdForVehiculo = useMemo(() => {
		if (isCreatingCliente) return "";
		return clienteId;
	}, [clienteId, isCreatingCliente]);

	const vehiculoInlineIsValid = useMemo(() => {
		if (vehiculoPatente.trim().length === 0) return false;
		// Debe existir un cliente (seleccionado o por crear)
		if (!selectedCliente && !isCreatingCliente) return false;
		return true;
	}, [vehiculoPatente, selectedCliente, isCreatingCliente]);

	const isValid = useMemo(() => {
		const okCliente = isCreatingCliente ? clienteInlineIsValid : clienteId.trim().length > 0;
		const okVehiculo = isCreatingVehiculo ? vehiculoInlineIsValid : vehiculoId.trim().length > 0;
		const okFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
		const okHora = /^\d{2}:\d{2}$/.test(hora);
		return okCliente && okVehiculo && okFecha && okHora
	}, [clienteId, vehiculoId, fecha, hora, isCreatingCliente, isCreatingVehiculo, clienteInlineIsValid, vehiculoInlineIsValid]);

	if (!open) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;

		setSubmitting(true);
		try {
			let resolvedClienteId = clienteId;
			let resolvedVehiculoId = vehiculoId;

			if (isCreatingCliente) {
				if (!clienteInlineIsValid) throw new Error("Completá los datos obligatorios del cliente");
				const createdCliente =
					clienteTipo === TipoCliente.EMPRESA
						? await createEmpresa({
							nombre: clienteNombre.trim(),
							cuit: clienteCuit.trim(),
							telefono: clienteTelefono.trim(),
							email: clienteEmail.trim(),
							direccion: clienteDireccion.trim(),
						})
						: await createParticular({
							nombre: clienteNombre.trim(),
							apellido: clienteApellido.trim() || undefined,
							telefono: clienteTelefono.trim(),
							email: clienteEmail.trim(),
							direccion: clienteDireccion.trim(),
						});

				resolvedClienteId = String(createdCliente.id);
				setClienteId(resolvedClienteId);
			}

			if (isCreatingVehiculo) {
				if (!vehiculoInlineIsValid) throw new Error("Completá los datos obligatorios del vehículo");
				const clienteIdToUse = isCreatingCliente ? resolvedClienteId : clienteIdForVehiculo;
				if (!clienteIdToUse) throw new Error("Seleccioná o creá un cliente antes del vehículo");
				const createdVehiculoId = await createVehiculo({
					cliente_id: clienteIdToUse,
					patente: vehiculoPatente.trim().replace(/\s/g, "").toUpperCase(),
					marca: vehiculoMarca.trim() || "",
					modelo: vehiculoModelo.trim() || "",
					fecha_patente: vehiculoFechaPatente.trim() || "",
					nro_interno: vehiculoNroInterno.trim() || "",
				});

				if (!createdVehiculoId) throw new Error("No se pudo crear el vehículo");
				resolvedVehiculoId = String(createdVehiculoId);
				setVehiculoId(resolvedVehiculoId);
			}

			const payload: CreateTurnoInput = {
				fecha,
				hora,
				duracion,
				cliente_id: resolvedClienteId,
				vehiculo_id: resolvedVehiculoId,
				tipo,
				estado: turnoToEdit?.estado ?? "confirmado",
				descripcion,
				observaciones,
			};

			const response = isEditing
				? await update(turnoToEdit!.id, payload)
				: await create(payload);

			if (!response) throw new Error("No se recibió respuesta del servidor");

			toast.success(isEditing ? "Turno actualizado" : "Turno creado", `${fecha} ${hora}`);
			onClose();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Ocurrió un error";
			toast.error(msg);
		} finally {
			setSubmitting(false);
		}

	};

	return (
		<Modal
			open={open}
			title={isEditing ? "Editar turno" : "Crear turno"}
			onClose={() => onClose()}
			onSubmit={handleSubmit}
			submitText={isEditing ? "Guardar cambios" : "Guardar"}
			submitting={submitting}
			disabledSubmit={!isValid}
		>
			<div style={{ display: "grid", gap: 12 }}>
				<div>
					<label style={styles.label}>
						Cliente <span aria-hidden="true" style={styles.required}>*</span>
					</label>
					<Autocomplete
						options={clienteOptions}
						value={clienteId}
						onChange={(v) => {
							setClienteId(v);
							setVehiculoId("");
						}}
						placeholder="Buscar cliente..."
					/>
					{isCreatingCliente && (
						<div style={styles.inlineForm}>
							<div style={styles.row}>
								<div style={styles.field}>
									<label style={styles.label}>
										Nombre <span aria-hidden="true" style={styles.required}>*</span>
									</label>
									<input
										style={styles.input}
										placeholder={clienteTipo === TipoCliente.EMPRESA ? "Nombre de la empresa" : "Nombre del cliente"}
										value={clienteNombre}
										onChange={(e) => setClienteNombre(e.target.value)}
									/>
								</div>

								{clienteTipo === TipoCliente.PARTICULAR && (
									<div style={styles.field}>
										<label style={styles.label}>
											Apellido <span aria-hidden="true" style={styles.required}>*</span>
										</label>
										<input
											style={styles.input}
											placeholder="Apellido"
											value={clienteApellido}
											onChange={(e) => setClienteApellido(e.target.value)}
										/>
									</div>
								)}

								{clienteTipo === TipoCliente.EMPRESA && (
									<div style={styles.field}>
										<label style={styles.label}>
											CUIT <span aria-hidden="true" style={styles.required}>*</span>
										</label>
										<input
											style={styles.input}
											placeholder="XX-XXXXXXXX-X"
											value={clienteCuit}
											onChange={(e) => setClienteCuit(e.target.value)}
										/>
									</div>
								)}

								<div style={{ ...styles.field, maxWidth: 160 }}>
									<label style={styles.label}>
										Tipo <span aria-hidden="true" style={styles.required}>*</span>
									</label>
									<Dropdown
										value={clienteTipo}
										options={tipoClienteOptions}
										onChange={(value) => setClienteTipo(value as TipoCliente)}
									/>
								</div>
							</div>

							<div style={styles.row}>
								<div style={styles.field}>
									<label style={styles.label}>Teléfono</label>
									<input
										style={styles.input}
										placeholder="+54 11 1234–5678"
										value={clienteTelefono}
										onChange={(e) => setClienteTelefono(e.target.value)}
									/>
								</div>
								<div style={styles.field}>
									<label style={styles.label}>Email</label>
									<input
										style={styles.input}
										placeholder="email@ejemplo.com"
										value={clienteEmail}
										onChange={(e) => setClienteEmail(e.target.value)}
									/>
								</div>
							</div>

							<div>
								<label style={styles.label}>Dirección</label>
								<input
									style={styles.input}
									placeholder="Dirección completa"
									value={clienteDireccion}
									onChange={(e) => setClienteDireccion(e.target.value)}
								/>
							</div>
						</div>
					)}
				</div>

				<div>
					<label style={styles.label}>
						Vehículo <span aria-hidden="true" style={styles.required}>*</span>
					</label>
					{(!isCreatingCliente) && (
						<Autocomplete
							options={vehiculoOptions}
							value={vehiculoId}
							onChange={setVehiculoId}
							placeholder={!selectedCliente && !isCreatingCliente ? "Seleccione o cree un cliente primero" : "Buscar o crear vehículo..."}
							disabled={!selectedCliente && !isCreatingCliente}
						/>
					)}


					{(isCreatingVehiculo || isCreatingCliente) && (
						<div style={styles.inlineForm}>
							{!selectedCliente && !isCreatingCliente ? (
								<div style={styles.inlineError}>Primero seleccioná o creá un cliente.</div>
							) : (
								<>
									<div style={styles.row}>
										<div style={styles.field}>
											<label style={styles.label}>
												Patente <span aria-hidden="true" style={styles.required}>*</span>
											</label>
											<input
												style={styles.input}
												placeholder="AAA000 ~ AA000AA"
												value={vehiculoPatente}
												onChange={(e) => {
													const noSpaces = e.target.value.replace(/\s/g, "");
													setVehiculoPatente(noSpaces.toUpperCase());
												}}
												inputMode="text"
												maxLength={7}
											/>
										</div>
										<div style={styles.field}>
											<label style={styles.label}>Año patente</label>
											<input
												type="text"
												inputMode="numeric"
												pattern="[0-9]*"
												maxLength={4}
												style={styles.input}
												placeholder="YYYY"
												value={vehiculoFechaPatente}
												onChange={(e) => {
													const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
													setVehiculoFechaPatente(onlyDigits);
												}}
											/>
										</div>
									</div>

									<div style={styles.row}>
										<div style={styles.field}>
											<label style={styles.label}>Marca</label>
											<input
												style={styles.input}
												placeholder="Toyota"
												value={vehiculoMarca}
												onChange={(e) => setVehiculoMarca(e.target.value)}
											/>
										</div>
										<div style={styles.field}>
											<label style={styles.label}>Modelo</label>
											<input
												style={styles.input}
												placeholder="Corolla"
												value={vehiculoModelo}
												onChange={(e) => setVehiculoModelo(e.target.value)}
											/>
										</div>
										{(selectedCliente?.tipo_cliente === TipoCliente.EMPRESA || clienteTipo === TipoCliente.EMPRESA) && (
											<div style={styles.field}>
												<label style={styles.label}>Nro interno</label>
												<input
													style={styles.input}
													placeholder="123"
													value={vehiculoNroInterno}
													onChange={(e) => setVehiculoNroInterno(e.target.value)}
												/>
											</div>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>

				<div style={styles.row}>
					<div style={styles.field}>
						<label style={styles.label}>
							Fecha <span aria-hidden="true" style={styles.required}>*</span>
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
							Hora <span aria-hidden="true" style={styles.required}>*</span>
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
							Duración
						</label>
						<Autocomplete
							options={duracionOptions}
							value={duracion !== null ? String(duracion) : ""} // esto es asi por que sting(null) da  -> "null"
							onChange={(v) => {
								if (!v) {
									setDuracion(null);
									return;
								}
								const parsed = Number(v);
								setDuracion(Number.isFinite(parsed) ? parsed : null);
							}}
							placeholder="Seleccionar duración..."
						/>
					</div>
					<div style={styles.field}>
						<label style={styles.label}>
							Tipo
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
	inlineForm: {
		marginTop: 10,
		padding: 12,
		borderRadius: 10,
		border: `1px solid ${COLOR.BORDER.SUBTLE}`,
		background: COLOR.BACKGROUND.SECONDARY,
	},
	inlineError: {
		color: "#b00020",
		fontSize: 13,
	},
	label: {
		display: "block",
		fontSize: 13,
		marginBottom: 6,
		color: COLOR.TEXT.SECONDARY,
	},
	required: {
		color: REQUIRED_ICON_COLOR,
		fontWeight: 700,
		marginLeft: 2,
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

