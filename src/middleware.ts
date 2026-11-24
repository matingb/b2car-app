import { type NextRequest } from 'next/server'
import { updateSession } from './supabase/middleware'
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  if (process.env.LOG_EVERY_REQUEST === 'true'){
    logger.info('Request: ', {
      method: request.method,
      url: request.nextUrl.href,
    });
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|manifest\\.webmanifest|service-worker\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
