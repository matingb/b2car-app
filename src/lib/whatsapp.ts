import { formatArs } from "@/lib/format";
import type { ArregloDetalleData, AsignacionArregloLinea } from "@/app/api/arreglos/[id]/route";
import type { Turno } from "@/model/types";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { safeNumber } from "@/lib/numbers";
import { calcLineTotal, calcLineSubtotal } from "@/lib/calcLineTotal";
import { importeComercial } from "@/lib/ivaComercial";

export interface ArregloWhatsappOptions {
	tenantName?: string;
	mostrarDetalleItems?: boolean;
	mostrarPreciosItems?: boolean;
	mostrarSubtotales?: boolean;
	mostrarTotal?: boolean;
	mostrarDescuento?: boolean;
	incluirKm?: boolean;
	incluirObservaciones?: boolean;
	/** Solo aplica a arreglos con precios sin IVA: en false los montos van netos y el IVA se discrimina. */
	preciosConIva?: boolean;
}

type WhatsappRepuestoLinea = {
	label: string;
	cantidad: number;
	monto_unitario: number;
	descuento: number;
};

type ImporteCliente = (importe: number) => number;

export function buildArregloWhatsappMessage(
	data: ArregloDetalleData,
	tenantNameOrOptions?: string | ArregloWhatsappOptions
): string {
	if (!data?.arreglo) return "";

	const options: ArregloWhatsappOptions =
		typeof tenantNameOrOptions === "string"
			? { tenantName: tenantNameOrOptions }
			: tenantNameOrOptions ?? {};

	const {
		tenantName,
		mostrarDetalleItems = true,
		mostrarPreciosItems = true,
		mostrarSubtotales = false,
		mostrarTotal = true,
		mostrarDescuento = true,
		incluirKm = true,
		incluirObservaciones = true,
		preciosConIva = true,
	} = options;

	const arreglo = data.arreglo;
	const detalles = Array.isArray(data.detalles) ? data.detalles : [];
	const repuestosLineas = getRepuestosWhatsappLines(data);
	const importeConIva = buildImporteCliente(arreglo);
	const discriminarIva = arreglo.precios_incluyen_iva === false && !preciosConIva;
	const importeCliente: ImporteCliente = discriminarIva ? (importe) => importe : importeConIva;

	const isPagado =
		(arreglo.total_cobrado || 0) >= (arreglo.precio_final || 0) && (arreglo.precio_final || 0) > 0;

	const lines: string[] = [];

	// 1. Cabecera
	const esTecnico = !mostrarTotal && !mostrarPreciosItems && !mostrarSubtotales;
	lines.push(buildHeaderLine(isPagado, esTecnico, tenantName));

	// 2. Información del vehículo
	const vehiculoLines = buildVehiculoInfoLines(arreglo, { incluirKm, incluirObservaciones });
	lines.push(...vehiculoLines);
	lines.push("");

	// 3. Totales calculados: el total siempre es el importe final; los subtotales siguen el modo IVA elegido.
	const totals = calculateArregloTotals(
		detalles,
		repuestosLineas,
		arreglo.precio_final,
		importeConIva
	);
	const subtotales = discriminarIva
		? calculateArregloTotals(detalles, repuestosLineas, arreglo.precio_final, importeCliente)
		: totals;

	// 4. Secciones
	if (mostrarDetalleItems) {
		// Repuestos
		if (repuestosLineas.length) {
			lines.push(
				...buildRepuestosSectionLines(
					repuestosLineas,
					importeCliente,
					mostrarPreciosItems,
					mostrarSubtotales,
					mostrarDescuento,
					subtotales.subtotalRepuestos,
					subtotales.subtotalRepuestosBruto,
					subtotales.descuentoRepuestos
				)
			);
			lines.push("");
		}

		// Servicios
		if (detalles.length) {
			lines.push(
				...buildServiciosSectionLines(
					detalles,
					importeCliente,
					mostrarPreciosItems,
					mostrarSubtotales,
					mostrarDescuento,
					subtotales.subtotalServicios,
					subtotales.subtotalServiciosBruto,
					subtotales.descuentoServicios
				)
			);
			lines.push("");
		}
	} else if (mostrarSubtotales) {
		// Modo sin detalle pero con subtotales agrupados
		const montosLines = buildSoloMontosSectionLines(
			subtotales.subtotalRepuestos,
			subtotales.subtotalRepuestosBruto,
			subtotales.descuentoRepuestos,
			subtotales.subtotalServicios,
			subtotales.subtotalServiciosBruto,
			subtotales.descuentoServicios,
			repuestosLineas.length > 0,
			detalles.length > 0,
			mostrarDescuento
		);
		if (montosLines.length) {
			lines.push(...montosLines);
			lines.push("");
		}
	}

	// 5. Total final
	if (mostrarTotal) {
		if (discriminarIva) {
			lines.push(...buildIvaDiscriminadoLines(arreglo, totals.total, subtotales));
		}
		if (mostrarDescuento && totals.totalDescuento > 0) {
			const brutoStr = formatArs(totals.totalBruto, { maxDecimals: 2, minDecimals: 0 });
			const totalStr = formatArs(totals.total, { maxDecimals: 2, minDecimals: 0 });
			lines.push(`*Total arreglo* ~${brutoStr}~ *${totalStr}*`);
		} else {
			lines.push(`*Total arreglo ${formatArs(totals.total, { maxDecimals: 2, minDecimals: 0 })}*`);
		}
	} else {
		// Quitar línea vacía sobrante si terminó con espacio
		if (lines[lines.length - 1] === "") {
			lines.pop();
		}
	}

	return lines.join("\n");
}

