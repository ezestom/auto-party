"use client";

import { useEffect, useState, useRef } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import LibraryRow from "./LibraryRow";
import { Search, ListFilter, ArrowUpDown, X, FolderOpen, Upload, Loader2, Trash2 } from "lucide-react";

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LibraryPanel({ isOpen, onClose }: LibraryPanelProps) {
  const {
    tracks,
    searchQuery,
    sortField,
    sortDirection,
    importStatus,
    initLibrary,
    setSearchQuery,
    setSort,
    deleteTrack,
  } = useLibraryStore();

  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasPicker, setHasPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Initialize library on mount (loads from Dexie DB)
  useEffect(() => {
    setMounted(true);
    initLibrary();
    // Check if showDirectoryPicker is supported
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      setHasPicker(true);
    }
  }, [initLibrary]);

  const processFilesQueue = async (files: File[]) => {
    const { importTrack, setImportStatus } = useLibraryStore.getState();
    setImportStatus({
      active: true,
      current: 0,
      total: files.length,
      filename: files[0]?.name || "",
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportStatus({
        current: i + 1,
        filename: file.name,
      });
      try {
        await importTrack(file);
      } catch (err) {
        console.error("Failed to import file:", file.name, err);
      }
    }

    setImportStatus({
      active: false,
      current: 0,
      total: 0,
      filename: "",
    });
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
              if (
                file.type.startsWith("audio/") ||
                file.name.endsWith(".mp3") ||
                file.name.endsWith(".wav") ||
                file.name.endsWith(".m4a") ||
                file.name.endsWith(".ogg") ||
                file.name.endsWith(".aac")
              ) {
                files.push(file);
              }
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
        console.warn("Directory Picker failed or cancelled:", err);
      }
    }

    // Direct fallback for unsupported browsers/origins: trigger file input dialog
    folderInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const files: File[] = Array.from(fileList).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        file.name.endsWith(".mp3") ||
        file.name.endsWith(".wav") ||
        file.name.endsWith(".m4a") ||
        file.name.endsWith(".ogg") ||
        file.name.endsWith(".aac")
    );
    if (files.length > 0) {
      await processFilesQueue(files);
    }
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

    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (
            file &&
            (file.type.startsWith("audio/") ||
              file.name.endsWith(".mp3") ||
              file.name.endsWith(".wav") ||
              file.name.endsWith(".m4a") ||
              file.name.endsWith(".ogg") ||
              file.name.endsWith(".aac"))
          ) {
            droppedFiles.push(file);
          }
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (
          file.type.startsWith("audio/") ||
          file.name.endsWith(".mp3") ||
          file.name.endsWith(".wav") ||
          file.name.endsWith(".m4a") ||
          file.name.endsWith(".ogg") ||
          file.name.endsWith(".aac")
        ) {
          droppedFiles.push(file);
        }
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
            accept="audio/*"
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

      {/* Header bar / Toolbar */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#1e1e2c] mb-1.5 shrink-0">
        {/* Left: Brand title & Track count */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ListFilter size={14} className="text-[#ff6b00]" />
          <span className="font-mono text-[10px] font-black tracking-widest text-white uppercase">
            MUSIC LIBRARY
          </span>
          <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-[#161622] border border-[#252538] text-[#8888a8]">
            {tracks.length} tracks
          </span>
        </div>

        {/* Middle: Search input & Import controls */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 flex items-center">
            <Search size={12} className="absolute left-2.5 text-[#777790] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search track, artist, key, bpm..."
              className="w-full pl-7 pr-3 py-1 bg-[#121218] border border-[#222234] rounded-md font-mono text-[9.5px] text-white outline-none focus:border-[#ff6b00] transition-colors"
            />
          </div>
          <button
            onClick={handleDirectoryScan}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#121218] border border-[#222234] rounded-md font-mono text-[8.5px] text-[#9999b5] hover:text-white hover:border-[#ff6b00] transition-all cursor-pointer font-extrabold uppercase tracking-wider shrink-0"
          >
            <FolderOpen size={11} className="text-[#ff6b00]" />
            Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#121218] border border-[#222234] rounded-md font-mono text-[8.5px] text-[#9999b5] hover:text-white hover:border-[#00d4ff] transition-all cursor-pointer font-extrabold uppercase tracking-wider shrink-0"
          >
            <Upload size={11} className="text-[#00d4ff]" />
            Files
          </button>
        </div>

        {/* Right: Close/Minimize button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="library-close-btn"
            onClick={onClose}
            className="p-1 text-[#777790] hover:text-white transition-colors cursor-pointer rounded hover:bg-white/5"
            title="Minimize Library"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Table grid headers / Sort buttons */}
      <div className="grid grid-cols-12 gap-2 items-center font-mono text-[8px] font-extrabold text-[#777795] tracking-wider pb-1 border-b border-[#1c1c28] uppercase shrink-0 px-3 select-none">
        <div className="col-span-1">#</div>
        <div
          onClick={() => setSort("title")}
          className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
        >
          TITLE {sortField === "title" && <ArrowUpDown size={8} />}
        </div>
        <div className="col-span-3">ARTIST</div>
        <div
          onClick={() => setSort("bpm")}
          className="col-span-1 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-white transition-colors"
        >
          BPM {sortField === "bpm" && <ArrowUpDown size={8} />}
        </div>
        <div
          onClick={() => setSort("key")}
          className="col-span-1 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-white transition-colors"
        >
          KEY {sortField === "key" && <ArrowUpDown size={8} />}
        </div>
        <div className="col-span-1 text-center">TIME</div>
        <div className="col-span-1 text-right">LOAD</div>
      </div>

      {/* Drag & Drop Visual overlay state & Table Body */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden mt-0.5">
        {isDragging && (
          <div className="absolute inset-0 bg-[#0f0f16]/95 border-2 border-dashed border-[#ff6b00] rounded-md flex flex-col items-center justify-center gap-2 z-30 transition-all pointer-events-none">
            <Upload size={24} className="text-[#ff6b00] animate-bounce" />
            <span className="font-mono text-[10px] text-white tracking-widest uppercase">
              Drop audio files here to import into library
            </span>
          </div>
        )}

        {/* Scrollable track list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#181824] pr-1">
          {tracks.map((track, i) => (
            <div key={track.id} className="relative group">
              <LibraryRow track={track} index={i} />
              {/* Optional Delete Track button on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTrack(track.id);
                }}
                className="absolute right-20 top-2 opacity-0 group-hover:opacity-100 text-[#777790] hover:text-red-custom transition-all cursor-pointer p-1 rounded hover:bg-white/10 z-10"
                title="Delete Track"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {tracks.length === 0 && (
            <div className="py-8 text-center text-[#777790] font-mono text-[10px]">
              {searchQuery ? `No tracks found matching "${searchQuery}"` : "Library is empty. Drag & drop files or click import buttons above."}
            </div>
          )}
        </div>
      </div>

      {/* Importing Progress Overlay */}
      {importStatus.active && (
        <div className="absolute inset-0 bg-[#06060a]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 animate-fade-in">
          <Loader2 size={28} className="text-[#ff6b00] animate-spin mb-3" />
          <span className="font-mono text-[11px] font-black text-white uppercase tracking-widest mb-1">
            Analyzing Audio
          </span>
          <span className="font-mono text-[9px] text-[#8888a8] uppercase tracking-wider mb-3">
            Processing Track {importStatus.current} of {importStatus.total}
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
