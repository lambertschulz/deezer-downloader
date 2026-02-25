import { useMemo } from "react";
import { Music, Disc3, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryTrack } from "@/lib/library-types";
import type { LibraryFilter } from "@/lib/library-types";

// ---- Derived types ----

interface AlbumGroup {
  key: string;
  album: string;
  albumArtist: string;
  trackCount: number;
  totalDuration: number;
}

interface ArtistGroup {
  name: string;
  trackCount: number;
  albumCount: number;
}

// ---- Helpers ----

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function groupAlbums(tracks: LibraryTrack[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const t of tracks) {
    const key = `${t.albumArtist}||${t.album}`;
    const existing = map.get(key);
    if (existing) {
      existing.trackCount++;
      existing.totalDuration += t.duration ?? 0;
    } else {
      map.set(key, {
        key,
        album: t.album,
        albumArtist: t.albumArtist,
        trackCount: 1,
        totalDuration: t.duration ?? 0,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.album.localeCompare(b.album));
}

function groupArtists(tracks: LibraryTrack[]): ArtistGroup[] {
  const map = new Map<string, { tracks: number; albums: Set<string> }>();
  for (const t of tracks) {
    const existing = map.get(t.artist);
    if (existing) {
      existing.tracks++;
      existing.albums.add(`${t.albumArtist}||${t.album}`);
    } else {
      map.set(t.artist, {
        tracks: 1,
        albums: new Set([`${t.albumArtist}||${t.album}`]),
      });
    }
  }
  return [...map.entries()]
    .map(([name, data]) => ({
      name,
      trackCount: data.tracks,
      albumCount: data.albums.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isFilterActive(filters: LibraryFilter[], check: LibraryFilter): boolean {
  return filters.some((f) => {
    if (f.type !== check.type) return false;
    switch (f.type) {
      case "album":
        return (
          check.type === "album" &&
          f.album === check.album &&
          f.albumArtist === check.albumArtist
        );
      case "artist":
        return check.type === "artist" && f.name === check.name;
      case "song":
        return check.type === "song" && f.path === check.path;
    }
  });
}

// ---- Section header ----

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Music;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{label}</h3>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

// ---- Songs section ----

function SongsSection({
  tracks,
  filters,
  onToggleFilter,
}: {
  tracks: LibraryTrack[];
  filters: LibraryFilter[];
  onToggleFilter: (f: LibraryFilter) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <SectionHeader icon={Music} label="Songs" count={tracks.length} />
      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[60vh]">
        {tracks.map((track) => {
          const filter: LibraryFilter = {
            type: "song",
            path: track.path,
            label: track.title,
          };
          const active = isFilterActive(filters, filter);
          return (
            <button
              key={track.path}
              onClick={() => onToggleFilter(filter)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-sm text-left",
                active
                  ? "bg-primary/15 ring-1 ring-primary/30"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{track.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {track.artist}
                  {track.album !== "Unknown Album" && ` — ${track.album}`}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDuration(track.duration)}
              </span>
            </button>
          );
        })}
        {tracks.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No songs found
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Albums section ----

function AlbumsSection({
  tracks,
  filters,
  onToggleFilter,
}: {
  tracks: LibraryTrack[];
  filters: LibraryFilter[];
  onToggleFilter: (f: LibraryFilter) => void;
}) {
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);

  return (
    <div className="flex flex-col min-w-0">
      <SectionHeader icon={Disc3} label="Albums" count={albums.length} />
      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[60vh]">
        {albums.map((album) => {
          const filter: LibraryFilter = {
            type: "album",
            album: album.album,
            albumArtist: album.albumArtist,
            label: album.album,
          };
          const active = isFilterActive(filters, filter);
          return (
            <button
              key={album.key}
              onClick={() => onToggleFilter(filter)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-sm text-left",
                active
                  ? "bg-primary/15 ring-1 ring-primary/30"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{album.album}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {album.albumArtist}
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-xs text-muted-foreground">
                  {album.trackCount} tracks
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTotalDuration(album.totalDuration)}
                </div>
              </div>
            </button>
          );
        })}
        {albums.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No albums found
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Artists section ----

function ArtistsSection({
  tracks,
  filters,
  onToggleFilter,
}: {
  tracks: LibraryTrack[];
  filters: LibraryFilter[];
  onToggleFilter: (f: LibraryFilter) => void;
}) {
  const artists = useMemo(() => groupArtists(tracks), [tracks]);

  return (
    <div className="flex flex-col min-w-0">
      <SectionHeader icon={User} label="Artists" count={artists.length} />
      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[60vh]">
        {artists.map((artist) => {
          const filter: LibraryFilter = {
            type: "artist",
            name: artist.name,
            label: artist.name,
          };
          const active = isFilterActive(filters, filter);
          return (
            <button
              key={artist.name}
              onClick={() => onToggleFilter(filter)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-sm text-left",
                active
                  ? "bg-primary/15 ring-1 ring-primary/30"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{artist.name}</div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-xs text-muted-foreground">
                  {artist.trackCount} tracks
                </div>
                <div className="text-xs text-muted-foreground">
                  {artist.albumCount}{" "}
                  {artist.albumCount === 1 ? "album" : "albums"}
                </div>
              </div>
            </button>
          );
        })}
        {artists.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No artists found
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Main export ----

interface LibraryResultsGridProps {
  tracks: LibraryTrack[];
  filters: LibraryFilter[];
  onToggleFilter: (f: LibraryFilter) => void;
}

export function LibraryResultsGrid({
  tracks,
  filters,
  onToggleFilter,
}: LibraryResultsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <SongsSection
        tracks={tracks}
        filters={filters}
        onToggleFilter={onToggleFilter}
      />
      <AlbumsSection
        tracks={tracks}
        filters={filters}
        onToggleFilter={onToggleFilter}
      />
      <ArtistsSection
        tracks={tracks}
        filters={filters}
        onToggleFilter={onToggleFilter}
      />
    </div>
  );
}
