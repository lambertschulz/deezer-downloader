import type { LibraryTrack } from "./library-types";

// ---- Messages TO the worker ----

export type ScanWorkerRequest =
  | {
      type: "start-scan";
      dirHandle: FileSystemDirectoryHandle;
      existingIndex: [string, number][]; // [path, lastModified][] — Map can't be cloned
    }
  | { type: "abort" };

// ---- Messages FROM the worker ----

export type ScanWorkerResponse =
  | {
      type: "progress";
      scanned: number;
      total: number;
      skipped: number;
      currentFile: string;
    }
  | { type: "batch"; tracks: LibraryTrack[] }
  | { type: "removed"; paths: string[] }
  | {
      type: "complete";
      totalScanned: number;
      totalIndexed: number;
      totalSkipped: number;
      totalRemoved: number;
      durationMs: number;
    }
  | { type: "error"; message: string };
