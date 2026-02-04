#!/bin/bash

echo "🚀 Starting Build Process..."

# Ensure we are in the project root (optional safety check)
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📦 Installing dependencies (just in case)..."
pnpm install

echo "🔨 Building the application..."
pnpm tauri build

if [ $? -eq 0 ]; then
    echo "✅ Build Successful!"
    echo "📂 You can find the DMG at:"
    echo "./src-tauri/target/release/bundle/dmg/"
    open src-tauri/target/release/bundle/dmg/
else
    echo "❌ Build Failed."
    exit 1
fi
