import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { API_ERROR_MESSAGES, type ApiErrorBody } from '@/lib/apiErrorCodes'

const PUBLIC_ROUTES = ['/login', '/reset-password', '/auth', '/api/auth', '/error']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { pathname } = request.nextUrl

  // Dejar pasar manifest, service worker e íconos sin redirección
  if (
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/service-worker.js' ||
    pathname.startsWith('/icons')
  ) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (!user && !isPublicRoute) {
    let response: NextResponse
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      response = NextResponse.json(
        {
          data: null,
          error: API_ERROR_MESSAGES.UNAUTHORIZED,
          code: 'UNAUTHORIZED',
        } satisfies ApiErrorBody,
        { status: 401 }
      )
    } else {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      response = NextResponse.redirect(url)
    }

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // La página raíz elige el destino con los permisos efectivos del rol y plan.
  return supabaseResponse
}

