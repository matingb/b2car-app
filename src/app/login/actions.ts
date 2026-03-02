'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/supabase/server'

import { AuthActionError, type LoginResult, type LogoutResult } from './authTypes'
import { decodeJwtPayload } from '@/lib/jwt'
import { logger } from '@/lib/logger'

const INVALID_LOGIN_CREDENTIALS_ERROR = 'invalid login credentials'
const TENANT_INACTIVE_ERROR = 'tenant_inactive'
const NO_TENANT_ERROR = 'no_tenant'

function isInvalidCredentialsError(message?: string) {
  const m = (message ?? '').toLowerCase()
  return m.includes(INVALID_LOGIN_CREDENTIALS_ERROR) || m.includes('credentials')
}

function isTenantInactiveError(message?: string) {
  const m = (message ?? '').toLowerCase()
  return m.includes(TENANT_INACTIVE_ERROR)
}

function isNoTenantError(message?: string) {
  const m = (message ?? '').toLowerCase()
  return m.includes(NO_TENANT_ERROR)
}

async function buildTenantAccessError({
  supabase,
  jwt,
  error,
  fallbackMessage,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  jwt: Record<string, unknown> | null
  error: AuthActionError
  fallbackMessage: string
}): Promise<LoginResult> {
  await supabase.auth.signOut()

  return {
    ok: false,
    error,
    message: (jwt?.error_description as string | undefined) ?? fallbackMessage,
  } satisfies LoginResult
}

export async function login(email: string, password: string) {
  const supabase = await createClient()

  const request = { email, password }

  const { data: session, error } = await supabase.auth.signInWithPassword(request)

  if (error) {
    if (isNoTenantError(error.message)) {
      return {
        ok: false,
        error: AuthActionError.UNKNOWN,
        message: 'Tu usuario no tiene un tenant asignado.',
      } satisfies LoginResult
    }

    if (isTenantInactiveError(error.message)) {
      return {
        ok: false,
        error: AuthActionError.TENANT_INACTIVE,
        message: 'Tu organización está inactiva o no tiene acceso.',
      } satisfies LoginResult
    }

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

  if (!session?.session) {
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: 'No se pudo iniciar sesión.',
    } satisfies LoginResult
  }

  const jwt = decodeJwtPayload(session.session.access_token || '')
  const userId = (jwt?.sub as string | undefined) ?? session.user?.id
  const tenantId = jwt?.tenant_id as string | undefined
  const tenantName = (jwt?.tenant_name as string | undefined) ?? 'B2Car'

  
  if (jwt?.error === 'NO_TENANT') {
    return buildTenantAccessError({
      supabase,
      jwt,
      error: AuthActionError.UNKNOWN,
      fallbackMessage: 'Tu usuario no tiene un tenant asignado.',
    })
  }

  if (jwt?.error === 'TENANT_INACTIVE' || !tenantId) {
    return buildTenantAccessError({
      supabase,
      jwt,
      error: AuthActionError.TENANT_INACTIVE,
      fallbackMessage: 'Tu organización está inactiva o no tiene acceso.',
    })
  }

  logger.info('User logged in', { email, userId })

  revalidatePath('/', 'layout')

  return { ok: true, tenant_name: tenantName } satisfies LoginResult
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
