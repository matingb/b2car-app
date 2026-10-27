import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { OperacionDTO, OperacionLineaDTO, OperacionMovimientoStockDTO } from "@/model/dtos";

export type ClienteJoin = {
	tipo_cliente?: string;
	particulares?: { nombre: string; apellido: string } | { nombre: string; apellido: string }[];
	empresas?: { nombre: string } | { nombre: string }[];
	nombre?: string;
	apellido?: string;
};

export type OperacionVentaJoin = {
	cliente_id: string;
	clientes?: ClienteJoin | ClienteJoin[] | null;
};

export type OperacionCompraJoin = {
	proveedor_id: string;
	proveedores?: { nombre: string } | { nombre: string }[] | null;
};

export type OperacionMovimientoStockJoin = {
	id: string;
	fecha: string;
	cantidad: number;
	saldo_anterior: number;
	saldo_posterior: number;
	motivo?: string | null;
	created_at: string;
	created_by?: string | null;
	producto_id: string;
	stock_id: string;
	producto?: { nombre?: string; codigo?: string } | { nombre?: string; codigo?: string }[] | null;
};

export type OperacionDetalleRawRow = Omit<OperacionDTO, "movimientos_stock"> & {
	operaciones_lineas?: OperacionLineaDTO[] | null;
	operaciones_pagos?: unknown[] | null;
	operaciones_venta?: OperacionVentaJoin | OperacionVentaJoin[] | null;
	operaciones_compra?: OperacionCompraJoin | OperacionCompraJoin[] | null;
	movimientos_stock?: OperacionMovimientoStockJoin[] | null;
};

export type OperacionRow = OperacionDTO & {
	operaciones_lineas?: OperacionLineaDTO[] | null;
	operaciones_pagos?: unknown[] | null;
	movimientos_stock?: OperacionMovimientoStockDTO[] | null;
};

export type FacturaOperacionRow = {
	operacion_id: string;
};

export type MovimientoFinancieroCuentaRow = {
	cuenta_financiera_id: string | null;
};

export type ListOperacionesParams = {
	from: string | null;
	to: string | null;
	tipos: string[] | null;
	page: number;
	pageSize: number;
};

export type OperacionStatsParams = {
	from: string | null;
	to: string | null;
	tipos: string[] | null;
};

export type RpcCrearOperacionParams = {
	p_tipo: string;
	p_taller_id: string;
	p_lineas: unknown[];
	p_arreglo_id: string | null;
	p_fecha: string | null;
	p_cuenta_id: string | null;
	p_idempotency_key: string | null;
	p_observaciones: string | null;
	p_estado_pago: string | null;
	p_monto_inicial: number | null;
	p_mover_stock: boolean;
	p_proveedor_id: string | null;
	p_cliente_id: string | null;
	p_pagos: unknown[] | null;
};

export type RpcActualizarOperacionParams = {
	p_operacion_id: string;
	p_tipo: string;
	p_taller_id: string | null;
	p_lineas: unknown[];
	p_fecha: string | null;
	p_cuenta_id: string | null;
	p_idempotency_key: string | null;
	p_observaciones: string | null;
};

