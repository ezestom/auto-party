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
      id="library-drawer"
      style={{
        boxShadow: isOpen ? "-10px 0 30px rgba(0,0,0,0.7)" : "none",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`fixed top-0 right-0 bottom-0 h-full w-95 bg-[#0a0a0c]/98 border-l border-border-custom z-40 transition-transform duration-300 ease-in-out transform ${
        isOpen ? "translate-x-0" : "translate-x-full"
      } flex flex-col p-4 backdrop-blur-2xl select-none`}
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

      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border-custom mb-3">
        <div className="flex items-center gap-2">
          <ListFilter size={13} className="text-orange" />
          <span className="font-mono text-[9px] font-bold tracking-widest text-white uppercase">
            Music Library
          </span>
        </div>

        {/* Close Button */}
        <button
          id="library-close-btn"
          onClick={onClose}
          className="text-text-muted hover:text-white transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Import Controls */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={handleDirectoryScan}
          className="flex items-center justify-center gap-1.5 py-1.5 bg-[#121216] border border-[#252535] rounded font-mono text-[8px] text-text-dim hover:text-white hover:border-orange hover:bg-orange/5 transition-all cursor-pointer font-bold uppercase tracking-wider"
        >
          <FolderOpen size={10} className="text-orange" />
          Import Folder
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-1.5 bg-[#121216] border border-[#252535] rounded font-mono text-[8px] text-text-dim hover:text-white hover:border-cyan hover:bg-cyan/5 transition-all cursor-pointer font-bold uppercase tracking-wider"
        >
          <Upload size={10} className="text-cyan-custom" />
          Import Files
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative flex items-center mb-3">
        <Search size={12} className="absolute left-2.5 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search track, artist..."
          className="w-full pl-7 pr-3 py-1.5 bg-[#121216] border border-border-custom rounded font-mono text-[10px] text-white outline-none focus:border-orange transition-colors"
        />
      </div>

      {/* Table grid headers / Sort buttons */}
      <div className="flex items-center justify-between font-mono text-[7.5px] text-text-muted tracking-wider pb-1 border-b border-[#202028] uppercase mb-1">
        <div
          onClick={() => setSort("title")}
          className="flex items-center gap-0.5 cursor-pointer hover:text-white transition-colors"
        >
          Track Title {sortField === "title" && <ArrowUpDown size={7} />}
        </div>
        <div className="flex gap-3">
          <div
            onClick={() => setSort("key")}
            className="flex items-center gap-0.5 cursor-pointer hover:text-white transition-colors"
          >
            Key {sortField === "key" && <ArrowUpDown size={7} />}
          </div>
          <div
            onClick={() => setSort("bpm")}
            className="flex items-center gap-0.5 cursor-pointer hover:text-white transition-colors"
          >
            BPM {sortField === "bpm" && <ArrowUpDown size={7} />}
          </div>
        </div>
      </div>

      {/* Drag & Drop Visual overlay state */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        {isDragging && (
          <div className="absolute inset-0 bg-[#0f0f16]/90 border-2 border-dashed border-orange rounded-md flex flex-col items-center justify-center gap-2 z-30 transition-all pointer-events-none">
            <Upload size={24} className="text-orange animate-bounce" />
            <span className="font-mono text-[10px] text-white tracking-widest uppercase">
              Drop audio files here
            </span>
          </div>
        )}

        {/* Scrollable track list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e26] pr-1">
          {tracks.map((track) => (
            <div key={track.id} className="relative group">
              <LibraryRow track={track} />
              {/* Optional Delete Track button on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTrack(track.id);
                }}
                className="absolute right-28 top-3.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red transition-all cursor-pointer p-0.5 rounded hover:bg-white/5"
                title="Delete Track"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {tracks.length === 0 && (
            <div className="py-12 text-center text-text-muted font-mono text-[10px]">
              {searchQuery ? `No tracks found matching "${searchQuery}"` : "Library is empty. Drag & drop files or click import buttons above."}
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="pt-3 border-t border-border-custom mt-auto flex flex-col gap-1 text-text-muted font-mono text-[7.5px] leading-tight">
        <div className="flex justify-between">
          <span>{tracks.length} tracks registered</span>
          <span>Click headers to sort</span>
        </div>
        <div className="text-center text-[7px] text-[#ff6b00]/80 mt-1 uppercase tracking-wider">
          One-click orange/cyan buttons load to decks
        </div>
      </div>

      {/* Importing Progress Overlay */}
      {importStatus.active && (
        <div className="absolute inset-0 bg-[#06060a]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 animate-fade-in">
          <Loader2 size={32} className="text-orange animate-spin mb-4" />
          <span className="font-mono text-[11px] font-black text-white uppercase tracking-widest mb-1.5">
            Analyzing Audio
          </span>
          <span className="font-mono text-[9px] text-[#8888a8] uppercase tracking-wider mb-4">
            Processing Track {importStatus.current} of {importStatus.total}
          </span>
          <div className="w-full bg-[#1c1c28] h-1.5 rounded-full overflow-hidden max-w-50 mb-3 border border-white/5">
            <div
              className="bg-orange h-full rounded-full transition-all duration-200"
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