function buildHeaderLine(
	isPagado: boolean,
	esTecnico: boolean,
	tenantName?: string
): string {
	const normalizedTenant = (tenantName ?? "").trim();
	const header = esTecnico
		? "Detalle de Arreglo"
		: isPagado
			? "Detalle de Arreglo"
			: "Presupuesto de Arreglo";
	return `*${header}${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`;
}

function buildVehiculoInfoLines(
	arreglo: ArregloDetalleData["arreglo"],
	options: { incluirKm: boolean; incluirObservaciones: boolean }
): string[] {
	const lines: string[] = [];
	lines.push(`🚗 Patente ${arreglo.vehiculo?.patente || "-"}`);

	if (options.incluirKm && arreglo.kilometraje_leido) {
		lines.push(`⏱️ KM actual ${arreglo.kilometraje_leido}`);
	}

	if (options.incluirObservaciones && arreglo.observaciones) {
		lines.push(`📝 Observaciones: ${arreglo.observaciones}`);
	}

	return lines;
}

/** El cliente siempre ve importes finales, con el IVA comercial incluido. */
function buildImporteCliente(arreglo: ArregloDetalleData["arreglo"]): ImporteCliente {
	const incluyeIva = arreglo.precios_incluyen_iva !== false;
	const tasa = arreglo.tasa_iva ?? 0.21;
	return (importe) => importeComercial(importe, incluyeIva, tasa);
}

function calculateArregloTotals(
	detalles: ArregloDetalleData["detalles"],
	repuestosLineas: WhatsappRepuestoLinea[],
	precioFinal: number,
	importeCliente: ImporteCliente
): {
	subtotalServiciosBruto: number;
	subtotalServicios: number;
	descuentoServicios: number;
	subtotalRepuestosBruto: number;
	subtotalRepuestos: number;
	descuentoRepuestos: number;
	totalBruto: number;
	totalDescuento: number;
	total: number;
} {
	let subtotalServiciosBruto = 0;
	let subtotalServicios = 0;
	(detalles ?? []).forEach((d) => {
		const cantidad = safeNumber(d.cantidad);
		const horas = d.horas_facturadas == null ? null : safeNumber(d.horas_facturadas);
		const precio = safeNumber(d.precio_hora_facturada);
		const desc = safeNumber(d.descuento);
		const bruto = calcLineSubtotal({
			cantidad,
			horas_facturadas: horas,
			precio_hora_facturada: precio,
		});
		const neto = calcLineTotal({
			cantidad,
			horas_facturadas: horas,
			precio_hora_facturada: precio,
			descuento: desc,
		});
		subtotalServiciosBruto += importeCliente(bruto);
		subtotalServicios += importeCliente(neto);
	});

	let subtotalRepuestosBruto = 0;
	let subtotalRepuestos = 0;
	repuestosLineas.forEach((l) => {
		const cantidad = safeNumber(l.cantidad);
		const monto = safeNumber(l.monto_unitario);
		const desc = safeNumber(l.descuento);
		const bruto = cantidad * monto;
		const neto = Math.max(0, bruto - desc);
		subtotalRepuestosBruto += importeCliente(bruto);
		subtotalRepuestos += importeCliente(neto);
	});

	const descuentoServicios = Math.max(0, subtotalServiciosBruto - subtotalServicios);
	const descuentoRepuestos = Math.max(0, subtotalRepuestosBruto - subtotalRepuestos);
	const totalCalculado = subtotalServicios + subtotalRepuestos;
	const total = precioFinal > 0 ? precioFinal : totalCalculado;
	const totalDescuento = descuentoServicios + descuentoRepuestos;
	const totalBruto = total + totalDescuento;

	return {
		subtotalServiciosBruto,
		subtotalServicios,
		descuentoServicios,
		subtotalRepuestosBruto,
		subtotalRepuestos,
		descuentoRepuestos,
		totalBruto,
		totalDescuento,
		total,
	};
}

