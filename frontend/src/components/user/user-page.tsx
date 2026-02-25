import { useQuery, useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { fetchUserPlaylists } from "@/api/user";
import { downloadDeezerPlaylist } from "@/api/download";
import { userProfileAtom } from "@/atoms/app";
import { getConfig } from "@/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Archive, ListMusic, Music, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { UserPlaylist } from "@/api/types";

function PlaylistCard({ playlist }: { playlist: UserPlaylist }) {
  const { useMpd } = getConfig();

  const mutation = useMutation({
    mutationFn: downloadDeezerPlaylist,
    onSuccess: () =>
      toast.success(`Playlist "${playlist.title}" download started`),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      {playlist.picture_url ? (
        <img
          src={playlist.picture_url}
          alt={playlist.title}
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
          <ListMusic className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{playlist.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Music className="h-3 w-3" />
          <span>{playlist.nb_tracks} tracks</span>
          {playlist.is_loved_track && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              Favorites
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 shrink-0">
        {useMpd && (
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                playlist_url: playlist.id,
                add_to_playlist: true,
                create_zip: false,
              })
            }
          >
            Download & Play
          </Button>
        )}
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              playlist_url: playlist.id,
              add_to_playlist: false,
              create_zip: false,
            })
          }
        >
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              playlist_url: playlist.id,
              add_to_playlist: false,
              create_zip: true,
            })
          }
        >
          <Archive className="h-4 w-4 mr-1" />
          ZIP
        </Button>
      </div>
    </div>
  );
}

export function UserPage() {
  const user = useAtomValue(userProfileAtom);

  const {
    data: playlists,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["user", "playlists"],
    queryFn: fetchUserPlaylists,
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="p-4 text-center text-muted-foreground py-12">
        No user logged in. Set your Deezer ARL cookie first.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground">Loading playlists...</div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-destructive">
        Failed to load playlists.{" "}
        <Button variant="link" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center gap-3">
        {user.picture_url && (
          <img
            src={user.picture_url}
            alt={user.name}
            className="h-10 w-10 rounded-full"
          />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{user.name}'s Playlists</h2>
          <p className="text-xs text-muted-foreground">
            {playlists?.length ?? 0} playlists
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {playlists?.map((pl) => (
          <PlaylistCard key={pl.id} playlist={pl} />
        ))}
      </div>

      {playlists?.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No playlists found.
        </div>
      )}
    </div>
  );
}
