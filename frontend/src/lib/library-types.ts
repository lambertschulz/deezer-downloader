export interface LibraryTrack {
  /** Relative file path from library root (used as unique key) */
  path: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  genre: string;
  duration: number | null;
  fileSize: number;
  format: string;
  lastModified: number;
  indexedAt: number;
  /** BPM detected via audio analysis */
  bpm: number | null;
  /** SHA-256 hash of decoded audio content (for duplicate detection) */
  audioHash: string | null;
  /** Timestamp when metadata was last enriched from external sources */
  enrichedAt: number | null;
}

export interface LibraryScanState {
  id: "state";
  scanning: boolean;
  lastScanAt: number | null;
  totalFiles: number;
  totalIndexed: number;
  lastScanDuration: number | null;
}

export interface ScanProgress {
  status: "idle" | "scanning" | "complete" | "error";
  scanned: number;
  total: number;
  skipped: number;
  currentFile: string;
  message?: string;
}

export type LibraryFilter =
  | { type: "album"; album: string; albumArtist: string; label: string }
  | { type: "artist"; name: string; label: string }
  | { type: "song"; path: string; label: string };

// ---- Duplicate Detection ----

export interface DuplicateGroup {
  /** Grouping key (normalized artist+title or audioHash) */
  key: string;
  matchType: "metadata" | "audio-hash";
  tracks: LibraryTrack[];
}

// ---- Metadata Enrichment ----

export interface EnrichmentProgress {
  status: "idle" | "running" | "cancelling" | "complete" | "error" | "cancelled";
  processed: number;
  total: number;
  currentTrack: string;
  updated: number;
  skipped: number;
  failed: number;
  message?: string;
}

export interface EnrichmentOptions {
  genre: boolean;
  year: boolean;
  writeToFiles: boolean;
}

// ---- Audio Hashing ----

export interface HashingProgress {
  status: "idle" | "running" | "complete" | "error" | "cancelled";
  processed: number;
  total: number;
  currentTrack: string;
}

export type LibrarySubTab = "browse" | "enrich" | "duplicates";
