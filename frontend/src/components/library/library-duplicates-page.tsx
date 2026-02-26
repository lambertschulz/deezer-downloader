import { useCallback, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Copy,
  Hash,
  Tags,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  Fingerprint,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { duplicateGroupsAtom, libraryTracksAtom } from "@/atoms/app";
import { useAudioHashing } from "@/hooks/use-audio-hashing";
import { removeTracks, getDirectoryHandle } from "@/lib/library-db";
import { formatFileSize } from "@/lib/duplicate-detector";
import type { DuplicateGroup } from "@/lib/library-types";

type DuplicateMode = "metadata" | "audio-hash";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolve directory handle for a parent folder from a relative path.
 */
async function resolveParentDir(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ dir: FileSystemDirectoryHandle; fileName: string } | null> {
  const parts = relativePath.split("/");
  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i]);
    } catch {
      return null;
    }
  }
  return { dir: current, fileName: parts[parts.length - 1] };
}

export function LibraryDuplicatesPage() {
  const tracks = useAtomValue(libraryTracksAtom);
  const duplicateGroups = useAtomValue(duplicateGroupsAtom);
  const setTracks = useSetAtom(libraryTracksAtom);
  const {
    hashingProgress,
    hashedCount,
    totalCount,
    computeHashes,
    abortHashing,
    resetHashingProgress,
    scanMetadataDuplicates,
    scanAudioHashDuplicates,
  } = useAudioHashing();

  const [mode, setMode] = useState<DuplicateMode>("metadata");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedToKeep, setSelectedToKeep] = useState<
    Map<string, string>
  >(new Map());
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);

  const isHashing = hashingProgress.status === "running";
  const isHashDone = hashingProgress.status === "complete" || hashingProgress.status === "cancelled";

  const handleScan = useCallback(() => {
    if (mode === "metadata") {
      scanMetadataDuplicates();
    } else {
      scanAudioHashDuplicates();
    }
  }, [mode, scanMetadataDuplicates, scanAudioHashDuplicates]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectToKeep = useCallback(
    (groupKey: string, trackPath: string) => {
      setSelectedToKeep((prev) => new Map(prev).set(groupKey, trackPath));
    },
    [],
  );

  const handleDeleteDuplicates = useCallback(
    async (group: DuplicateGroup) => {
      const keepPath = selectedToKeep.get(group.key);
      if (!keepPath) return;

      const toDelete = group.tracks.filter((t) => t.path !== keepPath);
      if (toDelete.length === 0) return;

      setDeletingGroup(group.key);
      const dirHandle = await getDirectoryHandle();

      // Delete files from disk
      if (dirHandle) {
        for (const track of toDelete) {
          try {
            const result = await resolveParentDir(dirHandle, track.path);
            if (result) {
              await result.dir.removeEntry(result.fileName);
            }
          } catch {
            // File might already be gone
          }
        }
      }

      // Remove from IndexedDB
      const paths = toDelete.map((t) => t.path);
      await removeTracks(paths);

      // Update atom
      setTracks((prev) => {
        const removed = new Set(paths);
        return prev.filter((t) => !removed.has(t.path));
      });

      setDeletingGroup(null);

      // Re-scan to update groups
      if (mode === "metadata") scanMetadataDuplicates();
      else scanAudioHashDuplicates();
    },
    [selectedToKeep, setTracks, mode, scanMetadataDuplicates, scanAudioHashDuplicates],
  );

  // Auto-select the first (best-scored) track in each group
  const groupsWithDefaults = useMemo(() => {
    const newSelected = new Map(selectedToKeep);
    for (const g of duplicateGroups) {
      if (!newSelected.has(g.key) && g.tracks.length > 0) {
        newSelected.set(g.key, g.tracks[0].path);
      }
    }
    if (newSelected.size !== selectedToKeep.size) {
      // Defer state update
      setTimeout(() => setSelectedToKeep(newSelected), 0);
    }
    return duplicateGroups;
  }, [duplicateGroups, selectedToKeep]);

  if (tracks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No tracks in library. Scan your music folder first in the Browse tab.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "metadata" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("metadata")}
        >
          <Tags className="h-4 w-4 mr-1.5" />
          By Metadata
        </Button>
        <Button
          variant={mode === "audio-hash" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("audio-hash")}
        >
          <Fingerprint className="h-4 w-4 mr-1.5" />
          By Audio Hash
        </Button>
      </div>

      {/* Audio hash progress (only in audio-hash mode) */}
      {mode === "audio-hash" && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between text-sm">
            <span>
              Audio hashes: {hashedCount} / {totalCount} computed
            </span>
            <div className="flex gap-2">
              {!isHashing && (
                <Button size="sm" variant="outline" onClick={computeHashes}>
                  <Hash className="h-3.5 w-3.5 mr-1" />
                  {hashedCount === 0 ? "Compute Hashes" : "Continue"}
                </Button>
              )}
              {isHashing && (
                <Button size="sm" variant="destructive" onClick={abortHashing}>
                  Cancel
                </Button>
              )}
              {isHashDone && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetHashingProgress}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {isHashing && (
            <>
              <Progress
                value={
                  hashingProgress.total > 0
                    ? (hashingProgress.processed / hashingProgress.total) * 100
                    : 0
                }
              />
              <div className="text-xs text-muted-foreground truncate">
                {hashingProgress.currentTrack}
              </div>
            </>
          )}
        </div>
      )}

      {/* Scan button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleScan}>
          <Copy className="h-4 w-4 mr-1.5" />
          Find Duplicates
        </Button>
        {duplicateGroups.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {duplicateGroups.length} duplicate group
            {duplicateGroups.length !== 1 && "s"} found
          </span>
        )}
      </div>

      {/* Duplicate groups */}
      {groupsWithDefaults.length === 0 && duplicateGroups.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          Click "Find Duplicates" to scan your library.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {groupsWithDefaults.map((group) => (
          <DuplicateGroupCard
            key={group.key}
            group={group}
            isExpanded={expandedGroups.has(group.key)}
            selectedKeepPath={selectedToKeep.get(group.key) ?? null}
            isDeleting={deletingGroup === group.key}
            onToggleExpand={() => toggleExpand(group.key)}
            onSelectKeep={(path) => selectToKeep(group.key, path)}
            onDelete={() => handleDeleteDuplicates(group)}
          />
        ))}
      </div>

      {/* Info */}
      {mode === "metadata" && (
        <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/30">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            Metadata matching normalizes artist + title (strips feat., deluxe,
            remaster suffixes). Tracks with the same normalized name are grouped.
            The first track in each group is auto-selected as the best copy
            (based on format, file size, and metadata completeness).
          </div>
        </div>
      )}
      {mode === "audio-hash" && (
        <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/30">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            Audio hashing decodes each file and hashes the PCM content. This
            detects identical audio even in different containers or with
            different tags. Compute hashes first, then scan for duplicates.
          </div>
        </div>
      )}
    </div>
  );
}

