import { useQuery } from "@tanstack/react-query";
import { fetchQueue } from "@/api/queue";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Music,
  Disc3,
  ListMusic,
  Clock,
  Loader2,
  Check,
  X,
} from "lucide-react";
import type { QueueTask } from "@/api/types";

function getTypeIcon(task: QueueTask) {
  const type = task.metadata?.type;
  if (type === "track") return <Music className="h-5 w-5" />;
  if (type === "album") return <Disc3 className="h-5 w-5" />;
  return <ListMusic className="h-5 w-5" />;
}

function getStateBadge(task: QueueTask) {
  switch (task.state) {
    case "waiting":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Waiting
        </Badge>
      );
    case "active":
      return (
        <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" /> Downloading
          {task.progress[1] > 0 && (
            <span>
              {task.progress[0]}/{task.progress[1]}
            </span>
          )}
        </Badge>
      );
    case "mission accomplished":
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200">
          <Check className="h-3 w-3" /> Done
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <X className="h-3 w-3" /> Failed
        </Badge>
      );
  }
}

export function QueuePage() {
  const { data: tasks } = useQuery({
    queryKey: ["queue"],
    queryFn: fetchQueue,
    refetchInterval: 1000,
  });

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">No tasks in queue.</div>
    );
  }

  // Reverse: newest first
  const sortedTasks = [...tasks].reverse();

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2">
        {sortedTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border"
          >
            <div className="text-muted-foreground">{getTypeIcon(task)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate text-sm">
                  {task.metadata?.artist || "Unknown"}
                </span>
                <span className="text-muted-foreground text-sm truncate">
                  {task.metadata?.title || task.description}
                </span>
              </div>

              {task.state === "active" && task.progress[1] > 0 && (
                <Progress
                  value={(task.progress[0] / task.progress[1]) * 100}
                  className="h-1 mt-1"
                />
              )}

              {task.state === "failed" && task.exception && (
                <p className="text-xs text-destructive mt-1 truncate">
                  {task.exception}
                </p>
              )}
            </div>

            <div className="shrink-0">{getStateBadge(task)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
