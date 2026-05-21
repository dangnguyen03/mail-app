import { NextResponse } from 'next/server'
import { getGoogleAuthConfig } from '@/lib/auth'

export async function GET() {
  const { isConfigured } = getGoogleAuthConfig()

  return NextResponse.json({ isConfigured })
}