// ---- DuplicateGroupCard ----

function DuplicateGroupCard({
  group,
  isExpanded,
  selectedKeepPath,
  isDeleting,
  onToggleExpand,
  onSelectKeep,
  onDelete,
}: {
  group: DuplicateGroup;
  isExpanded: boolean;
  selectedKeepPath: string | null;
  isDeleting: boolean;
  onToggleExpand: () => void;
  onSelectKeep: (path: string) => void;
  onDelete: () => void;
}) {
  const representative = group.tracks[0];

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {representative.artist} — {representative.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {group.tracks.length} copies
            {group.matchType === "audio-hash" && " (audio match)"}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">
          {group.tracks.length}x
        </Badge>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="p-3 flex flex-col gap-1">
            {group.tracks.map((track) => {
              const isSelected = selectedKeepPath === track.path;
              return (
                <button
                  key={track.path}
                  onClick={() => onSelectKeep(track.path)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                    isSelected
                      ? "bg-green-500/10 ring-1 ring-green-500/30"
                      : "hover:bg-muted/50",
                  )}
                >
                  {/* Keep indicator */}
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected
                        ? "border-green-500 bg-green-500"
                        : "border-muted-foreground",
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>

                  {/* Track info */}
                  <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {track.album}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {track.path}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {track.format.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatFileSize(track.fileSize)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDuration(track.duration)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {track.year ?? "—"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-3">
            <Button
              size="sm"
              variant="destructive"
              disabled={!selectedKeepPath || isDeleting}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {isDeleting
                ? "Deleting..."
                : `Delete ${group.tracks.length - 1} duplicate${group.tracks.length - 1 !== 1 ? "s" : ""}`}
            </Button>
            <span className="text-xs text-muted-foreground">
              Keep the selected copy, delete the rest
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
