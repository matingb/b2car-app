'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/supabase/server'

import { AuthActionError, type LoginResult, type LogoutResult } from './authTypes'
import { decodeJwtPayload } from '@/lib/jwt'
import { logger } from '@/lib/logger'
import { telemetry, identityFromClaims } from '@/lib/telemetry'

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
      logger.warn('auth.login_failed', { reason: 'no_tenant', email })
      return {
        ok: false,
        error: AuthActionError.UNKNOWN,
        message: 'Tu usuario no tiene un tenant asignado.',
      } satisfies LoginResult
    }

    if (isTenantInactiveError(error.message)) {
      logger.warn('auth.login_failed', { reason: 'tenant_inactive', email })
      return {
        ok: false,
        error: AuthActionError.TENANT_INACTIVE,
        message: 'Tu organización está inactiva o no tiene acceso.',
      } satisfies LoginResult
    }

    if (isInvalidCredentialsError(error.message)) {
      logger.warn('auth.login_failed', { reason: 'invalid_credentials', email })
      return {
        ok: false,
        error: AuthActionError.INVALID_CREDENTIALS,
      } satisfies LoginResult
    }
    logger.warn('auth.login_failed', { reason: error.message || 'unknown', email })
    return {
      ok: false,
      error: AuthActionError.UNKNOWN,
      message: error.message,
    } satisfies LoginResult
  }

  if (!session?.session) {
    logger.warn('auth.login_failed', { reason: 'no_session', email })
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
    logger.warn('auth.login_failed', { reason: 'no_tenant', email, userId })
    return buildTenantAccessError({
      supabase,
      jwt,
      error: AuthActionError.UNKNOWN,
      fallbackMessage: 'Tu usuario no tiene un tenant asignado.',
    })
  }

  if (jwt?.error === 'TENANT_INACTIVE' || !tenantId) {
    logger.warn('auth.login_failed', { reason: 'tenant_inactive', email, userId })
    return buildTenantAccessError({
      supabase,
      jwt,
      error: AuthActionError.TENANT_INACTIVE,
      fallbackMessage: 'Tu organización está inactiva o no tiene acceso.',
    })
  }

  const identity = identityFromClaims(jwt)
  if (identity) {
    telemetry.identify(identity)
  }

  logger.info('User logged in', { email, userId })

  revalidatePath('/', 'layout')

  return { ok: true, tenant_name: tenantName } satisfies LoginResult
}

export async function logOut() {
  const supabase = await createClient()

  telemetry.clearUser()

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
