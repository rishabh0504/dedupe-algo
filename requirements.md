📄 DedupePro: Technical Requirements Document
1. Project Stack
Framework: Tauri (Rust Backend + Vite Frontend)

Frontend: React, Tailwind CSS, Shadcn UI

State Management: TanStack Query (for scan results) & Zustand (for UI/Queue state)

Backend: Rust (Tokio, Rayon, Blake3, Sysinfo)

2. Core Feature Requirements
A. High-Performance Rust Engine
Parallel Traversal: Utilize jwalk or rayon to walk multiple drives simultaneously.

Optimized Hashing: * Pass 1: Size comparison (instant).

Pass 2: Partial hash (first 16KB) to eliminate 90% of non-duplicates.

Pass 3: Full BLAKE3 hash for cryptographic certainty.

Hardware Awareness: Auto-detect Apple M3 Pro performance cores to optimize thread count.

Path Handling: Full support for special characters, emojis, and long paths in folder/file names.

B. Sidebar & Drive Controller
Live Discovery: Sidebar must list all internal and external drives using sysinfo.

Multi-Selection: Use a (+) button to add drives to the scan queue.

The "Lockdown" Protocol: * Once "Start Scan" is triggered, the scan queue becomes immutable.

Users cannot add/remove drives until the scan is cancelled or finished.

The UI must reflect this with a "Global Processing" overlay or disabled states.

C. Result Viewer & Grouping
Grouping Engine: Post-scan results must be toggleable by:

Content (Hash): Identical file data.

Name & Size: Identical metadata (fast view).

Directory Level: Identify if Folder A is a duplicate of Folder B.

Virtualization: Use tanstack-virtual to handle 100,000+ rows without UI lag.

D. Preview & Action Panel
Media Support: Integrated preview for .jpg, .png, .mp4, .mov, .mp3.

Metadata Display: Show file path, creation date, and permissions side-by-side for comparison.

Execution Logic: Support "Smart Delete" (move to Trash) and "Hard Link" (replace dupe with a pointer to the original).

3. Safety & Constraints
System Blacklist: Hard-coded exclusion of /System, /Library, /Windows, and /bin.

Memory Limit: Ensure streaming I/O so RAM usage never exceeds 2GB regardless of file size.

Bash Integration: Provide a "Shell Mode" where the app can export the deletion plan as a .sh script for manual execution.

4. Implementation Prompt for Antigravity
"Implement the DedupePro application based on the attached DedupePro_Requirements.md. Focus on the Rust-Tauri bridge for file I/O performance. Ensure the Shadcn sidebar supports multi-drive selection with a locked queue state during execution. The preview panel must be reactive to the selection in the main results table."
