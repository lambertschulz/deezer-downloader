import { useState } from "react";
import { useAtomValue } from "jotai";
import { Sparkles, Music, Calendar, Gauge, FileAudio, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { libraryTracksAtom } from "@/atoms/app";
import { useMetadataEnrichment } from "@/hooks/use-metadata-enrichment";
import { canWriteTags } from "@/lib/tag-writer";
import type { EnrichmentOptions } from "@/lib/library-types";

function StatCard({
  icon: Icon,
  label,
  missing,
  total,
}: {
  icon: typeof Music;
  label: string;
  missing: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round(((total - missing) / total) * 100) : 100;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          {missing > 0 ? (
            <>
              <span className="text-orange-500 font-medium">{missing}</span> missing
              {" / "}
              {total} total
            </>
          ) : (
            <span className="text-green-500">All tracks have {label.toLowerCase()}</span>
          )}
        </div>
      </div>
      <Badge variant={pct === 100 ? "default" : "outline"} className="text-xs">
        {pct}%
      </Badge>
    </div>
  );
}

export function LibraryEnrichPanel() {
  const tracks = useAtomValue(libraryTracksAtom);
  const { progress, missingStats, enrichTracks, abort, resetProgress } =
    useMetadataEnrichment();

  const [options, setOptions] = useState<EnrichmentOptions>({
    genre: true,
    bpm: true,
    year: true,
    writeToFiles: true,
  });

  const writableCount = tracks.filter((t) => canWriteTags(t.format)).length;
  const nonWritableCount = tracks.length - writableCount;
  const isRunning = progress.status === "running";
  const isDone = progress.status === "complete" || progress.status === "cancelled";
  const totalMissing =
    (options.genre ? missingStats.missingGenre : 0) +
    (options.bpm ? missingStats.missingBpm : 0) +
    (options.year ? missingStats.missingYear : 0);

  if (tracks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No tracks in library. Scan your music folder first in the Browse tab.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats overview */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Music}
          label="Genre"
          missing={missingStats.missingGenre}
          total={tracks.length}
        />
        <StatCard
          icon={Gauge}
          label="BPM"
          missing={missingStats.missingBpm}
          total={tracks.length}
        />
        <StatCard
          icon={Calendar}
          label="Year"
          missing={missingStats.missingYear}
          total={tracks.length}
        />
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Enrichment Options
        </h3>

        <div className="flex flex-wrap gap-3">
          <ToggleOption
            label="Genre"
            sublabel="via MusicBrainz"
            checked={options.genre}
            disabled={isRunning}
            onChange={(v) => setOptions((o) => ({ ...o, genre: v }))}
          />
          <ToggleOption
            label="BPM"
            sublabel="via audio analysis"
            checked={options.bpm}
            disabled={isRunning}
            onChange={(v) => setOptions((o) => ({ ...o, bpm: v }))}
          />
          <ToggleOption
            label="Release Year"
            sublabel="via MusicBrainz"
            checked={options.year}
            disabled={isRunning}
            onChange={(v) => setOptions((o) => ({ ...o, year: v }))}
          />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <ToggleOption
            label="Write to files"
            sublabel={`${writableCount} MP3/FLAC/M4A writable`}
            checked={options.writeToFiles}
            disabled={isRunning}
            onChange={(v) => setOptions((o) => ({ ...o, writeToFiles: v }))}
          />
          {options.writeToFiles && nonWritableCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileAudio className="h-3.5 w-3.5" />
              {nonWritableCount} OGG/WAV/WMA files: DB only
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {!isRunning && !isDone && (
          <Button
            onClick={() => enrichTracks(options)}
            disabled={totalMissing === 0 || !options.genre && !options.bpm && !options.year}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Start Enrichment
            {totalMissing > 0 && (
              <Badge variant="outline" className="ml-2">
                ~{totalMissing} tracks
              </Badge>
            )}
          </Button>
        )}
        {isRunning && (
          <Button variant="destructive" onClick={abort}>
            Cancel
          </Button>
        )}
        {isDone && (
          <Button variant="outline" onClick={resetProgress}>
            Reset
          </Button>
        )}
      </div>

      {/* Progress */}
      {(isRunning || isDone) && (
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {isRunning ? "Enriching..." : "Done"}
            </span>
            <span className="text-muted-foreground">
              {progress.processed} / {progress.total}
            </span>
          </div>

          <Progress
            value={
              progress.total > 0
                ? (progress.processed / progress.total) * 100
                : 0
            }
          />

          {isRunning && progress.currentTrack && (
            <div className="text-xs text-muted-foreground truncate">
              {progress.currentTrack}
            </div>
          )}

          <div className="flex gap-4 text-xs">
            <span className="text-green-500">{progress.updated} updated</span>
            <span className="text-muted-foreground">
              {progress.skipped} skipped
            </span>
            {progress.failed > 0 && (
              <span className="text-red-500">{progress.failed} failed</span>
            )}
          </div>

          {progress.message && isDone && (
            <div
              className={cn(
                "text-sm mt-1",
                progress.status === "cancelled"
                  ? "text-orange-500"
                  : "text-green-500",
              )}
            >
              {progress.message}
            </div>
          )}

          {progress.status === "error" && (
            <div className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {progress.message}
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/30">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          Genre and year are fetched from{" "}
          <span className="font-medium">MusicBrainz</span> (rate limited to
          1 request/second). BPM is detected locally via audio analysis. This
          may take a while for large libraries.
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  sublabel,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors",
        checked
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/20",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div
        className={cn(
          "h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors",
          checked ? "bg-primary border-primary" : "border-muted-foreground",
        )}
      >
        {checked && (
          <svg
            className="h-2.5 w-2.5 text-primary-foreground"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <span>{label}</span>
      {sublabel && (
        <span className="text-xs text-muted-foreground">({sublabel})</span>
      )}
    </button>
  );
}
