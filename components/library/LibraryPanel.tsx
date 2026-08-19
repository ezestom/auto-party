"use client";

import { useEffect, useState, useRef } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { useVJStore } from "../../stores/vjStore";
import LibraryRow from "./LibraryRow";
import VJLibraryRow from "./VJLibraryRow";
import { Search, ListFilter, ArrowUpDown, X, FolderOpen, Upload, Loader2, Trash2, Film, Video, Tv } from "lucide-react";

import VJMiniPlayer from "../vj/VJMiniPlayer";

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LibraryPanel({ isOpen, onClose }: LibraryPanelProps) {
  const {
    tracks,
    searchQuery,
    sortField,
    importStatus,
    initLibrary,
    setSearchQuery,
    setSort,
    deleteTrack,
  } = useLibraryStore();

  const { videos, activeVideo, loadVideos, importVideo, isLoading: isVjLoading } = useVJStore();

  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Initialize library on mount
  useEffect(() => {
    setMounted(true);
    initLibrary();
    loadVideos();
  }, [initLibrary, loadVideos]);

  const processFilesQueue = async (files: File[]) => {
    const audioFiles: File[] = [];
    const videoFiles: File[] = [];

    files.forEach((file) => {
      if (
        file.type.startsWith("video/") ||
        file.name.endsWith(".mp4") ||
        file.name.endsWith(".webm") ||
        file.name.endsWith(".mov") ||
        file.name.endsWith(".mkv")
      ) {
        videoFiles.push(file);
      } else {
        audioFiles.push(file);
      }
    });

    // Import audio files
    if (audioFiles.length > 0) {
      const { importTrack, setImportStatus } = useLibraryStore.getState();
      setImportStatus({
        active: true,
        current: 0,
        total: audioFiles.length,
        filename: audioFiles[0]?.name || "",
      });

      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        setImportStatus({ current: i + 1, filename: file.name });
        try {
          await importTrack(file);
        } catch (err) {
          console.error("Failed to import audio:", file.name, err);
        }
      }

      setImportStatus({ active: false, current: 0, total: 0, filename: "" });
    }

    // Import video files
    if (videoFiles.length > 0) {
      for (const vFile of videoFiles) {
        try {
          await importVideo(vFile);
        } catch (err) {
          console.error("Failed to import video:", vFile.name, err);
        }
      }
    }
  };

  const handleDirectoryScan = async () => {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];

        async function scan(handle: any) {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              files.push(file);
            } else if (entry.kind === "directory") {
              await scan(entry);
            }
          }
        }

        await scan(dirHandle);

        if (files.length > 0) {
          await processFilesQueue(files);
        }
        return;
      } catch (err) {
        console.warn("Directory Picker cancelled:", err);
      }
    }

    folderInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    await processFilesQueue(Array.from(fileList));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles: File[] = [];

    if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        droppedFiles.push(e.dataTransfer.files[i]);
      }
    }

    if (droppedFiles.length > 0) {
      await processFilesQueue(droppedFiles);
    }
  };

  return (
    <div
      id="library-bottom-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full bg-[#08080d] border-t border-[#1e1e30] z-20 flex flex-col px-4 py-2 select-none min-h-0 overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      {/* Hidden inputs */}
      {mounted && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="audio/*,video/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            type="file"
            ref={videoInputRef}
            multiple
            accept="video/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            {...({
              webkitdirectory: "",
              directory: "",
            } as any)}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
        </>
      )}

      {/* 50/50 SPLIT GRID CONTAINER */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* LEFT 50% COLUMN: MUSIC LIBRARY */}
        <div className="col-span-6 flex flex-col h-full min-h-0 border-r border-[#1e1e2c] pr-3 overflow-hidden">
          {/* Header bar / Toolbar */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e2c] mb-1 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <ListFilter size={13} className="text-[#ff6b00]" />
              <span className="font-mono text-[10px] font-black tracking-widest text-white uppercase">
                MUSIC LIBRARY
              </span>
              <span className="font-mono text-[8.5px] px-1.5 py-0.2 rounded-full bg-[#161622] border border-[#252538] text-[#8888a8]">
                {tracks.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 max-w-xs">
              <div className="relative flex-1 flex items-center">
                <Search size={11} className="absolute left-2 text-[#777790] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search music..."
                  className="w-full pl-6 pr-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[9px] text-white outline-none focus:border-[#ff6b00]"
                />
              </div>
              <button
                onClick={handleDirectoryScan}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[8px] text-[#9999b5] hover:text-white hover:border-[#ff6b00] transition-all cursor-pointer font-extrabold uppercase shrink-0"
              >
                <FolderOpen size={10} className="text-[#ff6b00]" />
                Folder
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[8px] text-[#9999b5] hover:text-white hover:border-[#00d4ff] transition-all cursor-pointer font-extrabold uppercase shrink-0"
              >
                <Upload size={10} className="text-[#00d4ff]" />
                + Audio
              </button>
            </div>
          </div>

          {/* Table headers */}
          <div className="grid grid-cols-12 gap-2 items-center font-mono text-[7.5px] font-extrabold text-[#777795] tracking-wider pb-1 border-b border-[#1c1c28] uppercase shrink-0 px-3 select-none">
            <div className="col-span-1">#</div>
            <div onClick={() => setSort("title")} className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-white">
              TITLE {sortField === "title" && <ArrowUpDown size={7} />}
            </div>
            <div className="col-span-2">ARTIST</div>
            <div onClick={() => setSort("bpm")} className="col-span-1 text-center cursor-pointer hover:text-white">BPM</div>
            <div className="col-span-1 text-center">KEY</div>
            <div className="col-span-1 text-center">TIME</div>
            <div className="col-span-2 text-right pr-2">LOAD</div>
          </div>

          {/* Scrollable audio track list */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#181824] pr-1 mt-0.5">
            {tracks.map((track, i) => (
              <LibraryRow key={track.id} track={track} index={i} />
            ))}
            {tracks.length === 0 && (
              <div className="py-6 text-center text-[#777790] font-mono text-[9px]">
                {searchQuery ? `No tracks matching "${searchQuery}"` : "Music library empty."}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 50% COLUMN: VJ VIDEO LIBRARY */}
        <div className="col-span-6 flex flex-col h-full min-h-0 pl-1 overflow-hidden">
          {/* VJ Header bar */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e2c] mb-1 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <Film size={13} className="text-[#00d4ff]" />
              <span className="font-mono text-[10px] font-black tracking-widest text-white uppercase">
                VJ VIDEO LIBRARY
              </span>
              <span className="font-mono text-[8.5px] px-1.5 py-0.2 rounded-full bg-[#161622] border border-[#252538] text-[#8888a8]">
                {videos.length} loops
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => videoInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[8px] text-[#9999b5] hover:text-white hover:border-[#00d4ff] transition-all cursor-pointer font-extrabold uppercase shrink-0"
              >
                <Video size={10} className="text-[#00d4ff]" />
                + Import Video
              </button>
              <button
                id="library-close-btn"
                onClick={onClose}
                className="p-1 text-[#777790] hover:text-white transition-colors cursor-pointer rounded hover:bg-white/5"
                title="Minimize Library"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Active VJ Video Preview Banner & Controls */}
          <div className="flex items-center justify-between p-1.5 mb-1 bg-[#0c0c14] border border-[#222238] rounded-lg shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">
              <VJMiniPlayer />
              <div className="overflow-hidden leading-none">
                <div className="font-mono text-[9.5px] font-black text-white truncate uppercase tracking-wide" style={{ color: activeVideo?.color || "#00d4ff" }}>
                  {activeVideo ? activeVideo.title : "NO VIDEO LOADED"}
                </div>
                <div className="font-mono text-[7.5px] text-[#777795] uppercase tracking-wider mt-0.5">
                  {activeVideo ? activeVideo.category : "SELECT VJ LOOP"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Auto Beat Sync Badge */}
              <div className="flex items-center gap-1 bg-[#12121e] px-2 py-0.5 rounded border border-[#222234]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[7.5px] font-mono font-black text-[#00ff88] uppercase tracking-wider">
                  AUTO BEAT SYNC
                </span>
              </div>

              <button
                onClick={() => {
                  const currentActive = useVJStore.getState().activeVideo;
                  const allVideos = useVJStore.getState().videos;
                  if (!currentActive && allVideos.length > 0) {
                    useVJStore.getState().setActiveVideo(allVideos[0]);
                  } else if (currentActive) {
                    useVJStore.getState().setActiveVideo(currentActive);
                  }

                  if (typeof window !== "undefined") {
                    window.open("/vj", "EZE_MIX_VJ_WINDOW", "width=1280,height=720,menubar=no,toolbar=no");
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#00d4ff]18 border border-[#00d4ff]60 text-[#00d4ff] font-mono text-[8px] font-black uppercase hover:bg-[#00d4ff]30 hover:text-white transition-all cursor-pointer"
                title="Pop out VJ display window for Monitor 2 Projector/TV"
              >
                <Tv size={10} />
                MONITOR 2 OUT
              </button>
            </div>
          </div>

          {/* VJ Table headers */}
          <div className="grid grid-cols-12 gap-2 items-center font-mono text-[7.5px] font-extrabold text-[#777795] tracking-wider pb-1 border-b border-[#1c1c28] uppercase shrink-0 px-2 select-none">
            <div className="col-span-1">#</div>
            <div className="col-span-6">VIDEO LOOP NAME</div>
            <div className="col-span-3">CATEGORY</div>
            <div className="col-span-2 text-right">TRIGGER</div>
          </div>

          {/* Scrollable VJ video list */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#181824] pr-1 mt-0.5">
            {videos.map((video, i) => (
              <VJLibraryRow key={video.id} video={video} index={i} />
            ))}
          </div>
        </div>

      </div>

      {/* Drag & Drop Visual overlay state */}
      {isDragging && (
        <div className="absolute inset-0 bg-[#0f0f16]/95 border-2 border-dashed border-[#00d4ff] rounded-md flex flex-col items-center justify-center gap-2 z-30 transition-all pointer-events-none">
          <Upload size={24} className="text-[#00d4ff] animate-bounce" />
          <span className="font-mono text-[10px] text-white tracking-widest uppercase">
            Drop Audio (.mp3, .wav) or Video (.mp4, .webm) files to import
          </span>
        </div>
      )}

      {/* Importing Progress Overlay */}
      {importStatus.active && (
        <div className="absolute inset-0 bg-[#06060a]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 animate-fade-in">
          <Loader2 size={28} className="text-[#ff6b00] animate-spin mb-3" />
          <span className="font-mono text-[11px] font-black text-white uppercase tracking-widest mb-1">
            Processing Media
          </span>
          <span className="font-mono text-[9px] text-[#8888a8] uppercase tracking-wider mb-3">
            Processing Item {importStatus.current} of {importStatus.total}
          </span>
          <div className="w-full bg-[#1c1c28] h-1.5 rounded-full overflow-hidden max-w-48 mb-2 border border-white/5">
            <div
              className="bg-[#ff6b00] h-full rounded-full transition-all duration-200"
              style={{ width: `${(importStatus.current / importStatus.total) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[7.5px] text-text-muted truncate max-w-60 text-center">
            {importStatus.filename}
          </span>
        </div>
      )}
    </div>
  );
}

