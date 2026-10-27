import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, toServiceError } from "@/app/api/serviceError";
import type { ProductoProveedorDTO } from "@/model/dtos";

export type AsociarProductoProveedorPayload = {
	proveedor_id: string;
	producto_id: string;
	codigo_proveedor?: string | null;
	costo_referencia: number;
	es_predeterminado: boolean;
};

export type ActualizarProductoProveedorPayload = {
	codigo_proveedor?: string | null;
	costo_referencia?: number;
	es_predeterminado?: boolean;
};

export interface ProductosProveedoresRepository {
	listarPorProveedor(
		supabase: SupabaseClient,
		proveedorId: string
	): Promise<{ data: ProductoProveedorDTO[]; error: ServiceError | PostgrestError | null }>;

	listarPorProducto(
		supabase: SupabaseClient,
		productoId: string
	): Promise<{ data: ProductoProveedorDTO[]; error: ServiceError | PostgrestError | null }>;

	asociar(
		supabase: SupabaseClient,
		payload: AsociarProductoProveedorPayload
	): Promise<{ data: ProductoProveedorDTO | null; error: ServiceError | PostgrestError | null }>;

	actualizar(
		supabase: SupabaseClient,
		proveedorId: string,
		productoId: string,
		payload: ActualizarProductoProveedorPayload
	): Promise<{ data: ProductoProveedorDTO | null; error: ServiceError | PostgrestError | null }>;

	desvincular(
		supabase: SupabaseClient,
		proveedorId: string,
		productoId: string
	): Promise<{ error: ServiceError | PostgrestError | null }>;
}

function mapRowToDTO(row: Record<string, unknown>): ProductoProveedorDTO {
	const prod = row.productos && typeof row.productos === "object"
		? (row.productos as Record<string, unknown>)
		: null;
	const prov = row.proveedores && typeof row.proveedores === "object"
		? (row.proveedores as Record<string, unknown>)
		: null;

	const stocks = Array.isArray(prod?.stocks) ? (prod.stocks as Record<string, unknown>[]) : [];
	const computedStock = stocks.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);
	const stockActual = row.stock_actual !== undefined ? Number(row.stock_actual) : computedStock;

	return {
		id: String(row.id),
		tenant_id: String(row.tenant_id ?? ""),
		producto_id: String(row.producto_id),
		proveedor_id: String(row.proveedor_id),
		producto_nombre: prod?.nombre ? String(prod.nombre) : undefined,
		producto_codigo: prod?.codigo ? String(prod.codigo) : undefined,
		producto_categoria:
			prod?.categorias && Array.isArray(prod.categorias) && prod.categorias.length > 0
				? String(prod.categorias[0])
				: undefined,
		producto_precio_venta:
			prod?.precio_unitario != null && !isNaN(Number(prod.precio_unitario))
				? Number(prod.precio_unitario)
				: undefined,
		proveedor_nombre: prov?.nombre ? String(prov.nombre) : undefined,
		proveedor_cuit: prov?.cuit ? String(prov.cuit) : undefined,
		codigo_proveedor: row.codigo_proveedor ? String(row.codigo_proveedor) : null,
		costo_referencia: Number(row.costo_referencia) || 0,
		es_predeterminado: Boolean(row.es_predeterminado),
		stock_actual: stockActual,
		created_at: String(row.created_at),
		updated_at: String(row.updated_at),
	};
}

export const supabaseProductosProveedoresRepository: ProductosProveedoresRepository = {
	async listarPorProveedor(supabase: SupabaseClient, proveedorId: string) {
		const { data, error } = await supabase
			.from("productos_proveedores")
			.select("*, productos(id, codigo, nombre, marca, modelo, precio_unitario, costo_unitario, categorias, stocks(cantidad))")
			.eq("proveedor_id", proveedorId)
			.order("created_at", { ascending: false });

		if (error) return { data: [], error: toServiceError(error) ?? error };
		return { data: (data ?? []).map(mapRowToDTO), error: null };
	},

	async listarPorProducto(supabase: SupabaseClient, productoId: string) {
		const { data, error } = await supabase
			.from("productos_proveedores")
			.select("*, proveedores(id, nombre, cuit, telefono, email)")
			.eq("producto_id", productoId)
			.order("es_predeterminado", { ascending: false });

		if (error) return { data: [], error: toServiceError(error) ?? error };
		return { data: (data ?? []).map(mapRowToDTO), error: null };
	},

	async asociar(supabase: SupabaseClient, payload: AsociarProductoProveedorPayload) {
		if (payload.es_predeterminado) {
			await supabase
				.from("productos_proveedores")
				.update({ es_predeterminado: false })
				.eq("producto_id", payload.producto_id);
		}

		const { data, error } = await supabase
			.from("productos_proveedores")
			.upsert(
				{
					proveedor_id: payload.proveedor_id,
					producto_id: payload.producto_id,
					codigo_proveedor: payload.codigo_proveedor ?? null,
					costo_referencia: payload.costo_referencia,
					es_predeterminado: payload.es_predeterminado,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "tenant_id,producto_id,proveedor_id" }
			)
			.select("*, productos(id, codigo, nombre)")
			.single();

		if (error) return { data: null, error: toServiceError(error) ?? error };
		return { data: data ? mapRowToDTO(data) : null, error: null };
	},

	async actualizar(
		supabase: SupabaseClient,
		proveedorId: string,
		productoId: string,
		payload: ActualizarProductoProveedorPayload
	) {
		if (payload.es_predeterminado === true) {
			await supabase
				.from("productos_proveedores")
				.update({ es_predeterminado: false })
				.eq("producto_id", productoId);
		}

		const updatePayload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};
		if (payload.codigo_proveedor !== undefined) {
			updatePayload.codigo_proveedor = payload.codigo_proveedor;
		}
		if (payload.costo_referencia !== undefined) {
			updatePayload.costo_referencia = payload.costo_referencia;
		}
		if (payload.es_predeterminado !== undefined) {
			updatePayload.es_predeterminado = payload.es_predeterminado;
		}

		const { data, error } = await supabase
			.from("productos_proveedores")
			.update(updatePayload)
			.eq("proveedor_id", proveedorId)
			.eq("producto_id", productoId)
			.select("*, productos(id, codigo, nombre)")
			.maybeSingle();

		if (error) return { data: null, error: toServiceError(error) ?? error };
		if (!data) return { data: null, error: ServiceError.NotFound };
		return { data: mapRowToDTO(data), error: null };
	},

	async desvincular(supabase: SupabaseClient, proveedorId: string, productoId: string) {
		const { error, count } = await supabase
			.from("productos_proveedores")
			.delete({ count: "exact" })
			.eq("proveedor_id", proveedorId)
			.eq("producto_id", productoId);

		if (error) return { error: toServiceError(error) ?? error };
		if (!count) return { error: ServiceError.NotFound };
		return { error: null };
	},
};
