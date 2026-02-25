import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, hasTrackedTasksAtom } from "@/atoms/app";
import { useQueuePolling } from "@/hooks/use-queue-polling";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function QueueStatusBar() {
  const hasTrackedTasks = useAtomValue(hasTrackedTasksAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const { data: tasks } = useQueuePolling();
  const [visible, setVisible] = useState(false);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const activeTasks = tasks?.filter((t) => t.state === "active") ?? [];
  const waitingTasks = tasks?.filter((t) => t.state === "waiting") ?? [];
  const doneTasks = tasks?.filter((t) => t.state === "mission accomplished") ?? [];
  const failedTasks = tasks?.filter((t) => t.state === "failed") ?? [];
  const totalTasks = (tasks ?? []).length;

  // Show bar when there are tracked tasks
  useEffect(() => {
    if (hasTrackedTasks) {
      setVisible(true);
      if (hideTimer) {
        clearTimeout(hideTimer);
        setHideTimer(null);
      }
    } else if (visible && !hasTrackedTasks) {
      // Auto-hide after 4 seconds when all tracked tasks complete
      const timer = setTimeout(() => setVisible(false), 4000);
      setHideTimer(timer);
    }
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTrackedTasks]);

  if (!visible || !tasks || totalTasks === 0) return null;

  const activeTask = activeTasks[0];
  const progressPercent =
    totalTasks > 0 ? (doneTasks.length / totalTasks) * 100 : 0;

  return (
    <button
      onClick={() => setActiveTab("queue")}
      className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-4 py-2 text-sm relative overflow-hidden cursor-pointer hover:bg-zinc-800 transition-colors"
    >
      <div className="flex items-center gap-3 relative z-10">
        {/* Done count */}
        <span className="flex items-center gap-1">
          {hasTrackedTasks ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
          ) : (
            <Check className="h-3.5 w-3.5 text-green-400" />
          )}
          <span>
            {doneTasks.length}/{totalTasks}
          </span>
        </span>

        {/* Active task info */}
        {activeTask && (
          <span className="text-zinc-400 truncate">
            {activeTask.metadata?.artist && activeTask.metadata?.title
              ? `${activeTask.metadata.artist} \u2013 ${activeTask.metadata.title}`
              : activeTask.description}
            {activeTask.progress[1] > 0 && (
              <span className="text-zinc-500 ml-1">
                ({activeTask.progress[0]}/{activeTask.progress[1]})
              </span>
            )}
          </span>
        )}

        {/* Waiting count */}
        {waitingTasks.length > 0 && (
          <span className="text-zinc-500">{waitingTasks.length} waiting</span>
        )}

        {/* Failed count */}
        {failedTasks.length > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="h-3 w-3" />
            {failedTasks.length}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-700">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </button>
  );
}
