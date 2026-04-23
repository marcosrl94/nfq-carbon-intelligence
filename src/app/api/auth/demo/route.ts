import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Inicia sesión con credenciales demo (solo servidor).
 * Requiere en .env.local: DEMO_USER_EMAIL, DEMO_USER_PASSWORD
 * y un usuario creado en Supabase (Auth) con esas credenciales.
 */
export async function POST(request: NextRequest) {
  const email = process.env.DEMO_USER_EMAIL
  const password = process.env.DEMO_USER_PASSWORD
  const origin = new URL(request.url).origin
  if (!email || !password) {
    return NextResponse.redirect(
      new URL('/login?error=demo_unconfigured', origin),
      { status: 303 }
    )
  }
  const response = NextResponse.redirect(new URL('/', origin), { status: 302 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.redirect(new URL('/login?error=demo_signin', origin), { status: 303 })
  }

  return response
}
