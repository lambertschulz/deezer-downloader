import { AlertTriangle } from "lucide-react";

export function LibraryUnsupported() {
  return (
    <div className="p-4 flex flex-col items-center gap-4 py-16 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-lg font-semibold">Browser Not Supported</h2>
      <p className="text-muted-foreground max-w-md">
        The Library feature requires the File System Access API, which is
        available in Chromium-based browsers (Chrome, Edge, Brave, Opera).
        Firefox and Safari are not supported.
      </p>
    </div>
  );
}
