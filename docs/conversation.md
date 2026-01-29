# Jarvis Conversational Flow

This document defines the interaction state machine for Jarvis voice commands.

## Interaction State Machine

```mermaid
state_machine-diagram
    [*] --> Idle: Awaiting Wake Word
    
    Idle --> Acknowledging: "Ok Sam" Detected
    
    Acknowledging --> Listening: TTS says "Mhm"
    
    state Listening {
        [*] --> WaitingForSpeech
        WaitingForSpeech --> Capturing: User Starts Speaking
        Capturing --> WaitingForSpeech: Pause Detected
        
        WaitingForSpeech --> Cancelled: 10s of Total Silence
    }
    
    Listening --> Thinking: Final Speech Captured (or 5s Pause)
    Cancelled --> Idle: Session Timed Out
    
    Thinking --> Speaking: Ollama Response Received
    
    Speaking --> Idle: TTS Finished
```

## Detailed Flow Steps

### 1. Wake Recognition
- Jarvis is always listening in the background for "Ok Sam" or configured variations.
- Audio events are filtered for the wake phrase using robust normalization (ignoring punctuation).

### 2. Acknowledgment (The "Siri" Moment)
- Immediately upon wake word detection, Jarvis plays a quick "Mhm" sound or uses TTS to say "Mhm".
- This informs the user that Jarvis is now actively recording their command.

### 3. Command Session (10s Watchdog)
- **Active Window**: Once "Mhm" is played, a 10-second timer starts.
- **Auto-Cancel**: If the user says nothing for 10 seconds, the session resets to **Idle**.
- **Capture**: Every word spoken during this active session is collected into a command buffer. Each new word resets the "Pause" timer (currently 5s) but the session is capped by the 10s inactivity if no speech is detected at all.

### 4. Neural Processing
- Once the command is finalized (via the 5s pause debounce), Jarvis stops listening (Mutex lock).
- The command is sent to Ollama.
- UI shows real-time streaming tokens.

### 5. Response & Reset
- Jarvis speaks the full response using TTS.
- Once finished, the Mutex is released, and Jarvis returns to **Idle** (Step 1).



**Note** : Plese make sure code is perfect, we should create the useAgentConversation for ollama conversation and should decode the streaming effect