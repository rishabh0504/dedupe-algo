import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/Sidebar";
import { ResultsView } from "./components/ResultsView";
import { ScanQueueView } from "./components/ScanQueueView";
import { useStore, ScanResult } from "./store/useStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { FileExplorerView } from "./components/FileExplorerView";
import { SpeakToAetherView } from "./components/SpeakToAetherView";
import { Zap, RotateCcw, Search, ListTodo, FolderOpen, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useCallback, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { JarvisEvent, jarvisService } from "./services/jarvisService";
import { useVoiceConversationAgent } from "./hooks/useVoiceConversationAgent";
import { useTextConversationAgent } from "./hooks/useTextConversationAgent";

function App() {
  const { isScanning, scanQueue, scanResults, setResults, isOnboarded, setScanProgress, activeView, setActiveView, isVoiceEnabled, setVoiceEnabled } = useStore();

  // Jarvis State Transformation
  const [audioDevice, setAudioDevice] = useState<string | null>(null);
  const isStartedRef = useRef(false);

  // --- AGENT: CONDITIONAL HOOKS ---
  const voiceAgent = useVoiceConversationAgent();
  const textAgent = useTextConversationAgent();

  // Select active agent based on STORE config (Microphone toggle)
  const activeAgent = isVoiceEnabled ? voiceAgent : textAgent;

  // Destructure from active agent
  const {
    state: jarvisState,
    status: jarvisStatus,
    messages: jarvisMessages,
    handleVoiceEvent,
    handleManualSend,
    resetToListening,
    stopListening
  } = activeAgent;

  // --- JARVIS: SIDECAR EVENTS (Only if Voice is Enabled) ---
  useEffect(() => {
    if (!isVoiceEnabled) return; // Don't listen to sidecar if voice is off

    const unlistenPromise = listen<JarvisEvent>('jarvis-event', (event) => {
      handleVoiceEvent(event.payload);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [handleVoiceEvent, isVoiceEnabled]);

  // Optimized Sidecar Initialization
  const initJarvis = useCallback(async () => {
    if (isStartedRef.current) return;

    try {
      let modelPath = "models/ggml-base.en.bin";
      try {
        modelPath = await invoke('get_model_path');
      } catch (e) {
        console.warn("Using fallback model path...");
      }

      await jarvisService.start({
        wakeWord: "Hello",
        modelPath: modelPath
      });

      isStartedRef.current = true;
    } catch (error) {
      console.error("Critical Failure: Jarvis sidecar could not start:", error);
    }
  }, []);

  useEffect(() => {
    if (!isVoiceEnabled) {
      jarvisService.stop();
      isStartedRef.current = false;
      return;
    }

    const unsubscribe = jarvisService.onEvent((event: JarvisEvent) => {
      if (event.event === 'audio_device') {
        setAudioDevice(event.device || "Default Interface");
      } else {
        handleVoiceEvent(event);
      }
    });

    initJarvis();

    return () => {
      unsubscribe();
      jarvisService.stop();
      isStartedRef.current = false;
    };
  }, [isVoiceEnabled, handleVoiceEvent, initJarvis]);

  // Auto-switch to results tab when scan completes
  useEffect(() => {
    if (scanResults && !isScanning) {
      setActiveView("results");
    }
  }, [scanResults, isScanning, setActiveView]);

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
    setActiveView("queue");
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {!isOnboarded && <OnboardingWizard />}
        <AppSidebar />

        <SidebarInset className="flex flex-col relative overflow-hidden bg-background/50">

          {/* Main Content Header - Transforms for Jarvis */}
          <header className={`flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 transition-all duration-500 ${activeView === 'jarvis' ? 'bg-black/40 border-primary/20' : ''}`}>

            {activeView === 'jarvis' ? (
              /* JARVIS HEADER STATE */
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                {/* MINI VISUALIZER */}
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full border border-primary/20
                            ${jarvisState !== 'Idle' ? 'animate-spin [animation-duration:3s]' : ''}
                            ${jarvisState === 'Thinking' ? 'border-t-blue-500' :
                      jarvisState === 'Speaking' ? 'border-t-green-500' :
                        jarvisState === 'Listening' ? 'border-t-emerald-500' : ''}`}
                  />
                  <div className={`absolute inset-1 rounded-full border border-primary/20
                            ${jarvisState !== 'Idle' ? 'animate-spin [animation-duration:2s] direction-reverse' : ''}`}
                  />
                  {jarvisState === 'Speaking' ? (
                    <Volume2 className="w-5 h-5 text-green-500 animate-bounce" />
                  ) : (
                    <Mic className={`w-5 h-5 transition-colors duration-300 
                                ${jarvisState === 'Thinking' ? 'text-blue-500' :
                        jarvisState === 'Listening' ? 'text-emerald-500' : 'text-primary'}`}
                    />
                  )}
                </div>

                <div className="flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/90">
                    Aether Protocol
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono tracking-tight uppercase
                                ${jarvisState === 'Thinking' ? 'text-blue-400' :
                        jarvisState === 'Speaking' ? 'text-green-400' :
                          jarvisState === 'Listening' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {jarvisStatus}
                    </span>
                    {audioDevice && (
                      <span className="text-[9px] text-muted-foreground/40 font-mono hidden sm:inline-block">
                        | {audioDevice}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* STANDARD HEADER STATE */
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <img src="/src/assets/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-bold tracking-tight">Aether Workspace</h1>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider opacity-60">
                      {scanResults ? "Collision Matrix Loaded" : isScanning ? "Deep-Pass Analyzing..." : "Standby Operational"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {activeView !== 'jarvis' && (
              <div className="flex items-center gap-4">
                <Tabs value={activeView} onValueChange={(val) => setActiveView(val as any)} className="bg-muted/50 p-1 rounded-xl">
                  <TabsList className="bg-transparent h-9 gap-1">

                    {/* EXPLORER TAB */}
                    {(activeView === 'explorer' || (!scanResults && activeView !== 'queue')) && (
                      <TabsTrigger value="explorer" className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <FolderOpen className="w-3.5 h-3.5 mr-2 opacity-50" />
                        Explorer
                      </TabsTrigger>
                    )}

                    {/* QUEUE TAB */}
                    {(activeView === 'queue' || scanQueue.length > 0 || activeView === 'results') && (
                      <TabsTrigger value="queue" className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <ListTodo className="w-3.5 h-3.5 mr-2 opacity-50" />
                        Queue
                      </TabsTrigger>
                    )}

                    {/* RESULTS TAB */}
                    {(scanResults || activeView === 'results') && (
                      <TabsTrigger
                        value="results"
                        disabled={!scanResults && !isScanning}
                        className="rounded-lg px-4 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        <Search className="w-3.5 h-3.5 mr-2 opacity-50" />
                        Results
                      </TabsTrigger>
                    )}

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
            )}
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

            <Tabs value={activeView} onValueChange={(val) => setActiveView(val as any)} className="flex-1 flex flex-col overflow-hidden">
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
                <SpeakToAetherView
                  state={jarvisState}
                  messages={jarvisMessages}
                  onSend={handleManualSend}
                  resetToListening={() => {
                    if (!isVoiceEnabled) setVoiceEnabled(true);
                    resetToListening();
                  }}
                  stopListening={stopListening}
                  isVoiceEnabled={isVoiceEnabled}
                  onToggleVoice={() => setVoiceEnabled(!isVoiceEnabled)}
                />
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
