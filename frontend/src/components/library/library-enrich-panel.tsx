import { useState } from "react";
import { useAtomValue } from "jotai";
import {
  Sparkles,
  Music,
  Calendar,
  Gauge,
  FileAudio,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { libraryTracksAtom } from "@/atoms/app";
import { useMetadataEnrichment } from "@/hooks/use-metadata-enrichment";
import { useBpmEnrichment } from "@/hooks/use-bpm-enrichment";
import { canWriteTags } from "@/lib/tag-writer";
import type { EnrichmentProgress } from "@/lib/library-types";

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

function ProgressPanel({ progress }: { progress: EnrichmentProgress }) {
  const isActive = progress.status === "running" || progress.status === "cancelling";
  const isDone = progress.status === "complete" || progress.status === "cancelled";

  if (!isActive && !isDone && progress.status !== "error") return null;

  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-border">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium flex items-center gap-1.5">
          {progress.status === "cancelling" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {progress.status === "cancelling"
            ? "Cancelling..."
            : isActive
              ? "Processing..."
              : "Done"}
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

      {isActive && progress.currentTrack && (
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
  );
}

export function LibraryEnrichPanel() {
  const tracks = useAtomValue(libraryTracksAtom);

  const {
    progress: metadataProgress,
    missingStats,
    enrichMetadata,
    abort: abortMetadata,
    resetProgress: resetMetadata,
  } = useMetadataEnrichment();

  const {
    progress: bpmProgress,
    missingBpm,
    enrichBpm,
    abort: abortBpm,
    resetProgress: resetBpm,
  } = useBpmEnrichment();

  const [metadataOptions, setMetadataOptions] = useState({
    genre: true,
    year: true,
    writeToFiles: true,
  });

  const [bpmWriteToFiles, setBpmWriteToFiles] = useState(true);

  const writableCount = tracks.filter((t) => canWriteTags(t.format)).length;
  const nonWritableCount = tracks.length - writableCount;

  const metadataActive = metadataProgress.status === "running" || metadataProgress.status === "cancelling";
  const metadataDone = metadataProgress.status === "complete" || metadataProgress.status === "cancelled";
  const metadataMissing =
    (metadataOptions.genre ? missingStats.missingGenre : 0) +
    (metadataOptions.year ? missingStats.missingYear : 0);

  const bpmActive = bpmProgress.status === "running" || bpmProgress.status === "cancelling";
  const bpmDone = bpmProgress.status === "complete" || bpmProgress.status === "cancelled";

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
          missing={missingBpm}
          total={tracks.length}
        />
        <StatCard
          icon={Calendar}
          label="Year"
          missing={missingStats.missingYear}
          total={tracks.length}
        />
      </div>

      {/* ---- Metadata Enrichment (MusicBrainz) ---- */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Metadata Enrichment
          <span className="text-xs font-normal text-muted-foreground">via MusicBrainz</span>
        </h3>

        <div className="flex flex-wrap gap-3">
          <ToggleOption
            label="Genre"
            sublabel="recording + artist tags"
            checked={metadataOptions.genre}
            disabled={metadataActive}
            onChange={(v) => setMetadataOptions((o) => ({ ...o, genre: v }))}
          />
          <ToggleOption
            label="Release Year"
            sublabel="first release date"
            checked={metadataOptions.year}
            disabled={metadataActive}
            onChange={(v) => setMetadataOptions((o) => ({ ...o, year: v }))}
          />
        </div>

        <WriteToFilesToggle
          checked={metadataOptions.writeToFiles}
          disabled={metadataActive}
          onChange={(v) => setMetadataOptions((o) => ({ ...o, writeToFiles: v }))}
          writableCount={writableCount}
          nonWritableCount={nonWritableCount}
        />

        <div className="flex items-center gap-3">
          {!metadataActive && !metadataDone && (
            <Button
              onClick={() => enrichMetadata(metadataOptions)}
              disabled={metadataMissing === 0 || (!metadataOptions.genre && !metadataOptions.year)}
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Start Metadata Enrichment
              {metadataMissing > 0 && (
                <Badge variant="secondary" className="ml-2">
                  ~{metadataMissing}
                </Badge>
              )}
            </Button>
          )}
          {metadataProgress.status === "running" && (
            <Button variant="destructive" size="sm" onClick={abortMetadata}>
              Cancel
            </Button>
          )}
          {metadataProgress.status === "cancelling" && (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Cancelling...
            </Button>
          )}
          {metadataDone && (
            <Button variant="outline" size="sm" onClick={resetMetadata}>
              Reset
            </Button>
          )}
        </div>

        <ProgressPanel progress={metadataProgress} />

        <div className="text-xs text-muted-foreground">
          Rate limited to 1 request/second (MusicBrainz ToS). Sequential processing.
        </div>
      </div>

      {/* ---- BPM Analysis ---- */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          BPM Analysis
          <span className="text-xs font-normal text-muted-foreground">via audio analysis</span>
        </h3>

        <WriteToFilesToggle
          checked={bpmWriteToFiles}
          disabled={bpmActive}
          onChange={setBpmWriteToFiles}
          writableCount={writableCount}
          nonWritableCount={nonWritableCount}
        />

        <div className="flex items-center gap-3">
          {!bpmActive && !bpmDone && (
            <Button
              onClick={() => enrichBpm(bpmWriteToFiles)}
              disabled={missingBpm === 0}
              size="sm"
            >
              <Gauge className="h-4 w-4 mr-1.5" />
              Start BPM Analysis
              {missingBpm > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {missingBpm} tracks
                </Badge>
              )}
            </Button>
          )}
          {bpmProgress.status === "running" && (
            <Button variant="destructive" size="sm" onClick={abortBpm}>
              Cancel
            </Button>
          )}
          {bpmProgress.status === "cancelling" && (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Cancelling...
            </Button>
          )}
          {bpmDone && (
            <Button variant="outline" size="sm" onClick={resetBpm}>
              Reset
            </Button>
          )}
        </div>

        <ProgressPanel progress={bpmProgress} />

        <div className="text-xs text-muted-foreground">
          Parallel processing (6 concurrent). BPMs are saved immediately as detected.
        </div>
      </div>
    </div>
  );
}

// ---- Shared sub-components ----

function WriteToFilesToggle({
  checked,
  disabled,
  onChange,
  writableCount,
  nonWritableCount,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  writableCount: number;
  nonWritableCount: number;
}) {
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-border">
      <ToggleOption
        label="Write to files"
        sublabel={`${writableCount} MP3/FLAC/M4A writable`}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {checked && nonWritableCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileAudio className="h-3.5 w-3.5" />
          {nonWritableCount} OGG/WAV/WMA files: DB only
        </div>
      )}
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
