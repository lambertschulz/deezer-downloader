import type { DuplicateGroup, LibraryTrack } from "./library-types";

/**
 * Normalize a string for duplicate comparison:
 * lowercase, trim, strip parenthetical suffixes like "(feat. ...)",
 * "(Deluxe)", "(Remaster)", etc.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s*\((?:feat\.?|ft\.?|featuring)[^)]*\)/gi, "")
    .replace(/\s*\((?:deluxe|remaster(?:ed)?|bonus|extended|anniversary|special)[^)]*\)/gi, "")
    .replace(/\s*\[(?:feat\.?|ft\.?|featuring)[^\]]*\]/gi, "")
    .replace(/\s*\[(?:deluxe|remaster(?:ed)?|bonus|extended|anniversary|special)[^\]]*\]/gi, "")
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find duplicate tracks by normalized artist + title metadata.
 */
export function findMetadataDuplicates(
  tracks: LibraryTrack[],
): DuplicateGroup[] {
  const groups = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    const key = `${normalize(track.artist)}|||${normalize(track.title)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(track);
    } else {
      groups.set(key, [track]);
    }
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [key, groupTracks] of groups) {
    if (groupTracks.length >= 2) {
      // Sort by quality score (best first)
      const sorted = [...groupTracks].sort(
        (a, b) => scoreTrack(b) - scoreTrack(a),
      );
      duplicates.push({
        key,
        matchType: "metadata",
        tracks: sorted,
      });
    }
  }

  // Sort groups by number of duplicates (most first)
  return duplicates.sort((a, b) => b.tracks.length - a.tracks.length);
}

/**
 * Find duplicate tracks by audio content hash.
 * Only considers tracks that have a computed audioHash.
 */
export function findAudioHashDuplicates(
  tracks: LibraryTrack[],
): DuplicateGroup[] {
  const groups = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    if (!track.audioHash) continue;
    const existing = groups.get(track.audioHash);
    if (existing) {
      existing.push(track);
    } else {
      groups.set(track.audioHash, [track]);
    }
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [key, groupTracks] of groups) {
    if (groupTracks.length >= 2) {
      const sorted = [...groupTracks].sort(
        (a, b) => scoreTrack(b) - scoreTrack(a),
      );
      duplicates.push({
        key,
        matchType: "audio-hash",
        tracks: sorted,
      });
    }
  }

  return duplicates.sort((a, b) => b.tracks.length - a.tracks.length);
}

/**
 * Score a track for quality ranking within a duplicate group.
 * Higher score = likely the "better" copy to keep.
 */
function scoreTrack(track: LibraryTrack): number {
  let score = 0;

  // Prefer tracks with more complete metadata
  if (track.genre) score += 2;
  if (track.year !== null) score += 2;
  if (track.bpm !== null) score += 1;
  if (track.trackNumber !== null) score += 1;
  if (track.albumArtist && track.albumArtist !== "Unknown Artist") score += 1;

  // Prefer lossless formats
  if (track.format === "flac") score += 5;
  else if (track.format === "wav") score += 4;
  else if (track.format === "m4a") score += 2;
  else if (track.format === "mp3") score += 1;

  // Prefer larger files (higher bitrate)
  score += Math.log10(track.fileSize) * 0.5;

  return score;
}

/** Format file size for display. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
