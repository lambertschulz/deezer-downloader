import { useSetAtom } from "jotai";
import { useMutation } from "@tanstack/react-query";
import { downloadTrackOrAlbum } from "@/api/download";
import {
  trackedTasksAtom,
  downloadStatusMapAtom,
} from "@/atoms/app";
import type { DownloadRequest } from "@/api/types";
import { toast } from "sonner";

export function useDownload() {
  const setTrackedTasks = useSetAtom(trackedTasksAtom);
  const setDownloadStatusMap = useSetAtom(downloadStatusMapAtom);

  const mutation = useMutation({
    mutationFn: (req: DownloadRequest) => downloadTrackOrAlbum(req),
    onSuccess: (data, variables) => {
      const taskId = String(data.task_id);
      const musicId = String(variables.music_id);

      // Track this task
      setTrackedTasks((prev) => ({ ...prev, [taskId]: musicId }));
      setDownloadStatusMap((prev) => ({ ...prev, [musicId]: "queued" }));

      const label = variables.type === "track" ? "Song" : "Album";
      toast.success(`${label} queued for download`);
    },
    onError: (error) => {
      toast.error(`Download failed: ${error.message}`);
    },
  });

  return {
    download: mutation.mutate,
    isDownloading: mutation.isPending,
  };
}
