import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { socket } from "../lib/socket";

// STUN only for now. TURN gets added in the next step.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

type PeerState = { micOn: boolean; camOn: boolean };

type JoinAck =
  | {
      ok: true;
      selfId: string;
      peers: { peerId: string; micOn: boolean; camOn: boolean }[];
    }
  | { ok: false; error: string };

const MEDIA_AUDIO = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

function useVideoChat(roomId: string) {
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const offerers = useRef(new Set<string>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [peerStates, setPeerStates] = useState<Record<string, PeerState>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const removePeer = (peerId: string) => {
      pcs.current.get(peerId)?.close();
      pcs.current.delete(peerId);
      offerers.current.delete(peerId);
      pendingIce.current.delete(peerId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      setPeerStates((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    const flushIce = async (peerId: string) => {
      const pc = pcs.current.get(peerId);
      const queued = pendingIce.current.get(peerId) ?? [];
      pendingIce.current.delete(peerId);
      for (const candidate of queued) {
        try {
          await pc?.addIceCandidate(candidate);
        } catch (err) {
          console.warn("addIceCandidate failed", err);
        }
      }
    };

    const sendOffer = async (peerId: string, iceRestart = false) => {
      try {
        const pc = createPeer(peerId);
        offerers.current.add(peerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          iceRestart,
        });
        await pc.setLocalDescription(offer);
        socket.emit("video:offer", {
          to: peerId,
          data: { type: offer.type, sdp: offer.sdp },
        });
      } catch (err) {
        console.error("sendOffer failed", err);
      }
    };

    const createPeer = (peerId: string) => {
      const existing = pcs.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const local = localStreamRef.current;
      local?.getTracks().forEach((track) => pc.addTrack(track, local));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("video:ice", { to: peerId, data: e.candidate.toJSON() });
        }
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      };

      pc.onconnectionstatechange = () => {
        // only the side that originally offered restarts ICE
        if (pc.connectionState === "failed" && offerers.current.has(peerId)) {
          sendOffer(peerId, true);
        }
      };

      pcs.current.set(peerId, pc);
      return pc;
    };

    const ensurePeerState = (peerId: string) =>
      setPeerStates((prev) =>
        prev[peerId] ? prev : { ...prev, [peerId]: { micOn: true, camOn: true } },
      );

    // ---- socket handlers ----
    const onPeerJoined = ({ peerId }: { peerId: string }) => {
      ensurePeerState(peerId);
      // existing peer offers to the newcomer
      sendOffer(peerId);
    };

    const onPeerLeft = ({ peerId }: { peerId: string }) => removePeer(peerId);

    const onOffer = async ({
      from,
      data,
    }: {
      from: string;
      data: RTCSessionDescriptionInit;
    }) => {
      try {
        ensurePeerState(from);
        const pc = createPeer(from);
        await pc.setRemoteDescription(data);
        await flushIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("video:answer", {
          to: from,
          data: { type: answer.type, sdp: answer.sdp },
        });
      } catch (err) {
        console.error("onOffer failed", err);
      }
    };

    const onAnswer = async ({
      from,
      data,
    }: {
      from: string;
      data: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = pcs.current.get(from);
        if (!pc) return;
        await pc.setRemoteDescription(data);
        await flushIce(from);
      } catch (err) {
        console.error("onAnswer failed", err);
      }
    };

    const onIce = async ({
      from,
      data,
    }: {
      from: string;
      data: RTCIceCandidateInit;
    }) => {
      const pc = pcs.current.get(from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(data);
        } catch (err) {
          console.warn("addIceCandidate failed", err);
        }
      } else {
        // remote description not set yet, hold it
        const list = pendingIce.current.get(from) ?? [];
        list.push(data);
        pendingIce.current.set(from, list);
      }
    };

    const onPeerState = ({
      peerId,
      micOn,
      camOn,
    }: {
      peerId: string;
      micOn: boolean;
      camOn: boolean;
    }) => setPeerStates((prev) => ({ ...prev, [peerId]: { micOn, camOn } }));

    // ---- start: get media, register listeners, join ----
    const start = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 24 },
          },
          audio: MEDIA_AUDIO,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: MEDIA_AUDIO,
          });
          setCamOn(false);
          setError("Camera unavailable, joined with mic only.");
        } catch {
          setMicOn(false);
          setCamOn(false);
          setError("Mic and camera blocked. You can see others, they can't see you.");
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      socket.on("video:peer-joined", onPeerJoined);
      socket.on("video:peer-left", onPeerLeft);
      socket.on("video:offer", onOffer);
      socket.on("video:answer", onAnswer);
      socket.on("video:ice", onIce);
      socket.on("video:peer-state", onPeerState);

      socket.emit("video:join", { roomId }, (res: JoinAck) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const initial: Record<string, PeerState> = {};
        res.peers.forEach((p) => {
          initial[p.peerId] = { micOn: p.micOn, camOn: p.camOn };
        });
        setPeerStates(initial);
        // newcomer does not offer, it waits for offers from existing peers
      });
    };

    start();

    return () => {
      cancelled = true;
      socket.emit("video:leave");
      socket.off("video:peer-joined", onPeerJoined);
      socket.off("video:peer-left", onPeerLeft);
      socket.off("video:offer", onOffer);
      socket.off("video:answer", onAnswer);
      socket.off("video:ice", onIce);
      socket.off("video:peer-state", onPeerState);

      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      offerers.current.clear();
      pendingIce.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStreams({});
      setPeerStates({});
    };
  }, [roomId]);

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    socket.emit("video:state", { micOn: next, camOn });
  };

  const toggleCam = () => {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    socket.emit("video:state", { micOn, camOn: next });
  };

  return {
    localStream,
    remoteStreams,
    peerStates,
    micOn,
    camOn,
    error,
    toggleMic,
    toggleCam,
    hasAudio: !!localStream?.getAudioTracks().length,
    hasVideo: !!localStream?.getVideoTracks().length,
  };
}

