#!/bin/bash

# Model Directory
MODEL_DIR="models"
mkdir -p "$MODEL_DIR"

# Preferred Model (Small is better, Base is faster)
# MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
# MODEL_FILE="$MODEL_DIR/ggml-base.en.bin"

# Using Base for Speed
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
MODEL_FILE="$MODEL_DIR/ggml-base.en.bin"

if [ -f "$MODEL_FILE" ]; then
    echo "✅ Model already exists: $MODEL_FILE"
    # Optional: Check size to ensure allow partial downloads?
else
    echo "⬇️ Downloading Whisper Model (Small En)..."
    curl -L -o "$MODEL_FILE" "$MODEL_URL"
    echo "✅ Download Complete"
fi
