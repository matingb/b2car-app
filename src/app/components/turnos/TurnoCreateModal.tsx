"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useClientes } from "@/app/providers/ClientesProvider";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { CreateTurnoInput } from "@/app/api/turnos/turnosService";
import { TipoCliente, Turno } from "@/model/types";
import { createEmptyClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import type { VehiculoFormFieldsValue } from "../vehiculos/VehiculoFormFields";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { buildTurnoWhatsappMessage } from "@/lib/whatsapp";
import { TurnoDto } from "@/model/dtos";
import { toISODateLocal } from "@/lib/fechas";
import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";
import TurnoFormFields, {
	type TurnoFormFieldsModel,
	type TurnoFormFieldsPatch,
	type TurnoFormFieldsState,
	getTurnoInlineFlags,
} from "@/app/components/turnos/TurnoFormFields";

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

function createEmptyVehiculoDraft(): VehiculoFormFieldsValue {
	return {
		cliente_id: "",
		patente: "",
		marca: "",
		modelo: "",
		fecha_patente: "",
		nro_interno: "",
		numero_chasis: "",
	};
}

export default function TurnoCreateModal({
	open,
	onClose,
	defaultFecha,
	defaultHora,
	defaultClienteId,
	turnoToEdit,
}: Props) {
	const { clientes, createParticular, createEmpresa, getClienteById} = useClientes();
	const { vehiculos, create: createVehiculo } = useVehiculos();
	const toast = useToast();
	const { confirm } = useModalMessage();
	const { share } = useWhatsAppMessage();

	const [submitting, setSubmitting] = useState(false);
	const [isValid, setIsValid] = useState(false);
	const { create, update } = useTurnos();
	const isEditing = Boolean(turnoToEdit);

	const [form, setForm] = useState<TurnoFormFieldsState>(() => ({
		clienteId: defaultClienteId ?? "",
		vehiculoId: "",
		fecha: toISODateLocal(defaultFecha ?? new Date()),
		hora: defaultHora ?? "09:00",
		duracion: null,
		tipo: "Mecánica",
		descripcion: "",
		observaciones: "",
		clienteDraft: createEmptyClienteFormFieldsValue(),
		clienteInlineIsValid: false,
		vehiculoDraft: createEmptyVehiculoDraft(),
		vehiculoInlineIsValid: false,
	}));

	const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(form);

	useEffect(() => {
		if (!open) return;

		if (turnoToEdit) {
			setForm((prev) => ({
				...prev,
				clienteId: String(turnoToEdit.cliente.id),
				vehiculoId: String(turnoToEdit.vehiculo.id),
				fecha: turnoToEdit.fecha,
				hora: turnoToEdit.hora,
				duracion: turnoToEdit.duracion ?? null,
				tipo: turnoToEdit.tipo ?? "Mecánica",
				descripcion: turnoToEdit.descripcion ?? "",
				observaciones: turnoToEdit.observaciones ?? "",
				clienteDraft: createEmptyClienteFormFieldsValue(turnoToEdit.cliente.tipo_cliente ?? TipoCliente.PARTICULAR),
				clienteInlineIsValid: false,
				vehiculoDraft: createEmptyVehiculoDraft(),
				vehiculoInlineIsValid: false,
			}));
			setSubmitting(false);
		} else {
			setForm((prev) => ({
				...prev,
				clienteId: defaultClienteId ?? "",
				vehiculoId: "",
				fecha: toISODateLocal(defaultFecha ?? new Date()),
				hora: defaultHora ?? "09:00",
				duracion: null,
				tipo: "Mecánica",
				descripcion: "",
				observaciones: "",
				clienteDraft: createEmptyClienteFormFieldsValue(),
				clienteInlineIsValid: false,
				vehiculoDraft: createEmptyVehiculoDraft(),
				vehiculoInlineIsValid: false,
			}));
			setSubmitting(false);
		}

		setIsValid(false);
	}, [open, defaultClienteId, defaultFecha, defaultHora, turnoToEdit]);

	const clienteIdForVehiculo = useMemo(() => {
		if (isCreatingCliente) return "";
		return form.clienteId;
	}, [form.clienteId, isCreatingCliente]);

	if (!open) return null;

	const handleShareTurno = async (turno: TurnoDto) => {
		const tenantName = localStorage.getItem("tenant_name") || undefined;
		const mensaje = buildTurnoWhatsappMessage(turno as unknown as Turno, tenantName);
		const cliente = await getClienteById(String(turno.cliente_id));
		await share(mensaje, cliente?.telefono);
	}


	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;

		setSubmitting(true);
		try {
			let resolvedClienteId = form.clienteId;
			let resolvedVehiculoId = form.vehiculoId;

			if (isCreatingCliente) {
				if (!form.clienteInlineIsValid) throw new Error("Completá los datos obligatorios del cliente");
				const createdCliente =
					form.clienteDraft.tipo_cliente === TipoCliente.EMPRESA
						? await createEmpresa({
							nombre: form.clienteDraft.nombre.trim(),
							cuit: form.clienteDraft.cuit.trim(),
							codigo_pais: form.clienteDraft.codigoPais || undefined,
							telefono: form.clienteDraft.telefono.trim(),
							email: form.clienteDraft.email.trim(),
							direccion: form.clienteDraft.direccion.trim(),
						})
						: await createParticular({
							nombre: form.clienteDraft.nombre.trim(),
							apellido: form.clienteDraft.apellido.trim() || undefined,
							codigo_pais: form.clienteDraft.codigoPais || undefined,
							telefono: form.clienteDraft.telefono.trim(),
							email: form.clienteDraft.email.trim(),
							direccion: form.clienteDraft.direccion.trim(),
						});

				resolvedClienteId = String(createdCliente.id);
				setForm((prev) => ({ ...prev, clienteId: resolvedClienteId }));
			}

			if (isCreatingVehiculo) {
				if (!form.vehiculoInlineIsValid) throw new Error("Completá los datos obligatorios del vehículo");
				const clienteIdToUse = isCreatingCliente ? resolvedClienteId : clienteIdForVehiculo;
				if (!clienteIdToUse) throw new Error("Seleccioná o creá un cliente antes del vehículo");
				const createdVehiculoId = await createVehiculo({
					cliente_id: clienteIdToUse,
					patente: form.vehiculoDraft.patente.trim().replace(/\s/g, "").toUpperCase(),
					marca: form.vehiculoDraft.marca.trim() || "",
					modelo: form.vehiculoDraft.modelo.trim() || "",
					fecha_patente: form.vehiculoDraft.fecha_patente.trim() || "",
					numero_chasis: form.vehiculoDraft.numero_chasis.trim() || "",
					nro_interno: form.vehiculoDraft.nro_interno.trim() || null,
				});

				if (!createdVehiculoId) throw new Error("No se pudo crear el vehículo");
				resolvedVehiculoId = String(createdVehiculoId);
				setForm((prev) => ({ ...prev, vehiculoId: resolvedVehiculoId }));
			}

			const payload: CreateTurnoInput = {
				fecha: form.fecha,
				hora: form.hora,
				duracion: form.duracion,
				cliente_id: resolvedClienteId,
				vehiculo_id: resolvedVehiculoId,
				tipo: form.tipo,
				estado: turnoToEdit?.estado ?? "confirmado",
				descripcion: form.descripcion,
				observaciones: form.observaciones,
			};

			const response = isEditing
				? await update(turnoToEdit!.id, payload)
				: await create(payload);

			if (!response) throw new Error("No se recibió respuesta del servidor");

			toast.success(
				isEditing ? "Turno actualizado" : "Turno creado",
				isEditing
					? "Los cambios del turno se guardaron correctamente."
					: `Turno agendado para ${form.fecha} a las ${form.hora}.`
			);
			onClose();
			if (!isEditing && response) {
				const confirmed = await confirm({
					title: "Compartir turno",
					message: `¿Querés compartir la informacion del turno recién creado?`,
					acceptLabel: "Compartir",
					cancelLabel: "Ahora no",
				});
				if (confirmed) {
					await handleShareTurno(response);
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Ocurrió un error";
			toast.error(msg);
		} finally {
			setSubmitting(false);
		}

	};

	const handleFormChange = (patch: TurnoFormFieldsPatch) => {
		setForm((prev) => {
			const { clienteDraft, vehiculoDraft, ...rest } = patch;
			return {
				...prev,
				...rest,
				clienteDraft: { ...prev.clienteDraft, ...(clienteDraft ?? {}) },
				vehiculoDraft: { ...prev.vehiculoDraft, ...(vehiculoDraft ?? {}) },
			};
		});
	};

	const model: TurnoFormFieldsModel = {
		state: form,
		context: {
			clientes,
			vehiculos,
		},
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
			modalStyle={{ overflowY: "auto" }}
		>
			<TurnoFormFields
				model={model}
				onChange={handleFormChange}
				onValidityChange={setIsValid}
			/>
		</Modal>
	);
}
