import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { activeTabAtom } from "@/atoms/app";
import type { TabId } from "@/atoms/app";

interface KeyboardShortcutOptions {
  onSearch: () => void;
  onFocusSearch: () => void;
}

const TAB_SHORTCUTS: Record<string, TabId> = {
  "1": "search",
  "2": "deezer",
  "3": "debug",
  "4": "queue",
  "5": "user",
};

export function useKeyboardShortcuts({
  onSearch,
  onFocusSearch,
}: KeyboardShortcutOptions) {
  const setActiveTab = useSetAtom(activeTabAtom);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Enter → trigger search
      if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" && target.id === "search-input") {
          e.preventDefault();
          onSearch();
        }
      }

      // Ctrl+M → focus search bar
      if (e.ctrlKey && !e.shiftKey && e.key === "m") {
        e.preventDefault();
        onFocusSearch();
      }

      // Ctrl+Shift+[1-4] → tab navigation
      if (e.ctrlKey && e.shiftKey) {
        const tab = TAB_SHORTCUTS[e.key];
        if (tab) {
          e.preventDefault();
          setActiveTab(tab);
        }
        // Ctrl+Shift+6 → open files in new window
        if (e.key === "6") {
          e.preventDefault();
          window.open("/downloads/", "_blank");
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onSearch, onFocusSearch, setActiveTab]);
}
