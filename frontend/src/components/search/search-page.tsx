import { useRef, useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useSearch } from "@/hooks/use-search";
import { useDownload } from "@/hooks/use-download";
import { useAudioPreview } from "@/hooks/use-audio-preview";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  searchResultsAtom,
  downloadedMapAtom,
  downloadStatusMapAtom,
  hideDownloadedAtom,
  drillArtistNameAtom,
} from "@/atoms/app";
import { SearchBar, type SearchBarHandle } from "./search-bar";
import { SearchTypeFilter } from "./search-type-filter";
import { PaginationControls } from "./pagination-controls";
import { SearchResultRow } from "./search-result-row";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function SearchPage() {
  const searchBarRef = useRef<SearchBarHandle>(null);

  const {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    internalType,
    doSearch,
    goToPage,
    drillIntoArtistAlbums,
    drillIntoArtistTop,
    drillIntoAlbumTracks,
    isSearching,
    currentPage,
    totalPages,
  } = useSearch();

  const { download } = useDownload();
  const { previewUrl, play: playPreview } = useAudioPreview();

  const results = useAtomValue(searchResultsAtom);
  const downloadedMap = useAtomValue(downloadedMapAtom);
  const downloadStatusMap = useAtomValue(downloadStatusMapAtom);
  const [hideDownloaded, setHideDownloaded] = useAtom(hideDownloadedAtom);
  const drillArtistName = useAtomValue(drillArtistNameAtom);

  const handleSearch = useCallback(() => {
    doSearch();
  }, [doSearch]);

  useKeyboardShortcuts({
    onSearch: handleSearch,
    onFocusSearch: () => searchBarRef.current?.focus(),
  });

  const handleDownload = useCallback(
    (
      musicId: string,
      type: "track" | "album",
      addToPlaylist: boolean,
      createZip: boolean,
    ) => {
      const item = results.find((r) => r.id === musicId);
      download({
        type,
        music_id: parseInt(musicId, 10),
        add_to_playlist: addToPlaylist,
        create_zip: createZip,
        artist: item?.artist ?? "",
        title: type === "track" ? (item?.title ?? "") : (item?.album ?? ""),
      });
    },
    [results, download],
  );

  const handleDownloadAll = useCallback(() => {
    const missing = results.filter(
      (r) =>
        (r.id_type === "track" || r.id_type === "album") &&
        !downloadedMap[r.id],
    );
    if (missing.length === 0) {
      toast.info("All items already downloaded");
      return;
    }
    for (const item of missing) {
      download({
        type: item.id_type as "track" | "album",
        music_id: parseInt(item.id, 10),
        add_to_playlist: false,
        create_zip: false,
        artist: item.artist,
        title: item.id_type === "track" ? item.title : item.album,
      });
    }
    toast.success(`${missing.length} download(s) queued`);
  }, [results, downloadedMap, download]);

  const isDrillDown =
    internalType === "artist_album" ||
    internalType === "artist_top" ||
    internalType === "album_track";

  const showDownloadAll =
    results.length > 0 && internalType !== "artist";

  return (
    <div className="p-4 flex flex-col gap-3">
      <SearchBar
        ref={searchBarRef}
        value={searchQuery}
        onChange={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SearchTypeFilter
          value={searchType as "track" | "album" | "artist"}
          onChange={(type) => {
            setSearchType(type);
            if (searchQuery.trim()) doSearch(type);
          }}
        />
        <Toggle
          pressed={hideDownloaded}
          onPressedChange={setHideDownloaded}
          size="sm"
          className="gap-1.5"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Hide Downloaded
        </Toggle>
      </div>

      {/* Breadcrumb for drill-down */}
      {isDrillDown && (
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7"
            onClick={() => doSearch()}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to search
          </Button>
          {drillArtistName && (
            <span className="text-muted-foreground">
              {drillArtistName} &mdash;{" "}
              {internalType === "artist_album"
                ? "Albums"
                : internalType === "artist_top"
                  ? "Top Tracks"
                  : "Tracks"}
            </span>
          )}
        </div>
      )}

      {/* Pagination + Download All */}
      {results.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onGoToPage={goToPage}
          />
          {showDownloadAll && (
            <Button variant="outline" size="sm" onClick={handleDownloadAll}>
              <Download className="h-4 w-4 mr-1.5" />
              Download All
            </Button>
          )}
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Artist</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Album</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item) => (
              <SearchResultRow
                key={`${item.id_type}-${item.id}`}
                item={item}
                isDownloaded={!!downloadedMap[item.id]}
                downloadStatus={downloadStatusMap[item.id]}
                hidden={hideDownloaded && !!downloadedMap[item.id]}
                onPreview={playPreview}
                onDownload={handleDownload}
                onDrillAlbumTracks={drillIntoAlbumTracks}
                onDrillArtistAlbums={drillIntoArtistAlbums}
                onDrillArtistTop={drillIntoArtistTop}
                isPreviewPlaying={previewUrl === item.preview_url}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Bottom pagination */}
      {results.length > 0 && totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onGoToPage={goToPage}
          />
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !isSearching && (
        <div className="text-center text-muted-foreground py-12">
          Search for tracks, albums, or artists to get started.
        </div>
      )}
    </div>
  );
}