function buildIvaDiscriminadoLines(
	arreglo: ArregloDetalleData["arreglo"],
	total: number,
	subtotales: { subtotalServicios: number; subtotalRepuestos: number }
): string[] {
	// precio_sin_iva persistido incluye todas las entradas del arreglo (también el formulario custom).
	const neto =
		arreglo.precio_final > 0 && arreglo.precio_sin_iva != null
			? safeNumber(arreglo.precio_sin_iva)
			: subtotales.subtotalServicios + subtotales.subtotalRepuestos;
	const iva = Math.round((total - neto) * 100) / 100;
	const tasa = String(Math.round(safeNumber(arreglo.tasa_iva ?? 0.21) * 10000) / 100).replace(".", ",");
	return [
		`_Subtotal: ${formatArs(neto, { maxDecimals: 2, minDecimals: 0 })}_`,
		`_IVA ${tasa}%: ${formatArs(iva, { maxDecimals: 2, minDecimals: 0 })}_`,
	];
}

function buildItemLine(
	label: string,
	cantidad: number,
	monto?: { subtotal: number; total: number; descuento: number },
	mostrarDescuento: boolean = true
): string {
	const qty = cantidad ? ` x${cantidad}` : "";
	if (!monto) {
		return `• ${label}${qty}`;
	}
	if (mostrarDescuento && monto.descuento > 0) {
		const subtotalStr = formatArs(monto.subtotal, { maxDecimals: 2, minDecimals: 0 });
		const totalStr = formatArs(monto.total, { maxDecimals: 2, minDecimals: 0 });
		return `• ${label}${qty} - ~${subtotalStr}~ ${totalStr}`;
	}
	const totalStr = formatArs(monto.total, { maxDecimals: 2, minDecimals: 0 });
	return `• ${label}${qty} - ${totalStr}`;
}

function buildRepuestosSectionLines(
	repuestosLineas: WhatsappRepuestoLinea[],
	importeCliente: ImporteCliente,
	showItemPrices: boolean,
	showSubtotal: boolean,
	mostrarDescuento: boolean,
	subtotalNeto: number,
	subtotalBruto: number,
	descuentoTotal: number
): string[] {
	const lines: string[] = ["📦 *Repuestos:*"];
	repuestosLineas.forEach((r) => {
		const cantidad = safeNumber(r.cantidad);
		const monto = safeNumber(r.monto_unitario);
		const desc = safeNumber(r.descuento);
		const bruto = importeCliente(cantidad * monto);
		const neto = importeCliente(Math.max(0, cantidad * monto - desc));
		const montoObj = showItemPrices
			? { subtotal: bruto, total: neto, descuento: Math.max(0, bruto - neto) }
			: undefined;
		lines.push(buildItemLine(r.label, cantidad, montoObj, mostrarDescuento));
	});
	if (showSubtotal) {
		if (mostrarDescuento && descuentoTotal > 0) {
			const brutoStr = formatArs(subtotalBruto, { maxDecimals: 2, minDecimals: 0 });
			const netoStr = formatArs(subtotalNeto, { maxDecimals: 2, minDecimals: 0 });
			lines.push(`_Subtotal repuestos: ~${brutoStr}~ ${netoStr}_`);
		} else {
			lines.push(`_Subtotal repuestos: ${formatArs(subtotalNeto, { maxDecimals: 2, minDecimals: 0 })}_`);
		}
	}
	return lines;
}

