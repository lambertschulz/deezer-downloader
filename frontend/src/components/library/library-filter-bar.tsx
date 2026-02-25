import { X, Music, Disc3, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LibraryFilter } from "@/lib/library-types";

const FILTER_ICONS = {
  song: Music,
  album: Disc3,
  artist: User,
} as const;

interface LibraryFilterBarProps {
  filters: LibraryFilter[];
  onRemove: (filter: LibraryFilter) => void;
  onClear: () => void;
}

export function LibraryFilterBar({
  filters,
  onRemove,
  onClear,
}: LibraryFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Filters:</span>
      {filters.map((filter, i) => {
        const Icon = FILTER_ICONS[filter.type];
        return (
          <Badge
            key={`${filter.type}-${i}`}
            variant="secondary"
            className="flex items-center gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
            onClick={() => onRemove(filter)}
          >
            <Icon className="h-3 w-3" />
            <span className="max-w-[200px] truncate">{filter.label}</span>
            <X className="h-3 w-3 ml-0.5" />
          </Badge>
        );
      })}
      {filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={onClear}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
