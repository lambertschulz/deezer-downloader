import { useAtom } from "jotai";
import { activeTabAtom, type TabId } from "@/atoms/app";
import {
  Search,
  Music,
  Bug,
  ListOrdered,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { id: TabId | "files"; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "deezer", label: "Deezer", icon: Music },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "queue", label: "Queue", icon: ListOrdered },
  { id: "files", label: "Files", icon: FolderOpen },
];

export function TabNavigation() {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);

  return (
    <nav className="border-b border-border">
      <div className="flex gap-1 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          if (tab.id === "files") {
            return (
              <a
                key={tab.id}
                href="/downloads/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </a>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2",
                isActive
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
