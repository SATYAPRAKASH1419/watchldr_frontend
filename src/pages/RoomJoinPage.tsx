import { useState } from "react";
import { baseUrl } from "../utils/util";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const RoomJoinPage = () => {
  const [roomId, setRoomId] = useState<string>("");
  const navigate = useNavigate();

  async function joinRoom() {
    if (roomId.trim().length === 0) return;

    try {
      // check karo room exist karta hai ya nahi, backend se
      await axios.get(`${baseUrl}/initial-room-data`,{
        params:{
          roomId
        }
      });
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error("Room not found:", error);
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Join a Room</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Enter the room ID to join an existing session
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Room ID
            </label>

            <input
              type="text"
              placeholder="Enter the room ID"
              onChange={(e) => {
                setRoomId(e.target.value);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500 transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <button
            onClick={joinRoom}
            className="mt-2 w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400 active:scale-[0.98]"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};