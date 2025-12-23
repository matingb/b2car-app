export enum AuthActionError {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  UNKNOWN = 'UNKNOWN',
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: AuthActionError; message?: string }

export type LogoutResult =
  | { ok: true }
  | { ok: false; error: AuthActionError; message?: string }


