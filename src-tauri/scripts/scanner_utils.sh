#!/bin/bash

# Aether high-speed file discovery utility
# Uses find with optimized filtering for maximum speed on macOS/Unix

PATH_TO_SCAN="$1"
MIN_SIZE="$2"
WHITELIST_EXTS="$3" # Comma-separated
SCAN_HIDDEN="$4"    # "true" or "false"

if [ -z "$PATH_TO_SCAN" ]; then
    echo "Usage: $0 <path> <min_size_bytes> <exts_csv> <scan_hidden>"
    exit 1
fi

# Convert comma-separated exts to find-compatible regex
# Example: jpg,png -> .*\.\(jpg\|png\)$
EXT_REGEX=".*\.($(echo $WHITELIST_EXTS | sed 's/,/\\|/g'))$"

FIND_OPTS=""
if [ "$SCAN_HIDDEN" != "true" ]; then
    # Skip hidden folders and files
    FIND_OPTS="-not -path '*/.*'"
fi

# Optimized find command
# -L: Follow symlinks? No, safer not to.
# -type f: Only files
# -size +Nc: Greater than N bytes
# -iregex: Case-insensitive regex for extensions
# -prune can be used to skip blacklisted dirs for even more speed

# Common blacklisted dirs to prune instantly
PRUNE_DIRS=(
    ".git" "node_modules" "venv" ".venv" "env" "target" "dist" "build" 
    "__pycache__" ".vscode" ".idea" "Library" "System" "Windows"
)

PRUNE_EXPR=""
for dir in "${PRUNE_DIRS[@]}"; do
    if [ -z "$PRUNE_EXPR" ]; then
        PRUNE_EXPR="-name $dir"
    else
        PRUNE_EXPR="$PRUNE_EXPR -o -name $dir"
    fi
done

# Run find
find "$PATH_TO_SCAN" \( $PRUNE_EXPR \) -prune -o -type f -size +"${MIN_SIZE}c" -iregex "$EXT_REGEX" $FIND_OPTS -print0 2>/dev/null | xargs -0 stat -f "%z %m %N" 2>/dev/null
