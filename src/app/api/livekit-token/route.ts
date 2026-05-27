/**
 * /api/livekit-token — issues a short-lived JWT so the client can connect
 * to the LiveKit SFU as a specific identity in a specific room.
 *
 * Required env vars (set in Vercel + .env.local):
 *   LIVEKIT_API_KEY      — from LiveKit Cloud project settings
 *   LIVEKIT_API_SECRET   — from LiveKit Cloud project settings
 *   NEXT_PUBLIC_LIVEKIT_URL — wss://<project>.livekit.cloud (client-side too)
 *
 * Without these set, the route returns 503 and the app silently falls back
 * to the existing WebRTC mesh implementation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export const runtime = 'nodejs'

// Strip BOM / surrounding quotes / whitespace defensively. When env vars
// are pushed via PowerShell pipelines, Vercel sometimes preserves wrapping
// quotes that would invalidate the JWT signature otherwise.
function clean(v: string | undefined): string {
  if (!v) return ''
  return v.replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim()
}

export async function GET(req: NextRequest) {
  const apiKey    = clean(process.env.LIVEKIT_API_KEY)
  const apiSecret = clean(process.env.LIVEKIT_API_SECRET)

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'LiveKit is not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const room     = searchParams.get('room')
  const identity = searchParams.get('identity')
  const name     = searchParams.get('name') ?? identity ?? 'guest'
  const isHost   = searchParams.get('isHost') === 'true'

  if (!room || !identity) {
    return NextResponse.json(
      { error: 'Missing required params: room, identity' },
      { status: 400 },
    )
  }

  // Validate basic input — codes are 4-12 alnum, identities are short slugs
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(room) || !/^[A-Za-z0-9_-]{4,64}$/.test(identity)) {
    return NextResponse.json({ error: 'Invalid room or identity format' }, { status: 400 })
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    // 2-hour token; LiveKit auto-disconnects when it expires
    ttl: 60 * 60 * 2,
    metadata: JSON.stringify({ isHost }),
  })

  at.addGrant({
    room,
    roomJoin:     true,
    canPublish:   true,
    canSubscribe: true,
    canPublishData: true,
    // Only the host gets RoomAdmin privileges (kick / mute on the server side)
    roomAdmin: isHost,
  })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
