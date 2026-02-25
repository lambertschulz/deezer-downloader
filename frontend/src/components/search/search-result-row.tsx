import { Button } from "@/components/ui/button";
import {
  Download,
  Headphones,
  ListMusic,
  Archive,
  Disc3,
  Star,
  Play,
  Loader2,
  Check,
  X,
  Clock,
} from "lucide-react";
import type { SearchResult, DownloadStatus } from "@/api/types";
import { getConfig } from "@/config";
import { cn } from "@/lib/utils";

interface SearchResultRowProps {
  item: SearchResult;
  isDownloaded: boolean;
  downloadStatus?: DownloadStatus;
  hidden: boolean;
  onPreview: (url: string) => void;
  onDownload: (musicId: string, type: "track" | "album", addToPlaylist: boolean, createZip: boolean, artist: string, title: string) => void;
  onDrillAlbumTracks: (albumId: string, albumName: string) => void;
  onDrillArtistAlbums: (artistId: string, artistName: string) => void;
  onDrillArtistTop: (artistId: string, artistName: string) => void;
  isPreviewPlaying: boolean;
}

function StatusIcon({ status }: { status?: DownloadStatus }) {
  switch (status) {
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "downloading":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "done":
      return <Check className="h-4 w-4 text-green-500" />;
    case "failed":
      return <X className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

export function SearchResultRow({
  item,
  isDownloaded,
  downloadStatus,
  hidden,
  onPreview,
  onDownload,
  onDrillAlbumTracks,
  onDrillArtistAlbums,
  onDrillArtistTop,
  isPreviewPlaying,
}: SearchResultRowProps) {
  const { useMpd } = getConfig();

  if (hidden) return null;

  const isArtist = item.id_type === "artist";
  const isAlbum = item.id_type === "album";
  const isTrack = item.id_type === "track";

  return (
    <tr
      className={cn(
        "border-b border-border hover:bg-muted/50 transition-colors",
        isDownloaded && "bg-green-50 dark:bg-green-950/20",
      )}
    >
      {/* Cover */}
      <td className="p-2 w-14">
        {item.img_url ? (
          <img
            src={item.img_url}
            alt=""
            className={cn(
              "w-10 h-10 object-cover",
              isArtist ? "rounded-full" : "rounded",
            )}
          />
        ) : (
          <div className="w-10 h-10 bg-muted rounded" />
        )}
      </td>

      {/* Artist */}
      <td className="p-2 text-sm font-medium">{item.artist}</td>

      {/* Title / Album */}
      <td className="p-2 text-sm text-muted-foreground">
        {isTrack && item.title}
        {isAlbum && item.album}
        {isArtist && ""}
      </td>

      {/* Album (for tracks) */}
      <td className="p-2 text-sm text-muted-foreground">
        {isTrack && item.album}
      </td>

      {/* Status + Actions */}
      <td className="p-2">
        <div className="flex items-center gap-1 justify-end">
          <StatusIcon status={downloadStatus ?? (isDownloaded ? "done" : undefined)} />

          {/* Track actions */}
          {isTrack && (
            <>
              {item.preview_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPreview(item.preview_url)}
                  title="Preview"
                >
                  {isPreviewPlaying ? (
                    <Headphones className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Headphones className="h-4 w-4" />
                  )}
                </Button>
              )}
              {useMpd && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownload(item.id, "track", true, false, item.artist, item.title)}
                  title="Download & Queue"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDownload(item.id, "track", false, false, item.artist, item.title)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Album actions */}
          {isAlbum && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onDrillAlbumTracks(String(item.album_id), item.album)
                }
                title="Show tracks"
              >
                <ListMusic className="h-4 w-4" />
              </Button>
              {useMpd && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownload(item.id, "album", true, false, item.artist, item.album)}
                  title="Download & Queue"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDownload(item.id, "album", false, false, item.artist, item.album)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDownload(item.id, "album", false, true, item.artist, item.album)}
                title="Download as ZIP"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Artist actions */}
          {isArtist && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  onDrillArtistTop(String(item.artist_id ?? item.id), item.artist)
                }
                title="Top tracks"
              >
                <Star className="h-4 w-4" />
                Top
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  onDrillArtistAlbums(String(item.artist_id ?? item.id), item.artist)
                }
                title="Albums"
              >
                <Disc3 className="h-4 w-4" />
                Albums
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
