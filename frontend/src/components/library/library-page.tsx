import { useLibrary } from "@/hooks/use-library";
import { useAtomValue } from "jotai";
import { librarySearchResultsAtom, libraryTracksAtom } from "@/atoms/app";
import { LibrarySearchBar } from "./library-search-bar";
import { LibraryScanPanel } from "./library-scan-panel";
import { LibraryStats } from "./library-stats";
import { LibraryResultsGrid } from "./library-results-table";
import { LibraryUnsupported } from "./library-unsupported";

export function LibraryPage() {
  const {
    trackCount,
    isSupported,
    hasStoredHandle,
    searchQuery,
    search,
    scanProgress,
    startScan,
    abortScan,
    pickDirectory,
    disconnect,
  } = useLibrary();

  const searchResults = useAtomValue(librarySearchResultsAtom);
  const allTracks = useAtomValue(libraryTracksAtom);

  if (!isSupported) {
    return <LibraryUnsupported />;
  }

  const displayTracks = searchQuery.trim() ? searchResults : allTracks;
  const showEmptyPrompt =
    trackCount === 0 && scanProgress.status === "idle";

  return (
    <div className="p-4 flex flex-col gap-4">
      <LibraryScanPanel
        scanProgress={scanProgress}
        trackCount={trackCount}
        hasStoredHandle={hasStoredHandle}
        onStartScan={() => startScan(false)}
        onFullRescan={() => startScan(true)}
        onAbort={abortScan}
        onPickDirectory={pickDirectory}
        onDisconnect={disconnect}
      />

      {trackCount > 0 && <LibraryStats tracks={allTracks} />}

      {trackCount > 0 && (
        <LibrarySearchBar value={searchQuery} onChange={search} />
      )}

      {trackCount > 0 && <LibraryResultsGrid tracks={displayTracks} />}

      {showEmptyPrompt && (
        <div className="text-center text-muted-foreground py-12">
          No library indexed yet. Pick a folder to start scanning your music
          collection.
        </div>
      )}

      {searchQuery.trim() &&
        displayTracks.length === 0 &&
        trackCount > 0 && (
          <div className="text-center text-muted-foreground py-8">
            No matches found for &quot;{searchQuery}&quot;.
          </div>
        )}
    </div>
  );
}
