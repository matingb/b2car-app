import { logger } from '@/lib/logger'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Empresa } from './[id]/route'
import { TipoCliente, Cliente } from "@/model/types";
import type { Vehiculo } from "@/model/types";

type ClienteInsertRow = { id: string };
type EmpresaInsertRow = {
  nombre?: string;
  cuit?: string;
  codigo_pais?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

type EmpresaByIdRow = {
  id: string;
  tipo_cliente?: string | null;
  empresa?: EmpresaInsertRow | null;
  vehiculos?: Vehiculo[] | null;
};

export type EmpresaTenantResponse = {
  data: Empresa | null;
  error?: Error | null;
};

type EmpresaDetalle = Empresa & {
  tipo_cliente: TipoCliente.EMPRESA;
};

export const empresaService = {
  async delete(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .rpc('delete_empresa', { empresa_id: id })

    if (error) {
      logger.error('Error eliminando empresa', error)
      return { error: new Error(error.message) }
    }

    return { error: null }
  },

  async fetchByCuitAndTenantId(supabase: SupabaseClient, cuit: string, tenantId: string | null): Promise<EmpresaTenantResponse> {
    const { data, error } = await supabase
      .from('empresas')
      .select('*, clientes(tenant_id)')
      .eq('cuit', cuit)
      .eq('clientes.tenant_id', tenantId)
      .not('clientes', 'is', null)
      .single();
    
    logger.debug(`Búsqueda de empresa por CUIT ${cuit} y Tenant ID ${tenantId}:`, data);
    if (error) {
      logger.error('Error obteniendo empresa', error)
      return { data : null, error: new Error(error.message) }
    }

    return { data , error: null }
  },

  async createClienteEmpresa(
    supabase: SupabaseClient,
    payload: { nombre: string; cuit: string; codigo_pais?: string; telefono?: string; email?: string; direccion?: string; condicion_iva_receptor_id?: number | null; fce_mipyme_alcanzado?: boolean }
  ): Promise<{ data: Cliente | null; error: Error | null }> {
    const { data: clienteInsert, error: errorCliente } = await supabase
      .from("clientes")
      .insert([{
        tipo_cliente: TipoCliente.EMPRESA,
        tipo_documento_fiscal: 80,
        numero_documento_fiscal: payload.cuit.replace(/\D/g, ""),
        condicion_iva_receptor_id: payload.condicion_iva_receptor_id ?? null,
        fce_mipyme_alcanzado: payload.fce_mipyme_alcanzado === true,
      }])
      .select("id, tipo_cliente")
      .single();

    if (errorCliente || !clienteInsert) {
      return { data: null, error: new Error(errorCliente?.message || "No se pudo crear") };
    }

    const clienteId = (clienteInsert as unknown as ClienteInsertRow).id;
    const empresaPayload = {
      nombre: payload.nombre,
      cuit: payload.cuit,
      codigo_pais: payload.codigo_pais,
      telefono: payload.telefono,
      email: payload.email,
      direccion: payload.direccion,
    };

    const { data: empresaInsert, error: detalleError } = await supabase
      .from("empresas")
      .insert([{ ...empresaPayload, id: clienteId }])
      .select()
      .single();

    if (detalleError || !empresaInsert) {
      await supabase.from("clientes").delete().eq("id", clienteId);
      return { data: null, error: new Error(detalleError?.message || "No se pudo crear la empresa") };
    }

    const inserted = empresaInsert as unknown as EmpresaInsertRow;
    const c: Cliente = {
      id: clienteId,
      nombre: inserted.nombre ?? payload.nombre,
      cuit: inserted.cuit ?? payload.cuit,
      tipo_cliente: TipoCliente.EMPRESA,
      codigo_pais: inserted.codigo_pais,
      telefono: inserted.telefono ?? "",
      email: inserted.email ?? "",
      direccion: inserted.direccion ?? "",
      tipo_documento_fiscal: 80,
      numero_documento_fiscal: payload.cuit.replace(/\D/g, ""),
      condicion_iva_receptor_id: (payload.condicion_iva_receptor_id ?? null) as Cliente["condicion_iva_receptor_id"],
      fce_mipyme_alcanzado: payload.fce_mipyme_alcanzado === true,
    };

    return { data: c, error: null };
  },

  async getByIdWithVehiculos(supabase: SupabaseClient, id: string): Promise<{ data: EmpresaDetalle | null; error: Error | null; code?: string }> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*, empresa:empresas(*), vehiculos(*)")
      .eq("id", id)
      .single();

    if (error) return { data: null, error: new Error(error.message), code: (error as { code?: string }).code };

    const row = data as unknown as EmpresaByIdRow;
    if (row.tipo_cliente !== TipoCliente.EMPRESA || !row.empresa) {
      return { data: null, error: null };
    }

    const empresa: EmpresaDetalle = {
      id: row.id,
      tipo_cliente: TipoCliente.EMPRESA,
      nombre: row.empresa?.nombre ?? "",
      cuit: row.empresa?.cuit ?? "",
      codigo_pais: row.empresa?.codigo_pais ?? undefined,
      telefono: row.empresa?.telefono ?? "",
      email: row.empresa?.email ?? "",
      direccion: row.empresa?.direccion ?? "",
      vehiculos: row.vehiculos ?? [],
    };

    return { data: empresa, error: null };
  },

  async updateById(supabase: SupabaseClient, id: string, payload: Record<string, unknown>): Promise<{ data: unknown | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("empresas")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return { data: data ?? null, error: null };
  },

}
