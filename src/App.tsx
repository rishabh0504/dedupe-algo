import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/Sidebar";
import { ResultsView } from "./components/ResultsView";
import { ScanQueueView } from "./components/ScanQueueView";
import { useStore, ScanResult } from "./store/useStore";
import { invoke } from "@tauri-apps/api/core";
import { Zap, RotateCcw, Search, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";

function App() {
  const { isScanning, scanQueue, scanResults, setResults } = useStore();
  const [activeTab, setActiveTab] = useState("queue");

  // Auto-switch to results tab when scan completes
  useEffect(() => {
    if (scanResults && !isScanning) {
      setActiveTab("results");
    }
  }, [scanResults, isScanning]);

  const handleStartScan = async () => {
    if (scanQueue.length === 0) return;
    const { setScanPhase, setScanning, setResults, scanHidden } = useStore.getState();

    setResults(null);
    setScanning(true);
    setScanPhase('metadata');

    try {
      // Small artificial delays to let the "logical" phases breathe in the UI
      await new Promise(r => setTimeout(r, 600));
      setScanPhase('partial');

      const response = await invoke<ScanResult>("start_scan", {
        paths: scanQueue,
        scanHidden
      });

      setScanPhase('full');
      await new Promise(r => setTimeout(r, 400));

      setResults(response);
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setScanning(false);
      setScanPhase('idle');
    }
  };

  const clearResults = () => {
    setResults(null);
    setActiveTab("queue");
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <AppSidebar />

        <SidebarInset className="flex flex-col relative overflow-hidden bg-background/50">
          {/* Main Content Header */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <img src="/src/assets/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold tracking-tight">dedupe-algo Workspace</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider opacity-60">
                    {scanResults ? "Collision Matrix Loaded" : isScanning ? "Deep-Pass Analyzing..." : "Standby Operational"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-muted/50 p-1 rounded-xl">
                <TabsList className="bg-transparent h-9 gap-1">
                  <TabsTrigger value="queue" className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <ListTodo className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Target Queue
                  </TabsTrigger>
                  <TabsTrigger
                    value="results"
                    disabled={!scanResults && !isScanning}
                    className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Audit Matrix
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Separator orientation="vertical" className="h-4 mx-2 opacity-20" />

              {scanResults && !isScanning && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearResults}
                  className="rounded-full hover:bg-secondary transition-all"
                  title="Reset Workspace"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </header>

          {/* Dynamic Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {isScanning && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-8">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-[6px] border-primary/10 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-10 h-10 text-primary animate-pulse blur-[1px]" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black tracking-tight text-white uppercase italic">System Extraction Active</h3>
                    <p className="text-muted-foreground text-sm font-medium">Analyzing file trees across {scanQueue.length} virtual targets...</p>
                  </div>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsContent value="queue" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScanQueueView onStartScan={handleStartScan} />
              </TabsContent>
              <TabsContent value="results" className="flex-1 flex flex-col overflow-hidden mt-0">
                {scanResults && <ResultsView />}
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default App;
