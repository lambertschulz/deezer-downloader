import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, useAtomValue } from "jotai";
import { Toaster } from "sonner";
import { TabNavigation } from "@/components/layout/tab-navigation";
import { Footer } from "@/components/layout/footer";
import { QueueStatusBar } from "@/components/queue/queue-status-bar";
import { SearchPage } from "@/components/search/search-page";
import { QueuePage } from "@/components/queue/queue-page";
import { DeezerPage } from "@/components/deezer/deezer-page";
import { DebugPage } from "@/components/debug/debug-page";
import { UserPage } from "@/components/user/user-page";
import { useUser } from "@/hooks/use-user";
import { activeTabAtom } from "@/atoms/app";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function TabContent() {
  const activeTab = useAtomValue(activeTabAtom);

  return (
    <div className="flex-1 overflow-auto">
      {activeTab === "search" && <SearchPage />}
      {activeTab === "deezer" && <DeezerPage />}
      {activeTab === "user" && <UserPage />}
      {activeTab === "debug" && <DebugPage />}
      {activeTab === "queue" && <QueuePage />}
    </div>
  );
}

function AppShell() {
  useUser();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TabNavigation />
      <div className="px-4 pt-2">
        <QueueStatusBar />
      </div>
      <TabContent />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </JotaiProvider>
  );
}

export default App;
