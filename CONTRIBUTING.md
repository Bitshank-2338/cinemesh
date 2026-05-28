# Contributing to CineMesh

Thanks for your interest! CineMesh is a small focused project — contributions that fix real bugs, improve UX, or harden the WebRTC/SFU paths are very welcome.

## Quick start

```bash
git clone https://github.com/Bitshank-2338/cinemesh.git
cd cinemesh
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev
```

You'll need a free Supabase project (apply `scripts/cinemesh-migration.sql`) and, optionally, a free LiveKit Cloud project for SFU mode. See [README.md](README.md) for the full setup.

## Workflow

1. **Open an issue first** for anything non-trivial. Discussing the approach saves both sides time.
2. **Branch from `master`** with a short kebab-case name: `fix-mic-glitch`, `feat-fullscreen-overlay`.
3. **Keep PRs focused.** One concern per PR. Smaller diffs land faster.
4. **Write a clear PR description** explaining the *why*, not just the *what*. Link the issue. Note any caveats or tradeoffs.

## Code style

- **TypeScript strict mode** — no `any`, no `@ts-ignore` (use `unknown` + narrow). When the DOM/library types are wrong, prefer a tight interface cast over a wide one.
- **Named exports** except for Next.js `page.tsx` / `layout.tsx` which require defaults.
- **Functional components only.** No class components.
- **No new files unless necessary.** Prefer editing an existing module.
- **Tailwind** for styling. CSS-in-JS only when truly needed.
- **Inline styles** for design tokens that don't map cleanly to Tailwind (colors, shadows). The codebase uses both — that's fine.
- **No comments that just restate code.** Comments explain *why* — invariants, gotchas, non-obvious constraints.

Run before pushing:

```bash
npm run lint          # ESLint via next/core-web-vitals
npm run type-check    # tsc --noEmit
npm run build         # full Next.js build
```

CI will run all three.

## Architecture rules

1. **Channel adapters are interchangeable.** Anything that works against `RoomChannelAdapter` must work for both `SupabaseChannel` and `LocalChannel`.
2. **Mesh and SFU expose the same hook shape.** `useWebRTC` and `useLiveKitRoom` both return `{ remoteCameras, remoteScreens, connectionStates }`. The room page is transport-agnostic.
3. **Service-role keys never go to the client.** `LIVEKIT_API_SECRET` is server-side only (no `NEXT_PUBLIC_` prefix). The token-mint API route is the only place secrets touch.
4. **Defensive env-var cleaning** lives in `src/lib/supabase.ts` and `src/hooks/use-livekit-room.ts`. If you add a new sensitive env var, strip BOM + surrounding quotes the same way.
5. **No DRM bypass.** PRs that touch screen-capture in ways that circumvent Widevine / FairPlay / PlayReady will be closed. CineMesh does not pirate paid streams.

## Adding a feature that touches WebRTC

This is the riskiest area. If you change `webrtc-manager.ts`:

- Test with **2, 3, and 8+ peers** (8 is where mesh strain shows up)
- Test with **camera off**, **mic off**, **screen share active simultaneously**
- Test **mic toggle 5 times in a row** — should never disconnect anyone (the debounced peer-close at `CLOSE_GRACE_MS = 4000` protects this)
- Test **a peer joining mid-screen-share** — new joiner must see the screen, not just camera

## Adding a new language

Edit `src/lib/translation.ts` and add to the `LANGUAGES` array. Google Translate's `gtx` endpoint supports ~100 languages — use the BCP-47 code (e.g., `pt-BR` for Brazilian Portuguese, `zh-TW` for Traditional Chinese).

## Reporting bugs

Open an issue using the **Bug Report** template. Include:
- Browser + version (Chrome 121, Edge 122, etc.)
- Number of peers in the room
- Whether SFU mode is active (`NEXT_PUBLIC_LIVEKIT_URL` set?)
- Console errors (open DevTools → Console, screenshot the red ones)
- Network tab failures if any

## Security

Don't open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your changes will be released under the [MIT license](LICENSE).
