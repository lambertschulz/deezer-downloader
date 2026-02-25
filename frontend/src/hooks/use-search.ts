import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMutation } from "@tanstack/react-query";
import { searchDeezer, normalizeSearchResponse } from "@/api/search";
import { checkDownloaded } from "@/api/check-downloaded";
import {
  searchQueryAtom,
  searchTypeAtom,
  internalSearchTypeAtom,
  searchIndexAtom,
  searchTotalAtom,
  searchResultsAtom,
  downloadedMapAtom,
  drillArtistNameAtom,
} from "@/atoms/app";
import type { SearchType, CheckDownloadedItem } from "@/api/types";

const PAGE_SIZE = 20;

export function useSearch() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [searchType, setSearchType] = useAtom(searchTypeAtom);
  const [internalType, setInternalType] = useAtom(internalSearchTypeAtom);
  const [searchIndex, setSearchIndex] = useAtom(searchIndexAtom);
  const setSearchTotal = useSetAtom(searchTotalAtom);
  const setSearchResults = useSetAtom(searchResultsAtom);
  const setDownloadedMap = useSetAtom(downloadedMapAtom);
  const setDrillArtistName = useSetAtom(drillArtistNameAtom);
  const searchTotal = useAtomValue(searchTotalAtom);

  const searchMutation = useMutation({
    mutationFn: async (params: {
      type: SearchType;
      query: string;
      index: number;
    }) => {
      const response = await searchDeezer(
        params.type,
        params.query,
        params.index,
      );
      const normalized = normalizeSearchResponse(response);
      return normalized;
    },
    onSuccess: async (data, variables) => {
      setSearchResults(data.data);
      setSearchTotal(data.total);
      setSearchIndex(variables.index);
      setInternalType(variables.type);

      // Check downloaded status for tracks and albums
      const items: CheckDownloadedItem[] = data.data
        .filter((r) => r.id_type === "track" || r.id_type === "album")
        .map((r) => ({
          type: r.id_type as "track" | "album",
          id: r.id,
          artist: r.artist,
          title: r.id_type === "track" ? r.title : r.album,
        }));

      if (items.length > 0) {
        const downloaded = await checkDownloaded(items);
        setDownloadedMap((prev) => ({ ...prev, ...downloaded }));
      }
    },
  });

  const doSearch = useCallback(
    (type?: SearchType, query?: string, index = 0) => {
      const t = type ?? searchType;
      const q = query ?? searchQuery;
      if (!q.trim()) return;
      setDrillArtistName(null);
      searchMutation.mutate({ type: t, query: q, index });
    },
    [searchType, searchQuery, searchMutation, setDrillArtistName],
  );

  const goToPage = useCallback(
    (page: number) => {
      const query = searchQuery;
      searchMutation.mutate({
        type: internalType,
        query,
        index: page * PAGE_SIZE,
      });
    },
    [internalType, searchQuery, searchMutation],
  );

  const drillIntoArtistAlbums = useCallback(
    (artistId: string, artistName: string) => {
      setDrillArtistName(artistName);
      searchMutation.mutate({ type: "artist_album", query: artistId, index: 0 });
    },
    [searchMutation, setDrillArtistName],
  );

  const drillIntoArtistTop = useCallback(
    (artistId: string, artistName: string) => {
      setDrillArtistName(artistName);
      searchMutation.mutate({ type: "artist_top", query: artistId, index: 0 });
    },
    [searchMutation, setDrillArtistName],
  );

  const drillIntoAlbumTracks = useCallback(
    (albumId: string, _albumName: string) => {
      searchMutation.mutate({ type: "album_track", query: albumId, index: 0 });
    },
    [searchMutation],
  );

  const currentPage = Math.floor(searchIndex / PAGE_SIZE);
  const totalPages = Math.ceil(searchTotal / PAGE_SIZE);

  return {
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
    isSearching: searchMutation.isPending,
    currentPage,
    totalPages,
    searchTotal,
  };
}
