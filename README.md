<div align="center">

# CineMesh

A cinematic, real-time watch-party platform. Create a room, share the link, and watch together — with live video, chat, screen share, host moderation, 50-language translation, and a floating PiP window that lets you chat without leaving your movie.

[![Live demo](https://img.shields.io/badge/Live-cinemesh.vercel.app-c9a84c?style=flat-square)](https://cinemesh.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/LiveKit-SFU-FF6B6B?style=flat-square)](https://livekit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

</div>

---

## Highlights

- **Real-time video + audio** for up to 20 people per room (SFU mode) or ~8 (mesh fallback)
- **Screen sharing with system audio** — share a movie tab and the sound transmits too
- **Dual streams** — your face stays visible while you screen-share, never replaced
- **Floating PiP window** — keep chat + cams visible while watching content in another app
- **Live chat** with full emoji picker, custom stickers, and **50-language auto-translation** (Hindi, Bengali, Tamil, Mandarin, Arabic, Spanish, etc.)
- **Host moderation** — mute, disable cam, stop share, or remove any participant
- **Quality auto-scaling** — bitrate adapts to room size; quality badge warns when crowded
- **Cinematic dark UI** — obsidian + gold + electric blue, Framer Motion animations everywhere
- **Zero account required** — share a 6-character code or invite link
- **Privacy** — chat and signaling go through your Supabase project; media goes peer-to-peer (mesh) or through your LiveKit project (SFU)

---

## Live demo

**https://cinemesh.vercel.app**

---

## Tech stack

| Layer | Tech | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components, Route Handlers, Vercel-native |
| Language | TypeScript (strict) | Type safety; explicit interfaces over `any` |
| Styling | Tailwind CSS + custom design tokens | Atomic, fast, themable |
| Animations | Framer Motion | Spring physics, staggered reveals, reduced-motion support |
| UI primitives | Radix UI | Accessible dialogs, dropdowns, switches |
| State | Zustand + React hooks | Tiny, no boilerplate, no provider tree |
| Database | Supabase (Postgres) | Rooms + participants in `cinemesh` schema, RLS enforced |
| Realtime signaling | Supabase Realtime | Presence + Broadcast for chat, sync, WebRTC signaling, moderation |
| Media (mesh) | Plain WebRTC (RTCPeerConnection) | Free, peer-to-peer, ~8 person max |
| Media (SFU) | LiveKit Cloud | Optional. Activates when env vars are set. Scales to 100+ |
| Translation | Google Translate `gtx` endpoint | No API key, in-memory cache, 50 languages |
| Hosting | Vercel | Edge-first, zero-config deploy |

---

## Architecture

```
                       ┌────────────────────┐
                       │   Supabase (Postgres + Realtime)
                       │                    │
                       │   ▸ cinemesh.rooms │
                       │   ▸ cinemesh.participants
                       │   ▸ Realtime channel  room:<code>
                       │     (presence, chat, sync, signaling, moderation)
                       └─────────▲──────────┘
                                 │
       Browser A                  │              Browser B
  ┌─────────────────┐             │       ┌─────────────────┐
  │  CineMesh App   │◀────────────┴──────▶│  CineMesh App   │
  │  (Next.js)      │                     │  (Next.js)      │
  └────────┬────────┘                     └────────┬────────┘
           │                                       │
           │  Media (camera/mic/screen)            │
           │                                       │
           │   ╔═══ MESH MODE ═══╗                 │
           │   ║ Direct WebRTC   ║                 │
           ▼   ║   peer-to-peer  ║                 ▼
   ┌───────────╠═════════════════╣────────────────────┐
   │           ║  -OR-           ║                    │
   │           ║                 ║                    │
   │           ║  SFU MODE       ║                    │
   │           ║ via LiveKit     ║                    │
   │           ║ (single uplink, ║                    │
   │           ║  server fan-out)║                    │
   │           ╚═════════════════╝                    │
   └───────────────────────────────────────────────────┘
```

### Why two media transports?

WebRTC mesh sends `N-1` copies of each track upstream — fine for 2–6 people, but a 20-person room would saturate any home uplink. LiveKit's SFU forwards streams server-side so each user uploads **once**. The same React code drives both:

- `useWebRTC()` — mesh, uses Supabase Realtime for signaling, no extra infra
- `useLiveKitRoom()` — SFU, connects to LiveKit Cloud

Both expose the same `{ remoteCameras, remoteScreens, connectionStates }` shape so the room page doesn't care which is active. Selection is automatic: if `NEXT_PUBLIC_LIVEKIT_URL` is set, LiveKit wins.

---

## Features in depth

### Screen sharing
Browsers protect DRM content (Netflix, Hotstar, Disney+, Prime, etc.) at the OS level — those tabs will black out when captured. CineMesh works perfectly for:
- YouTube, Twitch, free streaming sites
- Personal video files in VLC / your browser
- Sports streams on free portals
- Games, presentations, code reviews

For paid OTT services, see the **legal alternatives** section below.

### Host moderation
The user who creates a room is the host. Their tile shows a 👑 crown; remote tiles show four icon buttons in the top-right corner:

- **VolumeX (red)** — Mute their mic
- **VideoOff (red)** — Turn off their camera
- **Monitor (amber)** — Stop their screen share (only when active)
- **UserX (red)** — Remove from room (with confirm step)

Moderation is a cooperative protocol — the host broadcasts a `moderation` event; the target client verifies the issuer is actually host (`presence.isHost === true`) and applies the action locally. Without an SFU there's no way to enforce mute server-side; with LiveKit's `roomAdmin` grant the host can also force-mute at the SFU level.

### Floating PiP window
Click **Float** in the dock to pop chat + cams + media controls into a separate OS-level always-on-top window (Document Picture-in-Picture API, Chromium 116+). The window:
- Floats above all other apps including other browsers
- Does **not** appear in screen captures (it's outside any browser viewport)
- Has its own mic / camera / share buttons
- Has emoji + sticker pickers (tap to send instantly)
- Translates incoming messages to your preferred language
- Falls back to a regular `window.open()` popup on Firefox / Safari

### Translation
50 languages including every major Indian language. Pick your target language from the 🌐 button in the chat header. Incoming messages from others are auto-translated; your own messages and stickers are never translated. Uses Google Translate's free `gtx` endpoint with in-memory caching.

### Quality adaptation
WebRTCManager.applyBitrateProfile() caps outgoing video bitrate based on peer count:

| Peers | Camera | Screen |
|---|---|---|
| 1–3 | 1 Mbps | 2.5 Mbps |
| 4–7 | 500 kbps | 1.5 Mbps |
| 8–13 | 250 kbps | 1 Mbps |
| 14+ | 150 kbps | 800 kbps |

Auto-applied via `RTCRtpSender.setParameters()` on every peer join/leave. A "Reduced quality" badge appears at 9+ peers; "Audio-friendly" badge at 15+.

---

## Local development

### Prerequisites
- Node.js **18+** (LTS recommended)
- npm (or pnpm / yarn — your call)
- A Supabase project (free tier works)
- *Optional*: A LiveKit Cloud project for SFU mode

### 1. Clone and install

```bash
git clone https://github.com/Bitshank-2338/cinemesh.git
cd cinemesh
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional (for SFU mode, 20+ people):
```env
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-livekit-secret
```

### 3. Apply the database migration

Open the Supabase SQL editor for your project and paste the contents of [`scripts/cinemesh-migration.sql`](scripts/cinemesh-migration.sql). Then go to **Settings → API → Exposed schemas** and add `cinemesh` to the list.

### 4. Run

```bash
npm run dev
```

Visit http://localhost:3000.

---

## Deploy to Vercel

The recommended path. From the repo root:

```bash
npx vercel --prod
```

After the first deploy, set the env vars in the Vercel dashboard (Settings → Environment Variables). **Do not pipe values from PowerShell with `vercel env add` — it can prepend a UTF-8 BOM that breaks `url.startsWith('https://')` checks.** Use the dashboard UI, or pipe through `cmd /c type` from a UTF-8 file.

The app also defensively strips BOM + surrounding quotes at runtime ([`src/lib/supabase.ts`](src/lib/supabase.ts), [`src/hooks/use-livekit-room.ts`](src/hooks/use-livekit-room.ts)) but it's better not to need it.

---

## Project structure

```
src/
├── app/                       # Next.js App Router pages
│   ├── api/livekit-token/     # JWT minting endpoint for SFU mode
│   ├── create/                # Room creation flow
│   ├── join/                  # Room join + code validation
│   ├── lobby/[roomId]/        # Pre-room camera check + presence
│   └── room/[roomId]/         # The actual watch party
├── components/
│   ├── landing/               # Marketing pages (hero, features, CTA)
│   ├── room/                  # In-room UI (tiles, chat, dock, PiP)
│   └── ui/                    # Reusable buttons, cards, badges
├── hooks/
│   ├── use-local-media.ts     # getUserMedia / getDisplayMedia wrapper
│   ├── use-room-channel.ts    # Supabase Realtime presence/chat/moderation
│   ├── use-webrtc.ts          # WebRTC mesh hook
│   ├── use-livekit-room.ts    # LiveKit SFU hook (drop-in replacement)
│   └── use-translation.ts     # Google Translate hook with caching
├── lib/
│   ├── channel/               # Channel adapters (Supabase + BroadcastChannel)
│   ├── webrtc-manager.ts      # Per-peer mesh with dual streams + adaptive bitrate
│   ├── media-manager.ts       # Camera/mic/screen acquisition with typed errors
│   ├── room-service.ts        # DB CRUD over cinemesh schema
│   ├── supabase.ts            # Supabase clients (default + cinemesh-schema)
│   └── translation.ts         # 50-language catalogue + translate() function
└── store/
    └── room-store.ts          # UI-only Zustand store (chat/settings/invite modals)

scripts/
├── cinemesh-migration.sql     # Postgres schema (rooms + participants + RLS)
└── migrate.mjs                # Optional Node runner (manual SQL editor preferred)
```

---

## DRM and OTT services

Browsers block screen-capture of paid streaming services (Netflix, Hotstar, Disney+, Prime, etc.) via Widevine L1 hardware DRM. **There is no legal way to bypass this** and CineMesh does not attempt to.

The legal pattern that works:
- Each viewer uses their own account (or share a single account's multiple simultaneous streams — Netflix Premium = 4, Hotstar Premium = 4, Prime = 3)
- Everyone opens the same episode in their own browser tab
- CineMesh handles chat + face cams + reactions (PiP window keeps them visible)

A planned **Synced Watch-Party Mode** will add a 3-2-1 countdown + drift timer to coordinate manual play/pause across all viewers' Netflix tabs — same model as Teleparty, but no browser extension required.

---

## Contributing

PRs welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and code style.

For security issues, see [SECURITY.md](SECURITY.md) — do not file public issues.

---

## License

[MIT](LICENSE) © 2026 Shashank Singh.

---

## Acknowledgements

- [Next.js](https://nextjs.org) for the framework
- [Supabase](https://supabase.com) for Postgres + Realtime
- [LiveKit](https://livekit.io) for the SFU
- [Framer Motion](https://www.framer.com/motion/) for animations
- [Lucide](https://lucide.dev) for icons
- [Radix UI](https://www.radix-ui.com) for accessible primitives

Built with patience and a lot of iteration. If CineMesh helped your movie night, ⭐ the repo.
