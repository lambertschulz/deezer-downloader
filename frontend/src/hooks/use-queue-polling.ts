import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { fetchQueue } from "@/api/queue";
import {
  trackedTasksAtom,
  downloadStatusMapAtom,
  downloadedMapAtom,
  hasTrackedTasksAtom,
  activeTabAtom,
} from "@/atoms/app";
import type { DownloadStatus, QueueTask } from "@/api/types";
import { useEffect, useRef } from "react";

export function useQueuePolling() {
  const hasTrackedTasks = useAtomValue(hasTrackedTasksAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const trackedTasks = useAtomValue(trackedTasksAtom);
  const setDownloadStatusMap = useSetAtom(downloadStatusMapAtom);
  const setTrackedTasks = useSetAtom(trackedTasksAtom);
  const setDownloadedMap = useSetAtom(downloadedMapAtom);

  // Poll when there are tracked tasks OR when queue tab is active
  const shouldPoll = hasTrackedTasks || activeTab === "queue";

  const query = useQuery({
    queryKey: ["queue"],
    queryFn: fetchQueue,
    refetchInterval: shouldPoll ? 1500 : false,
    enabled: shouldPoll,
  });

  const trackedTasksRef = useRef(trackedTasks);
  trackedTasksRef.current = trackedTasks;

  // Process queue updates to sync download statuses
  useEffect(() => {
    if (!query.data) return;

    const tasks = query.data;
    const taskMap = new Map<string, QueueTask>();
    for (const task of tasks) {
      taskMap.set(String(task.id), task);
    }

    const currentTracked = trackedTasksRef.current;
    const newStatusMap: Record<string, DownloadStatus> = {};
    const tasksToRemove: string[] = [];

    for (const [taskId, musicId] of Object.entries(currentTracked)) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      switch (task.state) {
        case "waiting":
          newStatusMap[musicId] = "queued";
          break;
        case "active":
          newStatusMap[musicId] = "downloading";
          break;
        case "mission accomplished":
          newStatusMap[musicId] = "done";
          tasksToRemove.push(taskId);
          break;
        case "failed":
          newStatusMap[musicId] = "failed";
          tasksToRemove.push(taskId);
          break;
      }
    }

    // Batch update download status map
    if (Object.keys(newStatusMap).length > 0) {
      setDownloadStatusMap((prev) => ({ ...prev, ...newStatusMap }));
    }

    // Mark completed downloads in downloadedMap
    const newDownloaded: Record<string, boolean> = {};
    for (const [taskId, musicId] of Object.entries(currentTracked)) {
      const task = taskMap.get(taskId);
      if (task?.state === "mission accomplished") {
        newDownloaded[musicId] = true;
      }
    }
    if (Object.keys(newDownloaded).length > 0) {
      setDownloadedMap((prev) => ({ ...prev, ...newDownloaded }));
    }

    // Remove completed/failed tasks from tracking
    if (tasksToRemove.length > 0) {
      setTrackedTasks((prev) => {
        const next = { ...prev };
        for (const id of tasksToRemove) {
          delete next[id];
        }
        return next;
      });
    }
  }, [query.data, setDownloadStatusMap, setDownloadedMap, setTrackedTasks]);

  return query;
}