function buildServiciosSectionLines(
	detalles: NonNullable<ArregloDetalleData["detalles"]>,
	importeCliente: ImporteCliente,
	showItemPrices: boolean,
	showSubtotal: boolean,
	mostrarDescuento: boolean,
	subtotalNeto: number,
	subtotalBruto: number,
	descuentoTotal: number
): string[] {
	const lines: string[] = ["👨‍🔧 *Servicios:*"];
	detalles.forEach((d) => {
		const cantidad = safeNumber(d.cantidad);
		const horasFacturadas = d.horas_facturadas == null ? null : safeNumber(d.horas_facturadas);
		const precioHora = safeNumber(d.precio_hora_facturada);
		const desc = safeNumber(d.descuento);
		const bruto = calcLineSubtotal({
			cantidad,
			horas_facturadas: horasFacturadas,
			precio_hora_facturada: precioHora,
		});
		const neto = calcLineTotal({
			cantidad,
			horas_facturadas: horasFacturadas,
			precio_hora_facturada: precioHora,
			descuento: desc,
		});
		const subtotal = importeCliente(bruto);
		const total = importeCliente(neto);
		const label = String(d.descripcion ?? "").trim() || "Servicio";
		const montoObj = showItemPrices
			? { subtotal, total, descuento: Math.max(0, subtotal - total) }
			: undefined;
		lines.push(buildItemLine(label, cantidad, montoObj, mostrarDescuento));
	});
	if (showSubtotal) {
		if (mostrarDescuento && descuentoTotal > 0) {
			const brutoStr = formatArs(subtotalBruto, { maxDecimals: 2, minDecimals: 0 });
			const netoStr = formatArs(subtotalNeto, { maxDecimals: 2, minDecimals: 0 });
			lines.push(`_Subtotal mano de obra: ~${brutoStr}~ ${netoStr}_`);
		} else {
			lines.push(`_Subtotal mano de obra: ${formatArs(subtotalNeto, { maxDecimals: 2, minDecimals: 0 })}_`);
		}
	}
	return lines;
}

function buildSoloMontosSectionLines(
	subtotalRepuestosNeto: number,
	subtotalRepuestosBruto: number,
	descuentoRepuestos: number,
	subtotalServiciosNeto: number,
	subtotalServiciosBruto: number,
	descuentoServicios: number,
	hasRepuestos: boolean,
	hasServicios: boolean,
	mostrarDescuento: boolean
): string[] {
	const lines: string[] = ["💰 *Resumen:*"];
	if (hasRepuestos) {
		if (mostrarDescuento && descuentoRepuestos > 0) {
			const bruto = formatArs(subtotalRepuestosBruto, { maxDecimals: 2, minDecimals: 0 });
			const neto = formatArs(subtotalRepuestosNeto, { maxDecimals: 2, minDecimals: 0 });
			lines.push(`• Repuestos: ~${bruto}~ ${neto}`);
		} else {
			lines.push(`• Repuestos: ${formatArs(subtotalRepuestosNeto, { maxDecimals: 2, minDecimals: 0 })}`);
		}
	}
	if (hasServicios) {
		if (mostrarDescuento && descuentoServicios > 0) {
			const bruto = formatArs(subtotalServiciosBruto, { maxDecimals: 2, minDecimals: 0 });
			const neto = formatArs(subtotalServiciosNeto, { maxDecimals: 2, minDecimals: 0 });
			lines.push(`• Mano de obra: ~${bruto}~ ${neto}`);
		} else {
			lines.push(`• Mano de obra: ${formatArs(subtotalServiciosNeto, { maxDecimals: 2, minDecimals: 0 })}`);
		}
	}
	return lines;
}

export function buildTurnoWhatsappMessage(turno: Turno, tenantName?: string): string {
	const lines: string[] = [];
	const normalizedTenant = (tenantName ?? "").trim();

	lines.push(`*Detalle del turno${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`);
	if (turno.taller?.nombre) {
		lines.push(`📍 Sucursal: ${turno.taller.nombre}${turno.taller.ubicacion ? ` (${turno.taller.ubicacion})` : ""}`);
	}
	if (turno.cliente?.nombre) {
		lines.push(`👤 ${turno.cliente.nombre}`);
	}
	if (turno.vehiculo) {
		const vehiculoLabel = formatPatenteConMarcaYModelo(turno.vehiculo);
		lines.push(`🚗 ${vehiculoLabel}`);
	}
	lines.push("");
	lines.push(`📅 Fecha: ${turno.fecha}`);
	lines.push(`⏰ Hora: ${turno.hora} hs`);
	if (turno.duracion != null && turno.duracion > 0) {
		lines.push(`⏱️ Duración: ${turno.duracion} minutos`);
	}
	if (turno.descripcion) {
		lines.push("");
		lines.push(`📝 ${turno.descripcion}`);
	}
	if (turno.observaciones) {
		lines.push("");
		lines.push(`🗒️ Observaciones: ${turno.observaciones}`);
	}

	return lines.join("\n");
}

