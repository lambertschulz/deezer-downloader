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
