#!/bin/bash

# Build the Jarvis sidecar
echo "Building Jarvis..."
# Navigate to src-tauri so cargo finds the workspace
cd "$(dirname "$0")"

$HOME/.cargo/bin/cargo build --release -p jarvis

# Determine target triple
TARGET=$($HOME/.cargo/bin/rustc -vV | sed -n 's|host: ||p')
echo "Target Platform: $TARGET"

# Create binaries directory if it doesn't exist
mkdir -p binaries

# Move and rename binary for Tauri sidecar pattern
# Expected format: <command>-<target-triple>
cp target/release/jarvis binaries/jarvis-$TARGET

echo "Jarvis binary ready at binaries/jarvis-$TARGET"
