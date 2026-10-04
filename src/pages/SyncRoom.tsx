// src/pages/SyncRoom.tsx
import {
  Play,
  Volume2,
  Pause,
  Maximize,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { RoomStateType } from "../types/videoType";
import { socket } from "../lib/socket";
import { VideoChat } from "../components/VideoChat";
import { VolumeSlider } from "../components/VolumeSlider";
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
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playerTime, setPlayerTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    playerRef.current?.setVolume(value);
  };

  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current); // cancel pending hide
    setShowVolumeSlider(true);
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setShowVolumeSlider(false), 500); // hide after 2s
  };

  const toggleFullscreen = () => {
    const container = document.getElementById("player-container");
    if (!document.fullscreenElement) {
      container?.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  };

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

  const seekPlayer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !playerRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const seekTo = percent * duration;

    playerRef.current.seekTo(seekTo, true);
    setPlayerTime(seekTo);

    socket.emit("video-seek", { roomId, timestamp: seekTo });
    setRoomData(prev => prev ? { ...prev, timestamp: seekTo } : prev);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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
    const handleRemoteSeek = ({ timestamp }: { timestamp: number }) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(timestamp, true);
      setRoomData((prev) =>
        prev ? { ...prev, timestamp } : prev,
      );
    };

    socket.on("video-play", handleRemotePlay);
    socket.on("video-pause", handleRemotePause);
    socket.on("video-seek", handleRemoteSeek);

    return () => {
      socket.off("video-play", handleRemotePlay);
      socket.off("video-pause", handleRemotePause);
      socket.off("video-seek", handleRemoteSeek);
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
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
        },
      });
      playerRef.current = player;
    };
  }, [roomData]);

  useEffect(() => {
    if (!roomData?.isPlaying) return;
    setDuration(playerRef.current?.getDuration() ?? 0);

    const interval = setInterval(() => {
        if(!playerRef.current) return;
        setPlayerTime(playerRef.current.getCurrentTime());
    }, 1000)
    return () => clearInterval(interval);
  }, [roomData?.isPlaying]);
  return (
    <div className="h-screen w-full overflow-hidden bg-zinc-950 px-4 py-4">
      {/* Video chat moved to bottom to ensure portal target exists first */}

      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {/* Player */}
        <div id="player-container" className="relative group w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-800 bg-black aspect-video max-h-[80vh]">
          <div id="yt-player" className="absolute inset-0 h-full w-full" />
        </div>
        <div className="w-full max-w-6xl flex gap-2 justify-center items-stretch">
          {/* Controller */}
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 shadow-xl">


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


            <span className="ml-2 whitespace-nowrap text-xs text-zinc-400">
              {formatTime(playerTime)} / {formatTime(duration)}
            </span>

            {/* filling the duration */}
            <div className="hidden w-40 sm:block md:w-64 cursor-pointer" onClick={seekPlayer}>
              <div className="h-1.5 rounded-full bg-zinc-700 pointer-events-none">
                <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${duration ? (playerTime / duration) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              {showVolumeSlider && <VolumeSlider volume={volume} onChange={handleVolumeChange} />}

              <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
                <Volume2 size={18} />
              </button>
            </div>


           {/* Zoom */}
            <button onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <Maximize size={18} />
            </button>
          </div>

          {/* video chat Controller Target */}
          <div id="video-chat-portal-target" className="flex shrink-0 items-center gap-2 self-stretch" />
        </div>
      </div>

      {roomData && roomId && <VideoChat roomId={roomId} />}
    </div>
  );
};