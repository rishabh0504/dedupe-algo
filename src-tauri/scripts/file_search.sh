#!/bin/bash

# Aether File Search Utility
# Uses find to search for files within a size range

SEARCH_PATH="$1"
MIN_SIZE="$2" # in bytes
MAX_SIZE="$3" # in bytes
INCLUDE_HIDDEN="$4" # "true" or "false"

if [ -z "$SEARCH_PATH" ] || [ -z "$MIN_SIZE" ] || [ -z "$MAX_SIZE" ]; then
    echo "Usage: $0 <path> <min_size> <max_size> <include_hidden>"
    exit 1
fi

# Build Find Arguments array
FIND_CMD=("find" "$SEARCH_PATH")

# Prune directories
PRUNE_DIRS=(
    ".git" "node_modules" "venv" ".venv" "env" "target" "dist" "build" 
    "__pycache__" ".vscode" ".idea" "Library" "System" "Windows"
    "\$RECYCLE.BIN" "System Volume Information"
)

# Construct prune expression: \( -name ".git" -o -name "node_modules" ... \) -prune
PRUNE_ARGS=()
first=true
for dir in "${PRUNE_DIRS[@]}"; do
    if [ "$first" = true ]; then
        first=false
    else
        PRUNE_ARGS+=("-o")
    fi
    PRUNE_ARGS+=("-name" "$dir")
done

FIND_CMD+=("(")
FIND_CMD+=("${PRUNE_ARGS[@]}")
FIND_CMD+=(")")
FIND_CMD+=("-prune")
FIND_CMD+=("-o")

# File search criteria
FIND_CMD+=("-type" "f")
FIND_CMD+=("-size" "+${MIN_SIZE}c")
FIND_CMD+=("-size" "-${MAX_SIZE}c")

if [ "$INCLUDE_HIDDEN" != "true" ]; then
    FIND_CMD+=("-not" "-path" "*/.*")
fi

FIND_CMD+=("-print0")

# Execute
"${FIND_CMD[@]}" 2>/dev/null | xargs -0 -I{} stat -f "%z|%m|%N" {} 2>/dev/null
