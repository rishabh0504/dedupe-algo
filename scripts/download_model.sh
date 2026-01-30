#!/bin/bash

# Directory Setup
MODEL_DIR="models"
mkdir -p "$MODEL_DIR"

# -----------------------------------------------------------------------------
# MODEL SELECTION: Small.en (Quantized q5_1)
# -----------------------------------------------------------------------------
# Why this model?
# 1. 'Small' (~244M params) is much better at Indian accents than 'Base'.
# 2. 'en' (English-only) is more accurate for code/technical terms than multilingual.
# 3. 'q5_1' is a 5-bit quantization optimized for Intel CPUs (AVX).
#    It offers near-F16 accuracy but runs 2x faster and uses ~190MB RAM.
# -----------------------------------------------------------------------------

MODEL_NAME="ggml-base.en.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_NAME"
MODEL_FILE="$MODEL_DIR/$MODEL_NAME"

echo "🎯 Target Model: $MODEL_NAME (Optimized for Intel i5 + Indian Accents)"

if [ -f "$MODEL_FILE" ]; then
    echo "✅ Model already exists at: $MODEL_FILE"
else
    echo "⬇️ Downloading Whisper Model (Size: ~190MB)..."
    # -L follows redirects (critical for HuggingFace), -# shows a progress bar
    curl -L -# -o "$MODEL_FILE" "$MODEL_URL"
    
    # Check if download actually succeeded (sometimes curl writes an error HTML to the file)
    if grep -q "<!DOCTYPE html>" "$MODEL_FILE"; then
        echo "❌ Error: Download failed (got HTML page). Check URL or internet connection."
        rm "$MODEL_FILE"
        exit 1
    fi
    
    echo "✅ Download Complete: $MODEL_FILE"
fi

# Permission Check (Optional: helps if you plan to run the binary next)
# echo "🔧 To run this: ./main -m $MODEL_FILE -f samples/jfk.wav"