export function buildWhatsappAppLink(phone: string, message: string): string {
	const encodedMessage = encodeURIComponent(message);
	return `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
}

export function buildWhatsappWebLink(phone: string, message: string): string {
	const encodedMessage = encodeURIComponent(message);
	const isMobile =
		typeof navigator !== "undefined" &&
		/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
	if (isMobile) {
		return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}`;
	}
	return `https://web.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}`;
}

export function buildWhatsappLink(phone: string, message: string): string {
	const encodedMessage = encodeURIComponent(message);
	return `https://wa.me/${phone}?text=${encodedMessage}`;
}

export function openWhatsapp(phone: string, message: string): void {
	if (typeof window === "undefined") return;

	const cleanPhone = normalizeWhatsappPhone(phone);
	if (!cleanPhone) return;

	let appOpened = false;
	const onBlur = () => {
		appOpened = true;
	};
	const onVisibilityChange = () => {
		if (document.hidden) {
			appOpened = true;
		}
	};

	window.addEventListener("blur", onBlur, { once: true });
	document.addEventListener("visibilitychange", onVisibilityChange, { once: true });

	// 1. Intentar abrir la app nativa mediante el protocolo whatsapp://
	const link = document.createElement("a");
	link.href = buildWhatsappAppLink(cleanPhone, message);
	link.style.display = "none";
	if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
		link.onclick = (e) => e.preventDefault();
	}
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// 2. Fallback a WhatsApp Web tras 1.5s si la app no tomó foco
	window.setTimeout(() => {
		window.removeEventListener("blur", onBlur);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		if (!appOpened) {
			window.open(buildWhatsappWebLink(cleanPhone, message), "_blank", "noopener,noreferrer");
		}
	}, 1500);
}

/**
 * Construye el número completo para WhatsApp a partir de los campos separados
 * del modelo de cliente. Equivalente a pasar el número normalizado a normalizeWhatsappPhone.
 */
export function assembleClientePhone(cliente: {
	codigo_pais?: string | null;
	telefono?: string | null;
}): string {
	return [cliente.codigo_pais, cliente.telefono]
		.map((s) => (s ?? "").replace(/\D/g, ""))
		.filter(Boolean)
		.join("");
}

export function normalizeWhatsappPhone(rawPhone: string): string | null {
	const cleaned = String(rawPhone ?? "").replace(/\D/g, "");
	if (!cleaned) return null;
	return cleaned;
}

function flattenAsignacionesLineas(
	data: ArregloDetalleData
): AsignacionArregloLinea[] {
	if (!Array.isArray(data.asignaciones)) return [];
	const out: AsignacionArregloLinea[] = [];
	for (const op of data.asignaciones) {
		if (!op || !Array.isArray(op.lineas)) continue;
		for (const l of op.lineas) {
			if (!l) continue;
			out.push(l);
		}
	}
	return out;
}

function getRepuestosWhatsappLines(data: ArregloDetalleData): WhatsappRepuestoLinea[] {
	const pendientes = data.arreglo.repuestos_pendientes;
	if (data.arreglo.estado === "PRESUPUESTO" && Array.isArray(pendientes)) {
		return pendientes.map((linea) => ({
			label: linea.nombre || linea.codigo || "Repuesto",
			cantidad: linea.cantidad,
			monto_unitario: linea.monto_unitario,
			descuento: safeNumber(linea.descuento),
		}));
	}

	return flattenAsignacionesLineas(data).map((linea) => ({
		label: linea.producto?.nombre || linea.producto?.codigo || "Repuesto",
		cantidad: linea.cantidad,
		monto_unitario: linea.monto_unitario,
		descuento: safeNumber(linea.descuento),
	}));
}
