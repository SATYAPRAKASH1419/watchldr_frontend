# watchldr_frontend — Codebase Overview

> A synchronized YouTube watch-party app with built-in WebRTC video chat.  
> Stack: **React 19 · TypeScript · Vite · TailwindCSS v4 · Socket.IO · WebRTC**

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Tech Stack & Dependencies](#tech-stack--dependencies)
3. [Entry Points](#entry-points)
4. [Routing](#routing)
5. [Pages](#pages)
   - [RoomCreatePage](#roomcreatepage)
   - [RoomJoinPage](#roomjoinpage)
   - [SyncRoom](#syncroom)
6. [Components](#components)
   - [VideoChat](#videochat)
7. [Hooks](#hooks)
   - [useVideoChat](#usevideochat-internal-hook)
8. [Lib](#lib)
   - [socket.ts](#socketlibsocketts)
9. [Types](#types)
10. [Utils](#utils)
11. [Socket Event Reference](#socket-event-reference)
12. [Data Flow Diagrams](#data-flow-diagrams)
13. [Known TODOs / Gaps](#known-todos--gaps)

---

## Project Structure

```
watchldr_frontend/
├── index.html                  # HTML shell, mounts #root
├── vite.config.ts              # Vite + React + Tailwind plugins
├── tsconfig.json               # Root TS config (references app + node)
├── tsconfig.app.json           # App-level TS config
├── tsconfig.node.json          # Node-level TS config (for vite.config)
├── eslint.config.js            # ESLint with react-hooks + react-refresh
├── package.json
└── src/
    ├── main.tsx                # React root, StrictMode
    ├── App.tsx                 # Router + route declarations
    ├── index.css               # Global styles (minimal)
    ├── pages/
    │   ├── RoomCreatePage.tsx  # /create route — create a new room
    │   ├── RoomJoinPage.tsx    # /join route  — join an existing room
    │   └── SyncRoom.tsx        # /room/:roomId — main watch room
    ├── components/
    │   └── VideoChat.tsx       # Floating WebRTC video-chat overlay
    ├── lib/
    │   └── socket.ts           # Singleton Socket.IO client
    ├── types/
    │   └── videoType.ts        # Shared TypeScript types
    └── utils/
        └── util.ts             # YouTube ID extractor + base URLs
```

---

## Tech Stack & Dependencies

| Package | Role |
|---|---|
| `react` + `react-dom` v19 | UI framework |
| `react-router-dom` v7 | Client-side routing |
| `typescript` ~6 | Type safety |
| `vite` v8 | Build tool & dev server |
| `tailwindcss` v4 + `@tailwindcss/vite` | Utility-first CSS (Vite plugin) |
| `socket.io-client` v4 | Real-time signalling (watch sync + WebRTC) |
| `axios` | REST calls to backend (create/join room) |
| `lucide-react` | Icon library (Play, Pause, Mic, etc.) |

---

## Entry Points

### `index.html`
Standard Vite HTML shell. Mounts `<div id="root">` and loads `src/main.tsx` as an ES module.

### `src/main.tsx`
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```
Bootstraps the React tree inside StrictMode.

---

## Routing

Defined in `src/App.tsx`:

| Path | Component | Purpose |
|---|---|---|
| `/create` | `RoomCreatePage` | Paste a YouTube URL and create a room |
| `/join` | `RoomJoinPage` | Enter a Room ID and join |
| `/room/:roomId` | `SyncRoom` | Main synchronized watch + video chat |

Uses `BrowserRouter` from react-router-dom v7.

---

## Pages

### RoomCreatePage

**File:** `src/pages/RoomCreatePage.tsx`

**Purpose:** Allows the host to paste a YouTube link and create a watch room.

**Flow:**
1. User enters a YouTube URL (full `youtube.com/watch?v=...` or `youtu.be/...`).
2. On button click, `extractVideoId()` parses out the video ID.
3. `POST /api/create-room` is called with `{ videoId }`.
4. On success, navigates to `/room/:roomId`.

**State:**
- `videoLink: string` — raw input value

**Key behaviour:**
- Silent early return if video ID extraction fails (no UI error shown currently — a known gap).

---

### RoomJoinPage

**File:** `src/pages/RoomJoinPage.tsx`

**Purpose:** Lets a guest enter a Room ID to join an existing session.

**Flow:**
1. User types a Room ID.
2. `GET /api/initial-room-data?roomId=<id>` validates the room exists.
3. On success, navigates to `/room/:roomId`.

**State:**
- `roomId: string` — raw input value

**Key behaviour:**
- Errors are logged to console only (no user-facing error UI yet).

---

### SyncRoom

**File:** `src/pages/SyncRoom.tsx`

**Purpose:** The core watch room. Embeds the YouTube IFrame Player and keeps all participants in sync via Socket.IO.

**YouTube Player Setup:**
- Dynamically injects the YouTube IFrame API script (`https://www.youtube.com/iframe_api`).
- Attaches the player to `<div id="yt-player">` via `window.YT.Player`.
- The player is stored in `playerRef` (a plain ref, not state) to avoid re-renders.

**State:**
- `roomData: RoomStateType | undefined` — the room's canonical playback state (videoId, isPlaying, timestamp, lastupdated).

**Socket events listened:**
| Event | Payload | Action |
|---|---|---|
| `video-play` | `{ timestamp }` | seekTo + playVideo + update local state |
| `video-pause` | `{ timestamp }` | seekTo + pauseVideo + update local state |

**Socket events emitted:**
| Event | Payload | When |
|---|---|---|
| `join-room` | `roomId` (string) | On mount — gets initial room state via ACK callback |
| `video-play` | `{ roomId, timestamp }` | User clicks Play |
| `video-pause` | `{ roomId, timestamp }` | User clicks Pause |

**UI structure:**
```
SyncRoom
├── <VideoChat roomId> (WebRTC overlay, shown only after join-room ACK)
└── Centered layout
    ├── YouTube IFrame player (aspect-video, max 80vh)
    └── Custom controls bar
        ├── SkipBack (stub — no handler)
        ├── Play/Pause toggle (calls playPauseVideo)
        ├── SkipForward (stub — no handler)
        ├── Timestamp display (static "00:00 / 00:00")
        ├── Progress bar (static, visual only)
        ├── Volume button (stub)
        └── Settings button (stub)
```

> **Note:** SkipBack, SkipForward, Volume, Settings, and the progress/timestamp display are **visual stubs** with no wired logic yet.

---

## Components

### VideoChat

**File:** `src/components/VideoChat.tsx`

The floating video-chat overlay positioned fixed at `top-4 right-4`. It manages the entire WebRTC lifecycle through an internal hook.

**Public export:**
```tsx
export const VideoChat = ({ roomId }: { roomId: string }) => { ... }
```

**Behaviour:**
- Renders a "Join video" button when `active = false`.
- When active, renders `<VideoPanel>` which hosts the local + remote video tiles and media controls.
- Hang up sets `active = false` and the WebRTC teardown runs via cleanup in `useVideoChat`.

**Sub-components (internal):**

#### `Tile`
Renders a single video participant tile.
- Props: `stream`, `label`, `muted`, `mirror`, `micOn`, `camOn`
- Shows video if `camOn && !!stream`; otherwise shows the first letter of the label as an avatar.
- Displays a `MicOff` icon overlay when `micOn = false`.

#### `VideoPanel`
Orchestrates the chat UI. Uses `useVideoChat(roomId)` and renders:
- Local tile (mirrored, muted)
- One `Tile` per remote peer
- Error banner (amber text) for camera/mic permission issues
- Control bar: Mic toggle, Camera toggle, Collapse/Expand, Hang Up

---

## Hooks

### `useVideoChat` (internal hook)

Defined inside `VideoChat.tsx`. **Not exported.** Handles all WebRTC and signalling logic.

**Returns:**
```ts
{
  localStream: MediaStream | null,
  remoteStreams: Record<string, MediaStream>,
  peerStates: Record<string, { micOn: boolean; camOn: boolean }>,
  micOn: boolean,
  camOn: boolean,
  error: string | null,
  toggleMic: () => void,
  toggleCam: () => void,
  hasAudio: boolean,
  hasVideo: boolean,
}
```

**Lifecycle (on mount):**
1. Requests `getUserMedia({ video, audio })`.
   - Falls back to audio-only if camera is blocked.
   - Falls back to no media if mic is also blocked (receive-only mode).
2. Registers all socket listeners (`video:peer-joined`, `video:peer-left`, `video:offer`, `video:answer`, `video:ice`, `video:peer-state`).
3. Emits `video:join` with `roomId` — ACK returns existing peers' IDs and states.

**Peer connection strategy:**
- The **existing peer** calls `sendOffer` when a newcomer joins (`video:peer-joined`).
- The **newcomer** waits and responds with an answer (`video:offer` → `video:answer`).
- ICE candidates are buffered in `pendingIce` if the remote description isn't set yet, then flushed via `flushIce()`.
- Connection failure triggers an ICE restart (only by the original offerer).

**Cleanup (on unmount):**
- Emits `video:leave`.
- Removes all socket listeners.
- Closes and clears all `RTCPeerConnection` instances.
- Stops all local media tracks.

**RTC Configuration:**
```ts
const RTC_CONFIG = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ]
};
```
> STUN only — no TURN server configured yet. P2P may fail on strict NATs.

---

## Lib

### `src/lib/socket.ts`

```ts
import { io } from "socket.io-client";
import { socketUrl } from "../utils/util";

export const socket = io(socketUrl);
```

A **module-level singleton** Socket.IO client. Both `SyncRoom` and `VideoChat` import the same instance — they share one persistent connection.

---

## Types

### `src/types/videoType.ts`

```ts
export type RoomStateType = {
  videoId: string;       // YouTube video ID (e.g. "dQw4w9WgXcQ")
  isPlaying: boolean;    // Current playback state
  timestamp: number;     // Playback position in seconds
  lastupdated: number;   // Unix ms timestamp of last state change
};
```

---

## Utils

### `src/utils/util.ts`

| Export | Type | Value / Purpose |
|---|---|---|
| `extractVideoId(videoLink)` | `(string) => string` | Parses YouTube URLs (`youtube.com/watch?v=` and `youtu.be/`) and returns the video ID. Returns `""` on failure. |
| `baseUrl` | `string` | `"http://localhost:3000/api"` — REST API base |
| `socketUrl` | `string` | `"http://localhost:3000"` — Socket.IO server |

---

## Socket Event Reference

### Watch Sync Events (used in `SyncRoom`)

| Direction | Event | Payload | Description |
|---|---|---|---|
| Emit | `join-room` | `roomId: string` | Join a room; ACK returns `RoomStateType \| { error }` |
| Emit | `video-play` | `{ roomId, timestamp }` | Broadcast play to room |
| Emit | `video-pause` | `{ roomId, timestamp }` | Broadcast pause to room |
| On | `video-play` | `{ timestamp }` | Remote play received |
| On | `video-pause` | `{ timestamp }` | Remote pause received |

### WebRTC Signalling Events (used in `VideoChat`)

| Direction | Event | Payload | Description |
|---|---|---|---|
| Emit | `video:join` | `{ roomId }` | Join video; ACK returns `JoinAck` |
| Emit | `video:leave` | — | Leave video (on unmount) |
| Emit | `video:offer` | `{ to, data: SDP }` | Send WebRTC offer to peer |
| Emit | `video:answer` | `{ to, data: SDP }` | Send WebRTC answer to peer |
| Emit | `video:ice` | `{ to, data: ICECandidate }` | Send ICE candidate to peer |
| Emit | `video:state` | `{ micOn, camOn }` | Broadcast own mic/cam state |
| On | `video:peer-joined` | `{ peerId }` | New peer entered video |
| On | `video:peer-left` | `{ peerId }` | Peer left video |
| On | `video:offer` | `{ from, data: SDP }` | Incoming offer from peer |
| On | `video:answer` | `{ from, data: SDP }` | Incoming answer from peer |
| On | `video:ice` | `{ from, data: ICECandidate }` | Incoming ICE candidate |
| On | `video:peer-state` | `{ peerId, micOn, camOn }` | Peer toggled mic/cam |

---

## Data Flow Diagrams

### Room Creation & Join

```
User → RoomCreatePage
  → extractVideoId(link)
  → POST /api/create-room { videoId }
  ← { roomId }
  → navigate /room/:roomId

User → RoomJoinPage
  → GET /api/initial-room-data?roomId=...
  ← 200 OK (room exists)
  → navigate /room/:roomId
```

### Watch Sync

```
SyncRoom mounts
  → socket.emit("join-room", roomId)
  ← ACK: RoomStateType  ──→  setRoomData()
  → YT IFrame API loads  ──→  YT.Player created with videoId

User clicks Play/Pause
  → playerRef.current.playVideo() / pauseVideo()
  → socket.emit("video-play" / "video-pause", { roomId, timestamp })

Remote event received
  → socket.on("video-play") → seekTo + playVideo + setRoomData
  → socket.on("video-pause") → seekTo + pauseVideo + setRoomData
```

### WebRTC Negotiation

```
Peer A (existing)          Server           Peer B (new joiner)
    |                        |                       |
    |<-- video:peer-joined --|<-- video:join --------|
    |                        |                       |
    |-- video:offer -------->|-- video:offer ------->|
    |                        |                       |
    |<-- video:answer -------|<-- video:answer -------|
    |                        |                       |
    |<-> video:ice ----------|-------> video:ice ---->|
    |                        |                       |
    |====== P2P media stream established ============|
```

---

## Known TODOs / Gaps

| Area | Issue |
|---|---|
| **RoomCreatePage** | No UI feedback when the YouTube URL is invalid or the API call fails |
| **RoomJoinPage** | No UI feedback when room is not found (error only logged to console) |
| **SyncRoom controls** | SkipBack, SkipForward, Volume, Settings buttons are visual stubs with no logic |
| **SyncRoom controls** | Progress bar and timestamp display (`00:00 / 00:00`) are static/hardcoded |
| **WebRTC** | No TURN server — P2P connections will fail behind strict NATs/firewalls |
| **Config** | `baseUrl` and `socketUrl` are hardcoded to `localhost:3000` — needs env-var support for production |
| **`hooks/` directory** | Directory exists but is empty — `useVideoChat` lives inside `VideoChat.tsx` |
| **Auth / Room passwords** | Room password input is commented out in `RoomCreatePage` |
| **Video seek** | Seeking (e.g. dragging the progress bar) is not implemented or broadcast yet |
