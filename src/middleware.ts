import { type NextRequest } from 'next/server'
import { updateSession } from './supabase/middleware'
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  
  if (process.env.LOG_EVERY_REQUEST === 'true'){
    logger.info('Request: ', {
      method: request.method,
      url: request.nextUrl.href,
      body: await request.text(),
    });
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/',
    '/clientes/:path*',
    '/vehiculos/:path*',
    '/arreglos/:path*',
    '/dashboard/:path*',
    '/turnos/:path*',
    '/stock/:path*',
    '/productos/:path*',
    '/operaciones/:path*',
    '/api/clientes/:path*',
    '/api/vehiculos/:path*',
    '/api/arreglos/:path*',
    '/api/productos/:path*',
    '/api/stocks/:path*',
    '/api/operaciones/:path*',
    '/api/turnos/:path*',
    '/api/dashboard/:path*',
    '/api/tenant/:path*',
  ],
}
