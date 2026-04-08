import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    // If successfully matched token, take them to the dashboard
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // If token is invalid or missing, go back to login with an error message
  return NextResponse.redirect(`${origin}/login?error=InvalidAuthToken`)
}
