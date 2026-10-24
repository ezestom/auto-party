"use client";

import { useState, useRef } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { useVJStore } from "../../stores/vjStore";
import LibraryRow from "./LibraryRow";
import VJLibraryRow from "./VJLibraryRow";
import ThemeTabs from './ThemeTabs';
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { Search, ListFilter, ArrowUpDown, Upload, Loader2, Film } from "lucide-react";

import { mediaKind } from "../../lib/library/mediaFiles";

export default function LibraryPanel() {
  const {
    tracks: filteredTracks,
    searchQuery,
    sortField,
    importStatus,
    reanalyzeBpm,
    analysisMessage,
    setSearchQuery,
    setSort,
  } = useLibraryStore();
  const {blocks,browsingId}=usePartyBlockStore();
  const theme=blocks.find(block=>block.id===browsingId);
  const tracks=theme?filteredTracks.filter(track=>theme.trackIds.includes(track.id)):filteredTracks;

  const { videos, activeVideo, importVideo } = useVJStore();

  const [isDragging, setIsDragging] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState<"music" | "vj">("music");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFilesQueue = async (files: File[]) => {
    const destination=usePartyBlockStore.getState().browsingId;
    const media = files.map(file => ({ file, kind: mediaKind(file) })).filter(item => item.kind !== null);
    const skipped = files.length - media.length;
    const { importTrack, setImportStatus } = useLibraryStore.getState();
    const failures: string[] = [];
    let songs = 0, videos = 0;
    setImportMessage("");
    if (!media.length) {
      setImportMessage(files.length ? "No supported audio or video files were selected." : "No files were selected.");
      return;
    }
    setImportStatus({ active: true, current: 0, total: media.length, filename: "" });
    try {
      for (const [index, { file, kind }] of media.entries()) {
        setImportStatus({ current: index + 1, filename: file.name });
        try {
          if (kind === "video") { await importVideo(file); videos++; }
          else { const track=await importTrack(file); usePartyBlockStore.getState().addTracks(destination,[track.id]); songs++; }
        } catch {
          failures.push(file.name);
        }
      }
    } finally {
      setImportStatus({ active: false, current: 0, total: 0, filename: "" });
    }
    setImportMessage(`Imported: ${songs} audio files and ${videos} videos.${skipped ? ` Skipped: ${skipped} non-media files.` : ""}${failures.length ? ` Could not import: ${failures.join(", ")}. The file may be damaged, use an unsupported codec, or be unavailable locally.` : ""}`);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const files = Array.from(fileList);
    e.target.value = "";
    await processFilesQueue(files);
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
      className="relative w-full h-full bg-[#08080d] border-t border-[#1e1e30] z-20 flex flex-col px-4 py-2 select-none min-h-0 overflow-hidden"
    >
      {/* Hidden inputs */}
        <>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="audio/*,video/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </>

      {/* MOBILE TAB TOGGLE (< lg screens) */}
      <div className="library-media-tabs flex items-center justify-between gap-1 pb-1 mb-1 border-b border-[#1e1e2c] shrink-0">
        <div className="flex lg:hidden items-center gap-1.5">
          <button
            onClick={() => setActiveMobileTab("music")}
            aria-pressed={activeMobileTab === "music"}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-[9px] font-black uppercase transition-all cursor-pointer ${
              activeMobileTab === "music"
                ? "bg-[#ff6b00]25 text-[#ff6b00] border border-[#ff6b00] shadow-[0_0_8px_rgba(255,107,0,0.3)]"
                : "text-[#8888a8] border border-[#222234] hover:text-white bg-[#121218]"
            }`}
          >
            <ListFilter size={11} className={activeMobileTab === "music" ? "text-[#ff6b00]" : "text-[#777790]"} />
            <span>MUSIC ({tracks.length})</span>
          </button>
          <button
            onClick={() => setActiveMobileTab("vj")}
            aria-pressed={activeMobileTab === "vj"}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-[9px] font-black uppercase transition-all cursor-pointer ${
              activeMobileTab === "vj"
                ? "bg-[#00d4ff]25 text-[#00d4ff] border border-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.3)]"
                : "text-[#8888a8] border border-[#222234] hover:text-white bg-[#121218]"
            }`}
          >
            <Film size={11} className={activeMobileTab === "vj" ? "text-[#00d4ff]" : "text-[#777790]"} />
            <span>VJ VIDEO ({videos.length})</span>
          </button>
        </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[8px] text-[#9999b5] hover:text-white hover:border-[#00d4ff] transition-all cursor-pointer font-extrabold uppercase shrink-0"
              >
                <Upload size={10} className="text-[#00d4ff]" />
                Import files
              </button>
      </div>

      {/* RESPONSIVE GRID CONTAINER: 1-Column on Mobile, 50/50 Split on Desktop (lg+) */}
      <div className="library-grid grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: MUSIC LIBRARY (Full width on mobile when active, 6 cols on lg) */}
        <div className={`${activeMobileTab === "music" ? "flex" : "hidden"} lg:flex col-span-12 lg:col-span-6 flex-col h-full min-h-0 lg:border-r border-[#1e1e2c] lg:pr-3 overflow-hidden`}>
          <ThemeTabs />
          {/* Header bar / Toolbar */}
          <div className="library-toolbar flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e2c] mb-1 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <ListFilter size={13} className="text-[#ff6b00]" />
              <span className="font-mono text-[10px] font-black tracking-widest text-white uppercase">
                MUSIC LIBRARY
              </span>
              <span className="font-mono text-[8.5px] px-1.5 py-0.2 rounded-full bg-[#161622] border border-[#252538] text-[#8888a8]">
                {tracks.length}
              </span>
            </div>

            <div className="library-tools flex items-center gap-1.5 flex-1 max-w-xs justify-end">
              <div className="relative flex-1 min-w-[80px] max-w-[160px] flex items-center">
                <Search size={11} className="absolute left-2 text-[#777790] pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search music"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search music..."
                  className="w-full pl-6 pr-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[9px] text-white outline-none focus:border-[#ff6b00]"
                />
              </div>
              <button
                onClick={reanalyzeBpm}
                disabled={importStatus.active || !tracks.length}
                title="Reanalyze library BPM"
                aria-label="Reanalyze BPM"
                className="px-2 py-0.5 bg-[#121218] border border-[#222234] rounded font-mono text-[8px] text-[#9999b5] disabled:opacity-40 cursor-pointer shrink-0"
              >BPM</button>

            </div>
          </div>

          {analysisMessage && <p role="status" aria-label="BPM analysis" className="text-[10px] text-[#aaaabd] px-2 py-1">{analysisMessage}</p>}
          <div className="library-table-scroll" id="theme-song-list" role="tabpanel" aria-labelledby={'theme-tab-'+(browsingId||'all')}>
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
          <div className="library-track-list flex-1 overflow-y-auto divide-y divide-[#181824] pr-1 mt-0.5">
            {tracks.map((track, i) => (
              <LibraryRow key={track.id} track={track} index={i} />
            ))}
            {tracks.length === 0 && (
              <div className="py-6 text-center text-[#777790] font-mono text-[9px]">
                {searchQuery ? `No tracks matching "${searchQuery}"` : theme ? 'No songs in this theme. Import files or use Edit theme to add music.' : "Music library empty."}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VJ VIDEO LIBRARY (Full width on mobile when active, 6 cols on lg) */}
        <div className={`${activeMobileTab === "vj" ? "flex" : "hidden"} lg:flex col-span-12 lg:col-span-6 flex-col h-full min-h-0 lg:pl-1 overflow-hidden`}>
          {/* VJ Header bar */}
          <div className="library-toolbar flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e2c] mb-1 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <Film size={13} className="text-[#00d4ff]" />
              <span className="font-mono text-[10px] font-black tracking-widest text-white uppercase">
                VJ VIDEO LIBRARY
              </span>
              <span className="font-mono text-[8.5px] px-1.5 py-0.2 rounded-full bg-[#161622] border border-[#252538] text-[#8888a8]">
                {videos.length} loops
              </span>
            </div>


          </div>

          {/* Active VJ Video Preview Banner & Controls */}
          <div className="library-vj-preview flex items-center justify-between p-1.5 mb-1 bg-[#0c0c14] border border-[#222238] rounded-lg shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">

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
                  VIDEO LOOP
                </span>
              </div>


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
      {importMessage && <p role="status" aria-label="Import results" className="shrink-0 max-h-16 overflow-y-auto py-1 text-[10px] text-[#bcbcd0] select-text">{importMessage}</p>}
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

