export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>{" "}
          Search
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
            Ctrl+M
          </kbd>{" "}
          Focus search
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
            Ctrl+Shift+1-6
          </kbd>{" "}
          Switch tabs
        </span>
      </div>
    </footer>
  );
}
