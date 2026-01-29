import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/Sidebar";
import { ResultsView } from "./components/ResultsView";
import { ScanQueueView } from "./components/ScanQueueView";
import { useStore, ScanResult } from "./store/useStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { FileExplorerView } from "./components/FileExplorerView";
import { SpeakToJarvisView } from "./components/SpeakToJarvisView";
import { Zap, RotateCcw, Search, ListTodo, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";

function App() {
  const { isScanning, scanQueue, scanResults, setResults, isOnboarded, setScanProgress, activeView, setActiveView } = useStore();

  const [activeTab, setActiveTab] = useState("explorer");

  // Sync from Store -> UI (e.g. Sidebar click)
  useEffect(() => {
    if (activeView === 'explorer') setActiveTab('explorer');
    if (activeView === 'results') setActiveTab('results');
    if (activeView === 'jarvis') setActiveTab('jarvis');
  }, [activeView]);

  // Sync from UI -> Store (Tab click)
  useEffect(() => {
    if (activeTab === 'explorer') setActiveView('explorer');
    if (activeTab === 'results') setActiveView('results');
    if (activeTab === 'jarvis') setActiveView('jarvis');
  }, [activeTab, setActiveView]);

  // Auto-switch to results tab when scan completes
  useEffect(() => {
    if (scanResults && !isScanning) {
      setActiveTab("results");
    }
  }, [scanResults, isScanning]);

  // Listen for scan progress
  useEffect(() => {
    const unlistenPromise = listen<{ current: number; total: number; file: string; }>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [setScanProgress]);


  const handleStartScan = async () => {
    if (scanQueue.length === 0) return;
    const { setScanPhase, setScanning, setResults, scanHidden, scanImages, scanVideos, scanZips, minFileSize, setScanTimestamp, setScanProgress } = useStore.getState();

    setResults(null);
    setScanning(true);
    setScanPhase('metadata');
    setScanProgress(null);

    try {
      // Small artificial delays to let the "logical" phases breathe in the UI
      await new Promise(r => setTimeout(r, 600));
      setScanPhase('partial');

      const response = await invoke<ScanResult>("start_scan", {
        paths: scanQueue,
        scanHidden,
        scanImages,
        scanVideos,
        scanZips,
        minFileSize
      });

      setScanPhase('full');
      await new Promise(r => setTimeout(r, 400));

      setResults(response);
      setScanTimestamp(Date.now()); // Force UI refresh
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setScanning(false);
      setScanPhase('idle');
      setScanProgress(null);
    }
  };

  const clearResults = () => {
    setResults(null);
    setActiveTab("queue");
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {!isOnboarded && <OnboardingWizard />}
        <AppSidebar />

        <SidebarInset className="flex flex-col relative overflow-hidden bg-background/50">
          {/* Main Content Header */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <img src="/src/assets/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold tracking-tight">Dedupe-Algo Workspace</h1>
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
                  <TabsTrigger value="explorer" className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <FolderOpen className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Explorer
                  </TabsTrigger>
                  <TabsTrigger value="queue" className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <ListTodo className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Queue
                  </TabsTrigger>
                  <TabsTrigger
                    value="results"
                    disabled={!scanResults && !isScanning}
                    className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Results
                  </TabsTrigger>
                  <TabsTrigger value="jarvis" className="hidden">Jarvis</TabsTrigger>
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
                  <div className="text-center space-y-2 max-w-lg">
                    <h3 className="text-2xl font-black tracking-tight text-white uppercase italic">System Extraction Active</h3>
                    {useStore.getState().scanProgress ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                          <span>Processing Files</span>
                          <span>{Math.round((useStore.getState().scanProgress!.current / useStore.getState().scanProgress!.total) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${(useStore.getState().scanProgress!.current / useStore.getState().scanProgress!.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-mono opacity-50 truncate pt-1">{useStore.getState().scanProgress!.file}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm font-medium">Analyzing file trees across {scanQueue.length} virtual targets...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsContent value="explorer" className="flex-1 flex flex-col overflow-hidden mt-0">
                <FileExplorerView />
              </TabsContent>
              <TabsContent value="queue" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScanQueueView onStartScan={handleStartScan} />
              </TabsContent>
              <TabsContent value="results" className="flex-1 flex flex-col overflow-hidden mt-0">
                {scanResults && <ResultsView key={useStore.getState().scanTimestamp} onRescan={handleStartScan} />}
              </TabsContent>
              <TabsContent value="jarvis" className="flex-1 flex flex-col overflow-hidden mt-0">
                <SpeakToJarvisView />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

export default App;
