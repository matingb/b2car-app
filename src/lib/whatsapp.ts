import { formatArs } from "@/lib/format";
import type { ArregloDetalleData, AsignacionArregloLinea } from "@/app/api/arreglos/[id]/route";
import type { Turno } from "@/model/types";

export function buildArregloWhatsappMessage(data: ArregloDetalleData, tenantName?: string): string {
	if (!data?.arreglo) return "";

	const arreglo = data.arreglo;
	const detalles = Array.isArray(data.detalles) ? data.detalles : [];
	const repuestosLineas = flattenAsignacionesLineas(data);
	const lines: string[] = [];
	const normalizedTenant = (tenantName ?? "").trim();
	const header = arreglo.esta_pago ? "Detalle de Arreglo" : "Presupuesto de Arreglo";

	lines.push(`*${header}${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`);

	const titulo = arreglo.descripcion || arreglo.tipo || "Detalle del arreglo";
	lines.push(`🔧 ${titulo}`);
	lines.push(`🚗 Patente ${arreglo.vehiculo?.patente || "-"}`);
	if (arreglo.kilometraje_leido) {
		lines.push(`⏱️ KM actual ${arreglo.kilometraje_leido}`);
	}
	if (arreglo.observaciones) {
		lines.push(`📝 Observaciones: ${arreglo.observaciones}`);
	}
	lines.push("");

	if (detalles.length) {
		lines.push("👨‍🔧 *Servicios:*");
		detalles.forEach((d) => {
			const cantidad = safeNumber(d.cantidad);
			const valor = safeNumber(d.valor);
			const total = cantidad * valor;
			const label = String(d.descripcion ?? "").trim() || "Servicio";
			const qty = cantidad ? ` x${cantidad}` : "";
			lines.push(`• ${label}${qty} - ${formatArs(total, { maxDecimals: 0, minDecimals: 0 })}`);
		});
		lines.push("");
	}

	if (repuestosLineas.length) {
		lines.push("📦 *Repuestos:*");
		repuestosLineas.forEach((r) => {
			const cantidad = safeNumber(r.cantidad);
			const monto = safeNumber(r.monto_unitario);
			const total = cantidad * monto;
			const producto = r.producto?.nombre || r.producto?.codigo || "Repuesto";
			const qty = cantidad ? ` x${cantidad}` : "";
			lines.push(`• ${producto}${qty} - ${formatArs(total, { maxDecimals: 0, minDecimals: 0 })}`);
		});
		lines.push("");
	}

	const subtotalServicios = detalles.reduce(
		(acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
		0
	);
	const subtotalRepuestos = repuestosLineas.reduce(
		(acc, l) => acc + safeNumber(l.monto_unitario) * safeNumber(l.cantidad),
		0
	);
	const totalCalculado = subtotalServicios + subtotalRepuestos;
	const total = arreglo.precio_final > 0 ? arreglo.precio_final : totalCalculado;
	lines.push(`*Total arreglo ${formatArs(total, { maxDecimals: 0, minDecimals: 0 })}*`);

	return lines.join("\n");
}

export function buildTurnoWhatsappMessage(turno: Turno, tenantName?: string): string {
	const lines: string[] = [];
	const normalizedTenant = (tenantName ?? "").trim();

	lines.push(`*Detalle del turno${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`);
	if (turno.cliente?.nombre) {
		lines.push(`👤 ${turno.cliente.nombre}`);
	}
	if (turno.vehiculo) {
		const vehiculoLabel = `${turno.vehiculo.marca} ${turno.vehiculo.modelo} - ${turno.vehiculo.patente}`.trim();
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

export function buildWhatsappLink(phone: string, message: string): string {
	const encodedMessage = encodeURIComponent(message);
	return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}&type=phone_number&app_absent=0`;
}

export function normalizeWhatsappPhone(rawPhone: string): string | null {
	const cleaned = String(rawPhone ?? "").replace(/\D/g, "");
	return cleaned ? cleaned : null;
}

function safeNumber(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
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
