"use client";

import { useVJStore, VJVideoItem } from "../../stores/vjStore";
import { Play, Film, Sparkles, Trash2 } from "lucide-react";

interface VJLibraryRowProps {
  video: VJVideoItem;
  index: number;
}

export default function VJLibraryRow({ video, index }: VJLibraryRowProps) {
  const { activeVideo, setActiveVideo, deleteVideo } = useVJStore();
  const isActive = activeVideo?.id === video.id;

  return (
    <div
      onClick={() => setActiveVideo(video)}
      className={`relative grid grid-cols-12 gap-2 px-3 py-1.5 items-center text-[11px] font-mono border-b border-[#141420] cursor-pointer transition-all duration-150 group select-none ${
        isActive
          ? "bg-[#ff6b00]18 text-white border-l-2 border-l-[#ff6b00]"
          : "hover:bg-[#151522] text-[#a0a0c0] hover:text-white"
      }`}
    >
      {/* Col 1: Index & Icon */}
      <div className="col-span-1 flex items-center gap-1.5 font-bold text-[#666680] group-hover:text-white">
        <span className="w-4 text-right text-[10px]">{index + 1}</span>
        {isActive ? (
          <Sparkles size={11} className="text-[#ff6b00] animate-pulse" />
        ) : (
          <Film size={11} className="opacity-60" />
        )}
      </div>

      {/* Col 2: Title */}
      <div className="col-span-6 truncate font-bold uppercase tracking-wide flex items-center gap-2">
        <span style={{ color: isActive ? "#ff6b00" : video.color }}>
          {video.title}
        </span>
        {video.isCustom && (
          <span className="text-[7.5px] px-1 py-0.2 rounded bg-white/10 text-white/70 font-mono">
            USER
          </span>
        )}
      </div>

      {/* Col 3: Category */}
      <div className="col-span-3 text-[9.5px] text-[#777795] uppercase truncate">
        {video.category}
      </div>

      {/* Col 4: Action button */}
      <div className="col-span-2 flex items-center justify-end gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteVideo(video.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-[#777790] hover:text-red-500 transition-all cursor-pointer p-0.5 rounded hover:bg-white/10"
          title="Delete VJ Video"
        >
          <Trash2 size={10} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveVideo(video);
          }}
          className={`flex items-center gap-1 text-[8.5px] font-black px-2 py-0.5 rounded border transition-all cursor-pointer uppercase ${
            isActive
              ? "bg-[#ff6b00] text-black border-[#ff6b00] shadow-[0_0_10px_rgba(255,107,0,0.5)]"
              : "bg-transparent text-[#00d4ff] border-[#00d4ff]40 hover:bg-[#00d4ff]15 hover:border-[#00d4ff]"
          }`}
        >
          <Play size={8} fill={isActive ? "#000" : "currentColor"} />
          {isActive ? "ACTIVE" : "PLAY VJ"}
        </button>
      </div>
    </div>
  );
}
