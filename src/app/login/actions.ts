'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/supabase/server'

import { AuthActionError, type LoginResult, type LogoutResult } from './authTypes'

function isInvalidCredentialsError(message?: string) {
  const m = (message ?? '').toLowerCase()
  return m.includes('invalid login credentials') || m.includes('credentials')
}

export async function login(email: string, password: string) {
  const supabase = await createClient()

  const request = { email, password }

  const { data: session, error } = await supabase.auth.signInWithPassword(request)

  if (error) {
    if (isInvalidCredentialsError(error.message)) {
      return {
        ok: false,
        error: AuthActionError.INVALID_CREDENTIALS,
      } satisfies LoginResult
    }
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: error.message,
    } satisfies LoginResult
  }

  revalidatePath('/', 'layout')
  if (!session) {
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: 'No se pudo iniciar sesión (no se recibió sesión).',
    } satisfies LoginResult
  }

  return { ok: true } satisfies LoginResult
}

export async function logOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: error.message,
    } satisfies LogoutResult
  }

  revalidatePath('/', 'layout')
  return { ok: true } satisfies LogoutResult
}
