# Changelog

All notable changes to CineMesh are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- LiveKit SFU integration — `useLiveKitRoom` hook + `/api/livekit-token` route. Activates automatically when `NEXT_PUBLIC_LIVEKIT_URL` is set, scaling rooms to 20+ people. Falls back to WebRTC mesh otherwise.
- Host moderation — always-visible icon buttons on remote tiles (mute mic, stop camera, stop screen share, remove participant) for the room host.
- Floating Picture-in-Picture window — chat + cams + media controls in a separate always-on-top OS window (Document PiP, Chromium 116+) with a `window.open()` fallback.
- 50-language chat translation via Google Translate, including all major Indian languages. Per-user preference persisted in localStorage.
- Full emoji picker (6 categories) + custom sticker set in chat and PiP.
- Adaptive video bitrate based on peer count; quality badges at 9+ and 15+ peers.
- Responsive cam layouts — paginated grid in PiP, compact grid in the main strip for large rooms.

### Fixed
- Screen share no longer replaces the user's camera — dual streams via a `stream-roles` signal.
- Mic/camera toggle no longer disconnects other participants (debounced peer-close to absorb Supabase's leave+join on every `track()` update).
- PiP/main video tiles now re-attach when a stream's tracks change after initial mount.
- WebRTC `presence-sync` is now handled so peers already present when you join get connected (previously only `presence-join` was, so connections never formed).
- Env-var BOM/quote corruption defensively stripped at runtime (Supabase + LiveKit).
- Join flow validates the room code against the DB; wrong/expired codes show a clear error instead of creating a phantom room.

### Removed
- Fake marketing stats from the landing page (200K viewers, star rating, etc.).

## [0.1.0] — initial

### Added
- Cinematic landing page, create/join flow, lobby, and room UI.
- Real WebRTC mesh video/audio, screen sharing, live chat, playback sync.
- Supabase-backed rooms in an isolated `cinemesh` schema with RLS.
- BroadcastChannel fallback for same-device multi-tab testing.
