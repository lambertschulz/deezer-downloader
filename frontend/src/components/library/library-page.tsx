import { useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useLibrary } from "@/hooks/use-library";
import {
  librarySearchResultsAtom,
  librarySubTabAtom,
  libraryTracksAtom,
} from "@/atoms/app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibrarySearchBar } from "./library-search-bar";
import { LibraryScanPanel } from "./library-scan-panel";
import { LibraryStats } from "./library-stats";
import { LibraryResultsGrid } from "./library-results-table";
import { LibraryFilterBar } from "./library-filter-bar";
import { LibraryUnsupported } from "./library-unsupported";
import { LibraryEnrichPanel } from "./library-enrich-panel";
import { LibraryDuplicatesPage } from "./library-duplicates-page";
import type { LibrarySubTab } from "@/lib/library-types";

export function LibraryPage() {
  const {
    trackCount,
    isSupported,
    hasStoredHandle,
    searchQuery,
    search,
    filters,
    toggleFilter,
    removeFilter,
    clearFilters,
    applyFilters,
    scanProgress,
    startScan,
    abortScan,
    pickDirectory,
    disconnect,
  } = useLibrary();

  const searchResults = useAtomValue(librarySearchResultsAtom);
  const allTracks = useAtomValue(libraryTracksAtom);
  const [subTab, setSubTab] = useAtom(librarySubTabAtom);

  // 1) text search narrows the base set
  const searchedTracks = searchQuery.trim() ? searchResults : allTracks;
  // 2) filters narrow further
  const displayTracks = useMemo(
    () => applyFilters(searchedTracks, filters),
    [searchedTracks, filters, applyFilters],
  );

  if (!isSupported) {
    return <LibraryUnsupported />;
  }

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

      {trackCount > 0 && (
        <Tabs
          value={subTab}
          onValueChange={(v) => setSubTab(v as LibrarySubTab)}
        >
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="enrich">Enrich Metadata</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <div className="flex flex-col gap-4 pt-4">
              <LibraryStats tracks={allTracks} />

              <LibrarySearchBar value={searchQuery} onChange={search} />

              {filters.length > 0 && (
                <LibraryFilterBar
                  filters={filters}
                  onRemove={removeFilter}
                  onClear={clearFilters}
                />
              )}

              <LibraryResultsGrid
                tracks={displayTracks}
                filters={filters}
                onToggleFilter={toggleFilter}
              />

              {(searchQuery.trim() || filters.length > 0) &&
                displayTracks.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No matches found.
                  </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="enrich">
            <div className="pt-4">
              <LibraryEnrichPanel />
            </div>
          </TabsContent>

          <TabsContent value="duplicates">
            <div className="pt-4">
              <LibraryDuplicatesPage />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {showEmptyPrompt && (
        <div className="text-center text-muted-foreground py-12">
          No library indexed yet. Pick a folder to start scanning your music
          collection.
        </div>
      )}
    </div>
  );
}