function firstOrOnly<T>(value: T | T[] | null | undefined): T | undefined {
	return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function resolveClienteNombre(join?: ClienteJoin | ClienteJoin[] | null): string | undefined {
	const cliente = firstOrOnly(join);
	if (!cliente) return undefined;

	const particular = firstOrOnly(cliente.particulares);
	if (particular) return `${particular.nombre} ${particular.apellido}`.trim();

	const empresa = firstOrOnly(cliente.empresas);
	if (empresa?.nombre) return empresa.nombre;

	if (cliente.nombre || cliente.apellido) {
		return `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim();
	}

	return undefined;
}

export interface OperacionRepository {
	list(
		supabase: SupabaseClient,
		params: ListOperacionesParams
	): Promise<{ data: unknown[] | null; error: PostgrestError | null }>;

	listFacturasByOperacionIds(
		supabase: SupabaseClient,
		operacionIds: string[]
	): Promise<{ data: FacturaOperacionRow[] | null; error: PostgrestError | null }>;

	getById(
		supabase: SupabaseClient,
		id: string
	): Promise<{ data: OperacionRow | null; error: PostgrestError | null }>;

	findCuentaFinancieraByOperacionId(
		supabase: SupabaseClient,
		operacionId: string
	): Promise<{ data: MovimientoFinancieroCuentaRow | null; error: PostgrestError | null }>;

	create(
		supabase: SupabaseClient,
		params: RpcCrearOperacionParams
	): Promise<{ data: unknown; error: PostgrestError | null }>;

	confirmarStock(
		supabase: SupabaseClient,
		params: { p_operacion_id: string; p_fecha: string; p_lineas: unknown[] | null }
	): Promise<{ data: unknown; error: PostgrestError | null }>;

	registrarPago(
		supabase: SupabaseClient,
		params: {
			p_operacion_id: string;
			p_cuenta_id: string;
			p_monto: number;
			p_fecha: string;
			p_descripcion: string | null;
			p_idempotency_key: string | null;
		}
	): Promise<{ data: unknown; error: PostgrestError | null }>;

	update(
		supabase: SupabaseClient,
		params: RpcActualizarOperacionParams
	): Promise<{ data: unknown; error: PostgrestError | null }>;

	deleteById(
		supabase: SupabaseClient,
		id: string,
		idempotencyKey?: string | null
	): Promise<{ data: unknown; error: PostgrestError | null }>;

	stats(
		supabase: SupabaseClient,
		params: OperacionStatsParams
	): Promise<{ data: unknown; error: PostgrestError | null }>;
}

export const operacionRepository: OperacionRepository = {
	async list(supabase: SupabaseClient, params: ListOperacionesParams) {
		const { data, error } = await supabase.rpc("rpc_listar_operaciones_con_gastos", {
			p_from: params.from,
			p_to: params.to,
			p_tipos: params.tipos,
			p_page: params.page,
			p_page_size: params.pageSize,
		});
		return { data: (data as unknown[] | null) ?? null, error };
	},

	async listFacturasByOperacionIds(supabase: SupabaseClient, operacionIds: string[]) {
		const { data, error } = await supabase
			.from("facturas_electronicas")
			.select("operacion_id")
			.eq("documento_tipo", "FACTURA")
			.in("operacion_id", operacionIds);

		return { data: (data as FacturaOperacionRow[] | null) ?? null, error };
	},

	async getById(supabase: SupabaseClient, id: string) {
		const { data, error } = await supabase
			.from("operaciones")
			.select(
				"*, operaciones_lineas(*), operaciones_pagos:operaciones_pagos!operaciones_pagos_operacion_id_fkey(*), operaciones_venta(cliente_id, clientes(tipo_cliente, particulares(nombre, apellido), empresas(nombre))), operaciones_compra(proveedor_id, proveedores(nombre)), movimientos_stock:movimientos_stock!movimientos_stock_operacion_id_fkey(id, fecha, cantidad, saldo_anterior, saldo_posterior, motivo, created_at, created_by, producto_id, stock_id, producto:productos(nombre, codigo))"
			)
			.eq("id", id)
			.single();

		if (error || !data) {
			return { data: null, error };
		}

		const raw = data as unknown as OperacionDetalleRawRow;
		const venta = firstOrOnly(raw.operaciones_venta);
		const compra = firstOrOnly(raw.operaciones_compra);

		const movimientosStockRaw = Array.isArray(raw.movimientos_stock) ? raw.movimientos_stock : [];
		const movimientosStock: OperacionMovimientoStockDTO[] = movimientosStockRaw
			.map((ms) => {
				const prod = firstOrOnly(ms.producto);
				return {
					id: String(ms.id),
					fecha: String(ms.fecha),
					cantidad: Number(ms.cantidad) || 0,
					saldo_anterior: Number(ms.saldo_anterior) || 0,
					saldo_posterior: Number(ms.saldo_posterior) || 0,
					motivo: ms.motivo ? String(ms.motivo) : null,
					created_at: String(ms.created_at),
					created_by: ms.created_by ? String(ms.created_by) : null,
					producto_id: String(ms.producto_id),
					stock_id: String(ms.stock_id),
					producto_nombre: prod?.nombre,
					producto_codigo: prod?.codigo,
				};
			})
			.sort((a, b) => {
				const timeA = new Date(a.fecha || a.created_at).getTime();
				const timeB = new Date(b.fecha || b.created_at).getTime();
				return timeB - timeA;
			});

		const mapped: OperacionRow = {
			...raw,
			cliente_id: venta?.cliente_id ? String(venta.cliente_id) : null,
			cliente_nombre: resolveClienteNombre(venta?.clientes),
			proveedor_id: compra?.proveedor_id ? String(compra.proveedor_id) : null,
			proveedor_nombre: firstOrOnly(compra?.proveedores)?.nombre,
			movimientos_stock: movimientosStock,
		};

		return { data: mapped, error: null };
	},

	async findCuentaFinancieraByOperacionId(supabase: SupabaseClient, operacionId: string) {
		const { data, error } = await supabase
			.from("movimientos_financieros")
			.select("cuenta_financiera_id")
			.eq("operacion_id", operacionId)
			.maybeSingle();

		return { data: (data as MovimientoFinancieroCuentaRow | null) ?? null, error };
	},

	async create(supabase: SupabaseClient, params: RpcCrearOperacionParams) {
		const { data, error } = await supabase.rpc("rpc_crear_operacion_con_stock", params);
		return { data, error };
	},

	async confirmarStock(
		supabase: SupabaseClient,
		params: { p_operacion_id: string; p_fecha: string; p_lineas: unknown[] | null }
	) {
		const { data, error } = await supabase.rpc("rpc_confirmar_stock_operacion", params);
		return { data, error };
	},

	async registrarPago(
		supabase: SupabaseClient,
		params: {
			p_operacion_id: string;
			p_cuenta_id: string;
			p_monto: number;
			p_fecha: string;
			p_descripcion: string | null;
			p_idempotency_key: string | null;
		}
	) {
		const { data, error } = await supabase.rpc("rpc_registrar_pago_operacion", params);
		return { data, error };
	},

	async update(supabase: SupabaseClient, params: RpcActualizarOperacionParams) {
		const { data, error } = await supabase.rpc("rpc_actualizar_operacion_con_stock", params);
		return { data, error };
	},

	async deleteById(supabase: SupabaseClient, id: string, idempotencyKey?: string | null) {
		const { data, error } = await supabase.rpc("rpc_borrar_operacion_completa", {
			p_operacion_id: id,
			p_idempotency_key: idempotencyKey ?? null,
		});
		return { data, error };
	},

	async stats(supabase: SupabaseClient, params: OperacionStatsParams) {
		const { data, error } = await supabase.rpc("rpc_operaciones_stats", {
			p_from: params.from,
			p_to: params.to,
			p_tipos: params.tipos,
		});
		return { data, error };
	},
};

export const supabaseOperacionRepository = operacionRepository;
