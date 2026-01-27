# DedupePro User Stories & Development Plan

## Phase 1: Project Initialization & Architecture
- [x] **Initialize Tauri Workspace**
  - Set up a new Tauri project with Rust as the backend and Vite (React/TypeScript) as the frontend.
  - Verify the build pipeline runs for both Rust and Mac OS.
- [x] **Configure Frontend Styling System**
  - Install and configure Tailwind CSS.
  - Initialize Shadcn UI components (install core components like buttons, cards, scrollbars).
  - Create a custom theme matching the "Premium" aesthetic (Dark mode, vibrant accents).
- [x] **Setup State Management**
  - Install and configure `Zustand` for global UI state (Sidebar toggle, Selection state).
  - Install and configure `TanStack Query` for managing async scan results and caching.
- [x] **Configure Rust Dependencies**
  - Add crates: `tokio` (async runtime), `rayon` (parallelism), `jwalk` (fast execution), `blake3` (hashing), `sysinfo` (system monitoring), `serde` (serialization).

## Phase 2: Core Rust Engine (The Brain)
- [x] **Implement System Info & Drive Detection**
  - Create a Rust command `get_available_drives` using `sysinfo`.
  - Filter and return list of internal/external mounted drives with usage stats.
- [x] **Develop Parallel File Traversal**
  - Implement a `scan_directory` function using `jwalk` for parallel directory walking.
  - Ensure invisible files and system directories are configurable (initially included, filtered later).
- [x] **Implement Exclusion Logic (Blacklist)**
  - Hardcode strict exclusions for critical paths: `/System`, `/Library`, `/Windows`, `/bin`, `/usr`.
  - Implement check to skip these paths during traversal to prevent system damage.
- [x] **Develop 3-Pass Hashing Strategy**
  - **Pass 1 (Size Strategy):** Group files by file size. Discard unique sizes immediately.
  - **Pass 2 (Partial Hash):** Read first 16KB of files in remaining groups. Hash and compare. Discard non-matches.
  - **Pass 3 (Full Hash):** Compute full BLAKE3 hash for the remaining potential duplicates.
- [x] **Optimize Resource Usage**
  - Implement streaming file reading to ensure RAM usage stays < 2GB.
  - Use `rayon` thread pools, conceptually optimizing for M3 Pro performance cores (or general efficiently).

## Phase 3: Caching & Performance Layer (New)
- [x] **Implement SQLite/RocksDB Cache**
  - Design a schema to store `(path, size, mtime, partial_hash, full_hash)`.
  - Ensure the cache is persistent across app restarts.
- [x] **Implement Bash-Level Command Wrappers**
  - Replace generic Rust `fs` calls with `find`, `ls -R`, or `du` where performance gain is measurable.
  - Create a Rust utility to execute and parse output of these commands efficiently.
- [x] **Incremental Scan Logic**
  - Before hashing, check cache for `(path, size, mtime)`. If match exists, skip hashing.

## Phase 4: Frontend - Sidebar & Drive Selection
- [x] **Build Sidebar Drive Component**
  - Create a UI to list drives fetched from backend.
  - Display drive name, usage bar, and optional mount point.
- [x] **Implement Multi-Drive Selection**
  - Add `(+)` button or checkbox mechanism to select multiple drives for scanning.
  - Store selected paths in Zustand store.
- [x] **Implement "Lockdown" Protocol**
  - Create a UI state `isScanning`.
  - When scan starts, disable add/remove drive buttons.
  - Add visual overlay or reduced opacity to indicate locked state.

## Phase 5: Results Display & Management
- [x] **Build Results Grouping View**
  - Group files by their unique hash/size.
  - Display reclaimable space summary.
- [x] **Implement Smart Selection**
  - Create a button to "Select All but Newest/Oldest" in each group.
  - Allow manual checkbox selection of files for deletion.

## Phase 6: Safety & Multi-Pass Deletion
- [x] **Safe Deletion Workflow**
  - Integrate a "Trash" command (rather than permanent `rm`).
  - Provide a final confirmation before deleting.
- [x] **Perform Mock/Real Deletion**
  - Deletion command `delete_selections`.
  - Report success/failure.

## Phase 7: Edge Cases & Polish
- [ ] **Handle Special Paths**
  - Verify app handles paths with spaces, Emojis, and very long strings.
- [ ] **Performance Tuning**
  - audit scanning speed.
  - Add a "Cancel Scan" button that safely terminates the Rust threads.
