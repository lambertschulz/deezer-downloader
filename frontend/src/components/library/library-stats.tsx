import { useMemo } from "react";
import { Music, Disc3, User, Clock } from "lucide-react";
import type { LibraryTrack } from "@/lib/library-types";

export function LibraryStats({ tracks }: { tracks: LibraryTrack[] }) {
  const stats = useMemo(() => {
    const artists = new Set(tracks.map((t) => t.artist));
    const albums = new Set(
      tracks.map((t) => `${t.albumArtist}||${t.album}`),
    );
    const totalDuration = tracks.reduce(
      (sum, t) => sum + (t.duration ?? 0),
      0,
    );
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);

    return {
      trackCount: tracks.length,
      artistCount: artists.size,
      albumCount: albums.size,
      durationLabel: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    };
  }, [tracks]);

  return (
    <div className="flex gap-6 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Music className="h-4 w-4" />{" "}
        {stats.trackCount.toLocaleString()} tracks
      </span>
      <span className="flex items-center gap-1.5">
        <User className="h-4 w-4" />{" "}
        {stats.artistCount.toLocaleString()} artists
      </span>
      <span className="flex items-center gap-1.5">
        <Disc3 className="h-4 w-4" />{" "}
        {stats.albumCount.toLocaleString()} albums
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="h-4 w-4" /> {stats.durationLabel}
      </span>
    </div>
  );
}
