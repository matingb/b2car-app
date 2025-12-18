import { logger } from '@/lib/logger'
import { SupabaseClient } from '@supabase/supabase-js'
import { Empresa } from './[id]/route'

export type EmpresaTenantResponse = {
  data: Empresa | null;
  error?: Error | null;
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
  }

}
