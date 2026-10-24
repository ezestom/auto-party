/** Windows can return an empty or generic MIME type for local media. */
export function mediaKind(file: Pick<File, "name" | "type">): "audio" | "video" | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.type.startsWith("video/") || ["mp4", "webm", "mov", "mkv", "m4v", "avi", "ogv"].includes(extension ?? "")) return "video";
  if (file.type.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "aif", "aiff", "weba"].includes(extension ?? "")) return "audio";
  return null;
}
