import { Toggle } from "@/components/ui/toggle";
import { Music, Disc3, User } from "lucide-react";

type FilterType = "track" | "album" | "artist";

interface SearchTypeFilterProps {
  value: FilterType;
  onChange: (type: FilterType) => void;
}

const filters: { type: FilterType; label: string; icon: typeof Music }[] = [
  { type: "track", label: "Tracks", icon: Music },
  { type: "album", label: "Albums", icon: Disc3 },
  { type: "artist", label: "Artists", icon: User },
];

export function SearchTypeFilter({ value, onChange }: SearchTypeFilterProps) {
  return (
    <div className="flex gap-1">
      {filters.map(({ type, label, icon: Icon }) => (
        <Toggle
          key={type}
          pressed={value === type}
          onPressedChange={() => onChange(type)}
          size="sm"
          className="gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Toggle>
      ))}
    </div>
  );
}
