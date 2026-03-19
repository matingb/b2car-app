'use server'

import { createClient } from '@/supabase/server'

export type ResetPasswordResult = {
  data: null
  error: string | null
}

export async function resetPassword(params: {
  token: string
  password: string
}): Promise<ResetPasswordResult> {
  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'recovery',
    token_hash: params.token,
  })

  if (verifyError) {
    return {
      data: null,
      error: 'El link puede que haya expirado. Intentá nuevamente o contactá soporte.',
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: params.password,
  })

  if (updateError) {
    return {
      data: null,
      error: 'No se pudo actualizar la contraseña. Intentá nuevamente.',
    }
  }

  return { data: null, error: null }
}
