---
name: TeamDebateRoom fixes
description: Six bug fixes applied to TeamDebateRoom in DebatePage.tsx and useDebateLivekit.ts hook.
---

## Fixes applied (June 2026)

**Why:** The TeamDebateRoom had 6 bugs around audio ordering, TTS after submit, mic state staleness, participant capture, host audio leakage, and tab-close cleanup.

### 1. AI greeting plays strictly first (no fallback user turn)
Removed `localAudioTrack.enabled = true` and `livekitUnmute()` from all error/catch paths in the greeting effect (audio element error, autoplay blocked, TTS network error). Turn management is now the ONLY path that enables the mic — never error recovery.

### 2. Text-only after Submit API
Added `initialAiPlayedRef.current` gate at the top of the greeting `useEffect`. After the first moderator turn TTS plays, subsequent moderator turns (from submit responses) are text-only in the chat feed. Gate is set to `true` immediately after `playedModeratorTurnsRef.add()` for the first turn.

### 3. Mic state reflects true LiveKit track state
- Added `isMuted: boolean` state to `useDebateLivekit.ts` hook (updated in `muteLocalAudio` / `unmuteLocalAudio` callbacks).
- `TeamDebateRoom` now destructures `isMuted: livekitIsMuted` and computes `micEnabled = micAvailable && !livekitIsMuted` — a React state-driven value, not a raw MediaStreamTrack property mutation.
- Mute effect calls `setRoomMicRefresh(v => v+1)` after mutating `localAudioTrack.enabled` to force re-render.

### 4. Participant turn mic/speech capture
- Fixed stale `liveSession` closure in `onGreetingEnd` — now reads `latestLiveSessionRef.current` instead of the captured value.
- Removed the fallback `localTrack.enabled = true` from the server-speaker path in `onGreetingEnd` (turn management handles it).
- Added `speechRecording` to the mute effect dependency array so recording state is respected.

### 5. Host audio not leaking
- Added `if (speechRecording) return;` guard to the mute effect — host's mic won't be forcibly muted mid-recording by a React re-render.
- Updated `handleMicGrant` to refuse re-enabling the mic when `!isCurrentUserTurn` (shows "Wait for your turn" toast instead of enabling track).

### 6. Tab-close/beforeunload handling
- Added `isHostRef` (synced via `useEffect`) so the `beforeunload` handler always sees fresh `isHost` value.
- Added `beforeunload` effect: all clients call `livekitDisconnect()` on tab close; host additionally fires `navigator.sendBeacon` to `/api/v1/debate/room/end` to end the session for all participants.

**How to apply:** Any future changes to TeamDebateRoom should maintain the invariant: turn management (mute effect + `startSpeechCapture`) is the sole authority for enabling/disabling the mic. Never enable mic in error handlers.