const Tile = ({
  stream,
  label,
  muted,
  mirror,
  micOn,
  camOn,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  micOn: boolean;
  camOn: boolean;
}) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  const showVideo = camOn && !!stream;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirror ? "scale-x-[-1]" : ""} ${
          showVideo ? "" : "invisible"
        }`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-zinc-500">
          {label.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {!micOn && <MicOff size={10} className="text-red-400" />}
        <span>{label}</span>
      </div>
    </div>
  );
};

const VideoPanel = ({
  roomId,
  onHangUp,
}: {
  roomId: string;
  onHangUp: () => void;
}) => {
  const {
    localStream,
    remoteStreams,
    peerStates,
    micOn,
    camOn,
    error,
    toggleMic,
    toggleCam,
    hasAudio,
    hasVideo,
  } = useVideoChat(roomId);
  const [collapsed, setCollapsed] = useState(false);

  const peerIds = Object.keys(peerStates);

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40";

  return (
    <div className="fixed right-4 top-4 z-50 flex w-52 flex-col gap-2">
      {!collapsed && (
        <>
          <Tile
            stream={localStream}
            label="You"
            muted
            mirror
            micOn={micOn}
            camOn={camOn}
          />
          {peerIds.map((id, i) => (
            <Tile
              key={id}
              stream={remoteStreams[id] ?? null}
              label={`Guest ${i + 1}`}
              micOn={peerStates[id].micOn}
              camOn={peerStates[id].camOn}
            />
          ))}
          {error && (
            <p className="rounded-lg bg-zinc-900 px-2 py-1 text-[11px] text-amber-400">
              {error}
            </p>
          )}
        </>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-2 py-1.5 shadow-xl">
        <button
          onClick={toggleMic}
          disabled={!hasAudio}
          className={`${btn} ${
            micOn ? "text-zinc-300 hover:bg-zinc-800" : "bg-red-500/20 text-red-400"
          }`}
        >
          {micOn ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <button
          onClick={toggleCam}
          disabled={!hasVideo}
          className={`${btn} ${
            camOn ? "text-zinc-300 hover:bg-zinc-800" : "bg-red-500/20 text-red-400"
          }`}
        >
          {camOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`${btn} text-zinc-300 hover:bg-zinc-800`}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <button
          onClick={onHangUp}
          className={`${btn} bg-red-500 text-white hover:bg-red-400`}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
};

export const VideoChat = ({ roomId }: { roomId: string }) => {
  const [active, setActive] = useState(true);

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-black hover:bg-green-400"
      >
        <Video size={16} /> Join video
      </button>
    );
  }

  return <VideoPanel roomId={roomId} onHangUp={() => setActive(false)} />;
};