'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/supabase/server'

import { AuthActionError, type LoginResult, type LogoutResult } from './authTypes'
import { decodeJwtPayload } from '@/lib/jwt'
import { logger } from '@/lib/logger'

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

  //const { data } = await supabase.auth.getSession();
  const jwt = decodeJwtPayload(session.session.access_token || "");
  logger.debug('User logged in', { email, jwt });

  const tenant_name: string = jwt?.tenant_name as string;


  revalidatePath('/', 'layout')
  if (!session) {
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: 'No se pudo iniciar sesión (no se recibió sesión).',
    } satisfies LoginResult
  }

  return { ok: true, tenant_name} satisfies LoginResult
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
