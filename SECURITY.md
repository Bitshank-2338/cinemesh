# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email **shashanksingh2338@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fix (optional)

You'll get an acknowledgement within **72 hours**. We aim to ship a fix or mitigation within **7 days** for high-severity issues.

## Scope

In scope:
- Authentication / authorization flaws (e.g., a non-host issuing moderation commands that get honored)
- Exposure of secrets (`LIVEKIT_API_SECRET`, service-role keys) to the client bundle
- Supabase RLS bypass on the `cinemesh` schema
- XSS via chat messages, room names, or display names
- JWT forgery against the LiveKit token endpoint
- Any way to read/write another room's data

Out of scope:
- The cooperative moderation model's inherent limitation: without an SFU, a determined user can patch their own client to ignore a `mute`/`kick` broadcast. This is documented, expected, and only mitigated by LiveKit's server-side `roomAdmin` grant in SFU mode.
- Rate-limiting of the public Google Translate endpoint
- DoS via creating many rooms (mitigated by Supabase plan limits, not app code)
- Social-engineering or physical attacks

## Handling secrets

- `LIVEKIT_API_SECRET` and any Supabase service-role key **must never** carry a `NEXT_PUBLIC_` prefix — that would bundle them into client JS.
- Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_LIVEKIT_URL` are safe to expose client-side.
- The anon key is designed to be public — security is enforced by Supabase Row Level Security, not by hiding the key.
- `.env.local` is git-ignored. Never commit real credentials.

## Supported versions

Only the latest deployed version (the `master` branch / production Vercel deployment) is supported. There are no long-term support branches.
