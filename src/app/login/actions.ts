'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/supabase/server'

export async function login(email: string, password: string) {
    const supabase = await createClient()

    const data = { email, password }

    const { data: data2, error } = await supabase.auth.signInWithPassword(data)

    const jwt = data2.session?.access_token;
    const DEBUG_JWT = process.env.DEBUG_JWT || 'false';
    if (jwt && DEBUG_JWT === 'true') {
        // Importante: Este console.log aparecerá en el terminal del servidor Next.js
        // No aparecerá en el navegador del cliente.
        console.log("==================================================");
        console.log("✅ JWT (Access Token) generado con éxito:");
        console.log(jwt);
        console.log("==================================================");
        console.log("👉 PEGA ESTE TOKEN EN https://jwt.io/ PARA VER LOS CLAIMS 'tenant_id'.");
    } else {
        console.warn("Advertencia: No se encontró el JWT después del inicio de sesión.");
    }
    
    if (error) {
        redirect('/error')
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function logOut() {
    const supabase = await createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
        redirect('/error')
    }

    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)


  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}