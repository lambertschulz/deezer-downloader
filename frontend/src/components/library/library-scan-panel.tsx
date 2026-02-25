import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  RefreshCw,
  XCircle,
  Unplug,
  HardDrive,
} from "lucide-react";
import type { ScanProgress } from "@/lib/library-types";

interface LibraryScanPanelProps {
  scanProgress: ScanProgress;
  trackCount: number;
  hasStoredHandle: boolean;
  onStartScan: () => void;
  onFullRescan: () => void;
  onAbort: () => void;
  onPickDirectory: () => void;
  onDisconnect: () => void;
}

export function LibraryScanPanel({
  scanProgress,
  trackCount,
  hasStoredHandle,
  onStartScan,
  onFullRescan,
  onAbort,
  onPickDirectory,
  onDisconnect,
}: LibraryScanPanelProps) {
  const isScanning = scanProgress.status === "scanning";
  const progressPercent =
    scanProgress.total > 0
      ? Math.round((scanProgress.scanned / scanProgress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Music Library</h2>
          {trackCount > 0 && (
            <span className="text-sm text-muted-foreground">
              ({trackCount.toLocaleString()} tracks)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hasStoredHandle && !isScanning && (
            <Button size="sm" onClick={onPickDirectory}>
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Select Folder
            </Button>
          )}
          {hasStoredHandle && !isScanning && (
            <>
              <Button variant="outline" size="sm" onClick={onStartScan}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Rescan
              </Button>
              <Button variant="outline" size="sm" onClick={onFullRescan}>
                Full Rescan
              </Button>
              <Button variant="ghost" size="sm" onClick={onPickDirectory}>
                <FolderOpen className="h-4 w-4 mr-1.5" />
                Change Folder
              </Button>
              <Button variant="ghost" size="sm" onClick={onDisconnect}>
                <Unplug className="h-4 w-4 mr-1.5" />
                Disconnect
              </Button>
            </>
          )}
          {isScanning && (
            <Button variant="destructive" size="sm" onClick={onAbort}>
              <XCircle className="h-4 w-4 mr-1.5" />
              Abort
            </Button>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="flex flex-col gap-1.5">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {scanProgress.scanned.toLocaleString()} /{" "}
              {scanProgress.total.toLocaleString()} files
              {scanProgress.skipped > 0 && (
                <> ({scanProgress.skipped} cached)</>
              )}
            </span>
            <span className="truncate max-w-[300px]">
              {scanProgress.currentFile}
            </span>
          </div>
        </div>
      )}

      {scanProgress.status === "complete" && scanProgress.message && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {scanProgress.message}
        </p>
      )}
      {scanProgress.status === "error" && scanProgress.message && (
        <p className="text-sm text-destructive">{scanProgress.message}</p>
      )}
    </div>
  );
}
