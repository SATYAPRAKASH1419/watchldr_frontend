// src/components/VolumeSlider.tsx

type Props = {
  volume: number;
  onChange: (value: number) => void;
};

export const VolumeSlider = ({ volume, onChange }: Props) => {
  return (
    <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 shadow-2xl">
      <span className="text-[10px] text-zinc-400">{volume}%</span>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ writingMode: "vertical-lr", direction: "rtl", height: "96px", accentColor: "#22c55e" }}
      />
    </div>
  );
};
