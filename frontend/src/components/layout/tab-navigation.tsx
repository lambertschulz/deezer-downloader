import { useAtom, useAtomValue } from "jotai";
import {
  activeTabAtom,
  showArlInputAtom,
  userProfileAtom,
  type TabId,
} from "@/atoms/app";
import {
  Search,
  Music,
  Bug,
  ListOrdered,
  FolderOpen,
  User,
  KeyRound,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArlInput } from "./arl-input";

const tabs: { id: TabId | "files"; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "deezer", label: "Deezer", icon: Music },
  { id: "library", label: "Library", icon: Library },
  { id: "user", label: "My Playlists", icon: User },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "queue", label: "Queue", icon: ListOrdered },
  { id: "files", label: "Files", icon: FolderOpen },
];

export function TabNavigation() {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [showArlInput, setShowArlInput] = useAtom(showArlInputAtom);
  const user = useAtomValue(userProfileAtom);

  return (
    <nav className="border-b border-border">
      <div className="flex items-center justify-between px-4">
        {/* Left: tabs */}
        <div className="flex gap-1">
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

        {/* Right: user profile or Set ARL button */}
        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => setShowArlInput(!showArlInput)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              {user.picture_url ? (
                <img
                  src={user.picture_url}
                  alt={user.name}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm">{user.name}</span>
            </button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArlInput(!showArlInput)}
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              Set ARL
            </Button>
          )}
        </div>
      </div>

      {showArlInput && <ArlInput />}
    </nav>
  );
}
