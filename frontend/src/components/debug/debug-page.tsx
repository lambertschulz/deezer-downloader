import { useQuery } from "@tanstack/react-query";
import { fetchDebugLog } from "@/api/debug";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function DebugPage() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["debug"],
    queryFn: fetchDebugLog,
    refetchInterval: false,
  });

  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Debug Log</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      <Textarea
        readOnly
        value={data ?? "Loading..."}
        className="flex-1 min-h-[400px] font-mono text-xs resize-none"
      />
    </div>
  );
}
