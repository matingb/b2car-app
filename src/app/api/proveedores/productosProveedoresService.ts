import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import type { ProductoProveedorDTO } from "@/model/dtos";
import {
	type ActualizarProductoProveedorPayload,
	type AsociarProductoProveedorPayload,
	type ProductosProveedoresRepository,
	supabaseProductosProveedoresRepository,
} from "./productosProveedoresRepository";

export type AsociarProductoInput = {
	proveedor_id: string;
	producto_id: string;
	codigo_proveedor?: string | null;
	costo_referencia?: number | null;
	es_predeterminado?: boolean | null;
};

export type ActualizarProductoVinculadoInput = {
	codigo_proveedor?: string | null;
	costo_referencia?: number | null;
	es_predeterminado?: boolean | null;
};

export function createProductosProveedoresService(
	repository: ProductosProveedoresRepository
) {
	return {
		async listarPorProveedor(
			supabase: SupabaseClient,
			proveedorId: string
		): Promise<{ data: ProductoProveedorDTO[]; error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(proveedorId)) {
				return { data: [], error: ServiceError.Validation };
			}
			return repository.listarPorProveedor(supabase, proveedorId);
		},

		async listarPorProducto(
			supabase: SupabaseClient,
			productoId: string
		): Promise<{ data: ProductoProveedorDTO[]; error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(productoId)) {
				return { data: [], error: ServiceError.Validation };
			}
			return repository.listarPorProducto(supabase, productoId);
		},

		async asociar(
			supabase: SupabaseClient,
			input: AsociarProductoInput
		): Promise<{ data: ProductoProveedorDTO | null; error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(input.proveedor_id) || !isValidUuid(input.producto_id)) {
				return { data: null, error: ServiceError.Validation };
			}

			const costo = Number(input.costo_referencia ?? 0);
			if (isNaN(costo) || costo < 0) {
				return { data: null, error: ServiceError.Validation };
			}

			const codigo = input.codigo_proveedor ? String(input.codigo_proveedor).trim() : null;

			const payload: AsociarProductoProveedorPayload = {
				proveedor_id: input.proveedor_id,
				producto_id: input.producto_id,
				codigo_proveedor: codigo && codigo.length > 0 ? codigo : null,
				costo_referencia: costo,
				es_predeterminado: Boolean(input.es_predeterminado),
			};

			return repository.asociar(supabase, payload);
		},

		async actualizar(
			supabase: SupabaseClient,
			proveedorId: string,
			productoId: string,
			input: ActualizarProductoVinculadoInput
		): Promise<{ data: ProductoProveedorDTO | null; error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(proveedorId) || !isValidUuid(productoId)) {
				return { data: null, error: ServiceError.Validation };
			}

			const payload: ActualizarProductoProveedorPayload = {};

			if (input.codigo_proveedor !== undefined) {
				const codigo = input.codigo_proveedor ? String(input.codigo_proveedor).trim() : null;
				payload.codigo_proveedor = codigo && codigo.length > 0 ? codigo : null;
			}

			if (input.costo_referencia !== undefined && input.costo_referencia !== null) {
				const costo = Number(input.costo_referencia);
				if (isNaN(costo) || costo < 0) {
					return { data: null, error: ServiceError.Validation };
				}
				payload.costo_referencia = costo;
			}

			if (input.es_predeterminado !== undefined && input.es_predeterminado !== null) {
				payload.es_predeterminado = Boolean(input.es_predeterminado);
			}

			return repository.actualizar(supabase, proveedorId, productoId, payload);
		},

		async desvincular(
			supabase: SupabaseClient,
			proveedorId: string,
			productoId: string
		): Promise<{ error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(proveedorId) || !isValidUuid(productoId)) {
				return { error: ServiceError.Validation };
			}
			return repository.desvincular(supabase, proveedorId, productoId);
		},
	};
}

export const productosProveedoresService = createProductosProveedoresService(
	supabaseProductosProveedoresRepository
);
