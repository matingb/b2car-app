import { SupabaseClient } from '@supabase/supabase-js'

export const particularService = {
  async delete(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .rpc('delete_particular', { particular_id: id })

    if (error) {
      console.error('Error eliminando particular', error)
      return { error: new Error(error.message) }
    }

    return { error: null }
  }
}

