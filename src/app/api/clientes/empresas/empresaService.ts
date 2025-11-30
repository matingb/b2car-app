import { SupabaseClient } from '@supabase/supabase-js'

export const empresaService = {
  async delete(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .rpc('delete_empresa', { empresa_id: id })

    if (error) {
      console.error('Error eliminando empresa', error)
      return { error: new Error(error.message) }
    }

    return { error: null }
  }
}

