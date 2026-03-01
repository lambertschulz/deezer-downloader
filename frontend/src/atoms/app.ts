import { atom } from "jotai";
import type {
  DownloadStatus,
  SearchResult,
  SearchType,
  UserProfile,
} from "@/api/types";
import type {
  DuplicateGroup,
  EnrichmentProgress,
  HashingProgress,
  LibraryFilter,
  LibrarySubTab,
  LibraryTrack,
  ScanProgress,
} from "@/lib/library-types";

// --- Tabs ---
export type TabId = "search" | "deezer" | "debug" | "queue" | "user" | "library";
export const activeTabAtom = atom<TabId>("library");

// --- User ---
export const userProfileAtom = atom<UserProfile | null>(null);
export const showArlInputAtom = atom(false);

// --- Search ---
export const searchQueryAtom = atom("");
export const searchTypeAtom = atom<SearchType>("track");
export const hideDownloadedAtom = atom(false);

// Tracks the "internal" search type used for drill-down navigation
// e.g. artist → artist_album → album_track
export const internalSearchTypeAtom = atom<SearchType>("track");
export const searchIndexAtom = atom(0);
export const searchTotalAtom = atom(0);
// For breadcrumb: when drilling into an artist's albums or tracks
export const drillArtistNameAtom = atom<string | null>(null);

// --- Download Tracking ---
// Maps musicId → download status for inline row icons
export const downloadStatusMapAtom = atom<Record<string, DownloadStatus>>({});
// Maps taskId → musicId for correlating queue updates to search rows
export const trackedTasksAtom = atom<Record<string, string>>({});
// Maps musicId → boolean (already on disk)
export const downloadedMapAtom = atom<Record<string, boolean>>({});

// --- Audio Preview ---
export const previewUrlAtom = atom<string | null>(null);

// --- Derived: has active tasks ---
export const hasTrackedTasksAtom = atom(
  (get) => Object.keys(get(trackedTasksAtom)).length > 0,
);

// --- Helper to update a single entry in downloadStatusMap ---
export const setDownloadStatusAtom = atom(
  null,
  (get, set, update: { musicId: string; status: DownloadStatus }) => {
    const current = get(downloadStatusMapAtom);
    set(downloadStatusMapAtom, { ...current, [update.musicId]: update.status });
  },
);

// --- Helper to track a new task ---
export const trackTaskAtom = atom(
  null,
  (
    get,
    set,
    update: { taskId: string; musicId: string },
  ) => {
    const tasks = get(trackedTasksAtom);
    set(trackedTasksAtom, { ...tasks, [update.taskId]: update.musicId });
  },
);

// --- Helper to untrack a task ---
export const untrackTaskAtom = atom(null, (get, set, taskId: string) => {
  const tasks = { ...get(trackedTasksAtom) };
  delete tasks[taskId];
  set(trackedTasksAtom, tasks);
});

// --- Search results stored separately for TanStack Query cache bypass ---
export const searchResultsAtom = atom<SearchResult[]>([]);

// --- Library ---
export const libraryTracksAtom = atom<LibraryTrack[]>([]);
export const librarySearchQueryAtom = atom("");
export const librarySearchResultsAtom = atom<LibraryTrack[]>([]);
export const libraryIsLoadedAtom = atom(false);
export const libraryScanProgressAtom = atom<ScanProgress>({
  status: "idle",
  scanned: 0,
  total: 0,
  skipped: 0,
  currentFile: "",
});
export const libraryFiltersAtom = atom<LibraryFilter[]>([]);
export const librarySubTabAtom = atom<LibrarySubTab>("browse");
export const enrichmentProgressAtom = atom<EnrichmentProgress>({
  status: "idle",
  processed: 0,
  total: 0,
  currentTrack: "",
  updated: 0,
  skipped: 0,
  failed: 0,
});
export const bpmProgressAtom = atom<EnrichmentProgress>({
  status: "idle",
  processed: 0,
  total: 0,
  currentTrack: "",
  updated: 0,
  skipped: 0,
  failed: 0,
});
export const hashingProgressAtom = atom<HashingProgress>({
  status: "idle",
  processed: 0,
  total: 0,
  currentTrack: "",
});
export const duplicateGroupsAtom = atom<DuplicateGroup[]>([]);
