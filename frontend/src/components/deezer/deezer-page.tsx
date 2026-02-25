import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  downloadDeezerPlaylist,
  downloadDeezerFavorites,
} from "@/api/download";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getConfig } from "@/config";
import { toast } from "sonner";
import { Download, Archive, ListMusic, Heart } from "lucide-react";

export function DeezerPage() {
  const { useMpd } = getConfig();

  // Playlist state
  const [playlistUrl, setPlaylistUrl] = useState("");

  // Favorites state
  const [userId, setUserId] = useState("");

  const playlistMutation = useMutation({
    mutationFn: downloadDeezerPlaylist,
    onSuccess: () => toast.success("Playlist download started"),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const favoritesMutation = useMutation({
    mutationFn: downloadDeezerFavorites,
    onSuccess: () => toast.success("Favorites download started"),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <div className="p-4 flex flex-col gap-8 max-w-xl">
      {/* Deezer Playlists */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ListMusic className="h-5 w-5" />
          Deezer Playlist
        </h2>
        <Input
          placeholder="Playlist URL or ID"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
        />
        <div className="flex gap-2">
          {useMpd && (
            <Button
              variant="outline"
              size="sm"
              disabled={!playlistUrl.trim()}
              onClick={() =>
                playlistMutation.mutate({
                  playlist_url: playlistUrl,
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
            disabled={!playlistUrl.trim()}
            onClick={() =>
              playlistMutation.mutate({
                playlist_url: playlistUrl,
                add_to_playlist: false,
                create_zip: false,
              })
            }
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!playlistUrl.trim()}
            onClick={() =>
              playlistMutation.mutate({
                playlist_url: playlistUrl,
                add_to_playlist: false,
                create_zip: true,
              })
            }
          >
            <Archive className="h-4 w-4 mr-1.5" />
            ZIP
          </Button>
        </div>
      </section>

      {/* Deezer Favorites */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Deezer Favorites
        </h2>
        <Input
          placeholder="Deezer User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <div className="flex gap-2">
          {useMpd && (
            <Button
              variant="outline"
              size="sm"
              disabled={!userId.trim()}
              onClick={() =>
                favoritesMutation.mutate({
                  user_id: userId,
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
            disabled={!userId.trim()}
            onClick={() =>
              favoritesMutation.mutate({
                user_id: userId,
                add_to_playlist: false,
                create_zip: false,
              })
            }
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!userId.trim()}
            onClick={() =>
              favoritesMutation.mutate({
                user_id: userId,
                add_to_playlist: false,
                create_zip: true,
              })
            }
          >
            <Archive className="h-4 w-4 mr-1.5" />
            ZIP
          </Button>
        </div>
      </section>
    </div>
  );
}
