#!/bin/bash

# Aether Desktop AI - Mac M3 (Silicon) Setup Script

echo "🚀 Starting Aether Environment Setup for Mac M3..."

# 1. Homebrew Check
if ! command -v brew &> /dev/null; then
    echo "🍺 Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew is already installed."
fi

# 2. System Dependencies (CMake, FFmpeg, Pkg-Config)
echo "📦 Checking System Dependencies..."
brew install cmake ffmpeg pkg-config protobuf

# 3. Rust (Tauri Backend)
if ! command -v cargo &> /dev/null; then
    echo "🦀 Installing Rust (Required for Sidecar)..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source $HOME/.cargo/env
else
    echo "✅ Rust is already installed."
fi

# 4. Node.js (Frontend)
if ! command -v node &> /dev/null; then
    echo "🟢 Node.js not found. Installing via Brew..."
    brew install node
else
    echo "✅ Node.js is already installed."
fi

# 5. Connect/Install Ollama (LLM Server)
if ! command -v ollama &> /dev/null; then
    echo "🦙 Installing Ollama (For AI Models)..."
    brew install --cask ollama
else
    echo "✅ Ollama is already installed."
fi

echo "🧠 Pulling Required AI Models into Ollama..."
echo "   (This may take a while based on internet speed)"
# Models identified from src/config/agentLLMConfig.ts
ollama pull gemma3:1b
ollama pull gemma3:4b
ollama pull qwen2.5-coder:3b

# 6. Whisper Model (Speech-to-Text)
echo "🗣️ Setting up Whisper Model..."
if [ -f "scripts/download_model.sh" ]; then
    chmod +x scripts/download_model.sh
    ./scripts/download_model.sh
else
    echo "❌ scripts/download_model.sh not found!"
fi

# 7. Install Project Dependencies
echo "📦 Installing NPM Project Dependencies..."
npm install

echo "🎉 Setup Complete! You can now run the app using:"
echo "   npm run tauri dev"
