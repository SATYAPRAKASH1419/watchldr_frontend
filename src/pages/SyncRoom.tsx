// src/pages/SyncRoom.tsx
import {
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  Settings,
  Pause,
  Mic,
  Video,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { RoomStateType } from "../types/videoType";
import { socket } from "../lib/socket";
import { VideoChat } from "../components/VideoChat";
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}
export const SyncRoom = () => {
  const { roomId } = useParams();
  const playerRef = useRef<any>(null);
  const [roomData, setRoomData] = useState<RoomStateType>();

  const playPauseVideo = () => {
    const currentTime = playerRef.current.getCurrentTime();
    if (roomData?.isPlaying) {
      playerRef.current.pauseVideo();
      socket.emit("video-pause", {
        roomId: roomId,
        timestamp: currentTime,
      });
      setRoomData({ ...roomData, isPlaying: false, timestamp: currentTime });
    } else {
      playerRef.current.playVideo();
      socket.emit("video-play", {
        roomId: roomId,
        timestamp: roomData?.timestamp,
      });
      setRoomData(
        roomData
          ? { ...roomData, isPlaying: true, timestamp: currentTime }
          : roomData,
      );
    }
  };

  useEffect(() => {
    socket.emit(
      "join-room",
      roomId,
      (response: RoomStateType | { error: string }) => {
        if ("error" in response) {
          console.error(response.error);
          return;
        }
        setRoomData(response);
      },
    );
  }, []);

  useEffect(() => {
    const handleRemotePlay = ({ timestamp }: { timestamp: number }) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(timestamp, true);
      playerRef.current.playVideo();
      setRoomData((prev) =>
        prev ? { ...prev, isPlaying: true, timestamp } : prev,
      );
    };
    const handleRemotePause = ({ timestamp }: { timestamp: number }) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(timestamp, true);
      playerRef.current.pauseVideo();
      setRoomData((prev) =>
        prev ? { ...prev, isPlaying: false, timestamp } : prev,
      );
    };
    socket.on("video-play", handleRemotePlay);
    socket.on("video-pause", handleRemotePause);

    return () => {
      socket.off("video-play", handleRemotePlay);
      socket.off("video-pause", handleRemotePause);
    };
  }, []);
  useEffect(() => {
    const tag = document.createElement("script");
    tag.setAttribute("src", "https://www.youtube.com/iframe_api");
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      if (!roomData) return;
      const player = new window.YT.Player("yt-player", {
        videoId: roomData.videoId,
      });
      playerRef.current = player;
    };
  }, [roomData]);

  return (
    <div className="h-screen w-full overflow-hidden bg-zinc-950 px-4 py-4">
      {/* Video chat mounts only after join-room succeeds (backend checks room membership) */}
      {roomData && roomId && <VideoChat roomId={roomId} />}

      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {/* Player */}
        <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-800 bg-black aspect-video max-h-[80vh]">
          <div id="yt-player" className="absolute inset-0 h-full w-full" />
        </div>
        <div className="w-full max-w-6xl flex gap-2 justify-center items-stretch">
          {/* Controller */}
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 shadow-xl">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <SkipBack size={17} />
            </button>

            <button
              onClick={playPauseVideo}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-black transition hover:scale-105 hover:bg-green-400"
            >
              {roomData?.isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>

            <button className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <SkipForward size={17} />
            </button>

            <span className="ml-2 whitespace-nowrap text-xs text-zinc-400">
              00:00 / 00:00
            </span>

            {/* filling the duration */}
            <div className="hidden w-40 sm:block md:w-64">
              <div className="h-1.5 rounded-full bg-zinc-700">
                <div className="h-1.5 w-1/8 rounded-full bg-green-500" />
              </div>
            </div>

            <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <Volume2 size={18} />
            </button>

            <button className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <Settings size={18} />
            </button>
          </div>

          {/* video chat Controller */}
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 shadow-xl">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <Mic size={18} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <Video size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};